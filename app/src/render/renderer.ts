// Canvas 2D renderer — the phosphor tube. Consumes sim state read-only,
// interpolating between fixed steps. Everything emits, nothing reflects:
// wireframe objects with baked bloom, the rotating starfield, the station
// whose ring IS the hull meter, the 31a well, 13e echoes under the finger,
// the smash's white rings, the hull-hit tear, and the CRT power-off death.
//
// Perf shape (kit "HOW THIS GETS DRAWN"): bloom is baked into sprites or
// drawn as capped shadowBlur strokes (~30/frame worst case); starfield and
// station structure are offscreen buffers; scanlines + vignette live in DOM
// so they cost the canvas nothing; the intensity ramp is one float.

import { TUNING } from '../config'
import { game } from '../state'
import { settings } from '../storage'
import { fx, hullFlickerAlpha, hullTearOffset } from '../fx/fx'
import { intensity } from '../intensity'
import { upgrade } from '../upgrade'
import { firstRun } from '../firstrun'
import { readHistory, ORE } from '../sim/pool'
import type { Sim, PointerState } from '../sim/sim'
import { PAL, FONT_NUM, FONT_LABEL, rgba } from './palette'
import { SpriteSet } from './sprites'
import { Starfield } from './starfield'
import { StationDraw } from './stationDraw'
import { WellFx } from './well'
import {
  drawTitle, drawPaused, drawResult, drawSettings, drawChoice,
  type Layout
} from './screens'

const TAU = Math.PI * 2
const ECHO_BACK = [5, 10, 14] // 60Hz history samples ≈ 80/160/240ms

export class Renderer {
  private ctx: CanvasRenderingContext2D
  private fieldCanvas: HTMLCanvasElement
  private fieldCtx: CanvasRenderingContext2D
  private sprites = new SpriteSet()
  private stars = new Starfield()
  private stationDraw = new StationDraw()
  well = new WellFx()

  private W = 1          // css px
  private H = 1
  private dpr = 1
  scale = 1              // world→css
  worldW = 1
  worldH = 1
  safeTop = 0            // world units

  private histBuf = new Float32Array(3)
  private lastScan = -1
  private lastVig = -1
  private crtEl: HTMLElement | null = null
  private vigEl: HTMLElement | null = null
  private wobblePhase = 0
  private timeNow = 0
  /** M5 — short-lived sparks off the ring while one section from death. */
  private sparks: Array<{ x: number; y: number; vx: number; vy: number; t: number; life: number }> = []
  /** F6 — the rolled score the counter displays (chases game.score). */
  private scoreShown = 0

  constructor(private canvas: HTMLCanvasElement) {
    // F10 — desynchronized lets the compositor present without waiting a
    // frame where supported (Chrome/Android); elsewhere it's an ignored hint.
    this.ctx = canvas.getContext('2d', { desynchronized: true })!
    this.fieldCanvas = document.createElement('canvas')
    this.fieldCtx = this.fieldCanvas.getContext('2d')!
    this.crtEl = document.getElementById('crt')
    this.vigEl = document.getElementById('vignette')
  }

  resize(w: number, h: number, dpr: number, safeTopCss: number): void {
    this.W = w
    this.H = h
    this.dpr = dpr
    const L = TUNING.layout
    this.scale = Math.max(L.minScale, Math.min(L.maxScale, Math.min(w / L.refWidth, h / L.refHeight)))
    this.worldW = w / this.scale
    this.worldH = h / this.scale
    this.safeTop = safeTopCss / this.scale
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.fieldCanvas.width = this.canvas.width
    this.fieldCanvas.height = this.canvas.height
    const px = dpr * this.scale
    this.stars.regenerate(this.worldW, this.worldH, px)
    this.sprites.bake(px)
  }

  toWorld(cssX: number, cssY: number): { x: number; y: number } {
    return { x: cssX / this.scale, y: cssY / this.scale }
  }

  /** Clear per-run visual state (well rings, eased reservoir display). */
  resetRunVisuals(): void {
    this.well.clear()
    this.stationDraw.resetRun()
    this.scoreShown = 0
  }

  layout(): Layout {
    return { w: this.worldW, h: this.worldH, safeTop: this.safeTop }
  }

  // -------------------------------------------------------------------------

