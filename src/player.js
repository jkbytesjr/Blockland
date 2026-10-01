import * as THREE from 'three';

const WALK_SPEED = 5.5;
const GRAVITY = 28;
const JUMP_SPEED = 9;
const EYE_HEIGHT = 1.6;
const MOUSE_SENSITIVITY = 0.0022;

// First-person player: WASD, mouse look via pointer lock, jump and gravity.
// `isSolid(x, y, z)` answers whether the block at integer coords is solid.
export class Player {
  constructor(camera, domElement, isSolid) {
    this.camera = camera;
    this.isSolid = isSolid;
    this.position = new THREE.Vector3(0, 10, 0); // feet position
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.keys = new Set();
    this.locked = false;

    camera.rotation.order = 'YXZ';

    domElement.addEventListener('click', () => {
      if (!this.locked) domElement.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === domElement;
      if (!this.locked) this.keys.clear();
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
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

  update(dt) {
    dt = Math.min(dt, 0.05); // avoid huge steps after a stall

    // Horizontal movement relative to where we look
    const forward = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0);
    const strafe = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);
    const dir = new THREE.Vector3(strafe, 0, -forward);
    if (dir.lengthSq() > 0) dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    this.velocity.x = dir.x * WALK_SPEED;
    this.velocity.z = dir.z * WALK_SPEED;

    if (this.keys.has('Space') && this.onGround) {
      this.velocity.y = JUMP_SPEED;
      this.onGround = false;
    }
    this.velocity.y -= GRAVITY * dt;

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    // Simple ground check under the feet (full AABB collision comes in goal 8)
    const bx = Math.floor(this.position.x);
    const bz = Math.floor(this.position.z);
    const by = Math.floor(this.position.y);
    this.onGround = false;
    if (this.velocity.y <= 0 && this.isSolid(bx, by, bz)) {
      // Step up onto the block we sank into
      let top = by;
      while (this.isSolid(bx, top + 1, bz)) top++;
      this.position.y = top + 1;
      this.velocity.y = 0;
      this.onGround = true;
    }

    // Fell off the world: respawn above it
    if (this.position.y < -30) this.respawn?.();

    this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
