import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppData, Member, MemberPrefs, Setlist, Song, SongPersonal, ViewMode } from './types'
import { INSTRUMENTS } from './types'
import { storage } from './storage'

const MEMBER_KEY = 'worship-hub:me'

export const DEFAULT_PREFS: MemberPrefs = {
  viewMode: 'chords',
  fontSize: 17,
  scrollSpeed: 30,
  showCapo: true,
  layout: 'parsed',
  rawFontSize: 13,
  theme: 'dark',
}

interface Store {
  data: AppData
  ready: boolean
  me: Member | null
  meId: string | null
  signIn(id: string): void
  signOut(): void

  prefs: MemberPrefs
  setPrefs(patch: Partial<MemberPrefs>): void

  upsertSong(song: Song): void
  deleteSong(id: string): void
  upsertSetlist(sl: Setlist): void
  deleteSetlist(id: string): void
  upsertMember(m: Member): void
  deleteMember(id: string): void

  personalFor(songId: string): SongPersonal
  /** Патч може бути функцією — тоді він бачить актуальне значення, а не те,
   *  що було на момент рендеру: інакше швидкі кліки поспіль губились. */
  setPersonal(
    songId: string,
    patch: PersonalPatch | ((current: SongPersonal) => PersonalPatch),
  ): void
}

type PersonalPatch = Partial<Omit<SongPersonal, 'id' | 'memberId' | 'songId'>>

const Ctx = createContext<Store | null>(null)

const EMPTY: AppData = { members: [], songs: [], setlists: [], personal: [], prefs: {} }

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY)
  const [ready, setReady] = useState(false)
  const [meId, setMeId] = useState<string | null>(() => localStorage.getItem(MEMBER_KEY))
  // Не записуємо назад те, що щойно прилетіло ззовні
  const skipSave = useRef(true)

  useEffect(() => {
    let alive = true
    storage.load().then((d) => {
      if (!alive) return
      skipSave.current = true
      setData(d)
      setReady(true)
    })
    const unsub = storage.subscribe((d) => {
      skipSave.current = true
      setData(d)
    })
    return () => { alive = false; unsub() }
  }, [])

  useEffect(() => {
    if (!ready) return
    if (skipSave.current) { skipSave.current = false; return }
    void storage.save(data)
  }, [data, ready])

  const me = useMemo(
    () => data.members.find((m) => m.id === meId) ?? null,
    [data.members, meId],
  )

  const prefs = useMemo<MemberPrefs>(() => {
    if (!me) return DEFAULT_PREFS
    const saved = data.prefs[me.id]
    if (saved) return { ...DEFAULT_PREFS, ...saved }
    // Перший вхід — беремо режим із головного інструмента
    const primary = INSTRUMENTS.find((i) => i.id === me.instruments[0])
    return { ...DEFAULT_PREFS, viewMode: primary?.defaultView ?? 'chords' }
  }, [me, data.prefs])

  // Тема живе на <html>, щоб фон сторінки й системні елементи змінювались разом
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('theme-light', prefs.theme === 'light')
    root.classList.toggle('theme-dark', prefs.theme !== 'light')
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', prefs.theme === 'light' ? '#f6f7f9' : '#0f1115')
  }, [prefs.theme])

  const store: Store = {
    data,
    ready,
    me,
    meId,

    signIn(id) {
      localStorage.setItem(MEMBER_KEY, id)
      setMeId(id)
    },
    signOut() {
      localStorage.removeItem(MEMBER_KEY)
      setMeId(null)
    },

    prefs,
    setPrefs(patch) {
      if (!me) return
      setData((d) => ({ ...d, prefs: { ...d.prefs, [me.id]: { ...prefs, ...patch } } }))
    },

    upsertSong(song) {
      setData((d) => {
        const next = { ...song, updatedAt: Date.now() }
        const i = d.songs.findIndex((s) => s.id === song.id)
        const songs = i === -1 ? [...d.songs, next] : d.songs.map((s) => (s.id === song.id ? next : s))
        return { ...d, songs }
      })
    },
    deleteSong(id) {
      setData((d) => ({
        ...d,
        songs: d.songs.filter((s) => s.id !== id),
        personal: d.personal.filter((p) => p.songId !== id),
        setlists: d.setlists.map((sl) => ({ ...sl, items: sl.items.filter((it) => it.songId !== id) })),
      }))
    },

    upsertSetlist(sl) {
      setData((d) => {
        const next = { ...sl, updatedAt: Date.now() }
        const i = d.setlists.findIndex((x) => x.id === sl.id)
        const setlists = i === -1 ? [...d.setlists, next] : d.setlists.map((x) => (x.id === sl.id ? next : x))
        return { ...d, setlists }
      })
    },
    deleteSetlist(id) {
      setData((d) => ({ ...d, setlists: d.setlists.filter((s) => s.id !== id) }))
    },

    upsertMember(m) {
      setData((d) => {
        const i = d.members.findIndex((x) => x.id === m.id)
        const members = i === -1 ? [...d.members, m] : d.members.map((x) => (x.id === m.id ? m : x))
        return { ...d, members }
      })
    },
    deleteMember(id) {
      setData((d) => ({ ...d, members: d.members.filter((m) => m.id !== id) }))
    },

    personalFor(songId) {
      const id = `${meId}:${songId}`
      return (
        data.personal.find((p) => p.id === id) ?? {
          id, memberId: meId ?? '', songId,
          transpose: 0, capo: 0, viewMode: null, note: '',
        }
      )
    },
    setPersonal(songId, patch) {
      if (!meId) return
      const id = `${meId}:${songId}`
      setData((d) => {
        const existing = d.personal.find((p) => p.id === id)
        const base: SongPersonal = existing ?? {
          id, memberId: meId, songId, transpose: 0, capo: 0, viewMode: null, note: '',
        }
        const next = { ...base, ...(typeof patch === 'function' ? patch(base) : patch) }
        const personal = existing
          ? d.personal.map((p) => (p.id === id ? next : p))
          : [...d.personal, next]
        return { ...d, personal }
      })
    },
  }

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore має викликатись усередині <StoreProvider>')
  return s
}

/** Активний режим перегляду для пісні: особистий > загальний */
export function effectiveView(personal: SongPersonal, prefs: MemberPrefs): ViewMode {
  return personal.viewMode ?? prefs.viewMode
}
