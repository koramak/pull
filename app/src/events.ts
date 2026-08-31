// Typed event bus. Sim emits, meta systems (audio, haptics, fx, future
// missions/stats/daily-seed) attach. Payload objects are reused where hot —
// listeners must not retain them across the call.

export interface EventMap {
  runStart: void
  spawn: { kind: string; x: number; y: number }
  smash: { x: number; y: number; bothRocks: boolean; nearStation: boolean; value: number; chain: number; risky: boolean }
  /** Rubble coming apart on a graze — quieter than a smash. */
  crumble: { x: number; y: number }
  bank: { x: number; y: number; score: number; doubled: boolean }
  reservoirFull: void
  hullHit: { sectionsBefore: number; alive: number; x: number; y: number; angle: number }
  oreSpill: { amount: number; x: number; y: number }
  deflect: { x: number; y: number; value: number }
  nearMiss: { x: number; y: number; gap: number; angle: number }
  /** The shield ate a broken piece. `gold` > 0 only at full shield level. */
  shieldBlock: { x: number; y: number; angle: number; gold: number }
  /** The shield finished its recharge and is armed again. */
  shieldReady: void
  choiceOpen: void
  choiceLock: { track: 'hull' | 'shield' | 'repair' }
  surge: void
  /** N4 — the post-upgrade shockwave clearing the field. */
  clearPulse: void
  /** M8 — an ore vein was announced at screen side 0-3 (top/right/bottom/left). */
  vein: { side: number }
  /** M6 — a dead hull section was relit (the HULL plate repaired it). */
  hullRepair: { section: number }
  /** P1 — a mission just completed (one star). */
  missionDone: { text: string }
  /** P1 — the stars crossed a rank boundary. */
  rankUp: { name: string }
  collapse: { score: number; best: number; newBest: boolean }
  pause: void
  resume: void
}

type Listener<K extends keyof EventMap> = (payload: EventMap[K]) => void

const listeners: Partial<Record<keyof EventMap, Array<(payload: never) => void>>> = {}

export function on<K extends keyof EventMap>(event: K, fn: Listener<K>): () => void {
  const arr = (listeners[event] ??= []) as Array<Listener<K>>
  arr.push(fn)
  return () => {
    const i = arr.indexOf(fn)
    if (i >= 0) arr.splice(i, 1)
  }
}

export function emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
  const arr = listeners[event] as Array<Listener<K>> | undefined
  if (!arr) return
  for (let i = 0; i < arr.length; i++) arr[i](payload)
}
