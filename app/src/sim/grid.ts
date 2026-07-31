// Uniform spatial grid for pairwise collision queries. Implemented as
// linked lists in flat typed arrays (head per cell, next per object) so a
// rebuild every sim step allocates nothing.
//
// Cell size must be >= the largest pair-collision distance (rockRadiusMax*2)
// so a 3x3 neighborhood always covers every candidate pair.

import type { GameObject } from './pool'

export class UniformGrid {
  private cellSize = 64
  private cols = 1
  private rows = 1
  private heads = new Int32Array(1)
  private next = new Int32Array(1)

  resize(width: number, height: number, cellSize: number, maxObjects: number): void {
    this.cellSize = cellSize
    // +2 cols/rows of slack: objects can sit slightly outside the viewport
    this.cols = Math.max(1, Math.ceil(width / cellSize) + 2)
    this.rows = Math.max(1, Math.ceil(height / cellSize) + 2)
    if (this.heads.length < this.cols * this.rows) this.heads = new Int32Array(this.cols * this.rows)
    if (this.next.length < maxObjects) this.next = new Int32Array(maxObjects)
  }

  private cellOf(x: number, y: number): number {
    let cx = Math.floor(x / this.cellSize) + 1
    let cy = Math.floor(y / this.cellSize) + 1
    if (cx < 0) cx = 0; else if (cx >= this.cols) cx = this.cols - 1
    if (cy < 0) cy = 0; else if (cy >= this.rows) cy = this.rows - 1
    return cy * this.cols + cx
  }

  build(objs: GameObject[], count: number): void {
    this.heads.fill(-1, 0, this.cols * this.rows)
    for (let i = 0; i < count; i++) {
      const c = this.cellOf(objs[i].x, objs[i].y)
      this.next[i] = this.heads[c]
      this.heads[c] = i
    }
  }

  /**
   * Visit every candidate pair (i, j) with j < i exactly once.
   * The callback may mark objects dead but must not reorder the pool.
   */
  forEachPair(objs: GameObject[], count: number, cb: (i: number, j: number) => void): void {
    for (let i = 0; i < count; i++) {
      const o = objs[i]
      const cx = Math.floor(o.x / this.cellSize) + 1
      const cy = Math.floor(o.y / this.cellSize) + 1
      for (let dy = -1; dy <= 1; dy++) {
        const yy = cy + dy
        if (yy < 0 || yy >= this.rows) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = cx + dx
          if (xx < 0 || xx >= this.cols) continue
          let j = this.heads[yy * this.cols + xx]
          while (j !== -1) {
            if (j < i) cb(i, j)
            j = this.next[j]
          }
        }
      }
    }
  }
}
