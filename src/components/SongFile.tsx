import { useEffect, useState } from 'react'
import { readSongFile, isViewableInBrowser, formatSize } from '../storage/files'
import type { StoredFile } from '../storage/files'
import { Button } from './ui'
import { renderDocx } from '../import/renderDocx'
import type { DocxBlock } from '../import/renderDocx'

/**
 * Показ оригіналу, з якого пісню імпортували: PDF з нотами, знімок, документ.
 * Файл лежить на пристрої, тому відкривається й без мережі.
 */
export default function SongFile({ songId, fileName }: { songId: string; fileName?: string }) {
  const [file, setFile] = useState<StoredFile | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  /** Word малюємо самі: браузер такого формату не показує */
  const [docx, setDocx] = useState<DocxBlock[] | null>(null)
  const [docxFailed, setDocxFailed] = useState(false)

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
  // Word розбираємо й показуємо як документ — з накресленням і вирівнюванням
  useEffect(() => {
    if (!file || isViewableInBrowser(file.type)) return
    if (!/\.docx$/i.test(file.name)) { setDocxFailed(true); return }
    let alive = true
    renderDocx(file.blob)
      .then((blocks) => { if (alive) setDocx(blocks) })
      .catch(() => { if (alive) setDocxFailed(true) })
    return () => { alive = false }
  }, [file])

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

  const openOriginal = async () => {
    if (!file) return
    const asFile = new File([file.blob], file.name, { type: file.type })

    if (navigator.canShare?.({ files: [asFile] })) {
      try {
        await navigator.share({ files: [asFile], title: file.name })
        return
      } catch (e) {
        // Скасував сам користувач — так і лишаємо; інакше пробуємо інакше
        if (e instanceof Error && e.name === 'AbortError') return
        handOver()
        return
      }
    }
    handOver()
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
      ) : docx ? (
        // Сторінка документа: біле полотно, як у Word
        <div className="rounded-2xl bg-white text-[#111] px-5 py-6 shadow-lg overflow-x-auto">
          {docx.map((b, i) => (
            <p
              key={i}
              style={{
                textAlign: b.align,
                fontWeight: b.bold || b.heading ? 700 : 400,
                fontStyle: b.italic ? 'italic' : undefined,
                textDecoration: b.underline ? 'underline' : undefined,
                fontSize: b.heading ? '1.25em' : b.size ? `${b.size}pt` : undefined,
                whiteSpace: 'pre-wrap',
                margin: b.text.trim() ? '0 0 0.55em' : '0 0 0.9em',
                lineHeight: 1.45,
              }}
            >
              {b.text.trim() ? b.text : '\u00A0'}
            </p>
          ))}
        </div>
      ) : docxFailed ? (
        <div className="px-6 py-8 text-center">
          <div className="text-5xl mb-4">📄</div>
          <div className="font-semibold mb-1">{file.name}</div>
          <p className="text-xs text-[var(--text-muted)] mb-5 leading-relaxed max-w-xs mx-auto">
            Цей формат показати не вдалося — відкрий його застосунком телефона.
          </p>
          <Button variant="primary" className="w-full" onClick={openOriginal}>
            Відкрити оригінал
          </Button>
        </div>
      ) : (
        <div className="px-6 py-8 text-center text-sm text-[var(--text-faint)]">
          Відкриваю документ…
        </div>
      )}

      <Button className="w-full" onClick={handOver}>⬇️ Зберегти файл</Button>
    </div>
  )
}
