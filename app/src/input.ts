// Single-pointer input. First pointer down owns the well; everything else is
// ignored (v1 rule). Pointer Events cover touch + mouse on all targets.

import { initAudio } from './audio'
import { handleTap } from './state'
import type { PointerState } from './sim/sim'

export const pointer: PointerState = { active: false, x: 0, y: 0 }

let ownerId: number | null = null

export function initInput(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault()
    initAudio() // user gesture: create/resume the AudioContext
    if (ownerId !== null) return // second finger — ignored
    ownerId = e.pointerId
    try { canvas.setPointerCapture(e.pointerId) } catch { /* not critical */ }
    const consumed = handleTap()
    if (!consumed) {
      pointer.active = true
      pointer.x = e.clientX
      pointer.y = e.clientY
    }
  })

  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== ownerId || !pointer.active) return
    e.preventDefault()
    pointer.x = e.clientX
    pointer.y = e.clientY
  })

  const release = (e: PointerEvent): void => {
    if (e.pointerId !== ownerId) return
    ownerId = null
    pointer.active = false
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)

  // Belt and braces against browser gestures the CSS didn't catch
  canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false })
  canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false })
  window.addEventListener('contextmenu', e => e.preventDefault())
  window.addEventListener('blur', () => {
    ownerId = null
    pointer.active = false
  })
}

/** Force-release (used when pausing). */
export function releasePointer(): void {
  ownerId = null
  pointer.active = false
}
