import * as THREE from 'three';
import { CHUNK_SIZE } from './world.js';
import { buildChunkGeometry } from './mesher.js';

// Owns one Three.js mesh per chunk. A mesh is only rebuilt when its chunk
// changed: edits mark chunks dirty and each dirty chunk is rebuilt once at the
// end of the frame, however many blocks in it changed.
export class ChunkMeshes {
  constructor(scene, world, material) {
    this.scene = scene;
    this.world = world;
    this.material = material;
    this.meshes = new Map(); // chunk key -> mesh
    this.dirty = new Set(); // keys of meshed chunks waiting for a rebuild
    this.builds = 0; // total meshes built, for debugging
  }

  // Queue a rebuild. Chunks without a mesh are skipped: they get a fresh one
  // when the loader brings them into range.
  markDirty(keys) {
    for (const key of keys) if (this.meshes.has(key)) this.dirty.add(key);
  }

  // Rebuild every dirty chunk, once each
  flush() {
    for (const key of this.dirty) this.build(key);
    this.dirty.clear();
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
    this.builds++;
    const mesh = new THREE.Mesh(buildChunkGeometry(this.world, chunk), this.material);
    mesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
    this.scene.add(mesh);
    this.meshes.set(key, mesh);
  }

  has(key) {
    return this.meshes.has(key);
  }

  remove(key) {
    const mesh = this.meshes.get(key);
    if (!mesh) return;
    this.scene.remove(mesh);
    mesh.geometry.dispose();
    this.meshes.delete(key);
    this.dirty.delete(key);
  }
}
