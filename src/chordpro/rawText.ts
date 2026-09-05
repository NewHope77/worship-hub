/**
 * Робота з піснею у вигляді «як в оригіналі»: текст зберігається символ у
 * символ, разом з усіма відступами, і показується моноширинним шрифтом.
 * Нічого не перебудовується — тому вигляд гарантовано збігається з джерелом.
 */
import { isChordLine } from './fromPlainText'
import { transposeChord, isChord } from './transpose'

interface Token { text: string; col: number }

function tokensOf(line: string): Token[] {
  const out: Token[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) out.push({ text: m[0], col: m.index })
  return out
}

/**
 * Транспонує рядок акордів, лишаючи кожен акорд у його колонці.
 * Якщо новий акорд довший і наліз би на сусіда, зсув мінімальний —
 * решта рядка не «їде».
 */
function transposeChordLine(line: string, semitones: number, targetKey: string): string {
  const tokens = tokensOf(line)
  let out = ''
  for (const t of tokens) {
    const next = isChord(t.text) ? transposeChord(t.text, semitones, targetKey) : t.text
    if (t.col > out.length) out = out.padEnd(t.col, ' ')
    else if (out.length) out += ' '
    out += next
  }
  return out
}

/** Транспонує текст пісні, не руйнуючи його розкладку */
export function transposeRaw(raw: string, semitones: number, targetKey: string): string {
  if (!semitones) return raw
  return raw
    .split('\n')
    .map((line) => (isChordLine(line) ? transposeChordLine(line, semitones, targetKey) : line))
    .join('\n')
}

/**
 * Зворотне перетворення: ChordPro → «акорди рядком над словами».
 * Потрібне для пісень, доданих до появи режиму оригіналу, — щоб і в них
 * було що показати «як у файлі».
 */
export function chordProToChordsAbove(body: string): string {
  const out: string[] = []

  for (const line of body.replace(/\r\n?/g, '\n').split('\n')) {
    let chordLine = ''
    let textLine = ''
    const re = /\[([^\]]*)\]|([^[]+)/g
    let m: RegExpExecArray | null

    while ((m = re.exec(line)) !== null) {
      if (m[1] !== undefined) {
        // Акорд стає над поточною позицією тексту
        if (chordLine.length > textLine.length) chordLine += ' '
        else chordLine = chordLine.padEnd(textLine.length, ' ')
        chordLine += m[1]
      } else {
        textLine += m[2]
      }
    }

    if (chordLine.trim()) out.push(chordLine.replace(/\s+$/, ''))
    if (textLine.trim() || !chordLine.trim()) out.push(textLine.replace(/\s+$/, ''))
  }

  return out.join('\n')
}

/** Збирає всю пісню у вигляд «як у файлі» з секцій */
export function sectionsToRaw(
  sections: { label: string; body: string }[],
  arrangement: string[] = [],
  ids: string[] = [],
): string {
  void arrangement
  void ids
  return sections
    .map((s) => `${s.label}\n${chordProToChordsAbove(s.body)}`)
    .join('\n\n')
}
