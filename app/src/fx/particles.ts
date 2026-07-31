// Pooled burst particles (dense packing, swap-remove). Visual only — these
// update on real frame time, never inside the fixed sim step.

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  r: number
  color: string
}

export class ParticlePool {
  parts: Particle[]
  count = 0

  constructor(capacity: number) {
    this.parts = new Array(capacity)
    for (let i = 0; i < capacity; i++) {
      this.parts[i] = { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, r: 2, color: '#fff' }
    }
  }

  burst(x: number, y: number, color: string, n: number, speed: number): void {
    for (let i = 0; i < n; i++) {
      if (this.count >= this.parts.length) return
      const p = this.parts[this.count++]
      const ang = Math.random() * Math.PI * 2
      const s = speed * (0.3 + Math.random())
      p.x = x
      p.y = y
      p.vx = Math.cos(ang) * s
      p.vy = Math.sin(ang) * s
      p.life = 0.4 + Math.random() * 0.4
      p.maxLife = p.life
      p.r = 2 + Math.random() * 4
      p.color = color
    }
  }

  update(dt: number): void {
    for (let i = this.count - 1; i >= 0; i--) {
      const p = this.parts[i]
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
      if (p.life <= 0) {
        const last = this.count - 1
        this.parts[i] = this.parts[last]
        this.parts[last] = p
        this.count = last
      }
    }
  }

  clear(): void {
    this.count = 0
  }
}
