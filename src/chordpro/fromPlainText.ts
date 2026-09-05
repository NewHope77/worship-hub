/**
 * Конвертер найпоширенішого формату запису пісень — коли акорди стоять
 * окремим рядком НАД текстом і вирівняні пробілами по колонках:
 *
 *       C           G
 *   Тільки Ти, Господь, моя сила
 *
 * На виході — ChordPro (`Тільки [C]Ти, Господь, [G]моя сила`), який застосунок
 * уміє показувати в трьох режимах і транспонувати.
 */

/** Акорд: латиниця, бо кирилична «А» не має бути акордом */
const CHORD_TOKEN = /^[A-H][b#]?(?:m|min|maj|M|dim|aug|sus|add|°|\+)?\d*(?:sus\d|add\d+|maj\d+|m\d+)*(?:\/[A-H][b#]?)?$/

/** Службові позначки, які трапляються в рядку акордів: | x2 (2x) : ‖ - */
const SERVICE_TOKEN = /^(?:[|‖:%/\\.\-–—]+|\(?\d+\s*[xх]\)?|\(?[xх]\s*\d+\)?|N\.?C\.?)$/i

function tokensOf(line: string): { text: string; col: number }[] {
  const out: { text: string; col: number }[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) out.push({ text: m[0], col: m.index })
  return out
}

/** Рядок складається лише з акордів (і службових позначок) */
export function isChordLine(line: string): boolean {
  if (!line.trim()) return false
  if (/[Ѐ-ӿ]/.test(line)) return false // кирилиця — це текст, не акорди
  const tokens = tokensOf(line)
  if (tokens.length === 0) return false
  const chords = tokens.filter((t) => CHORD_TOKEN.test(t.text))
  if (chords.length === 0) return false
  return tokens.every((t) => CHORD_TOKEN.test(t.text) || SERVICE_TOKEN.test(t.text))
}

/** Чи текст уже у форматі ChordPro */
export function looksLikeChordPro(text: string): boolean {
  return /\[[A-H][b#]?[^\]\n]{0,12}\]/.test(text)
}

/**
 * Вставляє акорди з `chordLine` у `textLine` за колонками.
 * Вставка йде з кінця, щоб позиції попередніх акордів не зсувались.
 */
export function mergeChordLine(chordLine: string, textLine: string): string {
  const tokens = tokensOf(chordLine).filter((t) => CHORD_TOKEN.test(t.text))
  if (tokens.length === 0) return textLine
  let out = textLine.replace(/\s+$/, '')
  for (let i = tokens.length - 1; i >= 0; i--) {
    const { text, col } = tokens[i]
    if (col >= out.length) {
      // акорд «звисає» за кінець рядка — дотягуємо пробілами
      out = out.padEnd(col, ' ') + `[${text}]`
    } else {
      out = out.slice(0, col) + `[${text}]` + out.slice(col)
    }
  }
  return out
}

/** Рядок акордів без тексту під ним — програш, вступ тощо */
function chordOnlyToChordPro(line: string): string {
  return tokensOf(line)
    .map((t) => (CHORD_TOKEN.test(t.text) ? `[${t.text}]` : t.text))
    .join(' ')
}

function letterCount(line: string): number {
  return (line.match(/\p{L}/gu) ?? []).length
}

/** Чи рядок схожий на справжній рядок тексту пісні */
function isLyricLine(line: string): boolean {
  return !isChordLine(line) && /[\p{L}]{3,}/u.test(line)
}

/**
 * Відкидає службову «шапку» з аплікатурами акордів, яку деякі сайти
 * ставлять перед піснею: блок до першого порожнього рядка, у якому немає
 * жодного справжнього рядка тексту.
 */
function stripChordChart(lines: string[]): string[] {
  const firstBlank = lines.findIndex((l) => !l.trim())
  if (firstBlank <= 0) return lines
  const head = lines.slice(0, firstBlank)
  // Рахуємо літери в рядку загалом, а не поспіль: у справжньому тексті
  // слова короткі й розділені пробілами.
  const hasLyrics = head.some((l) => isLyricLine(l) && letterCount(l) >= 10)
  const hasChords = head.some((l) => tokensOf(l).some((t) => CHORD_TOKEN.test(t.text)))
  if (hasChords && !hasLyrics) return lines.slice(firstBlank + 1)
  return lines
}

/** Головна функція: «акорди над текстом» → ChordPro */
export function chordsAboveToChordPro(raw: string): string {
  const lines = stripChordChart(raw.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n'))
  const out: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!isChordLine(line)) {
      out.push(line.replace(/\s+$/, ''))
      continue
    }
    const next = lines[i + 1]
    if (next !== undefined && isLyricLine(next)) {
      out.push(mergeChordLine(line, next))
      i += 1 // текстовий рядок уже спожито
    } else {
      out.push(chordOnlyToChordPro(line))
    }
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Приводить будь-який вставлений текст до ChordPro */
export function normalizeToChordPro(raw: string): string {
  return looksLikeChordPro(raw) ? raw.trim() : chordsAboveToChordPro(raw)
}
