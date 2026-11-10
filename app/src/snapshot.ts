// Interrupted-run snapshot: write on app-switch, restore on launch. The
// live field is not saved — it repopulates; the build, score and clock are
// what the player would miss.

import { TUNING } from './config'
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
    shield: st.shieldLevel,
    shieldDownT: st.shieldDownT,
    overcharge: st.overcharge,
    bought: st.bought,
    repairs: st.repairs,
    reservoir: st.reservoir,
    at: Date.now(),
    challenge: game.challenge ? { target: game.challenge.target } : null,
    field: saveField(sim)
  })
}

function saveField(sim: Sim): number[][] {
  const rows: number[][] = []
  for (let i = 0; i < sim.pool.count; i++) {
    const o = sim.pool.objs[i]
    rows.push([o.kind, o.x, o.y, o.vx, o.vy, o.r, o.rot, o.rs, o.seed, o.touched ? 1 : 0, o.frag ? 1 : 0])
  }
  return rows
}

function restoreField(sim: Sim, rows: unknown): void {
  if (!Array.isArray(rows)) return
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 11) continue
    let ok = true
    for (let k = 0; k < 11; k++) {
      if (typeof row[k] !== 'number' || !Number.isFinite(row[k])) { ok = false; break }
    }
    if (!ok) continue
    const f = row as number[]
    if (f[0] < 0 || f[0] > 5 || f[5] <= 0) continue // unknown kind / bad radius
    const o = sim.pool.spawn()
    if (!o) return
    o.kind = Math.floor(f[0])
    o.x = f[1]; o.y = f[2]; o.px = f[1]; o.py = f[2]
    o.vx = f[3]; o.vy = f[4]
    o.r = f[5]; o.rot = f[6]; o.rs = f[7]; o.seed = f[8]
    o.touched = f[9] === 1
    o.frag = f[10] === 1
  }
}

export function loadSavedRun(maxAgeS: number): SavedRun | null {
  return load(maxAgeS)
}

export function restoreSnapshot(sim: Sim, saved: SavedRun): void {
  sim.reset()
  const st = sim.station
  // rebuild the station: sections and shield level, then the damage
  const extraSections = Math.max(0, Math.min(3, saved.sections - st.sections))
  for (let i = 0; i < extraSections; i++) st.applyUpgrade('hull')
  const shield = Math.max(0, Math.min(3, saved.shield ?? 0))
  for (let i = 0; i < shield; i++) st.applyUpgrade('shield')
  for (const idx of saved.dead) {
    if (idx >= 0 && idx < st.sections) st.dead[idx] = true
  }
  // the stack, the price ladder and the repair ladder come back too
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0)
  st.overcharge = Math.min(TUNING.overcharge.maxLevel, num(saved.overcharge))
  st.bought = Math.max(st.bought, num(saved.bought))
  st.repairs = num(saved.repairs)
  st.syncCap()
  st.reservoir = Math.min(st.reservoirCap, Math.max(0, saved.reservoir))
  const down = saved.shieldDownT
  if (shield > 0 && typeof down === 'number' && Number.isFinite(down) && down > 0) {
    st.shieldDownT = Math.min(down, st.shieldRechargeTime())
  }
  st.structureRev++
  sim.clearField()
  restoreField(sim, saved.field)
  restoreRun(saved)
}
