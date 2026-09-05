/**
 * Імпорт пісень із файлів. Найважче — PDF: там немає «рядків із пробілами»,
 * кожен фрагмент тексту розставлений координатами. Щоб акорди залишились
 * рівно над своїми складами, колонки доводиться відновлювати з геометрії.
 */

export type ImportKind = 'txt' | 'pdf' | 'docx'

export interface ImportedFile {
  /** Готовий текст, який далі йде у splitIntoSections */
  text: string
  /** Назва, вгадана з імені файлу */
  title: string
  kind: ImportKind
  pages: number
}

const TEXT_EXT = ['txt', 'text', 'chopro', 'cho', 'crd', 'pro', 'onsong', 'md', 'chordpro']

export function extOf(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim())
  return m ? m[1].toLowerCase() : ''
}

export function titleFromFileName(name: string): string {
  return name
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Чи вміємо ми читати такий файл */
export function isSupported(name: string): boolean {
  const e = extOf(name)
  return e === 'pdf' || e === 'docx' || TEXT_EXT.includes(e)
}

/* ── PDF ──────────────────────────────────────────────────────────── */

interface Frag {
  x: number
  y: number
  str: string
  w: number
  /** Кегль шрифту — потрібен, щоб не міряти сторінку заголовками */
  size: number
}

interface Column { min: number; max: number }

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/** Найпоширеніший кегль — це кегль основного тексту пісні */
function mainFontSize(frags: Frag[]): number {
  const tally = new Map<number, number>()
  for (const f of frags) {
    const k = Math.round(f.size)
    tally.set(k, (tally.get(k) ?? 0) + f.str.length)
  }
  let best = 0
  let bestCount = -1
  for (const [size, count] of tally) if (count > bestCount) { best = size; bestCount = count }
  return best
}

/**
 * Шукає колонки: вертикальні смуги, крізь які не проходить жоден фрагмент
 * основного тексту. Чарти часто верстають у дві колонки, і без цього кроку
 * рядок лівої колонки зшивається з рядком правої.
 */
function detectColumns(frags: Frag[], bodySize: number): Column[] {
  const MIN_GAP = 22
  // Дивимось лише на основний текст: рядок копірайту внизу сторінки набраний
  // дрібним кеглем на всю ширину і сам по собі зшиває колонки в одну смугу.
  const body = frags.filter((f) => f.str.trim() && Math.abs(f.size - bodySize) <= bodySize * 0.25)
  if (body.length < 8) return []

  const spans = body.map((f) => [f.x, f.x + f.w] as [number, number]).sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const span of spans) {
    const last = merged[merged.length - 1]
    if (last && span[0] <= last[1] + 1) last[1] = Math.max(last[1], span[1])
    else merged.push([...span])
  }

  const cols: Column[] = []
  let start = merged[0][0]
  for (let i = 1; i < merged.length; i++) {
    if (merged[i][0] - merged[i - 1][1] >= MIN_GAP) {
      cols.push({ min: start, max: merged[i - 1][1] })
      start = merged[i][0]
    }
  }
  cols.push({ min: start, max: merged[merged.length - 1][1] })

  // Колонка має бути змістовною, інакше це просто відступ усередині рядка
  const enough = cols.filter(
    (c) => body.filter((f) => f.x + f.w / 2 >= c.min && f.x + f.w / 2 <= c.max).length >= body.length * 0.15,
  )
  return enough.length >= 2 && enough.length <= 3 ? enough : []
}

/** Складає рядок, повертаючи кожен фрагмент у його колонку */
function fragsToLine(frags: Frag[], minX: number, charW: number): string {
  let out = ''
  for (const f of [...frags].sort((a, b) => a.x - b.x)) {
    const col = Math.max(0, Math.round((f.x - minX) / charW))
    if (col > out.length) out = out.padEnd(col, ' ')
    else if (out.length && !/\s$/.test(out) && !/^\s/.test(f.str)) out += ' '
    out += f.str
  }
  return out.replace(/\s+$/, '')
}

/** Один стовпець тексту: групуємо фрагменти в рядки за висотою */
function columnToLines(frags: Frag[], bodySize: number): string[] {
  if (frags.length === 0) return []

  // Шкалу міряємо по основному тексту, інакше заголовок спотворює колонки
  const scaleFrags = frags.filter(
    (f) => f.str.trim().length > 1 && Math.abs(f.size - bodySize) <= 1.5,
  )
  const charW =
    median((scaleFrags.length ? scaleFrags : frags)
      .filter((f) => f.str.trim().length > 1)
      .map((f) => f.w / f.str.length)
      .filter((w) => w > 0.5)) || bodySize * 0.5

  const minX = Math.min(...frags.map((f) => f.x))
  // Чарти верстають щільно: рядок акордів буває всього за 4-5pt над текстом,
  // тож допуск має бути помітно меншим, інакше два рядки зіллються в один.
  const tolerance = Math.max(1.5, bodySize * 0.22)

  const rows: { y: number; frags: Frag[] }[] = []
  for (const f of [...frags].sort((a, b) => b.y - a.y)) {
    const row = rows.find((r) => Math.abs(r.y - f.y) <= tolerance)
    if (row) row.frags.push(f)
    else rows.push({ y: f.y, frags: [f] })
  }

  const gaps = rows.slice(1).map((r, i) => rows[i].y - r.y).filter((g) => g > 0)
  const lineH = median(gaps) || bodySize * 1.2

  const lines: string[] = []
  rows.forEach((row, i) => {
    if (i > 0 && rows[i - 1].y - row.y > lineH * 1.6) lines.push('')
    lines.push(fragsToLine(row.frags, minX, charW))
  })
  return lines
}

