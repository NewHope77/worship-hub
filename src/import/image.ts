/**
 * Розпізнавання пісні з фото або скріншота.
 *
 * Звичайний OCR повернув би суцільний текст і втратив відступи — а разом з
 * ними й прив'язку акордів до складів. Тому беремо не текст, а координати
 * кожного слова й відновлюємо колонки так само, як для PDF.
 */

export interface OcrProgress {
  stage: string
  percent: number
}

interface Word {
  text: string
  x: number
  y: number
  w: number
  h: number
}

/**
 * Розпізнавач налаштований на український текст, тому латинські акорди він
 * часто читає кирилицею за формою літер: Am -> Ат, C -> с, G -> в.
 * Тут зібрані саме такі підміни — по тому, як символи виглядають.
 */
const LOOKALIKE: Record<string, string> = {
  А: 'A', Б: 'b', В: 'B', Г: 'r', Д: 'D', Е: 'E', З: '3', И: 'U', І: 'I',
  К: 'K', Л: 'A', М: 'M', Н: 'H', О: 'O', П: 'N', Р: 'P', С: 'C', Т: 'T',
  У: 'Y', Ф: 'F', Х: 'X', Ь: 'b', Я: 'R',
  а: 'a', б: '6', в: 'B', г: 'r', д: 'd', е: 'e', з: '3', и: 'u', і: 'i',
  к: 'k', л: 'n', м: 'm', н: 'n', о: 'o', п: 'n', р: 'p', с: 'C', т: 'm',
  у: 'y', ф: 'f', х: 'x', ч: '4', ь: 'b',
}

const CHORD_SHAPE =
  /^[A-H][b#]?(?:o|°|\+|m|maj|min|dim|aug|sus|add)?\d*(?:sus\d|add\d*|maj\d*|m\d*)*(?:\/[A-Ha-h][b#]?)?$/

/** Спроба прочитати токен як акорд, виправивши кириличні підміни */
function asChord(token: string): string | null {
  if (CHORD_SHAPE.test(token)) return token
  if (!/[А-ЯҐЄІЇа-яґєії]/.test(token)) return null

  const latin = [...token].map((ch) => LOOKALIKE[ch] ?? ch).join('')
  if (CHORD_SHAPE.test(latin)) return latin
  // Перша літера акорду завжди велика: «ат» -> «Am»
  const capitalized = latin.charAt(0).toUpperCase() + latin.slice(1)
  return CHORD_SHAPE.test(capitalized) ? capitalized : null
}

/**
 * Виправляємо рядок цілком, а не кожне слово окремо: якщо більшість токенів
 * читається як акорди, то це рядок акордів — і решту в ньому теж треба
 * тлумачити як акорди, а не як слова пісні.
 */
function fixChordRow(texts: string[]): string[] {
  const chords = texts.map(asChord)
  const recognized = chords.filter(Boolean).length
  const short = texts.every((t) => t.length <= 6)
  const isChordRow = recognized > 0 && short && recognized >= Math.ceil(texts.length * 0.5)
  return isChordRow ? texts.map((t, i) => chords[i] ?? t) : texts
}

interface RawWord {
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
  confidence?: number
}

/** Слова лежать або в data.words, або в дереві блоків — залежно від збірки */
function collectWords(
  data: { words?: RawWord[]; blocks?: unknown[] },
  minConfidence = 30,
): Word[] {
  const out: Word[] = []
  const take = (w: RawWord) => {
    const text = w.text?.trim()
    if (!text) return
    if ((w.confidence ?? 100) < minConfidence) return // явний шум
    out.push({
      text,
      x: w.bbox.x0,
      y: w.bbox.y0,
      w: w.bbox.x1 - w.bbox.x0,
      h: w.bbox.y1 - w.bbox.y0,
    })
  }

  if (data.words?.length) {
    data.words.forEach(take)
    return out
  }
  for (const block of (data.blocks ?? []) as { paragraphs?: unknown[] }[]) {
    for (const para of (block.paragraphs ?? []) as { lines?: unknown[] }[]) {
      for (const line of (para.lines ?? []) as { words?: RawWord[] }[]) {
        (line.words ?? []).forEach(take)
      }
    }
  }
  return out
}

function median(nums: number[]): number {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/** Складає рядок, ставлячи кожне слово у його колонку */
function wordsToLine(words: Word[], minX: number, charW: number): string {
  const sorted = [...words].sort((a, b) => a.x - b.x)
  const texts = fixChordRow(sorted.map((w) => w.text))

  let out = ''
  sorted.forEach((word, i) => {
    const col = Math.max(0, Math.round((word.x - minX) / charW))
    if (col > out.length) out = out.padEnd(col, ' ')
    else if (out.length) out += ' '
    out += texts[i]
  })
  return out.replace(/\s+$/, '')
}

/** Чи цей набір слів схожий на рядок акордів, а не на рядок тексту */
function looksLikeChordRow(texts: string[]): boolean {
  if (!texts.length) return false
  if (!texts.every((t) => t.length <= 6)) return false
  const recognized = texts.filter((t) => asChord(t)).length
  return recognized > 0 && recognized >= Math.ceil(texts.length * 0.5)
}

function layoutWords(words: Word[], chordWords: Word[] = []): string {
  if (!words.length) return ''

  const charW = median(
    words.filter((w) => w.text.length > 1).map((w) => w.w / w.text.length).filter((v) => v > 1),
  ) || 8
  const lineH = median(words.map((w) => w.h)) || charW * 2
  const minX = Math.min(...words.map((w) => w.x))

  // Рядок — це слова, чиї середини по вертикалі близькі
  const rows: { y: number; words: Word[] }[] = []
  for (const w of [...words].sort((a, b) => a.y - b.y)) {
    const center = w.y + w.h / 2
    const row = rows.find((r) => Math.abs(r.y - center) <= lineH * 0.5)
    if (row) row.words.push(w)
    else rows.push({ y: center, words: [w] })
  }
  rows.sort((a, b) => a.y - b.y)

  // Порожній рядок ставимо за реальними проміжками між рядками, а не за
  // висотою літер: інакше кожен рядок відділявся б порожнім
  const gaps = rows.slice(1).map((r, i) => r.y - rows[i].y)
  const typicalGap = median(gaps) || lineH

  const lines: string[] = []
  rows.forEach((row, i) => {
    if (i > 0 && row.y - rows[i - 1].y > typicalGap * 1.6) lines.push('')

    const texts = [...row.words].sort((a, b) => a.x - b.x).map((w) => w.text)
    if (chordWords.length && looksLikeChordRow(texts)) {
      // Це рядок акордів — беремо його з другого проходу, де латиниця
      // розпізнана надійніше
      const half = lineH * 0.6
      const fromPass2 = chordWords.filter((w) => Math.abs(w.y + w.h / 2 - row.y) <= half)
      if (fromPass2.length) {
        lines.push(wordsToLine(fromPass2, minX, charW))
        return
      }
    }
    lines.push(wordsToLine(row.words, minX, charW))
  })
  return lines.join('\n')
}

/** Дуже великі знімки уповільнюють розпізнавання без користі для якості */
async function downscale(file: File, maxSide = 2400): Promise<Blob | File> {
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  if (scale === 1) return file

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), 'image/png'),
  )
}

