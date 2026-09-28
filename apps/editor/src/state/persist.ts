import { parseProjectFile, type ProjectFile } from './projectFile'
import type { AudioInfo } from './store'

// Autosave in IndexedDB (the audio itself is not stored). One project per recording,
// keyed by file name + size, plus a pointer to the most recently saved one.

const DB = 'lang-train-editor'
const STORE = 'kv'
const LAST = 'last-project-key'
const keyOf = (a: Pick<AudioInfo, 'name' | 'size'>) => `project:${a.name}:${a.size}`

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result as T)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

// The project saved for this recording, or the most recent one if no recording is given.
export async function loadSavedProject(audio?: Pick<AudioInfo, 'name' | 'size'>): Promise<ProjectFile | null> {
  try {
    const key = audio ? keyOf(audio) : await tx<string | undefined>('readonly', (s) => s.get(LAST))
    if (!key) return null
    const raw = await tx<unknown>('readonly', (s) => s.get(key))
    return raw ? parseProjectFile(raw) : null
  } catch {
    return null
  }
}

export async function saveProject(p: ProjectFile): Promise<void> {
  await tx('readwrite', (s) => s.put(p, keyOf(p.audio)))
  await tx('readwrite', (s) => s.put(keyOf(p.audio), LAST))
}
