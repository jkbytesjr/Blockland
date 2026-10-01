import * as THREE from 'three';
import { Player } from './player.js';
import { World } from './world.js';
import { ChunkMeshes } from './chunkMeshes.js';
import { ChunkLoader } from './chunkLoader.js';
import { createAtlasTexture } from './textures.js';
import { BlockSelector, BlockEditor } from './interaction.js';
import { Hud } from './ui.js';
import { SaveManager } from './save.js';
import { DayNight } from './sky.js';
import { Sounds } from './sound.js';

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Scene with a sky color and distance fog
// (colors are set every frame by the day/night cycle)
const scene = new THREE.Scene();
// Chunks within this many chunks of the player are drawn; fog hides the edge
const RENDER_RADIUS = 6;
scene.fog = new THREE.Fog(0x87ceeb, RENDER_RADIUS * 16 * 0.5, RENDER_RADIUS * 16 - 8);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);

// Lighting: soft sky/ground fill plus a sun and a moon, all driven by the
// day/night cycle
const hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a5a, 0.9);
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
const moon = new THREE.DirectionalLight(0x9fb4ff, 0);
scene.add(hemi, sun, moon);
const sky = new DayNight(scene, { hemi, sun, moon });

// World: an endless terrain streamed in chunk by chunk around the player
const world = new World();
const atlas = createAtlasTexture();
const material = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true });
// Water is see-through and visible from below; it doesn't hide what's behind it
const waterMaterial = new THREE.MeshLambertMaterial({
  map: atlas, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide,
});
const chunkMeshes = new ChunkMeshes(scene, world, material, waterMaterial);
const loader = new ChunkLoader(world, chunkMeshes, RENDER_RADIUS);

// Player, spawned on top of the terrain in the middle of the chunk
const player = new Player(camera, renderer.domElement, (x, y, z) => world.isSolid(x, y, z));
player.isWater = (x, y, z) => world.isWater(x, y, z);
player.respawn = () => {
  const x = 8, z = 8;
  player.position.set(x + 0.5, world.surfaceAt(x, z) + 1, z + 0.5);
  player.velocity.set(0, 0, 0);
};
player.respawn();

// Restore saved edits and position (before any chunk is generated)
const saves = new SaveManager(world, player, sky);
saves.load();
loader.loadAll(player.position.x, player.position.z);

// Block targeting with a wireframe highlight
const selector = new BlockSelector(scene, camera, world);

// Left click breaks, right click places; touched chunks are marked dirty and
// rebuilt once at the end of the frame
const editor = new BlockEditor(world, selector, player, (keys) => {
  chunkMeshes.markDirty(keys);
  saves.scheduleSave();
});

// Sound effects for breaking, placing, footsteps and splashes
const sounds = new Sounds();
editor.onSound = (kind, id) => sounds.block(kind, id);

// Crosshair and hotbar; the selected slot is what right click places
const hud = new Hud(atlas.image, () => player.locked);
editor.selectedBlock = () => hud.selectedBlock();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Show the start overlay whenever the pointer is not locked
const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => {
  sounds.unlock(); // audio may only start from a click
  renderer.domElement.requestPointerLock();
});
document.getElementById('reset').addEventListener('click', (e) => {
  e.stopPropagation(); // don't start playing
  if (!confirm('Start a new world? Your saved changes will be lost.')) return;
  saves.clear();
  location.reload();
});
player.onLockChange = (locked) => { overlay.style.display = locked ? 'none' : 'flex'; };

// T skips ahead an eighth of a day, to see sunsets and nights sooner; M mutes
window.addEventListener('keydown', (e) => {
  if (!player.locked) return;
  if (e.code === 'KeyT') sky.time = (sky.time + 0.125) % 1;
  if (e.code === 'KeyM') sounds.toggleMute();
});

// Dev-only hook for automated checks
if (import.meta.env.DEV) {
  window.__game = { player, scene, world, selector, editor, chunkMeshes, loader, hud, saves, sky, sounds };
  window.__debug = () => ({ pos: player.position.toArray().map((v) => +v.toFixed(2)), onGround: player.onGround, target: selector.target?.block ?? null, chunks: world.chunks.size, meshes: chunkMeshes.meshes.size, builds: chunkMeshes.builds, calls: renderer.info.render.calls, tris: renderer.info.render.triangles });
}

// Game loop
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = (now - last) / 1000;
  last = now;
  loader.update(player.position.x, player.position.z);
  player.update(dt);
  const feet = player.position;
  sounds.update(Math.min(dt, 0.05), player, () => world.getBlock(Math.floor(feet.x), Math.floor(feet.y - 0.1), Math.floor(feet.z)));
  const cam = camera.position;
  sky.update(Math.min(dt, 0.1), camera, world.isWater(Math.floor(cam.x), Math.floor(cam.y), Math.floor(cam.z)));
  selector.update();
  chunkMeshes.flush();
  renderer.render(scene, camera);
});
