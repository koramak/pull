// Boot + the frame loop. Wires state machine, sim, upgrade choice, first
// run, intensity, fx, renderer, input, audio and haptics together.

import '@fontsource/vt323'
import '@fontsource/dm-mono'
import { TUNING } from './config'
import { on } from './events'
import { SystemRNG } from './rng'
import { Sim } from './sim/sim'
import { Renderer } from './render/renderer'
import { initInput, updateInput, pointer, releasePointer, inputState } from './input'
import { initAudioEvents } from './audio'
import { initHaptics } from './haptics'
import { initFx, updateFx, clearFx } from './fx/fx'
import { intensity } from './intensity'
import { upgrade } from './upgrade'
import { firstRun } from './firstrun'
import { game, initState, updateState, pauseGame, setPhase, finishCollapse } from './state'
import { loadSavedRun, saveRun, restoreSnapshot } from './snapshot'
import { setLastSections } from './render/screens'
import { initDebug, updateDebug } from './debug'

const canvas = document.getElementById('game') as HTMLCanvasElement

const sim = new Sim(new SystemRNG())
const renderer = new Renderer(canvas)

function safeAreaTop(): number {
  const probe = document.getElementById('probe')
  if (!probe) return 0
  return probe.getBoundingClientRect().top
}

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = window.innerWidth
  const h = window.innerHeight
  renderer.resize(w, h, dpr, safeAreaTop())
  sim.resize(renderer.worldW, renderer.worldH)
}

window.addEventListener('resize', resize)
window.addEventListener('orientationchange', resize)

// The phone pauses you, not a button (kit 24c) — and the run survives an
// app switch for five minutes.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return
  if (game.phase === 'run' || game.phase === 'choice' || game.phase === 'firstrun') {
    saveRun(sim)
    releasePointer()
    upgrade.cancel()
    pauseGame()
  }
})

on('runStart', () => {
  sim.reset()
  intensity.reset()
  upgrade.cancel()
  renderer.well.clear()
  clearFx()
  if (game.phase === 'firstrun') firstRun.start()
  else firstRun.stop()
})

initState()
initFx()
initAudioEvents()
initHaptics()
firstRun.init()
initInput(canvas, renderer)
initDebug(sim)
resize()

// Pixel + label faces; the canvas draws on the fallback stack until they land.
if (document.fonts && document.fonts.load) {
  void document.fonts.load('12px VT323')
  void document.fonts.load('12px "DM Mono"')
}

// An interrupted run younger than five minutes comes back as PAUSED;
// anything older was discarded and we launch straight to the title.
const saved = loadSavedRun(TUNING.shell.pausedMaxAge)
if (saved) restoreSnapshot(sim, saved)
else setPhase('title')

// Choice bookkeeping: where to return after the freeze (run vs firstrun).
let choiceFrom: 'run' | 'firstrun' = 'run'
let choiceArm = 0

let last = performance.now()

function frame(now: number): void {
  let dt = (now - last) / 1000
  last = now
  if (dt > TUNING.sim.maxFrameDt) dt = TUNING.sim.maxFrameDt
  if (dt < 0) dt = 0

  updateState(dt, inputState.anyPointerDown)
  updateInput(dt)
  updateFx(dt)

  const phase = game.phase

  if (phase === 'run' || phase === 'firstrun') {
    sim.frame(dt, pointer, phase === 'run')
    intensity.update(dt, sim, game.time)
    if (phase === 'firstrun') firstRun.update(dt, sim, pointer)

    // reservoir full + finger released → the choice (if anything's buyable)
    if (
      upgrade.stage === 'idle' &&
      sim.station.reservoirFull() &&
      !pointer.active &&
      sim.station.anyUpgradable() &&
      !game.pendingCollapse
    ) {
      choiceArm += dt
      if (choiceArm >= TUNING.choice.enterDelay) {
        choiceFrom = phase
        upgrade.open(sim)
        setPhase('choice')
        choiceArm = 0
      }
    } else {
      choiceArm = 0
    }
  } else if (phase === 'collapse') {
    // rocks drift on, irrelevant — which is the point
    sim.frame(dt * 0.3, pointer, false)
    if (game.phaseT >= TUNING.collapse.toResult) {
      setLastSections(sim.station.sections)
      finishCollapse(sim.station.sections)
    }
  }

  // The upgrade timeline runs through choice AND the surge/build that play
  // over live gameplay after the run resumes.
  if (upgrade.stage !== 'idle' && phase !== 'paused') {
    const result = upgrade.update(dt, sim)
    if (result === 'resume' && game.phase === 'choice') {
      // RUN, 480ms after the flick — surge and build play over the live field
      if (choiceFrom === 'firstrun') {
        firstRun.finish()
        setPhase('run')
      } else {
        setPhase(choiceFrom)
      }
    }
  }

  renderer.draw(sim, pointer, dt, now)
  updateDebug(sim, dt)
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
