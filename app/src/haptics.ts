// Haptics behind a feature guard + the HAPTICS setting. navigator.vibrate
// covers Android web; iOS Safari ignores it. Seam: when wrapped in
// Capacitor, swap `pulse` to @capacitor/haptics impacts without touching
// call sites.

import { on } from './events'
import { settings } from './storage'

function pulse(pattern: number | number[]): void {
  if (!settings.haptics) return
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern)
  } catch { /* ignore */ }
}

export function initHaptics(): void {
  on('smash', () => pulse(10))
  on('bank', e => pulse(e.doubled ? 16 : 12))
  on('reservoirFull', () => pulse([8, 30, 8]))
  on('hullHit', e => {
    // a heartbeat at three sections, a blink at six
    if (e.alive <= 1 || e.sectionsBefore <= 3) pulse([30, 40, 50])
    else if (e.sectionsBefore === 4) pulse([20, 30, 30])
    else if (e.sectionsBefore === 5) pulse(18)
    else pulse(8)
  })
  on('shieldBlock', () => pulse(12))
  on('choiceLock', () => pulse(10))
  on('surge', () => pulse(20))
  on('collapse', () => pulse([40, 60, 90]))
}
