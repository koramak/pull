// 22a–22d — the tube gets tired. One float, 0→1, multiplies bloom, scanline
// alpha, vignette stop and starfield alpha, so minute 4.5 costs what
// minute 0 costs. Driven by pressure (rocks alive + ore fill) with the clock
// only setting the floor — a player clearing well is not punished with a
// dimmer screen. The 0.7px wobble arrives late (22c) and primes the tear.

import { TUNING } from './config'
import { isRock } from './sim/pool'
import type { Sim } from './sim/sim'

class Intensity {
  value = 0
  private smoothed = 0

  reset(): void {
    this.value = 0
    this.smoothed = 0
  }

  update(dt: number, sim: Sim, runTime: number): void {
    const I = TUNING.intensity
    let rocks = 0
    for (let i = 0; i < sim.pool.count; i++) {
      if (isRock(sim.pool.objs[i].kind)) rocks++
    }
    const pressure =
      I.pressureRockWeight * Math.min(1, rocks / I.pressureRocks) +
      I.pressureFillWeight * sim.station.fillFrac()
    const k = Math.min(1, dt * I.smoothing)
    this.smoothed += (pressure - this.smoothed) * k
    const floor = Math.min(1, runTime / I.clockFloorAt)
    this.value = Math.max(floor, this.smoothed)
  }

  bloomMul(): number {
    const I = TUNING.intensity
    return (I.bloom.from + (I.bloom.to - I.bloom.from) * this.value) / I.bloom.from
  }

  scanAlpha(): number {
    const I = TUNING.intensity
    return I.scanAlpha.from + (I.scanAlpha.to - I.scanAlpha.from) * this.value
  }

  vignetteInner(): number {
    const I = TUNING.intensity
    return I.vignetteInner.from + (I.vignetteInner.to - I.vignetteInner.from) * this.value
  }

  starAlpha(): number {
    const I = TUNING.intensity
    return I.stars.from + (I.stars.to - I.stars.from) * this.value
  }

  wobbleOn(): boolean {
    return this.value >= TUNING.intensity.wobbleFrom
  }
}

export const intensity = new Intensity()
