// The station — two circles at heart (hull ring r44, ore core r18), grown by
// upgrades. Collision stays r44 at every stage; structure is outside it.
//
//   HULL (masts)      — subdivides the ring: 3 → 4 → 5 → 6 sections, each
//                       boundary a 5px flare. Count the flares = hits left.
//   SHIELD (ring)     — a phosphor circle at r54 that eats one hit from any
//                       split-born piece, then redraws itself over seconds.
//                       Levels buy recharge speed; full level pays gold.
//   REPAIR (relight)  — brings a dead section back. Only offered while one
//                       is dead: repair or greed, spelled out on the plates.
//
// A hit takes one section and a flat slice of the ore (2026-08-30 ruling:
// CAPACITY and SHIPS are gone — the cap never grows, spill never shrinks).

import { TUNING } from '../config'
import { emit } from '../events'

export type Track = 'hull' | 'shield' | 'repair'

export class Station {
  x = 0
  y = 0

  sections: number = TUNING.station.sections
  dead: boolean[] = [false, false, false]
  /** SHIELD track: 0 = not bought, 1..maxLevel. */
  shieldLevel = 0
  /** Seconds until the shield re-arms; 0 = armed (when shieldLevel > 0). */
  shieldDownT = 0
  /** REPAIR purchases — only feeds totalUpgrades() for the tooth comb. */
  repairs = 0
  /** Section the last REPAIR relit (render flashes it warm); -1 = none. */
  lastRepaired = -1

  reservoir = 0
  reservoirCap: number = TUNING.reservoir.baseCapacity

  /** Monotonic counter render uses to invalidate its structure buffer. */
  structureRev = 0

  reset(): void {
    this.sections = TUNING.station.sections
    this.dead = new Array(this.sections).fill(false)
    this.shieldLevel = 0
    this.shieldDownT = 0
    this.repairs = 0
    this.lastRepaired = -1
    this.reservoir = 0
    this.reservoirCap = TUNING.reservoir.baseCapacity
    this.structureRev++
  }

  aliveCount(): number {
    let n = 0
    for (let i = 0; i < this.sections; i++) if (!this.dead[i]) n++
    return n
  }

  totalUpgrades(): number {
    return (this.sections - TUNING.station.sections) + this.shieldLevel + this.repairs
  }

  reservoirFull(): boolean {
    return this.reservoir >= this.reservoirCap
  }

  fillFrac(): number {
    return Math.min(1, this.reservoir / this.reservoirCap)
  }

  anyDead(): boolean {
    for (let i = 0; i < this.sections; i++) if (this.dead[i]) return true
    return false
  }

  shieldArmed(): boolean {
    return this.shieldLevel > 0 && this.shieldDownT <= 0
  }

  /** Seconds a full recharge takes at the current level. */
  shieldRechargeTime(): number {
    const R = TUNING.shield.recharge
    return R[Math.min(R.length - 1, Math.max(0, this.shieldLevel - 1))]
  }

  canUpgrade(track: Track): boolean {
    if (track === 'hull') return this.sections < TUNING.station.maxSections
    if (track === 'shield') return this.shieldLevel < TUNING.shield.maxLevel
    return this.anyDead()
  }

  anyUpgradable(): boolean {
    return this.canUpgrade('hull') || this.canUpgrade('shield') || this.canUpgrade('repair')
  }

  /** Spend the full reservoir on a track (the surge pays for it). */
  applyUpgrade(track: Track): void {
    if (track === 'hull') {
      this.sections++
      this.dead.push(false) // the ring re-divides
    } else if (track === 'shield') {
      this.shieldLevel = Math.min(TUNING.shield.maxLevel, this.shieldLevel + 1)
      this.shieldDownT = 0 // a fresh (or upgraded) shield arrives armed
    } else {
      const wounded = this.firstDead()
      if (wounded >= 0) {
        this.dead[wounded] = false
        this.repairs++
        this.lastRepaired = wounded
        emit('hullRepair', { section: wounded })
      }
    }
    this.reservoir = 0
    this.structureRev++
  }

  /** Index of the first dead section, or -1. */
  firstDead(): number {
    for (let i = 0; i < this.sections; i++) if (this.dead[i]) return i
    return -1
  }

  /** Boundary angle of section i (radians; boundary 0 at 12 o'clock). */
  boundaryAngle(i: number): number {
    return -Math.PI / 2 + (i / this.sections) * Math.PI * 2
  }

  /** Which section an impact at world angle a lands on. */
  sectionAt(a: number): number {
    let rel = a + Math.PI / 2
    rel = ((rel % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    return Math.min(this.sections - 1, Math.floor((rel / (Math.PI * 2)) * this.sections))
  }

  /**
   * A hit at angle a: the section there dies (or the nearest alive one —
   * damage always costs). Returns the index, or -1 if nothing was alive.
   */
  damage(a: number): number {
    if (this.aliveCount() === 0) return -1
    let sec = this.sectionAt(a)
    if (this.dead[sec]) {
      let bestD = 1e9
      let best = -1
      for (let i = 0; i < this.sections; i++) {
        if (this.dead[i]) continue
        let d = Math.abs(i - sec)
        d = Math.min(d, this.sections - d)
        if (d < bestD) { bestD = d; best = i }
      }
      sec = best
    }
    this.dead[sec] = true
    this.structureRev++
    return sec
  }
}
