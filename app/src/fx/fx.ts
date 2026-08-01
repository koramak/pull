// Juice orchestrator — subscribes to sim events and keeps small pooled
// stores of transient visuals for the renderer: shock rings (the smash),
// hull-hit flicker/tear clocks, ore-spill chips, near-miss flares, gain
// floats, ship tracers live on the ships themselves. Runs on real frame time.
//
// F4 — screen shake is a trauma system: events add trauma 0..1, amplitude is
// trauma², and the offsets come from smooth coherent noise (plus a little
// roll), so overlapping hits compound honestly instead of restarting a
// canned shake.

import { TUNING } from '../config'
import { on } from '../events'
import { PAL } from '../render/palette'
import { settings, loadFullHintCount, markFullHintShown } from '../storage'

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
  trauma: number
  duration: number
}

export const fx = {
  /** Accumulated shake energy 0..1; amplitude goes as trauma². */
  trauma: 0,
  /** Per-frame shake outputs the renderer applies (world px / radians). */
  shakeX: 0,
  shakeY: 0,
  shakeRoll: 0,
  shocks: [] as ShockRing[],
  chips: [] as SpillChip[],
  floats: [] as GainFloat[],
  flares: [] as Flare[],
  /** Bank pulse on the core (ph-bank ring). */
  bankT: -1,
  /** Crumble ring (rubble coming apart) — quieter than a smash. */
  crumbles: [] as ShockRing[],
  /** Hull-hit flicker/tear clock; null when quiet. */
  hull: null as { t: number; profile: HullFxProfile } | null,
  /** M2 — one-line teach under the station while the reservoir is full. */
  hint: null as { text: string; t: number; dur: number } | null,
  /** M8 — live vein: which edge is warm, and for how long. */
  vein: null as { side: number; t: number; dur: number } | null,
  /** N4 — clear-pulse ring clock (-1 idle). */
  clearT: -1
}

let noiseT = 0

function motion(v: number): number {
  return settings.reduceMotion ? v * 0.3 : v
}

/** F4 — add shake energy for an event; compounds and caps at 1. */
export function addTrauma(v: number): void {
  fx.trauma = Math.min(1, fx.trauma + motion(v))
}

export function initFx(): void {
  on('runStart', clearFx)

  on('smash', e => {
    fx.shocks.push({ x: e.x, y: e.y, t: 0 })
    if (fx.shocks.length > 6) fx.shocks.shift()
    addTrauma(e.nearStation ? TUNING.trauma.smashNear : TUNING.trauma.smash)
    if (e.bothRocks) {
      // M1 — the float carries the real pay; chains earn the glow
      spawnFloat(e.x, e.y - 30, '+' + e.value, e.chain > 0 ? PAL.white : PAL.ink, e.chain > 0)
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
    addTrauma(TUNING.trauma.bank)
    // M2 — the ×2 state must read as a wager being won
    spawnFloat(e.x, e.y - 74, e.doubled ? `+${e.score} ×2` : '+' + e.score, PAL.ore, true)
  })

  on('reservoirFull', () => {
    // M2 — teach the wager the first two times, then trust the player
    const shown = loadFullHintCount()
    if (shown < TUNING.hints.fullShows) {
      fx.hint = { text: 'RESERVOIR FULL — BANKS ×2 — RELEASE TO UPGRADE', t: 0, dur: TUNING.hints.fullDuration }
      markFullHintShown()
    }
  })

  on('deflect', e => {
    spawnFloat(e.x, e.y, '+' + e.value, PAL.rock, false)
  })

  on('nearMiss', e => {
    fx.flares.push({ angle: e.angle, gap: e.gap, t: 0 })
    if (fx.flares.length > 3) fx.flares.shift()
    // M1 — the close call pays, and says so where it happened
    spawnFloat(e.x, e.y, '+' + TUNING.score.nearMiss, PAL.rockLit, false)
  })

  // M8 — the vein: edge shimmer + a one-line announcement
  on('vein', e => {
    fx.vein = { side: e.side, t: 0, dur: TUNING.vein.shimmerDur }
  })

  // N4 — the clear pulse's expanding ring
  on('clearPulse', () => {
    fx.clearT = 0
  })

  on('hullHit', e => {
    // Depth scales with resolution; one section left snaps to full alarm.
    const table = TUNING.hullHit.flicker
    const key = Math.min(6, Math.max(3, e.sectionsBefore))
    const profile = e.alive <= 1 ? table[3] : table[key]
    fx.hull = { t: 0, profile }
    addTrauma(profile.trauma)
  })

  on('surge', () => addTrauma(TUNING.trauma.surge))
  on('collapse', () => addTrauma(TUNING.trauma.collapse))

  on('oreSpill', e => {
    // M2 — the spill is a visible cost, not a silent leak
    spawnFloat(e.x, e.y - 104, `-${e.amount} ORE`, PAL.oreDead, false)
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
  fx.trauma = 0
  fx.shakeX = 0
  fx.shakeY = 0
  fx.shakeRoll = 0
  fx.shocks.length = 0
  fx.chips.length = 0
  fx.floats.length = 0
  fx.flares.length = 0
  fx.crumbles.length = 0
  fx.bankT = -1
  fx.hull = null
  fx.hint = null
  fx.vein = null
  fx.clearT = -1
}

export function spawnFloat(x: number, y: number, text: string, color: string, glow: boolean): void {
  fx.floats.push({ x, y, text, color, glow, t: 0 })
  if (fx.floats.length > TUNING.fx.maxFloats) fx.floats.shift()
}

/** Smooth coherent noise in [-1, 1] — summed sines, cheap and frame-stable. */
function noise(t: number, f: number, p1: number, p2: number): number {
  return (Math.sin(t * f) + 0.5 * Math.sin(t * f * 1.83 + p1) + 0.25 * Math.sin(t * f * 3.11 + p2)) / 1.75
}

export function updateFx(dt: number): void {
  // trauma shake — linear decay, squared response, coherent noise + roll
  noiseT += dt
  fx.trauma = Math.max(0, fx.trauma - dt * TUNING.trauma.decayPerSec)
  const amp = fx.trauma * fx.trauma
  if (amp > 0.0004) {
    const T = TUNING.trauma
    fx.shakeX = noise(noiseT, 67.3, 1.7, 4.1) * amp * T.maxOffset
    fx.shakeY = noise(noiseT, 59.9, 3.9, 1.3) * amp * T.maxOffset
    fx.shakeRoll = noise(noiseT, 31.7, 2.6, 5.2) * amp * T.maxRoll
  } else {
    fx.shakeX = 0
    fx.shakeY = 0
    fx.shakeRoll = 0
  }

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
  if (fx.hint) {
    fx.hint.t += dt
    if (fx.hint.t > fx.hint.dur) fx.hint = null
  }
  if (fx.vein) {
    fx.vein.t += dt
    if (fx.vein.t > fx.vein.dur) fx.vein = null
  }
  if (fx.clearT >= 0) {
    fx.clearT += dt
    if (fx.clearT > TUNING.clearPulse.ringDur) fx.clearT = -1
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
    return settings.reduceMotion ? Math.max(0.55, a) : a
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
