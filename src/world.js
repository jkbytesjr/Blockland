import { BLOCK } from './blocks.js';
import { createNoise2D, fbm } from './noise.js';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
const SEA_LEVEL = 24; // columns at or below this height become sand

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

  isSolid(x, y, z) {
    return this.getBlock(x, y, z) !== BLOCK.AIR;
  }

  // Terrain height (number of solid blocks) for a world column
  heightAt(x, z) {
    const n = fbm(this.noise, x / 90, z / 90, 4);
    const h = Math.floor(28 + n * 16);
    return Math.max(1, Math.min(CHUNK_HEIGHT - 2, h));
  }

  // What the generator puts at height y in a column whose surface is h
  static columnBlock(h, y) {
    if (y >= h) return BLOCK.AIR;
    const beach = h <= SEA_LEVEL;
    if (y === h - 1) return beach ? BLOCK.SAND : BLOCK.GRASS;
    if (y >= h - 4) return beach ? BLOCK.SAND : BLOCK.DIRT;
    return BLOCK.STONE;
  }

  // Unedited block at world coordinates
  terrainBlock(x, y, z) {
    return World.columnBlock(this.heightAt(x, z), y);
  }

  // Generate a chunk's terrain, then re-apply any edits made to it earlier
  generateChunk(cx, cz) {
    const chunk = new Chunk(cx, cz);
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const h = this.heightAt(cx * CHUNK_SIZE + x, cz * CHUNK_SIZE + z);
        for (let y = 0; y < h; y++) chunk.set(x, y, z, World.columnBlock(h, y));
      }
    }
    const chunkEdits = this.edits.get(World.key(cx, cz));
    if (chunkEdits) for (const [index, id] of chunkEdits) chunk.blocks[index] = id;
    this.chunks.set(World.key(cx, cz), chunk);
    return chunk;
  }

  unloadChunk(key) {
    this.chunks.delete(key);
  }
}
