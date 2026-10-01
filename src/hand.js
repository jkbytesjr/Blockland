import * as THREE from 'three';
import { BLOCK_TEXTURES } from './blocks.js';
import { tileUV } from './textures.js';
import { getIcon } from './icons.js';
import { isBlockItem } from './items.js';

// The player's arm and held item, drawn in the bottom right corner on top of
// the world (its own little scene and camera, so it never clips into walls).
// Animations: bobbing while walking, a swing when hitting, mining or placing,
// a dip when switching items, and a munching motion when eating.

const REST = new THREE.Vector3(0.48, -0.38, -0.85); // where the hand sits
const SKIN = 0xd9a47c;
const SWING_TIME = 0.28;
const EQUIP_TIME = 0.25;

// A cube with each face textured from the atlas, like the block in the world
function blockGeometry(id, size) {
  const geometry = new THREE.BoxGeometry(size, size, size);
  const tex = BLOCK_TEXTURES[id];
  // BoxGeometry faces in order: +x, -x, +y, -y, +z, -z (4 vertices each)
  const tiles = [tex.side, tex.side, tex.top, tex.bottom, tex.side, tex.side];
  const uv = geometry.attributes.uv;
  tiles.forEach((tile, face) => {
    const { u0, u1, v0, v1 } = tileUV(tile);
    for (let i = 0; i < 4; i++) {
      const k = face * 4 + i;
      uv.setXY(k, uv.getX(k) ? u1 : u0, uv.getY(k) ? v1 : v0);
    }
  });
  return geometry;
}

export class Hand {
  constructor(atlas) {
    this.atlas = atlas; // the atlas texture
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10);
    this.ambient = new THREE.HemisphereLight(0xffffff, 0x666666, 1);
    this.light = new THREE.DirectionalLight(0xffffff, 1);
    this.light.position.set(-1, 2, 1);
    this.scene.add(this.ambient, this.light);

    this.root = new THREE.Group(); // moved around by the animations
    this.scene.add(this.root);
    // The arm reaches up from below the screen
    this.arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.75), new THREE.MeshLambertMaterial({ color: SKIN }));
    this.arm.position.set(0.06, -0.2, 0.22);
    this.arm.rotation.set(0.75, 0.3, 0);
    this.root.add(this.arm);
    this.holder = new THREE.Group(); // the held item, at the hand's tip
    this.root.add(this.holder);

    this.materials = {
      block: new THREE.MeshLambertMaterial({ map: atlas }),
    };
    this.itemId = 0;
    this.shownId = -1;
    this.swing = 1; // 0..1 through a swing, 1 = done
    this.equip = 0; // 1 = lowered out of sight, 0 = in place
    this.bob = 0;
    this.eatTime = 0;

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  // Start a swing (restarts one in progress)
  doSwing() {
    this.swing = 0;
  }

  // Build the mesh for the held item
  show(id) {
    this.shownId = id;
    for (const child of [...this.holder.children]) {
      this.holder.remove(child);
      child.geometry.dispose();
      if (child.material !== this.materials.block) child.material.dispose();
    }
    this.arm.visible = true;
    if (!id) return;
    let mesh;
    if (isBlockItem(id)) {
      mesh = new THREE.Mesh(blockGeometry(id, 0.3), this.materials.block);
      mesh.position.set(-0.04, 0.0, -0.1);
      mesh.rotation.set(0.15, 0.7, 0);
      this.arm.visible = false; // the block hides the fist anyway
    } else {
      // Flat items and tools: the icon on a see-through plane, tilted like
      // it's held in the fist
      const texture = new THREE.CanvasTexture(getIcon(this.atlas.image, id));
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.55, 0.55),
        // Unlit, tinted by the world's brightness in update(), so it reads the
        // same from both sides
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide })
      );
      mesh.position.set(-0.02, 0.12, -0.1);
      mesh.rotation.set(0, -0.5, 0.15);
    }
    this.holder.add(mesh);
  }

  // state: { item, speed, onGround, eating, brightness }
  update(dt, state) {
    // Switching items: drop the hand out of view, swap, bring it back up
    if (state.item !== this.itemId) {
      this.itemId = state.item;
      this.equip = Math.max(this.equip, 0.01);
    }
    if (this.equip > 0) {
      if (this.shownId !== this.itemId && this.equip >= 1) this.show(this.itemId);
      const goingDown = this.shownId !== this.itemId;
      this.equip = Math.min(1, Math.max(0, this.equip + (goingDown ? 1 : -1) * (dt / EQUIP_TIME) * 2));
    }

    // Walking bob: a small figure-eight as the feet move
    if (state.onGround && state.speed > 0.1) this.bob += dt * state.speed * 1.6;
    const bobX = Math.sin(this.bob) * 0.025;
    const bobY = -Math.abs(Math.cos(this.bob)) * 0.025;

    // Swing: rotate down and in, then back
    this.swing = Math.min(1, this.swing + dt / SWING_TIME);
    const s = Math.sin(this.swing * Math.PI);

    // Eating: hold the food up toward the mouth and munch
    this.eatTime = state.eating ? this.eatTime + dt : 0;
    const eat = state.eating ? Math.min(1, this.eatTime * 6) : 0;
    const munch = state.eating ? Math.abs(Math.sin(this.eatTime * 14)) * 0.04 : 0;

    this.root.position.set(
      REST.x + bobX - s * 0.25 - eat * 0.35,
      REST.y + bobY - this.equip * 0.6 + s * 0.08 + eat * 0.22 - munch,
      REST.z - s * 0.15 + eat * 0.15
    );
    this.root.rotation.set(-s * 0.9 + eat * 0.3, s * 0.3 + eat * 0.6, s * 0.2);

    // Match the world's lighting so the hand isn't glowing at night
    this.ambient.intensity = state.brightness;
    this.light.intensity = state.brightness * 0.6;
    const flat = this.holder.children[0]?.material;
    if (flat?.isMeshBasicMaterial) flat.color.setScalar(Math.min(1, 0.15 + (state.brightness - 0.3) * 0.75));
  }

  render(renderer) {
    renderer.autoClear = false;
    renderer.clearDepth(); // draw over the world, never behind it
    renderer.render(this.scene, this.camera);
    renderer.autoClear = true;
  }
}
