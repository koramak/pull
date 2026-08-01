// 10a — stars only, rotating about the station: three tiled depth layers
// turning at 150/240/400s, so the station is the fixed point of the world
// and the universe orbits it. Depth is differential rate + blur + luminance,
// no geometry. Each layer is a square offscreen that covers the screen
// diagonal, so it can turn forever without an edge arriving.

import { TUNING } from '../config'
import { SeededRNG } from '../rng'
import { PAL, rgba } from './palette'

export class Starfield {
  private layers: HTMLCanvasElement[] = []
  private side = 0        // world units
  private px = 0          // device pixels per world unit

  regenerate(worldW: number, worldH: number, px: number): void {
    const side = Math.ceil(Math.hypot(worldW, worldH)) + 8
    if (side === this.side && Math.abs(px - this.px) < 0.01) return
    this.side = side
    this.px = px
    this.layers.length = 0
    const S = TUNING.starfield
    const rng = new SeededRNG(0xC0FFEE)
    for (let k = 0; k < S.periods.length; k++) {
      const c = document.createElement('canvas')
      const dev = Math.ceil(side * px)
      c.width = dev
      c.height = dev
      const g = c.getContext('2d')!
      g.setTransform(px, 0, 0, px, 0, 0)
      if (S.blurs[k] > 0) {
        // atmospheric perspective: anything behind the plane gets blur and
        // never gets bloom
        try { g.filter = `blur(${S.blurs[k]}px)` } catch { /* older engines */ }
      }
      for (let i = 0; i < S.counts[k]; i++) {
        const x = rng.next() * side
        const y = rng.next() * side
        const size = rng.range(S.sizeMin, S.sizeMax)
        g.fillStyle = rgba(PAL.star, 0.7 + rng.next() * 0.3)
        g.fillRect(x, y, size, size)
      }
      g.filter = 'none'
      this.layers.push(c)
    }
  }

  /**
   * Draw centred on (cx, cy) — the station anchor. `globalAlpha` is the
   * intensity-driven starfield level (0.60 at minute 0 → 0.16 at 4.5).
   */
  draw(ctx: CanvasRenderingContext2D, t: number, cx: number, cy: number, globalAlpha: number): void {
    const S = TUNING.starfield
    const half = this.side / 2
    for (let k = 0; k < this.layers.length; k++) {
      const angle = (t / S.periods[k]) * Math.PI * 2
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(angle)
      ctx.globalAlpha = S.alphas[k] * (globalAlpha / S.alphas[0])
      ctx.drawImage(this.layers[k], -half, -half, this.side, this.side)
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }
}
