// Fixed-timestep simulation (120Hz, interpolated render). Well physics and
// the smash rule are a 1:1 port of prototype/pull.html; on top of it sit the
// kit systems: the rock ladder (monolith → medium → shard → chip), rubble
// crumbling on a graze, the reservoir, hull sections, ships, near-misses and
// hit-stop. Behavior changes belong in config.ts.

import { TUNING, sampleDifficulty, type DifficultySample } from '../config'
import { emit } from '../events'
import type { RNG } from '../rng'
import { game, beginCollapse } from '../state'
import {
  ObjectPool, pushHistory, isRock,
  ORE, MONOLITH, MEDIUM, SHARD, CHIP, RUBBLE,
  type GameObject
} from './pool'
import { UniformGrid } from './grid'
import { Spawner } from './spawner'
import { Station } from './station'

export interface PointerState {
  active: boolean
  x: number // world units
  y: number
}

const FRAG_OF: Record<number, { kind: number; n: number } | null> = {
  [MONOLITH]: { kind: MEDIUM, n: 2 },
  [RUBBLE]: { kind: SHARD, n: 3 },
  [MEDIUM]: { kind: SHARD, n: 2 },
  [SHARD]: { kind: CHIP, n: 1 },
  [CHIP]: null,
  [ORE]: null
}

export class Sim {
  pool: ObjectPool
  spawner = new Spawner()
  grid = new UniformGrid()
  station = new Station()
  rng: RNG

  width = 1   // world units
  height = 1

  alpha = 0
  stepsLastFrame = 0
  /** Remaining hit-stop, real seconds. The world freezes; fx keep playing. */
  freezeT = 0
  /** True while one section from death — full-alarm flag layered on RUN. */
  hullCritical = false

  private accumulator = 0
  private stepCounter = 0
  private diff: DifficultySample = { spawnInterval: 1.7, speedBonus: 0, oreChance: 0.32, monolithChance: 0.1 }

  constructor(rng: RNG) {
    this.rng = rng
    this.pool = new ObjectPool(TUNING.objects.maxCount)
  }

  resize(worldW: number, worldH: number): void {
    this.width = worldW
    this.height = worldH
    this.station.x = worldW * TUNING.station.xFrac
    this.station.y = worldH * TUNING.station.yFrac
    this.grid.resize(worldW, worldH, TUNING.collision.gridCell, TUNING.objects.maxCount)
  }

  reset(): void {
    this.pool.clear()
    this.spawner.reset()
    this.station.reset()
    this.accumulator = 0
    this.stepCounter = 0
    this.freezeT = 0
    this.hullCritical = false
  }

  /** Clear the live field but keep the station build (restored runs). */
  clearField(): void {
    this.pool.clear()
    this.spawner.reset()
    this.accumulator = 0
    this.freezeT = 0
  }

  hitStop(seconds: number): void {
    this.freezeT = Math.max(this.freezeT, seconds)
  }

  frame(scaledDt: number, pointer: PointerState, spawning: boolean): void {
    if (this.freezeT > 0) {
      this.freezeT -= scaledDt
      if (this.freezeT > 0) return
      scaledDt = -this.freezeT // spend the remainder stepping
      this.freezeT = 0
      if (scaledDt <= 0) return
    }
    const dt = TUNING.sim.dt
    this.accumulator += Math.min(scaledDt, TUNING.sim.maxFrameDt)
    let steps = 0
    while (this.accumulator >= dt && steps < TUNING.sim.maxStepsPerFrame) {
      this.step(dt, pointer, spawning)
      this.accumulator -= dt
      steps++
      if (this.freezeT > 0) { this.accumulator = 0; break }
    }
    if (this.accumulator >= dt) this.accumulator = this.accumulator % dt
    this.alpha = this.accumulator / dt
    this.stepsLastFrame = steps
  }

