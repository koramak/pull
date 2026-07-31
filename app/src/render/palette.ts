// PULL palette — "gold core" direction from the icon kit.
// Hue-contrast rule: threat (cool slate) and reward (warm gold) must never
// share a temperature. Station teal, well violet, danger red.

export const PAL = {
  bg: '#05080d',
  ink: '#d8fff8',

  station: '#5ef2d6',
  stationDark: '#2b8f7d',
  stationHole: '#04261d',

  ore: '#ffe23f',
  oreDark: '#b89b1e',

  rock: '#8d99ae',
  rockDark: '#5c6678',

  well: '#c08cff',
  wellDim: 'rgba(192,140,255,0.55)',

  bad: '#ff6b6b',

  star: '180,200,255', // rgb triplet; alpha applied per star
  panel: 'rgba(4,7,12,0.78)'
} as const

export const FONT_STACK = "'VT323', 'Courier New', monospace"
