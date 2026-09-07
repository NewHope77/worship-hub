/**
 * Показ Word-документа всередині застосунку.
 *
 * Браузер не вміє малювати .docx, але сам файл — це zip із розміткою, яку
 * можна прочитати. Тут вона перетворюється на звичайні абзаци зі збереженим
 * оформленням: накреслення, розмір, вирівнювання, порожні рядки.
 */

export interface DocxBlock {
  text: string
  bold: boolean
  italic: boolean
  underline: boolean
  align: 'left' | 'center' | 'right' | 'justify'
  /** Кегль у пунктах, якщо документ його задає */
  size: number | null
  /** Гарнітура з документа: у піснях це зазвичай моноширинний шрифт */
  font: string | null
  heading: boolean
}

function attr(el: Element | null, name: string): string | null {
  if (!el) return null
  for (const a of Array.from(el.attributes)) {
    if (a.name === name || a.name.endsWith(`:${name}`)) return a.value
  }
  return null
}

function firstTag(parent: Element, tag: string): Element | null {
  return parent.getElementsByTagName(tag).item(0)
}

/** Прапорець у Word увімкнений, якщо тег є і не має val="0" */
function isOn(parent: Element | null, tag: string): boolean {
  if (!parent) return false
  const el = firstTag(parent, tag)
  if (!el) return false
  const val = attr(el, 'val')
  return val !== '0' && val !== 'false'
}

/**
 * Типові шрифт і кегль документа. Word задає їх один раз у styles.xml,
 * а в абзацах здебільшого не повторює — без цього все малювалося б
 * розміром браузера за замовчуванням, тобто помітно більшим за оригінал.
 */
function readDefaults(zip: Record<string, Uint8Array>): { font: string | null; size: number | null } {
  const styles = zip['word/styles.xml']
  if (!styles) return { font: null, size: null }
  try {
    const doc = new DOMParser().parseFromString(new TextDecoder().decode(styles), 'application/xml')
    const rPr = doc.getElementsByTagName('w:rPrDefault').item(0)
    if (!rPr) return { font: null, size: null }
    const size = attr(firstTag(rPr, 'w:sz'), 'val')
    return {
      font: attr(firstTag(rPr, 'w:rFonts'), 'ascii'),
      size: size ? Number(size) / 2 : null,
    }
  } catch {
    return { font: null, size: null }
  }
}

export async function renderDocx(blob: Blob): Promise<DocxBlock[]> {
  const { unzipSync } = await import('fflate')
  const zip = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  const entry = zip['word/document.xml']
  if (!entry) throw new Error('Це не документ Word — усередині немає word/document.xml.')

  const defaults = readDefaults(zip as unknown as Record<string, Uint8Array>)

  const xml = new TextDecoder('utf-8').decode(entry)
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Не вдалося прочитати вміст документа.')

  const paragraphs = Array.from(doc.getElementsByTagName('w:p'))
  const blocks: DocxBlock[] = []

  for (const p of paragraphs) {
    const props = firstTag(p, 'w:pPr')
    const style = attr(firstTag(props ?? p, 'w:pStyle'), 'val') ?? ''
    const alignRaw = attr(firstTag(props ?? p, 'w:jc'), 'val') ?? 'left'
    const align = (['left', 'center', 'right', 'justify'] as const)
      .find((a) => a === alignRaw) ?? 'left'

    // Оформлення беремо з першого фрагмента: у піснях весь абзац однаковий
    const firstRunProps = firstTag(p, 'w:rPr')
    const sizeHalfPoints = attr(firstTag(firstRunProps ?? p, 'w:sz'), 'val')
    const fontName = attr(firstTag(firstRunProps ?? p, 'w:rFonts'), 'ascii')

    let text = ''
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_ELEMENT)
    let node = walker.currentNode as Element | null
    while (node) {
      if (node.nodeName === 'w:t') text += node.textContent ?? ''
      else if (node.nodeName === 'w:tab') text += '    '
      else if (node.nodeName === 'w:br') text += '\n'
      node = walker.nextNode() as Element | null
    }

    blocks.push({
      text,
      bold: isOn(firstRunProps, 'w:b'),
      italic: isOn(firstRunProps, 'w:i'),
      underline: isOn(firstRunProps, 'w:u'),
      align,
      size: sizeHalfPoints ? Number(sizeHalfPoints) / 2 : defaults.size,
      font: fontName ?? defaults.font,
      heading: /^Heading|^Заголовок/i.test(style),
    })
  }

  return blocks
}
