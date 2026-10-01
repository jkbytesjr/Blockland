import { defineConfig } from 'vite';

// Puts the game's JavaScript straight into index.html, so the build is one
// file that runs when opened by double-click (file://), where browsers refuse
// to load separate module scripts.
function inlineScripts() {
  return {
    name: 'inline-scripts',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const html = Object.values(bundle).find((file) => file.fileName.endsWith('.html'));
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        const tag = new RegExp(`<script type="module" crossorigin src="[^"]*${chunk.fileName}"></script>`);
        const code = chunk.code.replace(/<\/script/gi, '<\\/script'); // can't end the tag early
        html.source = html.source.replace(tag, () => `<script type="module">\n${code}</script>`);
        delete bundle[chunk.fileName];
      }
    },
  };
}

export default defineConfig({
  base: './', // relative paths: works from any folder or sub-path
  build: { chunkSizeWarningLimit: 800 }, // three.js alone is ~500 kB; fine for a game
  plugins: [inlineScripts()],
});
