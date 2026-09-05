import { useMemo } from 'react'
import type { Section, ViewMode } from '../types'
import { SECTION_KINDS } from '../types'
import { parseBody, lineHasChords } from '../chordpro/parse'
import { transposeChord } from '../chordpro/transpose'

interface Props {
  sections: Section[]
  /** Порядок секцій; елементи можуть повторюватись */
  arrangement: string[]
  view: ViewMode
  transpose: number
  targetKey: string
  fontSize: number
}

function SectionHeading({ section, repeat }: { section: Section; repeat: number | null }) {
  const meta = SECTION_KINDS[section.kind]
  return (
    <div className="flex items-center gap-2 mt-6 mb-2 first:mt-0">
      <span className={`text-[11px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${meta.color} bg-white/[0.03]`}>
        {section.label || meta.label}
      </span>
      {repeat !== null && (
        <span className="text-[11px] text-slate-500">×{repeat}</span>
      )}
      <span className="flex-1 h-px bg-white/5" />
    </div>
  )
}

/** Текст + акорди над словами; `chordsOnly` ховає текст, лишаючи акорди на місцях */
function ChordedSection({ body, transpose, targetKey, showChords, chordsOnly }: {
  body: string; transpose: number; targetKey: string; showChords: boolean; chordsOnly?: boolean
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
          return (
            <div key={i} className="flex flex-wrap gap-x-4 gap-y-1 py-1 font-mono font-bold text-amber-400 text-[0.9em]">
              {line.map((t, j) => t.chord && (
                <span key={j}>{transposeChord(t.chord, transpose, targetKey)}</span>
              ))}
            </div>
          )
        }
        return (
          <div key={i} className="whitespace-pre-wrap">
            {line.map((t, j) => (
              <span key={j} className="chord-slot">
                {showChords && t.chord && (
                  <span className="chord">{transposeChord(t.chord, transpose, targetKey)}</span>
                )}
                {t.text}
              </span>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export default function SongBody({ sections, arrangement, view, transpose, targetKey, fontSize }: Props) {
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
          />
        </section>
      ))}
    </div>
  )
}
