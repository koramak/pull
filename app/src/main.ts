import '@fontsource/vt323'
import { TUNING } from './config'
import { on } from './events'
import { SystemRNG } from './rng'
import { Sim } from './sim/sim'
import { Renderer } from './render/renderer'
import { initInput, pointer, releasePointer } from './input'
import { initAudioEvents } from './audio'
import { initHaptics } from './haptics'
import { initFx, updateFx } from './fx/fx'
import { game, initState, updateState, pauseGame } from './state'
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
  sim.resize(w, h)
  renderer.resize(w, h, dpr, safeAreaTop())
}

window.addEventListener('resize', resize)
window.addEventListener('orientationchange', resize)

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    releasePointer()
    pauseGame()
  }
})

on('runStart', () => sim.reset())

initState()
initFx()
initAudioEvents()
initHaptics()
initInput(canvas)
initDebug()
resize()

// Pixel font for the wordmark/HUD; the game draws on the fallback stack
// until it lands, then picks up VT323 automatically.
if (document.fonts && document.fonts.load) {
  void document.fonts.load('12px VT323')
}

let last = performance.now()

function frame(now: number): void {
  let dt = (now - last) / 1000
  last = now
  if (dt > TUNING.sim.maxFrameDt) dt = TUNING.sim.maxFrameDt
  if (dt < 0) dt = 0

  // Real-time systems (death sequence clock, retry lockout, juice)
  updateState(dt)
  updateFx(dt, pointer.active && game.phase === 'play')

  // Fixed-step simulation (slow-mo during the death sequence)
  if (game.phase === 'play') {
    sim.frame(dt, pointer)
  } else if (game.phase === 'dying') {
    sim.frame(dt * TUNING.dying.timeScale, pointer)
  }

  renderer.draw(sim, pointer, dt, now)
  updateDebug(sim, dt)
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
