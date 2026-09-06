export type InstrumentId =
  | 'vocal' | 'keys' | 'bass' | 'egtr' | 'agtr' | 'drums' | 'sound'

export type ViewMode = 'text' | 'chords' | 'grid'

/** Показ пісні: розібраної на секції чи точно як в оригіналі */
export type Layout = 'parsed' | 'original'

export type Theme = 'dark' | 'light'

/** Мова інтерфейсу: кнопки й налаштування. Тексти пісень не чіпає. */
export type UiLang = 'uk' | 'ru' | 'en'

export interface Instrument {
  id: InstrumentId
  name: string
  emoji: string
  /** Режим відображення пісні за замовчуванням для цього інструмента */
  defaultView: ViewMode
}

export interface Member {
  id: string
  name: string
  instruments: InstrumentId[]
  isLeader: boolean
  /** Колір аватарки (tailwind-клас градієнта) */
  color: string
}

/** Персональні налаштування учасника — свої в кожного */
export interface MemberPrefs {
  viewMode: ViewMode
  fontSize: number
  showCapo: boolean
  /** Який показ відкривати за замовчуванням */
  layout: Layout
  /** Кегль моноширинного тексту в режимі оригіналу */
  rawFontSize: number
  /** Темний екран для сцени, світлий — для яскравого світла */
  theme: Theme
  /** Акорди крупніші, текст приглушений — для баса й барабанів */
  chordsAccent: boolean
  /** Скільки колонок — на широкому екрані дві вміщають удвічі більше */
  columns: 1 | 2
  /** Мова інтерфейсу */
  lang: UiLang
}

export type SectionKind =
  | 'intro' | 'verse' | 'prechorus' | 'chorus' | 'bridge'
  | 'instrumental' | 'tag' | 'outro' | 'other'

export interface Section {
  id: string
  kind: SectionKind
  /** Підпис, який видно: «Куплет 1», «Приспів», «Міст» */
  label: string
  /** Текст у ChordPro: акорди в квадратних дужках всередині рядка */
  body: string
}

export interface Song {
  id: string
  title: string
  author: string
  /** Тональність, у якій записані акорди в body */
  originalKey: string
  tempo: number | null
  timeSignature: string
  tags: string[]
  sections: Section[]
  /** Порядок секцій за замовчуванням (id секцій, можуть повторюватись) */
  arrangement: string[]
  youtubeUrl: string
  /** Загальні нотатки — бачать усі */
  notes: string
  /**
   * Текст точно в тому вигляді, як його вставили або витягли з файлу —
   * з усіма відступами. Показується моноширинним шрифтом «як є».
   * Порожній у пісень, доданих до появи цього режиму.
   */
  raw: string
  createdBy: string
  updatedAt: number
}

/** Персональні налаштування учасника на конкретну пісню */
export interface SongPersonal {
  /** `${memberId}:${songId}` */
  id: string
  memberId: string
  songId: string
  /** Наскільки півтонів транспонувати відносно оригіналу */
  transpose: number
  capo: number
  viewMode: ViewMode | null
  /** Особиста нотатка — бачить тільки власник */
  note: string
  /** Темп для метронома — барабанщик ставить свій, не чіпаючи пісню */
  metronomeTempo?: number | null
  /** Розмір такту для метронома */
  metronomeSignature?: string
}

export interface SetlistItem {
  id: string
  songId: string
  /** Транспонування для всієї групи в цьому сеті */
  transpose: number
  /** Порядок секцій саме для цього служіння; порожній = брати з пісні */
  arrangement: string[]
  leadMemberId: string | null
  note: string
}

export interface Setlist {
  id: string
  title: string
  /** ISO-дата YYYY-MM-DD */
  date: string
  items: SetlistItem[]
  updatedAt: number
}

export interface AppData {
  members: Member[]
  songs: Song[]
  setlists: Setlist[]
  personal: SongPersonal[]
  prefs: Record<string, MemberPrefs>
}

/** Чи грає учасник на цьому інструменті */
export function playsInstrument(
  member: { instruments: InstrumentId[] } | null,
  id: InstrumentId,
): boolean {
  return !!member?.instruments.includes(id)
}

export const INSTRUMENTS: Instrument[] = [
  { id: 'vocal', name: 'Вокал', emoji: '🎤', defaultView: 'text' },
  { id: 'keys', name: 'Клавіші', emoji: '🎹', defaultView: 'chords' },
  { id: 'agtr', name: 'Акустика', emoji: '🎸', defaultView: 'chords' },
  { id: 'egtr', name: 'Електрогітара', emoji: '🎸', defaultView: 'chords' },
  { id: 'bass', name: 'Бас', emoji: '🎵', defaultView: 'grid' },
  { id: 'drums', name: 'Барабани', emoji: '🥁', defaultView: 'grid' },
  { id: 'sound', name: 'Звук', emoji: '🎚️', defaultView: 'text' },
]

export const SECTION_KINDS: Record<SectionKind, { label: string; color: string }> = {
  intro:        { label: 'Вступ',      color: 'text-slate-400 border-slate-600' },
  verse:        { label: 'Куплет',     color: 'text-sky-300 border-sky-700' },
  prechorus:    { label: 'Пре-приспів', color: 'text-violet-300 border-violet-700' },
  chorus:       { label: 'Приспів',    color: 'text-amber-300 border-amber-600' },
  bridge:       { label: 'Міст',       color: 'text-rose-300 border-rose-700' },
  instrumental: { label: 'Програш',    color: 'text-emerald-300 border-emerald-700' },
  tag:          { label: 'Тег',        color: 'text-teal-300 border-teal-700' },
  outro:        { label: 'Кінцівка',   color: 'text-slate-400 border-slate-600' },
  other:        { label: 'Інше',       color: 'text-slate-400 border-slate-600' },
}
