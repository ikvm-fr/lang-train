import { PACK_FORMAT, PACK_VERSION, writePack, type Pack, type Phrase } from '@lang-train/pack'
import { Mp3EncoderPool } from '../audio/encode'
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

export async function buildPack(
  project: ProjectState,
  buffer: AudioBuffer,
  opts: ExportOptions,
  onProgress: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const { regions, fields, audio } = project
  if (!regions.length) throw new Error('There are no regions to export')
  const now = new Date().toISOString()
  const encoder = new Mp3EncoderPool()
  try {
    const phrases: Phrase[] = []
    for (const [i, r] of regions.entries()) {
      onProgress(i, regions.length)
      const mp3 = await encoder.encode(cutClip(buffer, r.start, r.end, opts.padding), buffer.sampleRate, opts.kbps)
      const values: Record<string, string> = {}
      for (const f of fields) values[f.key] = (r.values[f.key] ?? '').trim()
      phrases.push({
        id: r.id,
        file: `audio/${String(i + 1).padStart(4, '0')}.mp3`,
        values,
        source: 's1',
        start: r.start,
        end: r.end,
        audio: mp3,
      })
    }
    onProgress(regions.length, regions.length)

    const lang: Record<string, string> = {}
    if (opts.target.trim()) lang.target = opts.target.trim()
    if (opts.native.trim()) lang.native = opts.native.trim()
    const pack: Pack = {
      meta: {
        format: PACK_FORMAT,
        version: PACK_VERSION,
        id: project.packId,
        title: opts.title.trim() || 'Untitled',
        ...(Object.keys(lang).length ? { lang } : {}),
        fields,
        sources: audio ? [{ id: 's1', name: audio.name, duration: Math.round(audio.duration * 1000) / 1000 }] : [],
        generator: `lang-train-editor ${__APP_VERSION__}`,
        created: now,
        modified: now,
      },
      phrases,
    }
    return writePack(pack)
  } finally {
    encoder.dispose()
  }
}

export function downloadBytes(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' }))
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
