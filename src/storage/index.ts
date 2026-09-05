import type { AppData } from '../types'
import { localAdapter } from './local'
import { createSupabaseAdapter } from './supabase'
import { readCloudConfig } from './config'
import type { StorageAdapter } from './adapter'

export type { StorageAdapter } from './adapter'
export { readCloudConfig, saveCloudConfig, clearCloudConfig } from './config'
export type { CloudConfig } from './config'

/** Підключена спільна база — працюємо з нею, інакше з пристроєм */
export function getStorage(): StorageAdapter {
  const cloud = readCloudConfig()
  return cloud ? createSupabaseAdapter(cloud) : localAdapter
}

export const storage = getStorage()

export function isCloudConnected(): boolean {
  return readCloudConfig() !== null
}

/** Що зараз лежить на цьому пристрої — щоб було що переносити в спільну базу */
export async function readLocalData(): Promise<AppData> {
  return localAdapter.load()
}
