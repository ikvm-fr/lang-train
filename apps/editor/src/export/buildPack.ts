import { mergeFields, PACK_FORMAT, PACK_VERSION, writePack, type Pack, type Phrase } from '@lang-train/pack'
import { Mp3EncoderPool } from '../audio/encode'
import { editorError } from '../errors'
import { isPlaced } from '../state/fromPack'
import type { ProjectState } from '../state/store'

// Cuts regions out of the decoded recording, encodes them to MP3 and writes a pack ZIP.

export interface ExportOptions {
  title: string
  target: string
  native: string
  padding: number // seconds added on both sides
  kbps: number
}

const FADE = 0.005 // seconds

export function cutClip(buffer: AudioBuffer, start: number, end: number, padding: number): Float32Array {
  const rate = buffer.sampleRate
  const from = Math.max(0, Math.round((start - padding) * rate))
  const to = Math.min(buffer.length, Math.round((end + padding) * rate))
  const clip = buffer.getChannelData(0).slice(from, to)
  const fade = Math.min(Math.round(FADE * rate), Math.floor(clip.length / 2))
  for (let i = 0; i < fade; i++) {
    const g = i / fade
    clip[i] *= g
    clip[clip.length - 1 - i] *= g
  }
  return clip
}

interface EncodePlan {
  fileFor: (index: number) => string
  idFor: (regionId: string) => string
  sourceId: string
}

async function encodeRegions(
  project: ProjectState,
  buffer: AudioBuffer,
  opts: ExportOptions,
  plan: EncodePlan,
  onProgress: (done: number, total: number) => void,
): Promise<Phrase[]> {
  const { regions, fields } = project
  if (!regions.length) throw editorError('noRegions')
  const encoder = new Mp3EncoderPool()
  try {
    const phrases: Phrase[] = []
    for (const [i, r] of regions.entries()) {
      onProgress(i, regions.length)
      const mp3 = await encoder.encode(cutClip(buffer, r.start, r.end, opts.padding), buffer.sampleRate, opts.kbps)
      const values: Record<string, string> = {}
      for (const f of fields) values[f.key] = (r.values[f.key] ?? '').trim()
      phrases.push({
        id: plan.idFor(r.id),
        file: plan.fileFor(i),
        values,
        source: plan.sourceId,
        start: r.start,
        end: r.end,
        ...(r.pause !== undefined ? { pause: r.pause } : {}),
        ...(r.repeats !== undefined ? { repeats: r.repeats } : {}),
        audio: mp3,
      })
    }
    onProgress(regions.length, regions.length)
    return phrases
  } finally {
    encoder.dispose()
  }
}

function langOf(opts: ExportOptions) {
  const lang: Record<string, string> = {}
  if (opts.target.trim()) lang.target = opts.target.trim()
  if (opts.native.trim()) lang.native = opts.native.trim()
  return Object.keys(lang).length ? lang : undefined
}

const clipName = (n: number) => `audio/${String(n).padStart(4, '0')}.mp3`

export async function buildPack(
  project: ProjectState,
  buffer: AudioBuffer,
  opts: ExportOptions,
  onProgress: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const { audio } = project
  const phrases = await encodeRegions(
    project,
    buffer,
    opts,
    { fileFor: (i) => clipName(i + 1), idFor: (id) => id, sourceId: 's1' },
    onProgress,
  )
  const now = new Date().toISOString()
  const lang = langOf(opts)
  const pack: Pack = {
    meta: {
      format: PACK_FORMAT,
      version: PACK_VERSION,
      id: project.packId,
      title: opts.title.trim() || 'Untitled',
      ...(lang ? { lang } : {}),
      fields: project.fields,
      sources: audio ? [{ id: 's1', name: audio.name, duration: Math.round(audio.duration * 1000) / 1000 }] : [],
      generator: `lang-train-editor ${__APP_VERSION__}`,
      created: now,
      modified: now,
    },
    phrases,
  }
  return writePack(pack)
}

// Keeps region ids unless they clash with ids already in the pack.
function idAllocator(existingIds: Iterable<string>) {
  const ids = new Set(existingIds)
  let next = Math.max(0, ...[...ids].map((id) => Number(/^p(\d+)$/.exec(id)?.[1] ?? 0))) + 1
  return (id: string) => {
    if (!ids.has(id)) {
      ids.add(id)
      return id
    }
    let fresh = `p${String(next++).padStart(4, '0')}`
    while (ids.has(fresh)) fresh = `p${String(next++).padStart(4, '0')}`
    ids.add(fresh)
    return fresh
  }
}

