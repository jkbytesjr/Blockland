import { SLOTS, HOTBAR } from './inventory.js';
import { RECIPES, canCraft, craft } from './crafting.js';
import { CREATIVE_ITEMS, itemName, maxStack } from './items.js';
import { iconElement } from './icons.js';
import { fillSlot } from './ui.js';

// The screens around the game: start menu, inventory/crafting (E) and the
// death screen. Playing needs the mouse captured; every screen releases it.
export class Screens {
  constructor({ player, inventory, game, hud, atlas, sounds }) {
    Object.assign(this, { player, inventory, game, hud, atlas, sounds });
    this.state = 'menu'; // 'menu' | 'playing' | 'inventory' | 'dead'
    this.picked = null; // inventory slot clicked first, waiting for a second click

    this.menu = document.getElementById('overlay');
    this.invEl = document.getElementById('inventory');
    this.deathEl = document.getElementById('death');

    this.menu.addEventListener('click', () => this.play());
    for (const button of this.menu.querySelectorAll('[data-mode]')) {
      button.addEventListener('click', (e) => {
        e.stopPropagation(); // choosing a mode doesn't start playing yet
        game.setMode(button.dataset.mode);
        this.showModeButtons();
      });
    }
    this.showModeButtons();

    this.invEl.querySelector('.close').addEventListener('click', () => this.play());
    this.deathEl.querySelector('button').addEventListener('click', () => {
      game.respawn();
      this.state = 'menu';
      this.show();
      this.play();
    });

    player.onLockChange = (locked) => {
      if (locked) this.state = 'playing';
      else if (this.state === 'playing') this.state = 'menu'; // Esc pressed
      this.show();
    };

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && !e.repeat) {
        if (this.state === 'playing' && player.locked) this.openInventory();
        else if (this.state === 'inventory') this.play();
      }
      if (e.code === 'Escape' && this.state === 'inventory') {
        this.state = 'menu';
        this.show();
      }
    });

    inventory.onChange(() => this.state === 'inventory' && this.renderInventory());
    this.buildInventory();
    this.show();
  }

  // Try to start playing (capture the mouse). The screens hide once it works.
  play() {
    this.sounds.unlock(); // audio may only start from a click
    if (this.state === 'dead') return;
    this.picked = null;
    this.player.start();
  }

  // Release the mouse and show a screen
  leaveGame(state) {
    this.state = state;
    if (this.player.dragMode) {
      this.player.dragMode = false;
      this.player.setLocked(false);
    } else if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.show();
  }

  openInventory() {
    this.renderInventory();
    this.leaveGame('inventory');
  }

  die() {
    this.leaveGame('dead');
  }

  show() {
    const playing = this.player.locked;
    this.menu.style.display = !playing && this.state === 'menu' ? 'flex' : 'none';
    this.invEl.style.display = !playing && this.state === 'inventory' ? 'flex' : 'none';
    this.deathEl.style.display = this.state === 'dead' ? 'flex' : 'none';
    document.body.classList.toggle('drag-mode', playing && this.player.dragMode);
  }

  showModeButtons() {
    for (const b of this.menu.querySelectorAll('[data-mode]')) {
      b.classList.toggle('chosen', b.dataset.mode === this.game.mode);
    }
  }

  // Inventory screen: slots on the left, recipes (or every item, in creative) on the right
  buildInventory() {
    this.slotEls = [];
    const make = (parent, from, to) => {
      for (let i = from; i < to; i++) {
        const el = document.createElement('div');
        el.className = 'slot';
        el.addEventListener('click', () => this.clickSlot(i));
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (!this.game.creative) return;
          this.inventory.slots[i] = null; // creative: right click clears a slot
          this.inventory.changed();
        });
        parent.appendChild(el);
        this.slotEls[i] = el;
      }
    };
    make(this.invEl.querySelector('.backpack'), HOTBAR, SLOTS);
    make(this.invEl.querySelector('.hotbar-row'), 0, HOTBAR);
  }

  clickSlot(i) {
    if (this.picked === null) {
      if (this.inventory.slots[i]) this.picked = i;
    } else {
      this.inventory.swap(this.picked, i);
      this.picked = null;
    }
    this.renderInventory();
  }

  renderInventory() {
    this.slotEls.forEach((el, i) => {
      fillSlot(el, this.atlas, this.inventory.slots[i]);
      el.classList.toggle('picked', i === this.picked);
      el.title = this.inventory.slots[i] ? itemName(this.inventory.slots[i].id) : '';
    });
    const creative = this.game.creative;
    this.invEl.querySelector('.side-title').textContent = creative ? 'All items' : 'Crafting';
    this.invEl.querySelector('.hint').textContent = creative
      ? 'Click an item to put it in your selected slot · click two slots to swap · right click clears a slot'
      : 'Click two slots to swap them · click a recipe to craft it';
    const list = this.invEl.querySelector('.side');
    list.replaceChildren();
    list.classList.toggle('palette', creative);
    if (creative) {
      for (const id of CREATIVE_ITEMS) {
        const el = document.createElement('div');
        el.className = 'slot';
        el.title = itemName(id);
        el.append(iconElement(this.atlas, id));
        el.addEventListener('click', () => this.giveCreative(id));
        list.append(el);
      }
      return;
    }
    for (const recipe of RECIPES) {
      const row = document.createElement('div');
      const ok = canCraft(this.inventory, recipe);
      row.className = `recipe${ok ? '' : ' missing'}`;
      const needs = recipe.needs.map(([id, n]) => `${n} ${itemName(id)}`).join(' + ');
      const label = document.createElement('div');
      label.innerHTML = `<b>${itemName(recipe.id)}${recipe.count > 1 ? ` ×${recipe.count}` : ''}</b><small>${needs}</small>`;
      row.append(iconElement(this.atlas, recipe.id), label);
      row.addEventListener('click', () => {
        if (craft(this.inventory, recipe)) this.sounds.block('place', 6);
      });
      list.append(row);
    }
  }

  // Creative: put an item into the picked slot, or the selected hotbar slot
  giveCreative(id) {
    const i = this.picked ?? this.hud.selected;
    this.inventory.slots[i] = { id, count: maxStack(id) === 1 ? 1 : 64 };
    this.picked = null;
    this.inventory.changed();
    this.hud.select(this.hud.selected); // refresh the held item's name
  }
}
