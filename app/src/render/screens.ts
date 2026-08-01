// Shell v2 — plain screens (kit 24b–24f). Same art as the run, ordinary
// structure: a title, a button, a score, a list. No boot animation, no
// attract-mode theatre. All layout in world units on the 393×852 stage.

import { TUNING } from '../config'
import { game } from '../state'
import { settings } from '../storage'
import type { Station, Track } from '../sim/station'
import { upgrade } from '../upgrade'
import { PAL, FONT_NUM, FONT_LABEL, rgba } from './palette'

const TAU = Math.PI * 2

/** Transient UI state the input layer writes and the renderer reads. */
export const ui = {
  playPressed: false,
  playPressT: 0,
  resetHoldT: 0,
  resetDone: false
}

export interface Layout {
  w: number
  h: number
  safeTop: number
}

// --- geometry --------------------------------------------------------------

export function playButton(l: Layout): { x: number; y: number; r: number } {
  return { x: l.w / 2, y: l.h * 0.784, r: TUNING.shell.playButtonRadius }
}

/** N1 — the title's play target: an asteroid sitting where the station will be. */
export function titlePlayButton(l: Layout): { x: number; y: number; r: number } {
  return { x: l.w / 2, y: l.h * TUNING.station.yFrac, r: TUNING.shell.playButtonRadius }
}

export function doneButton(l: Layout): { x: number; y: number; r: number } {
  return { x: l.w / 2, y: l.h * 0.784, r: TUNING.shell.smallButtonRadius }
}

export function gearButton(l: Layout): { x: number; y: number; r: number } {
  return { x: l.w - 43, y: l.h - 62, r: 26 }
}

export interface SettingsRow {
  id: 'sound' | 'haptics' | 'reduceMotion' | 'reset'
  label: string
  y: number // row line top
}

export function settingsRows(l: Layout): SettingsRow[] {
  const y0 = l.h * 0.47
  const step = 56
  return [
    { id: 'sound', label: 'SOUND', y: y0 },
    { id: 'haptics', label: 'HAPTICS', y: y0 + step },
    { id: 'reduceMotion', label: 'REDUCE MOTION', y: y0 + step * 2 },
    { id: 'reset', label: 'RESET BEST', y: y0 + step * 3 }
  ]
}

export function hitCircle(x: number, y: number, b: { x: number; y: number; r: number }): boolean {
  const dx = x - b.x
  const dy = y - b.y
  return dx * dx + dy * dy <= b.r * b.r
}

// --- shared pieces ---------------------------------------------------------

