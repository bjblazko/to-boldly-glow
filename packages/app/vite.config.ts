import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  root: '.',
  // Relative asset URLs (paired with the relative 'textures/...'/'stars/...' paths in src/), so
  // the production build runs from any directory it's served from - a subfolder, GitHub Pages, or
  // an embedded preview - not only from a domain root.
  base: './',
  build: {
    target: 'esnext',
    // The download to run without a web server (scripts/buildOffline.mjs) inlines the code into
    // index.html, so it has to be one file.
    rolldownOptions: mode === 'offline' ? { output: { inlineDynamicImports: true } } : {},
  },
}))
