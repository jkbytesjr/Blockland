import { BLOCK } from './blocks.js';

// Simple sound effects synthesized with the Web Audio API (no audio files):
// filtered noise bursts for breaking, placing and footsteps, a low "thump"
// for solid hits, and a swept noise for splashes.

// How each material sounds: noise filter, its frequency, and an optional thump pitch
const MATERIALS = {
  grass: { filter: 'highpass', freq: 1800, q: 0.7, thump: 0 },
  gravel: { filter: 'bandpass', freq: 1100, q: 0.9, thump: 0 },
  stone: { filter: 'bandpass', freq: 2600, q: 1.4, thump: 140 },
  wood: { filter: 'lowpass', freq: 900, q: 1.2, thump: 190 },
  sand: { filter: 'lowpass', freq: 1500, q: 0.5, thump: 0 },
};

const BLOCK_MATERIAL = {
  [BLOCK.GRASS]: 'grass', [BLOCK.LEAVES]: 'grass',
  [BLOCK.DIRT]: 'gravel', [BLOCK.GRAVEL]: 'gravel',
  [BLOCK.STONE]: 'stone', [BLOCK.COBBLESTONE]: 'stone', [BLOCK.BRICKS]: 'stone',
  [BLOCK.PLANKS]: 'wood', [BLOCK.LOG]: 'wood',
  [BLOCK.SAND]: 'sand',
};

// Length, loudness and thump strength of each kind of sound
const KINDS = {
  break: { duration: 0.2, gain: 0.7, thump: 0.5 },
  place: { duration: 0.09, gain: 0.55, thump: 0.8 },
  step: { duration: 0.07, gain: 0.18, thump: 0.15 },
};

const STEP_DISTANCE = 1.9; // blocks walked between footsteps

export class Sounds {
  constructor() {
    this.ctx = null; // created on the first click: browsers block audio before that
    this.muted = false;
    this.walked = 0;
    this.wasInWater = false;
    this.lastFallSpeed = 0; // vertical speed last frame (water slows it on entry)
  }

  // Call from a user gesture (the click that starts the game)
  unlock() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return; // no Web Audio: play silently
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // One second of white noise, reused by every sound
      const length = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  get ready() {
    return this.ctx && this.ctx.state === 'running' && !this.muted;
  }

  // Play the break, place or step sound for a block id ('eat' for chewing)
  block(kind, id) {
    if (!this.ready) return;
    if (kind === 'eat') return this.chew();
    const material = MATERIALS[BLOCK_MATERIAL[id] ?? 'stone'];
    const { duration, gain, thump } = KINDS[kind];
    const t = this.ctx.currentTime;
    // Slight random pitch so repeated sounds don't feel robotic
    const vary = 0.85 + Math.random() * 0.3;
    this.noiseBurst(t, duration, material.filter, material.freq * vary, material.q, gain);
    if (material.thump && thump) this.tone(t, duration * 0.8, material.thump * vary, gain * thump);
  }

  chew() {
    const t = this.ctx.currentTime;
    this.noiseBurst(t, 0.07, 'bandpass', 1400 + Math.random() * 600, 1.5, 0.35);
  }

  // A short low grunt when the player gets hurt
  hurt() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.tone(t, 0.18, 220, 0.5);
    this.noiseBurst(t, 0.12, 'lowpass', 700, 1, 0.4);
  }

  // Mob sounds: a low moan, a thwack when hit, a puff when one vanishes
  groan() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110 + Math.random() * 30, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.7);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    osc.connect(filter).connect(this.envelope(t, 0.7, 0.25));
    osc.start(t);
    osc.stop(t + 0.75);
  }

  hit() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, 0.08, 'bandpass', 900, 1.2, 0.6);
    this.tone(t, 0.1, 160, 0.5);
  }

  poof() {
    if (!this.ready) return;
    const filter = this.noiseBurst(this.ctx.currentTime, 0.3, 'bandpass', 3000, 0.8, 0.3);
    filter.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.3);
  }

  splash() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const filter = this.noiseBurst(t, 0.45, 'lowpass', 2500, 0.8, 0.6);
    filter.frequency.exponentialRampToValueAtTime(300, t + 0.45); // a falling "whoosh"
  }

  // Footsteps while walking on the ground, and a splash on falling into water
  update(dt, player, blockBelow) {
    if (player.inWater && !this.wasInWater && this.lastFallSpeed < -4) this.splash();
    this.wasInWater = player.inWater;
    this.lastFallSpeed = player.velocity.y;
    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    if (player.inWater || speed < 0.1) {
      this.walked = STEP_DISTANCE * 0.7; // first step comes soon after starting to walk
      return;
    }
    if (!player.onGround) return; // no steps mid-jump
    this.walked += speed * dt;
    if (this.walked >= STEP_DISTANCE) {
      this.walked = 0;
      const id = blockBelow();
      if (id) this.block('step', id);
    }
  }

  // Filtered noise with a fast attack and decay; returns the filter node
  noiseBurst(t, duration, type, freq, q, gain) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const env = this.envelope(t, duration, gain);
    src.connect(filter).connect(env);
    src.start(t, Math.random() * 0.5, duration + 0.05);
    return filter;
  }

  // A short sine "thump" that drops in pitch
  tone(t, duration, freq, gain) {
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + duration);
    osc.connect(this.envelope(t, duration, gain));
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  envelope(t, duration, gain) {
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    env.connect(this.master);
    return env;
  }
}
