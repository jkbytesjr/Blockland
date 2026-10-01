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
