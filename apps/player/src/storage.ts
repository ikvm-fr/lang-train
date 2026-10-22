import type { PackDefaults } from '@lang-train/pack'
import { defaultSettings, type SegmentOverride, type Settings } from './engine/Player'

// The prototype keeps everything in localStorage. On any access error, run without persistence.

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

// Only the settings the user has changed are stored, so a pack's `defaults`
// apply until the user overrides that particular setting.
const USER_SETTINGS = 'lt:user-settings'

export function effectiveSettings(packDefaults: PackDefaults | undefined): Settings {
  return { ...defaultSettings, ...packDefaults, ...read<Partial<Settings>>(USER_SETTINGS, {}) }
}

export function saveUserSettings(patch: Partial<Settings>) {
  write(USER_SETTINGS, { ...read<Partial<Settings>>(USER_SETTINGS, {}), ...patch })
}

export interface Display {
  wakeLock: boolean
}

export const loadDisplay = () => read<Display>('lt:display', { wakeLock: false })
export const saveDisplay = (d: Display) => write('lt:display', d)

// Show/hide switches of the pack's fields, by field key.
export const loadFieldVisibility = (packId: string) => read<Record<string, boolean>>(`lt:fields:${packId}`, {})
export const saveFieldVisibility = (packId: string, v: Record<string, boolean>) => write(`lt:fields:${packId}`, v)

export const loadOverrides = (packId: string) => read<Record<string, SegmentOverride>>(`lt:overrides:${packId}`, {})
export const saveOverrides = (packId: string, o: Record<string, SegmentOverride>) => write(`lt:overrides:${packId}`, o)
