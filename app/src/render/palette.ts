// PULL — phosphor palette. Two tubes: threat sits on the dim one (#9fd6e8,
// ~40% bloom), reward and the station sit on the bright one (#ffe23f,
// #5ef2d6). Bloom radius is the primary read, hue is the backup.
// Tokens lifted 1:1 from the Phosphor Kit.

export const PAL = {
  bg: '#05080d',        // field behind everything (kit frame background)
  field: '#04070c',     // stage black inside the tube

  // Dim tube — threats
  rock: '#9fd6e8',
  rockLit: '#cdeaf5',   // lit leading edge, 2.4 weight, light from upper-left
  rockDark: '#7fb4c8',  // hairline dark edge, 1.0 weight

  // Bright tube — reward + station
  ore: '#ffe23f',
  oreFacet: '#fff6c8',
  oreRamp1: '#A87C18',  // reservoir fill, stepped: 0-33%
  oreRamp2: '#E0B32A',  // 33-66%
  oreRamp3: '#FFE23F',  // 66%-full
  oreDead: '#8a7a4e',   // "ore lost" — deliberately no glow

  station: '#5ef2d6',
  stationDead: '#2c5f66', // dead hull: thin AND dark
  core: '#d8fff8',

  ship: '#eafcff',      // the dart — brightest thing after the score

  ink: '#eafcff',       // score / titles
  inkDim: '#cfd8e6',    // settings values
  label: '#456070',     // DM Mono labels
  labelBright: '#7f8496',
  white: '#ffffff',     // reserved: smash shock rings + upgrade lock flash

  star: '#cfe9f2'
} as const

// VT323 for anything numeric, DM Mono for anything under 12px words.
export const FONT_NUM = "'VT323', 'Courier New', monospace"
export const FONT_LABEL = "'DM Mono', 'Courier New', monospace"

/** rgba() helper for palette hexes (cheap, call outside hot loops). */
export function rgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}
