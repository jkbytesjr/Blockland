// Saves player edits and position to localStorage and restores them.
// Only edits are stored (terrain is regenerated from the seed), so a save
// stays small: { v, seed, player: [x, y, z, yaw, pitch], time, game, edits: { "cx,cz": [index, id, ...] } }
const STORAGE_KEY = 'blockland-save';
const VERSION = 1;

export class SaveManager {
  constructor(world, player, sky, game) {
    this.game = game; // mode, health and inventories
    this.world = world;
    this.player = player;
    this.sky = sky; // its time of day is saved too
    this.timer = null;
    // Save when the tab is hidden or closed, which also covers reloads
    document.addEventListener('visibilitychange', () => document.hidden && this.save());
    window.addEventListener('pagehide', () => this.save());
    // Also save every so often so a crash loses little
    setInterval(() => this.save(), 15000);
  }

  // Restore edits and the player's spot. Returns true if a save was found.
  load() {
    let data;
    try {
      data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (err) {
      console.warn('Ignoring unreadable save:', err);
      return false;
    }
    if (!data || data.v !== VERSION || data.seed !== this.world.seed) return false;
    for (const [key, flat] of Object.entries(data.edits ?? {})) {
      const chunkEdits = new Map();
      for (let i = 0; i < flat.length; i += 2) chunkEdits.set(flat[i], flat[i + 1]);
      this.world.edits.set(key, chunkEdits);
    }
    if (Array.isArray(data.player)) {
      const [x, y, z, yaw, pitch] = data.player;
      this.player.position.set(x, y, z);
      this.player.yaw = yaw;
      this.player.pitch = pitch;
    }
    if (typeof data.time === 'number') this.sky.time = data.time;
    this.game.load(data.game);
    return true;
  }

  // Save soon, batching a burst of edits into one write
  scheduleSave() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.save(), 1000);
  }

  save() {
    clearTimeout(this.timer);
    const edits = {};
    for (const [key, chunkEdits] of this.world.edits) edits[key] = [...chunkEdits].flat();
    const { x, y, z } = this.player.position;
    const round = (v) => Math.round(v * 100) / 100;
    const data = { v: VERSION, seed: this.world.seed, player: [x, y, z, this.player.yaw, this.player.pitch].map(round), time: round(this.sky.time), game: this.game.toJSON(), edits };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('Could not save the world:', err); // e.g. storage full or disabled
    }
  }

  // Forget the save; the caller reloads the page for a fresh world
  clear() {
    clearTimeout(this.timer);
    this.save = () => {}; // don't let pagehide write it back
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage disabled: nothing was saved anyway
    }
  }
}
