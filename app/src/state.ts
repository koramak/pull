// Game state machine: ready -> play -> dying -> dead -> play (instant retry).
// 'paused' is entered from 'play' on visibilitychange or app blur.

import { TUNING } from './config'
import { emit } from './events'
import { loadBest, saveBest } from './storage'

export type Phase = 'ready' | 'play' | 'dying' | 'dead' | 'paused'

export const game = {
  phase: 'ready' as Phase,
  score: 0,
  best: 0,
  hull: 3,
  time: 0, // elapsed run time, sim seconds
  dyingT: 0, // seconds into the death sequence (real time)
  deadT: 0, // seconds since the death panel appeared (real time)
  newBest: false
}

export function initState(): void {
  game.best = loadBest()
}

export function startRun(): void {
  game.phase = 'play'
  game.score = 0
  game.hull = TUNING.station.hull
  game.time = 0
  game.dyingT = 0
  game.deadT = 0
  game.newBest = false
  emit('runStart', undefined)
}

/** Called by the sim when hull reaches zero. */
export function beginDeath(): void {
  game.phase = 'dying'
  game.dyingT = 0
  game.newBest = game.score > game.best
  if (game.newBest) {
    game.best = game.score
    saveBest(game.best)
  }
  emit('death', { score: game.score, best: game.best, newBest: game.newBest })
}

/** Real-time bookkeeping for the death sequence and retry lockout. */
export function updateState(realDt: number): void {
  if (game.phase === 'dying') {
    game.dyingT += realDt
    if (game.dyingT >= TUNING.dying.duration) {
      game.phase = 'dead'
      game.deadT = 0
    }
  } else if (game.phase === 'dead') {
    game.deadT += realDt
  }
}

export function pauseGame(): void {
  if (game.phase !== 'play') return
  game.phase = 'paused'
  emit('pause', undefined)
}

export function resumeGame(): void {
  if (game.phase !== 'paused') return
  game.phase = 'play'
  emit('resume', undefined)
}

/**
 * A tap that might be a state transition rather than a well press.
 * Returns true if consumed (the well should NOT engage).
 */
export function handleTap(): boolean {
  switch (game.phase) {
    case 'ready':
      startRun()
      return true
    case 'dead':
      if (game.deadT >= TUNING.dying.restartLockout) startRun()
      return true
    case 'paused':
      resumeGame()
      return true
    default:
      return false
  }
}
