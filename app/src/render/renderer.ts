// Canvas 2D renderer. Consumes sim state read-only, interpolating object
// positions between fixed steps. Carries the "gold core" art direction:
// teal station whose ring sections ARE the hull, gold hex ore, violet well.

import { TUNING } from '../config'
import { game } from '../state'
import { particles, floats, wellParticles, fxState } from '../fx/fx'
import { PAL, FONT_STACK } from './palette'
import { Starfield } from './starfield'
import type { Sim, PointerState } from '../sim/sim'
import { ORE } from '../sim/pool'

const TAU = Math.PI * 2
const DASH: number[] = [10, 14]
const NO_DASH: number[] = []

// Trail stroke batches: oldest -> newest thirds (width, alpha applied per type)
const TRAIL_BATCHES = [
  { frac0: 0, frac1: 0.34, width: 0.35, alpha: 0.22 },
  { frac0: 0.34, frac1: 0.67, width: 0.65, alpha: 0.5 },
  { frac0: 0.67, frac1: 1, width: 1, alpha: 1 }
]
const TRAIL_ROCK = ['rgba(141,153,174,0.11)', 'rgba(141,153,174,0.25)', 'rgba(141,153,174,0.5)']
const TRAIL_ORE = ['rgba(255,226,63,0.13)', 'rgba(255,226,63,0.3)', 'rgba(255,226,63,0.6)']

function makeGlow(color: string, radius: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = radius * 2
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius)
  grad.addColorStop(0, color)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, radius * 2, radius * 2)
  return c
}

