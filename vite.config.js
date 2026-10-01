import { defineConfig } from 'vite';

// Relative asset paths so the production build in dist/ works from any folder
// or sub-path (GitHub Pages, itch.io, a zip opened on a static host, ...)
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 800 }, // three.js alone is ~500 kB; fine for a game
});
