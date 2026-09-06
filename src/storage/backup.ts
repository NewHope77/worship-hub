import type { AppData } from '../types'

/**
 * Перенесення бази між пристроями й адресами.
 * Браузер тримає дані окремо для кожного сайту, тож пісні з локального
 * сервера не видно на опублікованій адресі — файл це й вирішує.
 * Заодно це резервна копія.
 */

interface Backup {
  format: 'worship-hub'
  version: 1
  exportedAt: string
  data: AppData
}

export function downloadBackup(data: AppData): void {
  const payload: Backup = {
    format: 'worship-hub',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `worship-hub-${new Date().toISOString().slice(0, 10)}.json`
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function readBackup(file: File): Promise<AppData> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Це не файл бази — всередині не JSON.')
  }

  const backup = parsed as Partial<Backup>
  if (backup.format !== 'worship-hub' || !backup.data) {
    throw new Error('Файл не схожий на базу Worship Hub.')
  }

  const d = backup.data
  return {
    members: d.members ?? [],
    songs: d.songs ?? [],
    setlists: d.setlists ?? [],
    personal: d.personal ?? [],
    prefs: d.prefs ?? {},
  }
}

/** Додає з файлу лише те, чого ще немає — наявне лишається недоторканим */
export function mergeBackup(current: AppData, incoming: AppData): { data: AppData; added: number } {
  const haveSongs = new Set(current.songs.map((s) => s.id))
  const newSongs = incoming.songs.filter((s) => !haveSongs.has(s.id))

  const haveSets = new Set(current.setlists.map((s) => s.id))
  const newSets = incoming.setlists.filter((s) => !haveSets.has(s.id))

  const haveMembers = new Set(current.members.map((m) => m.id))
  const newMembers = incoming.members.filter((m) => !haveMembers.has(m.id))

  return {
    data: {
      ...current,
      songs: [...current.songs, ...newSongs],
      setlists: [...current.setlists, ...newSets],
      members: [...current.members, ...newMembers],
    },
    added: newSongs.length,
  }
}
