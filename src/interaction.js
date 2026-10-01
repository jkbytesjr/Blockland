import * as THREE from 'three';

const REACH = 6; // how far away the player can target blocks

// Walks the voxel grid along a ray (Amanatides & Woo) and returns the first
// solid block hit plus the face normal it was entered through, or null.
export function raycastVoxel(origin, direction, maxDist, isSolid) {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const stepX = Math.sign(direction.x);
  const stepY = Math.sign(direction.y);
  const stepZ = Math.sign(direction.z);
  // Ray distance to cross one whole block along each axis
  const deltaX = Math.abs(1 / direction.x);
  const deltaY = Math.abs(1 / direction.y);
  const deltaZ = Math.abs(1 / direction.z);
  // Ray distance to the first block boundary along each axis
  const frac = (v, step) => (step > 0 ? Math.floor(v) + 1 - v : v - Math.floor(v));
  let maxX = stepX ? frac(origin.x, stepX) * deltaX : Infinity;
  let maxY = stepY ? frac(origin.y, stepY) * deltaY : Infinity;
  let maxZ = stepZ ? frac(origin.z, stepZ) * deltaZ : Infinity;
  const normal = [0, 0, 0];

  let dist = 0;
  while (dist <= maxDist) {
    if (isSolid(x, y, z)) return { block: [x, y, z], normal: [...normal], dist };
    if (maxX < maxY && maxX < maxZ) {
      x += stepX; dist = maxX; maxX += deltaX; normal.splice(0, 3, -stepX, 0, 0);
    } else if (maxY < maxZ) {
      y += stepY; dist = maxY; maxY += deltaY; normal.splice(0, 3, 0, -stepY, 0);
    } else {
      z += stepZ; dist = maxZ; maxZ += deltaZ; normal.splice(0, 3, 0, 0, -stepZ);
    }
  }
  return null;
}

// Tracks which block the camera is looking at and outlines it
export class BlockSelector {
  constructor(scene, camera, world) {
    this.camera = camera;
    this.world = world;
    this.target = null; // { block: [x,y,z], normal: [nx,ny,nz] }

    // Slightly oversized wireframe cube so it doesn't z-fight with the faces
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
    this.highlight = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }));
    this.highlight.visible = false;
    scene.add(this.highlight);

    this._dir = new THREE.Vector3();
  }

  update() {
    this.camera.getWorldDirection(this._dir);
    this.target = raycastVoxel(this.camera.position, this._dir, REACH, (x, y, z) => this.world.isSolid(x, y, z));
    this.highlight.visible = !!this.target;
    if (this.target) {
      const [x, y, z] = this.target.block;
      this.highlight.position.set(x + 0.5, y + 0.5, z + 0.5);
    }
  }
}
