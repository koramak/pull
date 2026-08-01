// Interrupted-run snapshot: write on app-switch, restore on launch. The
// live field is not saved — it repopulates; the build, score and clock are
// what the player would miss.

import { game, restoreRun } from './state'
import {
  saveRun as persist, loadSavedRun as load, type SavedRun
} from './storage'
import type { Sim } from './sim/sim'

export function saveRun(sim: Sim): void {
  const st = sim.station
  persist({
    score: game.score,
    time: game.time,
    oreTotal: game.oreTotal,
    smashes: game.smashes,
    sections: st.sections,
    dead: st.dead.map((d, i) => (d ? i : -1)).filter(i => i >= 0),
    capacity: st.capacity,
    ships: st.ships.length,
    reservoir: st.reservoir,
    at: Date.now()
  })
}

export function loadSavedRun(maxAgeS: number): SavedRun | null {
  return load(maxAgeS)
}

export function restoreSnapshot(sim: Sim, saved: SavedRun): void {
  sim.reset()
  const st = sim.station
  // rebuild the station: sections, capacity, damage — then ships, so they
  // dock onto sections that are actually alive
  const extraSections = Math.max(0, Math.min(3, saved.sections - st.sections))
  for (let i = 0; i < extraSections; i++) st.applyUpgrade('hull')
  for (let i = 0; i < Math.min(3, saved.capacity); i++) st.applyUpgrade('capacity')
  for (const idx of saved.dead) {
    if (idx >= 0 && idx < st.sections) st.dead[idx] = true
  }
  if (st.aliveCount() > 0) {
    for (let i = 0; i < Math.min(3, saved.ships); i++) st.applyUpgrade('ships')
  }
  st.reservoir = Math.min(st.reservoirCap, Math.max(0, saved.reservoir))
  st.structureRev++
  sim.clearField()
  restoreRun(saved)
}
