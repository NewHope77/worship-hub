/** Півтони від C. Українці часто пишуть H — трактуємо як B (англійська нотація). */
const NOTE_TO_PC: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5,
  F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10,
  B: 11, H: 11, Cb: 11, 'B#': 0,
}

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NAMES  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

/** Тональності, які прийнято записувати бемолями */
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb',
                           'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm'])

/** Корінь + суфікс + опційний бас: Am7, C#sus4, F/A, Gmaj7/B */
const CHORD_RE = /^([A-H][b#]?)([^/\s]*)(?:\/([A-H][b#]?))?$/

export interface ParsedChord {
  root: string
  suffix: string
  bass: string | null
}

export function parseChord(raw: string): ParsedChord | null {
  const m = CHORD_RE.exec(raw.trim())
  if (!m) return null
  if (!(m[1] in NOTE_TO_PC)) return null
  if (m[3] && !(m[3] in NOTE_TO_PC)) return null
  return { root: m[1], suffix: m[2] ?? '', bass: m[3] ?? null }
}

/** Чи схожий рядок на акорд (для підсвітки та сітки) */
export function isChord(raw: string): boolean {
  return parseChord(raw) !== null
}

function spell(pc: number, useFlats: boolean): string {
  return (useFlats ? FLAT_NAMES : SHARP_NAMES)[((pc % 12) + 12) % 12]
}

/** Тональність після зсуву на `semitones` півтонів */
export function transposeKey(key: string, semitones: number): string {
  const minor = /m$/.test(key) && !/maj/i.test(key)
  const rootRaw = minor ? key.slice(0, -1) : key
  const pc = NOTE_TO_PC[rootRaw]
  if (pc === undefined) return key
  const next = (((pc + semitones) % 12) + 12) % 12
  // Пробуємо обидва написання й обираємо те, яке прийнято для цієї тональності
  const sharp = spell(next, false) + (minor ? 'm' : '')
  const flat = spell(next, true) + (minor ? 'm' : '')
  return FLAT_KEYS.has(flat) ? flat : sharp
}

export function transposeChord(raw: string, semitones: number, targetKey: string): string {
  const c = parseChord(raw)
  if (!c) return raw
  if (semitones === 0) return raw
  const useFlats = FLAT_KEYS.has(targetKey)
  const rootPc = NOTE_TO_PC[c.root]
  let out = spell(rootPc + semitones, useFlats) + c.suffix
  if (c.bass) out += '/' + spell(NOTE_TO_PC[c.bass] + semitones, useFlats)
  return out
}

/** Півтонів між двома тональностями, найкоротшим шляхом (-6..+5) */
export function semitonesBetween(from: string, to: string): number {
  const a = NOTE_TO_PC[from.replace(/m$/, '')]
  const b = NOTE_TO_PC[to.replace(/m$/, '')]
  if (a === undefined || b === undefined) return 0
  let d = (b - a) % 12
  if (d > 6) d -= 12
  if (d < -6) d += 12
  return d
}

/** Усі 12 тональностей для селектора, у правильному написанні */
export function keyOptions(minor: boolean): string[] {
  const out: string[] = []
  for (let pc = 0; pc < 12; pc++) {
    const sharp = spell(pc, false) + (minor ? 'm' : '')
    const flat = spell(pc, true) + (minor ? 'm' : '')
    out.push(FLAT_KEYS.has(flat) ? flat : sharp)
  }
  return out
}

export function isMinorKey(key: string): boolean {
  return /m$/.test(key) && !/maj/i.test(key)
}
