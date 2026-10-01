import * as THREE from 'three';
import { Player } from './player.js';

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Scene with a sky color and distance fog
const SKY = new THREE.Color(0x87ceeb);
const scene = new THREE.Scene();
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 40, 120);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);

// Lighting: soft sky/ground fill plus a sun
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a5a, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(50, 100, 30);
scene.add(sun);

// Flat grid of cubes, drawn as one instanced mesh
const SIZE = 32;
const cubes = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshLambertMaterial({ color: 0x5fa83a }),
  SIZE * SIZE
);
const m = new THREE.Matrix4();
let i = 0;
for (let x = 0; x < SIZE; x++) {
  for (let z = 0; z < SIZE; z++) {
    m.setPosition(x - SIZE / 2 + 0.5, 0.5, z - SIZE / 2 + 0.5);
    cubes.setMatrixAt(i, m);
    // Checker tint so individual cubes are visible
    cubes.setColorAt(i++, new THREE.Color((x + z) % 2 ? 0x6bb544 : 0x5a9e36));
  }
}
scene.add(cubes);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// The flat grid occupies y = 0 for |x|,|z| < SIZE/2
const isSolid = (x, y, z) => y === 0 && Math.abs(x + 0.5) < SIZE / 2 && Math.abs(z + 0.5) < SIZE / 2;
const player = new Player(camera, renderer.domElement, isSolid);
player.respawn = () => { player.position.set(0.5, 5, 0.5); player.velocity.set(0, 0, 0); };
player.respawn();

// Show the start overlay whenever the pointer is not locked
const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => renderer.domElement.requestPointerLock());
player.onLockChange = (locked) => { overlay.style.display = locked ? 'none' : 'flex'; };

// Dev-only hook for automated checks
if (import.meta.env.DEV) {
  window.__game = { player, scene };
  window.__debug = () => ({ pos: player.position.toArray().map((v) => +v.toFixed(2)), onGround: player.onGround, calls: renderer.info.render.calls, tris: renderer.info.render.triangles });
}

// Game loop
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = (now - last) / 1000;
  last = now;
  player.update(dt);
  renderer.render(scene, camera);
});
