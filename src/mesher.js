import * as THREE from 'three';
import { BLOCK, BLOCK_TEXTURES } from './blocks.js';
import { CHUNK_SIZE, CHUNK_HEIGHT } from './world.js';
import { tileUV } from './textures.js';

// The six faces of a unit cube: outward normal, which texture to use,
// a brightness for a classic blocky look, and four corners with their UVs
const FACES = [
  { dir: [-1, 0, 0], tex: 'side', light: 0.8, corners: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { dir: [1, 0, 0], tex: 'side', light: 0.8, corners: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { dir: [0, -1, 0], tex: 'bottom', light: 0.55, corners: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { dir: [0, 1, 0], tex: 'top', light: 1.0, corners: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { dir: [0, 0, -1], tex: 'side', light: 0.9, corners: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { dir: [0, 0, 1], tex: 'side', light: 0.9, corners: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];

// UVs per block id and face, worked out once instead of per face
const FACE_UVS = [];
for (const id in BLOCK_TEXTURES) {
  FACE_UVS[id] = FACES.map(({ tex }) => tileUV(BLOCK_TEXTURES[id][tex]));
}

// Growable vertex buffers for one kind of geometry, reused across builds to
// avoid garbage. Chunks get two: opaque blocks and see-through water.
class QuadBuffer {
  constructor() {
    this.capacity = 0;
    this.quads = 0;
    this.ensure(1024);
  }

  ensure(quads) {
    if (quads <= this.capacity) return;
    this.capacity = Math.max(quads, this.capacity * 2);
    const grow = (old, size, Type) => {
      const next = new Type(size);
      if (old) next.set(old.subarray(0, Math.min(old.length, size)));
      return next;
    };
    this.positions = grow(this.positions, this.capacity * 12, Float32Array);
    this.normals = grow(this.normals, this.capacity * 12, Float32Array);
    this.uvs = grow(this.uvs, this.capacity * 8, Float32Array);
    this.colors = grow(this.colors, this.capacity * 12, Float32Array);
    this.indices = grow(this.indices, this.capacity * 6, Uint32Array);
  }

  // Add one face of the block at (x, y, z); `top` is the height of its upper corners
  addFace(x, y, z, f, id, top) {
    this.ensure(this.quads + 1);
    const { positions, normals, uvs, colors, indices } = this;
    const { dir, light, corners } = FACES[f];
    const { u0, u1, v0, v1 } = FACE_UVS[id][f];
    const first = this.quads * 4;
    for (let c = 0; c < 4; c++) {
      const [cx, cy, cz, u, v] = corners[c];
      const p = (first + c) * 3;
      positions[p] = x + cx; positions[p + 1] = y + (cy ? top : 0); positions[p + 2] = z + cz;
      normals[p] = dir[0]; normals[p + 1] = dir[1]; normals[p + 2] = dir[2];
      colors[p] = colors[p + 1] = colors[p + 2] = light;
      const t = (first + c) * 2;
      uvs[t] = u ? u1 : u0; uvs[t + 1] = v ? v1 : v0;
    }
    const i = this.quads * 6;
    indices[i] = first; indices[i + 1] = first + 1; indices[i + 2] = first + 2;
    indices[i + 3] = first + 2; indices[i + 4] = first + 1; indices[i + 5] = first + 3;
    this.quads++;
  }

  // Copy out just the used part into a geometry, or null if it's empty
  toGeometry() {
    const n = this.quads;
    this.quads = 0;
    if (!n) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions.slice(0, n * 12), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(this.normals.slice(0, n * 12), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(this.uvs.slice(0, n * 8), 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors.slice(0, n * 12), 3));
    geometry.setIndex(new THREE.BufferAttribute(this.indices.slice(0, n * 6), 1));
    geometry.computeBoundingSphere();
    return geometry;
  }
}

const solidQuads = new QuadBuffer();
const waterQuads = new QuadBuffer();
const WATER_TOP = 0.875; // the water surface sits a little below the block top

const LAYER = CHUNK_SIZE * CHUNK_SIZE; // blocks per y layer

// Builds the geometry for a whole chunk, in chunk-local coordinates:
// { solid, water }, either of which may be null when empty.
// Solid faces are emitted when they touch air or water; water faces only when
// they touch air, so lakes are one surface rather than a stack of cubes.
// Hot loop: reads the typed arrays directly instead of calling getters.
export function buildChunkGeometry(world, chunk) {
  const blocks = chunk.blocks;
  // Neighbor chunks for faces on the border (missing ones count as air)
  const sides = [
    world.getChunk(chunk.cx - 1, chunk.cz)?.blocks,
    world.getChunk(chunk.cx + 1, chunk.cz)?.blocks,
    null, null,
    world.getChunk(chunk.cx, chunk.cz - 1)?.blocks,
    world.getChunk(chunk.cx, chunk.cz + 1)?.blocks,
  ];
  const last = CHUNK_SIZE - 1;

  // Block id next to (x, y, z) across face f
  const neighbor = (x, y, z, f) => {
    switch (f) {
      case 0: return x > 0 ? blocks[y * LAYER + z * CHUNK_SIZE + x - 1] : sides[0] ? sides[0][y * LAYER + z * CHUNK_SIZE + last] : BLOCK.AIR;
      case 1: return x < last ? blocks[y * LAYER + z * CHUNK_SIZE + x + 1] : sides[1] ? sides[1][y * LAYER + z * CHUNK_SIZE] : BLOCK.AIR;
      case 2: return y > 0 ? blocks[(y - 1) * LAYER + z * CHUNK_SIZE + x] : BLOCK.STONE; // world floor is never shown
      case 3: return y < CHUNK_HEIGHT - 1 ? blocks[(y + 1) * LAYER + z * CHUNK_SIZE + x] : BLOCK.AIR;
      case 4: return z > 0 ? blocks[y * LAYER + (z - 1) * CHUNK_SIZE + x] : sides[4] ? sides[4][y * LAYER + last * CHUNK_SIZE + x] : BLOCK.AIR;
      default: return z < last ? blocks[y * LAYER + (z + 1) * CHUNK_SIZE + x] : sides[5] ? sides[5][y * LAYER + x] : BLOCK.AIR;
    }
  };

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const id = blocks[y * LAYER + z * CHUNK_SIZE + x];
        if (id === BLOCK.AIR) continue;
        if (id === BLOCK.WATER) {
          // Lower the surface unless more water sits on top
          const top = neighbor(x, y, z, 3) === BLOCK.WATER ? 1 : WATER_TOP;
          for (let f = 0; f < 6; f++) {
            if (neighbor(x, y, z, f) === BLOCK.AIR) waterQuads.addFace(x, y, z, f, id, top);
          }
          continue;
        }
        for (let f = 0; f < 6; f++) {
          const n = neighbor(x, y, z, f);
          if (n === BLOCK.AIR || n === BLOCK.WATER) solidQuads.addFace(x, y, z, f, id, 1);
        }
      }
    }
  }

  return { solid: solidQuads.toGeometry(), water: waterQuads.toGeometry() };
}
