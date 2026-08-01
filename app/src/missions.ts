// P1 — three concurrent missions drawn from a pool keyed to PULL's verbs.
// The critical property: a bad-score run still makes progress. Completions
// accumulate stars; stars climb the rank ladder (the part that matters).
// Missions double as the curriculum for advanced technique.
//
// P5 — this module also keeps the per-run stats the death screen reads:
// named awards ("HOUDINI") and the numbers behind them.

import { on, emit } from './events'
import { game } from './state'
import { loadMissions, saveMissions } from './storage'
import type { Sim } from './sim/sim'

// --- per-run stats (P5 awards + mission counters) ---------------------------

export const runStats = {
  banks: 0,
  doubled: 0,
  nearMisses: 0,
  deflects: 0,
  bestChain: 0,     // highest chain index landed (2 = the ×4 step, 40 pts)
  dangerSmashes: 0, // smashes that earned the risk multiplier
  hullHits: 0,
  repairs: 0,
  clutchBanks: 0,   // banks while one section from death
  critT: 0          // seconds spent at one section
}

function resetStats(): void {
  runStats.banks = 0
  runStats.doubled = 0
  runStats.nearMisses = 0
  runStats.deflects = 0
  runStats.bestChain = 0
  runStats.dangerSmashes = 0
  runStats.hullHits = 0
  runStats.repairs = 0
  runStats.clutchBanks = 0
  runStats.critT = 0
}

// --- the pool ---------------------------------------------------------------

export interface Mission {
  id: string
  text: string
  target: number
  /** Current-run progress for this mission (live). */
  progress(): number
}

const POOL: Mission[] = [
  { id: 'smash12', text: 'SMASH 12 IN ONE RUN', target: 12, progress: () => game.smashes },
  { id: 'bank8', text: 'BANK 8 ORE IN ONE RUN', target: 8, progress: () => runStats.banks },
  { id: 'near3', text: '3 NEAR MISSES IN ONE RUN', target: 3, progress: () => runStats.nearMisses },
  { id: 'chain4', text: 'LAND A ×4 CHAIN', target: 1, progress: () => (runStats.bestChain >= 2 ? 1 : 0) },
  { id: 'deflect15', text: 'DEFLECT 15 IN ONE RUN', target: 15, progress: () => runStats.deflects },
  { id: 'clutch', text: 'BANK AT ONE SECTION', target: 1, progress: () => (runStats.clutchBanks > 0 ? 1 : 0) },
  { id: 'survive90', text: 'SURVIVE 90 SECONDS', target: 90, progress: () => Math.floor(game.time) },
  { id: 'repair', text: 'REPAIR THE HULL', target: 1, progress: () => (runStats.repairs > 0 ? 1 : 0) },
  { id: 'greed5', text: '5 DOUBLE BANKS IN ONE RUN', target: 5, progress: () => runStats.doubled },
  { id: 'danger4', text: 'SMASH IN THE DANGER RING ×4', target: 4, progress: () => runStats.dangerSmashes }
]

const SLOTS = 3

// --- ranks ------------------------------------------------------------------

const RANK_NAMES = ['DUST', 'SPARK', 'EMBER', 'ARC', 'BEAM', 'FLARE', 'CORONA', 'NOVA', 'PULSAR', 'QUASAR'] as const

/** Stars needed to LEAVE rank i grows by one each rank: 3, 4, 5, … */
function rankFor(stars: number): { rank: number; name: string; into: number; span: number } {
  let need = 3
  let rank = 0
  let rest = stars
  while (rest >= need && rank < RANK_NAMES.length - 1) {
    rest -= need
    rank++
    need++
  }
  return { rank, name: RANK_NAMES[rank], into: rest, span: need }
}

// --- live state -------------------------------------------------------------

export const missions = {
  active: [] as Mission[],
  /** Completed this run (ids) — checked off on the death screen. */
  doneThisRun: new Set<string>(),
  stars: 0
}