function circleButton(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, label: string, fontSize: number, ls: number): void {
  ctx.save()
  ctx.fillStyle = 'rgba(94,242,214,0.03)'
  ctx.strokeStyle = PAL.station
  ctx.lineWidth = 1.6
  ctx.shadowColor = 'rgba(94,242,214,0.4)'
  ctx.shadowBlur = 9
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.fillStyle = PAL.station
  ctx.font = `${fontSize}px ${FONT_LABEL}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  drawTracked(ctx, label, x, y + 1, ls)
  ctx.restore()
}

/** Letter-spaced centred text (canvas has no letter-spacing everywhere). */
function drawTracked(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, ls: number): void {
  if (ls <= 0) {
    ctx.fillText(text, cx, cy)
    return
  }
  const widths: number[] = []
  let total = 0
  for (const ch of text) {
    const w = ctx.measureText(ch).width
    widths.push(w)
    total += w + ls
  }
  total -= ls
  let x = cx - total / 2
  const prevAlign = ctx.textAlign
  ctx.textAlign = 'left'
  let i = 0
  for (const ch of text) {
    ctx.fillText(ch, x, cy)
    x += widths[i++] + ls
  }
  ctx.textAlign = prevAlign
}

function gear(ctx: CanvasRenderingContext2D, l: Layout): void {
  const g = gearButton(l)
  ctx.strokeStyle = '#3f5d66'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(g.x, g.y, 9, 0, TAU)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(g.x, g.y, 2.4, 0, TAU)
  ctx.stroke()
}

// --- screens ---------------------------------------------------------------

/** Title — PULL, best, and a live drifting field. The play target is itself
 *  an asteroid, centred where the station will be. (N1 + L5) */
export function drawTitle(ctx: CanvasRenderingContext2D, l: Layout, t: number): void {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = PAL.ink
  ctx.font = `76px ${FONT_NUM}`
  ctx.shadowColor = 'rgba(159,214,232,0.7)'
  ctx.shadowBlur = 7
  drawTracked(ctx, 'PULL', l.w / 2 + 5, l.safeTop + l.h * 0.176, 10)
  ctx.shadowBlur = 0

  if (game.best > 0) {
    ctx.fillStyle = PAL.label
    ctx.font = `12px ${FONT_LABEL}`
    drawTracked(ctx, `BEST ${game.best}`, l.w / 2 + 1.2, l.safeTop + l.h * 0.214, 2.4)
  }

  const b = titlePlayButton(l)
  drawPlayRock(ctx, b.x, b.y, t)

  // pressing PLAY does the gravity animation — a circle closing on the rock
  if (ui.playPressed) {
    const el = t - ui.playPressT
    ctx.strokeStyle = PAL.rock
    for (let k = 0; k < 2; k++) {
      const f = ((el + k * 0.45) % 0.9) / 0.9
      const r = 118 - 62 * f
      ctx.globalAlpha = f < 0.15 ? f / 0.15 : 1 - Math.max(0, f - 0.8) / 0.2
      ctx.lineWidth = 1 + 1.2 * f
      ctx.beginPath()
      ctx.arc(b.x, b.y, r, 0, TAU)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  gear(ctx, l)
}

/** The asteroid-styled PLAY target: the monolith outline, doubled, with the
 *  label riding level inside while the rock idles around it. */
function drawPlayRock(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const T = TUNING.title
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(t * T.playSpin)
  ctx.scale(T.playRockScale, T.playRockScale)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.shadowColor = 'rgba(159,214,232,0.45)'
  ctx.shadowBlur = 8
  ctx.strokeStyle = PAL.rockLit
  ctx.lineWidth = 2.4 / T.playRockScale
  poly(ctx, [-26, -6, -20, -20, 0, -28, 22, -15], false)
  ctx.stroke()
  ctx.strokeStyle = rgba(PAL.rockDark, 0.8)
  ctx.lineWidth = 1.2 / T.playRockScale
  poly(ctx, [22, -15, 27, 10, 6, 27, -20, 19, -26, -6], false)
  ctx.stroke()
  ctx.shadowBlur = 0
  ctx.restore()

  ctx.fillStyle = PAL.rockLit
  ctx.font = `15px ${FONT_LABEL}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  drawTracked(ctx, 'PLAY', x, y + 1, 3)
  ctx.textBaseline = 'alphabetic'
}

function poly(g: CanvasRenderingContext2D, pts: number[], close: boolean): void {
  g.beginPath()
  g.moveTo(pts[0], pts[1])
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1])
  if (close) g.closePath()
}

/** Paused — the phone pauses you, not a button. Field is drawn by the
 *  renderer at 16%; the score stays bright. (24c) */
export function drawPaused(ctx: CanvasRenderingContext2D, l: Layout): void {
  const b = playButton(l)
  circleButton(ctx, b.x, b.y, b.r, 'RESUME', 15, 3)
}

