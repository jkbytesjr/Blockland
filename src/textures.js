import * as THREE from 'three';
import { mulberry32 } from './noise.js';

// Procedural texture atlas: one row of 16x16 pixel tiles drawn on a canvas
export const TILE_SIZE = 16;
export const ATLAS_COLUMNS = 16; // room for more block types later

export const TILE = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  COBBLESTONE: 5,
  PLANKS: 6,
  LOG_SIDE: 7,
  LOG_TOP: 8,
  BRICKS: 9,
  GRAVEL: 10,
  LEAVES: 11,
  WATER: 12,
};

// Fill a tile pixel by pixel; `color(x, y, rand)` returns [r, g, b] in 0-255
function paintTile(ctx, tile, seed, color) {
  const rand = mulberry32(seed);
  const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const [r, g, b] = color(x, y, rand);
      const i = (y * TILE_SIZE + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, tile * TILE_SIZE, 0);
}

// Scale a base color by a brightness factor
const shade = (base, f) => base.map((c) => Math.max(0, Math.min(255, Math.round(c * f))));

const GRASS = [96, 166, 62];
const DIRT = [134, 94, 60];
const STONE = [128, 128, 128];
const SAND = [219, 205, 146];
const WOOD = [168, 128, 78];
const BARK = [102, 76, 46];
const BRICK = [158, 74, 56];
const MORTAR = [190, 182, 170];

// Cobblestone: rounded stones from a wrapping Voronoi pattern, dark mortar between
function cobblePainter() {
  const rand = mulberry32(21);
  // One stone center jittered inside each cell of a 3x3 grid keeps stones evenly sized
  const cell = TILE_SIZE / 3;
  const seeds = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      seeds.push({ x: (i + 0.2 + rand() * 0.6) * cell, y: (j + 0.2 + rand() * 0.6) * cell, f: 0.85 + rand() * 0.3 });
    }
  }
  const wrap = (d) => Math.min(Math.abs(d), TILE_SIZE - Math.abs(d)); // so the tile repeats seamlessly
  return (x, y, r) => {
    let d1 = Infinity, d2 = Infinity, f = 1;
    for (const s of seeds) {
      const d = Math.hypot(wrap(x + 0.5 - s.x), wrap(y + 0.5 - s.y));
      if (d < d1) { d2 = d1; d1 = d; f = s.f; } else if (d < d2) d2 = d;
    }
    if (d2 - d1 < 0.8) return shade(STONE, 0.55);
    return shade(STONE, f * (0.92 + r() * 0.16) - d1 * 0.02);
  };
}

// Planks: four horizontal boards with staggered end seams and faint grain
const plankPixel = (x, y, r) => {
  const board = y >> 2;
  if (y % 4 === 3 || x === (board * 5 + 3) % TILE_SIZE) return shade(WOOD, 0.62);
  return shade(WOOD, 0.9 + ((x * 7 + board * 3) % 5) * 0.03 + r() * 0.06);
};

// Log side: vertical bark ridges
const barkStripes = Array.from({ length: TILE_SIZE }, (_, i) => 0.75 + ((i * 5) % 7) * 0.06);
const logSidePixel = (x, y, r) => shade(BARK, barkStripes[x] * (0.9 + r() * 0.2));

// Log top: growth rings inside a ring of bark
const logTopPixel = (x, y, r) => {
  const d = Math.hypot(x - 7.5, y - 7.5);
  if (d > 6.8) return logSidePixel(x, y, r);
  return shade(WOOD, (Math.floor(d * 0.9) % 2 ? 0.82 : 1.0) * (0.95 + r() * 0.08));
};

// Bricks: rows of four pixels, every other row offset by half a brick
const brickPixel = (x, y, r) => {
  const row = y >> 2;
  if (y % 4 === 3 || (x + (row % 2) * 4) % 8 === 7) return shade(MORTAR, 0.9 + r() * 0.1);
  return shade(BRICK, 0.88 + r() * 0.18);
};

