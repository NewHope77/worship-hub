import { DICT, LANGS } from './dict'
import type { Key, Lang } from './dict'

export type { Key, Lang } from './dict'
export { LANGS } from './dict'

/** Мова, якою користувач бачить кнопки й налаштування */
export function translator(lang: Lang) {
  const table = DICT[lang] ?? DICT.uk
  return (key: Key): string => table[key] ?? DICT.uk[key] ?? key
}

const LANG_KEY = 'worship-hub:lang'

/**
 * Мова, обрана до входу. Учасника ще немає, тож зберегти її в його
 * налаштуваннях ніде — тримаємо окремо на пристрої.
 */
export function readStoredLang(): Lang | null {
  const saved = localStorage.getItem(LANG_KEY)
  return LANGS.some((l) => l.id === saved) ? (saved as Lang) : null
}

export function saveStoredLang(lang: Lang): void {
  localStorage.setItem(LANG_KEY, lang)
}

/** Перший запуск — беремо мову телефона, якщо вона нам відома */
export function detectLang(): Lang {
  const stored = readStoredLang()
  if (stored) return stored
  const known = new Set(LANGS.map((l) => l.id))
  for (const raw of navigator.languages ?? [navigator.language]) {
    const code = raw.slice(0, 2).toLowerCase() as Lang
    if (known.has(code)) return code
  }
  return 'uk'
}
