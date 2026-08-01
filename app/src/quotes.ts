// P5 — the death-screen quote gallery. Science fiction and the void,
// spoken over the burn-in.
//
// PUBLIC DOMAIN ONLY (explicit ruling). Every entry below is from a work
// published before 1929 in the United States (or by an author dead well
// over 70 years, with the quoted edition itself pre-1929), quoted verbatim
// as an excerpt. Translations are themselves pre-1929 (George Long's
// Meditations, 1862). Verify PD status before adding anything here.

export interface DeathQuote {
  text: string
  attrib: string // "— AUTHOR, YEAR"
}

export const DEATH_QUOTES: readonly DeathQuote[] = [
  {
    // "MS. Found in a Bottle", 1833
    text: 'We are hurrying onwards to some exciting knowledge — some never-to-be-imparted secret, whose attainment is destruction.',
    attrib: '— EDGAR ALLAN POE, 1833'
  },
  {
    // "Darkness", 1816 — opening lines
    text: "The bright sun was extinguish'd, and the stars did wander darkling in the eternal space.",
    attrib: '— LORD BYRON, 1816'
  },
  {
    // The War of the Worlds, 1898
    text: 'Intellects vast and cool and unsympathetic regarded this earth with envious eyes.',
    attrib: '— H.G. WELLS, 1898'
  },
  {
    // The War of the Worlds, 1898
    text: 'The chances against anything man-like on Mars are a million to one.',
    attrib: '— H.G. WELLS, 1898'
  },
  {
    // Frankenstein, 1818 — the creature, final chapter
    text: 'I shall die, and what I now feel be no longer felt.',
    attrib: '— MARY SHELLEY, 1818'
  },
  {
    // "Ulysses", 1842 — closing line
    text: 'To strive, to seek, to find, and not to yield.',
    attrib: '— ALFRED, LORD TENNYSON, 1842'
  },
  {
    // "A Descent into the Maelström", 1841
    text: 'All this time I had never let go of the ring-bolt.',
    attrib: '— EDGAR ALLAN POE, 1841'
  },
  {
    // Meditations IV, George Long translation, 1862
    text: 'The universe is transformation: life is opinion.',
    attrib: '— MARCUS AURELIUS (TR. LONG, 1862)'
  },
  {
    // Poems, 1890 (first Todd/Higginson edition)
    text: 'Because I could not stop for Death — He kindly stopped for me —',
    attrib: '— EMILY DICKINSON, 1890'
  }
] as const

export function pickQuote(): DeathQuote {
  return DEATH_QUOTES[Math.floor(Math.random() * DEATH_QUOTES.length)]
}
