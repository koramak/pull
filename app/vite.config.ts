import { defineConfig } from 'vite'

// Relative base so the same build works on GitHub Pages (served from a
// subpath) and inside a Capacitor native shell (served from file://).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0
  },
  server: {
    host: true
  }
})
