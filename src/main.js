import * as THREE from 'three';
import { Player } from './player.js';
import { World, CHUNK_SIZE } from './world.js';
import { buildChunkGeometry } from './mesher.js';
import { createAtlasTexture } from './textures.js';

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

// World: a fixed square of chunks around the origin (infinite comes later)
const WORLD_RADIUS = 4; // chunks in each direction from the center
const world = new World();
const material = new THREE.MeshLambertMaterial({ map: createAtlasTexture(), vertexColors: true });
for (let cx = -WORLD_RADIUS; cx < WORLD_RADIUS; cx++) {
  for (let cz = -WORLD_RADIUS; cz < WORLD_RADIUS; cz++) world.generateChunk(cx, cz);
}
// Mesh after all chunks exist so faces on chunk borders are culled correctly
for (const chunk of world.chunks.values()) {
  const mesh = new THREE.Mesh(buildChunkGeometry(world, chunk), material);
  mesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
  scene.add(mesh);
}

// Player, spawned on top of the terrain in the middle of the chunk
const player = new Player(camera, renderer.domElement, (x, y, z) => world.isSolid(x, y, z));
player.respawn = () => {
  const x = 8, z = 8;
  player.position.set(x + 0.5, world.heightAt(x, z) + 2, z + 0.5);
  player.velocity.set(0, 0, 0);
};
player.respawn();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Show the start overlay whenever the pointer is not locked
const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => renderer.domElement.requestPointerLock());
player.onLockChange = (locked) => { overlay.style.display = locked ? 'none' : 'flex'; };

// Dev-only hook for automated checks
if (import.meta.env.DEV) {
  window.__game = { player, scene, world };
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
