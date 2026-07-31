// Debug overlay, enabled with ?debug in the URL. DOM-based so it costs the
// canvas nothing when off and almost nothing when on.

import { game } from './state'
import { particles } from './fx/fx'
import type { Sim } from './sim/sim'

let el: HTMLDivElement | null = null
let acc = 0
let frames = 0
let fps = 0

export function initDebug(): boolean {
  if (!location.search.includes('debug')) return false
  el = document.createElement('div')
  el.style.cssText =
    'position:fixed;top:4px;left:6px;z-index:9;color:#7fffd4;font:12px monospace;' +
    'pointer-events:none;white-space:pre;text-shadow:0 1px 2px #000'
  document.body.appendChild(el)
  return true
}

export function updateDebug(sim: Sim, dt: number): void {
  if (!el) return
  frames++
  acc += dt
  if (acc < 0.25) return
  fps = frames / acc
  frames = 0
  acc = 0
  const d = sim.spawner.sample(game.time)
  el.textContent =
    `fps ${fps.toFixed(0)}  steps ${sim.stepsLastFrame}\n` +
    `objs ${sim.pool.count}  parts ${particles.count}\n` +
    `phase ${game.phase}  t ${game.time.toFixed(1)}\n` +
    `interval ${d.spawnInterval.toFixed(2)}s  spd+${d.speedBonus.toFixed(0)}  ore ${(d.oreChance * 100).toFixed(0)}%`
}
