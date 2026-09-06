import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppData, Member, MemberPrefs, Setlist, Song, SongPersonal } from '../types'
import type { StorageAdapter } from './adapter'
import type { CloudConfig } from './config'
import { seedData } from '../data/seed'
import { migrateSetlists } from '../data/migrateSetlists'

/**
 * Спільна база для всієї групи.
 *
 * Кожна сутність — окремий рядок, а не один великий документ: інакше двоє,
 * що редагують різні пісні одночасно, затирали б правки одне одного.
 */

const CACHE_KEY = 'worship-hub:cloud-cache'

type Row = { id: string; data: unknown }

/** Тримаємо останній стан, щоб писати лише те, що справді змінилось */
let lastSnapshot: AppData | null = null

function cache(data: AppData) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch { /* сховище повне */ }
}

function readCache(): AppData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as AppData) : null
  } catch {
    return null
  }
}

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((i) => [i.id, i]))
}

/** Що додалося чи змінилося, і що зникло */
function diff<T extends { id: string }>(before: T[], after: T[]) {
  const prev = byId(before)
  const next = byId(after)
  const upserts = after.filter((i) => JSON.stringify(prev.get(i.id)) !== JSON.stringify(i))
  const deletes = before.filter((i) => !next.has(i.id)).map((i) => i.id)
  return { upserts, deletes }
}

export function createSupabaseAdapter(config: CloudConfig): StorageAdapter {
  const client: SupabaseClient = createClient(config.url, config.anonKey, {
    auth: { persistSession: false },
  })

  const pull = async (): Promise<AppData> => {
    const [members, songs, setlists, personal, prefs] = await Promise.all([
      client.from('members').select('id,data'),
      client.from('songs').select('id,data'),
      client.from('setlists').select('id,data'),
      client.from('personal').select('id,data'),
      client.from('prefs').select('id,data'),
    ])

    const firstError = [members, songs, setlists, personal, prefs].find((r) => r.error)?.error
    if (firstError) throw new Error(firstError.message)

    const seed = seedData()
    const rows = <T,>(r: { data: Row[] | null }): T[] => (r.data ?? []).map((x) => x.data as T)

    const loadedMembers = rows<Member>(members)
    const prefsRows = (prefs.data ?? []) as Row[]

    return {
      // Порожня база — підставляємо стартовий склад, щоб було з чого почати
      members: loadedMembers.length ? loadedMembers : seed.members,
      songs: rows<Song>(songs),
      setlists: migrateSetlists(rows<Setlist>(setlists)),
      personal: rows<SongPersonal>(personal),
      prefs: Object.fromEntries(prefsRows.map((r) => [r.id, r.data as MemberPrefs])),
    }
  }

  return {
    async load() {
      try {
        const data = await pull()
        lastSnapshot = data
        cache(data)
        return data
      } catch (e) {
        // Немає мережі — працюємо з останнім, що бачили. Головне на сцені.
        const cached = readCache()
        if (cached) {
          lastSnapshot = cached
          return cached
        }
        throw e
      }
    },

    async save(data) {
      cache(data)
      const before = lastSnapshot
      lastSnapshot = data
      if (!before) return

      const jobs: PromiseLike<unknown>[] = []

      const sync = (table: string, d: ReturnType<typeof diff>) => {
        if (d.upserts.length) {
          jobs.push(client.from(table).upsert(
            d.upserts.map((i) => ({ id: i.id, data: i, updated_at: new Date().toISOString() })),
          ))
        }
        if (d.deletes.length) {
          jobs.push(client.from(table).delete().in('id', d.deletes))
        }
      }

      sync('members', diff(before.members, data.members))
      sync('songs', diff(before.songs, data.songs))
      sync('setlists', diff(before.setlists, data.setlists))
      sync('personal', diff(before.personal, data.personal))

      // Налаштування учасника ключуються його id, а не полем усередині
      for (const [memberId, value] of Object.entries(data.prefs)) {
        if (JSON.stringify(before.prefs[memberId]) === JSON.stringify(value)) continue
        jobs.push(client.from('prefs').upsert({
          id: memberId, data: value, updated_at: new Date().toISOString(),
        }))
      }

      await Promise.all(jobs)
    },

    subscribe(cb) {
      const channel = client
        .channel('worship-hub')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => {
          // Хтось змінив дані — перечитуємо все й оновлюємо екран
          pull().then((fresh) => {
            lastSnapshot = fresh
            cache(fresh)
            cb(fresh)
          }).catch(() => { /* мережа зникла — лишаємось на своєму */ })
        })
        .subscribe()

      return () => { void client.removeChannel(channel) }
    },
  }
}