  private step(dt: number, pointer: PointerState, spawning: boolean): void {
    const pool = this.pool
    const objs = pool.objs
    const st = this.station
    const interact = game.phase === 'run' || game.phase === 'firstrun'

    if (interact) game.time += dt
    if (spawning && interact) {
      sampleDifficulty(game.time, this.diff)
      this.spawner.update(dt, this.diff, pool, this.rng, this.width, this.height, st.x, st.y)
    }

    // --- gravity well + integration ---
    const wellOn = pointer.active
    const strength = TUNING.well.strength
    const softening = TUNING.well.softening
    const maxA = TUNING.well.maxAccel
    const touchA = TUNING.well.touchAccel
    this.stepCounter++
    const record = (this.stepCounter & 1) === 0 // 60Hz history for echoes

    for (let i = 0; i < pool.count; i++) {
      const o = objs[i]
      o.px = o.x
      o.py = o.y
      if (wellOn) {
        const dx = pointer.x - o.x
        const dy = pointer.y - o.y
        const d2 = dx * dx + dy * dy
        const d = Math.sqrt(d2) || 1
        let a = strength / (d2 + softening)
        if (a > maxA) a = maxA
        o.vx += (dx / d) * a * dt
        o.vy += (dy / d) * a * dt
        if (a > touchA) o.touched = true
      }
      o.x += o.vx * dt
      o.y += o.vy * dt
      o.rot += o.rs * dt
      if (o.hitFlash > 0) o.hitFlash -= dt
      if (record) pushHistory(o)
    }

    // --- pairwise collisions ---
    this.grid.build(objs, pool.count)
    this.grid.forEachPair(objs, pool.count, this.pairHandler)
    for (let i = pool.count - 1; i >= 0; i--) {
      if (objs[i].dead) pool.kill(i)
    }

    // --- ships ---
    if (interact) this.updateShips(dt)

    // --- station contact, near-misses, offscreen culling ---
    if (interact) this.stationAndBounds()
    else this.cullOnly()
  }

  private cullOnly(): void {
    const pool = this.pool
    const margin = TUNING.objects.offscreenMargin
    for (let i = pool.count - 1; i >= 0; i--) {
      const o = pool.objs[i]
      if (o.x < -margin || o.x > this.width + margin || o.y < -margin || o.y > this.height + margin) {
        pool.kill(i)
      }
    }
  }

  // -------------------------------------------------------------------------

  private pairHandler = (i: number, j: number): void => {
    const objs = this.pool.objs
    const a = objs[i]
    const b = objs[j]
    if (a.dead || b.dead) return
    const dx = b.x - a.x
    const dy = b.y - a.y
    const rr = a.r + b.r
    if (dx * dx + dy * dy >= rr * rr) return

    const rvx = a.vx - b.vx
    const rvy = a.vy - b.vy
    const rel = Math.hypot(rvx, rvy)
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2

    if (rel > TUNING.collision.smashSpeed) {
      // The smash: 42ms hit-stop, two thin white rings, the pair is replaced
      // by the next class down, shards spinning out hard.
      const bothRocks = isRock(a.kind) && isRock(b.kind)
      if (bothRocks) {
        game.score += TUNING.score.smash
        game.smashes++
      }
      this.fragment(a)
      this.fragment(b)
      a.dead = true
      b.dead = true
      this.hitStop(TUNING.smash.hitStop)
      emit('smash', { x: mx, y: my, bothRocks })
    } else {
      // Rubble comes apart on a graze — matter, not mass.
      let crumbled = false
      if (a.kind === RUBBLE) { this.fragment(a); a.dead = true; crumbled = true }
      if (b.kind === RUBBLE) { this.fragment(b); b.dead = true; crumbled = true }
      if (crumbled) {
        emit('crumble', { x: mx, y: my })
        return
      }
      // Soft bounce: positional separation + velocity swap (prototype rule)
      const d = Math.hypot(dx, dy) || 1
      const overlap = (rr - d) / 2
      const nx = dx / d
      const ny = dy / d
      a.x -= nx * overlap
      a.y -= ny * overlap
      b.x += nx * overlap
      b.y += ny * overlap
      const tvx = a.vx; a.vx = b.vx; b.vx = tvx
      const tvy = a.vy; a.vy = b.vy; b.vy = tvy
    }
  }

