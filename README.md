# Blockland

A Minecraft-style voxel sandbox that runs in the browser, built with Three.js.
Everything is generated in code: the endless terrain, the block textures and
the sound effects.

**Play it here: https://jkbytesjr.github.io/Minecraft-2.0/**

## Features
- Endless terrain with hills, beaches, lakes and forests
- Break and place 9 kinds of blocks
- Day/night cycle with a moving sun and moon, sunsets and stars
- Swimming, with a murky blue view underwater
- Sound effects for breaking, placing, footsteps and splashes
- Your changes are saved in the browser

## Controls
| Key | Action |
| --- | --- |
| WASD | Move |
| Mouse | Look around |
| Space | Jump / swim up |
| Left click | Break block |
| Right click | Place block |
| 1-9 / scroll wheel | Pick block |
| T | Skip ahead in time |
| M | Mute sound |
| Esc | Release the mouse |

## Run it locally
```sh
npm install
npm run dev     # http://localhost:5173
npm run build   # static files in dist/
```

Pushing to `main` deploys the game to GitHub Pages
(`.github/workflows/deploy.yml`).
