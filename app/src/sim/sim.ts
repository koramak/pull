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
  /** F1 — well strength envelope 0..1: attack on touch, release-decay on lift. */
  wellPower = 0
  /** F5/M5 — remaining slow-motion (real seconds) and its time scale. */
  slowmoT = 0
  slowmoScale = 1

  private accumulator = 0
  private stepCounter = 0
  private diff: DifficultySample = { spawnInterval: 1.7, speedBonus: 0, oreChance: 0.32, monolithChance: 0.1 }
  // M1 — smash chain bookkeeping (game.time based)
  private chainN = 0
  private lastSmashAt = -1e9
  // M8 — vein state: -1 idle, else countdown to the next beat
  private veinTimer = 0
  private veinArmed = false
  private veinSide = 0
  private veinLeft = 0
  private veinDrip = 0

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
    this.wellPower = 0
    this.slowmoT = 0
    this.slowmoScale = 1
    this.chainN = 0
    this.lastSmashAt = -1e9
    this.veinTimer = TUNING.vein.firstAt
    this.veinArmed = false
    this.veinLeft = 0
    this.veinDrip = 0
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
    // F5/M5 — the slow-motion beat: the world runs slow for a moment, the
    // finger stays live. Consumed in real seconds, applied to sim seconds.
    if (this.slowmoT > 0) {
      this.slowmoT -= scaledDt
      scaledDt *= this.slowmoScale
    }
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
      this.updateVein(dt)
    }

    // --- gravity well + integration ---
    // F1 — the grab: strength envelope ramps in with ease-out on touch and
    // decays after release, so the force feels physical and a thumb slip
    // mid-slingshot keeps the curve alive for a beat.
    const W = TUNING.well
    if (pointer.active) this.wellPower = Math.min(1, this.wellPower + dt / W.attack)
    else this.wellPower = Math.max(0, this.wellPower - dt / W.release)
    const p = this.wellPower
    const envelope = 1 - (1 - p) * (1 - p) // smooth-stop: fast start, soft landing
    const wellOn = envelope > 0.002
    const strength = W.strength
    const softening = W.softening
    const maxA = W.maxAccel
    const touchA = W.touchAccel
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
        a *= envelope
        o.vx += (dx / d) * a * dt
        o.vy += (dy / d) * a * dt
        if (a > touchA) o.touched = true
      }
      o.x += o.vx * dt
      o.y += o.vy * dt
      o.rot += o.rs * dt
      if (o.hitFlash > 0) o.hitFlash -= dt
      if (o.squashT > 0) o.squashT -= dt
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
      // The smash: tiered hit-stop, two thin white rings, the pair is
      // replaced by the next class down, shards spinning out hard.
      // M1 — chains double the pay (10 → 20 → 40 → 80) and smashing close
      // to the hull pays double again: greed is voluntary, and it's the
      // best-paying play in the game.
      const bothRocks = isRock(a.kind) && isRock(b.kind)
      const S = TUNING.score
      const sdx = mx - this.station.x
      const sdy = my - this.station.y
      const nearTrauma = sdx * sdx + sdy * sdy < TUNING.trauma.smashNearRadius * TUNING.trauma.smashNearRadius
      let value = 0
      let chain = 0
      let risky = false
      if (bothRocks) {
        if (game.time - this.lastSmashAt <= S.chainWindow) this.chainN = Math.min(this.chainN + 1, S.chainCap)
        else this.chainN = 0
        this.lastSmashAt = game.time
        chain = this.chainN
        value = S.smash << chain
        const gap = Math.hypot(sdx, sdy) - TUNING.station.radius
        risky = gap < S.dangerRing
        if (risky) value *= S.riskMult
        game.score += value
        game.smashes++
      }
      this.fragment(a)
      this.fragment(b)
      a.dead = true
      b.dead = true
      this.hitStop(TUNING.hitStops.smash)
      emit('smash', { x: mx, y: my, bothRocks, nearStation: nearTrauma, value, chain, risky })
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
      // F2 — contact reads as material: both parties squash for a beat
      a.squashT = TUNING.feel.squashDur
      b.squashT = TUNING.feel.squashDur
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

  /** M8 — the ore vein: announced at an edge, then ~5 ore drift in over
   *  ~10s. Anticipation is the point. */
  private updateVein(dt: number): void {
    const V = TUNING.vein
    if (this.veinLeft > 0) {
      // delivering
      this.veinDrip -= dt
      if (this.veinDrip <= 0) {
        this.spawner.spawnKind(ORE, this.pool, this.rng, this.width, this.height, this.station.x, this.station.y, {
          side: this.veinSide,
          speed: V.speed * (0.85 + this.rng.next() * 0.3),
          spread: V.spread
        })
        this.veinLeft--
        this.veinDrip = V.over / V.count
      }
      return
    }
    this.veinTimer -= dt
    if (!this.veinArmed) {
      if (this.veinTimer <= 0) {
        // announce, then deliver after the warn beat
        this.veinArmed = true
        this.veinSide = Math.floor(this.rng.next() * 4)
        this.veinTimer = V.warn
        emit('vein', { side: this.veinSide })
      }
    } else if (this.veinTimer <= 0) {
      this.veinArmed = false
      this.veinLeft = V.count
      this.veinDrip = 0
      this.veinTimer = V.every + (this.rng.next() * 2 - 1) * V.jitter
    }
  }

  /** N4 — the post-upgrade shockwave: everything is shoved offscreen, with
   *  no deflection credit — the break itself is the reward. */
  clearPulse(): void {
    const st = this.station
    const speed = TUNING.clearPulse.speed
    for (let i = 0; i < this.pool.count; i++) {
      const o = this.pool.objs[i]
      const dx = o.x - st.x
      const dy = o.y - st.y
      const d = Math.hypot(dx, dy) || 1
      o.vx = (dx / d) * speed
      o.vy = (dy / d) * speed
      o.touched = false
      o.missCredited = true // no near-miss credit on the way out either
    }
    emit('clearPulse', undefined)
  }

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
        // N3 — shots act: real damage (a medium breaks outright) plus a
        // shove along the tracer, so even a surviving rock is visibly hit.
        target.hp -= S.damage
        target.hitFlash = S.hitFlash
        target.wounded = true
        const kdx = target.x - ship.x
        const kdy = target.y - ship.y
        const kd = Math.hypot(kdx, kdy) || 1
        target.vx += (kdx / kd) * S.knockback
        target.vy += (kdy / kd) * S.knockback
        target.squashT = TUNING.feel.squashDur
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

  /** Nearest cool rock on a collision course with the station, in range —
   *  or, failing that, a wounded rock: the knockback of the first shot tends
   *  to shove targets off course, and ships finish what they start (N3). */
  private findThreat(fromX: number, fromY: number): GameObject | null {
    const S = TUNING.ships
    let best: GameObject | null = null
    let bestD: number = S.range
    let wounded: GameObject | null = null
    let woundedD: number = S.range
    for (let i = 0; i < this.pool.count; i++) {
      const o = this.pool.objs[i]
      if (!isRock(o.kind) || o.dead) continue
      const dx = o.x - fromX
      const dy = o.y - fromY
      const d = Math.hypot(dx, dy)
      if (d >= bestD && d >= woundedD) continue
      if (this.onCollisionCourse(o)) {
        if (d < bestD) { best = o; bestD = d }
      } else if (o.wounded && d < woundedD) {
        wounded = o
        woundedD = d
      }
    }
    return best ?? wounded
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
      // M1 — it pays now; M5 — at one section a save this close earns a
      // slow-motion beat (no text — the time itself carries it).
      if (isRock(o.kind) && o.touched && !o.missCredited) {
        const gap = d - sr - o.r
        if (gap < o.minGap) o.minGap = gap
        const receding = d > o.lastDist
        if (receding && o.minGap < NM.maxGap && o.minGap > 0 && Math.hypot(o.vx, o.vy) > NM.minApproachSpeed) {
          o.missCredited = true
          game.score += TUNING.score.nearMiss
          // F5 — time is a feel currency: every close call bends it a little,
          // and a clutch save at one section bends it hard (M5)
          if (this.hullCritical) {
            this.slowmoT = TUNING.critical.clutchSlowmo
            this.slowmoScale = TUNING.critical.clutchScale
          } else if (this.slowmoT <= 0) {
            this.slowmoT = NM.slowmoDur
            this.slowmoScale = NM.slowmoScale
          }
          emit('nearMiss', { x: o.x, y: o.y, gap: Math.round(o.minGap), angle: Math.atan2(dy, dx) })
        }
      }
      o.lastDist = d

      if (o.x < -margin || o.x > this.width + margin || o.y < -margin || o.y > this.height + margin) {
        if (isRock(o.kind) && o.touched && o.kind !== CHIP) {
          // M1 — a deflection that skimmed the hull pays double
          const risky = o.minGap < TUNING.score.dangerRing
          const value = TUNING.score.deflect * (risky ? TUNING.score.riskMult : 1)
          game.score += value
          emit('deflect', {
            x: Math.max(24, Math.min(this.width - 24, o.x)),
            y: Math.max(56, Math.min(this.height - 32, o.y)),
            value
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
    this.hitStop(TUNING.hitStops.bank) // F3 — a beat of weight on the swallow
    emit('bank', { x: st.x, y: st.y, score: gain, doubled })
    if (!wasFull && st.reservoirFull()) emit('reservoirFull', undefined)
  }

  private hullHit(angle: number): void {
    const st = this.station
    const sectionsBefore = st.sections
    const sec = st.damage(angle)
    if (sec < 0) return
    // M4 — capacity is armor for your gold: each purchase buys the spill down
    const spillTable = TUNING.reservoir.spillByCapacity
    const spillFrac = spillTable[Math.min(st.capacity, spillTable.length - 1)]
    const spilled = Math.round(st.reservoir * spillFrac)
    st.reservoir -= spilled
    // F3 — your worst event stops the world hardest. On the killing hit the
    // freeze bleeds into the collapse timescale (×0.3) → ~400ms real stop.
    this.hitStop(TUNING.hitStops.hull)
    const alive = st.aliveCount()
    this.hullCritical = alive === 1
    emit('hullHit', { sectionsBefore, alive, x: st.x, y: st.y, angle })
    if (spilled > 0) emit('oreSpill', { amount: spilled, x: st.x, y: st.y })
    if (alive <= 0) {
      game.pendingCollapse = true
      beginCollapse()
    }
  }
}

export type { GameObject }