  /** Spawn the next-class-down fragments of o (momentum inherited). */
  private fragment(o: GameObject): void {
    const recipe = FRAG_OF[o.kind]
    if (!recipe) return
    const R = TUNING.rocks
    const cfg = recipe.kind === MEDIUM ? R.medium : recipe.kind === SHARD ? R.shard : R.chip
    const extra = o.kind === RUBBLE ? 1 : 0 // rubble: 3 shards + a chip
    const total = recipe.n + extra
    for (let k = 0; k < total; k++) {
      const f = this.pool.spawn()
      if (!f) return
      const isExtraChip = k >= recipe.n
      const c = isExtraChip ? R.chip : cfg
      const kind = isExtraChip ? CHIP : recipe.kind
      const ang = this.rng.next() * Math.PI * 2
      const spread = TUNING.rocks.splitSpread * (0.6 + this.rng.next() * 0.7)
      f.kind = kind
      f.r = this.rng.range(c.rMin, c.rMax)
      f.hp = c.hp
      f.x = o.x + Math.cos(ang) * o.r * 0.4
      f.y = o.y + Math.sin(ang) * o.r * 0.4
      f.px = f.x
      f.py = f.y
      f.vx = o.vx + Math.cos(ang) * spread
      f.vy = o.vy + Math.sin(ang) * spread
      f.rot = this.rng.next() * 7
      // 4–5 turns/s — the only fast rotation the game allows
      f.rs = this.rng.range(TUNING.rocks.fragSpinMin, TUNING.rocks.fragSpinMax) * (this.rng.next() < 0.5 ? -1 : 1)
      f.seed = this.rng.next() * 1000
      f.touched = o.touched
    }
  }

  // -------------------------------------------------------------------------

  private updateShips(dt: number): void {
    const st = this.station
    const S = TUNING.ships
    const n = st.ships.length
    if (n === 0) return
    const base = (game.time / S.orbitPeriod) * Math.PI * 2
    for (let s = 0; s < n; s++) {
      const ship = st.ships[s]
      const a = base + (ship.slot / n) * Math.PI * 2
      ship.x = st.x + Math.cos(a) * S.orbitRadius
      ship.y = st.y + Math.sin(a) * S.orbitRadius
      ship.angle = a + Math.PI / 2 // nose along the sweep
      if (ship.tracerT > 0) ship.tracerT -= dt
      if (ship.cooldown > 0) {
        ship.cooldown -= dt
        continue
      }
      const target = this.findThreat(ship.x, ship.y)
      if (target) {
        target.hp--
        target.hitFlash = S.hitFlash
        ship.cooldown = S.reload
        ship.tracerT = S.tracerDuration
        ship.tx = target.x
        ship.ty = target.y
        ship.angle = Math.atan2(target.y - ship.y, target.x - ship.x) + Math.PI / 2
        const broke = target.hp <= 0
        if (broke) {
          this.fragment(target)
          target.dead = true
          // swept next step; mark now so pairs skip it
        }
        emit('shipShot', { x0: ship.x, y0: ship.y, x1: target.x, y1: target.y, broke })
      }
    }
    // sweep anything a ship broke
    for (let i = this.pool.count - 1; i >= 0; i--) {
      if (this.pool.objs[i].dead) this.pool.kill(i)
    }
  }

  /** Nearest cool rock on a collision course with the station, in range. */
  private findThreat(fromX: number, fromY: number): GameObject | null {
    const st = this.station
    const S = TUNING.ships
    let best: GameObject | null = null
    let bestD: number = S.range
    for (let i = 0; i < this.pool.count; i++) {
      const o = this.pool.objs[i]
      if (!isRock(o.kind) || o.dead) continue
      const dx = o.x - fromX
      const dy = o.y - fromY
      const d = Math.hypot(dx, dy)
      if (d >= bestD) continue
      if (!this.onCollisionCourse(o)) continue
      best = o
      bestD = d
    }
    return best
  }

