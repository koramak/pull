// Pooled floating score text. Strings only change on events, never per frame.

export interface FloatText {
  x: number
  y: number
  text: string
  color: string
  life: number
}

export class FloatPool {
  floats: FloatText[]
  count = 0

  constructor(capacity: number) {
    this.floats = new Array(capacity)
    for (let i = 0; i < capacity; i++) {
      this.floats[i] = { x: 0, y: 0, text: '', color: '#fff', life: 0 }
    }
  }

  spawn(x: number, y: number, text: string, color: string): void {
    if (this.count >= this.floats.length) return
    const f = this.floats[this.count++]
    f.x = x
    f.y = y
    f.text = text
    f.color = color
    f.life = 1.0
  }

  update(dt: number): void {
    for (let i = this.count - 1; i >= 0; i--) {
      const f = this.floats[i]
      f.y -= 44 * dt
      f.life -= dt
      if (f.life <= 0) {
        const last = this.count - 1
        this.floats[i] = this.floats[last]
        this.floats[last] = f
        this.count = last
      }
    }
  }

  clear(): void {
    this.count = 0
  }
}
