// ---------------------------------------------------------------------------
// PULL — all gameplay + presentation tuning in one hot-reloadable object.
// Physics baseline: prototype/pull.html (well, spawn, smash rules).
// Visual + systems spec: design/ "PULL - Phosphor Kit" — values here are
// lifted from that document (r44 station, 31a well, 13e echoes, hull 3→6,
// intensity ramp 22a–22d, upgrade freeze/swipe/surge, ships r61…).
// Nothing in sim/render/fx holds a tuned literal.
//
// UNITS: the whole game runs in "kit points" — the design was authored on a
// 393×852 stage. The renderer scales world→screen uniformly, so every value
// below matches the kit 1:1.
// ---------------------------------------------------------------------------

export const TUNING = {
  layout: {
    refWidth: 393,     // kit stage
    refHeight: 852,
    minScale: 0.75,
    maxScale: 1.45
  },

  station: {
    xFrac: 0.5,        // station anchor, fraction of viewport
    yFrac: 0.52,       // same 52% anchor at every aspect (kit Android proof)
    radius: 44,        // collision ring — r44 AT EVERY STAGE, never changes
    coreRadius: 18,    // core ring (reservoir inside at r16)
    sections: 3,       // base hull resolution; HULL upgrades: 3 → 4 → 5 → 6
    maxSections: 6,    // below 60° a section stops reading as a wound
    boundaryGapDeg: 6, // dark gap straddling each section boundary
    flareLen: 5,       // boundary flares: 5px outward kicks at ring weight
    titleYFrac: 0.458  // station sits higher on the title screen (kit 24b)
  },

  well: {
    // a = strength / (d² + softening), toward the finger (prototype baseline)
    strength: 9.5e6,
    softening: 3600,
    maxAccel: 2400,
    touchAccel: 120,   // above this an object counts as "touched" (deflect bonus)
    // F1 — the grab: force ramps in with ease-out and decays on release.
    // The decay doubles as forgiveness: a thumb slip mid-slingshot keeps
    // pulling for ~120ms. Total attack stays under 100ms so it reads instant.
    attack: 0.075,     // s to full strength after touch
    release: 0.12,     // s of decaying pull after lift
    // 31a — the contracting circle (+ 33a dust)
    ringSpawnEvery: 0.53,  // three live, staggered — one is always closing
    ringDuration: 1.6,     // r132 → r56, ease-in
    ringR0: 132,
    ringR1: 56,
    ringW0: 1,             // stroke thickens as it closes
    ringW1: 2.4,
    dustCount: 7,          // specks spiralling in behind the rings
    dustR0min: 88,
    dustR0max: 126,
    dustR1: 56,
    dustDriftDeg: 46,
    dustLifeMin: 1.7,
    dustLifeMax: 2.4,
    dustSizeMin: 0.85,
    dustSizeMax: 1.2,
    dustPeakAlpha: 0.5
  },

  // 13e — echoes in the well: persistence only under the finger.
  echoes: {
    delaysMs: [80, 160, 240],
    alphas: [0.52, 0.30, 0.16],
    maskRadius: 190       // soft field on the fingertip; tails fade past this
  },

  // 13d — near-miss flare on the station, with the gap in pixels.
  nearMiss: {
    maxGap: 64,           // surface gap (px) that counts as a genuine near miss
    minApproachSpeed: 120,
    flareDuration: 0.5,
    cooldown: 0.45
  },

  difficulty: {
    curve: [
      { t: 0,   spawnInterval: 1.7,  speedBonus: 0,  oreChance: 0.32, monolithChance: 0.10 },
      { t: 90,  spawnInterval: 0.75, speedBonus: 55, oreChance: 0.32, monolithChance: 0.22 },
      { t: 210, spawnInterval: 0.55, speedBonus: 80, oreChance: 0.30, monolithChance: 0.30 }
    ],
    intervalJitterMin: 0.7,
    intervalJitterMax: 1.3,
    rubbleShareOfHeavies: 0.35 // rubble is a variant of the heavy class
  },

  spawn: {
    speedMin: 70,
    speedMax: 140,
    aimSpread: 0.45,
    edgeMargin: 34,
    firstDelay: 1.0
  },

  // 14c monolith & rubble (+ 14b's ladder). Radii are draw scale factors on
  // the authored shapes; hp = ship shots to break. ≥4 sides everywhere.
  rocks: {
    monolith: { rMin: 24, rMax: 30, hp: 4, spinMax: 1.6 },
    medium:   { rMin: 15, rMax: 22, hp: 2, spinMax: 2.4 },
    shard:    { rMin: 10, rMax: 13, hp: 1, spinMax: 4.0 },
    chip:     { rMin: 5,  rMax: 7,  hp: 1, spinMax: 5.0 },
    rubble:   { rMin: 20, rMax: 25, hp: 2, spinMax: 1.8 },
    ore:      { r: 14 },
    // splits: each rock breaks to the next class down (heavy→2 medium→2
    // shards each→a chip). Shards spin out at 4–5 turns/s — the only fast
    // rotation the game allows.
    splitSpread: 130,      // px/s added outward to fragments
    fragSpinMin: 25,       // rad/s  (≈4 turns/s)
    fragSpinMax: 31.5,     // rad/s  (≈5 turns/s)
    fragLife: 0            // fragments are real objects, they live until used
  },

  objects: {
    maxCount: 160,
    offscreenMargin: 90
  },

  collision: {
    smashSpeed: 180,      // closing speed above this destroys both
    gridCell: 72          // ≥ 2×max rock radius
  },

  score: {
    bank: 25,             // ore into the core (×2 while the reservoir is full)
    smash: 10,
    deflect: 5
  },

  // F2 — deformation derived from the sim. Objects stretch along velocity
  // (area-conserving), squash on soft contact, and ore idles with a shimmer
  // so the eye finds the reward.
  feel: {
    stretchK: 0.16,        // stretch fraction at the reference speed
    stretchRefSpeed: 620,  // px/s of "full" stretch
    stretchMax: 0.24,      // hard cap on the deformation
    squashDur: 0.1,        // s of impact squash after a soft bounce
    squashAmt: 0.2,
    oreShimmerAmp: 0.045,  // idle scale wobble on ore
    oreShimmerHz: 2.2,
    gulpDur: 0.18,         // station core "gulp" on a bank
    gulpAmt: 0.12
  },

  // F3 — hit-stop tiers by meaning (the world freezes; the finger never does).
  // The hull value is deliberately long: your worst moment stops the world.
  // On death it bleeds into the collapse timescale (×0.3) → ~400ms real stop.
  hitStops: {
    bank: 0.03,
    smash: 0.05,
    hull: 0.12
  },

  // F4 — trauma screen shake: add per event, amplitude = trauma², driven by
  // smooth noise with a little roll. Overlapping hits compound and cap at 1.
  trauma: {
    maxOffset: 14,        // px at full trauma (≈3.5% of the stage width)
    maxRoll: 0.05,        // rad at full trauma
    decayPerSec: 1.25,
    bank: 0.08,           // a positive thump, barely there
    smash: 0.12,
    smashNear: 0.2,       // smashes close to the hull hit harder
    smashNearRadius: 170,
    surge: 0.15,
    collapse: 0.75
  },

  // The reservoir: warm light stored inside the core. Full = upgrade armed.
  reservoir: {
    unitsPerBank: 5,      // ore units credited per banked ore
    baseCapacity: 40,     // N2 — 8 banks to the first choice (~35-45s of play)
    capacityGrowth: 1.5,  // CAPACITY track: ×1.5 per purchase
    spillFraction: 0.25,  // a hull hit takes a quarter of your ore
    fullPulsePeriod: 1.05 // the only pulsing element in the game
  },

  // Upgrade moment — full, frozen, swiped, spent.
  choice: {
    freezeDim: 0.16,      // field holds at 16%
    enterDelay: 0.12,     // s after release-with-full-reservoir
    fadeIn: 0.25,
    flickThreshold: 26,   // px of pointer travel that commits a direction
    flickTravel: 0.48,    // bracket travels to the plate
    lockFlash: 0.25,      // white ring — the only white flash outside a smash
    surge: 0.44,          // warm ring collapses INWARD (the only inward motion)
    build: 0.35,          // structure snaps out, 30ms stagger, 16% overshoot
    restore: 0.30,        // field back to full
    plateRadius: 62,      // 124pt circles
    plateOffsets: [       // triangle: top, bottom-left, bottom-right
      { x: 0,    y: -146 },
      { x: -120, y: 104 },
      { x: 120,  y: 104 }
    ] as ReadonlyArray<{ x: number; y: number }>,
    maxCapacity: 3,
    maxShips: 3
  },

  // Ships — the only thing on screen that points.
  ships: {
    orbitRadius: 61,
    orbitPeriod: 14,      // slow even sweep
    range: 270,           // furthest rock a ship will engage
    reload: 2.0,          // M9 — floor; ships stay scarce
    damage: 2,            // N3 — a shot breaks a medium outright, monolith in two
    knockback: 90,        // N3 — px/s shove along the tracer; every shot visibly acts
    tracerDuration: 0.09, // 1px white tracer, 90ms, no projectile
    aimLead: 3.2,         // s of look-ahead when testing "collision course"
    hitFlash: 0.09
  },

  // Hull hit — the tube reports damage. Depth scales with resolution
  // (chosen "more extreme" curve), one-section-left snaps to full alarm.
  hullHit: {
    // F8 — the flicker never blinds: dips floor at ~45% and stay ≤100ms so
    // the field stays readable at the exact moment reading it matters most.
    // per live-section-count BEFORE the hit: [dropout alphas], tear px, trauma, duration s
    flicker: {
      3: { dips: [0.45, 0.50, 0.55], tear: 20, trauma: 0.5, duration: 0.10 },
      4: { dips: [0.50, 0.62], tear: 11, trauma: 0.38, duration: 0.09 },
      5: { dips: [0.70, 0.92], tear: 5, trauma: 0.26, duration: 0.054 },
      6: { dips: [0.88], tear: 2, trauma: 0.18, duration: 0.036 }
    } as Record<number, { dips: number[]; tear: number; trauma: number; duration: number }>,
    spillChips: 3,        // warm chips spinning out of the core — the only
    tearLineWidth: 1      // time warm light leaves the station. 1px line.
  },

  smash: {
    // two thin expanding rings and nothing else; white is reserved for this
    ringA: { r0: 12, r1: 92, grow: 0.24, w: 1.6 },
    ringB: { r0: 6, r1: 46, grow: 0.16, w: 1.2 },
    duration: 0.45        // contact → empty space
  },

  // N1 + L5 — the title is a live field: slow rocks drifting through, and
  // the play target is itself an asteroid sitting where the station will be.
  title: {
    attractEvery: 2.2,    // s between drifters (jittered)
    attractSpeedMin: 30,
    attractSpeedMax: 58,
    attractMax: 9,        // drifters alive at once
    attractSpread: 0.9,   // rad — aimed loosely across mid-screen
    fieldAlpha: 0.5,      // the field sits behind the shell type
    playRockScale: 2.05,  // monolith outline × this = the PLAY target
    playSpin: 0.05        // rad/s idle rotation
  },

  // M2 — the wager must be perceptible: the full-reservoir hint runs the
  // first two times only, then the game trusts you.
  hints: {
    fullShows: 2,
    fullDuration: 3.2
  },

  // 22a–22d — the tube gets tired. One float drives everything.
  intensity: {
    clockFloorAt: 270,    // s to reach floor 1.0 (the clock only sets the floor)
    pressureRocks: 26,    // rocks alive that count as full pressure
    pressureRockWeight: 0.6,
    pressureFillWeight: 0.4,
    smoothing: 2.2,       // 1/s toward target
    bloom: { from: 2.4, to: 7.6 },
    scanAlpha: { from: 0.30, to: 0.54 },
    vignetteInner: { from: 0.58, to: 0.35 },
    stars: { from: 0.60, to: 0.16 },
    wobbleFrom: 0.66,     // the 0.7px wobble arrives at 22c and holds
    wobblePx: 0.7,
    wobblePeriod: 1.1
  },

  // Rotating starfield 10a — the station is the fixed point of the world.
  starfield: {
    periods: [150, 240, 400],   // s per revolution, near → far
    counts: [26, 34, 44],
    alphas: [0.5, 0.30, 0.14],
    blurs: [0, 0.35, 0.7],
    sizeMin: 1,
    sizeMax: 2
  },

  sim: {
    dt: 1 / 120,
    maxFrameDt: 0.033,
    maxStepsPerFrame: 8
  },

  // Death — a CRT losing power. Beats in seconds from hull 0.
  collapse: {
    blowout: 0.6,
    arcsApart: 1.2,
    beamCollapse: 1.6,
    dotBurnIn: 2.4,
    toResult: 2.75,       // then the result screen staggers its text in
    fieldDim: 0.07        // the rest of the field dims and never comes back
  },

  shell: {
    resultToTitle: 12,    // s untouched on RESULT goes back to TITLE
    pausedMaxAge: 300,    // runs older than 5 min are discarded
    resetHold: 1.2,       // RESET BEST is a hold, not a dialogue
    playButtonRadius: 68,
    smallButtonRadius: 42,
    gainRise: 44,         // gains rise 44px over 420ms
    gainLife: 0.42
  },

  firstRun: {
    hintAfter: 2.5,       // s of no touch before the fingertip hint pulses
    guideLookahead: 2.6,  // s of trajectory drawn for the beat-one guide
    holdX: 0.5,           // suggested hold point (fractions of viewport)
    holdY: 0.82
  },

  fx: {
    maxParticles: 256,
    maxFloats: 24,
    floatRise: 44,
    floatLife: 0.42
  },

  audio: {
    master: 0.5,
    // S1 — phone speakers reproduce almost nothing below ~150-200Hz; a
    // master high-pass reclaims headroom and everything is voiced above it.
    highpassHz: 145,
    // ducking: on a hull hit the rest of the mix drops so the gap carries it
    duckTo: 0.3,
    duckHold: 0.25,
    duckRelease: 0.3,
    // S2 — streak ladder, pentatonic-ish ratios (1 · 9/8 · 5/4 · 3/2 · 5/3 · 2):
    // overlapping chimes always stay consonant.
    ladder: [1, 1.125, 1.25, 1.5, 1.6667, 2],
    bankBaseHz: 660,
    smashBaseHz: 500,
    streakResetAfter: 5,  // s without a bank drops the ladder back down
    chainWindow: 1.5,     // s between smashes that continue the chain
    pitchJitter: 0.05,    // ±5% on repeated one-shots so they never machine-gun
    collapseDelay: 0.35,  // s of silence under the death stop before the sweep
    voiceWindow: 0.5,     // S4 — minor sounds are dropped when the mix is busy
    maxMinorVoices: 4
  }
} as const

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

