import * as THREE from 'three';

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

// Game loop: slowly orbit the camera for now
renderer.setAnimationLoop((t) => {
  const a = t * 0.0001;
  camera.position.set(Math.cos(a) * 30, 15, Math.sin(a) * 30);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
});
