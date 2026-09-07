import { mergeSuffixLines } from '../chordpro/fromPlainText'

/**
 * Імпорт пісні за посиланням.
 *
 * Сторінку не можна завантажити напряму: браузер блокує запити на чужі сайти
 * (CORS), тож ходимо через публічний читач, який віддає ту саму сторінку
 * у вигляді, придатному для розбору.
 */

export interface LinkImport {
  text: string
  title: string
  author: string
  originalKey: string
  source: string
}

const READER = 'https://r.jina.ai/'

export function isSupportedLink(url: string): boolean {
  return /^https?:\/\/(www\.)?holychords\.pro\/\d+/i.test(url.trim())
}

/** Тональність сайт тримає класом на блоці з піснею */
function keyFromClass(className: string): string {
  const candidate = className.trim().split(/\s+/).find((c) => /^[A-H][b#]?m?$/.test(c))
  return candidate ?? 'C'
}

function cleanTitle(raw: string): string {
  return raw
    .split('|')[0]
    .replace(/\s*(аккорды|акорди|слова|текст песни|chords).*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export async function importFromLink(url: string): Promise<LinkImport> {
  const clean = url.trim()
  if (!isSupportedLink(clean)) {
    throw new Error('Підтримуються посилання на пісню з holychords.pro — на кшталт holychords.pro/2332')
  }

  let html: string
  try {
    const response = await fetch(READER + clean, { headers: { 'x-return-format': 'html' } })
    if (!response.ok) throw new Error(`сервер відповів ${response.status}`)
    html = await response.text()
  } catch (e) {
    throw new Error(
      'Не вдалося відкрити сторінку. Перевір інтернет і саме посилання. ' +
      (e instanceof Error ? e.message : ''),
    )
  }

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const block = doc.querySelector('#music_text')
  if (!block?.textContent?.trim()) {
    throw new Error('На сторінці не знайшлося тексту пісні — можливо, змінилася будова сайту.')
  }

  // Заголовок сторінки має вигляд «Виконавець Назва | аккорды | …»
  const heading = doc.querySelector('h2')?.textContent ?? ''
  const pageTitle = doc.querySelector('title')?.textContent ?? ''
  const artist = [...doc.querySelectorAll('a')]
    .find((a) => /\/artist\//.test(a.getAttribute('href') ?? ''))
    ?.textContent?.trim() ?? ''

  const title = cleanTitle(heading.split('\n')[0] || pageTitle) || 'Без назви'

  return {
    text: mergeSuffixLines(block.textContent.replace(/\r\n?/g, '\n')),
    title: artist && title.startsWith(artist) ? title.slice(artist.length).trim() : title,
    author: artist,
    originalKey: keyFromClass(block.className),
    source: clean,
  }
}
