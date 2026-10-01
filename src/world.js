import { BLOCK, isSolidBlock } from './blocks.js';
import { createNoise2D, fbm } from './noise.js';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
const SEA_LEVEL = 24; // columns at or below this height become sand
export const WATER_LEVEL = 22; // air below this height is filled with water

// Trees: the world is split into TREE_CELL x TREE_CELL cells with at most one
// tree each, placed far enough inside its cell that the leaves never leave it.
// That way any block only has one tree that could reach it.
const TREE_CELL = 7;
const LEAF_RADIUS = 2;

// Deterministic hash of two integers and a seed to a number in [0, 1)
function hash2(x, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// One 16x16x64 column of blocks, stored flat in a typed array
export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
  }

  static index(x, y, z) {
    return x + CHUNK_SIZE * (z + CHUNK_SIZE * y);
  }

  get(x, y, z) {
    return this.blocks[Chunk.index(x, y, z)];
  }

  set(x, y, z, id) {
    this.blocks[Chunk.index(x, y, z)] = id;
  }
}

export class World {
  constructor(seed = 1337) {
    this.seed = seed;
    this.chunks = new Map();
    this.noise = createNoise2D(seed);
    this.forestNoise = createNoise2D(seed + 1); // where trees grow thick or sparse
    // Player edits, kept separately from chunk data so they survive a chunk
    // being unloaded and regenerated: chunk key -> Map(block index -> id)
    this.edits = new Map();
  }

  static key(cx, cz) {
    return `${cx},${cz}`;
  }

  getChunk(cx, cz) {
    return this.chunks.get(World.key(cx, cz));
  }

  // Block id at world coordinates. Below the world counts as stone so the
  // bottom of the world never gets meshed; unloaded chunks count as air.
  getBlock(x, y, z) {
    if (y < 0) return BLOCK.STONE;
    if (y >= CHUNK_HEIGHT) return BLOCK.AIR;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return BLOCK.AIR;
    return chunk.get(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE);
  }

  // Change a block. Returns the keys of chunks whose meshes need rebuilding:
  // the chunk itself plus any neighbor sharing the face that was touched.
  setBlock(x, y, z, id) {
    if (y < 0 || y >= CHUNK_HEIGHT) return [];
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return [];
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    chunk.set(lx, y, lz, id);
    this.recordEdit(cx, cz, Chunk.index(lx, y, lz), id, id === this.terrainBlock(x, y, z));
    const dirty = [World.key(cx, cz)];
    if (lx === 0) dirty.push(World.key(cx - 1, cz));
    if (lx === CHUNK_SIZE - 1) dirty.push(World.key(cx + 1, cz));
    if (lz === 0) dirty.push(World.key(cx, cz - 1));
    if (lz === CHUNK_SIZE - 1) dirty.push(World.key(cx, cz + 1));
    return dirty;
  }

  // Remember an edit, or forget it when the block is back to what the
  // terrain generator would produce anyway
  recordEdit(cx, cz, index, id, pristine) {
    const key = World.key(cx, cz);
    let chunkEdits = this.edits.get(key);
    if (pristine) {
      chunkEdits?.delete(index);
      if (chunkEdits?.size === 0) this.edits.delete(key);
      return;
    }
    if (!chunkEdits) this.edits.set(key, (chunkEdits = new Map()));
    chunkEdits.set(index, id);
  }

  // Solid blocks stop the player and the selection ray; air and water don't
  isSolid(x, y, z) {
    return isSolidBlock(this.getBlock(x, y, z));
  }

  isWater(x, y, z) {
    return this.getBlock(x, y, z) === BLOCK.WATER;
  }

  // Height to stand on in a column of unedited terrain, trees included
  surfaceAt(x, z) {
    for (let y = CHUNK_HEIGHT - 1; y > 0; y--) {
      if (isSolidBlock(this.terrainBlock(x, y, z))) return y + 1;
    }
    return 1;
  }

  // Terrain height (number of solid blocks) for a world column
  heightAt(x, z) {
    const n = fbm(this.noise, x / 90, z / 90, 4);
    const h = Math.floor(28 + n * 16);
    return Math.max(1, Math.min(CHUNK_HEIGHT - 2, h));
  }

  // What the generator puts at height y in a column whose surface is h
  static columnBlock(h, y) {
    if (y >= h) return y < WATER_LEVEL ? BLOCK.WATER : BLOCK.AIR;
    const beach = h <= SEA_LEVEL;
    if (y === h - 1) return beach ? BLOCK.SAND : BLOCK.GRASS;
    if (y >= h - 4) return beach ? BLOCK.SAND : BLOCK.DIRT;
    return BLOCK.STONE;
  }

