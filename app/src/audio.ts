// WebAudio synth. Context created on first user gesture, suspended on pause.
//
// S1 — voiced for the speaker it plays on: a phone speaker reproduces almost
// nothing below ~150-200Hz, so every event lives above a ~145Hz master
// high-pass and "weight" comes from envelope (hard attack, longer decay) and
// ducking, not sub-bass. Hull hits duck the rest of the mix so the gap in
// the sound IS the impact.
//
// S2 — streaks are encoded in pitch: consecutive banks climb a pentatonic
// ladder (reset on a hull hit or after a quiet spell), smash chains climb
// the same ladder, and repeated one-shots get ±5% pitch jitter so nothing
// machine-guns.
//
// S4 — voice discipline: frequent minor sounds (deflects, crumbles, ship
// ticks) are dropped when the mix is busy; long sounds are reserved for the
// collapse alone.

import { TUNING } from './config'
import { on } from './events'
import { settings } from './storage'

let ctx: AudioContext | null = null
let master: GainNode | null = null
/** Duckable bus — everything routes here except the hull/collapse hits. */
let sfxBus: GainNode | null = null
/** Priority bus — hull hits and the collapse bypass the duck. */
let priorityBus: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
let mediaUnlocked = false

// streak state (S2)
let bankStreak = 0
let lastBankAt = -1e9
// voice budget (S4)
const minorVoices: number[] = []
// M5 — the heartbeat under one-section-left
let hbCritical = false
let hbTimer: ReturnType<typeof setInterval> | null = null
// S3 — the phosphor hum (created lazily on the first run)
let humNoiseGain: GainNode | null = null
let humFilter: BiquadFilterNode | null = null
let humOscGain: GainNode | null = null
let humOn = false
let humLastI = -1

function now(): number {
  return ctx ? ctx.currentTime : 0
}

/** Call from a user gesture handler; safe to call repeatedly. */
export function initAudio(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume()
    return
  }
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx = new AC({ latencyHint: 'interactive' })
    master = ctx.createGain()
    master.gain.value = TUNING.audio.master
    // S1 — the speaker can't make what's below this anyway; reclaim headroom
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = TUNING.audio.highpassHz
    master.connect(hp)
    hp.connect(ctx.destination)
    sfxBus = ctx.createGain()
    sfxBus.connect(master)
    priorityBus = ctx.createGain()
    priorityBus.connect(master)
    // pre-warm: a one-sample silent buffer keeps the first real sound on time
    const warm = ctx.createBuffer(1, 1, ctx.sampleRate)
    const src = ctx.createBufferSource()
    src.buffer = warm
    src.connect(master)
    src.start()
    unlockMediaChannel()
  } catch {
    ctx = null
  }
}

// S5 — iOS mutes WebAudio under the ringer switch, but not <audio> playback.
// Playing a silent looped element promotes the page onto the media channel so
// the game sounds with the switch on; the in-game SOUND toggle is the way out.
function unlockMediaChannel(): void {
  if (mediaUnlocked) return
  mediaUnlocked = true
  try {
    const el = document.createElement('audio')
    // 8-sample silent WAV
    el.src = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YRAAAAAAAAAAAAAAAAAAAAAAAAAA'
    el.loop = true
    el.volume = 0.01
    void el.play().catch(() => { /* fine — audio stays on the ringer channel */ })
  } catch { /* ignore */ }
}

export function suspendAudio(): void {
  if (ctx && ctx.state === 'running') void ctx.suspend()
}

export function resumeAudio(): void {
  if (ctx && ctx.state === 'suspended') void ctx.resume()
}

/** S4 — true if a minor sound may play right now (and reserves a voice). */
function minorVoiceOk(): boolean {
  if (!ctx) return false
  const t = ctx.currentTime
  while (minorVoices.length && minorVoices[0] < t - TUNING.audio.voiceWindow) minorVoices.shift()
  if (minorVoices.length >= TUNING.audio.maxMinorVoices) return false
  minorVoices.push(t)
  return true
}

/** ±jitter on repeated one-shots (S2); ladder notes carry info and stay true. */
function jittered(freq: number): number {
  return freq * (1 + (Math.random() * 2 - 1) * TUNING.audio.pitchJitter)
}

function beep(freq: number, dur = 0.08, type: OscillatorType = 'sine', gain = 0.12, freqEnd = 0, delay = 0, priority = false): void {
  if (!ctx || !sfxBus || !priorityBus || !settings.sound) return
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
    g.connect(priority ? priorityBus : sfxBus)
    o.start(t0)
    o.stop(t0 + dur)
  } catch { /* audio is garnish; never let it throw into the loop */ }
}