/** Result — score, three numbers, play again. (24d) */
export function drawResult(ctx: CanvasRenderingContext2D, l: Layout): void {
  const appear = game.phaseT
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  if (appear > 0.15) {
    ctx.fillStyle = PAL.label
    ctx.font = `12px ${FONT_LABEL}`
    drawTracked(ctx, 'STATION DOWN', l.w / 2 + 1.5, l.safeTop + l.h * 0.249, 3)
  }

  // the score arrives late, because the loss should land before the number
  if (appear > 0.65) {
    const a = Math.min(1, (appear - 0.65) / 0.3)
    ctx.globalAlpha = a
    ctx.fillStyle = game.newBest ? PAL.ore : PAL.ink
    ctx.font = `96px ${FONT_NUM}`
    ctx.shadowColor = game.newBest ? 'rgba(255,226,63,0.6)' : 'rgba(159,214,232,0.6)'
    ctx.shadowBlur = 10
    drawTracked(ctx, String(game.score), l.w / 2 + 3, l.safeTop + l.h * 0.352, 6)
    ctx.shadowBlur = 0
    ctx.font = `12px ${FONT_LABEL}`
    if (game.newBest) {
      ctx.fillStyle = PAL.ore
      drawTracked(ctx, 'NEW BEST', l.w / 2 + 1.5, l.safeTop + l.h * 0.39, 3)
    } else if (game.best > 0) {
      ctx.fillStyle = PAL.label
      drawTracked(ctx, `BEST ${game.best}`, l.w / 2 + 1.5, l.safeTop + l.h * 0.39, 3)
    }
    ctx.globalAlpha = 1
  }

  if (appear > 1.1) {
    const a = Math.min(1, (appear - 1.1) / 0.3)
    ctx.globalAlpha = a
    const x0 = 60
    const x1 = l.w - 60
    const y0 = l.h * 0.474
    const step = 54
    const rows: Array<[string, string]> = [
      ['TIME', fmtTime(game.time)],
      ['ORE', String(game.oreTotal)],
      ['HULL', String(lastSections)]
    ]
    ctx.font = `14px ${FONT_LABEL}`
    ctx.strokeStyle = '#1b2228'
    ctx.lineWidth = 1
    for (let i = 0; i <= rows.length; i++) {
      ctx.beginPath()
      ctx.moveTo(x0, y0 + i * step)
      ctx.lineTo(x1, y0 + i * step)
      ctx.stroke()
    }
    for (let i = 0; i < rows.length; i++) {
      const yy = y0 + i * step + 32
      ctx.textAlign = 'left'
      ctx.fillStyle = PAL.label
      ctx.fillText(rows[i][0], x0, yy)
      ctx.textAlign = 'right'
      ctx.fillStyle = PAL.inkDim
      ctx.fillText(rows[i][1], x1, yy)
    }
    ctx.textAlign = 'center'
    ctx.globalAlpha = 1
  }

  if (appear > 1.5) {
    const b = playButton(l)
    circleButton(ctx, b.x, b.y, b.r, 'PLAY AGAIN', 14, 2)
    gear(ctx, l)
  }
}

/** Sections the last run died at — written by main on collapse end. */
export let lastSections = 3
export function setLastSections(n: number): void {
  lastSections = n
}

/** Settings — four rows. Dot on, hollow off. Reset is a hold. (24e) */
export function drawSettings(ctx: CanvasRenderingContext2D, l: Layout): void {
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = PAL.labelBright
  ctx.font = `13px ${FONT_LABEL}`
  drawTrackedLeft(ctx, 'SETTINGS', 22, l.safeTop + 62, 3)

  const rows = settingsRows(l)
  const x0 = 24
  const x1 = l.w - 24
  ctx.strokeStyle = '#1b2228'
  ctx.lineWidth = 1
  for (let i = 0; i <= rows.length; i++) {
    const y = (i < rows.length ? rows[i].y : rows[rows.length - 1].y + 56)
    ctx.beginPath()
    ctx.moveTo(x0, y)
    ctx.lineTo(x1, y)
    ctx.stroke()
  }
  ctx.font = `15px ${FONT_LABEL}`
  for (const row of rows) {
    const textY = row.y + 32
    ctx.fillStyle = PAL.inkDim
    drawTrackedLeft(ctx, row.label, x0, textY, 2)
    const cx = l.w - 37
    const cy = row.y + 26
    if (row.id === 'reset') {
      ctx.textAlign = 'right'
      ctx.font = `12px ${FONT_LABEL}`
      ctx.fillStyle = ui.resetDone ? PAL.ore : PAL.label
      ctx.fillText(ui.resetDone ? 'CLEARED' : 'HOLD', x1, textY)
      ctx.font = `15px ${FONT_LABEL}`
      ctx.textAlign = 'left'
      if (ui.resetHoldT > 0 && !ui.resetDone) {
        const f = Math.min(1, ui.resetHoldT / TUNING.shell.resetHold)
        ctx.strokeStyle = PAL.ore
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.arc(cx - 26, cy, 10, -Math.PI / 2, -Math.PI / 2 + TAU * f)
        ctx.stroke()
      }
    } else {
      const onNow = row.id === 'sound' ? settings.sound : row.id === 'haptics' ? settings.haptics : settings.reduceMotion
      ctx.beginPath()
      ctx.arc(cx, cy, 6.5, 0, TAU)
      if (onNow) {
        ctx.fillStyle = PAL.station
        ctx.fill()
        ctx.strokeStyle = PAL.station
      } else {
        ctx.strokeStyle = '#3f5d66'
      }
      ctx.lineWidth = 1.6
      ctx.stroke()
    }
  }

  const b = doneButton(l)
  circleButton(ctx, b.x, b.y, b.r, 'DONE', 14, 2.5)
}