export class Renderer {
  private ctx: CanvasRenderingContext2D
  private stars = new Starfield()
  private W = 1
  private H = 1
  private safeTop = 0
  private wellEase = 0
  private spinA = 0
  private glowTeal: HTMLCanvasElement
  private glowViolet: HTMLCanvasElement
  private glowGold: HTMLCanvasElement
  private scoreStr = '0'
  private lastScore = -1
  private bestStr = ''
  private lastBest = -1

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!
    this.glowTeal = makeGlow('rgba(94,242,214,0.28)', 70)
    this.glowViolet = makeGlow('rgba(192,140,255,0.30)', 85)
    this.glowGold = makeGlow('rgba(255,226,63,0.35)', 60)
  }

  resize(w: number, h: number, dpr: number, safeTop: number): void {
    this.W = w
    this.H = h
    this.safeTop = safeTop
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.stars.regenerate(w, h)
  }

  draw(sim: Sim, pointer: PointerState, dt: number, now: number): void {
    const ctx = this.ctx
    const t = now / 1000
    this.spinA += dt

    const wellVisible = pointer.active && (game.phase === 'play' || game.phase === 'dying')
    const easeTarget = wellVisible ? 1 : 0
    this.wellEase += (easeTarget - this.wellEase) * Math.min(1, dt * 18)

    ctx.fillStyle = PAL.bg
    ctx.fillRect(0, 0, this.W, this.H)

    ctx.save()
    if (fxState.shake > 0.05) {
      ctx.translate((Math.random() - 0.5) * fxState.shake, (Math.random() - 0.5) * fxState.shake)
    }

    this.stars.draw(ctx, t, pointer.x, pointer.y, this.wellEase)

    const showStation = game.phase === 'ready' || game.phase === 'play' || game.phase === 'paused'
    if (showStation) this.drawStation(sim, t)

    this.drawTrailsAndObjects(sim)
    this.drawParticles()
    if (wellVisible || this.wellEase > 0.02) this.drawWell(pointer)
    this.drawFloats()
    if (game.phase === 'dying') this.drawDeathSequence(sim)
    this.drawHud(sim)

    if (game.phase === 'ready') this.drawTitle(t)
    else if (game.phase === 'paused') this.drawPaused(t)
    else if (game.phase === 'dead') this.drawDead(t)

    ctx.restore()
  }

  // --- station: 3 ring sections = 3 hull points, masts on live sections ---
  private drawStation(sim: Sim, t: number): void {
    const ctx = this.ctx
    const sx = sim.stationX
    const sy = sim.stationY
    const hull = game.hull

    ctx.drawImage(this.glowTeal, sx - 70, sy - 70)

    const flicker = fxState.hitFlash > 0 && Math.sin(t * 42) > 0
    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate(this.spinA * 0.4)

    const gap = 0.35 // radians between ring sections
    const seg = TAU / 3
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    for (let s = 0; s < 3; s++) {
      const alive = s < hull
      ctx.strokeStyle = flicker ? PAL.bad : alive ? PAL.station : PAL.stationDark
      ctx.globalAlpha = alive ? 1 : 0.16
      const a0 = s * seg + gap / 2
      const a1 = (s + 1) * seg - gap / 2
      ctx.beginPath()
      ctx.arc(0, 0, 36, a0, a1)
      ctx.stroke()
      if (alive) {
        // mast at section midpoint
        const mid = (a0 + a1) / 2
        const cm = Math.cos(mid)
        const sm = Math.sin(mid)
        ctx.beginPath()
        ctx.moveTo(cm * 40, sm * 40)
        ctx.lineTo(cm * 48, sm * 48)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1

    // Core: teal disc, gold pulse on bank, dark center hole (icon motif)
    const bank = fxState.bankFlash
    if (bank > 0) {
      ctx.drawImage(this.glowGold, -60, -60)
      ctx.fillStyle = PAL.ore
    } else {
      ctx.fillStyle = flicker ? PAL.bad : PAL.station
    }
    ctx.beginPath()
    ctx.arc(0, 0, 17, 0, TAU)
    ctx.fill()
    ctx.fillStyle = PAL.stationHole
    ctx.beginPath()
    ctx.arc(0, 0, 8, 0, TAU)
    ctx.fill()
    ctx.restore()

    // Hull pips
    for (let i = 0; i < TUNING.station.hull; i++) {
      this.ctx.globalAlpha = i < hull ? 1 : 0.18
      this.ctx.fillStyle = PAL.station
      this.ctx.beginPath()
      this.ctx.arc(sx - 22 + i * 22, sy + 62, 5, 0, TAU)
      this.ctx.fill()
    }
    this.ctx.globalAlpha = 1
  }

  private drawTrailsAndObjects(sim: Sim): void {
    const ctx = this.ctx
    const alpha = sim.alpha
    const cap = 64 // TRAIL_CAP

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (let i = 0; i < sim.pool.count; i++) {
      const o = sim.pool.objs[i]
      const rx = o.px + (o.x - o.px) * alpha
      const ry = o.py + (o.y - o.py) * alpha

      // Trail: three batched strokes, oldest->newest, tapering width/alpha
      const len = o.trailLen
      if (len > 2) {
        const oldest = (o.trailHead - len + cap * 2) % cap
        const colors = o.type === ORE ? TRAIL_ORE : TRAIL_ROCK
        const baseW = o.type === ORE ? TUNING.trail.oreWidth : TUNING.trail.rockWidth
        for (let b = 0; b < 3; b++) {
          const batch = TRAIL_BATCHES[b]
          const i0 = Math.floor(len * batch.frac0)
          const i1 = b === 2 ? len : Math.floor(len * batch.frac1)
          if (i1 - i0 < 1) continue
          ctx.strokeStyle = colors[b]
          ctx.lineWidth = Math.max(1, baseW * batch.width)
          ctx.beginPath()
          for (let k = i0; k <= i1 && k < len; k++) {
            const idx = ((oldest + k) % cap) * 2
            const px = o.trail[idx]
            const py = o.trail[idx + 1]
            if (k === i0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
          if (b === 2) ctx.lineTo(rx, ry) // connect newest batch to the body
          ctx.stroke()
        }
      }

      // Body
      ctx.save()
      ctx.translate(rx, ry)
      ctx.rotate(o.rot)
      if (o.type === ORE) {
        // Gold hexagon — same motif as the app icon core
        ctx.fillStyle = PAL.ore
        ctx.beginPath()
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU
          const vr = o.r * (0.9 + ((k * 7) % 3) * 0.07)
          if (k === 0) ctx.moveTo(Math.cos(a) * vr, Math.sin(a) * vr)
          else ctx.lineTo(Math.cos(a) * vr, Math.sin(a) * vr)
        }
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.beginPath()
        ctx.arc(-o.r * 0.25, -o.r * 0.25, o.r * 0.22, 0, TAU)
        ctx.fill()
      } else {
        const sd = (o.seed | 0) % 5
        ctx.fillStyle = PAL.rock
        ctx.beginPath()
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * TAU
          const vr = o.r * (0.8 + ((k * 13 + sd) % 4) * 0.09)
          if (k === 0) ctx.moveTo(Math.cos(a) * vr, Math.sin(a) * vr)
          else ctx.lineTo(Math.cos(a) * vr, Math.sin(a) * vr)
        }
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = PAL.rockDark
        ctx.beginPath()
        ctx.arc(o.r * 0.2, o.r * 0.1, o.r * 0.25, 0, TAU)
        ctx.fill()
      }
      ctx.restore()
    }
  }

  // --- the signature: violet well with rotating dashed rings + infall ---
  private drawWell(pointer: PointerState): void {
    const ctx = this.ctx
    const ease = this.wellEase
    const breathe = 1 + 0.04 * Math.sin(this.spinA * 3)
    const scale = (0.6 + 0.4 * ease) * breathe

    ctx.save()
    ctx.translate(pointer.x, pointer.y)
    ctx.globalAlpha = ease
    ctx.drawImage(this.glowViolet, -85, -85)
    ctx.globalAlpha = 1

    ctx.scale(scale, scale)
    for (let i = 0; i < 3; i++) {
      ctx.rotate(this.spinA * (1.5 + i * 0.7) * (i % 2 ? -1 : 1))
      ctx.strokeStyle = PAL.well
      ctx.globalAlpha = (0.5 - i * 0.12) * ease
      ctx.setLineDash(DASH)
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(0, 0, 26 + i * 20, 0, TAU)
      ctx.stroke()
    }
    ctx.setLineDash(NO_DASH)

    // Infall sparks
    ctx.fillStyle = PAL.well
    for (let i = 0; i < wellParticles.count; i++) {
      const p = wellParticles.parts[i]
      const fade = Math.min(1, (90 - p.radius) / 60)
      ctx.globalAlpha = fade * 0.9 * ease
      ctx.beginPath()
      ctx.arc(Math.cos(p.angle) * p.radius, Math.sin(p.angle) * p.radius, 2, 0, TAU)
      ctx.fill()
    }

    ctx.globalAlpha = ease
    ctx.fillStyle = PAL.well
    ctx.beginPath()
    ctx.arc(0, 0, 5, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.restore()
  }

  private drawParticles(): void {
    const ctx = this.ctx
    for (let i = 0; i < particles.count; i++) {
      const p = particles.parts[i]
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2))
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, TAU)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  private drawFloats(): void {
    const ctx = this.ctx
    ctx.textAlign = 'center'
    ctx.font = `22px ${FONT_STACK}`
    for (let i = 0; i < floats.count; i++) {
      const f = floats.floats[i]
      ctx.globalAlpha = Math.min(1, f.life * 2)
      ctx.fillStyle = f.color
      ctx.fillText(f.text, f.x, f.y)
    }
    ctx.globalAlpha = 1
  }

  // --- death sequence: shockwaves + white flash over the shattered station ---
  private drawDeathSequence(sim: Sim): void {
    const ctx = this.ctx
    const f = game.dyingT / TUNING.dying.duration
    const sx = sim.stationX
    const sy = sim.stationY
    const maxR = Math.min(this.W, this.H) * 0.62

    for (let ring = 0; ring < 2; ring++) {
      const rf = Math.max(0, f - ring * 0.12) / (1 - ring * 0.12)
      if (rf <= 0) continue
      const eased = 1 - (1 - rf) * (1 - rf)
      ctx.globalAlpha = (1 - eased) * 0.7
      ctx.strokeStyle = ring === 0 ? PAL.station : PAL.ink
      ctx.lineWidth = 3 - ring
      ctx.beginPath()
      ctx.arc(sx, sy, 20 + eased * maxR, 0, TAU)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    const flash = Math.max(0, 0.55 * (1 - game.dyingT / 0.35))
    if (flash > 0.01) {
      ctx.globalAlpha = flash
      ctx.fillStyle = PAL.ink
      ctx.fillRect(0, 0, this.W, this.H)
      ctx.globalAlpha = 1
    }
  }

  private drawHud(sim: Sim): void {
    const ctx = this.ctx
    if (game.phase === 'ready') return
    if (game.score !== this.lastScore) {
      this.lastScore = game.score
      this.scoreStr = String(game.score)
    }
    ctx.textAlign = 'center'
    ctx.fillStyle = PAL.ink
    ctx.font = `52px ${FONT_STACK}`
    ctx.fillText(this.scoreStr, sim.stationX, this.safeTop + 58)
  }

  // --- overlays ---
  private panel(): void {
    this.ctx.fillStyle = PAL.panel
    this.ctx.fillRect(0, 0, this.W, this.H)
  }

  private drawTitle(t: number): void {
    const ctx = this.ctx
    this.panel()
    const cx = this.W / 2
    const cy = this.H * 0.3

    // Well motif behind the wordmark
    ctx.save()
    ctx.translate(cx, cy - 10)
    for (let i = 0; i < 3; i++) {
      ctx.rotate(t * (0.35 + i * 0.2) * (i % 2 ? -1 : 1))
      ctx.strokeStyle = PAL.well
      ctx.globalAlpha = 0.24 - i * 0.06
      ctx.setLineDash(DASH)
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(0, 0, 78 + i * 30, 0, TAU)
      ctx.stroke()
    }
    ctx.setLineDash(NO_DASH)
    ctx.restore()
    ctx.globalAlpha = 1

    ctx.textAlign = 'center'
    ctx.fillStyle = PAL.ink
    ctx.font = `120px ${FONT_STACK}`
    ctx.fillText('PULL', cx, cy + 34)

    ctx.font = `24px ${FONT_STACK}`
    ctx.fillStyle = PAL.ink
    ctx.globalAlpha = 0.85
    const lines = ['your finger is gravity.', 'bend rocks away from the station,', 'curl gold ore into it.', 'smash rocks together for bonus.']
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], cx, cy + 108 + i * 30)
    }
    ctx.globalAlpha = 1

    ctx.fillStyle = PAL.well
    ctx.font = `30px ${FONT_STACK}`
    ctx.fillText('TAP TO PLAY', cx, cy + 250 + Math.sin(t * 3.3) * 3)

    if (game.best > 0) {
      if (game.best !== this.lastBest) {
        this.lastBest = game.best
        this.bestStr = 'BEST ' + game.best
      }
      ctx.fillStyle = PAL.ore
      ctx.font = `22px ${FONT_STACK}`
      ctx.fillText(this.bestStr, cx, cy + 296)
    }
  }

  private drawPaused(t: number): void {
    const ctx = this.ctx
    this.panel()
    const cx = this.W / 2
    ctx.textAlign = 'center'
    ctx.fillStyle = PAL.ink
    ctx.font = `64px ${FONT_STACK}`
    ctx.fillText('PAUSED', cx, this.H * 0.42)
    ctx.fillStyle = PAL.well
    ctx.font = `26px ${FONT_STACK}`
    ctx.fillText('TAP TO RESUME', cx, this.H * 0.42 + 54 + Math.sin(t * 3.3) * 3)
  }

  private drawDead(t: number): void {
    const ctx = this.ctx
    this.panel()
    const cx = this.W / 2
    const cy = this.H * 0.32
    ctx.textAlign = 'center'

    ctx.fillStyle = PAL.bad
    ctx.font = `58px ${FONT_STACK}`
    ctx.fillText('STATION DOWN', cx, cy)

    ctx.fillStyle = PAL.ink
    ctx.font = `84px ${FONT_STACK}`
    ctx.fillText(this.scoreStr, cx, cy + 92)

    if (game.newBest) {
      ctx.fillStyle = PAL.ore
      ctx.font = `28px ${FONT_STACK}`
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 6)
      ctx.fillText('NEW BEST!', cx, cy + 134)
      ctx.globalAlpha = 1
    } else {
      if (game.best !== this.lastBest) {
        this.lastBest = game.best
        this.bestStr = 'BEST ' + game.best
      }
      ctx.fillStyle = PAL.ink
      ctx.globalAlpha = 0.7
      ctx.font = `24px ${FONT_STACK}`
      ctx.fillText(this.bestStr, cx, cy + 134)
      ctx.globalAlpha = 1
    }

    if (game.deadT >= TUNING.dying.restartLockout) {
      ctx.fillStyle = PAL.well
      ctx.font = `30px ${FONT_STACK}`
      ctx.fillText('TAP TO RETRY', cx, cy + 210 + Math.sin(t * 3.3) * 3)
    }
  }
}
