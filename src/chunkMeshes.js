import * as THREE from 'three';
import { CHUNK_SIZE } from './world.js';
import { buildChunkGeometry } from './mesher.js';

// Owns the Three.js meshes of each chunk (a group holding a solid mesh and,
// if the chunk has any, a see-through water mesh). A mesh is only rebuilt when its chunk
// changed: edits mark chunks dirty and each dirty chunk is rebuilt once at the
// end of the frame, however many blocks in it changed.
export class ChunkMeshes {
  constructor(scene, world, material, waterMaterial) {
    this.scene = scene;
    this.world = world;
    this.material = material;
    this.waterMaterial = waterMaterial;
    this.meshes = new Map(); // chunk key -> group of meshes
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
    this.dispose(this.meshes.get(key));
    this.builds++;
    const { solid, water } = buildChunkGeometry(this.world, chunk);
    const group = new THREE.Group();
    if (solid) group.add(new THREE.Mesh(solid, this.material));
    if (water) group.add(new THREE.Mesh(water, this.waterMaterial));
    group.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
    this.scene.add(group);
    this.meshes.set(key, group);
  }

  has(key) {
    return this.meshes.has(key);
  }

  remove(key) {
    if (!this.meshes.has(key)) return;
    this.dispose(this.meshes.get(key));
    this.meshes.delete(key);
    this.dirty.delete(key);
  }

  dispose(group) {
    if (!group) return;
    this.scene.remove(group);
    for (const mesh of group.children) mesh.geometry.dispose();
  }
}
