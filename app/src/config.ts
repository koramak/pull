// ---------------------------------------------------------------------------
// PULL — all gameplay tuning in one hot-reloadable object.
// Nothing in the sim/render/fx modules holds a tuned literal; it all reads
// from here every time it's needed, so edits land live via Vite HMR.
// Physics baseline: prototype/pull.html — do not "fix" feel constants here
// without playing them.
// ---------------------------------------------------------------------------

export const TUNING = {
  station: {
    xFrac: 0.5,        // station center, fraction of viewport width
    yFrac: 0.52,       // fraction of viewport height
    radius: 26,        // collision radius, px
    hull: 3
  },

  well: {
    strength: 9.5e6,   // a = strength / (d^2 + softening)
    softening: 3600,
    maxAccel: 2400,    // px/s^2 cap
    touchAccel: 120    // accel above this marks an object "touched" (deflect bonus eligible)
  },

  // Difficulty director: sampled by elapsed run time, linear between keys.
  // Add keys (or later, score-keyed curves) without touching sim code.
  difficulty: {
    curve: [
      { t: 0,  spawnInterval: 1.7,  speedBonus: 0,  oreChance: 0.32 },
      { t: 90, spawnInterval: 0.55, speedBonus: 70, oreChance: 0.32 }
    ],
    intervalJitterMin: 0.7,
    intervalJitterMax: 1.3
  },

  spawn: {
    speedMin: 70,
    speedMax: 140,     // + speedBonus from the curve
    aimSpread: 0.45,   // radians, +/- around a line to the station
    edgeMargin: 30,    // spawn this far outside the viewport
    firstDelay: 1.0    // seconds before the first spawn of a run
  },

  objects: {
    rockRadiusMin: 15,
    rockRadiusMax: 24,
    oreRadius: 13,
    maxCount: 128,     // pool capacity
    offscreenMargin: 80,
    spinMax: 3         // rad/s, +/-
  },

  collision: {
    smashSpeed: 180,   // closing speed above this destroys both
    gridCell: 64       // uniform grid cell size, px
  },

  score: {
    bank: 25,          // ore into station
    smash: 10,         // rock-on-rock
    deflect: 5         // touched rock leaves the field
  },

  sim: {
    dt: 1 / 120,       // fixed timestep
    maxFrameDt: 0.033, // clamp on real frame delta (prototype behavior, fallback)
    maxStepsPerFrame: 8
  },

  trail: {
    length: 28,        // ring buffer points per object
    pushEvery: 2,      // sim steps between trail points (2 => 60Hz points)
    rockWidth: 5,
    oreWidth: 6,
    alpha: 0.5
  },

  dying: {
    duration: 1.5,     // seconds of death sequence before the panel
    timeScale: 0.28,   // slow-mo factor during the sequence
    restartLockout: 0.6
  },

  fx: {
    maxParticles: 512,
    maxFloats: 32,
    maxWellParticles: 72,
    wellParticleRate: 80,   // per second while pressed
    shakeHullHit: 14,
    shakeDeath: 26,
    shakeDecay: 40
  },

  audio: {
    master: 0.5
  }
} as const

// Non-const view for HMR patching and the debug overlay.
export type Tuning = typeof TUNING

if (import.meta.hot) {
  import.meta.hot.accept(mod => {
    if (mod) deepPatch(TUNING as unknown as Record<string, unknown>, mod.TUNING)
  })
}

function deepPatch(target: Record<string, unknown>, src: Record<string, unknown>): void {
  for (const k of Object.keys(src)) {
    const s = src[k]
    const t = target[k]
    if (s && t && typeof s === 'object' && typeof t === 'object' && !Array.isArray(s)) {
      deepPatch(t as Record<string, unknown>, s as Record<string, unknown>)
    } else {
      target[k] = s
    }
  }
}

// Sample the difficulty curve at elapsed time t (seconds).
export interface DifficultySample {
  spawnInterval: number
  speedBonus: number
  oreChance: number
}

export function sampleDifficulty(t: number, out: DifficultySample): DifficultySample {
  const curve = TUNING.difficulty.curve
  const first = curve[0]
  const last = curve[curve.length - 1]
  if (t <= first.t) {
    out.spawnInterval = first.spawnInterval; out.speedBonus = first.speedBonus; out.oreChance = first.oreChance
    return out
  }
  if (t >= last.t) {
    out.spawnInterval = last.spawnInterval; out.speedBonus = last.speedBonus; out.oreChance = last.oreChance
    return out
  }
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i], b = curve[i + 1]
    if (t >= a.t && t <= b.t) {
      const f = (t - a.t) / (b.t - a.t || 1)
      out.spawnInterval = a.spawnInterval + (b.spawnInterval - a.spawnInterval) * f
      out.speedBonus = a.speedBonus + (b.speedBonus - a.speedBonus) * f
      out.oreChance = a.oreChance + (b.oreChance - a.oreChance) * f
      return out
    }
  }
  out.spawnInterval = last.spawnInterval; out.speedBonus = last.speedBonus; out.oreChance = last.oreChance
  return out
}