async function readPdf(file: File): Promise<{ text: string; pages: number; title: string }> {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const data = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data }).promise
  const pageTexts: string[] = []
  let title = ''

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const content = await page.getTextContent()

    const frags: Frag[] = []
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue
      const tr = item.transform as number[]
      frags.push({
        x: tr[4], y: tr[5], str: item.str, w: item.width,
        size: Math.hypot(tr[0], tr[1]) || 10,
      })
    }
    if (frags.length === 0) continue

    const bodySize = mainFontSize(frags) || 10

    // Найбільший напис угорі першої сторінки — назва пісні
    if (n === 1) {
      const top = Math.max(...frags.map((f) => f.y))
      const biggest = frags
        .filter((f) => f.str.trim().length > 2 && top - f.y < 80)
        .sort((a, b) => b.size - a.size)[0]
      if (biggest && biggest.size > bodySize * 1.4) title = biggest.str.trim()
    }

    // Копірайт/футер: дрібний кегль, довгий рядок, унизу сторінки
    const bottom = Math.min(...frags.map((f) => f.y))
    const clean = frags.filter(
      (f) => !(f.size < bodySize * 0.8 && f.str.length > 60 && f.y - bottom < 40),
    )

    const columns = detectColumns(clean, bodySize)
    if (columns.length === 0) {
      pageTexts.push(columnToLines(clean, bodySize).join('\n'))
    } else {
      // Кожну колонку читаємо цілком, зверху вниз, і лише потім переходимо далі
      const blocks = columns.map((c) =>
        columnToLines(
          clean.filter((f) => {
            const center = f.x + f.w / 2
            return center >= c.min - 1 && center <= c.max + 1
          }),
          bodySize,
        ).join('\n'),
      )
      pageTexts.push(blocks.filter((b) => b.trim()).join('\n\n'))
    }
  }

  return { text: pageTexts.join('\n\n'), pages: doc.numPages, title }
}

/* ── DOCX ─────────────────────────────────────────────────────────── */

/**
 * .docx — це zip, усередині якого word/document.xml. Розбираємо його напряму:
 * готові конвертери схлопують пробіли або склеюють параграфи, а для пісні
 * саме пробіли тримають акорд над потрібним складом (у Word вони збережені
 * завдяки xml:space="preserve").
 */
async function readDocx(file: File): Promise<string> {
  const { unzipSync } = await import('fflate')
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const entry = zip['word/document.xml']
  if (!entry) throw new Error('Це не схоже на документ Word — усередині немає word/document.xml.')

  const xml = new TextDecoder('utf-8').decode(entry)
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Не вдалося прочитати вміст документа.')

  const paragraphs = doc.getElementsByTagName('w:p')
  const lines: string[] = []

  for (let i = 0; i < paragraphs.length; i++) {
    let line = ''
    const walker = document.createTreeWalker(paragraphs[i], NodeFilter.SHOW_ELEMENT)
    let node = walker.currentNode as Element | null
    while (node) {
      switch (node.nodeName) {
        case 'w:t':   line += node.textContent ?? ''; break
        case 'w:tab': line += '    '; break
        case 'w:br':  line += '\n'; break
      }
      node = walker.nextNode() as Element | null
    }
    // Параграф = рядок пісні; порожній параграф лишається порожнім рядком
    lines.push(...line.split('\n'))
  }

  return lines.join('\n')
}

/* ── Точка входу ──────────────────────────────────────────────────── */

export async function readSongFile(file: File): Promise<ImportedFile> {
  const ext = extOf(file.name)
  const title = titleFromFileName(file.name)

  if (ext === 'pdf') {
    const { text, pages, title: pdfTitle } = await readPdf(file)
    if (!text.trim()) {
      throw new Error(
        'У цьому PDF немає текстового шару — схоже, це скан або фото сторінки. ' +
        'Такий файл доведеться набрати вручну.',
      )
    }
    return { text, title: pdfTitle || title, kind: 'pdf', pages }
  }

  if (ext === 'docx') {
    const text = await readDocx(file)
    if (!text.trim()) throw new Error('Документ порожній або не містить тексту.')
    return { text, title, kind: 'docx', pages: 1 }
  }

  if (TEXT_EXT.includes(ext) || file.type.startsWith('text/')) {
    const text = await file.text()
    return { text, title, kind: 'txt', pages: 1 }
  }

  if (ext === 'doc') {
    throw new Error('Старий формат .doc не підтримується — пересохрани як .docx або .txt.')
  }
  if (['png', 'jpg', 'jpeg', 'heic', 'webp'].includes(ext)) {
    throw new Error(
      'Це зображення. Розпізнавання з фото ненадійне саме для акордів — ' +
      'вони «поїдуть» відносно складів. Краще скопіювати текст.',
    )
  }
  throw new Error(`Формат .${ext || '?'} не підтримується. Підійдуть PDF, DOCX або TXT.`)
}
