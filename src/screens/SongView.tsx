import { useEffect, useMemo, useRef, useState } from 'react'
import type { Song, ViewMode } from '../types'
import { useStore, effectiveView } from '../store'
import { transposeKey, semitonesBetween } from '../chordpro/transpose'
import SongBody from '../components/SongBody'
import { transposeRaw, rawTextOnly, rawChordsOnly, sectionsToRaw } from '../chordpro/rawText'
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
  const { prefs, setPrefs, personalFor, setPersonal, me } = useStore()
  const personal = personalFor(song.id)
  const [panel, setPanel] = useState<'none' | 'settings' | 'note'>('none')
  const [scrolling, setScrolling] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const usingSetlistKey = setlistTranspose !== null
  const transpose = usingSetlistKey ? setlistTranspose : personal.transpose
  const view = effectiveView(personal, prefs)
  const currentKey = transposeKey(song.originalKey, transpose)
  // Каподастр не змінює звучання — тільки аплікатуру: показуємо форму акорду
  const shapeKey = transposeKey(currentKey, -personal.capo)

  // Автоскрол
  useEffect(() => {
    if (!scrolling) return
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = now - last
      last = now
      // scrollSpeed 1..100 → приблизно 5..90 px/с
      el.scrollTop += (prefs.scrollSpeed * 0.9 + 4) * (dt / 1000)
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        setScrolling(false)
        return
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [scrolling, prefs.scrollSpeed])

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

  const rawShown = useMemo(() => {
    const shifted = transposeRaw(rawSource, transpose - personal.capo,
      personal.capo ? shapeKey : currentKey)
    if (view === 'text') return rawTextOnly(shifted)
    if (view === 'grid') return rawChordsOnly(shifted)
    return shifted
  }, [rawSource, transpose, personal.capo, shapeKey, currentKey, view])

  const capoHint = useMemo(() => {
    if (!prefs.showCapo || personal.capo === 0) return null
    return `каподастр ${personal.capo} → форми в ${shapeKey}`
  }, [prefs.showCapo, personal.capo, shapeKey])

  const shift = (d: number) => {
    if (usingSetlistKey) return
    setPersonal(song.id, { transpose: Math.max(-11, Math.min(11, transpose + d)) })
  }

  return (
    <div className="min-h-full flex flex-col">
      <TopBar
        left={<BackButton onClick={onBack} />}
        title={song.title}
        subtitle={
          <span className="flex items-center gap-1.5">
            <span className="text-amber-400 font-semibold">{currentKey}</span>
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
                panel === 'note' ? 'bg-amber-500 text-slate-950' : 'hover:bg-white/10 text-slate-300'}`}>
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
                panel === 'settings' ? 'bg-amber-500 text-slate-950' : 'hover:bg-white/10 text-slate-300'}`}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H2a2 2 0 110-4h.09A1.65 1.65 0 004.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 3.6 1.65 1.65 0 0010 2.09V2a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 8v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>
          </div>
        }
      />

      {panel === 'settings' && (
        <div className="no-print border-b border-white/10 bg-[#171a21] px-4 py-4 space-y-4">
          <div>
            <div className="text-xs font-medium text-slate-400 mb-2">Що показувати</div>
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
            <div className="text-[11px] text-slate-500 mt-1.5">{VIEW_HINT[view]}</div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-400 mb-2">Як показувати</div>
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
            <div className="text-[11px] text-slate-500 mt-1.5">
              {showOriginal
                ? 'Вигляд, відступи й переноси — як у джерелі, символ у символ'
                : 'Переноситься під ширину екрана, акорди прив’язані до складів'}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-xs font-medium text-slate-400 mb-1.5">
                {showOriginal ? `Масштаб: ${prefs.rawFontSize}px` : 'Розмір тексту'}
              </div>
              {showOriginal ? (
                <input type="range" min={7} max={26} value={prefs.rawFontSize} className="w-full accent-amber-500"
                  onChange={(e) => setPrefs({ rawFontSize: +e.target.value })} />
              ) : (
                <input type="range" min={13} max={30} value={prefs.fontSize} className="w-full accent-amber-500"
                  onChange={(e) => setPrefs({ fontSize: +e.target.value })} />
              )}
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium text-slate-400 mb-1.5">
                Каподастр: <span className="text-slate-200">{personal.capo || '—'}</span>
              </div>
              <input type="range" min={0} max={7} value={personal.capo} className="w-full accent-amber-500"
                onChange={(e) => setPersonal(song.id, { capo: +e.target.value })} />
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-400 mb-1.5">Швидкість автоскролу</div>
            <input type="range" min={1} max={100} value={prefs.scrollSpeed} className="w-full accent-amber-500"
              onChange={(e) => setPrefs({ scrollSpeed: +e.target.value })} />
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={onEdit} className="flex-1">Редагувати пісню</Button>
            <Button onClick={() => window.print()}>Друк</Button>
          </div>
        </div>
      )}

      {panel === 'note' && (
        <div className="no-print border-b border-white/10 bg-[#171a21] px-4 py-4 space-y-3">
          {song.notes.trim() && (
            <div>
              <div className="text-xs font-medium text-slate-400 mb-1">Спільна нотатка (бачать усі)</div>
              <div className="text-sm text-slate-300 whitespace-pre-wrap rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2">
                {song.notes}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs font-medium text-slate-400 mb-1">
              Моя нотатка — бачиш тільки ти{me ? `, ${me.name}` : ''}
            </div>
            <textarea rows={4} className={inputClass + ' resize-none'}
              placeholder="Напр.: вступ 4 такти · тут бек другим голосом · на мості тримати педаль"
              value={personal.note}
              onChange={(e) => setPersonal(song.id, { note: e.target.value })} />
          </div>
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
            <pre
              className="font-mono leading-snug text-slate-100 whitespace-pre"
              style={{ fontSize: prefs.rawFontSize, tabSize: 4 }}
            >
              {rawShown}
            </pre>
          </div>
        ) : (
          <div className="px-4 pt-4">
            <SongBody
              sections={song.sections}
              arrangement={song.arrangement}
              view={view}
              transpose={transpose - personal.capo}
              targetKey={personal.capo ? shapeKey : currentKey}
              fontSize={prefs.fontSize}
            />
          </div>
        )}
      </div>

      {/* Нижня панель: транспонування + автоскрол */}
      <div className="no-print sticky bottom-0 bg-[#0f1115]/90 backdrop-blur-xl border-t border-white/10 px-3 py-2.5 pb-safe">
        <div className="flex items-center gap-2">
          <Button onClick={() => shift(-1)} disabled={usingSetlistKey} className="w-12 text-lg font-bold" aria-label="Нижче на півтон">−</Button>
          <div className="flex-1 text-center">
            <div className="text-xl font-bold text-amber-400 leading-none">{currentKey}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {usingSetlistKey ? 'задано сет-листом' : `оригінал ${song.originalKey}`}
            </div>
          </div>
          <Button onClick={() => shift(1)} disabled={usingSetlistKey} className="w-12 text-lg font-bold" aria-label="Вище на півтон">+</Button>
          <Button
            variant={scrolling ? 'primary' : 'ghost'}
            onClick={() => setScrolling((s) => !s)}
            className="w-12"
            aria-label={scrolling ? 'Спинити автоскрол' : 'Автоскрол'}
          >
            {scrolling ? '⏸' : '▶'}
          </Button>
        </div>
        {!usingSetlistKey && transpose !== 0 && (
          <button onClick={() => setPersonal(song.id, { transpose: 0 })}
            className="w-full text-center text-[11px] text-slate-500 hover:text-slate-300 mt-1.5">
            повернути оригінальну тональність ({song.originalKey})
          </button>
        )}
      </div>
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
           : 'bg-white/[0.05] text-slate-300 border-white/10 hover:bg-white/[0.1]'}`}
    >
      <span className={`w-4 h-4 rounded grid place-items-center text-[11px] font-bold ${
        on ? 'bg-slate-950/20' : 'border border-white/25'}`}>
        {on ? '✓' : ''}
      </span>
      {label}
    </button>
  )
}

export { semitonesBetween }
