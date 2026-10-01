import { BLOCK } from './blocks.js';
import { foodValue, foodHeal, ITEM } from './items.js';

export const MAX_HEALTH = 20; // ten hearts
const REGEN_DELAY = 5; // seconds after getting hurt before healing starts
const REGEN_EVERY = 3; // seconds per health point healed
const SAFE_FALL = 3; // blocks you can fall without getting hurt

// Hunger: 20 points (ten drumsticks). Activity adds "exhaustion"; every 4
// points of it costs one hunger point. Healing needs a fairly full stomach and
// costs food; an empty stomach hurts.
export const MAX_HUNGER = 20;
const EXHAUSTION_PER_POINT = 4;
const EXHAUST_IDLE = 0.04; // per second, just from being alive
const EXHAUST_SPRINT = 0.5; // extra per second while sprinting
const EXHAUST_JUMP = 0.15;
const HEAL_MIN_HUNGER = 14; // no healing below this
const HEAL_COST = 1.5; // exhaustion per health point healed
const SPRINT_MIN_HUNGER = 7; // too hungry to sprint below this
const STARVE_EVERY = 4; // seconds per damage point at zero hunger

// What a fresh creative hotbar holds
const CREATIVE_START = [
  BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.COBBLESTONE, BLOCK.PLANKS,
  BLOCK.LOG, BLOCK.BRICKS, BLOCK.SAND, BLOCK.GRAVEL,
].map((id) => ({ id, count: 1 }));

// Survival or creative, plus the player's health and hunger.
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
    this.hunger = MAX_HUNGER;
    this.exhaustion = 0;
    this.starveTimer = 0;
    this.stash = { survival: [], creative: CREATIVE_START }; // inventory of the other mode
    this.onDeath = () => {};
    this.onHurt = () => {};
    player.onLand = (blocks) => this.damage(Math.floor(blocks - SAFE_FALL));
    player.onJump = () => this.exhaust(EXHAUST_JUMP);
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
    this.hud.setHunger(this.creative ? null : this.hunger);
  }

  // Use up some energy (running, jumping, mining, fighting)
  exhaust(amount) {
    if (this.creative || this.dead) return;
    this.exhaustion += amount;
    while (this.exhaustion >= EXHAUSTION_PER_POINT) {
      this.exhaustion -= EXHAUSTION_PER_POINT;
      this.hunger = Math.max(0, this.hunger - 1);
      this.hud.setHunger(this.hunger);
    }
  }

  // Can the held item be eaten right now?
  canEat(id) {
    if (this.creative || this.dead || !foodValue(id)) return false;
    return this.hunger < MAX_HUNGER || id === ITEM.GOLDEN_APPLE;
  }

  eat(id) {
    this.hunger = Math.min(MAX_HUNGER, this.hunger + foodValue(id));
    this.health = Math.min(MAX_HEALTH, this.health + foodHeal(id));
    this.hud.setHunger(this.hunger);
    this.hud.setHealth(this.health);
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
    this.hunger = MAX_HUNGER;
    this.exhaustion = 0;
    this.apply();
    this.player.respawn();
  }

  // Hunger drains with activity; heal slowly when fed and not hurt lately
  update(dt) {
    this.sinceHurt += dt;
    this.player.canSprint = this.creative || this.hunger >= SPRINT_MIN_HUNGER;
    if (this.creative || this.dead) return;
    const moving = Math.hypot(this.player.velocity.x, this.player.velocity.z) > 0.1;
    this.exhaust(dt * (EXHAUST_IDLE + (this.player.sprinting && moving ? EXHAUST_SPRINT : 0)));

    if (this.hunger === 0) {
      this.starveTimer += dt;
      if (this.starveTimer >= STARVE_EVERY) {
        this.starveTimer = 0;
        if (this.health > 1) this.damage(1); // starving never quite kills
      }
      return;
    }
    if (this.health >= MAX_HEALTH || this.hunger < HEAL_MIN_HUNGER || this.sinceHurt < REGEN_DELAY) return;
    this.regenTimer += dt;
    if (this.regenTimer >= REGEN_EVERY) {
      this.regenTimer = 0;
      this.health++;
      this.exhaust(HEAL_COST);
      this.hud.setHealth(this.health);
    }
  }

  toJSON() {
    const other = this.creative ? 'survival' : 'creative';
    const slots = (list) => list.map((s) => (s ? [s.id, s.count] : 0));
    return { mode: this.mode, health: this.health, hunger: this.hunger, inventory: this.inventory.toJSON(), [`${other}Inventory`]: slots(this.stash[other]) };
  }

  load(data) {
    if (!data) return;
    const read = (list) => (list ?? []).map((s) => (Array.isArray(s) ? { id: s[0], count: s[1] } : null));
    this.mode = data.mode === 'creative' ? 'creative' : 'survival';
    const other = this.creative ? 'survival' : 'creative';
    if (data[`${other}Inventory`]) this.stash[other] = read(data[`${other}Inventory`]);
    this.inventory.load(read(data.inventory));
    this.health = Math.max(1, Math.min(MAX_HEALTH, data.health ?? MAX_HEALTH));
    this.hunger = Math.max(0, Math.min(MAX_HUNGER, data.hunger ?? MAX_HUNGER));
    this.apply();
  }
}
