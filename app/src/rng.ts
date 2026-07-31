// Seedable RNG behind an interface so a future daily-run mode can hand the
// sim a fixed seed while everything else keeps using system randomness.

export interface RNG {
  /** Uniform in [0, 1). */
  next(): number
  /** Uniform in [min, max). */
  range(min: number, max: number): number
}

export class SystemRNG implements RNG {
  next(): number { return Math.random() }
  range(min: number, max: number): number { return min + Math.random() * (max - min) }
}

/** Mulberry32 — small, fast, plenty for gameplay. */
export class SeededRNG implements RNG {
  private s: number
  constructor(seed: number) { this.s = seed >>> 0 }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  range(min: number, max: number): number { return min + this.next() * (max - min) }
}
