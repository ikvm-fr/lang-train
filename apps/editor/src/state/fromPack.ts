import type { Pack, Phrase } from '@lang-train/pack'
import { PROJECT_FORMAT, PROJECT_VERSION, type ProjectFile } from './projectFile'
import type { AudioInfo, Region } from './store'

// Rebuilds an editor project from a pack plus the recording it was cut from,
// using the positions stored in phrases.csv (source, start, end).

export interface PackSourceInfo {
  id: string
  name: string
  duration?: number
  count: number // phrases with a known position in this recording
}

export const isPlaced = (p: Phrase) =>
  !!p.source && p.start !== undefined && p.end !== undefined && p.end > p.start

export function packSources(pack: Pack): { sources: PackSourceInfo[]; unplaced: number } {
  const counts = new Map<string, number>()
  let unplaced = 0
  for (const p of pack.phrases) {
    if (isPlaced(p)) counts.set(p.source!, (counts.get(p.source!) ?? 0) + 1)
    else unplaced++
  }
  const declared = new Map((pack.meta.sources ?? []).map((s) => [s.id, s]))
  const sources = [...counts].map(([id, count]) => ({
    id,
    name: declared.get(id)?.name ?? id,
    duration: declared.get(id)?.duration,
    count,
  }))
  return { sources, unplaced }
}

export function projectFromPack(
  pack: Pack,
  sourceId: string,
  audio: AudioInfo,
): { project: ProjectFile; dropped: number } {
  const regions: Region[] = []
  let dropped = 0
  const placed = pack.phrases.filter((p) => p.source === sourceId && isPlaced(p)).sort((a, b) => a.start! - b.start!)
  for (const p of placed) {
    const start = Math.max(0, p.start!)
    const end = Math.min(audio.duration, p.end!)
    const prev = regions.at(-1)
    // Regions must not overlap and must lie inside the recording.
    if (end - start <= 0 || (prev && start < prev.end)) {
      dropped++
      continue
    }
    regions.push({
      id: p.id,
      start,
      end,
      values: { ...p.values },
      ...(p.pause !== undefined ? { pause: p.pause } : {}),
      ...(p.repeats !== undefined ? { repeats: p.repeats } : {}),
    })
  }
  // New regions must not reuse ids of any phrase in the pack.
  const maxId = Math.max(0, ...pack.phrases.map((p) => Number(/^p(\d+)$/.exec(p.id)?.[1] ?? 0)))
  return {
    project: {
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      packId: pack.meta.id,
      origin: { title: pack.meta.title, ...(pack.meta.lang ? { lang: pack.meta.lang } : {}), sourceId },
      audio,
      fields: pack.meta.fields.map((f) => ({ ...f })),
      regions,
      nextId: maxId + 1,
      savedAt: new Date().toISOString(),
    },
    dropped,
  }
}
