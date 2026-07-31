// Deterministic parallax starfield. Regenerated on resize from a fixed seed
// so layout is stable per viewport. Stars near the well are displaced toward
// the finger — the cheap read of "space itself bends here".

import { SeededRNG } from '../rng'
import { PAL } from './palette'

interface Star {
  x: number
  y: number
  size: number
  depth: number // 0.35..1, deeper stars warp more and twinkle less
  phase: number
  alpha: number
}

const COUNT = 90

// Quantized alpha LUT so twinkling never allocates strings in the frame loop
const ALPHA_STEPS = 24
const COLOR_LUT: string[] = []
for (let i = 0; i < ALPHA_STEPS; i++) {
  COLOR_LUT.push(`rgba(${PAL.star},${(i / (ALPHA_STEPS - 1) * 0.5).toFixed(3)})`)
}

export class Starfield {
  private stars: Star[] = []

  regenerate(w: number, h: number): void {
    const rng = new SeededRNG(0xC0FFEE)
    this.stars.length = 0
    for (let i = 0; i < COUNT; i++) {
      this.stars.push({
        x: rng.next() * w,
        y: rng.next() * h,
        size: rng.next() < 0.85 ? 1.5 : 2.5,
        depth: rng.range(0.35, 1),
        phase: rng.next() * Math.PI * 2,
        alpha: rng.range(0.14, 0.4)
      })
    }
  }

  draw(ctx: CanvasRenderingContext2D, t: number, wellX: number, wellY: number, wellEase: number): void {
    const warp = wellEase > 0.001
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i]
      let x = s.x
      let y = s.y
      if (warp) {
        const dx = wellX - x
        const dy = wellY - y
        const d = Math.hypot(dx, dy) + 40
        const pull = Math.min(16, 2600 / d) * s.depth * wellEase
        x += (dx / d) * pull
        y += (dy / d) * pull
      }
      const tw = 0.75 + 0.25 * Math.sin(t * (0.6 + s.depth) + s.phase)
      let idx = Math.round(s.alpha * tw * 2 * (ALPHA_STEPS - 1))
      if (idx >= ALPHA_STEPS) idx = ALPHA_STEPS - 1
      ctx.fillStyle = COLOR_LUT[idx]
      ctx.fillRect(x, y, s.size, s.size)
    }
  }
}
