import { useMemo } from 'react'
import { isChordLine, isChordToken } from '../chordpro/fromPlainText'

/**
 * Показ пісні «точно як в оригіналі»: моноширинний шрифт зберігає всі
 * відступи, а акорди підсвічуються — але тільки там, де це справді акорди,
 * інакше англійські слова в тексті пожовкли б разом з ними.
 */
export default function RawSong({ text, fontSize }: { text: string; fontSize: number }) {
  const lines = useMemo(() => text.split('\n'), [text])

  return (
    <pre
      className="font-mono leading-snug text-slate-100 whitespace-pre"
      style={{ fontSize, tabSize: 4 }}
    >
      {lines.map((line, i) => (
        <div key={i}>{renderLine(line)}</div>
      ))}
    </pre>
  )
}

function renderLine(line: string) {
  if (!line) return ' '

  // У рядку самих акордів підсвічуємо все; у рядку з текстом — лише ті
  // акорди, що стоять окремо, відділені подвійним пробілом.
  const pureChordLine = isChordLine(line)
  const parts: React.ReactNode[] = []
  const re = /(\s+|\S+)/g
  let m: RegExpExecArray | null
  let key = 0
  let prevGapWide = true

  while ((m = re.exec(line)) !== null) {
    const piece = m[0]
    if (/^\s+$/.test(piece)) {
      parts.push(piece)
      prevGapWide = piece.length >= 2
      continue
    }
    const nextChar = line.slice(re.lastIndex, re.lastIndex + 2)
    const nextGapWide = nextChar === '' || /^\s{2}/.test(nextChar) || /^\s*$/.test(nextChar)
    const isChord = isChordToken(piece) && (pureChordLine || (prevGapWide && nextGapWide))

    parts.push(
      isChord
        ? <span key={key++} className="text-amber-400 font-bold">{piece}</span>
        : piece,
    )
    prevGapWide = false
  }
  return parts
}
