// Juice orchestrator — subscribes to sim events and keeps small pooled
// stores of transient visuals for the renderer: shock rings (the smash),
// hull-hit flicker/tear clocks, ore-spill chips, near-miss flares, gain
// floats, ship tracers live on the ships themselves. Runs on real frame time.

import { TUNING } from '../config'
import { on } from '../events'
import { PAL } from '../render/palette'
import { settings } from '../storage'

const TAU = Math.PI * 2

export interface ShockRing {
  x: number
  y: number
  t: number
}

export interface SpillChip {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  rs: number
  t: number
  life: number
}

export interface GainFloat {
  x: number
  y: number
  text: string
  color: string
  glow: boolean
  t: number
}

export interface Flare {
  angle: number
  gap: number
  t: number
}

export interface HullFxProfile {
  dips: number[]
  tear: number
  shake: number
  duration: number
}

export const fx = {
  shake: 0,
  shocks: [] as ShockRing[],
  chips: [] as SpillChip[],
  floats: [] as GainFloat[],
  flares: [] as Flare[],
  /** Bank pulse on the core (ph-bank ring). */
  bankT: -1,
  /** Crumble ring (rubble coming apart) — quieter than a smash. */
  crumbles: [] as ShockRing[],
  /** Hull-hit flicker/tear clock; null when quiet. */
  hull: null as { t: number; profile: HullFxProfile } | null
}

function motion(v: number): number {
  return settings.reduceMotion ? v * 0.3 : v
}

export function initFx(): void {
  on('runStart', clearFx)

  on('smash', e => {
    fx.shocks.push({ x: e.x, y: e.y, t: 0 })
    if (fx.shocks.length > 6) fx.shocks.shift()
    fx.shake = Math.max(fx.shake, motion(TUNING.smash.shakeMain))
    if (e.bothRocks) {
      spawnFloat(e.x, e.y - 30, '+' + TUNING.score.smash, PAL.ink, false)
    } else {
      // ore lost — deliberately no glow
      spawnFloat(e.x, e.y - 30, 'ORE LOST', PAL.oreDead, false)
    }
  })

  on('crumble', e => {
    fx.crumbles.push({ x: e.x, y: e.y, t: 0 })
    if (fx.crumbles.length > 4) fx.crumbles.shift()
  })

  on('bank', e => {
    fx.bankT = 0
    spawnFloat(e.x, e.y - 74, '+' + e.score, PAL.ore, true)
  })

  on('deflect', e => {
    spawnFloat(e.x, e.y, '+' + TUNING.score.deflect, PAL.rock, false)
  })

  on('nearMiss', e => {
    fx.flares.push({ angle: e.angle, gap: e.gap, t: 0 })
    if (fx.flares.length > 3) fx.flares.shift()
  })

  on('hullHit', e => {
    // Depth scales with resolution; one section left snaps to full alarm.
    const table = TUNING.hullHit.flicker
    const key = Math.min(6, Math.max(3, e.sectionsBefore))
    const profile = e.alive <= 1 ? table[3] : table[key]
    fx.hull = { t: 0, profile }
    fx.shake = Math.max(fx.shake, motion(profile.shake))
  })

  on('oreSpill', () => {
    const n = TUNING.hullHit.spillChips
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4
      const sp = 90 + Math.random() * 120
      fx.chips.push({
        x: 0, y: 0, // renderer offsets from the station
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        rot: Math.random() * TAU,
        rs: (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 10),
        t: 0,
        life: 0.7 + Math.random() * 0.25
      })
    }
    if (fx.chips.length > 12) fx.chips.splice(0, fx.chips.length - 12)
  })
}

export function clearFx(): void {
  fx.shake = 0
  fx.shocks.length = 0
  fx.chips.length = 0
  fx.floats.length = 0
  fx.flares.length = 0
  fx.crumbles.length = 0
  fx.bankT = -1
  fx.hull = null
}

export function spawnFloat(x: number, y: number, text: string, color: string, glow: boolean): void {
  fx.floats.push({ x, y, text, color, glow, t: 0 })
  if (fx.floats.length > TUNING.fx.maxFloats) fx.floats.shift()
}

export function updateFx(dt: number): void {
  fx.shake = Math.max(0, fx.shake - dt * TUNING.fx.shakeDecay)
  if (fx.bankT >= 0) {
    fx.bankT += dt
    if (fx.bankT > 0.45) fx.bankT = -1
  }
  for (let i = fx.shocks.length - 1; i >= 0; i--) {
    fx.shocks[i].t += dt
    if (fx.shocks[i].t > 0.45) fx.shocks.splice(i, 1)
  }
  for (let i = fx.crumbles.length - 1; i >= 0; i--) {
    fx.crumbles[i].t += dt
    if (fx.crumbles[i].t > 0.3) fx.crumbles.splice(i, 1)
  }
  for (let i = fx.chips.length - 1; i >= 0; i--) {
    const c = fx.chips[i]
    c.t += dt
    c.x += c.vx * dt
    c.y += c.vy * dt
    c.rot += c.rs * dt
    if (c.t > c.life) fx.chips.splice(i, 1)
  }
  for (let i = fx.floats.length - 1; i >= 0; i--) {
    fx.floats[i].t += dt
    if (fx.floats[i].t > TUNING.fx.floatLife) fx.floats.splice(i, 1)
  }
  for (let i = fx.flares.length - 1; i >= 0; i--) {
    fx.flares[i].t += dt
    if (fx.flares[i].t > TUNING.nearMiss.flareDuration) fx.flares.splice(i, 1)
  }
  if (fx.hull) {
    fx.hull.t += dt
    if (fx.hull.t > fx.hull.profile.duration) fx.hull = null
  }
}

/** Station draw alpha during a hull-hit flicker (1 when quiet). */
export function hullFlickerAlpha(): number {
  const h = fx.hull
  if (!h) return 1
  const f = h.t / h.profile.duration
  const dips = h.profile.dips
  // dropouts land as hard steps across the event: dip, recover, dip, recover…
  const seg = f * (dips.length * 2)
  const idx = Math.floor(seg)
  if (idx >= dips.length * 2) return 1
  if (idx % 2 === 0) {
    const a = dips[idx / 2]
    return settings.reduceMotion ? Math.max(0.45, a) : a
  }
  return 1
}

/** Current tear offset in px (0 when quiet). */
export function hullTearOffset(): number {
  const h = fx.hull
  if (!h) return 0
  const f = h.t / h.profile.duration
  if (f > 0.85) return 0
  return motion(h.profile.tear)
}
