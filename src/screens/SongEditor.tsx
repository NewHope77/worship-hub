import { useRef, useState } from 'react'
import type { Section, SectionKind, Song } from '../types'
import { SECTION_KINDS } from '../types'
import { useStore } from '../store'
import { newId, splitIntoSections, guessKind } from '../chordpro/parse'
import { keyOptions, isMinorKey } from '../chordpro/transpose'
import { readSongFile } from '../import/files'
import { saveSongFile, deleteSongFile } from '../storage/files'
import { SortableList, SortableRow, DragHandle } from '../components/Sortable'
import { TopBar, BackButton, Button, Field, inputClass } from '../components/ui'

interface Props {
  song: Song | null
  onDone(): void
}

function emptySong(createdBy: string): Song {
  const secId = newId('sec')
  return {
    id: newId('sg'), title: '', author: '', originalKey: 'G', tempo: null,
    timeSignature: '4/4', tags: [], youtubeUrl: '', notes: '', raw: '',
    sections: [{ id: secId, kind: 'verse', label: 'Куплет 1', body: '' }],
    arrangement: [secId], createdBy, updatedAt: Date.now(),
  }
}

export default function SongEditor({ song, onDone }: Props) {
  const { upsertSong, deleteSong, meId } = useStore()
  const [draft, setDraft] = useState<Song>(() => song ?? emptySong(meId ?? ''))
  const [pasteOpen, setPasteOpen] = useState(!song)
  const [pasteText, setPasteText] = useState('')
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<{ stage: string; percent: number } | null>(null)
  const [ocrWarning, setOcrWarning] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  // Файл тримаємо до збереження: пісня ще може не мати остаточного id
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [tagInput, setTagInput] = useState(draft.tags.join(', '))

  const patch = (p: Partial<Song>) => setDraft((d) => ({ ...d, ...p }))

  const patchSection = (id: string, p: Partial<Section>) =>
    setDraft((d) => ({ ...d, sections: d.sections.map((s) => (s.id === id ? { ...s, ...p } : s)) }))

  const addSection = () => {
    const id = newId('sec')
    const n = draft.sections.filter((s) => s.kind === 'verse').length + 1
    const sec: Section = { id, kind: 'verse', label: `Куплет ${n}`, body: '' }
    setDraft((d) => ({ ...d, sections: [...d.sections, sec], arrangement: [...d.arrangement, id] }))
  }

  const removeSection = (id: string) =>
    setDraft((d) => ({
      ...d,
      sections: d.sections.filter((s) => s.id !== id),
      arrangement: d.arrangement.filter((a) => a !== id),
    }))

  const applyPaste = () => {
    setImportError('')
    try {
      applySections(splitIntoSections(pasteText), undefined, pasteText)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e))
    }
  }

  const applySections = (sections: Section[], fallbackTitle?: string, rawText?: string) => {
    if (sections.length === 0) throw new Error('Не вдалося знайти текст пісні у файлі.')
    setDraft((d) => ({
      ...d,
      sections,
      arrangement: sections.map((s) => s.id),
      title: d.title.trim() || (fallbackTitle ?? '').trim(),
      // Зберігаємо джерело як є — для показу «точно як в оригіналі»
      raw: rawText ?? d.raw,
    }))
    setPasteOpen(false)
    setPasteText('')
  }

  const handleFile = async (file: File) => {
    setImportError('')
    setImporting(true)
    setProgress(null)
    try {
      const imported = await readSongFile(file, setProgress)
      applySections(splitIntoSections(imported.text), imported.title, imported.text)
      // Оригінал лишаємо: інколи треба глянути саме його, з нотами й позначками
      setPendingFile(file)
      setDraft((d) => ({
        ...d,
        attachment: { name: file.name, type: file.type, size: file.size },
      }))
      // Розпізнавання зі знімка завжди варте вичитки
      setOcrWarning(imported.kind === 'image')
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e))
    } finally {
      setImporting(false)
      setProgress(null)
    }
  }

  const save = () => {
    const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean)
    if (pendingFile) void saveSongFile(draft.id, pendingFile)
    upsertSong({
      ...draft,
      title: draft.title.trim() || 'Без назви',
      tags,
      // Секції без тексту не зберігаємо
      sections: draft.sections.filter((s) => s.body.trim() || s.label.trim()),
    })
    onDone()
  }

  const remove = () => {
    if (!song) return onDone()
    if (!confirm(`Видалити «${song.title}» назавжди?`)) return
    void deleteSongFile(song.id)
    deleteSong(song.id)
    onDone()
  }

  const minor = isMinorKey(draft.originalKey)
  const rows = draft.sections.map((s) => ({ key: s.id, section: s }))

  return (
    <div className="min-h-full flex flex-col">
      <TopBar
        left={<BackButton onClick={onDone} />}
        title={song ? 'Редагування' : 'Нова пісня'}
        right={<Button variant="primary" onClick={save} className="!px-4 !py-2">Зберегти</Button>}
      />

      <div className="flex-1 px-4 py-4 space-y-4 pb-24">
        {pasteOpen ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 space-y-4">
            <div>
              <div className="font-semibold text-[var(--accent)] mb-1">Додати пісню</div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Візьми пісню з файлу або встав текстом. Розуміє{' '}
                <b className="text-[var(--text)]">звичайний формат</b>, де акорди стоять рядком над
                словами — вони самі стануть на потрібні склади. Секції поріжуться за заголовками
                («1 куплет», «Припев», «Бридж», «Проигрыш») або за порожніми рядками.
              </p>
            </div>

            {/* Файл: PDF / DOCX / TXT */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const f = e.dataTransfer.files[0]
                if (f) void handleFile(f)
              }}
              className={`rounded-xl border-2 border-dashed p-4 text-center transition ${
                dragOver ? 'border-amber-400 bg-amber-400/10' : 'border-[var(--line-strong)] bg-[var(--surface-1)]'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt,.text,.md,.chopro,.cho,.crd,.pro,.onsong,text/plain,application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleFile(f)
                  e.target.value = ''
                }}
              />
              {importing ? (
                <div className="py-2">
                  <div className="text-sm text-[var(--accent)]">
                    {progress ? progress.stage : 'Читаю файл'}…
                  </div>
                  {progress && (
                    <>
                      <div className="h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden mt-2">
                        <div className="h-full bg-[var(--accent)] transition-[width] duration-300"
                          style={{ width: `${Math.round(progress.percent)}%` }} />
                      </div>
                      <div className="text-[11px] text-[var(--text-faint)] mt-1.5">
                        Розпізнавання зі знімка триває довше — перший раз ще
                        й вантажиться словник
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <Button onClick={() => fileRef.current?.click()} className="mb-2">
                    📄 Вибрати файл
                  </Button>
                  <div className="text-[11px] text-[var(--text-faint)]">
                    PDF, DOCX, TXT, фото чи скріншот — або перетягни сюди
                  </div>
                </>
              )}
            </div>

            {importError && (
              <div className="rounded-xl bg-rose-500/12 border border-rose-500/30 px-3 py-2.5 text-xs text-rose-200 leading-relaxed">
                {importError}
              </div>
            )}

            <div className="flex items-center gap-3">
              <span className="flex-1 h-px bg-[var(--surface-hover)]" />
              <span className="text-[11px] text-[var(--text-faint)] uppercase tracking-wider">або текстом</span>
              <span className="flex-1 h-px bg-[var(--surface-hover)]" />
            </div>

            <textarea rows={8} className={inputClass + ' font-mono text-sm whitespace-pre'}
              placeholder={'1 куплет\nAm        F         C      G\nТекст пісні, акорди стоять над словами\n\nПрипев\n   F        C\nРядок приспіву'}
              value={pasteText} onChange={(e) => setPasteText(e.target.value)} />

            <div className="flex gap-2">
              <Button variant="primary" onClick={applyPaste} disabled={!pasteText.trim()} className="flex-1">
                Розібрати на секції
              </Button>
              <Button onClick={() => setPasteOpen(false)}>Пропустити</Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => { setImportError(''); setPasteOpen(true) }} className="w-full">
            📄 Додати з файлу або вставити текстом
          </Button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Назва">
              <input className={inputClass} value={draft.title} placeholder="Назва пісні"
                onChange={(e) => patch({ title: e.target.value })} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Автор / виконавець">
              <input className={inputClass} value={draft.author} placeholder="напр. Hillsong, переклад…"
                onChange={(e) => patch({ author: e.target.value })} />
            </Field>
          </div>
          <Field label="Тональність" hint="у якій записані акорди">
            <div className="flex gap-1.5">
              <select className={inputClass} value={draft.originalKey}
                onChange={(e) => patch({ originalKey: e.target.value })}>
                {keyOptions(minor).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <Button
                onClick={() => patch({ originalKey: minor ? draft.originalKey.replace(/m$/, '') : draft.originalKey + 'm' })}
                className="!px-3 shrink-0" title="Мажор / мінор">
                {minor ? 'moll' : 'dur'}
              </Button>
            </div>
          </Field>
          <Field label="Темп (BPM)">
            <input className={inputClass} type="number" inputMode="numeric" value={draft.tempo ?? ''}
              placeholder="—" onChange={(e) => patch({ tempo: e.target.value ? +e.target.value : null })} />
          </Field>
          <div className="col-span-2">
            <Field label="Теги" hint="через кому: швидка, поклоніння, різдво">
              <input className={inputClass} value={tagInput} placeholder="поклоніння, повільна"
                onChange={(e) => setTagInput(e.target.value)} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Спільна нотатка" hint="бачать усі учасники">
              <textarea rows={2} className={inputClass + ' resize-none'} value={draft.notes}
                placeholder="напр.: вступ грає тільки клавішник, вокал вступає з 2 такту"
                onChange={(e) => patch({ notes: e.target.value })} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Посилання на YouTube">
              <input className={inputClass} value={draft.youtubeUrl} placeholder="https://youtu.be/…"
                onChange={(e) => patch({ youtubeUrl: e.target.value })} />
            </Field>
          </div>
        </div>

        {ocrWarning && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-3">
            <div className="font-semibold text-[var(--accent)] mb-1">Перечитай текст</div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Це розпізнано зі знімка, тож у словах і акордах можливі помилки —
              надто якщо знімок нечіткий. Пройдись по секціях і виправ, що поїхало.
            </p>
            <button onClick={() => setOcrWarning(false)}
              className="text-xs text-[var(--text-faint)] hover:text-[var(--text)] mt-2">
              зрозуміло, прибрати
            </button>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">Секції</div>
            <div className="text-[11px] text-[var(--text-faint)]">затисни ⠿ і тягни, щоб змінити порядок</div>
          </div>

          <SortableList
            items={rows}
            onReorder={(next) => {
              const sections = next.map((r) => r.section)
              setDraft((d) => ({ ...d, sections, arrangement: sections.map((s) => s.id) }))
            }}
          >
            <div className="space-y-2">
              {rows.map(({ key, section }) => (
                <SortableRow key={key} id={key}>
                  {(handle) => (
                    <div className="rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] overflow-hidden">
                      <div className="flex items-center gap-1 pl-1 pr-2 py-1.5 bg-[var(--surface-1)]">
                        <DragHandle {...handle} />
                        <input
                          className="flex-1 min-w-0 bg-transparent outline-none font-semibold text-sm py-1.5 px-1
                                     focus:bg-[var(--surface-2)] rounded"
                          value={section.label}
                          placeholder="Назва секції"
                          onChange={(e) =>
                            patchSection(section.id, { label: e.target.value, kind: guessKind(e.target.value) })}
                        />
                        <select
                          className="bg-transparent text-[11px] font-bold uppercase tracking-wider outline-none
                                     text-[var(--text-muted)] cursor-pointer"
                          value={section.kind}
                          onChange={(e) => patchSection(section.id, { kind: e.target.value as SectionKind })}
                        >
                          {Object.entries(SECTION_KINDS).map(([k, v]) => (
                            <option key={k} value={k} className="bg-[var(--panel)]">{v.label}</option>
                          ))}
                        </select>
                        <button onClick={() => removeSection(section.id)} aria-label="Видалити секцію"
                          className="shrink-0 w-8 h-8 grid place-items-center rounded-lg text-[var(--text-faint)] hover:text-rose-400 hover:bg-rose-500/10">
                          ✕
                        </button>
                      </div>
                      <textarea
                        rows={Math.max(3, section.body.split('\n').length)}
                        className="w-full bg-transparent px-3 py-2.5 font-mono text-[13px] leading-relaxed
                                   outline-none resize-none placeholder:text-[var(--text-faint)]"
                        placeholder="[G]Слава Тобі, [D]Боже наш"
                        value={section.body}
                        onChange={(e) => patchSection(section.id, { body: e.target.value })}
                      />
                    </div>
                  )}
                </SortableRow>
              ))}
            </div>
          </SortableList>

          <Button onClick={addSection} className="w-full mt-2">+ Додати секцію</Button>
        </div>

        <ArrangementEditor draft={draft} patch={patch} />

        {song && (
          <Button variant="danger" onClick={remove} className="w-full">Видалити пісню</Button>
        )}
      </div>
    </div>
  )
}

/** Порядок виконання: секції можна повторювати (приспів двічі) */
function ArrangementEditor({ draft, patch }: { draft: Song; patch(p: Partial<Song>): void }) {
  const byId = new Map(draft.sections.map((s) => [s.id, s]))
  const rows = draft.arrangement
    .map((id, i) => ({ key: `${id}__${i}`, id, section: byId.get(id) }))
    .filter((r) => r.section)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Порядок виконання</div>
        <button
          className="text-[11px] text-[var(--text-faint)] hover:text-[var(--text)]"
          onClick={() => patch({ arrangement: draft.sections.map((s) => s.id) })}
        >
          скинути
        </button>
      </div>
      <p className="text-[11px] text-[var(--text-faint)] mb-2 leading-relaxed">
        Тут секція може повторюватись — напр. Куплет 1 → Приспів → Куплет 2 → Приспів → Приспів.
      </p>

      <SortableList
        items={rows}
        onReorder={(next) => patch({ arrangement: next.map((r) => r.id) })}
      >
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <SortableRow key={r.key} id={r.key}>
              {(handle) => (
                <div className="flex items-center gap-1 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] pl-1 pr-2">
                  <DragHandle {...handle} />
                  <span className="text-[11px] text-[var(--text-faint)] font-mono w-5">{i + 1}</span>
                  <span className={`flex-1 text-sm font-medium py-2.5 ${SECTION_KINDS[r.section!.kind].color.split(' ')[0]}`}>
                    {r.section!.label}
                  </span>
                  <button
                    onClick={() => patch({ arrangement: draft.arrangement.filter((_, j) => j !== i) })}
                    className="w-8 h-8 grid place-items-center rounded-lg text-[var(--text-faint)] hover:text-rose-400"
                    aria-label="Прибрати з порядку"
                  >✕</button>
                </div>
              )}
            </SortableRow>
          ))}
        </div>
      </SortableList>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {draft.sections.map((s) => (
          <Button key={s.id} variant="chip"
            onClick={() => patch({ arrangement: [...draft.arrangement, s.id] })}>
            + {s.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
