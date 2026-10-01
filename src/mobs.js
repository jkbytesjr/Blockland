import * as THREE from 'three';
import { attackDamage, ITEM } from './items.js';

// Shamblers: slow, blocky night creatures that walk toward the player and hit
// them. They spawn around the player at night, burn away at sunrise, and only
// hurt the player in survival.

const MAX_MOBS = 10;
const SPAWN_EVERY = 2; // seconds between spawn attempts at night
const SPAWN_MIN = 18, SPAWN_MAX = 30; // distance from the player
const DESPAWN_DISTANCE = 70;
const CHASE_RANGE = 24;
const WALK_SPEED = 2.4; // the player walks at 5.5 and sprints at 8.8
const GRAVITY = 28;
const JUMP_SPEED = 8.5;
const WIDTH = 0.6, HEIGHT = 1.8;
const MAX_HEALTH = 12;
const ATTACK_DAMAGE = 3;
const ATTACK_COOLDOWN = 1;
const REACH = 4; // how far the player can hit

// Shared look: geometry and colors, built once
const box = (w, h, d, y) => new THREE.BoxGeometry(w, h, d).translate(0, y, 0);
const GEOMETRY = {
  head: box(0.5, 0.5, 0.5, 0.25),
  body: box(0.5, 0.7, 0.28, 0.35),
  limb: box(0.22, 0.7, 0.22, -0.35), // hangs down from its joint
  eye: new THREE.PlaneGeometry(0.1, 0.06),
};
const SKIN = 0x5f8a5a, SHIRT = 0x2f5d7a, PANTS = 0x3b3355;
const EYE = new THREE.MeshBasicMaterial({ color: 0xffe066 }); // eyes glow in the dark

class Mob {
  constructor(scene, x, y, z) {
    this.position = new THREE.Vector3(x, y, z);
    this.velocity = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.health = MAX_HEALTH;
    this.onGround = false;
    this.cooldown = 0;
    this.walk = 0; // walk cycle phase for swinging limbs
    this.wander = 0; // seconds until picking a new wander direction
    this.hurtTime = 0;
    this.knock = new THREE.Vector3(); // knockback velocity, fades quickly
    this.burnDelay = Math.random() * 6; // stagger sunrise despawns

    // Each mob has its own materials so it can flash red when hit
    this.materials = [SKIN, SHIRT, PANTS].map((color) => new THREE.MeshLambertMaterial({ color }));
    const [skin, shirt, pants] = this.materials;
    const part = (geometry, material, x, y, z = 0) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      return mesh;
    };
    this.group = new THREE.Group();
    this.head = part(GEOMETRY.head, skin, 0, 1.4);
    for (const ex of [-0.12, 0.12]) this.head.add(part(GEOMETRY.eye, EYE, ex, 0.3, -0.252));
    this.head.children.forEach((eye) => (eye.rotation.y = Math.PI));
    this.legs = [part(GEOMETRY.limb, pants, -0.12, 0.7), part(GEOMETRY.limb, pants, 0.12, 0.7)];
    this.arms = [part(GEOMETRY.limb, skin, -0.36, 1.35), part(GEOMETRY.limb, skin, 0.36, 1.35)];
    for (const arm of this.arms) arm.rotation.x = Math.PI / 2; // arms out in front
    this.group.add(this.head, part(GEOMETRY.body, shirt, 0, 0.7), ...this.legs, ...this.arms);
    scene.add(this.group);
  }

  // Same per-axis collision as the player
  moveAxis(axis, amount, isSolid) {
    if (amount === 0) return false;
    const p = this.position;
    p[axis] += amount;
    const r = WIDTH / 2, e = 0.001;
    for (let x = Math.floor(p.x - r); x <= Math.floor(p.x + r - e); x++) {
      for (let y = Math.floor(p.y); y <= Math.floor(p.y + HEIGHT - e); y++) {
        for (let z = Math.floor(p.z - r); z <= Math.floor(p.z + r - e); z++) {
          if (!isSolid(x, y, z)) continue;
          if (axis === 'x') p.x = amount > 0 ? x - r - e : x + 1 + r + e;
          if (axis === 'z') p.z = amount > 0 ? z - r - e : z + 1 + r + e;
          if (axis === 'y') {
            p.y = amount > 0 ? y - HEIGHT - e : y + 1;
            if (amount < 0) this.onGround = true;
          }
          this.velocity[axis] = 0;
          return true;
        }
      }
    }
    return false;
  }

  // Ray from `origin` along `dir`: distance to this mob's box, or Infinity
  rayHit(origin, dir) {
    const r = WIDTH / 2 + 0.1; // a little generous so hits feel fair
    const min = [this.position.x - r, this.position.y, this.position.z - r];
    const max = [this.position.x + r, this.position.y + HEIGHT, this.position.z + r];
    let near = 0, far = Infinity;
    const o = [origin.x, origin.y, origin.z], d = [dir.x, dir.y, dir.z];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) {
        if (o[i] < min[i] || o[i] > max[i]) return Infinity;
        continue;
      }
      let t1 = (min[i] - o[i]) / d[i], t2 = (max[i] - o[i]) / d[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      near = Math.max(near, t1);
      far = Math.min(far, t2);
      if (near > far) return Infinity;
    }
    return near;
  }

  // Swing limbs while walking, flash red after a hit, face the walk direction
  animate(dt) {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    this.walk += speed * dt * 3;
    const swing = Math.sin(this.walk) * 0.6 * Math.min(1, speed);
    this.legs[0].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    this.arms[0].rotation.x = Math.PI / 2 + swing * 0.3;
    this.arms[1].rotation.x = Math.PI / 2 - swing * 0.3;
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    for (const m of this.materials) m.emissive.setRGB(this.hurtTime > 0 ? 0.6 : 0, 0, 0);
    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
  }

  dispose(scene) {
    scene.remove(this.group);
    for (const m of this.materials) m.dispose();
  }
}