  draw(sim: Sim, pointer: PointerState, dt: number, now: number): void {
    const ctx = this.ctx
    const t = now / 1000
    const px = this.dpr * this.scale
    const phase = game.phase

    // the ghost finger on the title counts too (L5)
    const wellActive = pointer.active && (phase === 'run' || phase === 'firstrun' || phase === 'collapse' || phase === 'title')
    this.well.update(dt, wellActive)
    this.timeNow = t

    ctx.setTransform(px, 0, 0, px, 0, 0)
    ctx.fillStyle = PAL.bg
    ctx.fillRect(0, 0, this.worldW, this.worldH)

    const l = this.layout()

    // --- starfield ---------------------------------------------------------
    let starAlpha: number
    switch (phase) {
      case 'title': starAlpha = 0.45; break
      case 'settings': starAlpha = 0.25; break
      case 'result': starAlpha = 0.42; break
      case 'paused': starAlpha = 0.2; break
      case 'collapse': starAlpha = intensity.starAlpha() * Math.max(0.12, this.collapseDim()); break
      default: starAlpha = intensity.starAlpha() * (upgrade.active() ? Math.max(upgrade.dim(), 0.4) : 1)
    }
    this.stars.draw(ctx, t, sim.station.x, sim.station.y, starAlpha)

    // --- the field ---------------------------------------------------------
    // N1/L5 — the title is a live field too: drifters behind the shell type
    const inField = phase === 'run' || phase === 'firstrun' || phase === 'choice' || phase === 'paused' || phase === 'collapse' || phase === 'title'
    if (inField) {
      const fieldAlpha =
        phase === 'paused' ? TUNING.choice.freezeDim :
        phase === 'collapse' ? this.collapseDim() :
        phase === 'title' ? TUNING.title.fieldAlpha :
        upgrade.active() ? upgrade.dim() : 1

      const tear = hullTearOffset()
      if (tear > 0.5) {
        // render the field once, then blit two halves shifted — the picture
        // tears along a scanline; the DOM scanlines above stay whole
        const f = this.fieldCtx
        f.setTransform(px, 0, 0, px, 0, 0)
        f.clearRect(0, 0, this.worldW, this.worldH)
        this.drawField(f, sim, pointer, fieldAlpha, t, dt)
        const ys = Math.round(sim.station.y * px)
        const devW = this.canvas.width
        const devH = this.canvas.height
        const off = Math.round(tear * px)
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.drawImage(this.fieldCanvas, 0, 0, devW, ys, -off, 0, devW, ys)
        ctx.drawImage(this.fieldCanvas, 0, ys, devW, devH - ys, off, ys, devW, devH - ys)
        // the 1px white line — a signal dropout, not a bar
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.fillRect(0, ys, devW, Math.max(1, Math.round(TUNING.hullHit.tearLineWidth * this.dpr)))
        ctx.setTransform(px, 0, 0, px, 0, 0)
      } else {
        this.drawField(ctx, sim, pointer, fieldAlpha, t, dt)
      }
    }

    // --- collapse sequence over the field ---------------------------------
    if (phase === 'collapse') this.drawCollapse(ctx, sim, game.phaseT)
    if (phase === 'result') this.drawBurnIn(ctx, sim, 0.12)

    // --- surge + build play over live gameplay -----------------------------
    if (upgrade.stage === 'surge') this.drawSurge(ctx, sim)
    if (upgrade.buildTrack && upgrade.buildT >= 0 && upgrade.buildT < TUNING.choice.build + 0.2) {
      this.drawBuildFlash(ctx, sim)
    }

    // --- floats + HUD ------------------------------------------------------
    if (inField && phase !== 'title') {
      this.drawFloats(ctx)
      this.drawFlights(ctx, l)
      // the wager hint belongs to live play — never over the choice plates
      if (phase === 'run' || phase === 'firstrun') this.drawHint(ctx, sim)
      this.drawScore(ctx, l, phase === 'collapse' ? Math.max(0, 1 - game.phaseT / 1.2) : 1, dt)
    }

    // --- shell screens -----------------------------------------------------
    switch (phase) {
      case 'title': drawTitle(ctx, l, t); break
      case 'paused': drawPaused(ctx, l); break
      case 'result': drawResult(ctx, l); break
      case 'settings': drawSettings(ctx, l); break
      case 'choice': drawChoice(ctx, sim.station, l); break
      default: break
    }
    if (phase === 'firstrun') this.drawFirstRunHints(ctx, pointer, t)

    // --- DOM tube dressing -------------------------------------------------
    const dressed = inField && phase !== 'title'
    const scanA = dressed ? intensity.scanAlpha() : 0.32
    const vig = dressed ? intensity.vignetteInner() : 0.58
    if (Math.abs(scanA - this.lastScan) > 0.005 && this.crtEl) {
      this.lastScan = scanA
      this.crtEl.style.opacity = String(scanA)
    }
    if (Math.abs(vig - this.lastVig) > 0.005 && this.vigEl) {
      this.lastVig = vig
      this.vigEl.style.background =
        `radial-gradient(110% 100% at 50% 50%, transparent ${Math.round(vig * 100)}%, rgba(0,0,0,0.5))`
    }
  }

  // -------------------------------------------------------------------------

