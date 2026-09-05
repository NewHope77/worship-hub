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

interface Frag { x: number; y: number; str: string; w: number }

/**
 * Складає рядок тексту з фрагментів, розставляючи їх по колонках так само,
 * як вони стояли на сторінці. `charW` — ширина одного символу.
 */
function fragsToLine(frags: Frag[], minX: number, charW: number): string {
  let out = ''
  for (const f of frags.sort((a, b) => a.x - b.x)) {
    const col = Math.max(0, Math.round((f.x - minX) / charW))
    if (col > out.length) out = out.padEnd(col, ' ')
    else if (out.length && !/\s$/.test(out) && !/^\s/.test(f.str)) out += ' '
    out += f.str
  }
  return out.replace(/\s+$/, '')
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

async function readPdf(file: File): Promise<{ text: string; pages: number }> {
  const pdfjs = await import('pdfjs-dist')
  // Воркер вантажимо як окремий файл — Vite сам покладе його поруч у збірці
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const data = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data }).promise
  const pageTexts: string[] = []

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const content = await page.getTextContent()

    const frags: Frag[] = []
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue
      const tr = item.transform as number[]
      frags.push({ x: tr[4], y: tr[5], str: item.str, w: item.width })
    }
    if (frags.length === 0) continue

    // Ширина символу: беремо медіану по фрагментах — стійко до заголовків
    const widths = frags
      .filter((f) => f.str.trim().length > 1)
      .map((f) => f.w / f.str.length)
      .filter((w) => w > 0.5)
    const charW = median(widths) || 6
    const minX = Math.min(...frags.map((f) => f.x))

    // Групуємо в рядки за координатою Y (з допуском на дрібні зсуви)
    const tolerance = Math.max(2, charW * 0.6)
    const rows = new Map<number, Frag[]>()
    for (const f of frags) {
      let key = [...rows.keys()].find((k) => Math.abs(k - f.y) <= tolerance)
      if (key === undefined) { key = f.y; rows.set(key, []) }
      rows.get(key)!.push(f)
    }

    // У PDF вісь Y росте вгору — тому згори вниз це спадання
    const ordered = [...rows.entries()].sort((a, b) => b[0] - a[0])
    const gaps = ordered.slice(1).map(([y], i) => Math.abs(ordered[i][0] - y)).filter((g) => g > 0)
    const lineH = median(gaps) || charW * 2

    const lines: string[] = []
    ordered.forEach(([y, rowFrags], i) => {
      if (i > 0) {
        // Помітно більший міжрядковий проміжок — це порожній рядок між секціями
        const gap = Math.abs(ordered[i - 1][0] - y)
        if (gap > lineH * 1.6) lines.push('')
      }
      lines.push(fragsToLine(rowFrags, minX, charW))
    })

    pageTexts.push(lines.join('\n'))
  }

  return { text: pageTexts.join('\n\n'), pages: doc.numPages }
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
    const { text, pages } = await readPdf(file)
    if (!text.trim()) {
      throw new Error(
        'У цьому PDF немає текстового шару — схоже, це скан або фото сторінки. ' +
        'Такий файл доведеться набрати вручну.',
      )
    }
    return { text, title, kind: 'pdf', pages }
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
