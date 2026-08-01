// Storage adapter + persisted settings/records.
// Saved keys (kit 24, "SAVED KEYS"):
//   best · runs · sound · haptics · reduceMotion · seenFirstRun · savedRun

export interface KVStore {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

class LocalStore implements KVStore {
  get(key: string): string | null {
    try { return localStorage.getItem(key) } catch { return null }
  }
  set(key: string, value: string): void {
    try { localStorage.setItem(key, value) } catch { /* full or denied — drop */ }
  }
  remove(key: string): void {
    try { localStorage.removeItem(key) } catch { /* ignore */ }
  }
}

class MemoryStore implements KVStore {
  private m = new Map<string, string>()
  get(key: string): string | null { return this.m.get(key) ?? null }
  set(key: string, value: string): void { this.m.set(key, value) }
  remove(key: string): void { this.m.delete(key) }
}

function detect(): KVStore {
  try {
    const probe = '__pull_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return new LocalStore()
  } catch {
    return new MemoryStore()
  }
}

export const store: KVStore = detect()

const K = {
  best: 'pull.best',
  runs: 'pull.runs',
  sound: 'pull.sound',
  haptics: 'pull.haptics',
  reduceMotion: 'pull.reduceMotion',
  seenFirstRun: 'pull.seenFirstRun',
  savedRun: 'pull.savedRun',
  fullHint: 'pull.fullHint',
  deaths: 'pull.deaths'
} as const

// --- settings (live object; write-through) ---------------------------------

export const settings = {
  sound: store.get(K.sound) !== '0',
  haptics: store.get(K.haptics) !== '0',
  reduceMotion: store.get(K.reduceMotion) === '1'
}

export function saveSettings(): void {
  store.set(K.sound, settings.sound ? '1' : '0')
  store.set(K.haptics, settings.haptics ? '1' : '0')
  store.set(K.reduceMotion, settings.reduceMotion ? '1' : '0')
}

// --- records ---------------------------------------------------------------

export function loadBest(): number {
  const n = parseInt(store.get(K.best) ?? '0', 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function saveBest(score: number): void {
  store.set(K.best, String(score))
}

export interface RunRecord {
  score: number
  time: number
  ore: number
  sections: number
  at: number
}

export function loadRuns(): RunRecord[] {
  try {
    const raw = store.get(K.runs)
    if (!raw) return []
    const arr = JSON.parse(raw) as RunRecord[]
    return Array.isArray(arr) ? arr.slice(0, 5) : []
  } catch {
    return []
  }
}

export function pushRun(r: RunRecord): void {
  const runs = loadRuns()
  runs.unshift(r)
  store.set(K.runs, JSON.stringify(runs.slice(0, 5)))
}

export function resetRecords(): void {
  store.remove(K.best)
  store.remove(K.runs)
}

// --- death telemetry (M3) ---------------------------------------------------
// Run-end timestamps, locally. A cluster of deaths at one time value is a
// churn wall; this is the data the difficulty curve gets tuned against.

export interface DeathRecord {
  t: number      // run time at death, s
  score: number
  at: number     // wall clock, ms
}

const DEATHS_CAP = 200

export function pushDeath(d: DeathRecord): void {
  try {
    const raw = store.get(K.deaths)
    const arr: DeathRecord[] = raw ? (JSON.parse(raw) as DeathRecord[]) : []
    arr.push(d)
    store.set(K.deaths, JSON.stringify(arr.slice(-DEATHS_CAP)))
  } catch { /* telemetry is best-effort */ }
}

export function loadDeaths(): DeathRecord[] {
  try {
    const raw = store.get(K.deaths)
    if (!raw) return []
    const arr = JSON.parse(raw) as DeathRecord[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

// --- teaching hints --------------------------------------------------------

/** M2 — how many times the full-reservoir wager line has been shown. */
export function loadFullHintCount(): number {
  const n = parseInt(store.get(K.fullHint) ?? '0', 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function markFullHintShown(): void {
  store.set(K.fullHint, String(loadFullHintCount() + 1))
}

// --- first run -------------------------------------------------------------

export function seenFirstRun(): boolean {
  return store.get(K.seenFirstRun) === '1'
}

export function markFirstRunSeen(): void {
  store.set(K.seenFirstRun, '1')
}

// --- interrupted-run snapshot ----------------------------------------------
// Enough to hand the run back after a call/lock/switch: station build, score,
// clock, reservoir. The live field is not saved — it repopulates.

export interface SavedRun {
  score: number
  time: number
  oreTotal: number
  smashes: number
  sections: number
  dead: number[]
  capacity: number
  ships: number
  reservoir: number
  at: number
}

export function saveRun(r: SavedRun): void {
  try { store.set(K.savedRun, JSON.stringify(r)) } catch { /* ignore */ }
}

export function loadSavedRun(maxAgeS: number): SavedRun | null {
  try {
    const raw = store.get(K.savedRun)
    if (!raw) return null
    const r = JSON.parse(raw) as SavedRun
    if (typeof r.at !== 'number' || (Date.now() - r.at) / 1000 > maxAgeS) return null
    if (typeof r.score !== 'number' || typeof r.sections !== 'number') return null
    return r
  } catch {
    return null
  }
}

export function clearSavedRun(): void {
  store.remove(K.savedRun)
}
