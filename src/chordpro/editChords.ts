/**
 * Правки акордів просто в перегляді пісні: зсув, заміна, видалення, додавання.
 * Усе працює з тілом секції у ChordPro — саме там акорд прив'язаний до складу.
 */

export interface ChordRef {
  /** Номер рядка всередині секції */
  line: number
  /** Порядковий номер акорду в цьому рядку */
  index: number
}

interface Found {
  start: number
  end: number
  text: string
}

/** Усі акорди рядка з їхніми межами в сирому тексті */
function chordsOf(line: string): Found[] {
  const out: Found[] = []
  const re = /\[([^\]]*)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[1] })
  }
  return out
}

function editLine(body: string, line: number, fn: (l: string) => string): string {
  const lines = body.split('\n')
  if (line < 0 || line >= lines.length) return body
  lines[line] = fn(lines[line])
  return lines.join('\n')
}

/** Зсуває акорд на `delta` символів тексту — тобто раніше чи пізніше в рядку */
export function moveChord(body: string, ref: ChordRef, delta: number): string {
  return editLine(body, ref.line, (l) => {
    const chords = chordsOf(l)
    const c = chords[ref.index]
    if (!c) return l

    const tag = l.slice(c.start, c.end)
    const without = l.slice(0, c.start) + l.slice(c.end)

    // Позиція рахується в символах тексту, без урахування інших міток
    const before = without.slice(0, c.start)
    const textPos = before.replace(/\[[^\]]*\]/g, '').length
    const target = Math.max(0, textPos + delta)

    // Переводимо позицію в тексті назад у позицію в сирому рядку
    let seen = 0
    let insertAt = without.length
    for (let i = 0; i <= without.length; i++) {
      if (seen === target) { insertAt = i; break }
      if (without[i] === '[') {
        const close = without.indexOf(']', i)
        i = close === -1 ? without.length : close
        continue
      }
      seen += 1
    }
    return without.slice(0, insertAt) + tag + without.slice(insertAt)
  })
}

export function replaceChord(body: string, ref: ChordRef, next: string): string {
  return editLine(body, ref.line, (l) => {
    const c = chordsOf(l)[ref.index]
    if (!c) return l
    return l.slice(0, c.start) + `[${next}]` + l.slice(c.end)
  })
}

export function removeChord(body: string, ref: ChordRef): string {
  return editLine(body, ref.line, (l) => {
    const c = chordsOf(l)[ref.index]
    if (!c) return l
    return l.slice(0, c.start) + l.slice(c.end)
  })
}

/**
 * Вставляє акорд перед символом `textPos` (позиція рахується без міток).
 * Так акорд стає рівно над тим складом, куди тицьнули.
 */
export function insertChord(body: string, line: number, textPos: number, chord: string): string {
  return editLine(body, line, (l) => {
    let seen = 0
    for (let i = 0; i <= l.length; i++) {
      if (seen === textPos) return l.slice(0, i) + `[${chord}]` + l.slice(i)
      if (l[i] === '[') {
        const close = l.indexOf(']', i)
        i = close === -1 ? l.length : close
        continue
      }
      seen += 1
    }
    return l + `[${chord}]`
  })
}

/** Скільки акордів у рядку — щоб знати межі для навігації */
export function chordCount(line: string): number {
  return chordsOf(line).length
}
