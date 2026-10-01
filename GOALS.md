# Goals
Work through these in order. Do not start a goal until the previous one runs
without errors. Tick the box when done.
## Milestone 1: See something
- [x] 1. Three.js scene: sky color, lighting, flat grid of cubes
- [x] 2. First-person controls: WASD, mouse look (pointer lock), jump, gravity
## Milestone 2: A real world
- [x] 3. Chunk of terrain (16x16x64) with noise-based heights
- [x] 4. Face culling: only render faces that touch air
- [x] 5. Block types: grass, dirt, stone, sand, with a procedural texture atlas
## Milestone 3: Play
- [ ] 6. Raycast block selection with a wireframe highlight
- [ ] 7. Left-click breaks a block, right-click places the selected block
- [ ] 8. AABB collision so the player cannot walk through blocks
- [ ] 9. Hotbar UI (keys 1-9 / scroll wheel) and crosshair
## Milestone 4: Big world
- [ ] 10. Infinite world: load/unload chunks around the player
- [ ] 11. Only rebuild the meshes of chunks that changed
## Milestone 5: Polish
- [ ] 12. Day/night cycle with sky and light changes
- [ ] 13. Save/load world changes in localStorage
- [ ] 14. Trees, water, and simple sound effects (stretch goals)
## Definition of done (every goal)
- Runs with `npm run dev` and no console errors
- Holds a smooth frame rate (aim for 60 FPS)
- Committed to git

## Notes for later goals
- Player collision is a ground-only check that steps up onto blocks (src/player.js);
  goal 8 replaces it with real AABB collision.
- The world is a fixed 8x8 chunk square (WORLD_RADIUS in src/main.js); goal 10
  replaces that with streaming chunks.
- Atlas has 16 tile slots (src/textures.js), 5 used; add tiles to TILE and BLOCK_TEXTURES.
- `window.__game` / `window.__debug` are exposed in dev only for automated checks.