  private drawField(ctx: CanvasRenderingContext2D, sim: Sim, pointer: PointerState, fieldAlpha: number, t: number, dt: number): void {
    const st = sim.station
    ctx.save()

    // F4 — trauma shake: coherent-noise offsets plus a little roll about the
    // station (rotation sells impact at phone size), and the late-run wobble
    let ox = fx.shakeX
    let oy = fx.shakeY
    if (intensity.wobbleOn() && !settings.reduceMotion && game.phase !== 'paused') {
      this.wobblePhase += dt
      if (this.wobblePhase > TUNING.intensity.wobblePeriod) this.wobblePhase = 0
      if (this.wobblePhase < 0.09) ox += TUNING.intensity.wobblePx
    }
    if (fx.shakeRoll !== 0) {
      ctx.translate(st.x, st.y)
      ctx.rotate(fx.shakeRoll)
      ctx.translate(-st.x, -st.y)
    }
    ctx.translate(ox, oy)

    const bloom = intensity.bloomMul()
    const flicker = hullFlickerAlpha()
    const onTitle = game.phase === 'title'
    const hideStation = onTitle || (game.phase === 'collapse' && game.phaseT > 0.9)

    // F7 — phosphor burns, the field's memory of big smashes (bottom layer)
    for (const bn of fx.burns) {
      const f = bn.t / TUNING.burns.life
      ctx.globalAlpha = fieldAlpha * 0.12 * (1 - f)
      ctx.fillStyle = PAL.rock
      ctx.beginPath()
      ctx.arc(bn.x, bn.y, bn.r * (1 + f * 0.35), 0, TAU)
      ctx.fill()
      if (bn.t < 0.3) {
        ctx.globalAlpha = fieldAlpha * 0.4 * (1 - bn.t / 0.3)
        ctx.beginPath()
        ctx.arc(bn.x, bn.y, bn.r * 0.4, 0, TAU)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1

    // F9 — the station flinches away from a hull hit
    let flinchX = 0
    let flinchY = 0
    if (fx.flinch) {
      const f = 1 - fx.flinch.t / TUNING.flinch.dur
      flinchX = fx.flinch.dx * TUNING.flinch.px * f * f
      flinchY = fx.flinch.dy * TUNING.flinch.px * f * f
    }

    // station (+ its shield) recoil together
    if (flinchX !== 0 || flinchY !== 0) ctx.translate(flinchX, flinchY)
    if (!hideStation) {
      const sAlpha = fieldAlpha * flicker
      this.stationDraw.drawStructure(ctx, st, this.dpr * this.scale, sAlpha)
      this.stationDraw.drawCore(ctx, st, t, dt, fx.bankT, sAlpha, bloom)
      // collapse over-brighten
      if (game.phase === 'collapse' && game.phaseT < 0.9) {
        const f = Math.min(1, game.phaseT / TUNING.collapse.blowout)
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = f * 0.45
        this.stationDraw.drawStructure(ctx, st, this.dpr * this.scale, 1)
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'source-over'
      }
    }

    // the shield — a quiet phosphor circle while armed; while down it
    // redraws itself clockwise from 12. Block flashes land as bright arcs.
    if (!onTitle && !hideStation && st.shieldLevel > 0) {
      const SH = TUNING.shield
      ctx.save()
      ctx.lineCap = 'round'
      if (st.shieldDownT <= 0) {
        const ready = fx.shieldReadyT >= 0 ? 1 - fx.shieldReadyT / SH.readyFlashDur : 0
        ctx.globalAlpha = fieldAlpha * (0.34 + 0.45 * ready)
        ctx.strokeStyle = PAL.station
        ctx.lineWidth = 1.2 + 0.8 * ready
        ctx.shadowColor = 'rgba(94,242,214,0.7)'
        ctx.shadowBlur = (4 + 6 * ready) * (bloom / TUNING.intensity.bloom.from)
        ctx.beginPath()
        ctx.arc(st.x, st.y, SH.radius, 0, TAU)
        ctx.stroke()
      } else {
        const f = 1 - st.shieldDownT / st.shieldRechargeTime()
        if (f > 0.015) {
          ctx.globalAlpha = fieldAlpha * 0.22
          ctx.strokeStyle = PAL.station
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(st.x, st.y, SH.radius, -Math.PI / 2, -Math.PI / 2 + TAU * f)
          ctx.stroke()
        }
      }
      ctx.shadowBlur = 0
      // the catch, marked where it happened — gold when it paid
      for (const b of fx.shieldBlocks) {
        const q = 1 - b.t / SH.flashDur
        if (q <= 0) continue
        ctx.globalAlpha = fieldAlpha * q
        ctx.strokeStyle = b.gold > 0 ? PAL.ore : PAL.station
        ctx.lineWidth = 2.6
        ctx.shadowColor = b.gold > 0 ? 'rgba(255,226,63,0.9)' : 'rgba(94,242,214,0.9)'
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.arc(st.x, st.y, SH.radius, b.angle - SH.arcHalf, b.angle + SH.arcHalf)
        ctx.stroke()
      }
      ctx.restore()
    }
    ctx.globalAlpha = 1
    if (flinchX !== 0 || flinchY !== 0) ctx.translate(-flinchX, -flinchY)

    // L1 — every object leaves a short tapered phosphor tail (the history
    // ring buffer held it all along). Ore runs warmer and a little longer.
    const TR = TUNING.trails
    ctx.lineCap = 'round'
    for (let i = 0; i < sim.pool.count; i++) {
      const o = sim.pool.objs[i]
      if (o.vx * o.vx + o.vy * o.vy < TR.minSpeed * TR.minSpeed) continue
      const isOre = o.kind === ORE
      const n = Math.min(isOre ? TR.oreSamples : TR.rockSamples, o.histLen - 1)
      if (n < 3) continue
      const baseA = (isOre ? TR.oreAlpha : TR.alpha) * fieldAlpha
      const hx = o.px + (o.x - o.px) * sim.alpha
      const hy = o.py + (o.y - o.py) * sim.alpha
      // a tail shorter than the body would smudge inside the hollow outline —
      // skip it, and anchor visible tails at the rim, not the centre
      if (!readHistory(o, n, this.histBuf)) continue
      const tdx = this.histBuf[0] - hx
      const tdy = this.histBuf[1] - hy
      const tailLen = Math.hypot(tdx, tdy)
      if (tailLen < o.r * 1.35) continue
      ctx.strokeStyle = isOre ? PAL.ore : PAL.rock
      let prevX = hx + (tdx / tailLen) * o.r * 0.85
      let prevY = hy + (tdy / tailLen) * o.r * 0.85
      for (let s = 1; s <= 3; s++) {
        const back = Math.round((n * s) / 3)
        if (!readHistory(o, back, this.histBuf)) break
        const fade = 1 - (s - 1) / 3
        ctx.globalAlpha = baseA * fade
        ctx.lineWidth = Math.max(0.6, o.r * TR.widthFrac * fade)
        ctx.beginPath()
        ctx.moveTo(prevX, prevY)
        ctx.lineTo(this.histBuf[0], this.histBuf[1])
        ctx.stroke()
        prevX = this.histBuf[0]
        prevY = this.histBuf[1]
      }
    }
    ctx.globalAlpha = 1

    // 13e — echoes, only inside the well's field
    if (pointer.active && fieldAlpha > 0.5) {
      const E = TUNING.echoes
      for (let i = 0; i < sim.pool.count; i++) {
        const o = sim.pool.objs[i]
        const plain = this.sprites.plain.get(o.kind)
        if (!plain) continue
        for (let k = ECHO_BACK.length - 1; k >= 0; k--) {
          if (!readHistory(o, ECHO_BACK[k], this.histBuf)) continue
          const hx = this.histBuf[0]
          const hy = this.histBuf[1]
          const dxp = hx - pointer.x
          const dyp = hy - pointer.y
          const d = Math.hypot(dxp, dyp)
          const mask = 1 - d / E.maskRadius
          if (mask <= 0.04) continue
          const a = E.alphas[k] * Math.min(1, mask * 1.4) * fieldAlpha
          if (a < 0.03) continue
          ctx.globalAlpha = a
          this.blitSprite(ctx, plain, hx, hy, this.histBuf[2], o.r / plain.nominal)
        }
      }
      ctx.globalAlpha = 1
    }

    // objects — rigid sprites (F2 deformation removed by playtest ruling)
    for (let i = 0; i < sim.pool.count; i++) {
      const o = sim.pool.objs[i]
      const sprite = this.sprites.lit.get(o.kind)
      if (!sprite) continue
      const rx = o.px + (o.x - o.px) * sim.alpha
      const ry = o.py + (o.y - o.py) * sim.alpha
      const base = o.r / sprite.nominal

      ctx.globalAlpha = fieldAlpha
      this.blitSprite(ctx, sprite, rx, ry, o.rot, base)
    }
    ctx.globalAlpha = 1

    this.drawFieldFx(ctx, sim, fieldAlpha)

    // the well — on, or gone
    if (pointer.active || this.well.liveCount() > 0) {
      this.well.draw(ctx, pointer.x, pointer.y, fieldAlpha)
    }

    // L5 — the ghost finger on the title: a dashed fingertip where the
    // demonstration is pressing
    if (game.phase === 'title' && pointer.active) {
      const pulse = 0.4 + 0.2 * Math.sin(this.timeNow * 3.2)
      ctx.globalAlpha = pulse
      ctx.strokeStyle = PAL.ink
      ctx.lineWidth = 1
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      ctx.arc(pointer.x, pointer.y, 18, 0, TAU)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
    }

    // M5 — one section left: sparks jitter off the ring, and the whole tube
    // runs a shade colder. No red, no darkening — never blind the clutch.
    const critical = sim.hullCritical && (game.phase === 'run' || game.phase === 'firstrun')
    if (critical && Math.random() < TUNING.critical.sparksPerSec * dt) {
      const a = Math.random() * TAU
      const sp = 40 + Math.random() * 60
      this.sparks.push({
        x: st.x + Math.cos(a) * TUNING.station.radius,
        y: st.y + Math.sin(a) * TUNING.station.radius,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        t: 0,
        life: TUNING.critical.sparkLife
      })
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]
      s.t += dt
      if (s.t > s.life) { this.sparks.splice(i, 1); continue }
      s.x += s.vx * dt
      s.y += s.vy * dt
      const f = s.t / s.life
      ctx.globalAlpha = fieldAlpha * (1 - f)
      ctx.strokeStyle = PAL.station
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(s.x + s.vx * 0.06, s.y + s.vy * 0.06)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    if (critical) {
      ctx.globalAlpha = TUNING.critical.coldWashAlpha * (0.8 + 0.2 * Math.sin(this.timeNow * 2))
      ctx.fillStyle = 'rgb(150,180,215)'
      ctx.fillRect(0, 0, this.worldW, this.worldH)
      ctx.globalAlpha = 1
    }

    ctx.restore()
  }

  private blitSprite(
    ctx: CanvasRenderingContext2D,
    s: { canvas: HTMLCanvasElement; half: number; nominal: number },
    x: number, y: number, rot: number, scale: number
  ): void {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    if (scale !== 1) ctx.scale(scale, scale)
    ctx.drawImage(s.canvas, -s.half, -s.half, s.half * 2, s.half * 2)
    ctx.restore()
  }

  /** M2/P1 — the wager line and the mission/rank banner under the station. */
  private drawHint(ctx: CanvasRenderingContext2D, sim: Sim): void {
    ctx.font = `12px ${FONT_LABEL}`
    ctx.textAlign = 'center'
    const h = fx.hint
    if (h) {
      const f = h.t / h.dur
      const a = f < 0.12 ? f / 0.12 : f > 0.78 ? Math.max(0, (1 - f) / 0.22) : 1
      ctx.globalAlpha = a
      ctx.fillStyle = PAL.rockLit
      ctx.fillText(h.text, sim.station.x, sim.station.y + 118)
    }
    const b = fx.banner
    if (b) {
      const f = b.t / b.dur
      const a = f < 0.1 ? f / 0.1 : f > 0.8 ? Math.max(0, (1 - f) / 0.2) : 1
      ctx.globalAlpha = a
      ctx.fillStyle = PAL.ore
      ctx.fillText(b.text, sim.station.x, sim.station.y + 140)
    }
    ctx.globalAlpha = 1
  }

  /** F6 — bank chips arcing to the counter. */
  private drawFlights(ctx: CanvasRenderingContext2D, l: Layout): void {
    if (fx.flights.length === 0) return
    const S = TUNING.scoreFx
    const ty = Math.max(62, l.safeTop + 52) - 18
    const tx = 58
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.font = `24px ${FONT_NUM}`
    for (const fl of fx.flights) {
      const p = Math.min(1, fl.t / S.flightDur)
      const e = 1 - (1 - p) * (1 - p) // ease-out
      // quadratic arc via a sideways control point
      const mx = (fl.x + tx) / 2 + S.flightArc
      const my = (fl.y + ty) / 2
      const ix = (1 - e) * (1 - e) * fl.x + 2 * (1 - e) * e * mx + e * e * tx
      const iy = (1 - e) * (1 - e) * fl.y + 2 * (1 - e) * e * my + e * e * ty
      ctx.globalAlpha = p < 0.1 ? p / 0.1 : 1
      ctx.fillStyle = PAL.ore
      ctx.shadowColor = 'rgba(255,226,63,0.7)'
      ctx.shadowBlur = 7
      ctx.fillText(fl.text, ix, iy)
      ctx.shadowBlur = 0
    }
    ctx.globalAlpha = 1
  }

  private drawFieldFx(ctx: CanvasRenderingContext2D, sim: Sim, fieldAlpha: number): void {
    const st = sim.station

    // smash shock rings — the only pure white in ordinary play
    for (const s of fx.shocks) {
      this.shockRing(ctx, s.x, s.y, s.t, TUNING.smash.ringA, fieldAlpha)
      this.shockRing(ctx, s.x, s.y, s.t, TUNING.smash.ringB, fieldAlpha)
    }
    // rubble crumble — quiet dim ring
    for (const c of fx.crumbles) {
      const f = c.t / 0.3
      ctx.globalAlpha = fieldAlpha * (1 - f) * 0.5
      ctx.strokeStyle = PAL.rock
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(c.x, c.y, 8 + 24 * f, 0, TAU)
      ctx.stroke()
    }
    // ore spill chips — the only time warm light leaves the station
    for (const c of fx.chips) {
      const f = c.t / c.life
      ctx.save()
      ctx.translate(st.x + c.x, st.y + c.y)
      ctx.rotate(c.rot)
      ctx.globalAlpha = fieldAlpha * (f > 0.6 ? 1 - (f - 0.6) / 0.4 : 1)
      ctx.strokeStyle = PAL.ore
      ctx.lineWidth = 1.6
      ctx.shadowColor = 'rgba(255,226,63,0.85)'
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.moveTo(0, -5)
      ctx.lineTo(5, -1)
      ctx.lineTo(3, 5)
      ctx.lineTo(-5, 2)
      ctx.closePath()
      ctx.stroke()
      ctx.restore()
    }
    // N4 — the clear pulse: one bright ring shoving the field offscreen
    if (fx.clearT >= 0) {
      const f = fx.clearT / TUNING.clearPulse.ringDur
      const r = 15 + f * Math.max(this.worldW, this.worldH) * 0.8
      ctx.globalAlpha = fieldAlpha * (1 - f) * 0.85
      ctx.strokeStyle = PAL.station
      ctx.lineWidth = 2.4 - 1.2 * f
      ctx.shadowColor = 'rgba(94,242,214,0.6)'
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(st.x, st.y, r, 0, TAU)
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    // M8 — the vein: one screen edge runs warm while gold is inbound
    if (fx.vein) {
      const v = fx.vein
      const fade = 1 - v.t / v.dur
      const pulse = 0.7 + 0.3 * Math.sin(this.timeNow * 5)
      const a = 0.15 * fade * pulse * fieldAlpha
      const w = this.worldW
      const h = this.worldH
      const D = 30 // strip depth
      let grad: CanvasGradient
      if (v.side === 0) grad = ctx.createLinearGradient(0, 0, 0, D)
      else if (v.side === 1) grad = ctx.createLinearGradient(w, 0, w - D, 0)
      else if (v.side === 2) grad = ctx.createLinearGradient(0, h, 0, h - D)
      else grad = ctx.createLinearGradient(0, 0, D, 0)
      grad.addColorStop(0, `rgba(255,226,63,${a})`)
      grad.addColorStop(1, 'rgba(255,226,63,0)')
      ctx.fillStyle = grad
      if (v.side === 0) ctx.fillRect(0, 0, w, D)
      else if (v.side === 1) ctx.fillRect(w - D, 0, D, h)
      else if (v.side === 2) ctx.fillRect(0, h - D, w, D)
      else ctx.fillRect(0, 0, D, h)
      if (v.t < 1.7) {
        const ta = v.t < 0.15 ? v.t / 0.15 : v.t > 1.35 ? Math.max(0, (1.7 - v.t) / 0.35) : 1
        ctx.globalAlpha = ta * fieldAlpha
        ctx.fillStyle = PAL.ore
        ctx.font = `12px ${FONT_LABEL}`
        ctx.textAlign = 'center'
        const tx = v.side === 1 ? w - 74 : v.side === 3 ? 74 : w / 2
        const ty = v.side === 0 ? 54 : v.side === 2 ? h - 44 : h / 2
        ctx.fillText('VEIN INBOUND', tx, ty)
        ctx.globalAlpha = 1
      }
    }

    // 13d — near-miss flare with the gap in pixels
    for (const fl of fx.flares) {
      const f = fl.t / TUNING.nearMiss.flareDuration
      const a = f < 0.14 ? f / 0.14 : 1 - (f - 0.14) / 0.86
      ctx.globalAlpha = fieldAlpha * a
      ctx.strokeStyle = PAL.rockLit
      ctx.lineWidth = 2.5
      ctx.shadowColor = 'rgba(218,225,231,0.8)'
      ctx.shadowBlur = 8
      const r = 48 + 6 * f
      ctx.beginPath()
      ctx.arc(st.x, st.y, r, fl.angle - 0.48, fl.angle + 0.48)
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.font = `11px ${FONT_LABEL}`
      ctx.textAlign = 'center'
      ctx.fillStyle = PAL.rockLit
      ctx.fillText(`${fl.gap}PX`, st.x + Math.cos(fl.angle) * 76, st.y + Math.sin(fl.angle) * 76 + 4)
    }
    ctx.globalAlpha = 1
  }

  private shockRing(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, cfg: { r0: number; r1: number; grow: number; w: number }, fieldAlpha: number): void {
    const f = Math.min(1, t / cfg.grow)
    const fade = t > cfg.grow * 0.7 ? Math.max(0, 1 - (t - cfg.grow * 0.7) / (cfg.grow * 0.6)) : 1
    if (fade <= 0) return
    ctx.globalAlpha = fieldAlpha * fade
    ctx.strokeStyle = PAL.white
    ctx.lineWidth = cfg.w
    ctx.beginPath()
    ctx.arc(x, y, cfg.r0 + (cfg.r1 - cfg.r0) * f, 0, TAU)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  private drawFloats(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    for (const f of fx.floats) {
      const p = f.t / TUNING.fx.floatLife
      ctx.globalAlpha = p > 0.55 ? 1 - (p - 0.55) / 0.45 : 1
      ctx.fillStyle = f.color
      ctx.font = `34px ${FONT_NUM}`
      if (f.glow) {
        ctx.shadowColor = 'rgba(255,226,63,0.7)'
        ctx.shadowBlur = 8
      }
      ctx.fillText(f.text, f.x, f.y - TUNING.fx.floatRise * p)
      ctx.shadowBlur = 0
    }
    ctx.globalAlpha = 1
  }

  private drawScore(ctx: CanvasRenderingContext2D, l: Layout, alpha: number, dt: number): void {
    if (alpha <= 0.01) return
    const S = TUNING.scoreFx
    // F6 — the counter rolls: it chases the real score minus whatever is
    // still in flight, so a bank lands when its chip does.
    let inflight = 0
    for (const fl of fx.flights) inflight += fl.value
    const target = Math.max(0, game.score - inflight)
    this.scoreShown += (target - this.scoreShown) * Math.min(1, dt * S.rollRate)
    if (Math.abs(target - this.scoreShown) < 0.7) this.scoreShown = target
    const shown = Math.round(this.scoreShown)

    // P4 — closing on the best, the counter leans in; streaks add glow (F6)
    const near = game.best > 0 && shown >= game.best * TUNING.pb.nearFrac && !game.challenge
    const streakGlow = Math.min(S.streakGlowMax, fx.streak * S.streakGlowStep)
    const pulse = fx.scorePulse >= 0 ? Math.sin((fx.scorePulse / S.pulseDur) * Math.PI) : 0
    let sx = 22
    let sy = Math.max(62, l.safeTop + 52)
    if (fx.streak >= S.jitterFrom) {
      sx += (Math.random() - 0.5) * 1.6
      sy += (Math.random() - 0.5) * 1.6
    }
    ctx.globalAlpha = alpha
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.font = `${Math.round(62 * (1 + 0.08 * pulse))}px ${FONT_NUM}`
    ctx.fillStyle = near || (game.best > 0 && shown > game.best) ? PAL.white : PAL.ink
    // only the score blooms among type
    ctx.shadowColor = 'rgba(174,185,196,0.8)'
    ctx.shadowBlur = (near ? 12 : 6) + streakGlow
    ctx.fillText(String(shown), sx, sy)
    ctx.shadowBlur = 0
    ctx.font = `11px ${FONT_LABEL}`
    if (game.challenge) {
      ctx.fillStyle = PAL.ore
      const tgt = game.challenge.target
      ctx.fillText(tgt ? `TARGET ${tgt}` : 'CHALLENGE RUN', 24, Math.max(62, l.safeTop + 52) + 20)
    } else if (game.best > 0) {
      ctx.fillStyle = near ? PAL.labelBright : PAL.label
      ctx.fillText(`BEST ${game.best}`, 24, Math.max(62, l.safeTop + 52) + 20)
    }
    ctx.globalAlpha = 1
  }

  // --- upgrade surge + build ----------------------------------------------

  private drawSurge(ctx: CanvasRenderingContext2D, sim: Sim): void {
    const C = TUNING.choice
    const f = Math.min(1, upgrade.t / C.surge)
    const e = 1 - (1 - f) * (1 - f)
    const r = 104 + (15 - 104) * e
    const a = f < 0.1 ? f / 0.1 : f > 0.92 ? (1 - f) / 0.08 : 1
    ctx.save()
    ctx.globalAlpha = Math.max(0, a)
    ctx.strokeStyle = PAL.ore
    ctx.lineWidth = 2.4
    ctx.shadowColor = 'rgba(255,226,63,0.85)'
    ctx.shadowBlur = 9
    ctx.beginPath()
    ctx.arc(sim.station.x, sim.station.y, r, 0, TAU)
    ctx.stroke()
    ctx.restore()
  }

  /** New structure arrives warm and cools into the hull. */
  private drawBuildFlash(ctx: CanvasRenderingContext2D, sim: Sim): void {
    const st = sim.station
    const C = TUNING.choice
    const bt = upgrade.buildT
    if (bt < 0) return
    const f = Math.min(1, bt / (C.build + 0.2))
    const a = 1 - f
    if (a <= 0.02) return
    ctx.save()
    ctx.translate(st.x, st.y)
    ctx.globalAlpha = a
    ctx.strokeStyle = PAL.ore
    ctx.shadowColor = 'rgba(255,226,63,0.85)'
    ctx.shadowBlur = 8
    ctx.lineCap = 'round'
    const bf = Math.min(1, bt / C.build)
    const pop = bf < 0.7 ? 0.35 + (1.16 - 0.35) * (bf / 0.7) : 1.16 - 0.16 * ((bf - 0.7) / 0.3)
    if (upgrade.buildTrack === 'hull') {
      const n = st.sections
      const gapHalf = (TUNING.station.boundaryGapDeg / 2) * (Math.PI / 180)
      const a0 = st.boundaryAngle(n - 1) + gapHalf
      const a1 = st.boundaryAngle(n) - gapHalf
      ctx.lineWidth = 2.9
      ctx.beginPath()
      ctx.arc(0, 0, TUNING.station.radius, a0, a1)
      ctx.stroke()
      const fa = st.boundaryAngle(n - 1)
      ctx.lineWidth = 2.88 * Math.max(0.4, pop)
      ctx.beginPath()
      ctx.moveTo(Math.cos(fa) * 44, Math.sin(fa) * 44)
      ctx.lineTo(Math.cos(fa) * (44 + 5 * pop), Math.sin(fa) * (44 + 5 * pop))
      ctx.stroke()
    } else if (upgrade.buildTrack === 'shield') {
      // the ring snaps out warm, then the live teal shield takes over
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(0, 0, TUNING.shield.radius * Math.max(0.5, Math.min(1.06, pop)), 0, TAU)
      ctx.stroke()
    } else if (upgrade.buildTrack === 'repair' && st.lastRepaired >= 0) {
      // the relit section flashes warm before cooling into the hull
      const gapHalf = (TUNING.station.boundaryGapDeg / 2) * (Math.PI / 180)
      const a0 = st.boundaryAngle(st.lastRepaired) + gapHalf
      const a1 = st.boundaryAngle(st.lastRepaired + 1) - gapHalf
      ctx.lineWidth = 2.9 * Math.max(0.5, Math.min(1.1, pop))
      ctx.beginPath()
      ctx.arc(0, 0, TUNING.station.radius, a0, a1)
      ctx.stroke()
    }
    ctx.restore()
  }

  // --- collapse: a CRT losing power ---------------------------------------

  private collapseDim(): number {
    const t = game.phaseT
    if (t >= 1.6) return 0 // only the beam line remains
    const f = Math.min(1, t / 1.0)
    return 1 + (TUNING.collapse.fieldDim - 1) * f
  }

  private drawCollapse(ctx: CanvasRenderingContext2D, sim: Sim, t: number): void {
    const st = sim.station
    ctx.save()

    // blowout ring
    if (t >= 0.575 && t < 1.2) {
      const f = (t - 0.575) / 0.575
      ctx.globalAlpha = Math.max(0, 1 - f)
      ctx.strokeStyle = PAL.ink
      ctx.lineWidth = 2
      ctx.shadowColor = 'rgba(234,252,255,0.9)'
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.arc(st.x, st.y, 44 * (0.3 + 1.9 * f), 0, TAU)
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    // the ring separates into the arcs you spent the run defending
    if (t >= 1.0 && t < 2.45) {
      const f = (t - 1.0) / 1.45
      const n = st.sections
      const gapHalf = (TUNING.station.boundaryGapDeg / 2) * (Math.PI / 180)
      ctx.strokeStyle = rgba(PAL.station, 0.7)
      ctx.lineWidth = 2.4
      ctx.globalAlpha = f > 0.7 ? Math.max(0, (1 - f) / 0.3) : 1
      for (let i = 0; i < n; i++) {
        const mid = st.boundaryAngle(i) + Math.PI / n
        const dist = (60 + (i % 3) * 34) * f
        const rot = ((i % 2 === 0 ? 1 : -1) * (0.9 + (i % 3) * 0.25)) * f
        ctx.save()
        ctx.translate(st.x + Math.cos(mid) * dist, st.y + Math.sin(mid) * dist)
        ctx.rotate(rot)
        ctx.translate(-st.x, -st.y)
        ctx.beginPath()
        ctx.arc(st.x, st.y, 44, st.boundaryAngle(i) + gapHalf, st.boundaryAngle(i + 1) - gapHalf)
        ctx.stroke()
        ctx.restore()
      }
      ctx.globalAlpha = 1
    }

    // beam collapse: the whole picture becomes a line, then a dot
    if (t >= 1.45 && t < 2.2) {
      let sx: number
      let alpha = 1
      if (t < 1.6) sx = 0.15 + ((t - 1.45) / 0.15) * 0.85
      else if (t < 1.95) sx = 1
      else {
        const f = (t - 1.95) / 0.25
        sx = 1 - f * 0.95
        alpha = 1 - f * 0.6
      }
      ctx.globalAlpha = alpha
      ctx.fillStyle = PAL.ink
      ctx.shadowColor = 'rgba(234,252,255,0.95)'
      ctx.shadowBlur = 10
      const w = this.worldW * sx
      ctx.fillRect(st.x - w / 2, st.y - 1, w, 2)
      ctx.shadowBlur = 0
    }
    if (t >= 2.2 && t < 2.62) {
      const f = (t - 2.2) / 0.42
      ctx.globalAlpha = Math.max(0, 1 - f)
      ctx.fillStyle = PAL.ink
      ctx.shadowColor = 'rgba(234,252,255,0.95)'
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(st.x, st.y, 3 * (1 - f * 0.65), 0, TAU)
      ctx.fill()
      ctx.shadowBlur = 0
    }

    // burn-in where the station used to be
    if (t >= 2.35) {
      const a = Math.min(0.4, ((t - 2.35) / 0.4) * 0.4)
      this.drawBurnIn(ctx, sim, a)
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }

  private drawBurnIn(ctx: CanvasRenderingContext2D, sim: Sim, alpha: number): void {
    const st = sim.station
    ctx.save()
    ctx.translate(st.x, st.y)
    ctx.globalAlpha = alpha
    ctx.strokeStyle = PAL.station
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, 44, 0, TAU)
    ctx.stroke()
    ctx.globalAlpha = alpha * 0.8
    ctx.strokeStyle = PAL.core
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.arc(0, 0, 18, 0, TAU)
    ctx.stroke()
    // cold residue — what you banked, now dead, in a broken dashed remnant
    if (game.oreTotal > 0) {
      ctx.globalAlpha = alpha * 0.9
      ctx.strokeStyle = PAL.oreDead
      ctx.lineWidth = 1
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      ctx.arc(0, 0, 16, 0, TAU)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = rgba(PAL.oreDead, 0.35)
      ctx.beginPath()
      ctx.arc(0, 0, 14, Math.PI * 0.15, Math.PI * 0.85)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }

  // --- first run hints ------------------------------------------------------

  private drawFirstRunHints(ctx: CanvasRenderingContext2D, pointer: PointerState, t: number): void {
    if (pointer.active || firstRun.untouchedT < TUNING.firstRun.hintAfter) return
    const x = this.worldW * TUNING.firstRun.holdX
    const y = this.worldH * TUNING.firstRun.holdY
    const pulse = 0.45 + 0.25 * Math.sin(t * 3)
    ctx.save()
    ctx.globalAlpha = pulse
    ctx.strokeStyle = PAL.ink
    ctx.lineWidth = 1
    ctx.setLineDash([2, 4])
    ctx.beginPath()
    ctx.arc(x, y, 18, 0, TAU)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }
}
