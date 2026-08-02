// Single-pointer input, routed by phase. First pointer down owns the
// interaction; everything else is ignored (v1 rule). Pointer Events cover
// touch + mouse. During RUN the pointer IS the well — zero-latency world
// coordinates the sim reads directly.

import { initAudio } from './audio'
import { TUNING } from './config'
import { game, startRun, resumeGame, openSettings, closeSettings, requestCollapseSkip } from './state'
import { settings, saveSettings, resetRecords, loadDeaths } from './storage'
import { upgrade } from './upgrade'
import type { PointerState } from './sim/sim'
import type { Renderer } from './render/renderer'
import { ui, playButton, titlePlayButton, doneButton, gearButton, shareButton, settingsRows, hitCircle, hitRect } from './render/screens'

export const pointer: PointerState = { active: false, x: 0, y: 0 }

let ownerId: number | null = null
export const inputState = {
  resetHolding: false,
  anyPointerDown: false
}

export function initInput(canvas: HTMLCanvasElement, renderer: Renderer): void {
  const toWorld = (e: PointerEvent): { x: number; y: number } => renderer.toWorld(e.clientX, e.clientY)

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault()
    initAudio()
    if (ownerId !== null) return // second finger — ignored
    ownerId = e.pointerId
    try { canvas.setPointerCapture(e.pointerId) } catch { /* not critical */ }
    inputState.anyPointerDown = true
    const p = toWorld(e)
    const l = renderer.layout()

    switch (game.phase) {
      case 'title': {
        if (hitCircle(p.x, p.y, titlePlayButton(l))) {
          ui.playPressed = true
          ui.playPressT = performance.now() / 1000
        } else if (hitCircle(p.x, p.y, gearButton(l))) {
          openSettings('title')
        }
        break
      }
      case 'result': {
        // after a skipped collapse the stagger fast-forwards (P5)
        const gate = game.collapseSkipped ? TUNING.collapseSkip.resultGate : 1.5
        if (game.phaseT < gate) break // buttons appear with the stagger
        if (hitCircle(p.x, p.y, playButton(l))) {
          startRun()
        } else if (hitCircle(p.x, p.y, gearButton(l))) {
          openSettings('result')
        } else if (hitRect(p.x, p.y, shareButton(l))) {
          shareChallenge()
        }
        break
      }
      case 'settings': {
        if (hitCircle(p.x, p.y, doneButton(l))) {
          closeSettings()
          break
        }
        const rows = settingsRows(l)
        for (const row of rows) {
          if (p.y < row.y || p.y > row.y + 56) continue
          if (row.id === 'sound') { settings.sound = !settings.sound; saveSettings() }
          else if (row.id === 'haptics') { settings.haptics = !settings.haptics; saveSettings() }
          else if (row.id === 'reduceMotion') {
            settings.reduceMotion = !settings.reduceMotion
            saveSettings()
            applyReduceMotion()
          } else if (row.id === 'reset') {
            inputState.resetHolding = true
            ui.resetHoldT = 0.0001
          }
          break
        }
        break
      }
      case 'paused': {
        if (hitCircle(p.x, p.y, playButton(l))) resumeGame()
        break
      }
      case 'choice': {
        upgrade.onPress(p.x, p.y)
        break
      }
      case 'run':
      case 'firstrun': {
        pointer.active = true
        pointer.x = p.x
        pointer.y = p.y
        break
      }
      case 'collapse': {
        pointer.active = true
        pointer.x = p.x
        pointer.y = p.y
        // P5 — after the first-ever death, a tap skips the ceremony
        if (loadDeaths().length > 1 && game.phaseT > TUNING.collapseSkip.minPhaseT) {
          requestCollapseSkip()
        }
        break
      }
      default:
        break
    }
  })

  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== ownerId) return
    e.preventDefault()
    const p = toWorld(e)
    if (pointer.active) {
      // F10 — browsers deliver one pointermove per frame and coalesce the
      // 120–240Hz touch samples behind it; hand the sim the whole path.
      const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : null
      if (coalesced && coalesced.length > 1) {
        const path = pointer.path ?? (pointer.path = [])
        for (const c of coalesced) path.push(toWorld(c))
        if (path.length > 64) path.splice(0, path.length - 64) // sim stalled; stay bounded
      }
      pointer.x = p.x
      pointer.y = p.y
    }
    if (game.phase === 'choice') upgrade.onMove(p.x, p.y)
  })

  const release = (e: PointerEvent): void => {
    if (e.pointerId !== ownerId) return
    initAudio() // S5 — gesture-end is the reliable unlock on iOS
    ownerId = null
    inputState.anyPointerDown = false
    pointer.active = false
    inputState.resetHolding = false
    if (game.phase === 'choice') upgrade.onRelease()
    if (game.phase === 'title' && ui.playPressed) {
      ui.playPressed = false
      const p = toWorld(e)
      const l = renderer.layout()
      if (hitCircle(p.x, p.y, titlePlayButton(l))) startRun()
    } else {
      ui.playPressed = false
    }
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)

  // belt and braces against browser gestures the CSS didn't catch
  canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false })
  canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false })
  window.addEventListener('contextmenu', e => e.preventDefault())
  window.addEventListener('blur', () => {
    ownerId = null
    inputState.anyPointerDown = false
    pointer.active = false
    inputState.resetHolding = false
    ui.playPressed = false
  })

  applyReduceMotion()
}

/** Update the RESET BEST hold; call once per frame. */
export function updateInput(dt: number): void {
  if (inputState.resetHolding && !ui.resetDone) {
    ui.resetHoldT += dt
    if (ui.resetHoldT >= TUNING.shell.resetHold) {
      resetRecords()
      game.best = 0
      ui.resetDone = true
      inputState.resetHolding = false
    }
  } else if (!inputState.resetHolding) {
    ui.resetHoldT = 0
    if (game.phase !== 'settings') ui.resetDone = false
  }
}

export function releasePointer(): void {
  ownerId = null
  pointer.active = false
  inputState.anyPointerDown = false
}

/** P2 — build and share this run's challenge link (fire-and-forget). */
function shareChallenge(): void {
  try {
    const url = `${location.origin}${location.pathname}?c=${game.runSeed.toString(36)}&t=${game.score}`
    const text = `PULL — beat my ${game.score}`
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> }
    if (nav.share) {
      void nav.share({ title: 'PULL', text, url }).catch(() => { /* dismissed */ })
    } else if (navigator.clipboard) {
      void navigator.clipboard.writeText(`${text} ${url}`).catch(() => { /* denied */ })
    }
    ui.shareFlashAt = performance.now() / 1000
  } catch { /* sharing is garnish */ }
}

export function applyReduceMotion(): void {
  document.body.classList.toggle('reduce-motion', settings.reduceMotion)
}
