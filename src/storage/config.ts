export interface CloudConfig {
  url: string
  anonKey: string
}

/**
 * Спільна база групи. Адреса й ключ підставляються під час збірки зі
 * змінних оточення (.env.local), щоб не лежати в репозиторії у відкритому
 * вигляді.
 *
 * Тут використовується publishable-ключ Supabase — саме той, що призначений
 * для коду в браузері. Секретний ключ у застосунок не потрапляє ніколи.
 *
 * Зворотний бік такої простоти: хто має посилання на застосунок, той має
 * доступ до бази — як до документа, відкритого за посиланням. Для групи
 * прославлення це прийнятно; для чогось чутливішого потрібен був би вхід
 * за обліковим записом.
 */
const GROUP_CLOUD: CloudConfig | null = (() => {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_KEY
  return url && anonKey ? { url, anonKey } : null
})()

const KEY = 'worship-hub:cloud'

export function readCloudConfig(): CloudConfig | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CloudConfig & { detached?: boolean }>
      // Хтось свідомо відключив спільну базу — працюємо лише на цьому пристрої
      if (parsed.detached) return null
      if (parsed.url && parsed.anonKey) return { url: parsed.url, anonKey: parsed.anonKey }
    }
  } catch {
    /* зіпсовані налаштування — повертаємось до спільної бази */
  }
  return GROUP_CLOUD
}

/** Чи застосунок працює зі спільною базою групи, а не з чиєюсь власною */
export function isGroupCloud(config: CloudConfig | null): boolean {
  return !!GROUP_CLOUD && config?.url === GROUP_CLOUD.url
}

/** Чи спільна база взагалі вшита в цю збірку */
export function hasGroupCloud(): boolean {
  return GROUP_CLOUD !== null
}

export function saveCloudConfig(config: CloudConfig): void {
  localStorage.setItem(KEY, JSON.stringify(config))
}

/** Повернутись до спільної бази групи */
export function clearCloudConfig(): void {
  localStorage.removeItem(KEY)
}

/** Працювати лише на цьому пристрої, не чіпаючи спільну базу */
export function detachCloud(): void {
  localStorage.setItem(KEY, JSON.stringify({ detached: true }))
}
