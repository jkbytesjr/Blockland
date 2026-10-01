import * as THREE from 'three';

const REACH = 6; // how far away the player can target blocks
const EAT_TIME = 1.2; // seconds of holding right click to eat

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

// Mouse editing. Left button breaks the targeted block: instantly in
// creative, or by holding it down in survival (time depends on the block and
// the tool). Right click places the held block against the targeted face.
export class BlockEditor {
  constructor(world, selector, player, onChange) {
    this.world = world;
    this.selector = selector;
    this.player = player;
    this.onChange = onChange; // called with the chunk keys to rebuild
    // Set up by the game:
    this.heldItem = () => 0; // item id in the selected hotbar slot
    this.creative = () => false;
    this.breakTime = () => 1; // seconds to break (block id, held item id)
    this.onBroken = () => {}; // (block id, held item id), for drops
    this.onPlaced = () => {}; // the held block was placed (use one up)
    this.onSound = () => {}; // ('break' | 'place' | 'step', block id)
    this.tryAttack = () => false; // hit a mob instead? true if one was hit
    this.onProgress = () => {}; // mining progress 0..1
    this.canEat = () => false; // (held item id) can it be eaten now?
    this.onEaten = () => {}; // the held food was eaten
    this.onSwing = () => {}; // the hand swings (hit, break, place)

    this.eating = false; // right button held on food
    this.eatProgress = 0;

    this.mining = false; // left button held
    this.progress = 0;
    this.miningBlock = null; // "x,y,z" of the block being mined
    this.hitTimer = 0;

    // With a captured mouse, act on press. In drag mode a press may start a
    // look-around drag: mining stops once the mouse moves, and placing waits
    // for a release that barely moved.
    let down = null;
    document.addEventListener('mousedown', (e) => {
      if (!this.player.locked) return;
      down = { x: e.clientX, y: e.clientY };
      if (e.button === 0) this.startMining();
      else if (e.button === 2 && this.canEat(this.heldItem())) this.startEating();
      else if (e.button === 2 && !this.player.dragMode) this.placeBlock();
    });
    document.addEventListener('mousemove', (e) => {
      if (down && this.player.dragMode && Math.hypot(e.clientX - down.x, e.clientY - down.y) >= 6) this.stopMining();
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.stopMining();
      if (e.button === 2 && this.eating) {
        this.stopEating();
        down = null;
        return;
      }
      const still = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6;
      if (e.button === 2 && this.player.dragMode && this.player.locked && still) this.placeBlock();
      down = null;
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  startEating() {
    this.eating = true;
    this.eatProgress = 0;
  }

  stopEating() {
    this.eating = false;
    this.eatProgress = 0;
  }

  // Eating takes a moment of holding right click, with chewing sounds
  updateEating(dt) {
    if (!this.player.locked || !this.canEat(this.heldItem())) return this.stopEating();
    const before = this.eatProgress;
    this.eatProgress += dt / EAT_TIME;
    if (Math.floor(before * 5) !== Math.floor(this.eatProgress * 5)) this.onSound('eat', 0);
    if (this.eatProgress >= 1) {
      this.eatProgress = 0;
      this.onEaten();
    }
  }

  startMining() {
    this.onSwing();
    if (this.tryAttack()) return;
    this.mining = true;
    this.progress = 0;
    this.miningBlock = null;
    if (this.creative()) this.breakBlock();
  }

  stopMining() {
    this.mining = false;
    this.progress = 0;
    this.onProgress(0);
  }

  // Survival mining: progress builds while the button stays on one block
  update(dt) {
    if (this.eating) this.updateEating(dt);
    if (!this.mining || !this.player.locked || this.creative()) return;
    const target = this.selector.target;
    if (!target) return this.onProgress((this.progress = 0));
    const [x, y, z] = target.block;
    const key = `${x},${y},${z}`;
    const id = this.world.getBlock(x, y, z);
    if (key !== this.miningBlock) {
      this.miningBlock = key;
      this.progress = 0;
    }
    this.progress += dt / this.breakTime(id, this.heldItem());
    this.hitTimer -= dt;
    if (this.hitTimer <= 0) {
      this.hitTimer = 0.25;
      this.onSwing();
      this.onSound('step', id); // tapping sound while mining
    }
    if (this.progress >= 1) {
      this.breakBlock();
      this.progress = 0;
      this.miningBlock = null;
    }
    this.onProgress(this.progress);
  }

  breakBlock() {
    const target = this.selector.target;
    if (!target) return false;
    const [x, y, z] = target.block;
    if (y <= 0) return false; // keep a floor under the world
    const id = this.world.getBlock(x, y, z);
    this.onSound('break', id);
    this.onChange(this.world.setBlock(x, y, z, 0));
    this.onBroken(id, this.heldItem());
    this.selector.update();
    return true;
  }

  placeBlock() {
    const target = this.selector.target;
    const id = this.heldItem();
    if (!target || !id || id >= 100) return false; // only blocks can be placed
    const x = target.block[0] + target.normal[0];
    const y = target.block[1] + target.normal[1];
    const z = target.block[2] + target.normal[2];
    if (this.world.isSolid(x, y, z)) return false;
    if (this.player.overlapsBlock(x, y, z)) return false; // don't bury the player
    const dirty = this.world.setBlock(x, y, z, id);
    if (!dirty.length) return false; // outside the world
    this.onSound('place', id);
    this.onSwing();
    this.onChange(dirty);
    this.onPlaced();
    this.selector.update();
    return true;
  }
}
