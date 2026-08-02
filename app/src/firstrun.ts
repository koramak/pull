// First run — no words (kit 24f). Three beats, each waits forever:
//   1. one ore drifts in; hold to curl it into the core. (The dashed
//      trajectory guide this beat once drew was removed by playtest ruling —
//      no predictive lines anywhere.)
//   2. a rock to dodge — curve it away from the station (it cannot hurt you
//      here; a hit just resets the beat).
//   3. the upgrade choice — the reservoir arrives full and the normal
//      freeze/swipe/surge plays.
// Then straight into the run. seenFirstRun is written once beat three ends.

import { TUNING } from './config'
import { on } from './events'
import { game } from './state'
import { markFirstRunSeen } from './storage'
import { ORE, MONOLITH } from './sim/pool'
import type { Sim, PointerState } from './sim/sim'

class FirstRun {
  beat: 0 | 1 | 2 | 3 = 0 // 0 = inactive
  /** Seconds since the last touch — drives the fingertip hint. */
  untouchedT = 0

  private needSpawn = false
  private spawnDelay = 0
  private done1 = false
  private done2 = false

  start(): void {
    this.beat = 1
    this.needSpawn = true
    this.spawnDelay = 0.8
    this.done1 = false
    this.done2 = false
    this.untouchedT = 0
  }

  stop(): void {
    this.beat = 0
  }

  init(): void {
    on('bank', () => {
      if (this.beat === 1) this.done1 = true
    })
    on('deflect', () => {
      if (this.beat === 2) this.done2 = true
    })
  }

  update(dt: number, sim: Sim, pointer: PointerState): void {
    if (this.beat === 0 || game.phase !== 'firstrun') return
    this.untouchedT = pointer.active ? 0 : this.untouchedT + dt

    if (this.beat === 1) {
      if (this.done1) {
        this.beat = 2
        this.needSpawn = true
        this.spawnDelay = 1.0
        return
      }
      this.ensureObject(sim, ORE)
    } else if (this.beat === 2) {
      if (this.done2) {
        this.beat = 3
        // beat three: the choice, taught by playing it — reservoir arrives full
        sim.station.reservoir = sim.station.reservoirCap
        return
      }
      this.ensureObject(sim, MONOLITH)
    }
    // beat 3 is carried by the normal choice flow; finish() is called by
    // main when the upgrade completes.
  }

  finish(): void {
    markFirstRunSeen()
    this.stop()
  }

  private ensureObject(sim: Sim, kind: number): void {
    if (sim.pool.count > 0) {
      this.needSpawn = false
      return
    }
    if (!this.needSpawn) {
      this.needSpawn = true
      this.spawnDelay = 0.9
      return
    }
    this.spawnDelay -= TUNING.sim.dt * (sim.stepsLastFrame || 1)
    if (this.spawnDelay > 0) return
    this.needSpawn = false
    // ore arrives from the upper-right on a gentle pass (kit 24f path);
    // the rock comes in slow and aimed straight.
    if (kind === ORE) {
      sim.spawner.spawnKind(ORE, sim.pool, sim.rng, sim.width, sim.height, sim.station.x, sim.station.y, {
        side: 1, speed: 62, spread: 0.5
      })
    } else {
      sim.spawner.spawnKind(MONOLITH, sim.pool, sim.rng, sim.width, sim.height, sim.station.x, sim.station.y, {
        side: 0, speed: 55, spread: 0.05
      })
    }
  }
}

export const firstRun = new FirstRun()
