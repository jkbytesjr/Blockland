import * as THREE from 'three';
import { BLOCK, BLOCK_COLORS } from './blocks.js';
import { CHUNK_SIZE, CHUNK_HEIGHT } from './world.js';

// The six faces of a unit cube: outward normal and four corners (CCW from outside)
const FACES = [
  { dir: [-1, 0, 0], corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]] },
  { dir: [1, 0, 0], corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]] },
  { dir: [0, -1, 0], corners: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]] },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]] },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]] },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]] },
];

// Builds one BufferGeometry for a whole chunk, in chunk-local coordinates.
// Only faces that touch air are emitted, including across chunk borders.
export function buildChunkGeometry(world, chunk) {
  const positions = [];
  const normals = [];
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
        const color = BLOCK_COLORS[id];
        for (const { dir, corners } of FACES) {
          if (neighbor(x + dir[0], y + dir[1], z + dir[2]) !== BLOCK.AIR) continue;
          const first = positions.length / 3;
          for (const c of corners) {
            positions.push(x + c[0], y + c[1], z + c[2]);
            normals.push(dir[0], dir[1], dir[2]);
            colors.push(color[0], color[1], color[2]);
          }
          indices.push(first, first + 1, first + 2, first + 2, first + 1, first + 3);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
