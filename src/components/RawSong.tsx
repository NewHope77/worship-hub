import { useMemo } from 'react'
import {
  isChordLine, isChordToken, isSlashBass, isUnambiguousChord,
} from '../chordpro/fromPlainText'

interface Props {
  text: string
  fontSize: number
  showText: boolean
  showChords: boolean
}

/**
 * Показ пісні «точно як в оригіналі».
 *
 * Кожен акорд — окремий елемент, тож ховати текст чи акорди можна поштучно,
 * а не цілими рядками: у чартах вони часто стоять в одному рядку впереміш.
 * Текст ховається через visibility, щоб зберегти свою ширину — інакше акорди
 * зсунулись би зі своїх складів.
 */
export default function RawSong({ text, fontSize, showText, showChords }: Props) {
  const lines = useMemo(() => text.split('\n'), [text])

  const rendered = useMemo(() => {
    const out: React.ReactNode[] = []

    lines.forEach((line, i) => {
      const pieces = splitLine(line)
      const hasChord = pieces.some((p) => p.isChord)
      const hasWords = pieces.some((p) => !p.isChord && p.text.trim())

      // Рядок самих акордів при вимкнених акордах зникає цілком,
      // інакше лишалася б порожня смуга
      if (!showChords && hasChord && !hasWords) return
      if (!showText && !hasChord && hasWords) return

      // Текст вимкнено — акорди стискаються в компактний рядок: тримати
      // порожні місця під невидимими словами немає сенсу
      if (!showText) {
        out.push(
          <div key={i} className="flex flex-wrap items-baseline gap-x-4">
            {pieces.filter((p) => p.isChord).map((p, j) => (
              <span key={j} className="text-[var(--accent)] font-bold">{p.text}</span>
            ))}
          </div>,
        )
        return
      }

      out.push(
        <div key={i}>
          {pieces.map((p, j) => {
            if (p.isChord) {
              if (!showChords) return null
              return <span key={j} className="text-[var(--accent)] font-bold">{p.text}</span>
            }
            return <span key={j}>{p.text}</span>
          })}
        </div>,
      )
    })

    return out
  }, [lines, showText, showChords])

  return (
    <pre
      className="font-mono leading-snug text-[var(--text)] whitespace-pre"
      style={{ fontSize, tabSize: 4 }}
    >
      {rendered.length ? rendered : ' '}
    </pre>
  )
}

interface Piece { text: string; isChord: boolean }

/** Ріже рядок на шматки, позначаючи, які з них акорди */
function splitLine(line: string): Piece[] {
  if (!line) return [{ text: ' ', isChord: false }]

  const pureChordLine = isChordLine(line)
  const pieces: Piece[] = []
  const re = /(\s+|\S+)/g
  let m: RegExpExecArray | null
  let prevGapWide = true

  while ((m = re.exec(line)) !== null) {
    const piece = m[0]

    if (/^\s+$/.test(piece)) {
      pieces.push({ text: piece, isChord: false })
      prevGapWide = piece.length >= 2
      continue
    }

    const rest = line.slice(re.lastIndex)
    const nextGapWide = rest === '' || /^\s{2}/.test(rest) || /^\s*$/.test(rest)
    const chordLike = isChordToken(piece) || (pureChordLine && isSlashBass(piece))
    const isChord =
      chordLike && (pureChordLine || (prevGapWide && nextGapWide) || isUnambiguousChord(piece))

    pieces.push({ text: piece, isChord })
    prevGapWide = false
  }

  return pieces
}
