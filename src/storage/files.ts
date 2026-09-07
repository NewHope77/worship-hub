/**
 * Сховище оригінальних файлів пісень — PDF, документів, знімків.
 *
 * Тримаємо їх в IndexedDB, а не в localStorage: там ліміт у кілька мегабайт,
 * а один сканований PDF легко його переповнює.
 */

const DB_NAME = 'worship-hub-files'
const STORE = 'files'

export interface StoredFile {
  songId: string
  name: string
  type: string
  size: number
  blob: Blob
  savedAt: number
}

/** Опис файлу без самого вмісту — це зберігається разом з піснею */
export interface FileInfo {
  name: string
  type: string
  size: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'songId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }),
  )
}

export async function saveSongFile(songId: string, file: File): Promise<FileInfo> {
  const record: StoredFile = {
    songId,
    name: file.name,
    type: file.type || guessType(file.name),
    size: file.size,
    blob: file,
    savedAt: Date.now(),
  }
  await tx('readwrite', (store) => store.put(record))
  return { name: record.name, type: record.type, size: record.size }
}

export async function readSongFile(songId: string): Promise<StoredFile | null> {
  try {
    const found = await tx<StoredFile | undefined>('readonly', (store) => store.get(songId))
    return found ?? null
  } catch {
    return null
  }
}

export async function deleteSongFile(songId: string): Promise<void> {
  try {
    await tx('readwrite', (store) => store.delete(songId))
  } catch {
    /* файлу не було — нічого страшного */
  }
}

/** Браузер інколи не проставляє тип — визначаємо за розширенням */
function guessType(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') return 'application/pdf'
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return 'application/octet-stream'
}

export function isViewableInBrowser(type: string): boolean {
  return type === 'application/pdf' || type.startsWith('image/')
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}
