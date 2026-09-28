import type { FieldDef, FieldDisplay } from './types'

export const RESERVED_COLUMNS = ['id', 'file', 'pause', 'repeats', 'source', 'start', 'end'] as const
export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]*$/

export const DEFAULT_FIELDS: readonly FieldDef[] = [
  { key: 'text', label: 'Original', role: 'primary' },
  { key: 'transcription', label: 'Transcription' },
  { key: 'translation', label: 'Translation', role: 'translation' },
  { key: 'notes', label: 'Notes', multiline: true },
]

export function isReservedColumn(key: string): boolean {
  return (RESERVED_COLUMNS as readonly string[]).includes(key)
}

export function primaryField(fields: readonly FieldDef[]): FieldDef | undefined {
  return fields.find((f) => f.role === 'primary') ?? fields[0]
}

export function translationField(fields: readonly FieldDef[]): FieldDef | undefined {
  return fields.find((f) => f.role === 'translation')
}

// The primary field is always shown; others default to a show/hide toggle.
export function fieldDisplay(field: FieldDef, fields: readonly FieldDef[]): FieldDisplay {
  if (field === primaryField(fields)) return 'always'
  return field.display ?? 'toggle'
}

// Keeps existing definitions and appends fields whose keys are new (used when appending to a pack).
export function mergeFields(existing: readonly FieldDef[], incoming: readonly FieldDef[]): FieldDef[] {
  const keys = new Set(existing.map((f) => f.key))
  const hasRole = new Set(existing.map((f) => f.role).filter(Boolean))
  const added = incoming
    .filter((f) => !keys.has(f.key))
    .map((f) => (f.role && hasRole.has(f.role) ? { ...f, role: undefined } : f))
  return [...existing, ...added]
}
