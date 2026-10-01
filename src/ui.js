import { BLOCK, BLOCK_NAMES, BLOCK_TEXTURES } from './blocks.js';
import { TILE_SIZE } from './textures.js';

const HOTBAR_BLOCKS = [
  BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.COBBLESTONE, BLOCK.PLANKS,
  BLOCK.LOG, BLOCK.BRICKS, BLOCK.SAND, BLOCK.GRAVEL,
];
const ICON_SIZE = 40; // CSS pixels

// Draws a small isometric cube icon for a block from the texture atlas
function drawBlockIcon(canvas, atlas, id) {
  const scale = window.devicePixelRatio || 1;
  const S = ICON_SIZE * scale;
  canvas.width = canvas.height = S;
  canvas.style.width = canvas.style.height = `${ICON_SIZE}px`;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const w = S * 0.45; // half the cube's width
  const h = w / 2; // rise of the top face edges
  const cx = S / 2;
  const y0 = S * 0.05;
  const k = 1 / TILE_SIZE;
  const tex = BLOCK_TEXTURES[id];
  // Each face maps the 16x16 tile onto a parallelogram via setTransform
  const faces = [
    { tile: tex.top, m: [w * k, -h * k, w * k, h * k, cx - w, y0 + h], dark: 0 },
    { tile: tex.side, m: [w * k, h * k, 0, w * k, cx - w, y0 + h], dark: 0.25 },
    { tile: tex.side, m: [w * k, -h * k, 0, w * k, cx, y0 + 2 * h], dark: 0.4 },
  ];
  for (const { tile, m, dark } of faces) {
    ctx.setTransform(...m);
    ctx.drawImage(atlas, tile * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = `rgba(0, 0, 0, ${dark})`;
    ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// Crosshair plus a nine-slot hotbar picked with keys 1-9 or the scroll wheel
export class Hud {
  constructor(atlas, isActive) {
    this.selected = 0;

    const root = document.createElement('div');
    root.id = 'hud';
    root.innerHTML = `
      <div id="crosshair"></div>
      <div id="block-name"></div>
      <div id="hotbar"></div>`;
    document.body.appendChild(root);
    this.nameEl = root.querySelector('#block-name');

    const bar = root.querySelector('#hotbar');
    this.slots = HOTBAR_BLOCKS.map((id, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const icon = document.createElement('canvas');
      drawBlockIcon(icon, atlas, id);
      const num = document.createElement('span');
      num.textContent = i + 1;
      slot.append(icon, num);
      bar.appendChild(slot);
      return slot;
    });

    window.addEventListener('keydown', (e) => {
      const n = /^Digit([1-9])$/.exec(e.code);
      if (n) this.select(Number(n[1]) - 1);
    });
    window.addEventListener('wheel', (e) => {
      if (!isActive() || e.deltaY === 0) return;
      this.select(this.selected + Math.sign(e.deltaY));
    }, { passive: true });

    this.select(0);
  }

  select(index) {
    const n = this.slots.length;
    this.selected = ((index % n) + n) % n; // wrap around both ways
    this.slots.forEach((s, i) => s.classList.toggle('active', i === this.selected));
    // Briefly show the block name above the hotbar
    this.nameEl.textContent = BLOCK_NAMES[this.selectedBlock()];
    this.nameEl.classList.remove('fade');
    void this.nameEl.offsetWidth; // restart the fade animation
    this.nameEl.classList.add('fade');
  }

  selectedBlock() {
    return HOTBAR_BLOCKS[this.selected];
  }
}
