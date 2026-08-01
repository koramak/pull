// WebAudio synth. Context created on first user gesture, suspended on pause.
// Register: coin chime on bank (brighter when doubled), square crunch on
// smash, low sawtooth on hull hits scaled by severity, a click for the lock,
// a rising sweep for the surge, a tick for ship shots, and the long
// power-off sweep under the collapse. All gated by the SOUND setting.

import { TUNING } from './config'
import { on } from './events'
import { settings } from './storage'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuf: AudioBuffer | null = null

/** Call from a user gesture handler; safe to call repeatedly. */
export function initAudio(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume()
    return
  }
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = TUNING.audio.master
    master.connect(ctx.destination)
  } catch {
    ctx = null
  }
}

export function suspendAudio(): void {
  if (ctx && ctx.state === 'running') void ctx.suspend()
}

export function resumeAudio(): void {
  if (ctx && ctx.state === 'suspended') void ctx.resume()
}

function beep(freq: number, dur = 0.08, type: OscillatorType = 'sine', gain = 0.12, freqEnd = 0, delay = 0): void {
  if (!ctx || !master || !settings.sound) return
  try {
    const t0 = ctx.currentTime + delay
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (freqEnd > 0) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur)
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    o.connect(g)
    g.connect(master)
    o.start(t0)
    o.stop(t0 + dur)
  } catch { /* audio is garnish; never let it throw into the loop */ }
}

function noise(dur = 0.12, gain = 0.1, filterFreq = 1200, delay = 0): void {
  if (!ctx || !master || !settings.sound) return
  try {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
      const data = noiseBuf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    }
    const t0 = ctx.currentTime + delay
    const src = ctx.createBufferSource()
    src.buffer = noiseBuf
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = filterFreq
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    src.connect(f)
    f.connect(g)
    g.connect(master)
    src.start(t0)
    src.stop(t0 + dur)
  } catch { /* ignore */ }
}

export function initAudioEvents(): void {
  on('runStart', () => beep(520, 0.1, 'triangle', 0.1))

  // coin-class chime: quick two-note rise; a third note when doubled
  on('bank', e => {
    beep(760, 0.07, 'triangle', 0.14)
    beep(1140, 0.11, 'triangle', 0.12, 0, 0.06)
    if (e.doubled) beep(1520, 0.12, 'triangle', 0.1, 0, 0.12)
  })

  on('reservoirFull', () => {
    beep(880, 0.09, 'triangle', 0.1)
    beep(1320, 0.14, 'triangle', 0.09, 0, 0.09)
  })

  on('smash', e => {
    if (e.bothRocks) {
      beep(500, 0.08, 'square', 0.1)
      noise(0.09, 0.08, 2400)
    } else {
      beep(200, 0.1, 'sawtooth', 0.08) // ore lost
    }
  })

  on('crumble', () => noise(0.07, 0.05, 1600))

  on('hullHit', e => {
    // the alarm gets quieter as you get stronger
    const severe = e.alive <= 1 || e.sectionsBefore <= 3
    const mid = e.sectionsBefore === 4
    if (severe) {
      beep(130, 0.3, 'sawtooth', 0.18)
      noise(0.2, 0.12, 500)
    } else if (mid) {
      beep(150, 0.2, 'sawtooth', 0.13)
      noise(0.14, 0.08, 500)
    } else {
      beep(170, 0.1, 'sawtooth', 0.08)
      noise(0.07, 0.05, 600)
    }
  })

  on('oreSpill', () => beep(300, 0.18, 'sawtooth', 0.06, 150))

  on('nearMiss', () => beep(900, 0.12, 'sine', 0.05, 640))

  on('deflect', () => beep(420, 0.06, 'sine', 0.07))

  on('shipShot', e => {
    beep(1800, 0.03, 'square', 0.05)
    if (e.broke) noise(0.07, 0.06, 2000, 0.03)
  })

  on('choiceOpen', () => beep(220, 0.22, 'sine', 0.06))
  on('choiceLock', () => {
    beep(1200, 0.05, 'square', 0.09)
    noise(0.03, 0.05, 4000)
  })
  on('surge', () => beep(180, 0.4, 'sawtooth', 0.09, 720))

  on('collapse', () => {
    beep(300, 0.9, 'sawtooth', 0.16, 55)
    noise(0.8, 0.1, 300)
    beep(90, 0.5, 'sine', 0.12, 40, 1.45) // the beam collapsing
  })

  on('pause', suspendAudio)
  on('resume', resumeAudio)
}
