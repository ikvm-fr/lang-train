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

export interface SavedProjectInfo {
  key: string
  name: string
  size: number
  regions: number
  savedAt: string
  bytes: number // approximate size of the stored data
}

// All autosaved projects, newest first.
export async function listSavedProjects(): Promise<SavedProjectInfo[]> {
  const [keys, values] = await Promise.all([
    tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys()),
    tx<unknown[]>('readonly', (s) => s.getAll()),
  ])
  const out: SavedProjectInfo[] = []
  keys.forEach((key, i) => {
    if (typeof key !== 'string' || !key.startsWith('project:')) return
    const v = values[i] as Partial<ProjectFile> | undefined
    out.push({
      key,
      name: v?.audio?.name ?? '?',
      size: v?.audio?.size ?? 0,
      regions: Array.isArray(v?.regions) ? v.regions.length : 0,
      savedAt: typeof v?.savedAt === 'string' ? v.savedAt : '',
      bytes: JSON.stringify(v ?? null).length,
    })
  })
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export async function deleteSavedProject(key: string): Promise<void> {
  const last = await tx<string | undefined>('readonly', (s) => s.get(LAST))
  await tx('readwrite', (s) => s.delete(key))
  if (last === key) await tx('readwrite', (s) => s.delete(LAST))
}

export async function clearSavedProjects(): Promise<void> {
  await tx('readwrite', (s) => s.clear())
}

export const savedProjectKey = keyOf
