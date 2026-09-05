import type { Section, SectionKind } from '../types'
import { isChord } from './transpose'
import { normalizeToChordPro } from './fromPlainText'

/** Одна пара «акорд + текст під ним» */
export interface Token {
  chord: string | null
  text: string
}
export type Line = Token[]

/**
 * Розбирає рядок ChordPro: `[G]Слава [D]Тобі` → [{G,'Слава '},{D,'Тобі'}]
 * Текст без акордів повертається одним токеном з chord: null.
 */
export function parseLine(raw: string): Line {
  const tokens: Line = []
  const re = /\[([^\]]*)\]/g
  let last = 0
  let m: RegExpExecArray | null
  let pendingChord: string | null = null

  while ((m = re.exec(raw)) !== null) {
    const text = raw.slice(last, m.index)
    if (text || pendingChord !== null) tokens.push({ chord: pendingChord, text })
    pendingChord = m[1].trim()
    last = m.index + m[0].length
  }
  const tail = raw.slice(last)
  if (tail || pendingChord !== null) tokens.push({ chord: pendingChord, text: tail })
  if (tokens.length === 0) tokens.push({ chord: null, text: '' })
  return tokens
}

export function parseBody(body: string): Line[] {
  return body.replace(/\r\n?/g, '\n').split('\n').map(parseLine)
}

/** Чи рядок містить хоч один акорд */
export function lineHasChords(line: Line): boolean {
  return line.some((t) => t.chord !== null)
}

/** Послідовність акордів секції — для режиму «сітка» (бас, барабани) */
export function chordSequence(body: string): string[] {
  const out: string[] = []
  for (const line of parseBody(body)) {
    for (const t of line) {
      if (t.chord && isChord(t.chord)) out.push(t.chord)
    }
  }
  return out
}

/** Прибрати всі акорди — чистий текст для вокалістів і для пошуку */
export function stripChords(body: string): string {
  return body.replace(/\[[^\]]*\]/g, '')
}

/**
 * Увага: \b у JS працює лише з латиницею, тож для кириличних слів межу слова
 * задаємо через (?!\p{L}) — після ключового слова не повинна йти буква.
 */
const KIND_PATTERNS: [RegExp, SectionKind][] = [
  [/^(intro|вступ|вступление)(?!\p{L})/iu, 'intro'],
  [/^(pre-?chorus|пре-?приспів|предприпев)(?!\p{L})/iu, 'prechorus'],
  [/^(chorus|приспів|припев|refrain|рефрен)(?!\p{L})/iu, 'chorus'],
  [/^(bridge|міст|мост|бридж)(?!\p{L})/iu, 'bridge'],
  [/^(instrumental|програш|проигрыш|solo|соло|interlude)(?!\p{L})/iu, 'instrumental'],
  [/^(tag|тег|ending\s*tag)(?!\p{L})/iu, 'tag'],
  [/^(outro|кінцівка|концовка|ending|фінал)(?!\p{L})/iu, 'outro'],
  [/^(verse|куплет|стих)(?!\p{L})/iu, 'verse'],
]

export function guessKind(label: string): SectionKind {
  // «1 куплет», «2. Припев», «III. Chorus» — номер спереду прибираємо
  const s = label.trim().replace(/^[\d]+\s*[.)\-–—]?\s*/, '')
  for (const [re, kind] of KIND_PATTERNS) if (re.test(s)) return kind
  return 'other'
}

/** Чи виглядає рядок як заголовок секції («Приспів:», «[Куплет 2]», «CHORUS») */
function isHeading(raw: string): string | null {
  const s = raw.trim()
  if (!s || s.length > 40) return null
  // «Приспів:» / «Куплет 2:»
  const colon = /^([^:\[\]]{2,30}):\s*$/.exec(s)
  if (colon && guessKind(colon[1]) !== 'other') return colon[1].trim()
  // рядок без акордів, який сам по собі є назвою секції
  if (!/\[/.test(s) && guessKind(s) !== 'other' && s.split(/\s+/).length <= 3) {
    return s.replace(/[:.]$/, '')
  }
  return null
}

let seq = 0
export function newId(prefix = 'id'): string {
  seq += 1
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}`
}

/**
 * Вставили пісню одним шматком з Telegram/нотаток — ріжемо на секції.
 * Спершу за явними заголовками, інакше за порожніми рядками.
 */
export function splitIntoSections(input: string): Section[] {
  // Текст міг бути вставлений у форматі «акорди окремим рядком над словами» —
  // спершу приводимо його до ChordPro, і тільки потім ріжемо на секції.
  const raw = normalizeToChordPro(input)
  const lines = raw.split('\n')
  const sections: Section[] = []
  let current: { label: string; lines: string[] } | null = null
  let hasExplicitHeadings = false

  const push = () => {
    if (!current) return
    const body = current.lines.join('\n').replace(/^\n+|\n+$/g, '')
    if (body.trim()) {
      sections.push({
        id: newId('sec'),
        kind: guessKind(current.label),
        label: current.label,
        body,
      })
    }
    current = null
  }

  for (const line of lines) {
    const heading = isHeading(line)
    if (heading) {
      hasExplicitHeadings = true
      push()
      current = { label: heading, lines: [] }
      continue
    }
    if (!current) current = { label: '', lines: [] }
    current.lines.push(line)
  }
  push()

  // Немає заголовків — ріжемо за порожніми рядками й нумеруємо куплети
  if (!hasExplicitHeadings) {
    const blocks = raw.split(/\n\s*\n+/).filter((b) => b.trim())
    let verseNo = 0
    return blocks.map((body) => {
      verseNo += 1
      return {
        id: newId('sec'),
        kind: 'verse' as SectionKind,
        label: `Куплет ${verseNo}`,
        body: body.replace(/^\n+|\n+$/g, ''),
      }
    })
  }

  return sections.map((s, i) => (s.label ? s : { ...s, label: `Куплет ${i + 1}` }))
}
