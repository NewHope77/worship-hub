import { useMemo, useState } from 'react'
import type { Song } from '../types'
import { useStore } from '../store'
import { stripChords } from '../chordpro/parse'
import { TopBar, Button, Empty, inputClass } from '../components/ui'

interface Props {
  onOpen(song: Song): void
  onNew(): void
}

export default function SongList({ onOpen, onNew }: Props) {
  const { data, personalFor } = useStore()
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)

  const allTags = useMemo(() => {
    const set = new Set<string>()
    data.songs.forEach((s) => s.tags.forEach((t) => set.add(t)))
    return [...set].sort()
  }, [data.songs])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return data.songs
      .filter((s) => !tag || s.tags.includes(tag))
      .filter((s) => {
        if (!needle) return true
        if (s.title.toLowerCase().includes(needle)) return true
        if (s.author.toLowerCase().includes(needle)) return true
        // Пошук по тексту без акордів
        return s.sections.some((sec) => stripChords(sec.body).toLowerCase().includes(needle))
      })
      .sort((a, b) => a.title.localeCompare(b.title, 'uk'))
  }, [data.songs, q, tag])

  return (
    <div className="min-h-full flex flex-col">
      <TopBar
        title="Пісні"
        subtitle={`${data.songs.length} у базі`}
        right={<Button variant="primary" onClick={onNew} className="!px-3 !py-2">+ Пісня</Button>}
      />

      <div className="px-3 pt-3 space-y-2">
        <input className={inputClass} placeholder="Пошук за назвою або рядком тексту…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        {allTags.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <Button variant="chip" active={tag === null} onClick={() => setTag(null)}>усі</Button>
            {allTags.map((t) => (
              <Button key={t} variant="chip" active={tag === t}
                onClick={() => setTag(tag === t ? null : t)} className="whitespace-nowrap">{t}</Button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <Empty
          icon={q ? '🔍' : '🎼'}
          title={q ? 'Нічого не знайшлось' : 'База порожня'}
          hint={q ? 'Спробуй інше слово — пошук іде і по тексту пісень.'
                  : 'Додай першу пісню — можна просто вставити текст із Telegram, застосунок сам поріже його на куплети.'}
          action={!q && <Button variant="primary" onClick={onNew}>Додати пісню</Button>}
        />
      ) : (
        <div className="flex-1 px-3 py-2 space-y-1.5">
          {filtered.map((s) => {
            const p = personalFor(s.id)
            return (
              <button key={s.id} onClick={() => onOpen(s)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10
                           hover:bg-white/[0.09] active:scale-[0.99] transition text-left">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{s.title}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {s.author || '—'}
                    {s.tempo ? ` · ${s.tempo} BPM` : ''}
                    {p.note.trim() ? ' · 📝 є нотатка' : ''}
                  </div>
                </div>
                <span className="shrink-0 font-mono font-bold text-amber-400 text-sm bg-amber-400/10 px-2 py-1 rounded-lg">
                  {s.originalKey}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
