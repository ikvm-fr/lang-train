import { defaultSettings, type SegmentOverride, type Settings } from './engine/Player'

// The prototype keeps everything in localStorage. On any access error, run without persistence.

export interface Display {
  translation: boolean
  transcription: boolean
  notes: boolean
  wakeLock: boolean
}

export const defaultDisplay: Display = { translation: true, transcription: true, notes: true, wakeLock: false }

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

export const loadSettings = () => read<Settings>('lt:settings', defaultSettings)
export const saveSettings = (s: Settings) => write('lt:settings', s)
export const loadDisplay = () => read<Display>('lt:display', defaultDisplay)
export const saveDisplay = (d: Display) => write('lt:display', d)
export const loadOverrides = (packId: string) => read<Record<string, SegmentOverride>>(`lt:overrides:${packId}`, {})
export const saveOverrides = (packId: string, o: Record<string, SegmentOverride>) => write(`lt:overrides:${packId}`, o)
