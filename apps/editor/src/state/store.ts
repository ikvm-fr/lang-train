import { DEFAULT_FIELDS, type FieldDef } from '@lang-train/pack'
import { useSyncExternalStore } from 'react'
import type { ProjectFile } from './projectFile'

// Project state. The store is the source of truth; the waveform mirrors it.

export interface Region {
  id: string
  start: number
  end: number
  values: Record<string, string>
}

export interface AudioInfo {
  name: string
  size: number
  duration: number
}

export interface ProjectState {
  packId: string
  audio: AudioInfo | null
  fields: FieldDef[]
  regions: Region[] // sorted by start, non-overlapping
  nextId: number
  selectedId: string | null
}

type Snapshot = Pick<ProjectState, 'fields' | 'regions' | 'nextId' | 'selectedId'>

export const MIN_REGION = 0.1 // seconds
const HISTORY_LIMIT = 100
const FIELDS_KEY = 'lte:last-fields'

function loadLastFields(): FieldDef[] {
  try {
    const raw = localStorage.getItem(FIELDS_KEY)
    if (raw) return JSON.parse(raw) as FieldDef[]
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_FIELDS.map((f) => ({ ...f }))
}

const sortRegions = (rs: Region[]) => [...rs].sort((a, b) => a.start - b.start)

export class ProjectStore {
  private state: ProjectState
  private past: Snapshot[] = []
  private future: Snapshot[] = []
  private listeners = new Set<() => void>()

  constructor() {
    this.state = ProjectStore.empty()
  }

  static empty(): ProjectState {
    return {
      packId: crypto.randomUUID(),
      audio: null,
      fields: loadLastFields(),
      regions: [],
      nextId: 1,
      selectedId: null,
    }
  }

  getState = () => this.state

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private set(patch: Partial<ProjectState>, history = false) {
    if (history) {
      this.past = [...this.past.slice(-HISTORY_LIMIT + 1), this.snapshot()]
      this.future = []
    }
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((fn) => fn())
  }

  // ----- project -----

  newProject(audio: AudioInfo) {
    this.past = []
    this.future = []
    this.state = { ...ProjectStore.empty(), audio }
    this.listeners.forEach((fn) => fn())
  }

  loadProject(p: ProjectFile) {
    this.past = []
    this.future = []
    this.state = {
      packId: p.packId,
      audio: p.audio,
      fields: p.fields,
      regions: p.regions,
      nextId: p.nextId,
      selectedId: null,
    }
    this.listeners.forEach((fn) => fn())
  }

  // ----- selection -----

  select(id: string | null) {
    if (id !== this.state.selectedId) this.set({ selectedId: id })
  }

  selected(): Region | undefined {
    return this.state.regions.find((r) => r.id === this.state.selectedId)
  }

  selectRelative(step: number) {
    const { regions } = this.state
    if (!regions.length) return
    const i = regions.findIndex((r) => r.id === this.state.selectedId)
    const next = i < 0 ? (step > 0 ? 0 : regions.length - 1) : Math.max(0, Math.min(regions.length - 1, i + step))
    this.select(regions[next].id)
  }

  // ----- regions -----

  private newId(nextId: number) {
    return `p${String(nextId).padStart(4, '0')}`
  }

  // Free space around time t, bounded by neighbouring regions (ignoring `exceptId`).
  private bounds(t: number, exceptId?: string): [number, number] {
    let lo = 0
    let hi = this.state.audio?.duration ?? Infinity
    for (const r of this.state.regions) {
      if (r.id === exceptId) continue
      if (r.end <= t) lo = Math.max(lo, r.end)
      else if (r.start >= t) hi = Math.min(hi, r.start)
      else return [t, t] // t is inside another region
    }
    return [lo, hi]
  }

  // Adds a region, clamped to the free space around its start. Returns its id, or null if there is no room.
  addRegion(start: number, end: number): string | null {
    if (end < start) [start, end] = [end, start]
    const [lo, hi] = this.bounds(start + 1e-6)
    start = Math.max(start, lo)
    end = Math.min(end, hi)
    if (end - start < MIN_REGION) return null
    const id = this.newId(this.state.nextId)
    const region: Region = { id, start, end, values: {} }
    this.set({ regions: sortRegions([...this.state.regions, region]), nextId: this.state.nextId + 1, selectedId: id }, true)
    return id
  }

  // Adds several regions as one undo step. Regions overlapping existing ones (or each other) are skipped.
  addRegions(list: { start: number; end: number; values?: Record<string, string> }[]): { added: number; skipped: number } {
    const duration = this.state.audio?.duration ?? Infinity
    const regions = [...this.state.regions]
    let nextId = this.state.nextId
    let skipped = 0
    for (const item of [...list].sort((a, b) => a.start - b.start)) {
      const start = Math.max(0, item.start)
      const end = Math.min(duration, item.end)
      if (end - start < MIN_REGION || regions.some((r) => r.start < end && r.end > start)) {
        skipped++
        continue
      }
      regions.push({ id: this.newId(nextId++), start, end, values: { ...item.values } })
    }
    const added = regions.length - this.state.regions.length
    if (added) this.set({ regions: sortRegions(regions), nextId }, true)
    return { added, skipped }
  }

  // Moves region boundaries, clamped to neighbours and minimum length.
  setBounds(id: string, start: number, end: number, history = true) {
    const r = this.state.regions.find((x) => x.id === id)
    if (!r) return
    const [lo, hi] = this.bounds((r.start + r.end) / 2, id)
    start = Math.max(lo, Math.min(start, end - MIN_REGION))
    end = Math.min(hi, Math.max(end, start + MIN_REGION))
    if (start === r.start && end === r.end) return
    this.set({ regions: this.state.regions.map((x) => (x.id === id ? { ...x, start, end } : x)) }, history)
  }

  nudge(id: string, edge: 'start' | 'end', delta: number) {
    const r = this.state.regions.find((x) => x.id === id)
    if (!r) return
    if (edge === 'start') this.setBounds(id, r.start + delta, r.end)
    else this.setBounds(id, r.start, r.end + delta)
  }

  setValue(id: string, key: string, value: string) {
    this.set({
      regions: this.state.regions.map((r) => (r.id === id ? { ...r, values: { ...r.values, [key]: value } } : r)),
    })
  }

  remove(id: string) {
    const { regions } = this.state
    const i = regions.findIndex((r) => r.id === id)
    if (i < 0) return
    const rest = regions.filter((r) => r.id !== id)
    const sel = rest[Math.min(i, rest.length - 1)]?.id ?? null
    this.set({ regions: rest, selectedId: sel }, true)
  }

  // Splits at time t; the first part keeps the texts, the second part is new and empty.
  split(id: string, t: number): boolean {
    const r = this.state.regions.find((x) => x.id === id)
    if (!r || t - r.start < MIN_REGION || r.end - t < MIN_REGION) return false
    const newId = this.newId(this.state.nextId)
    const regions = this.state.regions.flatMap((x) =>
      x.id === id ? [{ ...x, end: t }, { id: newId, start: t, end: x.end, values: {} }] : [x],
    )
    this.set({ regions, nextId: this.state.nextId + 1, selectedId: newId }, true)
    return true
  }

  // Merges with the next region; texts are joined with a space.
  mergeWithNext(id: string): boolean {
    const { regions } = this.state
    const i = regions.findIndex((r) => r.id === id)
    if (i < 0 || i === regions.length - 1) return false
    const a = regions[i]
    const b = regions[i + 1]
    const keys = new Set([...Object.keys(a.values), ...Object.keys(b.values)])
    const values: Record<string, string> = {}
    for (const k of keys) values[k] = [a.values[k], b.values[k]].filter((v) => v?.trim()).join(' ')
    const merged: Region = { id: a.id, start: a.start, end: b.end, values }
    this.set({ regions: [...regions.slice(0, i), merged, ...regions.slice(i + 2)], selectedId: a.id }, true)
    return true
  }

  // ----- fields -----

  setFields(fields: FieldDef[]) {
    this.set({ fields }, true)
    try {
      localStorage.setItem(FIELDS_KEY, JSON.stringify(fields))
    } catch {
      /* storage unavailable */
    }
  }

  // ----- history -----

  canUndo = () => this.past.length > 0
  canRedo = () => this.future.length > 0

  private snapshot(): Snapshot {
    const { fields, regions, nextId, selectedId } = this.state
    return { fields, regions, nextId, selectedId }
  }

  undo() {
    const prev = this.past.at(-1)
    if (!prev) return
    this.past = this.past.slice(0, -1)
    this.future = [...this.future, this.snapshot()]
    this.restore(prev)
  }

  redo() {
    const next = this.future.at(-1)
    if (!next) return
    this.future = this.future.slice(0, -1)
    this.past = [...this.past, this.snapshot()]
    this.restore(next)
  }

  private restore(s: Snapshot) {
    const selectedId = s.regions.some((r) => r.id === s.selectedId) ? s.selectedId : null
    this.state = { ...this.state, ...s, selectedId }
    this.listeners.forEach((fn) => fn())
  }
}

export const store = new ProjectStore()

export function useProject<T>(select: (s: ProjectState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.getState()))
}
