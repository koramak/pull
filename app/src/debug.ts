// Debug overlay, enabled with ?debug in the URL. DOM-based so it costs the
// canvas nothing when off and almost nothing when on.

import { game } from './state'
import { intensity } from './intensity'
import { sampleDifficulty } from './config'
import { loadDeaths } from './storage'
import type { Sim } from './sim/sim'

let el: HTMLDivElement | null = null
let acc = 0
let frames = 0
let fps = 0

export function initDebug(sim?: Sim): boolean {
  if (!location.search.includes('debug')) return false
  el = document.createElement('div')
  el.style.cssText =
    'position:fixed;bottom:6px;left:6px;z-index:9;color:#7fffd4;font:12px monospace;' +
    'pointer-events:none;white-space:pre;text-shadow:0 1px 2px #000'
  document.body.appendChild(el)
  // dev/test hook: drive states from the console or an automated harness —
  // sampleDifficulty for curve tuning, loadDeaths for the churn-wall data
  if (sim) {
    ;(window as unknown as Record<string, unknown>).__pull = { sim, game, sampleDifficulty, loadDeaths }
  }
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
  const st = sim.station
  el.textContent =
    `fps ${fps.toFixed(0)}  steps ${sim.stepsLastFrame}  objs ${sim.pool.count}\n` +
    `phase ${game.phase}  t ${game.time.toFixed(1)}  intensity ${intensity.value.toFixed(2)}\n` +
    `hull ${st.aliveCount()}/${st.sections}  shield L${st.shieldLevel}` +
    `${st.shieldLevel > 0 ? (st.shieldDownT > 0 ? ` cd ${st.shieldDownT.toFixed(1)}` : ' armed') : ''}  ` +
    `ore ${st.reservoir}/${st.reservoirCap}`
}
