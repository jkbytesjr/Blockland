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

// Builds one BufferGeometry for a whole chunk, in chunk-local coordinates.
// Only faces that touch air are emitted, including across chunk borders.
export function buildChunkGeometry(world, chunk) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  const ox = chunk.cx * CHUNK_SIZE;
  const oz = chunk.cz * CHUNK_SIZE;

  // Neighbor lookup: stay inside this chunk when possible, else ask the world
  const neighbor = (x, y, z) =>
    x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE && y >= 0 && y < CHUNK_HEIGHT
      ? chunk.get(x, y, z)
      : world.getBlock(ox + x, y, oz + z);

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const id = chunk.get(x, y, z);
        if (id === BLOCK.AIR) continue;
        for (const { dir, tex, light, corners } of FACES) {
          if (neighbor(x + dir[0], y + dir[1], z + dir[2]) !== BLOCK.AIR) continue;
          const { u0, u1, v0, v1 } = tileUV(BLOCK_TEXTURES[id][tex]);
          const first = positions.length / 3;
          for (const [cx, cy, cz, u, v] of corners) {
            positions.push(x + cx, y + cy, z + cz);
            normals.push(dir[0], dir[1], dir[2]);
            uvs.push(u ? u1 : u0, v ? v1 : v0);
            colors.push(light, light, light);
          }
          indices.push(first, first + 1, first + 2, first + 2, first + 1, first + 3);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