function noise(dur = 0.12, gain = 0.1, filterFreq = 1200, delay = 0, priority = false): void {
  if (!ctx || !sfxBus || !priorityBus || !settings.sound) return
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
    g.connect(priority ? priorityBus : sfxBus)
    src.start(t0)
    src.stop(t0 + dur)
  } catch { /* ignore */ }
}

/** S1 — drop the duckable bus so a priority hit owns the moment. */
function duck(): void {
  if (!ctx || !sfxBus) return
  try {
    const A = TUNING.audio
    const g = sfxBus.gain
    const t = ctx.currentTime
    g.cancelScheduledValues(t)
    g.setTargetAtTime(A.duckTo, t, 0.02)
    g.setTargetAtTime(1, t + A.duckHold, A.duckRelease / 3)
  } catch { /* ignore */ }
}

function ladderStep(step: number): number {
  const L = TUNING.audio.ladder
  const octaves = Math.floor(step / L.length)
  return L[step % L.length] * Math.pow(2, Math.min(1, octaves)) // cap one octave up
}

// --- S3: the phosphor hum ---------------------------------------------------
// A quiet bed — filtered noise + a low triangle — that confirms sound is on
// and rises in brightness with the intensity float. Sustains cost nothing in
// WebAudio, so this is the one continuous layer the mix allows.

function ensureHum(): void {
  if (!ctx || !sfxBus || humNoiseGain) return
  try {
    const H = TUNING.hum
    // 2s noise loop — long enough that the loop point never reads
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    humFilter = ctx.createBiquadFilter()
    humFilter.type = 'bandpass'
    humFilter.frequency.value = H.noiseFreqFrom
    humFilter.Q.value = 0.8
    humNoiseGain = ctx.createGain()
    humNoiseGain.gain.value = 0
    src.connect(humFilter)
    humFilter.connect(humNoiseGain)
    humNoiseGain.connect(sfxBus)
    src.start()
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = H.oscHz
    humOscGain = ctx.createGain()
    humOscGain.gain.value = 0
    osc.connect(humOscGain)
    humOscGain.connect(sfxBus)
    osc.start()
  } catch { /* the bed is optional */ }
}

/** Frame hook from main: drive the hum from the intensity float. */
export function updateAudio(intensity01: number, running: boolean): void {
  if (!ctx || !settings.sound) return
  if (running) ensureHum()
  if (!humNoiseGain || !humFilter || !humOscGain) return
  const H = TUNING.hum
  const t = ctx.currentTime
  if (running && !humOn) {
    humOn = true
    humLastI = -1
  } else if (!running && humOn) {
    humOn = false
    humNoiseGain.gain.setTargetAtTime(0, t, H.fadeOut / 3)
    humOscGain.gain.setTargetAtTime(0, t, H.fadeOut / 3)
    return
  }
  if (!humOn) return
  if (Math.abs(intensity01 - humLastI) < 0.02) return
  humLastI = intensity01
  // at one section the heartbeat owns the low end — thin the hum's triangle
  const oscScale = hbCritical ? 0.4 : 1
  humNoiseGain.gain.setTargetAtTime(H.noiseGainFrom + (H.noiseGainTo - H.noiseGainFrom) * intensity01, t, 0.25)
  humFilter.frequency.setTargetAtTime(H.noiseFreqFrom + (H.noiseFreqTo - H.noiseFreqFrom) * intensity01, t, 0.3)
  humOscGain.gain.setTargetAtTime((H.oscGainFrom + (H.oscGainTo - H.oscGainFrom) * intensity01) * oscScale, t, 0.25)
}

/** M5 — a soft lub-dub while one section from death. Event-driven state:
 *  set on the hull hit, cleared by repair, collapse, or a new run. */
function setHeartbeat(on: boolean): void {
  if (on === hbCritical) return
  hbCritical = on
  if (hbTimer !== null) {
    clearInterval(hbTimer)
    hbTimer = null
  }
  if (on) {
    hbTimer = setInterval(() => {
      if (!ctx || ctx.state !== 'running' || !settings.sound || !hbCritical) return
      beep(190, 0.09, 'sine', 0.075)
      beep(285, 0.06, 'sine', 0.045, 0, 0.13)
    }, TUNING.critical.heartbeatPeriod * 1000)
  }
}

