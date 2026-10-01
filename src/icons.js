import { BLOCK_TEXTURES } from './blocks.js';
import { TILE_SIZE } from './textures.js';
import { ITEM, TIER_COLORS, isBlockItem } from './items.js';

export const ICON_SIZE = 40; // CSS pixels

// Draws a small isometric cube icon for a block from the texture atlas
function drawBlockIcon(ctx, S, atlas, id) {
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

// Pixel-art helpers on a 16x16 grid
const rgb = ([r, g, b], f = 1) => `rgb(${r * f | 0}, ${g * f | 0}, ${b * f | 0})`;
const WOOD = [150, 112, 66];

// A thick line of pixels from (x0, y0) to (x1, y1)
function line(px, x0, y0, x1, y1, color, width = 2) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    px(x, y, rgb(color, 0.8));
    if (width > 1) px(x + 1, y, rgb(color));
  }
}

const PAINTERS = {
  [ITEM.STICK]: (px) => line(px, 3, 12, 11, 4, WOOD),
  [ITEM.COAL]: (px) => {
    for (let y = 4; y < 13; y++) for (let x = 4; x < 13; x++) {
      if (Math.hypot(x - 8, y - 8.5) < 4.6) px(x, y, (x * 7 + y * 3) % 5 === 0 ? '#6a6a6a' : '#2b2b2b');
    }
  },
  [ITEM.DIAMOND]: (px) => {
    for (let y = 3; y < 14; y++) for (let x = 2; x < 15; x++) {
      if (Math.abs(x - 8) + Math.abs(y - 8) * 1.2 < 6.5) px(x, y, rgb([92, 232, 230], x < 8 ? 1.05 : 0.8));
    }
  },
};
// Ingots: a bar seen from the side
for (const [id, color] of [[ITEM.IRON_INGOT, [225, 225, 225]], [ITEM.GOLD_INGOT, [250, 215, 60]]]) {
  PAINTERS[id] = (px) => {
    for (let y = 6; y < 12; y++) for (let x = 2 + (11 - y); x < 14 - (y - 6) / 2; x++) px(x, y, rgb(color, y < 8 ? 1 : 0.8));
  };
}
// Tools: a wooden handle with a head in the tier's color
for (let tier = 1; tier <= 4; tier++) {
  const color = TIER_COLORS[tier];
  PAINTERS[ITEM.WOOD_PICKAXE + tier - 1] = (px) => {
    line(px, 3, 13, 10, 6, WOOD);
    // Curved head across the top right
    for (let t = 0; t <= 1; t += 0.05) {
      const x = Math.round((1 - t) ** 2 * 4 + 2 * (1 - t) * t * 13 + t * t * 13);
      const y = Math.round((1 - t) ** 2 * 3 + 2 * (1 - t) * t * 2 + t * t * 12);
      px(x, y, rgb(color));
      px(x, y + 1, rgb(color, 0.75));
    }
  };
  PAINTERS[ITEM.WOOD_SWORD + tier - 1] = (px) => {
    line(px, 6, 10, 13, 3, color);
    line(px, 3, 8, 7, 12, [70, 50, 30], 1); // cross guard
    line(px, 2, 13, 5, 10, WOOD);
  };
}

const cache = new Map();

// Icon for an item as a canvas; draw it with ctx.drawImage or copy it
export function getIcon(atlas, id) {
  if (cache.has(id)) return cache.get(id);
  const scale = window.devicePixelRatio || 1;
  const S = Math.round(ICON_SIZE * scale);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (isBlockItem(id)) {
    drawBlockIcon(ctx, S, atlas, id);
  } else {
    const p = S / 16;
    PAINTERS[id]?.((x, y, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x * p), Math.floor(y * p), Math.ceil(p), Math.ceil(p));
    });
  }
  cache.set(id, canvas);
  return canvas;
}

// A fresh canvas element showing an item, sized for a slot
export function iconElement(atlas, id) {
  const src = getIcon(atlas, id);
  const el = document.createElement('canvas');
  el.width = el.height = src.width;
  el.style.width = el.style.height = `${ICON_SIZE}px`;
  el.getContext('2d').drawImage(src, 0, 0);
  return el;
}
