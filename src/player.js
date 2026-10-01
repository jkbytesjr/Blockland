import * as THREE from 'three';

const WALK_SPEED = 5.5;
const GRAVITY = 28;
const JUMP_SPEED = 9;
const EYE_HEIGHT = 1.6;
const MOUSE_SENSITIVITY = 0.0022;
export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
const MAX_FALL_SPEED = 50;
const SKIN = 0.001; // tiny gap kept between the player and walls
// In water: slow sinking, slower walking, and Space swims up
const SWIM_SPEED = 4;
const WATER_GRAVITY = 7;
const MAX_SINK_SPEED = 3;
const WATER_WALK = 0.6;

// First-person player: WASD, mouse look via pointer lock, jump and gravity.
// `isSolid(x, y, z)` answers whether the block at integer coords is solid.
export class Player {
  constructor(camera, domElement, isSolid) {
    this.camera = camera;
    this.domElement = domElement;
    this.isSolid = isSolid;
    this.position = new THREE.Vector3(0, 10, 0); // feet position
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.keys = new Set();
    this.locked = false;
    this.inWater = false;
    this.isWater = () => false; // set by the game: is (x, y, z) a water block?

    camera.rotation.order = 'YXZ';

    // Drag mode: used when the browser won't capture the mouse (for example
    // inside a sandboxed preview frame). Look around by dragging instead.
    this.dragMode = false;

    document.addEventListener('pointerlockchange', () => {
      if (this.dragMode) return;
      this.setLocked(document.pointerLockElement === domElement);
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.dragMode) {
        this.dragMode = false;
        this.setLocked(false);
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      if (this.dragMode && !e.buttons) return; // only look while a button is held
      this.yaw -= e.movementX * MOUSE_SENSITIVITY;
      this.pitch -= e.movementY * MOUSE_SENSITIVITY;
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    });
    window.addEventListener('keydown', (e) => {
      if (this.locked) this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  // Start playing: capture the mouse, or fall back to drag mode if the
  // browser refuses (it can throw, reject its promise, or fire an error event)
  start() {
    if (this.locked) return;
    const el = this.domElement;
    const fallback = () => {
      this.lockBlocked = true; // don't ask again: it fails the same way every time
      if (this.locked) return;
      this.dragMode = true;
      this.setLocked(true);
    };
    if (!el.requestPointerLock || this.lockBlocked) return fallback();
    document.addEventListener('pointerlockerror', fallback, { once: true });
    try {
      el.requestPointerLock()?.catch?.(fallback);
    } catch {
      fallback();
    }
  }

  setLocked(locked) {
    if (locked === this.locked) return;
    this.locked = locked;
    if (!locked) this.keys.clear();
    this.onLockChange?.(locked);
  }

  // Does the player's body box overlap the unit block at (x, y, z)?
  overlapsBlock(x, y, z) {
    const r = PLAYER_WIDTH / 2;
    const p = this.position;
    return p.x + r > x && p.x - r < x + 1 && p.z + r > z && p.z - r < z + 1 && p.y + PLAYER_HEIGHT > y && p.y < y + 1;
  }

  // Move along one axis, then push back out of any solid block we entered
  moveAxis(axis, amount) {
    if (amount === 0) return;
    const p = this.position;
    p[axis] += amount;
    const r = PLAYER_WIDTH / 2;
    const x0 = Math.floor(p.x - r), x1 = Math.floor(p.x + r - SKIN);
    const y0 = Math.floor(p.y), y1 = Math.floor(p.y + PLAYER_HEIGHT - SKIN);
    const z0 = Math.floor(p.z - r), z1 = Math.floor(p.z + r - SKIN);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          if (!this.isSolid(x, y, z)) continue;
          // Snap flush against the face of the block we ran into
          if (axis === 'x') p.x = amount > 0 ? x - r - SKIN : x + 1 + r + SKIN;
          if (axis === 'z') p.z = amount > 0 ? z - r - SKIN : z + 1 + r + SKIN;
          if (axis === 'y') {
            p.y = amount > 0 ? y - PLAYER_HEIGHT - SKIN : y + 1;
            if (amount < 0) this.onGround = true;
          }
          this.velocity[axis] = 0;
          return;
        }
      }
    }
  }

  update(dt) {
    dt = Math.min(dt, 0.05); // avoid huge steps after a stall

    // Horizontal movement relative to where we look
    const forward = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const strafe = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const dir = new THREE.Vector3(strafe, 0, -forward);
    if (dir.lengthSq() > 0) dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    // Feet in water means swimming. Checking at the feet lets the last
    // stroke lift the player out onto a bank.
    const p = this.position;
    this.inWater = this.isWater(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
    const speed = this.inWater ? WALK_SPEED * WATER_WALK : WALK_SPEED;
    this.velocity.x = dir.x * speed;
    this.velocity.z = dir.z * speed;

    if (this.inWater) {
      if (this.keys.has('Space')) this.velocity.y = SWIM_SPEED;
      this.velocity.y -= WATER_GRAVITY * dt;
      this.velocity.y = Math.max(this.velocity.y, -MAX_SINK_SPEED);
    } else {
      if (this.keys.has('Space') && this.onGround) {
        this.velocity.y = JUMP_SPEED;
        this.onGround = false;
      }
      this.velocity.y -= GRAVITY * dt;
      this.velocity.y = Math.max(this.velocity.y, -MAX_FALL_SPEED);
    }

    // Move one axis at a time so we can slide along walls. Large moves are
    // split into small steps so a fast fall can't tunnel through a block.
    this.onGround = false;
    const steps = Math.ceil(Math.max(Math.abs(this.velocity.x), Math.abs(this.velocity.y), Math.abs(this.velocity.z)) * dt / 0.4);
    for (let i = 0; i < steps; i++) {
      this.moveAxis('x', (this.velocity.x * dt) / steps);
      this.moveAxis('z', (this.velocity.z * dt) / steps);
      this.moveAxis('y', (this.velocity.y * dt) / steps);
    }

    // Fell off the world: respawn above it
    if (this.position.y < -30) this.respawn?.();

    this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
