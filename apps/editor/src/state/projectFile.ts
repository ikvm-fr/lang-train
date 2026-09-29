import { FIELD_KEY_PATTERN, isReservedColumn, type FieldDef } from '@lang-train/pack'
import type { AudioInfo, PackOrigin, ProjectState, Region } from './store'

// Project file (JSON): everything except the audio. Used for autosave and for backup/transfer.

export const PROJECT_FORMAT = 'lang-train-project'
export const PROJECT_VERSION = 1

export interface ProjectFile {
  format: typeof PROJECT_FORMAT
  version: number
  packId: string
  origin?: PackOrigin
  audio: AudioInfo
  fields: FieldDef[]
  regions: Region[]
  nextId: number
  savedAt: string
}

export function toProjectFile(s: ProjectState): ProjectFile | null {
  if (!s.audio) return null
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    packId: s.packId,
    ...(s.origin ? { origin: s.origin } : {}),
    audio: s.audio,
    fields: s.fields,
    regions: s.regions,
    nextId: s.nextId,
    savedAt: new Date().toISOString(),
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

export function parseProjectFile(raw: unknown): ProjectFile {
  if (!isObj(raw) || raw.format !== PROJECT_FORMAT) throw new Error('Not a Lang Train project file')
  if (typeof raw.version !== 'number' || raw.version > PROJECT_VERSION) {
    throw new Error('This project file was made by a newer version of the editor')
  }
  const audio = raw.audio
  if (!isObj(audio) || typeof audio.name !== 'string' || !num(audio.size) || !num(audio.duration)) {
    throw new Error('Project file: invalid `audio`')
  }
  if (!Array.isArray(raw.fields) || !raw.fields.length) throw new Error('Project file: invalid `fields`')
  const fields: FieldDef[] = raw.fields.map((f) => {
    if (!isObj(f) || typeof f.key !== 'string' || !FIELD_KEY_PATTERN.test(f.key) || isReservedColumn(f.key)) {
      throw new Error('Project file: invalid field')
    }
    return { ...(f as unknown as FieldDef), label: typeof f.label === 'string' ? f.label : f.key }
  })
  if (!Array.isArray(raw.regions)) throw new Error('Project file: invalid `regions`')
  const regions: Region[] = raw.regions
    .filter((r): r is Record<string, unknown> => isObj(r) && typeof r.id === 'string' && num(r.start) && num(r.end))
    .map((r) => ({
      id: r.id as string,
      start: r.start as number,
      end: r.end as number,
      values: isObj(r.values)
        ? Object.fromEntries(Object.entries(r.values).filter(([, v]) => typeof v === 'string')) as Record<string, string>
        : {},
      ...(num(r.pause) && (r.pause as number) >= 0 ? { pause: r.pause as number } : {}),
      ...(num(r.repeats) && (r.repeats as number) >= 1 ? { repeats: r.repeats as number } : {}),
    }))
    .sort((a, b) => a.start - b.start)
  const maxId = Math.max(0, ...regions.map((r) => Number(/^p(\d+)$/.exec(r.id)?.[1] ?? 0)))
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    packId: typeof raw.packId === 'string' && raw.packId ? raw.packId : crypto.randomUUID(),
    ...(isObj(raw.origin) && typeof raw.origin.title === 'string' && typeof raw.origin.sourceId === 'string'
      ? {
          origin: {
            title: raw.origin.title,
            sourceId: raw.origin.sourceId,
            ...(isObj(raw.origin.lang) ? { lang: raw.origin.lang as PackOrigin['lang'] } : {}),
          },
        }
      : {}),
    audio: { name: audio.name, size: audio.size as number, duration: audio.duration as number },
    fields,
    regions,
    nextId: Math.max(num(raw.nextId) ? (raw.nextId as number) : 1, maxId + 1),
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : '',
  }
}

// ----- Audacity labels: "start<TAB>end<TAB>label" per line -----

export interface Label {
  start: number
  end: number
  label: string
}

export function parseAudacityLabels(text: string): Label[] {
  const out: Label[] = []
  for (const line of text.split(/\r?\n/)) {
    // Lines starting with "\" hold spectral selection data of the previous label.
    if (!line.trim() || line.startsWith('\\')) continue
    const [a, b, ...rest] = line.split('\t')
    const start = Number(a?.replace(',', '.'))
    const end = Number(b?.replace(',', '.'))
    if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error(`Not an Audacity label line: "${line.slice(0, 60)}"`)
    out.push({ start: Math.min(start, end), end: Math.max(start, end), label: rest.join('\t').trim() })
  }
  return out
}

export function formatAudacityLabels(regions: readonly Region[], labelKey: string | undefined): string {
  return regions
    .map((r) => `${r.start.toFixed(6)}\t${r.end.toFixed(6)}\t${(labelKey ? r.values[labelKey] ?? '' : '').replace(/[\t\r\n]+/g, ' ')}`)
    .join('\n') + '\n'
}
