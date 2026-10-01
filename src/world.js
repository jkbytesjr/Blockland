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
    this.chunks = new Map();
    this.noise = createNoise2D(seed);
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
    const dirty = [World.key(cx, cz)];
    if (lx === 0) dirty.push(World.key(cx - 1, cz));
    if (lx === CHUNK_SIZE - 1) dirty.push(World.key(cx + 1, cz));
    if (lz === 0) dirty.push(World.key(cx, cz - 1));
    if (lz === CHUNK_SIZE - 1) dirty.push(World.key(cx, cz + 1));
    return dirty;
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

  generateChunk(cx, cz) {
    const chunk = new Chunk(cx, cz);
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const h = this.heightAt(cx * CHUNK_SIZE + x, cz * CHUNK_SIZE + z);
        const beach = h <= SEA_LEVEL;
        for (let y = 0; y < h; y++) {
          let id = BLOCK.STONE;
          if (y === h - 1) id = beach ? BLOCK.SAND : BLOCK.GRASS;
          else if (y >= h - 4) id = beach ? BLOCK.SAND : BLOCK.DIRT;
          chunk.set(x, y, z, id);
        }
      }
    }
    this.chunks.set(World.key(cx, cz), chunk);
    return chunk;
  }
}