export async function readImage(
  file: File,
  onProgress?: (p: OcrProgress) => void,
): Promise<string> {
  onProgress?.({ stage: 'Готую зображення', percent: 5 })
  const source = await downscale(file)

  const { createWorker } = await import('tesseract.js')
  onProgress?.({ stage: 'Завантажую розпізнавач', percent: 15 })

  // Російська обов'язково: без неї модель не знає ы, ъ, э і плутає їх
  const worker = await createWorker(['ukr', 'rus', 'eng'], 1, {
    logger: (m: { status?: string; progress?: number }) => {
      if (m.status === 'recognizing text') {
        onProgress?.({ stage: 'Розпізнаю текст', percent: 30 + (m.progress ?? 0) * 65 })
      }
    },
  })

  try {
    const result = await worker.recognize(source, {}, { blocks: true })
    const words = collectWords(result.data as never)

    onProgress?.({ stage: 'Уточнюю акорди', percent: 80 })

    // Другий прохід: одиночні латинські літери (F, G, B) розпізнаються погано,
    // бо словник налаштований на текст пісні. Тому проходимо ще раз, дозволивши
    // лише символи, з яких складаються акорди — і беремо звідти рядки акордів.
    let chordWords: Word[] = []
    try {
      await worker.reinitialize('eng')
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGH#bmajsuindg0123456789/°+',
      })
      const pass2 = await worker.recognize(source, {}, { blocks: true })
      // Одиночні літери акордів завжди мають низьку впевненість — тут поріг
      // тільки нашкодив би, бо набір символів і так обмежений
      chordWords = collectWords(pass2.data as never, 0)
    } catch {
      // якщо не вийшло — лишаємось із результатом першого проходу
    }

    onProgress?.({ stage: 'Відновлюю розкладку', percent: 97 })
    return layoutWords(words, chordWords)
  } finally {
    await worker.terminate()
  }
}
