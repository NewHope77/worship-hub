import { useMemo, useState } from 'react'
import type { Setlist, SetlistBlock, SetlistItem, Song } from '../types'
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

function countSongs(sl: Setlist): number {
  return (sl.blocks ?? []).reduce((n, b) => n + b.items.length, 0)
}

/* ── Список сетів ──────────────────────────────────────────── */

export function SetlistList({ onOpen }: { onOpen(sl: Setlist): void }) {
  const { data, upsertSetlist, t } = useStore()

  const sorted = useMemo(
    () => [...data.setlists].sort((a, b) => b.date.localeCompare(a.date)),
    [data.setlists],
  )

  const create = () => {
    const sl: Setlist = {
      id: newId('sl'), title: 'Недільне служіння', date: nextSunday(),
      blocks: [{ id: newId('blk'), title: '', items: [] }],
      updatedAt: Date.now(),
    }
    upsertSetlist(sl)
    onOpen(sl)
  }

  return (
    <div className="min-h-full flex flex-col">
      <TopBar title={t('setlists.title')} subtitle={t('setlists.subtitle')}
        right={<Button variant="primary" onClick={create} className="!px-3 !py-2">{t('setlists.add')}</Button>} />

      {sorted.length === 0 ? (
        <Empty icon="📋" title={t('setlists.emptyTitle')}
          hint="Створи сет: додай блоки й пісні — усі побачать той самий порядок."
          action={<Button variant="primary" onClick={create}>{t('setlists.add')}</Button>} />
      ) : (
        <div className="flex-1 px-3 py-3 space-y-1.5">
          {sorted.map((sl) => {
            const past = sl.date < todayISO()
            const blocks = (sl.blocks ?? []).length
            return (
              <button key={sl.id} onClick={() => onOpen(sl)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition
                  active:scale-[0.99] ${past
                    ? 'bg-[var(--surface-1)] border-[var(--line-soft)] opacity-60 hover:opacity-100'
                    : 'bg-[var(--surface-2)] border-amber-500/25 hover:bg-[var(--surface-hover)]'}`}>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{sl.title}</div>
                  <div className="text-xs text-[var(--text-faint)] capitalize">
                    {formatDate(sl.date)} · {countSongs(sl)} пісень
                    {blocks > 1 ? ` · ${blocks} блоки` : ''}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Один сет ──────────────────────────────────────────────── */

export function SetlistView({ setlist, onBack, onOpenSong }: {
  setlist: Setlist
  onBack(): void
  onOpenSong(song: Song, transpose: number): void
}) {
  const { data, upsertSetlist, deleteSetlist, t } = useStore()
  /** Блок, у який зараз обираємо пісню */
  const [pickingInto, setPickingInto] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const sl = data.setlists.find((s) => s.id === setlist.id) ?? setlist
  const blocks = sl.blocks ?? []
  const songById = useMemo(() => new Map(data.songs.map((s) => [s.id, s])), [data.songs])

  const patch = (p: Partial<Setlist>) => upsertSetlist({ ...sl, ...p })

  const patchBlock = (blockId: string, p: Partial<SetlistBlock>) =>
    patch({ blocks: blocks.map((b) => (b.id === blockId ? { ...b, ...p } : b)) })

  const patchItem = (blockId: string, itemId: string, p: Partial<SetlistItem>) =>
    patchBlock(blockId, {
      items: blocks.find((b) => b.id === blockId)!.items.map((it) =>
        it.id === itemId ? { ...it, ...p } : it),
    })

  const addBlock = () =>
    patch({ blocks: [...blocks, { id: newId('blk'), title: `Блок ${blocks.length + 1}`, items: [] }] })

  const addSong = (song: Song) => {
    if (!pickingInto) return
    const block = blocks.find((b) => b.id === pickingInto)
    if (!block) return
    patchBlock(pickingInto, {
      items: [...block.items, {
        id: newId('sli'), songId: song.id, transpose: 0,
        arrangement: [], leadMemberId: null, note: '',
      }],
    })
    setPickingInto(null)
    setQ('')
  }

  /** Перенести пісню в сусідній блок — коли її поставили не туди */
  const moveToBlock = (fromId: string, item: SetlistItem, toId: string) => {
    patch({
      blocks: blocks.map((b) => {
        if (b.id === fromId) return { ...b, items: b.items.filter((i) => i.id !== item.id) }
        if (b.id === toId) return { ...b, items: [...b.items, item] }
        return b
      }),
    })
  }

  if (pickingInto) {
    const available = data.songs
      .filter((s) => s.title.toLowerCase().includes(q.trim().toLowerCase()))
      .sort((a, b) => a.title.localeCompare(b.title, 'uk'))
    return (
      <div className="min-h-full flex flex-col">
        <TopBar left={<BackButton onClick={() => setPickingInto(null)} />} title={t('setlists.addSong')} />
        <div className="px-3 pt-3">
          <input className={inputClass} placeholder={t('common.search')}
            value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        <div className="flex-1 px-3 py-3 space-y-1.5">
          {available.map((s) => (
            <button key={s.id} onClick={() => addSong(s)}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] hover:bg-[var(--surface-hover)] text-left">
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{s.title}</div>
                <div className="text-xs text-[var(--text-faint)] truncate">{s.author || '—'}</div>
              </div>
              <span className="font-mono font-bold text-[var(--accent)] text-sm">{s.originalKey}</span>
            </button>
          ))}
          {available.length === 0 && (
            <div className="text-center text-[var(--text-faint)] py-10 text-sm">{t('songs.notFound')}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full flex flex-col">
      <TopBar left={<BackButton onClick={onBack} />} title={sl.title} subtitle={formatDate(sl.date)} />

      <div className="px-4 pt-4 grid grid-cols-2 gap-3">
        <Field label="Назва">
          <input className={inputClass} value={sl.title} onChange={(e) => patch({ title: e.target.value })} />
        </Field>
        <Field label="Дата">
          <input className={inputClass} type="date" value={sl.date} onChange={(e) => patch({ date: e.target.value })} />
        </Field>
      </div>

      <div className="flex-1 px-3 py-4 pb-24 space-y-3">
        {/* Блоки можна тягати цілком — разом з піснями всередині */}
        <SortableList
          items={blocks.map((b) => ({ key: b.id }))}
          holdDelay={200}
          onReorder={(next) => patch({
            blocks: next.map((r) => blocks.find((b) => b.id === r.key)!).filter(Boolean),
          })}
        >
          <div className="space-y-3">
            {blocks.map((block, blockIndex) => (
              <SortableRow key={block.id} id={block.id}>
                {(handle) => (
                  <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-1)] overflow-hidden">
                    <header className="flex items-center gap-1 pl-1 pr-2 py-1.5 bg-[var(--surface-2)]">
                      <DragHandle {...handle} />
                      <input
                        className="flex-1 min-w-0 bg-transparent outline-none font-semibold text-sm py-1.5 px-1 rounded focus:bg-[var(--surface-hover)]"
                        value={block.title}
                        placeholder={`Блок ${blockIndex + 1}`}
                        onChange={(e) => patchBlock(block.id, { title: e.target.value })}
                      />
                      <span className="text-[11px] text-[var(--text-faint)] px-1">
                        {block.items.length}
                      </span>
                      <button
                        onClick={() => {
                          if (block.items.length && !confirm(`Видалити блок разом з піснями (${block.items.length})?`)) return
                          patch({ blocks: blocks.filter((b) => b.id !== block.id) })
                        }}
                        aria-label="Видалити блок"
                        className="w-8 h-8 grid place-items-center rounded-lg text-[var(--text-faint)] hover:text-rose-400"
                      >✕</button>
                    </header>

                    <div className="p-2 space-y-2">
                      {block.items.length === 0 ? (
                        <div className="text-xs text-[var(--text-faint)] text-center py-3">
                          Порожній блок
                        </div>
                      ) : (
                        <SortableList
                          items={block.items.map((it) => ({ key: it.id }))}
                          holdDelay={200}
                          onReorder={(next) => patchBlock(block.id, {
                            items: next.map((r) => block.items.find((i) => i.id === r.key)!).filter(Boolean),
                          })}
                        >
                          <div className="space-y-1.5">
                            {block.items.map((item, i) => {
                              const song = songById.get(item.songId)
                              if (!song) return null
                              const key0 = song.originalKey
                              const cur = transposeKey(key0, item.transpose)
                              const lead = data.members.find((m) => m.id === item.leadMemberId) ?? null
                              return (
                                <SortableRow key={item.id} id={item.id}>
                                  {(itemHandle) => (
                                    <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--line)] overflow-hidden">
                                      <div className="flex items-center gap-1 pl-1 pr-2">
                                        <DragHandle {...itemHandle} />
                                        <span className="text-xs text-[var(--text-faint)] font-mono w-4">{i + 1}</span>
                                        <button onClick={() => onOpenSong(song, item.transpose)}
                                          className="flex-1 min-w-0 text-left py-2.5 px-1">
                                          <div className="font-semibold truncate text-sm">{song.title}</div>
                                          <div className="text-[11px] text-[var(--text-faint)] truncate">
                                            {lead ? `веде ${lead.name}` : song.author || '—'}
                                          </div>
                                        </button>
                                        <select
                                          className="shrink-0 bg-amber-400/10 text-[var(--accent)] font-mono font-bold text-xs rounded-lg px-1.5 py-1 outline-none cursor-pointer"
                                          value={cur}
                                          onChange={(e) => patchItem(block.id, item.id, {
                                            transpose: semitonesBetween(key0, e.target.value),
                                          })}
                                        >
                                          {keyOptions(isMinorKey(key0)).map((k) => (
                                            <option key={k} value={k} className="bg-[var(--panel)] text-[var(--text)]">{k}</option>
                                          ))}
                                        </select>
                                        <button
                                          onClick={() => patchBlock(block.id, {
                                            items: block.items.filter((x) => x.id !== item.id),
                                          })}
                                          aria-label="Прибрати з сету"
                                          className="shrink-0 w-7 h-7 grid place-items-center rounded-lg text-[var(--text-faint)] hover:text-rose-400"
                                        >✕</button>
                                      </div>
                                      <div className="flex items-center gap-2 px-2 pb-2">
                                        <select
                                          className="text-[11px] bg-[var(--surface-2)] border border-[var(--line)] rounded-lg px-1.5 py-1 outline-none text-[var(--text-muted)]"
                                          value={item.leadMemberId ?? ''}
                                          onChange={(e) => patchItem(block.id, item.id, {
                                            leadMemberId: e.target.value || null,
                                          })}
                                        >
                                          <option value="" className="bg-[var(--panel)]">{t('setlists.who')}</option>
                                          {data.members.map((m) => (
                                            <option key={m.id} value={m.id} className="bg-[var(--panel)]">{m.name}</option>
                                          ))}
                                        </select>
                                        {blocks.length > 1 && (
                                          <select
                                            className="text-[11px] bg-[var(--surface-2)] border border-[var(--line)] rounded-lg px-1.5 py-1 outline-none text-[var(--text-muted)]"
                                            value=""
                                            onChange={(e) => e.target.value && moveToBlock(block.id, item, e.target.value)}
                                          >
                                            <option value="" className="bg-[var(--panel)]">перенести в…</option>
                                            {blocks.filter((b) => b.id !== block.id).map((b, bi) => (
                                              <option key={b.id} value={b.id} className="bg-[var(--panel)]">
                                                {b.title || `Блок ${bi + 1}`}
                                              </option>
                                            ))}
                                          </select>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </SortableRow>
                              )
                            })}
                          </div>
                        </SortableList>
                      )}

                      <Button className="w-full !py-2 text-sm"
                        onClick={() => setPickingInto(block.id)}>
                        {t('setlists.addSong')}
                      </Button>
                    </div>
                  </section>
                )}
              </SortableRow>
            ))}
          </div>
        </SortableList>

        <Button className="w-full" onClick={addBlock}>+ Блок</Button>

        {countSongs(sl) > 0 && (
          <div className="flex items-center gap-2 pt-2">
            <div className="flex -space-x-2">
              {data.members.slice(0, 6).map((m) => <Avatar key={m.id} member={m} size={26} />)}
            </div>
            <span className="text-xs text-[var(--text-faint)]">усі бачать цей порядок і ці тональності</span>
          </div>
        )}

        <Button variant="danger" className="w-full mt-4"
          onClick={() => { if (confirm(`Видалити сет «${sl.title}»?`)) { deleteSetlist(sl.id); onBack() } }}>
          Видалити сет
        </Button>
      </div>
    </div>
  )
}