// Gravel: a mix of gray and brownish pebbles
const gravelPixel = (x, y, r) => {
  const v = r();
  if (v < 0.25) return shade([120, 110, 100], 0.7 + r() * 0.2);
  if (v < 0.4) return shade([150, 140, 130], 1.0 + r() * 0.1);
  return shade(STONE, 0.78 + r() * 0.3);
};

// Leaves: clumps of green with dark gaps that read as depth
const LEAF = [58, 128, 44];
const leavesPixel = (x, y, r) => {
  const v = r();
  if (v < 0.12) return shade(LEAF, 0.35);
  if (v < 0.3) return shade(LEAF, 0.7);
  return shade(LEAF, 0.85 + r() * 0.35);
};

// Water: blue with soft horizontal ripples (drawn see-through in the world)
const WATER = [48, 98, 200];
const waterPixel = (x, y, r) => shade(WATER, 0.9 + Math.sin((y + (x >> 2)) * 1.2) * 0.06 + r() * 0.06);

const grassPixel = (rand) => shade(GRASS, 0.82 + rand() * 0.3);
const dirtPixel = (rand) => {
  const r = rand();
  if (r < 0.08) return shade(DIRT, 0.65); // dark pebbles
  if (r < 0.14) return shade(DIRT, 1.2); // light grains
  return shade(DIRT, 0.88 + rand() * 0.2);
};

export function createAtlasTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE * ATLAS_COLUMNS;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d');

  paintTile(ctx, TILE.GRASS_TOP, 11, (x, y, rand) => grassPixel(rand));

  // Grass side: dirt with a ragged strip of grass along the top edge
  const fringe = Array.from({ length: TILE_SIZE }, (_, i) => 3 + ((i * 7 + 3) % 5 === 0 ? 2 : (i * 3) % 4 === 0 ? 1 : 0));
  paintTile(ctx, TILE.GRASS_SIDE, 12, (x, y, rand) => (y < fringe[x] ? grassPixel(rand) : dirtPixel(rand)));

  paintTile(ctx, TILE.DIRT, 13, (x, y, rand) => dirtPixel(rand));

  // Stone: gray noise with darker cracks along a few random lines
  const cracks = new Set();
  const crackRand = mulberry32(99);
  for (let c = 0; c < 4; c++) {
    let cx = Math.floor(crackRand() * TILE_SIZE);
    let cy = Math.floor(crackRand() * TILE_SIZE);
    for (let s = 0; s < 6; s++) {
      cracks.add(`${cx & 15},${cy & 15}`);
      cx += crackRand() < 0.5 ? 1 : 0;
      cy += crackRand() < 0.5 ? 1 : -1;
    }
  }
  paintTile(ctx, TILE.STONE, 14, (x, y, rand) =>
    cracks.has(`${x},${y}`) ? shade(STONE, 0.62) : shade(STONE, 0.85 + rand() * 0.25)
  );

  paintTile(ctx, TILE.SAND, 15, (x, y, rand) =>
    rand() < 0.07 ? shade(SAND, 0.82) : shade(SAND, 0.95 + rand() * 0.08)
  );

  paintTile(ctx, TILE.COBBLESTONE, 16, cobblePainter());
  paintTile(ctx, TILE.PLANKS, 17, plankPixel);
  paintTile(ctx, TILE.LOG_SIDE, 18, logSidePixel);
  paintTile(ctx, TILE.LOG_TOP, 19, logTopPixel);
  paintTile(ctx, TILE.BRICKS, 20, brickPixel);
  paintTile(ctx, TILE.GRAVEL, 22, gravelPixel);
  paintTile(ctx, TILE.LEAVES, 23, leavesPixel);
  paintTile(ctx, TILE.WATER, 24, waterPixel);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter; // no mipmaps: keeps tiles from bleeding
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// UV rectangle of a tile, inset by a hair to avoid sampling the neighbor tile
export function tileUV(tile) {
  const w = 1 / ATLAS_COLUMNS;
  const eps = 0.001 / ATLAS_COLUMNS;
  return { u0: tile * w + eps, u1: (tile + 1) * w - eps, v0: 0 + 0.001, v1: 1 - 0.001 };
}
