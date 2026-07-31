// Fixed-timestep simulation (120Hz, interpolated render). Physics constants
// and interaction rules are a 1:1 port of prototype/pull.html — that file is
// the tuning baseline; behavior changes belong in config.ts.

import { TUNING } from '../config'
import { emit } from '../events'
import type { RNG } from '../rng'
import { game, beginDeath } from '../state'
import { ObjectPool, ROCK, ORE, pushTrailPoint, type GameObject } from './pool'
import { UniformGrid } from './grid'
import { Spawner } from './spawner'

export interface PointerState {
  active: boolean
  x: number
  y: number
}

export class Sim {
  pool: ObjectPool
  spawner = new Spawner()
  grid = new UniformGrid()
  rng: RNG

  width = 1
  height = 1
  stationX = 0
  stationY = 0

  /** Interpolation factor for the renderer, updated every frame(). */
  alpha = 0
  /** Sim steps executed last frame (debug overlay). */
  stepsLastFrame = 0

  private accumulator = 0
  private stepCounter = 0

  constructor(rng: RNG) {
    this.rng = rng
    this.pool = new ObjectPool(TUNING.objects.maxCount)
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.stationX = width * TUNING.station.xFrac
    this.stationY = height * TUNING.station.yFrac
    this.grid.resize(width, height, TUNING.collision.gridCell, TUNING.objects.maxCount)
  }

  reset(): void {
    this.pool.clear()
    this.spawner.reset()
    this.accumulator = 0
    this.stepCounter = 0
  }

  /**
   * Advance the sim by a (possibly time-scaled) frame delta.
   * Steps at the fixed dt; leftover time becomes the interpolation alpha.
   */
  frame(scaledDt: number, pointer: PointerState): void {
    const dt = TUNING.sim.dt
    this.accumulator += Math.min(scaledDt, TUNING.sim.maxFrameDt)
    let steps = 0
    while (this.accumulator >= dt && steps < TUNING.sim.maxStepsPerFrame) {
      this.step(dt, pointer)
      this.accumulator -= dt
      steps++
    }
    // Spiral-of-death guard: if we hit the step cap, drop the remainder.
    if (this.accumulator >= dt) this.accumulator = this.accumulator % dt
    this.alpha = this.accumulator / dt
    this.stepsLastFrame = steps
  }

  private step(dt: number, pointer: PointerState): void {
    const pool = this.pool
    const objs = pool.objs

    if (game.phase === 'play') {
      game.time += dt
      this.spawner.update(dt, game.time, pool, this.rng, this.width, this.height, this.stationX, this.stationY)
    }

    // --- gravity well + integration ---
    const wellOn = pointer.active && (game.phase === 'play' || game.phase === 'dying')
    const strength = TUNING.well.strength
    const softening = TUNING.well.softening
    const maxA = TUNING.well.maxAccel
    const touchA = TUNING.well.touchAccel
    this.stepCounter++
    const pushTrail = this.stepCounter % TUNING.trail.pushEvery === 0

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
      if (pushTrail) pushTrailPoint(o, TUNING.trail.length)
    }

    // --- object-object collisions via uniform grid ---
    this.grid.build(objs, pool.count)
    this.grid.forEachPair(objs, pool.count, this.pairHandler)

    // Sweep objects marked dead by smashes (backwards + swap-remove is safe)
    for (let i = pool.count - 1; i >= 0; i--) {
      if (objs[i].dead) pool.kill(i)
    }

    // --- station interactions + offscreen culling ---
    if (game.phase === 'play') this.stationAndBounds()
    else this.boundsOnly()
  }

  // Bound method so forEachPair gets a stable reference (no per-step closure).
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
    if (rel > TUNING.collision.smashSpeed) {
      // Hard smash: both destroyed
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const bothRocks = a.type === ROCK && b.type === ROCK
      if (bothRocks) game.score += TUNING.score.smash
      a.dead = true
      b.dead = true
      emit('smash', { x: mx, y: my, bothRocks })
    } else {
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

  private stationAndBounds(): void {
    const pool = this.pool
    const objs = pool.objs
    const sx = this.stationX
    const sy = this.stationY
    const sr = TUNING.station.radius
    const margin = TUNING.objects.offscreenMargin

    for (let i = pool.count - 1; i >= 0; i--) {
      const o = objs[i]
      const d = Math.hypot(o.x - sx, o.y - sy)
      if (d < o.r + sr) {
        if (o.type === ORE) {
          game.score += TUNING.score.bank
          emit('bank', { x: sx, y: sy, score: TUNING.score.bank })
        } else {
          game.hull--
          emit('hullHit', { hull: game.hull, x: sx, y: sy })
          if (game.hull <= 0) {
            pool.kill(i)
            beginDeath()
            return
          }
        }
        pool.kill(i)
        continue
      }
      if (o.x < -margin || o.x > this.width + margin || o.y < -margin || o.y > this.height + margin) {
        if (o.type === ROCK && o.touched) {
          game.score += TUNING.score.deflect
          emit('deflect', {
            x: Math.max(20, Math.min(this.width - 20, o.x)),
            y: Math.max(30, Math.min(this.height - 30, o.y))
          })
        }
        pool.kill(i)
      }
    }
  }

  private boundsOnly(): void {
    const pool = this.pool
    const objs = pool.objs
    const margin = TUNING.objects.offscreenMargin
    for (let i = pool.count - 1; i >= 0; i--) {
      const o = objs[i]
      if (o.x < -margin || o.x > this.width + margin || o.y < -margin || o.y > this.height + margin) {
        pool.kill(i)
      }
    }
  }
}

export type { GameObject }
