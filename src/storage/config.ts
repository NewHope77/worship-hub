/**
 * Дані підключення до спільної бази живуть на пристрої, а не в коді:
 * застосунок відкритий, і ключ у репозиторії міг би прочитати будь-хто.
 */
const KEY = 'worship-hub:cloud'

export interface CloudConfig {
  url: string
  anonKey: string
}

export function readCloudConfig(): CloudConfig | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CloudConfig>
    if (!parsed.url || !parsed.anonKey) return null
    return { url: parsed.url, anonKey: parsed.anonKey }
  } catch {
    return null
  }
}

export function saveCloudConfig(config: CloudConfig): void {
  localStorage.setItem(KEY, JSON.stringify(config))
}

export function clearCloudConfig(): void {
  localStorage.removeItem(KEY)
}
