import * as THREE from 'three';
import { mulberry32 } from './noise.js';

// Length of one full day in seconds (day and night together)
export const DAY_LENGTH = 600;

// Sky colors at a few key moments; the cycle blends between them
const NIGHT_SKY = new THREE.Color(0x0a1028);
const DAY_SKY = new THREE.Color(0x87ceeb);
const DUSK_SKY = new THREE.Color(0xff7a3c);
const NIGHT_GROUND = new THREE.Color(0x2a2f45);
const DAY_GROUND = new THREE.Color(0x8a7a5a);
const SUN_WARM = new THREE.Color(0xffb27a);
const WHITE = new THREE.Color(0xffffff);
const MOONLIGHT = new THREE.Color(0x9fb4ff);
const UNDERWATER = new THREE.Color(0x1d4f9a);

const SKY_DISTANCE = 300; // how far away the sun, moon and stars are drawn

const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// A flat square that always faces the camera, drawn behind everything else
function skyQuad(size, color) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ color, fog: false, depthWrite: false, transparent: true })
  );
  mesh.renderOrder = -1;
  return mesh;
}

function createStars(count) {
  const rand = mulberry32(7);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Uniform direction on the upper part of a sphere
    const y = rand() * 1.1 - 0.1;
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    positions.set([Math.cos(a) * r * SKY_DISTANCE, y * SKY_DISTANCE, Math.sin(a) * r * SKY_DISTANCE], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false,
  }));
  stars.renderOrder = -2;
  return stars;
}

// Day/night cycle: moves the sun and moon across the sky and fades the sky
// color, fog and lights between day, sunset and night.
// time: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
export class DayNight {
  constructor(scene, { hemi, sun, moon }) {
    this.scene = scene;
    this.hemi = hemi;
    this.sun = sun;
    this.moon = moon;
    this.time = 0.3; // start in the morning
    this.skyColor = new THREE.Color();
    this.fogRange = [scene.fog.near, scene.fog.far]; // normal fog, restored after a swim

    this.sunQuad = skyQuad(40, 0xfff2b0);
    this.moonQuad = skyQuad(26, 0xe8ecf5);
    this.stars = createStars(700);
    scene.add(this.sunQuad, this.moonQuad, this.stars);

    this._dir = new THREE.Vector3();
  }

  // Sun elevation: 1 at noon, 0 at sunrise and sunset, -1 at midnight
  get sunHeight() {
    return Math.sin((this.time - 0.25) * Math.PI * 2);
  }

  update(dt, camera, underwater = false) {
    this.time = (this.time + dt / DAY_LENGTH) % 1;
    const angle = (this.time - 0.25) * Math.PI * 2;
    // Sun travels east to west, tilted a little so it isn't straight overhead
    this._dir.set(Math.cos(angle), Math.sin(angle), 0.35).normalize();
    const h = this._dir.y;

    const day = smoothstep(-0.12, 0.25, h); // 0 at night, 1 in full day
    const twilight = Math.exp(-((h / 0.16) ** 2)); // peaks at sunrise and sunset

    // Sky and fog share one color so distant terrain fades into the sky
    this.skyColor.copy(NIGHT_SKY).lerp(DAY_SKY, day).lerp(DUSK_SKY, twilight * 0.7);
    this.scene.background = this.skyColor;
    const fog = this.scene.fog;
    if (underwater) {
      // Murky blue that closes in fast, darker at night
      fog.color.copy(UNDERWATER).multiplyScalar(0.25 + 0.75 * day);
      fog.near = 0;
      fog.far = 14;
    } else {
      fog.color.copy(this.skyColor);
      [fog.near, fog.far] = this.fogRange;
    }

    // Lights: bright white noon sun, warm low sun, dim blue moonlight at night
    this.sun.position.copy(this._dir).multiplyScalar(100);
    this.sun.intensity = 1.6 * smoothstep(-0.04, 0.2, h);
    this.sun.color.copy(WHITE).lerp(SUN_WARM, twilight);
    this.moon.position.copy(this._dir).multiplyScalar(-100);
    this.moon.intensity = 0.35 * smoothstep(0, 0.2, -h);
    this.moon.color.copy(MOONLIGHT);
    this.hemi.intensity = 0.3 + 0.6 * day;
    this.hemi.color.copy(MOONLIGHT).lerp(WHITE, day);
    this.hemi.groundColor.copy(NIGHT_GROUND).lerp(DAY_GROUND, day);

    // Sun, moon and stars follow the camera so they look infinitely far away
    const c = camera.position;
    this.sunQuad.position.copy(this._dir).multiplyScalar(SKY_DISTANCE).add(c);
    this.sunQuad.lookAt(c);
    this.moonQuad.position.copy(this._dir).multiplyScalar(-SKY_DISTANCE).add(c);
    this.moonQuad.lookAt(c);
    this.stars.position.copy(c);
    this.stars.rotation.z = angle; // the night sky turns with the moon
    this.stars.material.opacity = 1 - smoothstep(-0.25, 0.05, h);
    this.stars.visible = this.stars.material.opacity > 0.01;
  }
}
