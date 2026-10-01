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

// Mouse editing: left click breaks the targeted block, right click places
// the selected block against the targeted face.
export class BlockEditor {
  constructor(world, selector, player, onChange) {
    this.world = world;
    this.selector = selector;
    this.player = player;
    this.onChange = onChange; // called with the chunk keys to rebuild
    this.selectedBlock = () => 0;
    this.onSound = () => {}; // called with ('break' | 'place', block id)

    document.addEventListener('mousedown', (e) => {
      if (!this.player.locked) return;
      if (e.button === 0) this.breakBlock();
      else if (e.button === 2) this.placeBlock();
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  breakBlock() {
    const target = this.selector.target;
    if (!target) return false;
    const [x, y, z] = target.block;
    if (y <= 0) return false; // keep a floor under the world
    this.onSound('break', this.world.getBlock(x, y, z));
    this.onChange(this.world.setBlock(x, y, z, 0));
    this.selector.update();
    return true;
  }

  placeBlock() {
    const target = this.selector.target;
    const id = this.selectedBlock();
    if (!target || !id) return false;
    const x = target.block[0] + target.normal[0];
    const y = target.block[1] + target.normal[1];
    const z = target.block[2] + target.normal[2];
    if (this.world.isSolid(x, y, z)) return false;
    if (this.player.overlapsBlock(x, y, z)) return false; // don't bury the player
    const dirty = this.world.setBlock(x, y, z, id);
    if (!dirty.length) return false; // outside the world
    this.onSound('place', id);
    this.onChange(dirty);
    this.selector.update();
    return true;
  }
}
