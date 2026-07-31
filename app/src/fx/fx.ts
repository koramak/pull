// Juice orchestrator: subscribes to sim events, drives particles, floating
// text, and screen shake. Runs on real frame time.

import { TUNING } from '../config'
import { on } from '../events'
import { PAL } from '../render/palette'
import { ParticlePool } from './particles'
import { FloatPool } from './floats'
import { WellParticlePool } from './well'

export const particles = new ParticlePool(TUNING.fx.maxParticles)
export const floats = new FloatPool(TUNING.fx.maxFloats)
export const wellParticles = new WellParticlePool(TUNING.fx.maxWellParticles)

export const fxState = {
  shake: 0,
  /** Station core gold pulse after banking ore. */
  bankFlash: 0,
  /** Station red flicker after a hull hit. */
  hitFlash: 0,
  /** White flash + shockwave clock for the death sequence. */
  deathAt: -1
}

export function initFx(): void {
  on('runStart', () => {
    particles.clear()
    floats.clear()
    fxState.shake = 0
    fxState.bankFlash = 0
    fxState.hitFlash = 0
    fxState.deathAt = -1
  })

  on('smash', e => {
    particles.burst(e.x, e.y, e.bothRocks ? PAL.rock : PAL.ore, 16, 300)
    if (e.bothRocks) floats.spawn(e.x, e.y, '+' + TUNING.score.smash + ' SMASH', PAL.ink)
    else floats.spawn(e.x, e.y, 'ORE LOST', PAL.oreDark)
  })

  on('bank', e => {
    particles.burst(e.x, e.y, PAL.ore, 16, 320)
    floats.spawn(e.x, e.y - 50, '+' + e.score + ' ORE', PAL.ore)
    fxState.bankFlash = 0.35
  })

  on('hullHit', e => {
    particles.burst(e.x, e.y, PAL.bad, 20, 360)
    if (e.hull > 0) {
      floats.spawn(e.x, e.y - 50, 'HULL HIT!', PAL.bad)
    } else {
      // Final hit — station shatter for the death sequence
      particles.burst(e.x, e.y, PAL.station, 40, 500)
      particles.burst(e.x, e.y, PAL.ink, 14, 220)
    }
    fxState.shake = TUNING.fx.shakeHullHit
    fxState.hitFlash = 0.5
  })

  on('deflect', e => {
    floats.spawn(e.x, e.y, '+' + TUNING.score.deflect + ' FLUNG', PAL.station)
  })

  on('death', () => {
    fxState.shake = TUNING.fx.shakeDeath
    fxState.deathAt = 0
  })
}

export function updateFx(dt: number, wellActive: boolean): void {
  particles.update(dt)
  floats.update(dt)
  wellParticles.update(dt, wellActive, TUNING.fx.wellParticleRate)
  fxState.shake = Math.max(0, fxState.shake - dt * TUNING.fx.shakeDecay)
  fxState.bankFlash = Math.max(0, fxState.bankFlash - dt)
  fxState.hitFlash = Math.max(0, fxState.hitFlash - dt)
  if (fxState.deathAt >= 0) fxState.deathAt += dt
}
