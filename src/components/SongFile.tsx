import { useEffect, useState } from 'react'
import { readSongFile, isViewableInBrowser, formatSize } from '../storage/files'
import type { StoredFile } from '../storage/files'
import { Button } from './ui'

/**
 * Показ оригіналу, з якого пісню імпортували: PDF з нотами, знімок, документ.
 * Файл лежить на пристрої, тому відкривається й без мережі.
 */
export default function SongFile({ songId, fileName }: { songId: string; fileName?: string }) {
  const [file, setFile] = useState<StoredFile | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  /** Знімок спершу вписуємо в екран; дотик показує його в повний розмір */
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    let objectUrl: string | null = null
    let alive = true

    readSongFile(songId).then((found) => {
      if (!alive) return
      if (!found) {
        setState('missing')
        return
      }
      objectUrl = URL.createObjectURL(found.blob)
      setFile(found)
      setUrl(objectUrl)
      setState('ready')
    })

    return () => {
      alive = false
      // Посилання на файл треба звільняти, інакше він висить у пам'яті
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [songId])

  /**
   * Віддаємо файл системі, а не браузеру: інакше Chrome пропонує «завантажити
   * ще раз» під випадковим ім'ям, хоча файл уже лежить у застосунку.
   * Через системний вибір застосунку Word відкриє документ одразу.
   */
  /** Останній шлях: віддати файл через посилання із правильним ім'ям */
  const handOver = () => {
    if (!url || !file) return
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    // Клік по створеному посиланню надійніший за відкриття вікна:
    // після очікування браузер таке вікно зазвичай блокує
    document.body.append(a)
    a.click()
    a.remove()
  }

  if (state === 'loading') {
    return <div className="px-4 py-8 text-center text-sm text-[var(--text-faint)]">Відкриваю файл…</div>
  }

  if (state === 'missing' || !file || !url) {
    return (
      <div className="px-6 py-10 text-center">
        <div className="text-4xl mb-3 opacity-60">📄</div>
        <div className="font-semibold mb-1">Файл недоступний на цьому пристрої</div>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-xs mx-auto">
          {fileName
            ? `Пісню імпортували з «${fileName}», але сам файл зберігся лише там, де це робили.`
            : 'Пісню додали текстом, без файлу.'}
        </p>
      </div>
    )
  }

  const isImage = file.type.startsWith('image/')

  return (
    <div className="px-3 py-3 space-y-3">
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] px-1">
        <span className="truncate flex-1">{file.name}</span>
        {file.type.startsWith('image/') && (
          <span className="shrink-0">{zoomed ? 'дотик — вписати' : 'дотик — збільшити'}</span>
        )}
        <span className="shrink-0">{formatSize(file.size)}</span>
      </div>

      {isImage ? (
        <div className={`rounded-xl border border-[var(--line)] bg-white ${
          zoomed ? 'overflow-auto' : 'overflow-hidden'}`}>
          <img
            src={url}
            alt={file.name}
            onClick={() => setZoomed((z) => !z)}
            // Вписано в ширину — видно всю сторінку; дотик дає повний розмір
            className={zoomed ? 'max-w-none w-auto min-w-full cursor-zoom-out' : 'w-full h-auto cursor-zoom-in'}
          />
        </div>
      ) : isViewableInBrowser(file.type) ? (
        <iframe
          src={url}
          title={file.name}
          className="w-full rounded-xl border border-[var(--line)] bg-white"
          style={{ height: '75vh' }}
        />
      ) : (
        /*
         * Word та подібні формати браузер малювати не вміє. Не переписуємо їх
         * і не показуємо замінник — віддаємо оригінал системі, хай його
         * відкриє застосунок, який цей формат розуміє.
         */
        <div className="px-6 py-8 text-center">
          <div className="text-5xl mb-4">📄</div>
          <div className="font-semibold mb-1">{file.name}</div>
          <p className="text-xs text-[var(--text-muted)] mb-5 leading-relaxed max-w-xs mx-auto">
            Документи Word браузер не показує. Збережи файл і відкрий його
            застосунком, який працює з таким форматом.
          </p>
          <Button variant="primary" className="w-full" onClick={handOver}>
            ⬇️ Завантажити файл
          </Button>
        </div>
      )}

      {isViewableInBrowser(file.type) && (
        <Button className="w-full" onClick={handOver}>⬇️ Зберегти файл</Button>
      )}
    </div>
  )
}
