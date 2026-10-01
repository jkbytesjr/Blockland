# Voxel Game

A Minecraft-style voxel sandbox that runs in the browser. This is an original
game: use our own name, textures and assets, not Mojang's.

## Stack
- Vite + Three.js, vanilla JavaScript (ES modules), no framework
- No external assets: textures are generated in code (canvas texture atlas)

## Commands
- `npm install` to install dependencies
- `npm run dev` to start the dev server (http://localhost:5173)
- `npm run build` to check the production build

## Architecture
- `src/main.js`: renderer, scene, game loop, wiring
- `src/world.js`: chunk storage, terrain generation, block get/set
- `src/mesher.js`: builds chunk meshes (only faces touching air)
- `src/chunkMeshes.js`: one Three.js mesh per chunk, rebuilt on demand
- `src/player.js`: first-person controls, gravity, AABB collision
- `src/interaction.js`: raycasting, break/place blocks
- `src/ui.js`: hotbar, crosshair, HUD
- `src/noise.js`: simplex/perlin noise
- `src/textures.js`: procedural texture atlas

## Conventions
- Keep modules small and single-purpose; no giant main.js
- World coordinates: x/z horizontal, y up; 1 block = 1 unit
- Chunk size 16x16x64
- Performance first: never one mesh per block; cull hidden faces
- Prefer simple readable code over clever code, with short comments

## Workflow
- Work one goal at a time from GOALS.md
- After each change, run the game and confirm it works before moving on
- Commit after each working goal with a clear message
- If something breaks, report the exact console error and fix the cause
