// Typed event bus. Sim emits, meta systems (audio, haptics, fx, future
// missions/stats/daily-seed) attach. Payload objects are reused where hot —
// listeners must not retain them across the call.

export interface EventMap {
  runStart: void
  spawn: { type: 'rock' | 'ore'; x: number; y: number }
  smash: { x: number; y: number; bothRocks: boolean }
  bank: { x: number; y: number; score: number }
  hullHit: { hull: number; x: number; y: number }
  deflect: { x: number; y: number }
  death: { score: number; best: number; newBest: boolean }
  pause: void
  resume: void
}

type Listener<K extends keyof EventMap> = (payload: EventMap[K]) => void

// Internally untyped store; the generic signatures on on/emit keep the
// public surface fully typed.
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
