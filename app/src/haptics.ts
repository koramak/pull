// Haptics behind a feature guard. navigator.vibrate covers Android web;
// iOS Safari ignores it. Seam: when wrapped in Capacitor, swap `pulse` to
// @capacitor/haptics impacts without touching call sites.

import { on } from './events'

function pulse(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern)
  } catch { /* ignore */ }
}

export function initHaptics(): void {
  on('smash', () => pulse(10))
  on('bank', () => pulse(12))
  on('hullHit', e => pulse(e.hull <= 0 ? [40, 50, 80] : [30, 40, 50]))
}
