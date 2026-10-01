import { BLOCK } from './blocks.js';
import { ITEM } from './items.js';

// Recipe book: pick a recipe and, if you carry the ingredients, they turn into
// the result. No grid to arrange, just a list.
// Each recipe: [result id, result count, [[ingredient id, count], ...]]
const R = (id, count, ...needs) => ({ id, count, needs });

const toolRecipes = [
  [BLOCK.PLANKS, ITEM.WOOD_PICKAXE, ITEM.WOOD_SWORD],
  [BLOCK.COBBLESTONE, ITEM.STONE_PICKAXE, ITEM.STONE_SWORD],
  [ITEM.IRON_INGOT, ITEM.IRON_PICKAXE, ITEM.IRON_SWORD],
  [ITEM.DIAMOND, ITEM.DIAMOND_PICKAXE, ITEM.DIAMOND_SWORD],
].flatMap(([material, pickaxe, sword]) => [
  R(pickaxe, 1, [material, 3], [ITEM.STICK, 2]),
  R(sword, 1, [material, 2], [ITEM.STICK, 1]),
]);

export const RECIPES = [
  R(BLOCK.PLANKS, 4, [BLOCK.LOG, 1]),
  R(ITEM.STICK, 4, [BLOCK.PLANKS, 2]),
  ...toolRecipes,
  // Smelting, simplified: ore plus coal makes an ingot
  R(ITEM.IRON_INGOT, 1, [BLOCK.IRON_ORE, 1], [ITEM.COAL, 1]),
  R(ITEM.GOLD_INGOT, 1, [BLOCK.GOLD_ORE, 1], [ITEM.COAL, 1]),
  R(ITEM.COOKED_MEAT, 1, [ITEM.RAW_MEAT, 1], [ITEM.COAL, 1]),
  R(ITEM.GOLDEN_APPLE, 1, [ITEM.APPLE, 1], [ITEM.GOLD_INGOT, 4]),
  R(BLOCK.STONE, 1, [BLOCK.COBBLESTONE, 1], [ITEM.COAL, 1]),
  R(BLOCK.BRICKS, 2, [BLOCK.DIRT, 2], [ITEM.COAL, 1]),
  R(BLOCK.GRAVEL, 1, [BLOCK.COBBLESTONE, 1]),
];

export function canCraft(inventory, recipe) {
  return recipe.needs.every(([id, n]) => inventory.count(id) >= n) && inventory.hasRoom(recipe.id, recipe.count);
}

// Craft once. Returns true if it worked.
export function craft(inventory, recipe) {
  if (!canCraft(inventory, recipe)) return false;
  for (const [id, n] of recipe.needs) inventory.remove(id, n);
  inventory.add(recipe.id, recipe.count);
  return true;
}