export function initAudioEvents(): void {
  on('runStart', () => {
    bankStreak = 0
    beep(520, 0.1, 'triangle', 0.1)
  })

  // S2 — coin chime climbs the pentatonic ladder with the streak
  on('bank', e => {
    const t = now()
    if (t - lastBankAt > TUNING.audio.streakResetAfter) bankStreak = 0
    lastBankAt = t
    const f = TUNING.audio.bankBaseHz * ladderStep(bankStreak)
    beep(f, 0.07, 'triangle', 0.14)
    beep(f * 1.5, 0.11, 'triangle', 0.12, 0, 0.06)
    if (e.doubled) beep(f * 2, 0.12, 'triangle', 0.1, 0, 0.12)
    bankStreak++
  })

  on('reservoirFull', () => {
    beep(880, 0.09, 'triangle', 0.1)
    beep(1320, 0.14, 'triangle', 0.09, 0, 0.09)
  })

  // S2 — smash chains climb too; the sim's chain drives the note (M1)
  on('smash', e => {
    if (e.bothRocks) {
      const f = TUNING.audio.smashBaseHz * ladderStep(e.chain)
      beep(f, 0.08, 'square', 0.1)
      noise(0.09, 0.08, 2400)
    } else {
      beep(jittered(240), 0.1, 'sawtooth', 0.08) // ore lost
    }
  })

  on('crumble', () => { if (minorVoiceOk()) noise(0.07, 0.05, 1600) })

  // S1 — menace from envelope and the duck, energy at 220-260Hz where the
  // speaker actually is; the ladder resets — the run's music falls with you
  on('hullHit', e => {
    bankStreak = 0
    setHeartbeat(e.alive === 1) // M5 — one section left has a pulse
    duck()
    const severe = e.alive <= 1 || e.sectionsBefore <= 3
    const mid = e.sectionsBefore === 4
    if (severe) {
      beep(220, 0.35, 'sawtooth', 0.2, 165, 0, true)
      noise(0.24, 0.14, 900, 0, true)
    } else if (mid) {
      beep(240, 0.22, 'sawtooth', 0.15, 185, 0, true)
      noise(0.16, 0.1, 800, 0, true)
    } else {
      beep(260, 0.12, 'sawtooth', 0.09, 205, 0, true)
      noise(0.08, 0.06, 700, 0, true)
    }
  })

  on('oreSpill', () => beep(340, 0.18, 'sawtooth', 0.07, 190))

  on('nearMiss', () => beep(900, 0.12, 'sine', 0.05, 640))

  on('deflect', () => { if (minorVoiceOk()) beep(jittered(420), 0.06, 'sine', 0.07) })

  on('shipShot', e => {
    if (minorVoiceOk()) beep(jittered(1800), 0.03, 'square', 0.05)
    if (e.broke) noise(0.07, 0.06, 2000, 0.03)
  })

  on('choiceOpen', () => beep(220, 0.22, 'sine', 0.06))
  on('choiceLock', () => {
    beep(1200, 0.05, 'square', 0.09)
    noise(0.03, 0.05, 4000)
  })
  on('surge', () => beep(200, 0.4, 'sawtooth', 0.09, 760))

  // N4 — the shockwave: a bright outward whoosh falling away
  on('clearPulse', () => {
    noise(0.32, 0.1, 1900)
    beep(700, 0.28, 'sawtooth', 0.07, 210)
  })

  // M8 — the vein announcement: three rising soft notes, gold approaching
  on('vein', () => {
    beep(520, 0.1, 'triangle', 0.08)
    beep(660, 0.1, 'triangle', 0.08, 0, 0.11)
    beep(880, 0.14, 'triangle', 0.09, 0, 0.22)
  })

  // M6 — repair: a warm resolve, the opposite of the hull hit
  on('hullRepair', () => {
    setHeartbeat(false)
    beep(440, 0.1, 'triangle', 0.1)
    beep(660, 0.16, 'triangle', 0.09, 0, 0.09)
  })

  on('runStart', () => setHeartbeat(false))
  on('collapse', () => setHeartbeat(false))

  // P1 — a star lands: a small two-note tick; a rank is a short fanfare
  // (ceremony stays reserved for the big three: rank, new best, death)
  on('missionDone', () => {
    beep(990, 0.07, 'triangle', 0.09)
    beep(1485, 0.1, 'triangle', 0.08, 0, 0.07)
  })
  on('rankUp', () => {
    beep(660, 0.09, 'triangle', 0.1)
    beep(880, 0.09, 'triangle', 0.1, 0, 0.09)
    beep(1320, 0.16, 'triangle', 0.11, 0, 0.18)
  })

  // the death stop is silent; the sweep lands as the collapse begins (F3/S1)
  on('collapse', () => {
    const d = TUNING.audio.collapseDelay
    duck()
    beep(320, 0.9, 'sawtooth', 0.18, 120, d, true)
    noise(0.8, 0.12, 500, d, true)
    beep(180, 0.5, 'sawtooth', 0.1, 90, d + 1.45, true) // the beam collapsing
  })

  on('pause', suspendAudio)
  on('resume', resumeAudio)
}