// --- difficulty sampling ---------------------------------------------------

export interface DifficultySample {
  spawnInterval: number
  speedBonus: number
  oreChance: number
  monolithChance: number
}

export function sampleDifficulty(t: number, out: DifficultySample): DifficultySample {
  const curve = TUNING.difficulty.curve
  const first = curve[0]
  const last = curve[curve.length - 1]
  if (t <= first.t) return copy(first, out)
  if (t >= last.t) return copy(last, out)
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i]
    const b = curve[i + 1]
    if (t >= a.t && t <= b.t) {
      const f = (t - a.t) / (b.t - a.t || 1)
      out.spawnInterval = a.spawnInterval + (b.spawnInterval - a.spawnInterval) * f
      out.speedBonus = a.speedBonus + (b.speedBonus - a.speedBonus) * f
      out.oreChance = a.oreChance + (b.oreChance - a.oreChance) * f
      out.monolithChance = a.monolithChance + (b.monolithChance - a.monolithChance) * f
      return out
    }
  }
  return copy(last, out)
}

function copy(k: { spawnInterval: number; speedBonus: number; oreChance: number; monolithChance: number }, out: DifficultySample): DifficultySample {
  out.spawnInterval = k.spawnInterval
  out.speedBonus = k.speedBonus
  out.oreChance = k.oreChance
  out.monolithChance = k.monolithChance
  return out
}