  // The tree in a cell, or null: { x, z, base, height, seed }
  treeInCell(gx, gz) {
    const r = hash2(gx, gz, this.seed);
    // Forests where the forest noise is high, a lone tree now and then elsewhere
    const density = 0.08 + 0.6 * Math.max(0, this.forestNoise(gx / 6, gz / 6));
    if (r >= density) return null;
    const span = TREE_CELL - 2 * LEAF_RADIUS; // positions that keep leaves in the cell
    const x = gx * TREE_CELL + LEAF_RADIUS + Math.floor(hash2(gx, gz, this.seed + 7) * span);
    const z = gz * TREE_CELL + LEAF_RADIUS + Math.floor(hash2(gx, gz, this.seed + 13) * span);
    const base = this.heightAt(x, z);
    if (base <= SEA_LEVEL) return null; // only on grass, not beaches or under water
    const height = 4 + Math.floor(hash2(gx, gz, this.seed + 21) * 3); // trunk of 4-6 logs
    if (base + height + 1 >= CHUNK_HEIGHT) return null;
    return { x, z, base, height, seed: Math.floor(r * 1e9) };
  }

  // What a tree puts at (x, y, z): log, leaves or air
  static treeBlock(tree, x, y, z) {
    const dx = x - tree.x, dz = z - tree.z, dy = y - tree.base;
    const top = tree.height; // first layer above the trunk
    if (dx === 0 && dz === 0 && dy >= 0 && dy < top) return BLOCK.LOG;
    const ax = Math.abs(dx), az = Math.abs(dz);
    // Two wide layers around the upper trunk, then a small cap on top
    const radius = dy >= top - 2 && dy < top ? 2 : dy === top ? 1 : 0;
    if (!radius || ax > radius || az > radius) return BLOCK.AIR;
    // Round off some corners so trees don't look like perfect boxes
    if (ax === radius && az === radius && hash2(x * 31 + y, z, tree.seed) < 0.6) return BLOCK.AIR;
    return BLOCK.LEAVES;
  }

  // Unedited block at world coordinates
  terrainBlock(x, y, z) {
    const block = World.columnBlock(this.heightAt(x, z), y);
    if (block !== BLOCK.AIR) return block;
    const tree = this.treeInCell(Math.floor(x / TREE_CELL), Math.floor(z / TREE_CELL));
    return tree ? World.treeBlock(tree, x, y, z) : BLOCK.AIR;
  }

  // Grow the trees whose cells overlap a chunk, only into air
  addTrees(chunk) {
    const x0 = chunk.cx * CHUNK_SIZE, z0 = chunk.cz * CHUNK_SIZE;
    const cells = (start) => [Math.floor(start / TREE_CELL), Math.floor((start + CHUNK_SIZE - 1) / TREE_CELL)];
    const [gx0, gx1] = cells(x0), [gz0, gz1] = cells(z0);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        const tree = this.treeInCell(gx, gz);
        if (!tree) continue;
        for (let x = tree.x - LEAF_RADIUS; x <= tree.x + LEAF_RADIUS; x++) {
          for (let z = tree.z - LEAF_RADIUS; z <= tree.z + LEAF_RADIUS; z++) {
            const lx = x - x0, lz = z - z0;
            if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) continue;
            for (let y = tree.base; y <= tree.base + tree.height; y++) {
              if (chunk.get(lx, y, lz) !== BLOCK.AIR) continue;
              const id = World.treeBlock(tree, x, y, z);
              if (id) chunk.set(lx, y, lz, id);
            }
          }
        }
      }
    }
  }

  // Generate a chunk's terrain, then re-apply any edits made to it earlier
  generateChunk(cx, cz) {
    const chunk = new Chunk(cx, cz);
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const h = this.heightAt(cx * CHUNK_SIZE + x, cz * CHUNK_SIZE + z);
        for (let y = 0; y < Math.max(h, WATER_LEVEL); y++) chunk.set(x, y, z, World.columnBlock(h, y));
      }
    }
    this.addTrees(chunk);
    const chunkEdits = this.edits.get(World.key(cx, cz));
    if (chunkEdits) for (const [index, id] of chunkEdits) chunk.blocks[index] = id;
    this.chunks.set(World.key(cx, cz), chunk);
    return chunk;
  }

  unloadChunk(key) {
    this.chunks.delete(key);
  }
}
