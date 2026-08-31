// Object pool with dense packing. Alive objects occupy [0, count); kill()
// swap-removes. Zero allocation after construction.
//
// Rock vocabulary (kit 14c + 14b's ladder): monolith and rubble are the two
// heavy kinds; smashes yield the next class down; nothing has fewer than
// four sides. History ring buffers carry x,y,rot for the 13e echoes.

export const ORE = 0
export const MONOLITH = 1
export const MEDIUM = 2
export const SHARD = 3
export const CHIP = 4
export const RUBBLE = 5

export const HISTORY_CAP = 20 // 60Hz samples ≥ 240ms of echo history

export interface GameObject {
  x: number
  y: number
  px: number // previous sim-step position (render interpolation)
  py: number
  vx: number
  vy: number
  r: number
  rot: number
  rs: number
  kind: number
  hp: number       // durability (idle since SHIPS became SHIELD; rock data)
  touched: boolean // meaningfully accelerated by the well (deflect bonus)
  dead: boolean
  seed: number
  hitFlash: number // s of full-outline flash (idle; kept for future use)
  /** Born from a split — a "broken piece". The shield only blocks these. */
  frag: boolean
  // near-miss bookkeeping
  minGap: number
  lastDist: number
  missCredited: boolean
  // echo history: x,y,rot triplets at 60Hz
  hist: Float32Array
  histHead: number
  histLen: number
}

function makeObject(): GameObject {
  return {
    x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0,
    r: 10, rot: 0, rs: 0, kind: MEDIUM, hp: 1,
    touched: false, dead: false, seed: 0, hitFlash: 0, frag: false,
    minGap: 1e9, lastDist: 1e9, missCredited: false,
    hist: new Float32Array(HISTORY_CAP * 3),
    histHead: 0, histLen: 0
  }
}

export class ObjectPool {
  objs: GameObject[]
  count = 0

  constructor(capacity: number) {
    this.objs = new Array(capacity)
    for (let i = 0; i < capacity; i++) this.objs[i] = makeObject()
  }

  spawn(): GameObject | null {
    if (this.count >= this.objs.length) return null
    const o = this.objs[this.count++]
    o.touched = false
    o.dead = false
    o.hp = 1
    o.hitFlash = 0
    o.frag = false
    o.minGap = 1e9
    o.lastDist = 1e9
    o.missCredited = false
    o.histHead = 0
    o.histLen = 0
    return o
  }

  kill(i: number): void {
    const last = this.count - 1
    const tmp = this.objs[i]
    this.objs[i] = this.objs[last]
    this.objs[last] = tmp
    this.count = last
  }

  clear(): void {
    this.count = 0
  }
}

export function pushHistory(o: GameObject): void {
  const base = o.histHead * 3
  o.hist[base] = o.x
  o.hist[base + 1] = o.y
  o.hist[base + 2] = o.rot
  o.histHead = (o.histHead + 1) % HISTORY_CAP
  if (o.histLen < HISTORY_CAP) o.histLen++
}

/**
 * Read the history sample n 60Hz-frames back (0 = newest). Returns false if
 * not enough history yet. Writes into `out` [x, y, rot].
 */
export function readHistory(o: GameObject, back: number, out: Float32Array): boolean {
  if (back >= o.histLen) return false
  const idx = ((o.histHead - 1 - back) % HISTORY_CAP + HISTORY_CAP) % HISTORY_CAP
  out[0] = o.hist[idx * 3]
  out[1] = o.hist[idx * 3 + 1]
  out[2] = o.hist[idx * 3 + 2]
  return true
}

/** Is this kind cool mass (a threat)? Ships only ever shoot cool. */
export function isRock(kind: number): boolean {
  return kind !== ORE
}
