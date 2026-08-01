// The well — 31a, locked: one circle closing, r132 → r56, thickening and
// brightening as it goes, three live and staggered so something is always
// closing. Plus 33a: seven specks spiralling in behind the rings at half
// brightness and twice the duration. Nothing at the centre, ever — the
// fingertip covers 36pt. On release spawning stops and rings in flight
// finish closing; there is no idle state, because touching IS pulling.

import { TUNING } from '../config'
import { PAL, rgba } from './palette'

const TAU = Math.PI * 2

interface Ring {
  t: number
}

interface Speck {
  angle0: number
  r0: number
  life: number
  t: number
  size: number
  dir: number
}

export class WellFx {
  private rings: Ring[] = []
  private specks: Speck[] = []
  private ringClock = 0
  private wasActive = false

  update(dt: number, active: boolean): void {
    const W = TUNING.well
    if (active) {
      if (!this.wasActive) {
        // onset 0ms: the first ring starts on the same frame as the touch
        this.rings.length = 0
        this.specks.length = 0
        this.ringClock = W.ringSpawnEvery // force an immediate spawn
      }
      this.ringClock += dt
      while (this.ringClock >= W.ringSpawnEvery) {
        this.ringClock -= W.ringSpawnEvery
        this.rings.push({ t: 0 })
        if (this.rings.length > 4) this.rings.shift()
      }
      while (this.specks.length < W.dustCount) {
        this.specks.push(this.makeSpeck())
      }
    } else {
      this.ringClock = 0
    }
    this.wasActive = active

    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].t += dt
      if (this.rings[i].t >= W.ringDuration) this.rings.splice(i, 1)
    }
    for (let i = this.specks.length - 1; i >= 0; i--) {
      const s = this.specks[i]
      s.t += dt
      if (s.t >= s.life) {
        if (active) this.specks[i] = this.makeSpeck()
        else this.specks.splice(i, 1)
      }
    }
  }

  private makeSpeck(): Speck {
    const W = TUNING.well
    return {
      angle0: Math.random() * TAU,
      r0: W.dustR0min + Math.random() * (W.dustR0max - W.dustR0min),
      life: W.dustLifeMin + Math.random() * (W.dustLifeMax - W.dustLifeMin),
      t: 0,
      size: W.dustSizeMin + Math.random() * (W.dustSizeMax - W.dustSizeMin),
      dir: Math.random() < 0.5 ? -1 : 1
    }
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number): void {
    if (alpha <= 0.01) return
    const W = TUNING.well
    ctx.save()
    ctx.translate(x, y)

    // dust — white, not blue, so it reads as lit rather than coloured
    ctx.fillStyle = PAL.ship
    for (let i = 0; i < this.specks.length; i++) {
      const s = this.specks[i]
      const f = easeIn(s.t / s.life)
      const r = s.r0 + (W.dustR1 - s.r0) * f
      const a = s.angle0 + s.dir * (W.dustDriftDeg * Math.PI / 180) * f
      const fade = s.t / s.life < 0.22 ? (s.t / s.life) / 0.22 : 1 - Math.max(0, (s.t / s.life - 0.76)) / 0.24
      ctx.globalAlpha = alpha * W.dustPeakAlpha * Math.max(0, Math.min(1, fade))
      ctx.beginPath()
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, s.size, 0, TAU)
      ctx.fill()
    }

    // rings — stroke thickens 1 → 2.4 as the circle closes
    ctx.strokeStyle = PAL.rock
    ctx.shadowColor = 'rgba(159,214,232,0.6)'
    for (let i = 0; i < this.rings.length; i++) {
      const f = easeIn(this.rings[i].t / W.ringDuration)
      const r = W.ringR0 + (W.ringR1 - W.ringR0) * f
      const lin = this.rings[i].t / W.ringDuration
      const a = lin < 0.14 ? lin / 0.14 * 0.7 : lin < 0.8 ? 0.7 + ((lin - 0.14) / 0.66) * 0.3 : (1 - lin) / 0.2
      ctx.globalAlpha = alpha * Math.max(0, Math.min(1, a))
      ctx.lineWidth = W.ringW0 + (W.ringW1 - W.ringW0) * f
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, TAU)
      ctx.stroke()
    }
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
    ctx.restore()
  }

  /** Anything still closing? (release lets rings in flight finish) */
  liveCount(): number {
    return this.rings.length + this.specks.length
  }

  clear(): void {
    this.rings.length = 0
    this.specks.length = 0
    this.wasActive = false
  }
}

function easeIn(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  // cubic-bezier(.42,0,.92,.48) ≈ accelerating fall
  return x * x * (1.6 - 0.6 * x)
}
