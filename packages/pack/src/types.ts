// Types of the pack format v1, see docs/pack-format.md.

export const PACK_FORMAT = 'lang-train-pack'
export const PACK_VERSION = 1

export type FieldRole = 'primary' | 'translation'
export type FieldDisplay = 'always' | 'toggle' | 'hidden'

export interface FieldDef {
  key: string
  label: string
  role?: FieldRole
  multiline?: boolean
  display?: FieldDisplay
  lang?: string
  dir?: 'ltr' | 'rtl'
}

export interface PackDefaults {
  pauseFactor?: number
  pauseExtra?: number
  repeats?: number
}

export interface PackSource {
  id: string
  name: string
  duration?: number
}

export interface PackMeta {
  format: typeof PACK_FORMAT
  version: number
  id: string
  title: string
  description?: string
  lang?: { target?: string; native?: string }
  fields: FieldDef[]
  defaults?: PackDefaults
  sources?: PackSource[]
  generator?: string
  created?: string
  modified?: string
  // Unknown keys are preserved when a pack is rewritten.
  [key: string]: unknown
}

export interface Phrase {
  id: string
  file: string
  values: Record<string, string>
  pause?: number
  repeats?: number
  source?: string
  start?: number
  end?: number
  audio: Uint8Array
}

export interface Pack {
  meta: PackMeta
  phrases: Phrase[]
}

export interface ReadResult extends Pack {
  // Non-fatal problems found while reading (ignored values, extra roles, ...).
  warnings: string[]
}