// File names not used by `taken`, numbered from 1 (or from `from`).
function freshFileNames(count: number, taken: Set<string>, from = 1): string[] {
  const out: string[] = []
  for (let n = from; out.length < count; n++) if (!taken.has(clipName(n).toLowerCase())) out.push(clipName(n))
  return out
}

// Appends the project's regions to an existing pack (see docs/pack-format.md#appending-to-an-existing-pack):
// existing phrases and files are kept, numbering and ids continue, field models are merged.
export async function appendToPack(
  existing: Pack,
  project: ProjectState,
  buffer: AudioBuffer,
  opts: ExportOptions,
  onProgress: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const files = new Set(existing.phrases.map((p) => p.file.toLowerCase()))
  const numbers = existing.phrases.map((p) => Number(/(\d+)\.mp3$/i.exec(p.file)?.[1] ?? 0))
  const fileNames = freshFileNames(project.regions.length, files, Math.max(existing.phrases.length, ...numbers) + 1)
  const sources = existing.meta.sources ?? []
  const sourceIds = new Set(sources.map((s) => s.id))
  let n = sources.length + 1
  while (sourceIds.has(`s${n}`)) n++
  const sourceId = `s${n}`

  const phrases = await encodeRegions(
    project,
    buffer,
    opts,
    {
      fileFor: (i) => fileNames[i],
      idFor: idAllocator(existing.phrases.map((p) => p.id)),
      sourceId,
    },
    onProgress,
  )

  const { audio } = project
  const lang = existing.meta.lang ?? langOf(opts)
  return writePack({
    meta: {
      ...existing.meta,
      ...(lang ? { lang } : {}),
      fields: mergeFields(existing.meta.fields, project.fields),
      sources: audio
        ? [...sources, { id: sourceId, name: audio.name, duration: Math.round(audio.duration * 1000) / 1000 }]
        : sources,
      generator: `lang-train-editor ${__APP_VERSION__}`,
      modified: new Date().toISOString(),
    },
    phrases: [...existing.phrases, ...phrases],
  })
}

// Replaces the phrases of the recording this project was opened from (project.origin.sourceId)
// and keeps everything else in the pack: phrases from other recordings, title, unknown keys.
export async function updatePack(
  existing: Pack,
  project: ProjectState,
  buffer: AudioBuffer,
  opts: ExportOptions,
  onProgress: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const sourceId = project.origin?.sourceId
  if (!sourceId) throw editorError('notFromPack')
  const replaced = (p: Phrase) => p.source === sourceId && isPlaced(p)
  const kept = existing.phrases.filter((p) => !replaced(p))
  const firstReplaced = existing.phrases.findIndex(replaced)
  const insertAt = firstReplaced < 0 ? kept.length : existing.phrases.slice(0, firstReplaced).filter((p) => !replaced(p)).length

  const fileNames = freshFileNames(project.regions.length, new Set(kept.map((p) => p.file.toLowerCase())))
  const phrases = await encodeRegions(
    project,
    buffer,
    opts,
    { fileFor: (i) => fileNames[i], idFor: idAllocator(kept.map((p) => p.id)), sourceId },
    onProgress,
  )

  const { audio } = project
  const sources = (existing.meta.sources ?? []).filter((s) => s.id !== sourceId)
  const lang = existing.meta.lang ?? langOf(opts)
  return writePack({
    meta: {
      ...existing.meta,
      ...(lang ? { lang } : {}),
      // Fields of phrases from other recordings must not disappear.
      fields: kept.length ? mergeFields(project.fields, existing.meta.fields) : project.fields,
      sources: audio
        ? [...sources, { id: sourceId, name: audio.name, duration: Math.round(audio.duration * 1000) / 1000 }]
        : sources,
      generator: `lang-train-editor ${__APP_VERSION__}`,
      modified: new Date().toISOString(),
    },
    phrases: [...kept.slice(0, insertAt), ...phrases, ...kept.slice(insertAt)],
  })
}

export function downloadBytes(bytes: Uint8Array, name: string, type = 'application/zip') {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function safeFileName(title: string): string {
  return (title.trim() || 'pack').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) + '.zip'
}
