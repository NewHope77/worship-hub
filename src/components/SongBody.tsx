import { useMemo } from 'react'
import type { Section, ViewMode } from '../types'
import { SECTION_KINDS } from '../types'
import { parseBody, lineHasChords } from '../chordpro/parse'
import { transposeChord } from '../chordpro/transpose'

export interface ChordSpot {
  sectionId: string
  line: number
  /** Порядковий номер акорду в рядку; -1 — коли акорду ще немає */
  index: number
  /** Позиція символу в тексті — потрібна, щоб вставити акорд саме сюди */
  textPos: number
  chord: string
}

interface Props {
  sections: Section[]
  /** Порядок секцій; елементи можуть повторюватись */
  arrangement: string[]
  view: ViewMode
  transpose: number
  targetKey: string
  fontSize: number
  /** Увімкнено правку акордів — тоді по них можна тицяти */
  editing?: boolean
  onPickChord?(spot: ChordSpot): void
}

function SectionHeading({ section, repeat }: { section: Section; repeat: number | null }) {
  const meta = SECTION_KINDS[section.kind]
  return (
    <div className="flex items-center gap-2 mt-6 mb-2 first:mt-0">
      <span className={`section-badge text-[11px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${meta.color} bg-[var(--surface-1)]`}>
        {section.label || meta.label}
      </span>
      {repeat !== null && (
        <span className="text-[11px] text-[var(--text-faint)]">×{repeat}</span>
      )}
      <span className="flex-1 h-px bg-[var(--surface-2)]" />
    </div>
  )
}

/** Текст + акорди над словами; `chordsOnly` ховає текст, лишаючи акорди на місцях */
function ChordedSection({ body, transpose, targetKey, showChords, chordsOnly, sectionId, editing, onPickChord }: {
  body: string; transpose: number; targetKey: string; showChords: boolean; chordsOnly?: boolean
  sectionId?: string; editing?: boolean; onPickChord?(spot: ChordSpot): void
}) {
  const lines = useMemo(() => parseBody(body), [body])
  return (
    <div className={`${showChords ? 'chord-line' : 'leading-relaxed'}${chordsOnly ? ' chords-only' : ''}`}>
      {lines.map((line, i) => {
        if (line.length === 1 && line[0].chord === null && !line[0].text.trim()) {
          return <div key={i} className="h-3" />
        }
        // Рядок лише з акордів (напр. вступ) — показуємо як сітку
        const onlyChords = lineHasChords(line) && line.every((t) => !t.text.trim())
        if (onlyChords) {
          if (!showChords) return null
          // Рядок самих акордів (вступ, програш) — рівним рядком, не «сходинками»
          return (
            <div key={i} className="flex flex-wrap gap-x-5 gap-y-0.5 font-mono font-bold text-[var(--accent)] text-[0.92em] leading-relaxed">
              {line.map((t, j) => t.chord && (
                <span key={j}>{transposeChord(t.chord, transpose, targetKey)}</span>
              ))}
            </div>
          )
        }
        // У режимі самих акордів рядок без жодного акорду не потрібен зовсім,
        // інакше від нього лишалася б порожня смуга
        if (chordsOnly && !lineHasChords(line)) return null

        // Рахуємо, скільки акордів і символів тексту вже пройшли — за цим
        // потім знаходимо саме той акорд, по якому тицьнули
        let chordNo = -1
        let textOffset = 0

        return (
          <div key={i} className="whitespace-pre-wrap">
            {line.map((t, j) => {
              const posHere = textOffset
              textOffset += t.text.length
              if (t.chord) chordNo += 1
              const myChordNo = chordNo

              const pick = editing && onPickChord && sectionId
                ? () => onPickChord({
                    sectionId, line: i,
                    index: t.chord ? myChordNo : -1,
                    textPos: posHere,
                    chord: t.chord ?? '',
                  })
                : undefined

              // Без акорда — звичайний текст, щоб довгі фрази нормально переносились
              if (!showChords || !t.chord) {
                return (
                  <span key={j} onClick={pick}
                    className={`chord-slot--plain${editing ? ' editable-text' : ''}`}>
                    {t.text}
                  </span>
                )
              }
              return (
                <span key={j} className="chord-slot">
                  <span className={`chord${editing ? ' editable-chord' : ''}`} onClick={pick}>
                    {transposeChord(t.chord, transpose, targetKey)}
                  </span>
                  <span onClick={pick} className={editing ? 'editable-text' : undefined}>{t.text}</span>
                </span>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

export default function SongBody({
  sections, arrangement, view, transpose, targetKey, fontSize, editing, onPickChord,
}: Props) {
  const byId = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections])
  const order = arrangement.length ? arrangement : sections.map((s) => s.id)

  // Повтори підряд однієї секції показуємо як «×2» замість дублювання
  const items: { section: Section; repeat: number | null }[] = []
  for (const id of order) {
    const section = byId.get(id)
    if (!section) continue
    const last = items[items.length - 1]
    if (last && last.section.id === id) {
      last.repeat = (last.repeat ?? 1) + 1
      continue
    }
    items.push({ section, repeat: null })
  }

  return (
    <div style={{ fontSize }} className="pb-40">
      {items.map(({ section, repeat }, i) => (
        <section key={`${section.id}_${i}`}>
          <SectionHeading section={section} repeat={repeat} />
          <ChordedSection
            body={section.body}
            transpose={transpose}
            targetKey={targetKey}
            showChords={view !== 'text'}
            chordsOnly={view === 'grid'}
            sectionId={section.id}
            editing={editing}
            onPickChord={onPickChord}
          />
        </section>
      ))}
    </div>
  )
}
