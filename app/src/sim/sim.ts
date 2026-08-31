// Fixed-timestep simulation (120Hz, interpolated render). Well physics and
// the smash rule are a 1:1 port of prototype/pull.html; on top of it sit the
// kit systems: the rock ladder (monolith → medium → shard → chip), rubble
// crumbling on a graze, the reservoir, hull sections, the shield, near-misses
// and hit-stop. Behavior changes belong in config.ts.

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
  /** F10 — coalesced sub-frame samples (world units, oldest first). Input
   *  pushes, the sim drains once per frame; x/y above stay the newest. */
  path?: { x: number; y: number }[]
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
  /** F10 — scratch pointer handed to step(); walks the coalesced path. */
  private stepPointer: PointerState = { active: false, x: 0, y: 0 }
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
    // F10 — take this frame's coalesced finger path. Drained even when the
    // frame ends up frozen: the world can stop, the finger never does (F3),
    // and a stale path must not replay after the thaw.
    const path = pointer.path && pointer.path.length > 0 ? pointer.path.splice(0) : null
    if (this.freezeT > 0) {
      this.freezeT -= scaledDt
      if (this.freezeT > 0) return
      scaledDt = -this.freezeT // spend the remainder stepping
      this.freezeT = 0
      if (scaledDt <= 0) return
    }
    const dt = TUNING.sim.dt
    this.accumulator += Math.min(scaledDt, TUNING.sim.maxFrameDt)
    const planned = Math.min(Math.floor(this.accumulator / dt), TUNING.sim.maxStepsPerFrame)
    let steps = 0
    while (this.accumulator >= dt && steps < TUNING.sim.maxStepsPerFrame) {
      // F10 — each step reads the sample nearest its slice of the frame, so
      // a fast swipe pulls along its true arc instead of one chord per frame.
      const sp = this.stepPointer
      sp.active = pointer.active
      if (path && planned > 0) {
        const idx = Math.floor(((steps + 1) * path.length) / planned) - 1
        const s = path[idx < 0 ? 0 : idx]
        sp.x = s.x
        sp.y = s.y
      } else {
        sp.x = pointer.x
        sp.y = pointer.y
      }
      this.step(dt, sp, spawning)
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
    // Binary on/off, full strength the frame you touch (the pre-review
    // phosphor feel — the F1 envelope was reverted by playtest ruling).
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

    // --- shield recharge ---
    if (interact && st.shieldLevel > 0 && st.shieldDownT > 0) {
      st.shieldDownT -= dt
      if (st.shieldDownT <= 0) {
        st.shieldDownT = 0
        emit('shieldReady', undefined)
      }
    }

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
      this.hitStop(TUNING.hitStop)
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
      f.frag = true // a broken piece — the shield's whole jurisdiction
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

  // -------------------------------------------------------------------------

  private stationAndBounds(): void {
    const pool = this.pool
    const objs = pool.objs
    const st = this.station
    const sr = TUNING.station.radius
    const margin = TUNING.objects.offscreenMargin
    const NM = TUNING.nearMiss

    let shieldOn = st.shieldArmed()
    const shR = TUNING.shield.radius

    for (let i = pool.count - 1; i >= 0; i--) {
      const o = objs[i]
      const dx = o.x - st.x
      const dy = o.y - st.y
      const d = Math.hypot(dx, dy)

      // The shield: one broken piece, caught at the ring. Whole rocks and
      // ore pass straight through; outbound shrapnel never wastes the charge.
      if (shieldOn && o.frag && isRock(o.kind) && d < o.r + shR && dx * o.vx + dy * o.vy < 0) {
        shieldOn = false // one charge — the next piece this frame gets through
        st.shieldDownT = st.shieldRechargeTime()
        const gold = st.shieldLevel >= TUNING.shield.maxLevel ? TUNING.shield.goldPerBlock : 0
        if (gold > 0) {
          game.oreTotal += gold
          const wasFull = st.reservoirFull()
          st.reservoir = Math.min(st.reservoirCap, st.reservoir + gold)
          if (!wasFull && st.reservoirFull()) emit('reservoirFull', undefined)
        }
        emit('shieldBlock', { x: o.x, y: o.y, angle: Math.atan2(dy, dx), gold })
        pool.kill(i)
        continue
      }

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
      // M1 — it pays now.
      if (isRock(o.kind) && o.touched && !o.missCredited) {
        const gap = d - sr - o.r
        if (gap < o.minGap) o.minGap = gap
        const receding = d > o.lastDist
        if (receding && o.minGap < NM.maxGap && o.minGap > 0 && Math.hypot(o.vx, o.vy) > NM.minApproachSpeed) {
          o.missCredited = true
          game.score += TUNING.score.nearMiss
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
    emit('bank', { x: st.x, y: st.y, score: gain, doubled })
    if (!wasFull && st.reservoirFull()) emit('reservoirFull', undefined)
  }

  private hullHit(angle: number): void {
    const st = this.station
    const sectionsBefore = st.sections
    const sec = st.damage(angle)
    if (sec < 0) return
    // A hit always costs the same flat slice of the ore (capacity's spill
    // buy-down left with the CAPACITY track, 2026-08-30).
    const spilled = Math.round(st.reservoir * TUNING.reservoir.spillFrac)
    st.reservoir -= spilled
    this.hitStop(TUNING.hitStop)
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
