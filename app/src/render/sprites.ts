// Pre-rendered object sprites with the bloom baked in — shadowBlur is the
// one thing that would eat the frame budget, so it runs at bake time, not
// per frame. Shapes are the kit's authored vertices, 1:1 in world units.
// Every kind gets a lit variant (glow) and a plain variant (13e echoes draw
// with no bloom).

import { ORE, MONOLITH, MEDIUM, SHARD, CHIP, RUBBLE } from '../sim/pool'
import { PAL, rgba } from './palette'

interface ShapeSpec {
  /** Nominal radius the sprite is authored at (world units). */
  r: number
  glow: number
  draw(g: CanvasRenderingContext2D): void
}

// Weight hierarchy (kit BEAM WEIGHT): lit leading edge 2.4 near-white, dark
// trailing edge 1.0 hairline; light from the upper left. Ore 2.6 with a 1.1
// facet. Nothing is ever a triangle.

function poly(g: CanvasRenderingContext2D, pts: number[], close: boolean): void {
  g.beginPath()
  g.moveTo(pts[0], pts[1])
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1])
  if (close) g.closePath()
}

const SHAPES: Record<number, ShapeSpec> = {
  [MONOLITH]: {
    r: 27,
    glow: 5,
    draw(g) {
      g.strokeStyle = PAL.rockLit
      g.lineWidth = 2.4
      poly(g, [-26, -6, -20, -20, 0, -28, 22, -15], false)
      g.stroke()
      g.strokeStyle = rgba(PAL.rockDark, 0.8)
      g.lineWidth = 1
      poly(g, [22, -15, 27, 10, 6, 27, -20, 19, -26, -6], false)
      g.stroke()
    }
  },
  [MEDIUM]: {
    r: 22,
    glow: 5,
    draw(g) {
      g.strokeStyle = PAL.rockLit
      g.lineWidth = 2.4
      poly(g, [-22, 2, -16, -16, 0, -22, 16, -15], false)
      g.stroke()
      g.strokeStyle = rgba(PAL.rockDark, 0.8)
      g.lineWidth = 1
      poly(g, [16, -15, 22, 4, 10, 20, -12, 18, -22, 2], false)
      g.stroke()
    }
  },
  [SHARD]: {
    r: 12,
    glow: 4,
    draw(g) {
      g.strokeStyle = rgba(PAL.rock, 0.8)
      g.lineWidth = 1.3
      poly(g, [0, -12, 9, -4, 6, 10, -4, 12, -10, 2], true)
      g.stroke()
    }
  },
  [CHIP]: {
    r: 5,
    glow: 0,
    draw(g) {
      g.strokeStyle = rgba(PAL.rock, 0.6)
      g.lineWidth = 1
      poly(g, [0, -5, 5, -1, 3, 5, -5, 2], true)
      g.stroke()
    }
  },
  [RUBBLE]: {
    r: 23,
    glow: 5,
    draw(g) {
      // a body with loose satellites — comes apart on a graze
      g.strokeStyle = rgba(PAL.rock, 0.9)
      g.lineWidth = 1.6
      poly(g, [0, -13, 11, -8, 13, 4, 4, 12, -8, 10, -13, -2], true)
      g.stroke()
      g.lineWidth = 1
      g.strokeStyle = rgba(PAL.rock, 0.7)
      poly(g, [15, -14, 20, -10, 18, -4, 12, -7], true)
      g.stroke()
      poly(g, [-14, 10, -9, 14, -13, 19, -18, 15], true)
      g.stroke()
      poly(g, [10, 14, 15, 12, 17, 17, 11, 19], true)
      g.stroke()
    }
  },
  [ORE]: {
    r: 14,
    glow: 8,
    draw(g) {
      g.strokeStyle = PAL.ore
      g.lineWidth = 2.6
      poly(g, [0, -14, 12, -7, 12, 7, 0, 14, -12, 7, -12, -7], true)
      g.stroke()
      g.strokeStyle = rgba(PAL.oreFacet, 0.55)
      g.lineWidth = 1.1
      poly(g, [-12, -7, 0, 0, 12, -7], false)
      g.stroke()
    }
  }
}

const GLOW_COLOR: Record<number, string> = {
  [MONOLITH]: 'rgba(159,214,232,0.45)',
  [MEDIUM]: 'rgba(159,214,232,0.45)',
  [SHARD]: 'rgba(159,214,232,0.40)',
  [CHIP]: 'rgba(159,214,232,0.30)',
  [RUBBLE]: 'rgba(159,214,232,0.45)',
  [ORE]: 'rgba(255,226,63,0.85)'
}

export interface Sprite {
  canvas: HTMLCanvasElement
  /** Center offset and world-unit size of the canvas. */
  half: number
  /** Nominal radius, for scale = o.r / nominal. */
  nominal: number
}

export class SpriteSet {
  lit = new Map<number, Sprite>()
  plain = new Map<number, Sprite>()
  private px = 0 // device pixels per world unit at last bake

  /** (Re)bake all sprites at the given device-pixels-per-world-unit. */
  bake(px: number): void {
    if (Math.abs(px - this.px) < 0.01) return
    this.px = px
    this.lit.clear()
    this.plain.clear()
    for (const key of [ORE, MONOLITH, MEDIUM, SHARD, CHIP, RUBBLE]) {
      const spec = SHAPES[key]
      this.lit.set(key, this.render(spec, GLOW_COLOR[key], px, true))
      this.plain.set(key, this.render(spec, GLOW_COLOR[key], px, false))
    }
  }

  private render(spec: ShapeSpec, glowColor: string, px: number, withGlow: boolean): Sprite {
    const pad = spec.glow * 2 + 4
    const half = spec.r + pad
    const size = Math.ceil(half * 2 * px)
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const g = c.getContext('2d')!
    g.setTransform(px, 0, 0, px, half * px, half * px)
    g.lineJoin = 'round'
    g.lineCap = 'round'
    if (withGlow && spec.glow > 0) {
      // Pass 1: with shadow. Pass 2: clean on top (kit Canvas 2D recipe).
      g.shadowColor = glowColor
      g.shadowBlur = spec.glow * px
      spec.draw(g)
      g.shadowBlur = 0
    }
    spec.draw(g)
    return { canvas: c, half, nominal: spec.r }
  }
}

/** Draw the ship dart (live stroke — three at most, and it must stay crisp). */
export function drawDart(g: CanvasRenderingContext2D, x: number, y: number, angle: number, glow: boolean, scale = 1): void {
  g.save()
  g.translate(x, y)
  g.rotate(angle)
  if (scale !== 1) g.scale(scale, scale)
  g.strokeStyle = PAL.ship
  g.lineWidth = 1
  g.lineJoin = 'round'
  if (glow) {
    g.shadowColor = 'rgba(234,252,255,0.9)'
    g.shadowBlur = 4
  }
  g.beginPath()
  g.moveTo(0, -4.1)
  g.lineTo(2.9, 3.4)
  g.lineTo(0, 1.7)
  g.lineTo(-2.9, 3.4)
  g.closePath()
  g.stroke()
  g.shadowBlur = 0
  g.restore()
}
