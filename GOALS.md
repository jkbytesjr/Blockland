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
- [x] 6. Raycast block selection with a wireframe highlight
- [x] 7. Left-click breaks a block, right-click places the selected block
- [x] 8. AABB collision so the player cannot walk through blocks
- [x] 9. Hotbar UI (keys 1-9 / scroll wheel) and crosshair
## Milestone 4: Big world
- [x] 10. Infinite world: load/unload chunks around the player
- [x] 11. Only rebuild the meshes of chunks that changed
## Milestone 5: Polish
- [x] 12. Day/night cycle with sky and light changes
- [x] 13. Save/load world changes in localStorage
- [x] 14. Trees, water, and simple sound effects (stretch goals)
## Definition of done (every goal)
- Runs with `npm run dev` and no console errors
- Holds a smooth frame rate (aim for 60 FPS)
- Committed to git

## Notes for later goals
- Player is a 0.6 x 1.8 AABB resolved one axis at a time (`Player.moveAxis`), with
  sub-steps so fast falls can't tunnel. No auto step-up: jump onto ledges.
- Chunks stream around the player (src/chunkLoader.js, RENDER_RADIUS in src/main.js):
  meshed within the radius, data one ring further so border faces cull right
  the first time, unloaded with a one-ring gap. Work is nearest-first under a
  per-frame time budget; fog ends just inside the render radius.
- Player edits live in `World.edits` (chunk key -> block index -> id), separate
  from chunk data, and are re-applied when a chunk regenerates. Setting a block
  back to its generated value (`World.terrainBlock`) drops the edit.
- Atlas has 16 tile slots (src/textures.js), 11 used; add tiles to TILE and BLOCK_TEXTURES.
- Nine block types, all on the hotbar (HOTBAR_BLOCKS in src/ui.js); names in BLOCK_NAMES.
- `window.__game` / `window.__debug` are exposed in dev only for automated checks.
- Edits re-mesh only the touched chunk plus a neighbor when the block is on a
  chunk border: `World.setBlock` returns the keys, `ChunkMeshes.markDirty`
  queues them and `flush()` rebuilds each once per frame. Unmeshed chunks are
  skipped. Streaming never rebuilds an existing mesh (data ring is one wider).
- The mesher writes into reused typed arrays (~1-2 ms per chunk in headless
  Chromium, down from ~6.5 ms). `__debug().builds` counts mesh builds.
- Saves (src/save.js) hold only `World.edits` plus the player's position and
  look direction under localStorage key `blockland-save` (versioned, tied to
  the seed). Written 1 s after an edit, every 15 s, and on tab hide/close.
  "New world" on the start overlay clears it. Goal 14 trees must be part of
  `World.terrainBlock` or saved edits will treat them as changes.
- Day/night (src/sky.js, `DayNight`): `time` 0..1 (0 midnight, 0.25 sunrise,
  0.5 noon), one cycle per `DAY_LENGTH` (600 s). Each frame it sets sky and fog
  color, the sun/moon directional lights and the hemisphere fill. Sun, moon
  and stars are camera-following sky objects. T skips 1/8 day. Time of day is
  stored in the save as `time`.
- Trees come from the generator (`World.treeInCell` / `World.treeBlock`): at most
  one per 7x7 cell, kept 2 blocks inside it so leaves never cross into another
  cell, so `terrainBlock` checks just one cell. Only on grass (above the beach).
- Water (BLOCK.WATER) fills air below `WATER_LEVEL` (22). It is not solid
  (`isSolidBlock`), so the player, the selection ray and placement pass through
  it. Chunks have a second, see-through water mesh (`buildChunkGeometry`
  returns `{ solid, water }`, ChunkMeshes keeps a Group per chunk). Water does
  not flow: breaking a lake bed leaves an air pocket.
- Swimming (`Player.inWater`, checked at the feet): slow sinking, Space swims
  up, 60% walk speed. Fog turns blue and short when the camera is underwater.
- Sounds (src/sound.js) are synthesized with Web Audio: break/place/step per
  material, plus a splash. The AudioContext is created on the start-overlay
  click. M mutes.
- Starting the game goes through `Player.start()`: it asks for pointer lock and
  falls back to drag mode (`player.dragMode`: hold a button and drag to look,
  click without dragging to break/place, Esc for the menu) when the browser
  refuses, e.g. in a sandboxed preview iframe without allow-pointer-lock.

## Extras (after the 14 goals)
- [x] Sprinting: Shift or double-tap W (1.6x speed, FOV 75 -> 85)
- [x] Ores: coal, iron, gold, diamond veins (`World.oreAt`, part of terrainBlock)
- [x] Survival and creative modes (src/gameMode.js), each with its own inventory
- [x] Inventory (src/inventory.js, 36 slots, first 9 are the hotbar) and a
      recipe-book crafting screen on E (src/crafting.js, src/screens.js)
- [x] Mobs at night (src/mobs.js)
- [x] Hunger and food (src/gameMode.js; food values in src/items.js)
- [x] Hand / held item view (src/hand.js) with animations, block-break
      particles (src/particles.js), view bobbing and hurt tilt

Notes:
- Items (src/items.js): block items use the block id, other items are >= 100.
  Mining time, required pickaxe tier and drops are in `MINING`.
- Survival mining is hold-to-break (`BlockEditor.update`); creative breaks
  instantly. Blocks needing a pickaxe drop nothing without the right tier.
- Health: 20 points, fall damage beyond 3 blocks, heals 1 per 3 s after 5 s
  unhurt. Death keeps the inventory. Saved in the save's `game` field.
- Screens (menu / inventory / death) release the mouse; `Screens.state` says
  which. Mobs pause while the start menu is open.
- Mobs: max 10, spawn at night 18-30 blocks away, chase within 24 blocks in
  survival only, 3 damage per hit, 12 health. Each is ~11 small meshes.
- Hunger: 20 points drained by "exhaustion" (4 per point): idle 0.04/s,
  sprinting +0.5/s, jump 0.15, block 0.05, hit 0.1, each healed point 1.5.
  Heal needs >= 14, sprint needs >= 7, at 0 you take 1 damage per 4 s down
  to 1 health. Eating: hold right click 1.2 s (`BlockEditor.eating`).
- The hand is a second scene/camera drawn after the world with the depth
  buffer cleared (`Hand.render`). renderer.info is reset once per frame so
  `__debug().calls` counts both passes.
