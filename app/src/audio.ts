// WebAudio synth. Context created on first user gesture (initAudio from a
// pointerdown), suspended on pause. Event-to-sound mapping preserves the
// prototype's register: coin chime on bank, low sawtooth on hull hit,
// distinct smash for rock-on-rock.

import { TUNING } from './config'
import { on } from './events'

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
  if (!ctx || !master) return
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

function noise(dur = 0.12, gain = 0.1, filterFreq = 1200): void {
  if (!ctx || !master) return
  try {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
      const data = noiseBuf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    }
    const t0 = ctx.currentTime
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
  on('runStart', () => beep(520, 0.1, 'triangle', 0.12))

  // Coin-class chime: quick two-note rise
  on('bank', () => {
    beep(760, 0.07, 'triangle', 0.14)
    beep(1140, 0.12, 'triangle', 0.12, 0, 0.06)
  })

  on('smash', e => {
    if (e.bothRocks) {
      beep(500, 0.08, 'square', 0.1)
      noise(0.09, 0.08, 2400)
    } else {
      beep(200, 0.1, 'sawtooth', 0.08) // ore lost
    }
  })

  on('hullHit', e => {
    beep(130, 0.3, 'sawtooth', 0.18)
    noise(0.2, 0.12, 500)
    if (e.hull <= 0) {
      // Death sweep layered on the final hit
      beep(300, 0.9, 'sawtooth', 0.16, 55)
      noise(0.8, 0.1, 300)
    }
  })

  on('deflect', () => beep(420, 0.06, 'sine', 0.08))

  on('pause', suspendAudio)
  on('resume', resumeAudio)
}