export class Mobs {
  constructor({ scene, world, player, game, sky, sounds, inventory }) {
    Object.assign(this, { scene, world, player, game, sky, sounds, inventory });
    this.list = [];
    this.spawnTimer = 0;
    this._dir = new THREE.Vector3();
    this.isSolid = (x, y, z) => world.isSolid(x, y, z);
  }

  get night() {
    return this.sky.sunHeight < -0.05;
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    if (this.night) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= SPAWN_EVERY) {
        this.spawnTimer = 0;
        if (this.list.length < MAX_MOBS) this.trySpawn();
      }
    }
    for (const mob of [...this.list]) {
      const far = mob.position.distanceTo(this.player.position) > DESPAWN_DISTANCE;
      // At sunrise they burn away, a few at a time
      if (!this.night && (mob.burnDelay -= dt) < 0) {
        this.sounds.poof?.();
        this.remove(mob);
      } else if (far || mob.position.y < -10) {
        this.remove(mob);
      } else {
        this.think(mob, dt);
        this.move(mob, dt);
        mob.animate(dt);
      }
    }
  }

  // Pick a random spot on the ground around the player, out of sight range
  trySpawn() {
    const angle = Math.random() * Math.PI * 2;
    const dist = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
    const x = Math.floor(this.player.position.x + Math.cos(angle) * dist);
    const z = Math.floor(this.player.position.z + Math.sin(angle) * dist);
    if (!this.world.getChunk(Math.floor(x / 16), Math.floor(z / 16))) return;
    // Highest solid block in the column, with two blocks of air above it
    for (let y = 62; y > 1; y--) {
      if (!this.world.isSolid(x, y, z)) continue;
      if (this.world.isWater(x, y + 1, z) || this.world.isSolid(x, y + 1, z) || this.world.isSolid(x, y + 2, z)) return;
      this.list.push(new Mob(this.scene, x + 0.5, y + 1, z + 0.5));
      return;
    }
  }

  // Chase the player when close (in survival), otherwise wander about
  think(mob, dt) {
    const toPlayer = this._dir.subVectors(this.player.position, mob.position);
    const distance = Math.hypot(toPlayer.x, toPlayer.z);
    const chasing = !this.game.creative && !this.game.dead && distance < CHASE_RANGE;
    let speed = WALK_SPEED;
    if (chasing) {
      mob.yaw = Math.atan2(-toPlayer.x, -toPlayer.z);
    } else {
      mob.wander -= dt;
      if (mob.wander <= 0) {
        mob.wander = 2 + Math.random() * 4;
        mob.yaw = Math.random() * Math.PI * 2;
        mob.idle = Math.random() < 0.4; // sometimes just stand there
      }
      speed = mob.idle ? 0 : WALK_SPEED * 0.5;
    }
    // Walk the way it faces (yaw 0 faces -z, like the camera)
    if (chasing && distance < 0.8) speed = 0; // close enough to hit
    mob.knock.multiplyScalar(Math.exp(-dt * 6));
    mob.velocity.x = -Math.sin(mob.yaw) * speed + mob.knock.x;
    mob.velocity.z = -Math.cos(mob.yaw) * speed + mob.knock.z;

    mob.cooldown -= dt;
    if (chasing && distance < 1.2 && Math.abs(toPlayer.y) < 1.5 && mob.cooldown <= 0) {
      mob.cooldown = ATTACK_COOLDOWN;
      this.game.damage(ATTACK_DAMAGE);
      // Knock the player back a little
      this.player.velocity.y = Math.max(this.player.velocity.y, 5);
      this.player.knock.set(toPlayer.x / (distance || 1), 0, toPlayer.z / (distance || 1)).multiplyScalar(7);
    }
    if (chasing && Math.random() < dt * 0.15) this.sounds.groan?.();
  }

  move(mob, dt) {
    mob.velocity.y = Math.max(mob.velocity.y - GRAVITY * dt, -40);
    const wasOnGround = mob.onGround;
    mob.onGround = false;
    const blockedX = mob.moveAxis('x', mob.velocity.x * dt, this.isSolid);
    const blockedZ = mob.moveAxis('z', mob.velocity.z * dt, this.isSolid);
    mob.moveAxis('y', mob.velocity.y * dt, this.isSolid);
    // Hop up one-block steps it walks into
    if ((blockedX || blockedZ) && wasOnGround) mob.velocity.y = JUMP_SPEED;
    // Water: float up slowly
    if (this.world.isWater(Math.floor(mob.position.x), Math.floor(mob.position.y + 0.5), Math.floor(mob.position.z))) {
      mob.velocity.y = Math.min(mob.velocity.y + 40 * dt, 2);
    }
  }

  // Player swings at whatever is under the crosshair. Returns true if a mob
  // was hit (so the click doesn't also start mining the block behind it).
  attack(camera, heldItem, blockDistance = Infinity) {
    camera.getWorldDirection(this._dir);
    let best = null, bestDist = Math.min(REACH, blockDistance);
    for (const mob of this.list) {
      const d = mob.rayHit(camera.position, this._dir);
      if (d < bestDist) {
        best = mob;
        bestDist = d;
      }
    }
    if (!best) return false;
    best.health -= attackDamage(heldItem);
    best.hurtTime = 0.25;
    this.sounds.hit?.();
    // Knock it back, away from the player
    best.velocity.y = 5;
    best.knock.set(this._dir.x, 0, this._dir.z).normalize().multiplyScalar(8);
    if (best.health <= 0) {
      this.remove(best);
      this.sounds.poof?.();
      // Sometimes leaves something useful behind
      if (!this.game.creative && Math.random() < 0.4) this.inventory.add(Math.random() < 0.7 ? ITEM.COAL : ITEM.IRON_INGOT);
    }
    return true;
  }

  remove(mob) {
    mob.dispose(this.scene);
    this.list.splice(this.list.indexOf(mob), 1);
  }
}
