import { useState } from 'react'
import { Button, inputClass } from './ui'

const COMMON = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
const SUFFIX = ['', 'm', '7', 'm7', 'maj7', 'sus4', 'sus2', 'dim', '6', '9']

/** Ввід акорду: швидкі кнопки для звичних і поле для всього іншого */
export default function ChordPicker({ initial, title, onCancel, onConfirm }: {
  initial: string
  title: string
  onCancel(): void
  onConfirm(chord: string): void
}) {
  const [value, setValue] = useState(initial)
  const [root, setRoot] = useState(initial.match(/^[A-H][b#]?/)?.[0] ?? 'C')

  const apply = (r: string, suffix: string) => {
    setRoot(r)
    setValue(r + suffix)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-label={title}>
      <button aria-label="Закрити" onClick={onCancel}
        className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm" />
      <div className="relative glass rounded-t-3xl !border-b-0 p-4 pb-safe space-y-4">
        <div className="w-10 h-1 rounded-full bg-[var(--line-strong)] mx-auto" />
        <div className="font-semibold">{title}</div>

        <input className={inputClass + ' text-center text-lg font-mono font-bold'}
          value={value} onChange={(e) => setValue(e.target.value)} autoFocus
          placeholder="напр. Am7 або D/F#" />

        <div>
          <div className="text-xs text-[var(--text-muted)] mb-1.5">Основа</div>
          <div className="flex flex-wrap gap-1.5">
            {COMMON.map((r) => (
              <Button key={r} variant="chip" active={root === r}
                onClick={() => apply(r, value.replace(/^[A-H][b#]?/, ''))}>{r}</Button>
            ))}
            <Button variant="chip" onClick={() => apply(root + 'b', value.replace(/^[A-H][b#]?/, ''))}>♭</Button>
            <Button variant="chip" onClick={() => apply(root + '#', value.replace(/^[A-H][b#]?/, ''))}>♯</Button>
          </div>
        </div>

        <div>
          <div className="text-xs text-[var(--text-muted)] mb-1.5">Вид</div>
          <div className="flex flex-wrap gap-1.5">
            {SUFFIX.map((sfx) => (
              <Button key={sfx || 'dur'} variant="chip"
                onClick={() => apply(root, sfx)}>{sfx || 'мажор'}</Button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="primary" className="flex-1"
            onClick={() => value.trim() && onConfirm(value.trim())}>
            Готово
          </Button>
          <Button onClick={onCancel}>Скасувати</Button>
        </div>
      </div>
    </div>
  )
}
