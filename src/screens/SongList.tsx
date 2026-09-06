import { useMemo, useState } from 'react'
import type { Song } from '../types'
import { useStore } from '../store'
import { stripChords } from '../chordpro/parse'
import { TopBar, Button, Empty, inputClass } from '../components/ui'
import { useLongPress } from '../components/LongPress'
import ActionSheet from '../components/ActionSheet'

interface Props {
  onOpen(song: Song): void
  onNew(): void
  onEdit(song: Song): void
}

export default function SongList({ onOpen, onNew, onEdit }: Props) {
  const { data, personalFor, deleteSong, t } = useStore()
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  // Пісня, на якій затримали палець — для неї показуємо меню дій
  const [menuFor, setMenuFor] = useState<Song | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Song | null>(null)

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
        title={t('songs.title')}
        subtitle={`${data.songs.length} ${t('songs.count')}`}
        right={<Button variant="primary" onClick={onNew} className="!px-3 !py-2">{t('songs.add')}</Button>}
      />

      <div className="px-3 pt-3 space-y-2">
        <input className={inputClass} placeholder={t('songs.searchPlaceholder')}
          value={q} onChange={(e) => setQ(e.target.value)} />
        {allTags.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <Button variant="chip" active={tag === null} onClick={() => setTag(null)}>{t('common.all')}</Button>
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
          title={q ? t('songs.notFound') : t('songs.emptyTitle')}
          hint={q ? 'Спробуй інше слово — пошук іде і по тексту пісень.'
                  : 'Додай першу пісню — можна просто вставити текст із Telegram, застосунок сам поріже його на куплети.'}
          action={!q && <Button variant="primary" onClick={onNew}>Додати пісню</Button>}
        />
      ) : (
        <div className="flex-1 px-3 py-2 space-y-1.5">
          {filtered.map((s) => (
            <SongRow
              key={s.id}
              song={s}
              hasNote={personalFor(s.id).note.trim().length > 0}
              noteLabel={t('songs.hasNote')}
              onOpen={() => onOpen(s)}
              onHold={() => setMenuFor(s)}
            />
          ))}
          <p className="text-center text-[11px] text-[var(--text-faint)] pt-3 pb-1">
            {t('songs.holdHint')}
          </p>
        </div>
      )}

      {menuFor && (
        <ActionSheet
          title={menuFor.title}
          subtitle={menuFor.author || undefined}
          onClose={() => setMenuFor(null)}
          actions={[
            { label: t('common.open'), icon: '🎵', onClick: () => onOpen(menuFor) },
            { label: t('common.edit'), icon: '✏️', onClick: () => onEdit(menuFor) },
            { label: t('common.delete'), icon: '🗑', danger: true, onClick: () => setConfirmDelete(menuFor) },
          ]}
        />
      )}

      {confirmDelete && (
        <ActionSheet
          title={`Видалити «${confirmDelete.title}»?`}
          subtitle="Пісня зникне в усіх сет-листах. Скасувати не вийде."
          onClose={() => setConfirmDelete(null)}
          actions={[
            {
              label: 'Так, видалити',
              icon: '🗑',
              danger: true,
              onClick: () => { deleteSong(confirmDelete.id); setMenuFor(null) },
            },
          ]}
        />
      )}
    </div>
  )
}

/** Рядок списку: тап відкриває, довге натискання — меню дій */
function SongRow({ song, hasNote, noteLabel, onOpen, onHold }: {
  song: Song; hasNote: boolean; noteLabel: string; onOpen(): void; onHold(): void
}) {
  const { handlers, consumedClick } = useLongPress(onHold)
  return (
    <button
      onClick={() => { if (!consumedClick()) onOpen() }}
      {...handlers}
      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--line)]
                 hover:bg-[var(--surface-hover)] active:scale-[0.99] transition text-left select-none touch-manipulation"
    >
      <div className="min-w-0 flex-1">
        <div className="font-semibold truncate">{song.title}</div>
        <div className="text-xs text-[var(--text-faint)] truncate">
          {song.author || '—'}
          {song.tempo ? ` · ${song.tempo} BPM` : ''}
          {hasNote ? ` · 📝 ${noteLabel}` : ''}
        </div>
      </div>
      <span className="shrink-0 font-mono font-bold text-[var(--accent)] text-sm bg-amber-400/10 px-2 py-1 rounded-lg">
        {song.originalKey}
      </span>
    </button>
  )
}
