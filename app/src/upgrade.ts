// The upgrade moment — full, frozen, swiped, spent (kit "UPGRADE — CHOSEN,
// COMBINED"). Reservoir full + finger released → everything freezes to 16%,
// three circular plates in a triangle (HULL top, SHIELD bottom-left,
// REPAIR bottom-right — each previewing the parts it welds on), flick
// toward one, white lock flash, then the surge: warm light collapsing
// inward — the only inward motion in the game — before structure appears.
// The run resumes 480ms after the flick; surge and build play over live play.

import { TUNING } from './config'
import { emit } from './events'
import type { Sim } from './sim/sim'
import type { Track } from './sim/station'

type Stage = 'idle' | 'entering' | 'waiting' | 'flick' | 'lock' | 'surge' | 'build' | 'restore'

export interface PlateInfo {
  track: Track
  x: number // world units
  y: number
  enabled: boolean
}

const TRACK_ORDER: Track[] = ['hull', 'shield', 'repair']

class UpgradeController {
  stage: Stage = 'idle'
  t = 0
  plates: PlateInfo[] = []
  picked: Track | null = null
  pickedIndex = -1
  /** Bracket travel 0→1 during flick. */
  travel = 0
  /** Set when the structure was applied; renderer animates the new parts. */
  buildTrack: Track | null = null
  buildT = 0

  private pressX = 0
  private pressY = 0
  private pressed = false

  /** Sim time is frozen from entering until lock. */
  frozen(): boolean {
    return this.stage === 'entering' || this.stage === 'waiting' || this.stage === 'flick'
  }

  active(): boolean {
    return this.stage !== 'idle'
  }

  /** Field dim multiplier (1 = full brightness, freezeDim during choice). */
  dim(): number {
    const lo = TUNING.choice.freezeDim
    switch (this.stage) {
      case 'idle': return 1
      case 'entering': return 1 - (1 - lo) * ease(this.t / TUNING.choice.fadeIn)
      case 'waiting':
      case 'flick': return lo
      case 'lock':
      case 'surge': return lo + (1 - lo) * 0.25
      case 'build': return lo + (1 - lo) * Math.min(1, this.t / TUNING.choice.build)
      case 'restore': return lo + (1 - lo) * Math.min(1, this.t / TUNING.choice.restore)
    }
  }

  plateAlpha(): number {
    if (this.stage === 'entering') return ease(this.t / TUNING.choice.fadeIn)
    if (this.stage === 'waiting' || this.stage === 'flick') return 1
    if (this.stage === 'lock') return 1 - this.t / TUNING.choice.lockFlash
    return 0
  }

  open(sim: Sim): void {
    const st = sim.station
    this.plates.length = 0
    for (let i = 0; i < 3; i++) {
      const off = TUNING.choice.plateOffsets[i]
      const track = TRACK_ORDER[i]
      this.plates.push({
        track,
        x: st.x + off.x,
        y: st.y + off.y,
        enabled: st.canUpgrade(track)
      })
    }
    this.stage = 'entering'
    this.t = 0
    this.picked = null
    this.pickedIndex = -1
    this.travel = 0
    this.pressed = false
    emit('choiceOpen', undefined)
  }

  cancel(): void {
    this.stage = 'idle'
    this.picked = null
    this.buildTrack = null
  }

  // --- pointer routing (world units) ---------------------------------------

  onPress(x: number, y: number): void {
    if (this.stage !== 'waiting') return
    this.pressX = x
    this.pressY = y
    this.pressed = true
    // direct tap on an enabled plate commits it
    const hit = this.plateAt(x, y)
    if (hit >= 0) this.commit(hit)
  }

  onMove(x: number, y: number): void {
    if (this.stage !== 'waiting' || !this.pressed) return
    const dx = x - this.pressX
    const dy = y - this.pressY
    if (dx * dx + dy * dy < TUNING.choice.flickThreshold * TUNING.choice.flickThreshold) return
    // flick: pick the enabled plate nearest the swipe direction
    const a = Math.atan2(dy, dx)
    let best = -1
    let bestD = Math.PI
    for (let i = 0; i < this.plates.length; i++) {
      const p = this.plates[i]
      if (!p.enabled) continue
      const off = TUNING.choice.plateOffsets[i]
      const pa = Math.atan2(off.y, off.x)
      let d = Math.abs(a - pa)
      if (d > Math.PI) d = Math.PI * 2 - d
      if (d < bestD) { bestD = d; best = i }
    }
    if (best >= 0 && bestD < Math.PI / 2.2) this.commit(best)
  }

  onRelease(): void {
    this.pressed = false
  }

  private plateAt(x: number, y: number): number {
    for (let i = 0; i < this.plates.length; i++) {
      const p = this.plates[i]
      if (!p.enabled) continue
      const dx = x - p.x
      const dy = y - p.y
      if (dx * dx + dy * dy <= TUNING.choice.plateRadius * TUNING.choice.plateRadius) return i
    }
    return -1
  }

  private commit(index: number): void {
    this.picked = this.plates[index].track
    this.pickedIndex = index
    this.stage = 'flick'
    this.t = 0
    this.travel = 0
  }

  // --- timeline ------------------------------------------------------------

  /**
   * Advance. Returns 'resume' exactly once, on the frame the run should
   * unfreeze (480ms after the flick), and 'done' when fully finished.
   */
  update(dt: number, sim: Sim): 'resume' | 'done' | null {
    if (this.stage === 'idle') return null
    this.t += dt
    const C = TUNING.choice
    switch (this.stage) {
      case 'entering':
        if (this.t >= C.fadeIn) this.next('waiting')
        return null
      case 'waiting':
        return null
      case 'flick':
        this.travel = ease(Math.min(1, this.t / C.flickTravel))
        if (this.t >= C.flickTravel) {
          this.next('lock')
          if (this.picked) {
            emit('choiceLock', { track: this.picked })
            sim.station.applyUpgrade(this.picked)
            this.buildTrack = this.picked
            this.buildT = -(C.lockFlash + C.surge) // structure appears after the surge
          }
          return 'resume' // RUN, 480ms after the flick
        }
        return null
      case 'lock':
        this.buildT += dt
        if (this.t >= C.lockFlash) {
          this.next('surge')
          emit('surge', undefined)
        }
        return null
      case 'surge':
        this.buildT += dt
        if (this.t >= C.surge) this.next('build')
        return null
      case 'build':
        this.buildT += dt
        if (this.t >= C.build) this.next('restore')
        return null
      case 'restore':
        this.buildT += dt
        if (this.t >= C.restore) {
          this.stage = 'idle'
          return 'done'
        }
        return null
    }
  }

  private next(s: Stage): void {
    this.stage = s
    this.t = 0
  }
}

function ease(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

export const upgrade = new UpgradeController()
