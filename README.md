# Blockland

A Minecraft-style voxel sandbox that runs in the browser, built with Three.js.
Everything is generated in code: the endless terrain, the block textures and
the sound effects.

**Play it here: https://jkbytesjr.github.io/Minecraft-2.0/**

## Features
- Survival and creative modes
- Survival: mine blocks by holding left click, collect them, craft tools,
  watch your health and hunger, eat food, and fight off shamblers that come
  out at night
- Food: apples from leaves, meat from mobs, cooked meat, golden apples
- You see your hand and what you're holding, with swing, bob and eating
  animations, and blocks burst into bits when broken
- Creative: every block and item, instant breaking, and flying
- Crafting: planks, sticks, wooden to diamond pickaxes and swords, ingots
- Ores underground: coal, iron, gold and diamond
- Endless terrain with hills, beaches, lakes and forests
- Day/night cycle with a moving sun and moon, sunsets and stars
- Swimming, with a murky blue view underwater
- Sound effects for breaking, placing, footsteps and splashes
- Your changes are saved in the browser

## Controls
| Key | Action |
| --- | --- |
| WASD | Move |
| Shift / double-tap W | Sprint |
| Mouse | Look around |
| Space | Jump / swim up |
| Left click (hold) | Mine a block / hit a mob |
| Right click | Place block / hold to eat |
| 1-9 / scroll wheel | Pick hotbar slot |
| E | Inventory and crafting |
| Double-tap Space | Fly (creative) |
| C | Fly down (creative) |
| T | Skip ahead in time |
| M | Mute sound |
| Esc | Release the mouse |

## Play offline
`npm run build` makes one self-contained file, `dist/index.html`. Double-click
it to play without a server. The `index.html` in the repo root is the source
page for the dev server and won't run on its own.

## Run it locally
```sh
npm install
npm run dev     # http://localhost:5173
npm run build   # dist/index.html, a single file that runs anywhere
```

Pushing to `main` deploys the game to GitHub Pages
(`.github/workflows/deploy.yml`).
