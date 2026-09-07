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
        <span className="shrink-0">{formatSize(file.size)}</span>
      </div>

      {isImage ? (
        // Знімок гортається й масштабується самим браузером
        <div className="overflow-auto rounded-xl border border-[var(--line)] bg-white">
          <img src={url} alt={file.name} className="max-w-none w-auto min-w-full" />
        </div>
      ) : isViewableInBrowser(file.type) ? (
        <iframe
          src={url}
          title={file.name}
          className="w-full rounded-xl border border-[var(--line)] bg-white"
          style={{ height: '75vh' }}
        />
      ) : (
        <div className="px-6 py-10 text-center">
          <div className="text-4xl mb-3 opacity-60">📎</div>
          <div className="font-semibold mb-1">Цей тип браузер не показує</div>
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Документи Word відкриваються лише у зовнішньому застосунку.
          </p>
        </div>
      )}

      <a href={url} download={file.name} className="block">
        <Button className="w-full">⬇️ Зберегти файл</Button>
      </a>
    </div>
  )
}
