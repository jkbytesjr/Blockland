import { BLOCK, BLOCK_NAMES } from './blocks.js';

// Items are everything that can sit in an inventory slot. Placeable blocks use
// their block id as their item id; other items start at 100.
export const ITEM = {
  STICK: 100,
  COAL: 101,
  IRON_INGOT: 102,
  GOLD_INGOT: 103,
  DIAMOND: 104,
  WOOD_PICKAXE: 110,
  STONE_PICKAXE: 111,
  IRON_PICKAXE: 112,
  DIAMOND_PICKAXE: 113,
  WOOD_SWORD: 120,
  STONE_SWORD: 121,
  IRON_SWORD: 122,
  DIAMOND_SWORD: 123,
};

export const MAX_STACK = 64;

// Tool tiers: 1 wood, 2 stone, 3 iron, 4 diamond
const TIER_NAMES = ['', 'Wooden', 'Stone', 'Iron', 'Diamond'];
// Colors of the tool heads, by tier
export const TIER_COLORS = ['', [150, 112, 66], [130, 130, 130], [220, 220, 220], [92, 232, 230]];

// Non-block items: name, plus what they do when held
const INFO = {
  [ITEM.STICK]: { name: 'Stick' },
  [ITEM.COAL]: { name: 'Coal' },
  [ITEM.IRON_INGOT]: { name: 'Iron Ingot' },
  [ITEM.GOLD_INGOT]: { name: 'Gold Ingot' },
  [ITEM.DIAMOND]: { name: 'Diamond' },
};
for (let tier = 1; tier <= 4; tier++) {
  INFO[ITEM.WOOD_PICKAXE + tier - 1] = { name: `${TIER_NAMES[tier]} Pickaxe`, pickaxe: tier, stack: 1 };
  INFO[ITEM.WOOD_SWORD + tier - 1] = { name: `${TIER_NAMES[tier]} Sword`, sword: tier, stack: 1 };
}

export const isBlockItem = (id) => id > 0 && id < 100;

export function itemName(id) {
  return isBlockItem(id) ? BLOCK_NAMES[id] : INFO[id]?.name ?? '?';
}

export function maxStack(id) {
  return INFO[id]?.stack ?? MAX_STACK;
}

// Pickaxe tier of an item (0 if it isn't one)
export const pickaxeTier = (id) => INFO[id]?.pickaxe ?? 0;

// Damage dealt to mobs when hitting with an item (hand = 1)
export const attackDamage = (id) => (INFO[id]?.sword ? 3 + INFO[id].sword * 1.5 : pickaxeTier(id) ? 2 : 1);

// How blocks are mined: seconds by hand, the pickaxe tier needed to get a drop
// (0 = none needed), and what drops.
const MINING = {
  [BLOCK.GRASS]: { time: 0.6, drop: BLOCK.DIRT },
  [BLOCK.DIRT]: { time: 0.5 },
  [BLOCK.SAND]: { time: 0.5 },
  [BLOCK.GRAVEL]: { time: 0.6 },
  [BLOCK.LEAVES]: { time: 0.25, drop: 0, rareDrop: ITEM.STICK },
  [BLOCK.LOG]: { time: 2 },
  [BLOCK.PLANKS]: { time: 2 },
  [BLOCK.STONE]: { time: 6, tier: 1, drop: BLOCK.COBBLESTONE },
  [BLOCK.COBBLESTONE]: { time: 8, tier: 1 },
  [BLOCK.BRICKS]: { time: 8, tier: 1 },
  [BLOCK.COAL_ORE]: { time: 12, tier: 1, drop: ITEM.COAL },
  [BLOCK.IRON_ORE]: { time: 12, tier: 2 },
  [BLOCK.GOLD_ORE]: { time: 12, tier: 3 },
  [BLOCK.DIAMOND_ORE]: { time: 12, tier: 3, drop: ITEM.DIAMOND },
};
// How much faster each pickaxe tier mines blocks that need a pickaxe
const PICKAXE_SPEED = [1, 4, 8, 12, 16];

// Seconds to break a block with the held item
export function breakTime(blockId, heldId) {
  const info = MINING[blockId] ?? { time: 1 };
  const tier = pickaxeTier(heldId);
  if (info.tier) return info.time / PICKAXE_SPEED[tier];
  return info.time;
}

// Item dropped by breaking a block with the held item (0 = nothing)
export function blockDrop(blockId, heldId) {
  const info = MINING[blockId] ?? {};
  if (info.tier && pickaxeTier(heldId) < info.tier) return 0; // wrong tool
  if (info.rareDrop && Math.random() < 0.15) return info.rareDrop;
  return info.drop ?? blockId;
}

// Everything the creative inventory offers
export const CREATIVE_ITEMS = [
  BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.COBBLESTONE, BLOCK.PLANKS, BLOCK.LOG,
  BLOCK.BRICKS, BLOCK.SAND, BLOCK.GRAVEL, BLOCK.LEAVES, BLOCK.COAL_ORE, BLOCK.IRON_ORE,
  BLOCK.GOLD_ORE, BLOCK.DIAMOND_ORE, ...Object.keys(INFO).map(Number),
];
