// Edge spawner driven by the difficulty director. Kinds are table-driven:
// ore, medium rocks, and the heavy class — which is a monolith or, some of
// the time, a rubble cluster that comes apart on a graze. Shards and chips
// only ever come from splits.

import { TUNING, type DifficultySample } from '../config'
import type { RNG } from '../rng'
import { emit } from '../events'
import { ObjectPool, ORE, MONOLITH, MEDIUM, RUBBLE } from './pool'

export class Spawner {
  private timer: number = TUNING.spawn.firstDelay

  reset(): void {
    this.timer = TUNING.spawn.firstDelay
  }

  update(dt: number, diff: DifficultySample, pool: ObjectPool, rng: RNG, w: number, h: number, sx: number, sy: number): void {
    this.timer -= dt
    if (this.timer > 0) return
    this.spawnOne(diff, pool, rng, w, h, sx, sy)
    const jitter = rng.range(TUNING.difficulty.intervalJitterMin, TUNING.difficulty.intervalJitterMax)
    this.timer = diff.spawnInterval * jitter
  }

  /** Spawn a single object of an explicit kind (first-run beats). */
  spawnKind(kind: number, pool: ObjectPool, rng: RNG, w: number, h: number, sx: number, sy: number, opts?: { side?: number; speed?: number; spread?: number }): void {
    this.place(kind, pool, rng, w, h, sx, sy, 0, opts)
  }

  private spawnOne(diff: DifficultySample, pool: ObjectPool, rng: RNG, w: number, h: number, sx: number, sy: number): void {
    const roll = rng.next()
    let kind: number
    if (roll < diff.oreChance) kind = ORE
    else if (roll < diff.oreChance + diff.monolithChance) {
      kind = rng.next() < TUNING.difficulty.rubbleShareOfHeavies ? RUBBLE : MONOLITH
    } else kind = MEDIUM
    this.place(kind, pool, rng, w, h, sx, sy, diff.speedBonus)
  }

  private place(kind: number, pool: ObjectPool, rng: RNG, w: number, h: number, sx: number, sy: number, speedBonus: number, opts?: { side?: number; speed?: number; spread?: number }): void {
    const o = pool.spawn()
    if (!o) return

    const m = TUNING.spawn.edgeMargin
    const side = opts?.side ?? Math.floor(rng.next() * 4)
    let x: number, y: number
    if (side === 0) { x = rng.next() * w; y = -m }
    else if (side === 1) { x = w + m; y = rng.next() * h }
    else if (side === 2) { x = rng.next() * w; y = h + m }
    else { x = -m; y = rng.next() * h }

    let ax = sx - x
    let ay = sy - y
    const dist = Math.hypot(ax, ay) || 1
    const spreadMax = opts?.spread ?? TUNING.spawn.aimSpread
    const spread = rng.range(-spreadMax, spreadMax)
    const ca = Math.cos(spread)
    const sa = Math.sin(spread)
    const dx = (ax * ca - ay * sa) / dist
    const dy = (ax * sa + ay * ca) / dist

    const speed = opts?.speed ?? rng.range(TUNING.spawn.speedMin, TUNING.spawn.speedMax) + speedBonus

    const R = TUNING.rocks
    o.kind = kind
    if (kind === ORE) {
      o.r = R.ore.r
      o.hp = 1
      o.rs = rng.range(-0.9, 0.9)
    } else {
      const cfg = kind === MONOLITH ? R.monolith : kind === RUBBLE ? R.rubble : R.medium
      o.r = rng.range(cfg.rMin, cfg.rMax)
      o.hp = cfg.hp
      o.rs = rng.range(-cfg.spinMax, cfg.spinMax)
    }
    o.x = x; o.y = y; o.px = x; o.py = y
    o.vx = dx * speed
    o.vy = dy * speed
    o.rot = rng.next() * 7
    o.seed = rng.next() * 1000

    emit('spawn', { kind: String(kind), x, y })
  }
}
