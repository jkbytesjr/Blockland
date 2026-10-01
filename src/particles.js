import * as THREE from 'three';
import { BLOCK_TEXTURES } from './blocks.js';
import { TILE_SIZE } from './textures.js';

// Little cubes that burst out of a block when it breaks, in the block's
// colors, then fall and shrink away. One instanced mesh draws them all.
const MAX = 240;
const PER_BLOCK = 14;
const GRAVITY = 18;

export class Particles {
  constructor(scene, atlasCanvas) {
    // Read the atlas pixels once (a copy, so the texture canvas isn't slowed down)
    const copy = document.createElement('canvas');
    copy.width = atlasCanvas.width;
    copy.height = atlasCanvas.height;
    const ctx = copy.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(atlasCanvas, 0, 0);
    this.pixels = ctx.getImageData(0, 0, copy.width, copy.height);
    this.colors = new Map(); // block id -> a few colors sampled from its texture
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), MAX);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.list = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
  }

  // Pick some pixel colors from the block's side texture
  colorsFor(id) {
    if (this.colors.has(id)) return this.colors.get(id);
    const tile = BLOCK_TEXTURES[id]?.side ?? 0;
    const { data, width } = this.pixels;
    const colors = [];
    for (let i = 0; i < 8; i++) {
      const n = (i * 37 + 11) % (TILE_SIZE * TILE_SIZE);
      const p = ((n >> 4) * width + tile * TILE_SIZE + (n & 15)) * 4;
      colors.push(new THREE.Color(`rgb(${data[p]}, ${data[p + 1]}, ${data[p + 2]})`));
    }
    this.colors.set(id, colors);
    return colors;
  }

  burst(x, y, z, id) {
    const colors = this.colorsFor(id);
    for (let i = 0; i < PER_BLOCK; i++) {
      if (this.list.length >= MAX) this.list.shift();
      this.list.push({
        pos: new THREE.Vector3(x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.6, z + 0.2 + Math.random() * 0.6),
        vel: new THREE.Vector3((Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 4),
        life: 0.5 + Math.random() * 0.4,
        age: 0,
        size: 0.08 + Math.random() * 0.06,
        color: colors[i % colors.length],
      });
    }
  }

  update(dt, isSolid) {
    let n = 0;
    this.list = this.list.filter((p) => (p.age += dt) < p.life);
    for (const p of this.list) {
      p.vel.y -= GRAVITY * dt;
      p.pos.addScaledVector(p.vel, dt);
      // Settle on the ground instead of falling through it
      if (isSolid(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z))) {
        p.pos.y = Math.floor(p.pos.y) + 1 + p.size / 2;
        p.vel.set(0, 0, 0);
      }
      const size = p.size * (1 - (p.age / p.life) ** 2);
      this._m.compose(p.pos, this._q, this._s.set(size, size, size));
      this.mesh.setMatrixAt(n, this._m);
      this.mesh.setColorAt(n, p.color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