  private onCollisionCourse(o: GameObject): boolean {
    const st = this.station
    const rx = st.x - o.x
    const ry = st.y - o.y
    const v2 = o.vx * o.vx + o.vy * o.vy
    if (v2 < 1) return false
    const tClosest = (rx * o.vx + ry * o.vy) / v2
    if (tClosest < 0 || tClosest > TUNING.ships.aimLead) return false
    const cx = o.x + o.vx * tClosest - st.x
    const cy = o.y + o.vy * tClosest - st.y
    const rr = TUNING.station.radius + o.r + 6
    return cx * cx + cy * cy < rr * rr
  }

  // -------------------------------------------------------------------------

  private stationAndBounds(): void {
    const pool = this.pool
    const objs = pool.objs
    const st = this.station
    const sr = TUNING.station.radius
    const margin = TUNING.objects.offscreenMargin
    const NM = TUNING.nearMiss

    for (let i = pool.count - 1; i >= 0; i--) {
      const o = objs[i]
      const dx = o.x - st.x
      const dy = o.y - st.y
      const d = Math.hypot(dx, dy)

      if (d < o.r + sr) {
        const angle = Math.atan2(dy, dx)
        if (o.kind === ORE) {
          this.bank(angle)
        } else if (game.phase === 'firstrun') {
          // wordless teaching — the station cannot be hurt yet; the rock
          // just comes apart and the beat resets
          emit('crumble', { x: o.x, y: o.y })
        } else {
          this.hullHit(angle)
          if (game.pendingCollapse) {
            pool.kill(i)
            return
          }
        }
        pool.kill(i)
        continue
      }

      // 13d — near-miss: flare on the side the rock passed, gap in pixels.
      if (isRock(o.kind) && o.touched && !o.missCredited) {
        const gap = d - sr - o.r
        if (gap < o.minGap) o.minGap = gap
        const receding = d > o.lastDist
        if (receding && o.minGap < NM.maxGap && o.minGap > 0 && Math.hypot(o.vx, o.vy) > NM.minApproachSpeed) {
          o.missCredited = true
          emit('nearMiss', { x: o.x, y: o.y, gap: Math.round(o.minGap), angle: Math.atan2(dy, dx) })
        }
      }
      o.lastDist = d

      if (o.x < -margin || o.x > this.width + margin || o.y < -margin || o.y > this.height + margin) {
        if (isRock(o.kind) && o.touched && o.kind !== CHIP) {
          game.score += TUNING.score.deflect
          emit('deflect', {
            x: Math.max(24, Math.min(this.width - 24, o.x)),
            y: Math.max(56, Math.min(this.height - 32, o.y))
          })
        }
        pool.kill(i)
      }
    }
  }

  private bank(angle: number): void {
    const st = this.station
    const R = TUNING.reservoir
    const doubled = st.reservoirFull()
    const gain = TUNING.score.bank * (doubled ? 2 : 1)
    game.score += gain
    game.oreTotal += R.unitsPerBank
    const wasFull = st.reservoirFull()
    st.reservoir = Math.min(st.reservoirCap, st.reservoir + R.unitsPerBank)
    emit('bank', { x: st.x, y: st.y, score: gain, doubled })
    if (!wasFull && st.reservoirFull()) emit('reservoirFull', undefined)
  }

  private hullHit(angle: number): void {
    const st = this.station
    const sectionsBefore = st.sections
    const sec = st.damage(angle)
    if (sec < 0) return
    const spilled = Math.round(st.reservoir * TUNING.reservoir.spillFraction)
    st.reservoir -= spilled
    this.hitStop(TUNING.hullHit.hitStop)
    const alive = st.aliveCount()
    this.hullCritical = alive === 1
    emit('hullHit', { sectionsBefore, alive, x: st.x, y: st.y, angle })
    if (spilled > 0) emit('oreSpill', { amount: spilled })
    if (alive <= 0) {
      game.pendingCollapse = true
      beginCollapse()
    }
  }
}

export type { GameObject }
