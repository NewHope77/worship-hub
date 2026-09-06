import type { AppData } from '../types'
import type { StorageAdapter } from './adapter'
import { seedData } from '../data/seed'
import { migrateSetlists } from '../data/migrateSetlists'

const KEY = 'worship-hub:data:v1'

export const localAdapter: StorageAdapter = {
  async load() {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return seedData()
      const parsed = JSON.parse(raw) as Partial<AppData>
      const seed = seedData()
      return {
        members: parsed.members ?? seed.members,
        // Пісні, збережені до появи режиму оригіналу, не мають поля raw
        songs: (parsed.songs ?? seed.songs).map((s) => ({ ...s, raw: s.raw ?? '' })),
        setlists: migrateSetlists(parsed.setlists ?? seed.setlists),
        songOrder: parsed.songOrder ?? [],
        personal: parsed.personal ?? [],
        prefs: parsed.prefs ?? {},
      }
    } catch {
      return seedData()
    }
  },

  async save(data) {
    localStorage.setItem(KEY, JSON.stringify(data))
  },

  subscribe(cb) {
    const handler = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        try { cb(JSON.parse(e.newValue) as AppData) } catch { /* ігноруємо биті дані */ }
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  },
}
