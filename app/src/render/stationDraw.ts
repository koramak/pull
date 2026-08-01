// The station, drawn. Structure (section arcs, boundary flares, capacity
// rails + cross-ties, the stage-4 tooth comb) renders into an offscreen
// buffer and re-bakes only when the build changes — it is blitted every
// other frame. The core (reservoir, pulse, bank flash) is a handful of live
// strokes. Collision is r44 at every stage; everything here is drawing.

import { TUNING } from '../config'
import { SeededRNG } from '../rng'
import type { Station } from '../sim/station'
import { PAL, rgba } from './palette'

const TAU = Math.PI * 2

export class StationDraw {
  private buffer: HTMLCanvasElement | null = null
  private half = 0
  private rev = -1
  private px = 0
  /** Reservoir level the player sees — eases toward the sim value. */
  displayFill = 0

  /** New run: the displayed reservoir must not carry over from the last one
   *  (it eased toward the live value but was never reset — the "gold starts
   *  full" bug). */
  resetRun(): void {
    this.displayFill = 0
  }

  /** Blit the pre-rendered structure centred on the station. */
  drawStructure(ctx: CanvasRenderingContext2D, st: Station, px: number, alpha: number): void {
    if (!this.buffer || this.rev !== st.structureRev || Math.abs(px - this.px) > 0.01) {
      this.bake(st, px)
    }
    if (!this.buffer) return
    if (alpha <= 0.002) return
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.drawImage(this.buffer, st.x - this.half, st.y - this.half, this.half * 2, this.half * 2)
    ctx.restore()
  }

  /** Core ring + reservoir + full pulse + bank flash. Live, few strokes. */
  drawCore(
    ctx: CanvasRenderingContext2D,
    st: Station,
    t: number,
    dt: number,
    bankT: number,
    alpha: number,
    bloomMul: number
  ): void {
    // F2/F9 — the gulp: the core ring squeezes for a beat as it swallows
    const G = TUNING.feel
    let coreScale = 1
    if (bankT >= 0 && bankT < G.gulpDur) {
      const q = bankT / G.gulpDur
      coreScale = 1 - G.gulpAmt * Math.sin(q * Math.PI)
    }
    const R = TUNING.station.coreRadius * coreScale // 18 at rest
    const fillR = 16
    const target = st.fillFrac()
    this.displayFill += (target - this.displayFill) * Math.min(1, dt * (target < this.displayFill ? 10 : 6))
    const frac = this.displayFill
    const full = st.reservoirFull()

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(st.x, st.y)

    // reservoir — warm light fills the core from the bottom up, stepped gold
    if (frac > 0.005) {
      const color = frac < 1 / 3 ? PAL.oreRamp1 : frac < 2 / 3 ? PAL.oreRamp2 : PAL.oreRamp3
      const h = fillR * 2 * frac
      ctx.save()
      ctx.beginPath()
      ctx.arc(0, 0, fillR, 0, TAU)
      ctx.clip()
      ctx.shadowColor = rgba(color, 0.8)
      ctx.shadowBlur = (full ? 12 : 6) * bloomMul
      ctx.fillStyle = rgba(color, 0.7)
      ctx.fillRect(-fillR, fillR - h, fillR * 2, h)
      ctx.shadowBlur = 0
      ctx.fillStyle = rgba(PAL.oreFacet, 0.9)
      ctx.fillRect(-fillR, fillR - h, fillR * 2, 1.6)
      ctx.restore()
    }

    // core ring — 3.4, white-teal; the outline turns warm at full (the ×2 cue)
    ctx.strokeStyle = full ? PAL.ore : PAL.core
    ctx.lineWidth = 3.4
    ctx.shadowColor = full ? 'rgba(255,226,63,0.95)' : 'rgba(216,255,248,0.95)'
    ctx.shadowBlur = 10 * bloomMul
    ctx.beginPath()
    ctx.arc(0, 0, R, 0, TAU)
    ctx.stroke()
    ctx.shadowBlur = 0

    // full — the pulsing ring, the game's only pulsing element
    if (full) {
      const p = (t % TUNING.reservoir.fullPulsePeriod) / TUNING.reservoir.fullPulsePeriod
      const wave = Math.sin(p * Math.PI)
      ctx.globalAlpha = alpha * (0.3 + 0.7 * wave)
      ctx.strokeStyle = PAL.ore
      ctx.lineWidth = 2
      ctx.shadowColor = 'rgba(255,226,63,0.95)'
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.arc(0, 0, 23 * (1 + 0.14 * wave), 0, TAU)
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.globalAlpha = alpha
    }

    // bank flash — a warm ring leaving the core
    if (bankT >= 0 && bankT < 0.42) {
      const f = bankT / 0.42
      ctx.globalAlpha = alpha * (1 - f)
      ctx.strokeStyle = PAL.ore
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(0, 0, R + 4 + f * 14, 0, TAU)
      ctx.stroke()
      ctx.globalAlpha = alpha
    }

    ctx.restore()
  }

  // -------------------------------------------------------------------------

