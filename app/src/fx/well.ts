// Infall particles for the gravity well: polar coordinates relative to the
// live finger position, so the whole effect tracks the touch with zero lag.

export interface WellParticle {
  angle: number
  radius: number
  angSpeed: number
  radSpeed: number
}

export class WellParticlePool {
  parts: WellParticle[]
  count = 0
  private spawnAcc = 0

  constructor(capacity: number) {
    this.parts = new Array(capacity)
    for (let i = 0; i < capacity; i++) {
      this.parts[i] = { angle: 0, radius: 0, angSpeed: 0, radSpeed: 0 }
    }
  }

  update(dt: number, active: boolean, rate: number): void {
    if (active) {
      this.spawnAcc += rate * dt
      while (this.spawnAcc >= 1) {
        this.spawnAcc -= 1
        if (this.count >= this.parts.length) break
        const p = this.parts[this.count++]
        p.angle = Math.random() * Math.PI * 2
        p.radius = 55 + Math.random() * 40
        p.angSpeed = (2.2 + Math.random() * 2.5) * (Math.random() < 0.5 ? -1 : 1)
        p.radSpeed = 55 + Math.random() * 45
      }
    } else {
      this.spawnAcc = 0
    }
    for (let i = this.count - 1; i >= 0; i--) {
      const p = this.parts[i]
      p.angle += p.angSpeed * dt
      p.radius -= p.radSpeed * dt
      p.radSpeed += 60 * dt // accelerate as they fall in
      if (p.radius <= 5) {
        const last = this.count - 1
        this.parts[i] = this.parts[last]
        this.parts[last] = p
        this.count = last
      }
    }
  }

  clear(): void {
    this.count = 0
    this.spawnAcc = 0
  }
}