export function rankInfo(): { rank: number; name: string; into: number; span: number; stars: number } {
  return { ...rankFor(missions.stars), stars: missions.stars }
}

function byId(id: string): Mission | undefined {
  return POOL.find(m => m.id === id)
}

function drawMission(): Mission {
  const activeIds = new Set(missions.active.map(m => m.id))
  const candidates = POOL.filter(m => !activeIds.has(m.id))
  return candidates[Math.floor(Math.random() * candidates.length)]
}

function persist(): void {
  saveMissions({ active: missions.active.map(m => m.id), stars: missions.stars })
}

function complete(m: Mission): void {
  missions.doneThisRun.add(m.id)
  missions.stars++
  const before = rankFor(missions.stars - 1).rank
  const after = rankFor(missions.stars).rank
  const idx = missions.active.indexOf(m)
  if (idx >= 0) missions.active[idx] = drawMission()
  persist()
  emit('missionDone', { text: m.text })
  if (after > before) emit('rankUp', { name: RANK_NAMES[after] })
}

function check(): void {
  if (game.phase !== 'run' && game.phase !== 'firstrun') return
  for (const m of [...missions.active]) {
    if (missions.doneThisRun.has(m.id)) continue
    if (m.progress() >= m.target) complete(m)
  }
}

// --- wiring -----------------------------------------------------------------

let critical = false

export function initMissions(): void {
  const saved = loadMissions()
  missions.stars = saved.stars
  missions.active = saved.active.map(byId).filter((m): m is Mission => !!m)
  while (missions.active.length < SLOTS) missions.active.push(drawMission())
  persist()

  on('runStart', () => {
    resetStats()
    missions.doneThisRun.clear()
    critical = false
  })
  on('bank', e => {
    runStats.banks++
    if (e.doubled) runStats.doubled++
    if (critical) runStats.clutchBanks++
    check()
  })
  on('nearMiss', () => { runStats.nearMisses++; check() })
  on('deflect', () => { runStats.deflects++; check() })
  on('smash', e => {
    if (!e.bothRocks) return
    if (e.chain > runStats.bestChain) runStats.bestChain = e.chain
    if (e.risky) runStats.dangerSmashes++
    check()
  })
  on('hullHit', e => {
    runStats.hullHits++
    critical = e.alive === 1
  })
  on('hullRepair', () => { runStats.repairs++; critical = false; check() })
}

/** Frame hook (run phases): time-based missions + time-at-one-section. */
export function updateMissions(dt: number, sim: Sim): void {
  if (sim.hullCritical) runStats.critT += dt
  critical = sim.hullCritical
  check()
}

// --- P5 named awards --------------------------------------------------------

export interface Award {
  name: string
  detail: string
}

/** First match wins — order is the priority. */
export function pickAward(): Award | null {
  const s = runStats
  if (s.nearMisses >= 4) return { name: 'HOUDINI', detail: `${s.nearMisses} NEAR MISSES` }
  if (s.bestChain >= 3) return { name: 'CHAIN LIGHTNING', detail: 'AN ×8 CHAIN' }
  if (s.critT >= 20) return { name: 'LAST STAND', detail: `${Math.floor(s.critT)}S ON ONE SECTION` }
  if (s.doubled >= 5) return { name: 'GREED', detail: `${s.doubled} DOUBLE BANKS` }
  if (game.smashes >= 25) return { name: 'BRAWLER', detail: `${game.smashes} SMASHES` }
  if (s.banks >= 12) return { name: 'PROSPECTOR', detail: `${s.banks} ORE BANKED` }
  if (s.deflects >= 20) return { name: 'SURGEON', detail: `${s.deflects} DEFLECTIONS` }
  if (s.hullHits === 0 && game.time >= 45) return { name: 'CLEAN SWEEP', detail: `UNTOUCHED FOR ${Math.floor(game.time)}S` }
  return null
}
