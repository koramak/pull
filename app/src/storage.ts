// Storage adapter: localStorage when available (web, Capacitor webview),
// in-memory fallback where it isn't (sandboxed embeds, private browsing).

export interface KVStore {
  get(key: string): string | null
  set(key: string, value: string): void
}

class LocalStore implements KVStore {
  get(key: string): string | null {
    try { return localStorage.getItem(key) } catch { return null }
  }
  set(key: string, value: string): void {
    try { localStorage.setItem(key, value) } catch { /* full or denied — drop */ }
  }
}

class MemoryStore implements KVStore {
  private m = new Map<string, string>()
  get(key: string): string | null { return this.m.get(key) ?? null }
  set(key: string, value: string): void { this.m.set(key, value) }
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

const BEST_KEY = 'pull.best'

export function loadBest(): number {
  const v = store.get(BEST_KEY)
  const n = v === null ? 0 : parseInt(v, 10)
  return Number.isFinite(n) ? n : 0
}

export function saveBest(score: number): void {
  store.set(BEST_KEY, String(score))
}
