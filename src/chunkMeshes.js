import * as THREE from 'three';
import { CHUNK_SIZE } from './world.js';
import { buildChunkGeometry } from './mesher.js';

// Owns one Three.js mesh per chunk and rebuilds them on demand
export class ChunkMeshes {
  constructor(scene, world, material) {
    this.scene = scene;
    this.world = world;
    this.material = material;
    this.meshes = new Map(); // chunk key -> mesh
  }

  // (Re)build the mesh for a chunk key; unknown keys are ignored
  build(key) {
    const chunk = this.world.chunks.get(key);
    if (!chunk) return;
    const old = this.meshes.get(key);
    if (old) {
      this.scene.remove(old);
      old.geometry.dispose();
    }
    const mesh = new THREE.Mesh(buildChunkGeometry(this.world, chunk), this.material);
    mesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
    this.scene.add(mesh);
    this.meshes.set(key, mesh);
  }

  buildAll() {
    for (const key of this.world.chunks.keys()) this.build(key);
  }
}
