import { maxStack } from './items.js';

export const SLOTS = 36; // the first 9 are the hotbar
export const HOTBAR = 9;

// Slots of { id, count } or null. Listeners are told whenever anything changes.
export class Inventory {
  constructor() {
    this.slots = new Array(SLOTS).fill(null);
    this.listeners = [];
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  changed() {
    for (const fn of this.listeners) fn();
  }

  // Replace the contents, e.g. from a save or when switching game mode
  load(slots) {
    this.slots = Array.from({ length: SLOTS }, (_, i) => (slots?.[i] ? { ...slots[i] } : null));
    this.changed();
  }

  // Add items, filling existing stacks first (hotbar before backpack), then
  // empty slots. Returns how many didn't fit.
  add(id, count = 1) {
    const limit = maxStack(id);
    for (const slot of this.slots) {
      if (!count) break;
      if (slot?.id !== id || slot.count >= limit) continue;
      const n = Math.min(count, limit - slot.count);
      slot.count += n;
      count -= n;
    }
    for (let i = 0; i < SLOTS && count; i++) {
      if (this.slots[i]) continue;
      const n = Math.min(count, limit);
      this.slots[i] = { id, count: n };
      count -= n;
    }
    this.changed();
    return count;
  }

  count(id) {
    return this.slots.reduce((sum, s) => sum + (s?.id === id ? s.count : 0), 0);
  }

  // Remove `count` of an item from wherever it is. Returns false (and changes
  // nothing) if there aren't enough.
  remove(id, count = 1) {
    if (this.count(id) < count) return false;
    for (let i = SLOTS - 1; i >= 0 && count; i--) {
      const slot = this.slots[i];
      if (slot?.id !== id) continue;
      const n = Math.min(count, slot.count);
      slot.count -= n;
      count -= n;
      if (!slot.count) this.slots[i] = null;
    }
    this.changed();
    return true;
  }

  // Use up one item from a specific slot
  takeOne(index) {
    const slot = this.slots[index];
    if (!slot) return;
    if (--slot.count <= 0) this.slots[index] = null;
    this.changed();
  }

  // Swap two slots, or merge them if they hold the same item
  swap(a, b) {
    const A = this.slots[a], B = this.slots[b];
    if (A && B && A.id === B.id && a !== b) {
      const n = Math.min(A.count, maxStack(B.id) - B.count);
      B.count += n;
      A.count -= n;
      if (!A.count) this.slots[a] = null;
    } else {
      this.slots[a] = B;
      this.slots[b] = A;
    }
    this.changed();
  }

  // Can `count` more of an item fit?
  hasRoom(id, count = 1) {
    const limit = maxStack(id);
    let room = 0;
    for (const s of this.slots) room += !s ? limit : s.id === id ? limit - s.count : 0;
    return room >= count;
  }

  toJSON() {
    return this.slots.map((s) => (s ? [s.id, s.count] : 0));
  }

  static fromJSON(data) {
    return (data ?? []).map((s) => (Array.isArray(s) ? { id: s[0], count: s[1] } : null));
  }
}
