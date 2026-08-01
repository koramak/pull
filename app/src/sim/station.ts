// The station — two circles at heart (hull ring r44, ore core r18), grown by
// upgrades. Collision stays r44 at every stage; structure is outside it.
//
//   CAPACITY (truss)  — inner rails + cross-ties; reservoir ×1.5
//   HULL (masts)      — subdivides the ring: 3 → 4 → 5 → 6 sections, each
//                       boundary a 5px flare. Count the flares = hits left.
//   SHIPS (darts)     — one craft per purchase on the r61 patrol, docked to
//                       a section, dies with it.
//
// A hit takes one section, the structure standing on it, and a quarter of
// the ore. Nothing repairs.

import { TUNING } from '../config'

export type Track = 'capacity' | 'hull' | 'ships'

export interface Ship {
  /** Index of the section this ship is docked to (dies with it). */
  section: number
  /** Even-spacing slot; patrol angle derives from this. */
  slot: number
  cooldown: number
  /** Live tracer state (render reads; 0 = idle). */
  tracerT: number
  tx: number
  ty: number
  /** Current world position (updated by sim each step). */
  x: number
  y: number
  angle: number
}

export class Station {
  x = 0
  y = 0

  sections: number = TUNING.station.sections
  dead: boolean[] = [false, false, false]
  capacity = 0
  ships: Ship[] = []
  private lastDock = -1

  reservoir = 0
  reservoirCap: number = TUNING.reservoir.baseCapacity

  /** Monotonic counter render uses to invalidate its structure buffer. */
  structureRev = 0

  reset(): void {
    this.sections = TUNING.station.sections
    this.dead = new Array(this.sections).fill(false)
    this.capacity = 0
    this.ships.length = 0
    this.lastDock = -1
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
    return this.capacity + (this.sections - TUNING.station.sections) + this.ships.length
  }

  reservoirFull(): boolean {
    return this.reservoir >= this.reservoirCap
  }

  fillFrac(): number {
    return Math.min(1, this.reservoir / this.reservoirCap)
  }

  canUpgrade(track: Track): boolean {
    if (track === 'capacity') return this.capacity < TUNING.choice.maxCapacity
    if (track === 'hull') return this.sections < TUNING.station.maxSections
    return this.ships.length < TUNING.choice.maxShips
  }

  anyUpgradable(): boolean {
    return this.canUpgrade('capacity') || this.canUpgrade('hull') || this.canUpgrade('ships')
  }

  /** Spend the full reservoir on a track (the surge pays for it). */
  applyUpgrade(track: Track): void {
    if (track === 'capacity') {
      this.capacity++
      this.reservoirCap = Math.round(TUNING.reservoir.baseCapacity * Math.pow(TUNING.reservoir.capacityGrowth, this.capacity))
    } else if (track === 'hull') {
      this.sections++
      this.dead.push(false) // the ring re-divides; wounds stay wounds
    } else {
      // dock clockwise from the last ship, on an alive section
      let sec = (this.lastDock + 1) % this.sections
      for (let tries = 0; tries < this.sections; tries++) {
        if (!this.dead[sec]) break
        sec = (sec + 1) % this.sections
      }
      this.lastDock = sec
      this.ships.push({ section: sec, slot: this.ships.length, cooldown: 0.8, tracerT: 0, tx: 0, ty: 0, x: this.x, y: this.y - TUNING.ships.orbitRadius, angle: 0 })
      this.respace()
    }
    this.reservoir = 0
    this.structureRev++
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
   * Ships standing on the section die with the structure, in the same glitch.
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
    for (let i = this.ships.length - 1; i >= 0; i--) {
      if (this.ships[i].section === sec) this.ships.splice(i, 1)
    }
    this.respace()
    this.structureRev++
    return sec
  }

  private respace(): void {
    for (let i = 0; i < this.ships.length; i++) this.ships[i].slot = i
  }
}
