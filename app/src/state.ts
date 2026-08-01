// State machine — kit 24a "States the code needs".
//
//   TITLE      launch · 12s after RESULT        → RUN on PLAY
//   FIRSTRUN   first launch only                → RUN after three beats
//   RUN        PLAY                             → CHOICE · COLLAPSE · PAUSED
//   CHOICE     reservoir full, finger released  → RUN, 480ms after the flick
//   PAUSED     app loses focus                  → RUN on RESUME · TITLE if old
//   COLLAPSE   hull 0                           → RESULT
//   RESULT     collapse ends                    → RUN on PLAY AGAIN · TITLE 12s
//   SETTINGS   gear on TITLE or RESULT          → back where it came from
//
// Flags (hull critical · new best) layer on RUN; they are not states.

import { TUNING } from './config'
import { emit } from './events'
import { loadBest, saveBest, pushRun, pushDeath, seenFirstRun, clearSavedRun, type SavedRun } from './storage'

export type Phase =
  | 'title'
  | 'firstrun'
  | 'run'
  | 'choice'
  | 'paused'
  | 'collapse'
  | 'result'
  | 'settings'

export const game = {
  phase: 'title' as Phase,
  score: 0,
  best: 0,
  time: 0,          // elapsed run time, sim seconds
  oreTotal: 0,      // ore units banked over the run (RESULT "ORE")
  smashes: 0,
  newBest: false,

  // real-time clocks per phase
  phaseT: 0,        // seconds since the current phase began
  idleT: 0,         // seconds since the last pointer activity (title/result)
  pausedAt: 0,      // wall-clock ms when PAUSED began

  settingsFrom: 'title' as 'title' | 'result',

  /** Set by the sim when the run's station is down. */
  pendingCollapse: false
}

export function initState(): void {
  game.best = loadBest()
}

export function setPhase(p: Phase): void {
  game.phase = p
  game.phaseT = 0
  game.idleT = 0
}

/** PLAY — from title, result, or the end of first-run beat three. */
export function startRun(): void {
  game.score = 0
  game.time = 0
  game.oreTotal = 0
  game.smashes = 0
  game.newBest = false
  game.pendingCollapse = false
  clearSavedRun()
  const first = !seenFirstRun()
  setPhase(first ? 'firstrun' : 'run')
  emit('runStart', undefined)
}

/** Restore an interrupted run (kit: PAUSED survives an app switch). */
export function restoreRun(saved: SavedRun): void {
  game.score = saved.score
  game.time = saved.time
  game.oreTotal = saved.oreTotal
  game.smashes = saved.smashes
  game.newBest = false
  game.pendingCollapse = false
  setPhase('paused')
  game.pausedAt = Date.now()
}

/** Hull 0 → the CRT loses power. */
export function beginCollapse(): void {
  if (game.phase === 'collapse') return
  setPhase('collapse')
  pushDeath({ t: game.time, score: game.score, at: Date.now() }) // M3 telemetry
  game.newBest = game.score > game.best
  if (game.newBest) {
    game.best = game.score
    saveBest(game.best)
  }
  clearSavedRun()
  emit('collapse', { score: game.score, best: game.best, newBest: game.newBest })
}

export function finishCollapse(sectionsAtDeath: number): void {
  pushRun({
    score: game.score,
    time: game.time,
    ore: game.oreTotal,
    sections: sectionsAtDeath,
    at: Date.now()
  })
  setPhase('result')
}

export function pauseGame(): void {
  if (game.phase !== 'run' && game.phase !== 'choice' && game.phase !== 'firstrun') return
  setPhase('paused')
  game.pausedAt = Date.now()
  emit('pause', undefined)
}

export function resumeGame(): 'run' | 'title' {
  const age = (Date.now() - game.pausedAt) / 1000
  if (age > TUNING.shell.pausedMaxAge) {
    clearSavedRun()
    setPhase('title')
    return 'title'
  }
  setPhase('run')
  emit('resume', undefined)
  return 'run'
}

export function openSettings(from: 'title' | 'result'): void {
  game.settingsFrom = from
  setPhase('settings')
}

export function closeSettings(): void {
  setPhase(game.settingsFrom)
}

/** Real-time bookkeeping: phase clocks + idle timeouts. */
export function updateState(realDt: number, pointerActive: boolean): void {
  game.phaseT += realDt
  if (pointerActive) game.idleT = 0
  else game.idleT += realDt

  // RESULT → TITLE after 12 seconds untouched
  if (game.phase === 'result' && game.idleT >= TUNING.shell.resultToTitle) {
    setPhase('title')
  }
  // A paused run older than 5 minutes is discarded rather than half-restored
  if (game.phase === 'paused' && (Date.now() - game.pausedAt) / 1000 > TUNING.shell.pausedMaxAge) {
    clearSavedRun()
    setPhase('title')
  }
}
