import type { AppData } from '../types'

/**
 * Єдина точка доступу до даних. Зараз реалізація локальна (localStorage).
 * Для синхронізації між учасниками достатньо підставити Supabase-адаптер
 * з тим самим інтерфейсом — решта застосунку не змінюється.
 */
export interface StorageAdapter {
  load(): Promise<AppData>
  save(data: AppData): Promise<void>
  /** Підписка на зміни ззовні (інша вкладка / інший пристрій) */
  subscribe(cb: (data: AppData) => void): () => void
}
