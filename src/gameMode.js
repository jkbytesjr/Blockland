import { BLOCK } from './blocks.js';

export const MAX_HEALTH = 20; // ten hearts
const REGEN_DELAY = 5; // seconds after getting hurt before healing starts
const REGEN_EVERY = 3; // seconds per health point healed
const SAFE_FALL = 3; // blocks you can fall without getting hurt

// What a fresh creative hotbar holds
const CREATIVE_START = [
  BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.COBBLESTONE, BLOCK.PLANKS,
  BLOCK.LOG, BLOCK.BRICKS, BLOCK.SAND, BLOCK.GRAVEL,
].map((id) => ({ id, count: 1 }));

// Survival or creative, plus the player's health.
// Survival: mine blocks to collect them, craft, take damage, die.
// Creative: every item, instant breaking, flying, no damage.
// Each mode keeps its own inventory, swapped in when switching.
export class GameMode {
  constructor(player, inventory, hud) {
    this.player = player;
    this.inventory = inventory;
    this.hud = hud;
    this.mode = 'survival';
    this.health = MAX_HEALTH;
    this.dead = false;
    this.sinceHurt = Infinity;
    this.regenTimer = 0;
    this.stash = { survival: [], creative: CREATIVE_START }; // inventory of the other mode
    this.onDeath = () => {};
    this.onHurt = () => {};
    player.onLand = (blocks) => this.damage(Math.floor(blocks - SAFE_FALL));
    this.apply();
  }

  get creative() {
    return this.mode === 'creative';
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.stash[this.mode] = this.inventory.slots;
    this.mode = mode;
    this.inventory.load(this.stash[mode]);
    this.apply();
  }

  // Make the player and HUD match the current mode
  apply() {
    this.player.canFly = this.creative;
    if (!this.creative) this.player.setFlying(false);
    this.hud.setHealth(this.creative ? null : this.health);
  }

  damage(amount) {
    if (amount <= 0 || this.creative || this.dead) return;
    this.health = Math.max(0, this.health - amount);
    this.sinceHurt = 0;
    this.hud.setHealth(this.health);
    this.hud.flashHurt();
    this.onHurt();
    if (this.health === 0) {
      this.dead = true;
      this.onDeath();
    }
  }

  // Back to full health at the spawn point. Inventory is kept.
  respawn() {
    this.dead = false;
    this.health = MAX_HEALTH;
    this.hud.setHealth(this.health);
    this.player.respawn();
  }

  // Slowly heal when not hurt for a while
  update(dt) {
    this.sinceHurt += dt;
    if (this.creative || this.dead || this.health >= MAX_HEALTH || this.sinceHurt < REGEN_DELAY) return;
    this.regenTimer += dt;
    if (this.regenTimer >= REGEN_EVERY) {
      this.regenTimer = 0;
      this.health++;
      this.hud.setHealth(this.health);
    }
  }

  toJSON() {
    const other = this.creative ? 'survival' : 'creative';
    const slots = (list) => list.map((s) => (s ? [s.id, s.count] : 0));
    return { mode: this.mode, health: this.health, inventory: this.inventory.toJSON(), [`${other}Inventory`]: slots(this.stash[other]) };
  }

  load(data) {
    if (!data) return;
    const read = (list) => (list ?? []).map((s) => (Array.isArray(s) ? { id: s[0], count: s[1] } : null));
    this.mode = data.mode === 'creative' ? 'creative' : 'survival';
    const other = this.creative ? 'survival' : 'creative';
    if (data[`${other}Inventory`]) this.stash[other] = read(data[`${other}Inventory`]);
    this.inventory.load(read(data.inventory));
    this.health = Math.max(1, Math.min(MAX_HEALTH, data.health ?? MAX_HEALTH));
    this.apply();
  }
}
