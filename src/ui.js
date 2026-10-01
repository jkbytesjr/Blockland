import { HOTBAR } from './inventory.js';
import { iconElement } from './icons.js';
import { itemName } from './items.js';

// Draw a slot's contents: the item icon plus a count when more than one
export function fillSlot(el, atlas, slot) {
  el.querySelector('canvas')?.remove();
  el.querySelector('.count')?.remove();
  if (!slot) return;
  el.prepend(iconElement(atlas, slot.id));
  if (slot.count > 1) {
    const count = document.createElement('span');
    count.className = 'count';
    count.textContent = slot.count;
    el.append(count);
  }
}

// Crosshair, nine-slot hotbar (keys 1-9 or scroll wheel), hearts, and a
// mining progress bar. The hotbar shows the first nine inventory slots.
export class Hud {
  constructor(atlas, inventory, isActive) {
    this.atlas = atlas;
    this.inventory = inventory;
    this.selected = 0;

    const root = document.createElement('div');
    root.id = 'hud';
    root.innerHTML = `
      <div id="crosshair"></div>
      <div id="mining"><div></div></div>
      <div id="block-name"></div>
      <div id="hearts"></div>
      <div id="hotbar"></div>
      <div id="hurt"></div>`;
    document.body.appendChild(root);
    this.nameEl = root.querySelector('#block-name');
    this.heartsEl = root.querySelector('#hearts');
    this.miningEl = root.querySelector('#mining');
    this.hurtEl = root.querySelector('#hurt');

    const bar = root.querySelector('#hotbar');
    this.slots = Array.from({ length: HOTBAR }, (_, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = i + 1;
      slot.append(num);
      bar.appendChild(slot);
      return slot;
    });

    window.addEventListener('keydown', (e) => {
      const n = /^Digit([1-9])$/.exec(e.code);
      if (n && isActive()) this.select(Number(n[1]) - 1);
    });
    window.addEventListener('wheel', (e) => {
      if (!isActive() || e.deltaY === 0) return;
      this.select(this.selected + Math.sign(e.deltaY));
    }, { passive: true });

    inventory.onChange(() => this.render());
    this.render();
    this.select(0);
  }

  render() {
    this.slots.forEach((el, i) => fillSlot(el, this.atlas, this.inventory.slots[i]));
  }

  select(index) {
    this.selected = ((index % HOTBAR) + HOTBAR) % HOTBAR; // wrap around both ways
    this.slots.forEach((s, i) => s.classList.toggle('active', i === this.selected));
    // Briefly show the item name above the hotbar
    const id = this.selectedItem();
    this.nameEl.textContent = id ? itemName(id) : '';
    this.nameEl.classList.remove('fade');
    void this.nameEl.offsetWidth; // restart the fade animation
    this.nameEl.classList.add('fade');
  }

  // Item id in the selected hotbar slot (0 when empty)
  selectedItem() {
    return this.inventory.slots[this.selected]?.id ?? 0;
  }

  // Ten hearts for 20 health points; null hides them (creative mode)
  setHealth(health, max = 20) {
    if (health === null) {
      this.heartsEl.style.display = 'none';
      return;
    }
    this.heartsEl.style.display = 'flex';
    let html = '';
    for (let i = 0; i < max / 2; i++) {
      const hp = health - i * 2;
      html += `<span class="heart ${hp >= 2 ? 'full' : hp === 1 ? 'half' : 'empty'}"></span>`;
    }
    this.heartsEl.innerHTML = html;
  }

  // Mining progress 0..1 (0 hides the bar)
  setProgress(p) {
    this.miningEl.style.display = p > 0 ? 'block' : 'none';
    this.miningEl.firstElementChild.style.width = `${Math.min(1, p) * 100}%`;
  }

  // Flash the screen red when hurt
  flashHurt() {
    this.hurtEl.classList.remove('flash');
    void this.hurtEl.offsetWidth;
    this.hurtEl.classList.add('flash');
  }
}
