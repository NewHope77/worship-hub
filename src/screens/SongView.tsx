import { useEffect, useMemo, useRef, useState } from 'react'
import type { Song, ViewMode } from '../types'
import { useStore, effectiveView } from '../store'
import { transposeKey, semitonesBetween, transposeChord } from '../chordpro/transpose'
import SongBody from '../components/SongBody'
import type { ChordSpot } from '../components/SongBody'
import ChordPicker from '../components/ChordPicker'
import ActionSheet from '../components/ActionSheet'
import { moveChord, replaceChord, removeChord, insertChord } from '../chordpro/editChords'
import RawSong from '../components/RawSong'
import { transposeRaw, sectionsToRaw } from '../chordpro/rawText'
import { TopBar, BackButton, Button, inputClass } from '../components/ui'

const VIEW_HINT: Record<ViewMode, string> = {
  chords: 'Акорди над словами',
  text:   'Тільки слова, без акордів',
  grid:   'Тільки акорди — стоять там само, де були над складами',
}

/** Два тумблери «текст» і «акорди» вкладаються у три можливі режими */
function toView(showText: boolean, showChords: boolean): ViewMode {
  if (showText && showChords) return 'chords'
  return showText ? 'text' : 'grid'
}

interface Props {
  song: Song
  /** Транспонування, задане сет-листом (перекриває особисте) */
  setlistTranspose?: number | null
  onBack(): void
  onEdit(): void
}

