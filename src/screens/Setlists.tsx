import { useMemo, useState } from 'react'
import type { Setlist, SetlistItem, Song } from '../types'
import { useStore } from '../store'
import { newId } from '../chordpro/parse'
import { transposeKey, semitonesBetween, keyOptions, isMinorKey } from '../chordpro/transpose'
import { SortableList, SortableRow, DragHandle } from '../components/Sortable'
import { TopBar, BackButton, Button, Empty, Field, Avatar, inputClass } from '../components/ui'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function nextSunday(): string {
  const d = new Date()
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7))
  return d.toISOString().slice(0, 10)
}

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })
}

/* ── Список сет-листів ─────────────────────────────────────── */

export function SetlistList({ onOpen }: { onOpen(sl: Setlist): void }) {
  const { data, upsertSetlist } = useStore()

  const sorted = useMemo(
    () => [...data.setlists].sort((a, b) => b.date.localeCompare(a.date)),
    [data.setlists],
  )

  const create = () => {
    const sl: Setlist = {
      id: newId('sl'), title: 'Недільне служіння', date: nextSunday(),
      items: [], updatedAt: Date.now(),
    }
    upsertSetlist(sl)
    onOpen(sl)
  }

  return (
    <div className="min-h-full flex flex-col">
      <TopBar title="Сет-листи" subtitle="порядок пісень на служіння"
        right={<Button variant="primary" onClick={create} className="!px-3 !py-2">+ Сет</Button>} />

      {sorted.length === 0 ? (
        <Empty icon="📋" title="Ще немає жодного сету"
          hint="Створи сет на неділю: додай пісні, вкажи тональність і хто веде — усі відкриють і побачать те саме."
          action={<Button variant="primary" onClick={create}>Створити сет</Button>} />
      ) : (
        <div className="flex-1 px-3 py-3 space-y-1.5">
          {sorted.map((sl) => {
            const past = sl.date < todayISO()
            return (
              <button key={sl.id} onClick={() => onOpen(sl)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition
                  active:scale-[0.99] ${past
                    ? 'bg-white/[0.02] border-white/5 opacity-60 hover:opacity-100'
                    : 'bg-white/[0.05] border-amber-500/25 hover:bg-white/[0.09]'}`}>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{sl.title}</div>
                  <div className="text-xs text-slate-500 capitalize">
                    {formatDate(sl.date)} · {sl.items.length} {sl.items.length === 1 ? 'пісня' : 'пісень'}
                  </div>
                </div>
                {!past && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/15 px-2 py-1 rounded">попереду</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Один сет-лист ─────────────────────────────────────────── */

export function SetlistView({ setlist, onBack, onOpenSong }: {
  setlist: Setlist
  onBack(): void
  onOpenSong(song: Song, transpose: number): void
}) {
  const { data, upsertSetlist, deleteSetlist } = useStore()
  const [picking, setPicking] = useState(false)
  const [q, setQ] = useState('')

  // Беремо свіжу версію зі стора — вона оновлюється при редагуванні
  const sl = data.setlists.find((s) => s.id === setlist.id) ?? setlist
  const songById = useMemo(() => new Map(data.songs.map((s) => [s.id, s])), [data.songs])

  const patch = (p: Partial<Setlist>) => upsertSetlist({ ...sl, ...p })
  const patchItem = (id: string, p: Partial<SetlistItem>) =>
    patch({ items: sl.items.map((it) => (it.id === id ? { ...it, ...p } : it)) })

  const addSong = (song: Song) => {
    patch({
      items: [...sl.items, {
        id: newId('sli'), songId: song.id, transpose: 0,
        arrangement: [], leadMemberId: null, note: '',
      }],
    })
    setPicking(false)
    setQ('')
  }

  const rows = sl.items
    .map((it) => ({ key: it.id, item: it, song: songById.get(it.songId) }))
    .filter((r) => r.song)

  const available = data.songs
    .filter((s) => s.title.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.title.localeCompare(b.title, 'uk'))

  if (picking) {
    return (
      <div className="min-h-full flex flex-col">
        <TopBar left={<BackButton onClick={() => setPicking(false)} />} title="Додати пісню в сет" />
        <div className="px-3 pt-3">
          <input className={inputClass} placeholder="Пошук…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        <div className="flex-1 px-3 py-3 space-y-1.5">
          {available.map((s) => (
            <button key={s.id} onClick={() => addSong(s)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.09] text-left">
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{s.title}</div>
                <div className="text-xs text-slate-500 truncate">{s.author || '—'}</div>
              </div>
              <span className="font-mono font-bold text-amber-400 text-sm">{s.originalKey}</span>
            </button>
          ))}
          {available.length === 0 && <div className="text-center text-slate-500 py-10 text-sm">Нічого не знайшлось</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full flex flex-col">
      <TopBar left={<BackButton onClick={onBack} />} title={sl.title} subtitle={formatDate(sl.date)}
        right={<Button variant="primary" onClick={() => setPicking(true)} className="!px-3 !py-2">+ Пісня</Button>} />

      <div className="px-4 pt-4 grid grid-cols-2 gap-3">
        <Field label="Назва">
          <input className={inputClass} value={sl.title} onChange={(e) => patch({ title: e.target.value })} />
        </Field>
        <Field label="Дата">
          <input className={inputClass} type="date" value={sl.date} onChange={(e) => patch({ date: e.target.value })} />
        </Field>
      </div>

      <div className="flex-1 px-3 py-4 pb-24">
        {rows.length === 0 ? (
          <Empty icon="🎵" title="Сет порожній" hint="Додай пісні й розстав їх у потрібному порядку."
            action={<Button variant="primary" onClick={() => setPicking(true)}>Додати пісню</Button>} />
        ) : (
          <SortableList items={rows} onReorder={(next) => patch({ items: next.map((r) => r.item) })}>
            <div className="space-y-2">
              {rows.map(({ key, item, song }, i) => {
                const key0 = song!.originalKey
                const cur = transposeKey(key0, item.transpose)
                const lead = data.members.find((m) => m.id === item.leadMemberId) ?? null
                return (
                  <SortableRow key={key} id={key}>
                    {(handle) => (
                      <div className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
                        <div className="flex items-center gap-1 pl-1 pr-2">
                          <DragHandle {...handle} />
                          <span className="text-xs text-slate-600 font-mono w-4">{i + 1}</span>
                          <button onClick={() => onOpenSong(song!, item.transpose)}
                            className="flex-1 min-w-0 text-left py-3 px-1">
                            <div className="font-semibold truncate">{song!.title}</div>
                            <div className="text-xs text-slate-500 truncate">
                              {lead ? `веде ${lead.name}` : song!.author || '—'}
                              {song!.tempo ? ` · ${song!.tempo} BPM` : ''}
                            </div>
                          </button>
                          <select
                            className="shrink-0 bg-amber-400/10 text-amber-400 font-mono font-bold text-sm rounded-lg px-2 py-1.5 outline-none cursor-pointer"
                            value={cur}
                            onChange={(e) => patchItem(item.id, { transpose: semitonesBetween(key0, e.target.value) })}
                            title="Тональність для всієї групи"
                          >
                            {keyOptions(isMinorKey(key0)).map((k) => (
                              <option key={k} value={k} className="bg-[#171a21] text-slate-100">{k}</option>
                            ))}
                          </select>
                          <button onClick={() => patch({ items: sl.items.filter((x) => x.id !== item.id) })}
                            aria-label="Прибрати з сету"
                            className="shrink-0 w-8 h-8 grid place-items-center rounded-lg text-slate-600 hover:text-rose-400">✕</button>
                        </div>
                        <div className="flex items-center gap-2 px-3 pb-2.5">
                          <select
                            className="text-xs bg-white/[0.05] border border-white/10 rounded-lg px-2 py-1.5 outline-none text-slate-300"
                            value={item.leadMemberId ?? ''}
                            onChange={(e) => patchItem(item.id, { leadMemberId: e.target.value || null })}
                          >
                            <option value="" className="bg-[#171a21]">хто веде…</option>
                            {data.members.map((m) => (
                              <option key={m.id} value={m.id} className="bg-[#171a21]">{m.name}</option>
                            ))}
                          </select>
                          <input
                            className="flex-1 min-w-0 text-xs bg-white/[0.05] border border-white/10 rounded-lg px-2 py-1.5 outline-none placeholder:text-slate-600"
                            placeholder="нотатка до пісні в цьому сеті"
                            value={item.note}
                            onChange={(e) => patchItem(item.id, { note: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                  </SortableRow>
                )
              })}
            </div>
          </SortableList>
        )}

        {rows.length > 0 && (
          <div className="mt-6 flex items-center gap-2">
            <div className="flex -space-x-2">
              {data.members.slice(0, 6).map((m) => <Avatar key={m.id} member={m} size={26} />)}
            </div>
            <span className="text-xs text-slate-500">усі бачать цей порядок і ці тональності</span>
          </div>
        )}

        <Button variant="danger" className="w-full mt-6"
          onClick={() => { if (confirm(`Видалити сет «${sl.title}»?`)) { deleteSetlist(sl.id); onBack() } }}>
          Видалити сет
        </Button>
      </div>
    </div>
  )
}
