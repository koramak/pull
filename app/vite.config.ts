import { defineConfig } from 'vite'
import { execSync } from 'node:child_process'

// The title screen shows which build is running: "BUILD <n> · <sha>", where
// n is the number of commits on main. The deploy workflow checks out full
// history (fetch-depth: 0) so the count is real; without git it says DEV.
function git(args: string): string {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return ''
  }
}
const count = git('rev-list --count HEAD')
const sha = git('rev-parse --short HEAD')
const BUILD = count && sha ? `BUILD ${count} · ${sha}` : 'DEV BUILD'

// Relative base so the same build works on GitHub Pages (served from a
// subpath) and inside a Capacitor native shell (served from file://).
export default defineConfig({
  base: './',
  define: {
    __BUILD__: JSON.stringify(BUILD)
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 0
  },
  server: {
    host: true
  }
})
