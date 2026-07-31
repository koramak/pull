// Object pool with dense packing. Alive objects occupy [0, count); kill()
// swap-removes. Zero allocation after construction — trails are fixed-size
// ring buffers sized for the largest trail the config might ask for.

export const ROCK = 0
export const ORE = 1

export const TRAIL_CAP = 64 // points; config trail.length must stay <= this

export interface GameObject {
  x: number
  y: number
  px: number // position at previous sim step, for render interpolation
  py: number
  vx: number
  vy: number
  r: number
  rot: number
  rs: number
  type: number // ROCK | ORE
  touched: boolean // meaningfully accelerated by the well (deflect bonus)
  dead: boolean // marked during pair collisions, swept after
  seed: number // per-object shape variation
  trail: Float32Array // x,y pairs, ring buffer
  trailHead: number // next write slot
  trailLen: number
}

function makeObject(): GameObject {
  return {
    x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0,
    r: 10, rot: 0, rs: 0, type: ROCK,
    touched: false, dead: false, seed: 0,
    trail: new Float32Array(TRAIL_CAP * 2),
    trailHead: 0, trailLen: 0
  }
}

export class ObjectPool {
  objs: GameObject[]
  count = 0

  constructor(capacity: number) {
    this.objs = new Array(capacity)
    for (let i = 0; i < capacity; i++) this.objs[i] = makeObject()
  }

  /** Returns a reset object ready to configure, or null if the pool is full. */
  spawn(): GameObject | null {
    if (this.count >= this.objs.length) return null
    const o = this.objs[this.count++]
    o.touched = false
    o.dead = false
    o.trailHead = 0
    o.trailLen = 0
    return o
  }

  /** Swap-remove the object at alive-index i. */
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

export function pushTrailPoint(o: GameObject, maxLen: number): void {
  const cap = TRAIL_CAP
  o.trail[o.trailHead * 2] = o.x
  o.trail[o.trailHead * 2 + 1] = o.y
  o.trailHead = (o.trailHead + 1) % cap
  if (o.trailLen < Math.min(maxLen, cap)) o.trailLen++
  else if (o.trailLen > Math.min(maxLen, cap)) o.trailLen = Math.min(maxLen, cap)
}
