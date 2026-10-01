import { CHUNK_SIZE, World } from './world.js';

// Streams chunks in and out around the player.
//
// Rings, measured in chunks from the player's chunk:
//   <= radius      chunk is meshed (visible)
//   <= radius + 1  chunk data is generated, so every meshed chunk has all four
//                  neighbors and its border faces are culled correctly the
//                  first time; loading a chunk never forces a neighbor rebuild
//   > radius + 1   mesh is dropped;  > radius + 2  data is dropped too
// The one-ring gap between loading and unloading stops chunks thrashing
// when the player walks back and forth across a chunk border.
export class ChunkLoader {
  constructor(world, chunkMeshes, radius = 6) {
    this.world = world;
    this.chunkMeshes = chunkMeshes;
    this.radius = radius;
    this.budgetMs = 4; // time per frame spent generating and meshing
    this.center = null; // player's chunk when the work lists were last made
    this.toGenerate = [];
    this.toMesh = [];
  }

  // Load everything in range right away (used at spawn, before the first frame)
  loadAll(x, z) {
    this.update(x, z, Infinity);
  }

  update(x, z, budgetMs = this.budgetMs) {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    if (!this.center || this.center[0] !== cx || this.center[1] !== cz) {
      this.center = [cx, cz];
      this.unloadFar(cx, cz);
      this.plan(cx, cz);
    }

    // The chunk under the player and its neighbors must exist so collision
    // works even if the player outruns the loader
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (!this.world.getChunk(cx + dx, cz + dz)) this.world.generateChunk(cx + dx, cz + dz);
      }
    }

    // Nearest first; data before meshes so a mesh's neighbors are ready
    const start = performance.now();
    while (performance.now() - start < budgetMs) {
      if (this.toGenerate.length) {
        const [gx, gz] = this.toGenerate.pop();
        if (!this.world.getChunk(gx, gz)) this.world.generateChunk(gx, gz);
      } else if (this.toMesh.length) {
        const key = this.toMesh.pop();
        if (!this.chunkMeshes.has(key)) this.chunkMeshes.build(key);
      } else break;
    }
  }

  // Rebuild the work lists for a new center, sorted so pop() gives the nearest
  plan(cx, cz) {
    const gen = [];
    const mesh = [];
    const r = this.radius + 1;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > r) continue;
        if (!this.world.getChunk(cx + dx, cz + dz)) gen.push([cx + dx, cz + dz, d]);
        const key = World.key(cx + dx, cz + dz);
        if (d <= this.radius && !this.chunkMeshes.has(key)) mesh.push([key, d]);
      }
    }
    this.toGenerate = gen.sort((a, b) => b[2] - a[2]);
    this.toMesh = mesh.sort((a, b) => b[1] - a[1]).map(([key]) => key);
  }

  unloadFar(cx, cz) {
    const dist = (c) => Math.hypot(c.cx - cx, c.cz - cz);
    for (const [key, chunk] of this.world.chunks) {
      const d = dist(chunk);
      if (d > this.radius + 1) this.chunkMeshes.remove(key);
      if (d > this.radius + 2) this.world.unloadChunk(key);
    }
  }

}
