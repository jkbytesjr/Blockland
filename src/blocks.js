import { TILE } from './textures.js';

// Block ids
export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
};

// Which atlas tile each block shows on its top, sides and bottom
export const BLOCK_TEXTURES = {
  [BLOCK.GRASS]: { top: TILE.GRASS_TOP, side: TILE.GRASS_SIDE, bottom: TILE.DIRT },
  [BLOCK.DIRT]: { top: TILE.DIRT, side: TILE.DIRT, bottom: TILE.DIRT },
  [BLOCK.STONE]: { top: TILE.STONE, side: TILE.STONE, bottom: TILE.STONE },
  [BLOCK.SAND]: { top: TILE.SAND, side: TILE.SAND, bottom: TILE.SAND },
};
