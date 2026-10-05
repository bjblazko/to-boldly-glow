import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  // Relative asset URLs (paired with the relative 'textures/...'/'stars/...' paths in src/), so
  // the production build runs from any directory it's served from - a subfolder, GitHub Pages, or
  // an embedded preview - not only from a domain root.
  base: './',
  build: {
    target: 'esnext',
  },
})
