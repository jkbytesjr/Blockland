import { TILE } from './textures.js';

// Block ids
export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  COBBLESTONE: 5,
  PLANKS: 6,
  LOG: 7,
  BRICKS: 8,
  GRAVEL: 9,
  LEAVES: 10,
  WATER: 11,
};

// Display names for the hotbar
export const BLOCK_NAMES = {
  [BLOCK.GRASS]: 'Grass',
  [BLOCK.DIRT]: 'Dirt',
  [BLOCK.STONE]: 'Stone',
  [BLOCK.SAND]: 'Sand',
  [BLOCK.COBBLESTONE]: 'Cobblestone',
  [BLOCK.PLANKS]: 'Planks',
  [BLOCK.LOG]: 'Log',
  [BLOCK.BRICKS]: 'Bricks',
  [BLOCK.GRAVEL]: 'Gravel',
  [BLOCK.LEAVES]: 'Leaves',
  [BLOCK.WATER]: 'Water',
};

// Which atlas tile each block shows on its top, sides and bottom
export const BLOCK_TEXTURES = {
  [BLOCK.GRASS]: { top: TILE.GRASS_TOP, side: TILE.GRASS_SIDE, bottom: TILE.DIRT },
  [BLOCK.DIRT]: { top: TILE.DIRT, side: TILE.DIRT, bottom: TILE.DIRT },
  [BLOCK.STONE]: { top: TILE.STONE, side: TILE.STONE, bottom: TILE.STONE },
  [BLOCK.SAND]: { top: TILE.SAND, side: TILE.SAND, bottom: TILE.SAND },
  [BLOCK.COBBLESTONE]: { top: TILE.COBBLESTONE, side: TILE.COBBLESTONE, bottom: TILE.COBBLESTONE },
  [BLOCK.PLANKS]: { top: TILE.PLANKS, side: TILE.PLANKS, bottom: TILE.PLANKS },
  [BLOCK.LOG]: { top: TILE.LOG_TOP, side: TILE.LOG_SIDE, bottom: TILE.LOG_TOP },
  [BLOCK.BRICKS]: { top: TILE.BRICKS, side: TILE.BRICKS, bottom: TILE.BRICKS },
  [BLOCK.GRAVEL]: { top: TILE.GRAVEL, side: TILE.GRAVEL, bottom: TILE.GRAVEL },
  [BLOCK.LEAVES]: { top: TILE.LEAVES, side: TILE.LEAVES, bottom: TILE.LEAVES },
  [BLOCK.WATER]: { top: TILE.WATER, side: TILE.WATER, bottom: TILE.WATER },
};

// Blocks you can walk through and see through. Faces next to them are drawn.
export const isSolidBlock = (id) => id !== BLOCK.AIR && id !== BLOCK.WATER;