function drawTrackedLeft(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, ls: number): void {
  let xx = x
  for (const ch of text) {
    ctx.fillText(ch, xx, y)
    xx += ctx.measureText(ch).width + ls
  }
}

// --- the choice: plates, bracket, lock (kit UPGRADE — CHOSEN, COMBINED) ----

const TRACK_LABEL: Record<Track, string> = {
  hull: 'HULL',
  ships: 'SHIPS',
  capacity: 'CAPACITY'
}

export function drawChoice(ctx: CanvasRenderingContext2D, st: Station, l: Layout): void {
  const alpha = upgrade.plateAlpha()
  if (alpha <= 0.01 && upgrade.stage !== 'lock') return
  const C = TUNING.choice

  for (let i = 0; i < upgrade.plates.length; i++) {
    const p = upgrade.plates[i]
    const px = Math.max(C.plateRadius + 8, Math.min(l.w - C.plateRadius - 8, p.x))
    const py = Math.max(l.safeTop + C.plateRadius + 8, Math.min(l.h - C.plateRadius - 8, p.y))
    ctx.save()
    ctx.globalAlpha = alpha * (p.enabled ? 1 : 0.28)
    ctx.fillStyle = 'rgba(4,7,12,0.94)'
    ctx.strokeStyle = rgba(PAL.station, 0.7)
    ctx.lineWidth = 1.3
    ctx.beginPath()
    ctx.arc(px, py, C.plateRadius, 0, TAU)
    ctx.fill()
    ctx.stroke()
    drawPlatePreview(ctx, p.track, st, px, py - 12, p.enabled)
    ctx.fillStyle = PAL.ink
    ctx.font = `16px ${FONT_LABEL}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    drawTracked(ctx, TRACK_LABEL[p.track], px + 0.6, py + 42, 1.2)
    ctx.restore()
  }

  // hint
  if (upgrade.stage === 'waiting' || upgrade.stage === 'entering') {
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = PAL.rock
    ctx.font = `13px ${FONT_LABEL}`
    ctx.textAlign = 'center'
    drawTracked(ctx, 'SWIPE TOWARD ONE', l.w / 2 + 1.2, Math.min(l.h - 40, st.y + 196), 2.4)
    ctx.restore()
  }

  // bracket travelling to the picked plate, white dot leading
  if (upgrade.stage === 'flick' && upgrade.pickedIndex >= 0) {
    const p = upgrade.plates[upgrade.pickedIndex]
    const f = upgrade.travel
    const bx = st.x + (p.x - st.x) * f
    const by = st.y + (p.y - st.y) * f
    ctx.save()
    ctx.strokeStyle = PAL.ink
    ctx.globalAlpha = 0.9
    ctx.lineWidth = 1.8
    ctx.shadowColor = 'rgba(234,252,255,0.6)'
    ctx.shadowBlur = 9
    ctx.beginPath()
    ctx.arc(bx, by, C.plateRadius + 7, 0, TAU)
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.fillStyle = PAL.ink
    ctx.beginPath()
    ctx.arc(bx, by, 3.6, 0, TAU)
    ctx.fill()
    ctx.restore()
  }

  // lock — the only white flash outside a smash
  if (upgrade.stage === 'lock' && upgrade.pickedIndex >= 0) {
    const p = upgrade.plates[upgrade.pickedIndex]
    const f = upgrade.t / C.lockFlash
    ctx.save()
    ctx.globalAlpha = 1 - f
    ctx.strokeStyle = PAL.white
    ctx.lineWidth = 2.4
    ctx.shadowColor = 'rgba(234,252,255,0.95)'
    ctx.shadowBlur = 11
    ctx.beginPath()
    ctx.arc(p.x, p.y, (C.plateRadius + 7) * (0.94 + 0.18 * f), 0, TAU)
    ctx.stroke()
    ctx.restore()
  }
}

/** Each plate previews the actual parts it welds onto your station — warm
 *  new structure against your existing hull in cyan. */
function drawPlatePreview(ctx: CanvasRenderingContext2D, track: Track, st: Station, cx: number, cy: number, enabled: boolean): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.lineCap = 'round'
  const gold = enabled

  // existing hull, mini (r24) with current section count
  const n = st.sections
  const gapHalf = (4 * Math.PI) / 180
  if (track === 'hull') {
    const m = n + 1
    for (let i = 0; i < m; i++) {
      const b0 = -Math.PI / 2 + (i / m) * TAU
      const b1 = -Math.PI / 2 + ((i + 1) / m) * TAU
      const isNew = i === m - 1
      ctx.strokeStyle = isNew && gold ? PAL.ore : rgba(PAL.station, 0.55)
      ctx.lineWidth = isNew ? 1.8 : 1.6
      if (isNew && gold) {
        ctx.shadowColor = 'rgba(255,226,63,0.85)'
        ctx.shadowBlur = 6
      }
      ctx.beginPath()
      ctx.arc(0, 0, 24, b0 + gapHalf, b1 - gapHalf)
      ctx.stroke()
      ctx.shadowBlur = 0
      // flare — new boundaries warm
      const isNewFlare = isNew || i === 0
      ctx.strokeStyle = isNewFlare && gold ? PAL.ore : rgba(PAL.station, 0.5)
      ctx.lineWidth = isNewFlare ? 3.24 : 2.5
      if (isNewFlare && gold) {
        ctx.shadowColor = 'rgba(255,226,63,0.85)'
        ctx.shadowBlur = 6
      }
      ctx.beginPath()
      ctx.moveTo(Math.cos(b0) * 24, Math.sin(b0) * 24)
      ctx.lineTo(Math.cos(b0) * 28.56, Math.sin(b0) * 28.56)
      ctx.stroke()
      ctx.shadowBlur = 0
    }
  } else {
    ctx.strokeStyle = rgba(PAL.station, 0.55)
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.arc(0, 0, 24, 0, TAU)
    ctx.stroke()
  }

  // core
  ctx.strokeStyle = rgba(PAL.core, 0.7)
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.arc(0, 0, 9, 0, TAU)
  ctx.stroke()

  if (track === 'ships') {
    ctx.strokeStyle = rgba(PAL.ore, 0.34)
    ctx.lineWidth = 1
    ctx.setLineDash([2, 5])
    ctx.beginPath()
    ctx.arc(0, 0, 33, 0, TAU)
    ctx.stroke()
    ctx.setLineDash([])
    if (gold) {
      ctx.save()
      ctx.translate(23.3, -23.3)
      ctx.rotate((135 * Math.PI) / 180)
      ctx.scale(1.5, 1.5)
      ctx.fillStyle = 'rgba(255,226,63,0.16)'
      ctx.strokeStyle = PAL.ore
      ctx.lineWidth = 1.2
      ctx.shadowColor = 'rgba(255,226,63,0.85)'
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.moveTo(0, -4.1)
      ctx.lineTo(2.9, 3.4)
      ctx.lineTo(0, 1.7)
      ctx.lineTo(-2.9, 3.4)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
  } else if (track === 'capacity' && gold) {
    ctx.strokeStyle = PAL.ore
    ctx.lineWidth = 1.8
    ctx.shadowColor = 'rgba(255,226,63,0.85)'
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.arc(0, 0, 18.7, 0, TAU)
    ctx.stroke()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU - Math.PI / 2
      ctx.beginPath()
      ctx.moveTo(Math.cos(a) * 18.7, Math.sin(a) * 18.7)
      ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 24)
      ctx.stroke()
    }
    ctx.shadowBlur = 0
  }
  ctx.restore()
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec < 10 ? '0' : ''}${sec}`
}
