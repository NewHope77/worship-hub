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

/**
 * Акорд: латиниця, бо кирилична «А» не має бути акордом.
 * Суфікс лишаємо широким — у чартах трапляються o7 (зменшений), ø, add9,
 * sus2, m7b5 тощо. Бас після скісної інколи пишуть малою літерою.
 */
const CHORD_TOKEN =
  /^[A-H][b#]?(?:o|°|ø|\+|-|m|min|maj|M|dim|aug|sus|add|alt)?\d*(?:sus\d|add\d*|maj\d*|m\d*|[b#]\d+|o\d*)*(?:\/[A-Ha-h][b#]?)?$/

/** Бас, відірваний від свого акорду в окремий шматок: /E, /bE, /C */
const SLASH_BASS = /^\/[b#]?[A-Ha-h][b#]?$/

/** Службові позначки, які трапляються в рядку акордів: | x2 (2x) : ‖ - */
const SERVICE_TOKEN = /^(?:[|‖:%/\\.\-–—]+|\(?\d+\s*[xх]\)?|\(?[xх]\s*\d+\)?|N\.?C\.?)$/i

function tokensOf(line: string): { text: string; col: number }[] {
  const out: { text: string; col: number }[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) out.push({ text: m[0], col: m.index })
  return out
}

/** Чи окремий токен є акордом */
export function isChordToken(token: string): boolean {
  return CHORD_TOKEN.test(token)
}

/** Рядок складається лише з акордів (і службових позначок) */
export function isChordLine(line: string): boolean {
  if (!line.trim()) return false
  if (/[Ѐ-ӿ]/.test(line)) return false // кирилиця — це текст, не акорди
  const tokens = tokensOf(line)
  if (tokens.length === 0) return false
  const chords = tokens.filter((t) => CHORD_TOKEN.test(t.text))
  if (chords.length === 0) return false
  return tokens.every(
    (t) => CHORD_TOKEN.test(t.text) || SLASH_BASS.test(t.text) || SERVICE_TOKEN.test(t.text),
  )
}

/**
 * Акорд, який неможливо сплутати зі словом: має цифру, скісну або знак
 * альтерації (C7, Eb/G, Ab, Go7). На відміну від «Go», «Am», «A», які
 * в англійському тексті цілком можуть бути звичайними словами.
 */
export function isUnambiguousChord(token: string): boolean {
  if (!CHORD_TOKEN.test(token) && !SLASH_BASS.test(token)) return false
  return /[0-9/]/.test(token) || /^[A-H][b#]/.test(token)
}

/** Чи токен є відірваним басом («/E») — його теж підсвічуємо як акорд */
export function isSlashBass(token: string): boolean {
  return SLASH_BASS.test(token)
}

/** Чи текст уже у форматі ChordPro */
export function looksLikeChordPro(text: string): boolean {
  return /\[[A-H][b#]?[^\]\n]{0,12}\]/.test(text)
}

/**
 * Вставляє акорди з `chordLine` у `textLine` за колонками.
 * Вставка йде з кінця, щоб позиції попередніх акордів не зсувались.
 */
const WORD_CHAR = /[\p{L}\p{N}]/u

/**
 * Підтягує акорд до межі слова, якщо він упав усередину.
 * Координати з PDF точні, а от після розпізнавання знімка зсуваються
 * на символ-два — і акорд опиняється посеред слова.
 */
function snapToWordBoundary(text: string, col: number): number {
  if (col <= 0 || col >= text.length) return col
  if (!WORD_CHAR.test(text[col - 1]) || !WORD_CHAR.test(text[col])) return col

  let start = col
  while (start > 0 && WORD_CHAR.test(text[start - 1])) start -= 1
  let end = col
  while (end < text.length && WORD_CHAR.test(text[end])) end += 1

  const toStart = col - start
  const toEnd = end - col
  const nearest = toStart <= toEnd ? start : end
  // Далеко від краю — значить акорд справді береться на цьому складі
  return Math.min(toStart, toEnd) <= 3 ? nearest : col
}

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
      const at = snapToWordBoundary(out, col)
      out = out.slice(0, at) + `[${text}]` + out.slice(at)
    }
  }
  return out
}

/**
 * Рядок, у якому акорди стоять поруч зі словами на одній лінії (так буває
 * у щільно зверстаних чартах). Акорд впізнаємо тільки якщо він відокремлений
 * подвійним пробілом — інакше англійське слово «A» чи «Am» стало б акордом.
 */
function inlineChordsToChordPro(line: string): string {
  // Спершу однозначні акорди — їх можна брати навіть без подвійного пробілу
  const withObvious = line.replace(/(^|\s)([^\s]+)(?=\s|$)/g, (whole, gap: string, token: string) =>
    isUnambiguousChord(token) ? `${gap}[${token}]` : whole,
  )
  return withObvious.replace(/(^|\s{2,})([^\s[\]]+)(?=\s{2,}|$)/g, (whole, gap: string, token: string) =>
    CHORD_TOKEN.test(token) || SLASH_BASS.test(token) ? `${gap}[${token}]` : whole,
  )
}

/** Чи рядок містить і акорди, і справжні слова */
function isMixedLine(line: string): boolean {
  if (isChordLine(line) || !line.trim()) return false
  const tokens = tokensOf(line)
  const chords = tokens.filter((t) => CHORD_TOKEN.test(t.text))
  if (chords.length === 0) return false
  const words = tokens.filter((t) => !CHORD_TOKEN.test(t.text) && /[\p{L}]{2,}/u.test(t.text))
  return words.length > 0 && /\s{2,}/.test(line.trim())
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

/** Уламок суфікса акорду: sus4, 7, o7, maj9… */
const SUFFIX_TOKEN = /^(?:sus|maj|add|dim|aug|min|m|o|°|\+|\d)[\w\d#b+°-]{0,4}$/i

/** Рядок, у якому немає нічого, крім таких уламків */
function isSuffixLine(line: string): boolean {
  const tokens = tokensOf(line)
  if (tokens.length === 0) return false
  return tokens.every((t) => t.text.length <= 5 && SUFFIX_TOKEN.test(t.text) && !isChordToken(t.text))
}

/**
 * У чартах суфікси акордів друкують верхнім індексом, і з PDF вони приходять
 * окремим рядком над акордами — виглядає як «акорд над акордом».
 * Тут кожен такий уламок повертається до свого акорду: до найближчого,
 * що стоїть у тій самій або лівішій колонці.
 */
export function mergeSuffixLines(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const below = lines[i + 1]

    // Під рядком індексів може бути і чистий рядок акордів, і рядок,
    // де акорди стоять серед слів — обидва випадки годяться
    const belowHasChords =
      below !== undefined && tokensOf(below).some((t) => isChordToken(t.text))

    if (below !== undefined && isSuffixLine(line) && belowHasChords) {
      const suffixes = tokensOf(line)
      const attached = tokensOf(below).map((c) => ({ ...c }))

      for (const suf of suffixes) {
        // Індекс належить акорду в тій самій або лівішій колонці
        let target: { text: string; col: number } | null = null
        for (const c of attached) {
          if (!isChordToken(c.text)) continue
          if (c.col <= suf.col + 1 && (!target || c.col > target.col)) target = c
        }
        if (target) target.text += suf.text
      }

      // Збираємо рядок назад, зберігаючи вихідні колонки акордів
      let rebuilt = ''
      for (const c of attached) {
        if (c.col > rebuilt.length) rebuilt = rebuilt.padEnd(c.col, ' ')
        else if (rebuilt.length) rebuilt += ' '
        rebuilt += c.text
      }
      out.push(rebuilt)
      i += 1 // рядок з індексами спожито
      continue
    }

    out.push(line)
  }

  return out.join('\n')
}

/** Головна функція: «акорди над текстом» → ChordPro */
export function chordsAboveToChordPro(raw: string): string {
  const lines = stripChordChart(raw.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n'))
  const out: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!isChordLine(line)) {
      out.push(isMixedLine(line) ? inlineChordsToChordPro(line) : line.replace(/\s+$/, ''))
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