export default function SongView({ song, setlistTranspose = null, onBack, onEdit }: Props) {
  const { prefs, setPrefs, personalFor, setPersonal, me, upsertSong } = useStore()
  const personal = personalFor(song.id)
  const [panel, setPanel] = useState<'none' | 'settings' | 'note'>('none')
  const [editing, setEditing] = useState(false)
  const [spot, setSpot] = useState<ChordSpot | null>(null)
  const [picking, setPicking] = useState<ChordSpot | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const usingSetlistKey = setlistTranspose !== null
  const transpose = usingSetlistKey ? setlistTranspose : personal.transpose
  const view = effectiveView(personal, prefs)
  const currentKey = transposeKey(song.originalKey, transpose)
  // Каподастр не змінює звучання — тільки аплікатуру: показуємо форму акорду
  const shapeKey = transposeKey(currentKey, -personal.capo)

  // Не даємо екрану згаснути під час гри
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<WakeLockSentinel> } }
    nav.wakeLock?.request('screen').then((l) => { lock = l }).catch(() => { /* не критично */ })
    return () => { void lock?.release().catch(() => {}) }
  }, [])

  const layout = prefs.layout
  const showOriginal = layout === 'original'

  // Текст «як у файлі». Для пісень, доданих раніше, збираємо його з секцій.
  const rawSource = useMemo(
    () => (song.raw?.trim() ? song.raw : sectionsToRaw(song.sections)),
    [song.raw, song.sections],
  )

  const rawShown = useMemo(
    () => transposeRaw(rawSource, transpose - personal.capo,
      personal.capo ? shapeKey : currentKey),
    [rawSource, transpose, personal.capo, shapeKey, currentKey],
  )

  // Розмір тексту залежить від показу: у кожного свій діапазон
  const zoomMin = showOriginal ? 7 : 13
  const zoomMax = showOriginal ? 26 : 30
  const fontSize = showOriginal ? prefs.rawFontSize : prefs.fontSize
  const zoom = (step: number) => {
    const next = Math.max(zoomMin, Math.min(zoomMax, fontSize + step))
    setPrefs(showOriginal ? { rawFontSize: next } : { fontSize: next })
  }

  const capoHint = useMemo(() => {
    if (!prefs.showCapo || personal.capo === 0) return null
    return `каподастр ${personal.capo} → форми в ${shapeKey}`
  }, [prefs.showCapo, personal.capo, shapeKey])

  /** Міняє тіло однієї секції — саме там акорди прив'язані до складів */
  const editSection = (sectionId: string, fn: (body: string) => string) => {
    upsertSong({
      ...song,
      sections: song.sections.map((sec) =>
        sec.id === sectionId ? { ...sec, body: fn(sec.body) } : sec,
      ),
    })
  }

  /**
   * На екрані акорди показані в поточній тональності, а зберігаються в
   * оригінальній — тому введене повертаємо назад перед записом.
   */
  const toStored = (shown: string) =>
    transpose === 0 ? shown : transposeChord(shown, -transpose, song.originalKey)

  const shift = (d: number) => {
    if (usingSetlistKey) return
    // Рахуємо від актуального значення, щоб швидкі натискання не губились
    setPersonal(song.id, (cur) => ({
      transpose: Math.max(-11, Math.min(11, cur.transpose + d)),
    }))
  }

  return (
    <div className="min-h-full flex flex-col">
      <TopBar
        left={<BackButton onClick={onBack} />}
        title={song.title}
        subtitle={
          <span className="flex items-center gap-1.5">
            <span className="text-[var(--accent)] font-semibold">{currentKey}</span>
            {transpose !== 0 && <span>({transpose > 0 ? '+' : ''}{transpose})</span>}
            {usingSetlistKey && <span className="text-sky-400">· тональність сету</span>}
            {song.tempo && <span>· {song.tempo} BPM</span>}
            {capoHint && <span>· {capoHint}</span>}
          </span>
        }
        right={
          <div className="flex items-center gap-1">
            <button onClick={() => setPanel(panel === 'note' ? 'none' : 'note')}
              aria-label="Нотатки"
              className={`w-9 h-9 grid place-items-center rounded-full transition ${
                panel === 'note' ? 'bg-amber-500 text-slate-950' : 'hover:bg-[var(--surface-hover)] text-[var(--text)]'}`}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 5h16M4 10h16M4 15h10" />
              </svg>
              {personal.note.trim() && panel !== 'note' && (
                <span className="absolute translate-x-3 -translate-y-3 w-2 h-2 rounded-full bg-amber-400" />
              )}
            </button>
            <button onClick={() => setPanel(panel === 'settings' ? 'none' : 'settings')}
              aria-label="Налаштування"
              className={`w-9 h-9 grid place-items-center rounded-full transition ${
                panel === 'settings' ? 'bg-amber-500 text-slate-950' : 'hover:bg-[var(--surface-hover)] text-[var(--text)]'}`}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 110-4h.09A1.65 1.65 0 004.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 3.6 1.65 1.65 0 0010 2.09V2a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 8v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>
          </div>
        }
      />

      {panel === 'settings' && (
        <div className="no-print border-b border-[var(--line)] bg-[var(--panel)] px-4 py-4 space-y-4">
          <div>
            <div className="text-xs font-medium text-[var(--text-muted)] mb-2">Що показувати</div>
            <div className="flex gap-2">
              <Toggle
                label="Текст"
                on={view !== 'grid'}
                // Вимкнути можна лише щось одне — інакше сторінка буде порожня
                disabled={view === 'text'}
                onClick={() => setPersonal(song.id, { viewMode: toView(view === 'grid', true) })}
              />
              <Toggle
                label="Акорди"
                on={view !== 'text'}
                disabled={view === 'grid'}
                onClick={() => setPersonal(song.id, { viewMode: toView(true, view === 'text') })}
              />
              <Button variant="chip" className="ml-auto" onClick={() => setPrefs({ viewMode: view })}
                title="Зробити це типовим для всіх пісень">
                за умовчанням
              </Button>
            </div>
            <div className="text-[11px] text-[var(--text-faint)] mt-1.5">{VIEW_HINT[view]}</div>
          </div>

          <div>
            <div className="text-xs font-medium text-[var(--text-muted)] mb-2">Як показувати</div>
            <div className="flex gap-2">
              <Button variant="chip" active={!showOriginal} className="flex-1"
                onClick={() => setPrefs({ layout: 'parsed' })}>
                Розібрано
              </Button>
              <Button variant="chip" active={showOriginal} className="flex-1"
                onClick={() => setPrefs({ layout: 'original' })}>
                Точно як в оригіналі
              </Button>
            </div>
            <div className="text-[11px] text-[var(--text-faint)] mt-1.5">
              {showOriginal
                ? 'Вигляд, відступи й переноси — як у джерелі, символ у символ'
                : 'Переноситься під ширину екрана, акорди прив’язані до складів'}
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-[var(--text-muted)] mb-2">Тональність</div>
            <div className="flex items-center gap-2">
              <Button onClick={() => shift(-1)} disabled={usingSetlistKey}
                className="w-12 text-lg font-bold" aria-label="Нижче на півтон">−</Button>
              <div className="flex-1 text-center">
                <div className="text-xl font-bold text-[var(--accent)] leading-none">{currentKey}</div>
                <div className="text-[10px] text-[var(--text-faint)] mt-0.5">
                  {usingSetlistKey ? 'задано сет-листом' : `оригінал ${song.originalKey}`}
                </div>
              </div>
              <Button onClick={() => shift(1)} disabled={usingSetlistKey}
                className="w-12 text-lg font-bold" aria-label="Вище на півтон">+</Button>
            </div>
            {!usingSetlistKey && transpose !== 0 && (
              <button onClick={() => setPersonal(song.id, { transpose: 0 })}
                className="w-full text-center text-[11px] text-[var(--text-faint)] hover:text-[var(--text)] mt-2">
                повернути оригінальну тональність ({song.originalKey})
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-xs font-medium text-[var(--text-muted)] mb-1.5">
                Каподастр: <span className="text-[var(--text)]">{personal.capo || '—'}</span>
              </div>
              <input type="range" min={0} max={7} value={personal.capo} className="w-full accent-amber-500"
                onChange={(e) => setPersonal(song.id, { capo: +e.target.value })} />
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-[var(--text-muted)] mb-2">Екран</div>
            <div className="flex gap-2">
              <Button variant="chip" active={prefs.theme === 'dark'} className="flex-1"
                onClick={() => setPrefs({ theme: 'dark' })}>
                🌙 Темний
              </Button>
              <Button variant="chip" active={prefs.theme === 'light'} className="flex-1"
                onClick={() => setPrefs({ theme: 'light' })}>
                ☀️ Світлий
              </Button>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-[var(--text-muted)] mb-2">Акорди</div>
            <div className="flex gap-2">
              <Button variant="chip" active={editing} className="flex-1"
                disabled={showOriginal}
                onClick={() => { setEditing((e) => !e); setPanel('none') }}
                title={showOriginal ? 'Доступно в показі «Розібрано»' : undefined}>
                {editing ? '✓ Правлю акорди' : '✏️ Правити акорди'}
              </Button>
              <Button variant="chip" active={prefs.chordsAccent} className="flex-1"
                onClick={() => setPrefs({ chordsAccent: !prefs.chordsAccent })}>
                🎵 Акцент на акордах
              </Button>
            </div>
            <div className="text-[11px] text-[var(--text-faint)] mt-1.5">
              {showOriginal
                ? 'Правка акордів працює в показі «Розібрано»'
                : 'Правити може будь-хто з групи, і правку побачать усі. Акцент — окремо: акорди більші, текст тихіший'}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={onEdit} className="flex-1">Редагувати пісню</Button>
            <Button onClick={() => window.print()}>Друк</Button>
          </div>
        </div>
      )}

      {panel === 'note' && (
        <div className="no-print border-b border-[var(--line)] bg-[var(--panel)] px-4 py-4 space-y-3">
          {song.notes.trim() && (
            <div>
              <div className="text-xs font-medium text-[var(--text-muted)] mb-1">Спільна нотатка (бачать усі)</div>
              <div className="text-sm text-[var(--text)] whitespace-pre-wrap rounded-xl bg-[var(--surface-2)] border border-[var(--line)] px-3 py-2">
                {song.notes}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs font-medium text-[var(--text-muted)] mb-1">
              Моя нотатка — бачиш тільки ти{me ? `, ${me.name}` : ''}
            </div>
            <textarea rows={4} className={inputClass + ' resize-none'}
              placeholder="Напр.: вступ 4 такти · тут бек другим голосом · на мості тримати педаль"
              value={personal.note}
              onChange={(e) => setPersonal(song.id, { note: e.target.value })} />
          </div>
        </div>
      )}

      {editing && (
        <div className="no-print flex items-center gap-2 px-4 py-2.5 bg-[var(--accent)]/12 border-b border-[var(--line)]">
          <span className="text-xs text-[var(--text-muted)] flex-1">
            Тисни на акорд, щоб посунути чи змінити; на слово — щоб додати.
            <b className="text-[var(--text)]"> Правку побачать усі учасники.</b>
          </span>
          <Button variant="chip" onClick={() => setEditing(false)}>Готово</Button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {showOriginal ? (
          <div className="px-4 pt-4 pb-40 overflow-x-auto">
            {/*
              Моноширинний шрифт — єдиний спосіб зберегти відступи джерела:
              усі символи однакової ширини, тож акорд лишається над своїм
              складом на будь-якому масштабі.
            */}
            <RawSong
              text={rawShown}
              fontSize={prefs.rawFontSize}
              showText={view !== 'grid'}
              showChords={view !== 'text'}
            />
          </div>
        ) : (
          <div className={`px-4 pt-4${prefs.chordsAccent ? ' chords-accent' : ''}`}>
            <SongBody
              sections={song.sections}
              arrangement={song.arrangement}
              view={view}
              transpose={transpose - personal.capo}
              targetKey={personal.capo ? shapeKey : currentKey}
              fontSize={prefs.fontSize}
              editing={editing}
              onPickChord={setSpot}
            />
          </div>
        )}
      </div>

      {/* Нижня панель: розмір тексту — його міняють найчастіше */}
      <div className="no-print sticky bottom-0 bg-[var(--bg)]/90 backdrop-blur-xl border-t border-[var(--line)] px-3 py-2.5 pb-safe">
        <div className="flex items-center gap-2">
          <Button onClick={() => zoom(-1)} disabled={fontSize <= zoomMin}
            className="w-12 text-lg font-bold" aria-label="Дрібніший текст">
            A−
          </Button>
          <div className="flex-1 text-center">
            <div className="text-xl font-bold text-[var(--accent)] leading-none">{fontSize}</div>
            <div className="text-[10px] text-[var(--text-faint)] mt-0.5">розмір тексту</div>
          </div>
          <Button onClick={() => zoom(1)} disabled={fontSize >= zoomMax}
            className="w-12 text-lg font-bold" aria-label="Більший текст">
            A+
          </Button>
        </div>
      </div>

      {spot && (
        <ActionSheet
          title={spot.index >= 0 ? `Акорд ${spot.chord}` : 'Додати акорд'}
          subtitle={spot.index >= 0
            ? 'Посунь на склад ліворуч чи праворуч, або зміни його'
            : 'Акорд стане над цим складом'}
          onClose={() => setSpot(null)}
          actions={spot.index >= 0 ? [
            {
              label: 'Посунути ліворуч', icon: '⬅️',
              onClick: () => editSection(spot.sectionId,
                (b) => moveChord(b, { line: spot.line, index: spot.index }, -1)),
            },
            {
              label: 'Посунути праворуч', icon: '➡️',
              onClick: () => editSection(spot.sectionId,
                (b) => moveChord(b, { line: spot.line, index: spot.index }, 1)),
            },
            { label: 'Змінити акорд', icon: '🎸', onClick: () => setPicking(spot) },
            {
              label: 'Видалити акорд', icon: '🗑', danger: true,
              onClick: () => editSection(spot.sectionId,
                (b) => removeChord(b, { line: spot.line, index: spot.index })),
            },
          ] : [
            { label: 'Поставити акорд тут', icon: '🎸', onClick: () => setPicking(spot) },
          ]}
        />
      )}

      {picking && (
        <ChordPicker
          title={picking.index >= 0 ? 'Новий акорд замість старого' : 'Який акорд поставити'}
          initial={picking.chord ? transposeChord(picking.chord, transpose, currentKey) : ''}
          onCancel={() => setPicking(null)}
          onConfirm={(chord) => {
            const stored = toStored(chord)
            editSection(picking.sectionId, (b) =>
              picking.index >= 0
                ? replaceChord(b, { line: picking.line, index: picking.index }, stored)
                : insertChord(b, picking.line, picking.textPos, stored))
            setPicking(null)
            setSpot(null)
          }}
        />
      )}
    </div>
  )
}

function Toggle({ label, on, disabled, onClick }: {
  label: string; on: boolean; disabled?: boolean; onClick(): void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      title={disabled ? 'Щось одне має лишитись увімкненим' : undefined}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm border transition
        active:scale-[0.97] disabled:opacity-45 ${
        on ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
           : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--line)] hover:bg-[var(--surface-hover)]'}`}
    >
      <span className={`w-4 h-4 rounded grid place-items-center text-[11px] font-bold ${
        on ? 'bg-slate-950/20' : 'border border-[var(--line-strong)]'}`}>
        {on ? '✓' : ''}
      </span>
      {label}
    </button>
  )
}

export { semitonesBetween }
