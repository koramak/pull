// Edge spawner driven by the difficulty director curve.
// Object kinds are table-driven so a third type (heavy rock, splitter…)
// drops in without touching spawn logic: add an entry and a weight source.

import { TUNING, sampleDifficulty, type DifficultySample } from '../config'
import type { RNG } from '../rng'
import { emit } from '../events'
import { ObjectPool, ROCK, ORE } from './pool'

const diff: DifficultySample = { spawnInterval: 1.7, speedBonus: 0, oreChance: 0.32 }

export interface SpawnKind {
  id: number
  /** Weight at the current difficulty sample (0 disables). */
  weight(d: DifficultySample): number
  /** Configure the freshly pooled object (radius, spin…). */
  configure(o: import('./pool').GameObject, rng: RNG): void
}

const KINDS: SpawnKind[] = [
  {
    id: ROCK,
    weight: d => 1 - d.oreChance,
    configure(o, rng) {
      o.type = ROCK
      o.r = rng.range(TUNING.objects.rockRadiusMin, TUNING.objects.rockRadiusMax)
    }
  },
  {
    id: ORE,
    weight: d => d.oreChance,
    configure(o, rng) {
      o.type = ORE
      o.r = TUNING.objects.oreRadius
    }
  }
]

export class Spawner {
  private timer = TUNING.spawn.firstDelay

  reset(): void {
    this.timer = TUNING.spawn.firstDelay
  }

  /** Current difficulty sample (also displayed by the debug overlay). */
  sample(time: number): DifficultySample {
    return sampleDifficulty(time, diff)
  }

  update(dt: number, time: number, pool: ObjectPool, rng: RNG, w: number, h: number, sx: number, sy: number): void {
    this.timer -= dt
    if (this.timer > 0) return
    sampleDifficulty(time, diff)
    this.spawnOne(pool, rng, w, h, sx, sy)
    const jitter = rng.range(TUNING.difficulty.intervalJitterMin, TUNING.difficulty.intervalJitterMax)
    this.timer = diff.spawnInterval * jitter
  }

  private spawnOne(pool: ObjectPool, rng: RNG, w: number, h: number, sx: number, sy: number): void {
    const o = pool.spawn()
    if (!o) return // pool exhausted; skip rather than allocate

    const m = TUNING.spawn.edgeMargin
    const side = Math.floor(rng.next() * 4)
    let x: number, y: number
    if (side === 0) { x = rng.next() * w; y = -m }
    else if (side === 1) { x = w + m; y = rng.next() * h }
    else if (side === 2) { x = rng.next() * w; y = h + m }
    else { x = -m; y = rng.next() * h }

    // Aim at the station, rotated by a random spread
    let ax = sx - x
    let ay = sy - y
    const dist = Math.hypot(ax, ay) || 1
    const spread = rng.range(-TUNING.spawn.aimSpread, TUNING.spawn.aimSpread)
    const ca = Math.cos(spread)
    const sa = Math.sin(spread)
    const dx = (ax * ca - ay * sa) / dist
    const dy = (ax * sa + ay * ca) / dist

    const speed = rng.range(TUNING.spawn.speedMin, TUNING.spawn.speedMax) + diff.speedBonus

    // Weighted kind pick
    let total = 0
    for (let i = 0; i < KINDS.length; i++) total += KINDS[i].weight(diff)
    let roll = rng.next() * total
    let kind = KINDS[0]
    for (let i = 0; i < KINDS.length; i++) {
      roll -= KINDS[i].weight(diff)
      if (roll <= 0) { kind = KINDS[i]; break }
    }

    o.x = x; o.y = y; o.px = x; o.py = y
    o.vx = dx * speed
    o.vy = dy * speed
    o.rot = rng.next() * 7
    o.rs = rng.range(-TUNING.objects.spinMax, TUNING.objects.spinMax)
    o.seed = rng.next() * 1000
    kind.configure(o, rng)

    emit('spawn', { type: o.type === ORE ? 'ore' : 'rock', x, y })
  }
}