  private bake(st: Station, px: number): void {
    this.rev = st.structureRev
    this.px = px
    const S = TUNING.station
    const pad = 16
    const half = S.radius + S.flareLen + pad
    this.half = half
    const size = Math.ceil(half * 2 * px)
    let c = this.buffer
    if (!c || c.width !== size) {
      c = document.createElement('canvas')
      this.buffer = c
    }
    c.width = size
    c.height = size
    const g = c.getContext('2d')!
    g.setTransform(px, 0, 0, px, half * px, half * px)
    g.lineCap = 'round'
    g.lineJoin = 'round'

    const n = st.sections
    const gapHalf = (TUNING.station.boundaryGapDeg / 2) * (Math.PI / 180)
    const R = S.radius

    // capacity — inner rails + cross-ties, everything inside the hull
    if (st.capacity > 0) {
      const rails = [33, 26.5, 21.5]
      const ties = [24, 16, 10]
      const outer = [44, 32, 26]
      const rng = new SeededRNG(0xA11CE)
      g.strokeStyle = rgba(PAL.station, 0.7)
      for (let lvl = 0; lvl < st.capacity && lvl < 3; lvl++) {
        const r = rails[lvl]
        g.lineWidth = 1
        g.globalAlpha = 0.7
        g.beginPath()
        g.arc(0, 0, r, 0, TAU)
        g.stroke()
        g.lineWidth = 0.7
        g.globalAlpha = 0.56
        const count = ties[lvl]
        for (let i = 0; i < count; i++) {
          const a = (i / count) * TAU + lvl * 0.21
          const rOut = Math.min(outer[lvl], r + 4 + rng.next() * (outer[lvl] - r - 3))
          g.beginPath()
          g.moveTo(Math.cos(a) * r, Math.sin(a) * r)
          g.lineTo(Math.cos(a) * rOut, Math.sin(a) * rOut)
          g.stroke()
        }
      }
      g.globalAlpha = 1
    }

    // stage-4 payoff — the tooth comb, once three upgrades are in
    if (st.totalUpgrades() >= 3) {
      const lengths = [3.2, 1.8, 2.6, 1.4]
      g.strokeStyle = rgba(PAL.station, 0.5)
      g.lineWidth = 0.6
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * TAU - Math.PI / 2
        const len = lengths[i % 4]
        g.beginPath()
        g.moveTo(Math.cos(a) * R, Math.sin(a) * R)
        g.lineTo(Math.cos(a) * (R - len), Math.sin(a) * (R - len))
        g.stroke()
      }
    }

    // hull — the ring IS the meter: section arcs + boundary flares.
    // Dead hull is thin AND dark: losing a segment costs energy, not just
    // colour. Live arcs carry the bloom.
    for (let i = 0; i < n; i++) {
      const a0 = st.boundaryAngle(i) + gapHalf
      const a1 = st.boundaryAngle(i + 1) - gapHalf
      const alive = !st.dead[i]
      if (alive) {
        g.strokeStyle = rgba(PAL.station, 0.95)
        g.lineWidth = 2.9
        g.shadowColor = 'rgba(94,242,214,0.8)'
        g.shadowBlur = 10 * px >= 1 ? 10 : 0
      } else {
        g.strokeStyle = PAL.stationDead
        g.lineWidth = 1.5
        g.shadowBlur = 0
      }
      g.beginPath()
      g.arc(0, 0, R, a0, a1)
      g.stroke()
      g.shadowBlur = 0

      // the flare that marks this section's boundary — 5px outward kick at
      // ring weight; it belongs to its section and dies with it
      const fa = st.boundaryAngle(i)
      const fx = Math.cos(fa)
      const fy = Math.sin(fa)
      g.strokeStyle = alive ? rgba(PAL.station, 0.95) : PAL.stationDead
      g.lineWidth = 2.88
      if (alive) {
        g.shadowColor = 'rgba(94,242,214,0.8)'
        g.shadowBlur = 8
      }
      g.beginPath()
      g.moveTo(fx * R, fy * R)
      g.lineTo(fx * (R + S.flareLen), fy * (R + S.flareLen))
      g.stroke()
      g.shadowBlur = 0
    }
  }
}

/** The 4-section emblem station used by the title screen (kit 24b / icon). */
export function drawEmblemStation(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number): void {
  const R = 44
  const gapHalf = (3 * Math.PI) / 180
  ctx.save()
  ctx.translate(x, y)
  ctx.globalAlpha = alpha
  ctx.lineCap = 'round'
  ctx.strokeStyle = rgba(PAL.station, 0.78)
  ctx.shadowColor = 'rgba(94,242,214,0.5)'
  ctx.shadowBlur = 3
  for (let i = 0; i < 4; i++) {
    const b = -Math.PI / 2 + (i / 4) * TAU
    ctx.lineWidth = 2.9
    ctx.beginPath()
    ctx.arc(0, 0, R, b + gapHalf, b + TAU / 4 - gapHalf)
    ctx.stroke()
    ctx.lineWidth = 2.88
    ctx.beginPath()
    ctx.moveTo(Math.cos(b) * R, Math.sin(b) * R)
    ctx.lineTo(Math.cos(b) * (R + 5), Math.sin(b) * (R + 5))
    ctx.stroke()
  }
  ctx.strokeStyle = PAL.core
  ctx.lineWidth = 3.4
  ctx.shadowColor = 'rgba(216,255,248,0.95)'
  ctx.shadowBlur = 10
  ctx.beginPath()
  ctx.arc(0, 0, 18, 0, TAU)
  ctx.stroke()
  ctx.restore()
}
