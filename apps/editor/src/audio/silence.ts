// Silence detection: proposes regions by finding pauses in speech (see docs/editor.md).

export const FRAME = 0.02 // seconds
const FLOOR_DB = -100

export interface DetectParams {
  threshold: number | 'auto' // dBFS
  minSilence: number // seconds
  minPhrase: number // seconds
  padding: number // seconds
  from: number // scope, seconds
  to: number
}

export interface DetectResult {
  threshold: number
  noiseFloor: number
  regions: { start: number; end: number }[]
}

export const defaultDetectParams = { threshold: 'auto' as const, minSilence: 0.4, minPhrase: 0.3, padding: 0.1 }

// RMS level of each 20 ms frame in dBFS. Computed once per recording; detection reuses it.
export function frameLevels(samples: Float32Array, sampleRate: number): Float32Array {
  const size = Math.max(1, Math.round(FRAME * sampleRate))
  const n = Math.ceil(samples.length / size)
  const out = new Float32Array(n)
  for (let f = 0; f < n; f++) {
    let sum = 0
    const end = Math.min(samples.length, (f + 1) * size)
    for (let i = f * size; i < end; i++) sum += samples[i] * samples[i]
    const rms = Math.sqrt(sum / Math.max(1, end - f * size))
    out[f] = Math.max(FLOOR_DB, 20 * Math.log10(rms || 1e-10)) // digital silence is clamped
  }
  return out
}

function percentile(values: Float32Array, p: number): number {
  const sorted = Float32Array.from(values).sort()
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? FLOOR_DB
}

export function detectSpeech(levels: Float32Array, params: DetectParams): DetectResult {
  const f0 = Math.max(0, Math.floor(params.from / FRAME))
  const f1 = Math.min(levels.length, Math.ceil(params.to / FRAME))
  const scope = levels.subarray(f0, f1)
  const noiseFloor = scope.length ? percentile(scope, 0.1) : FLOOR_DB
  const threshold =
    params.threshold === 'auto' ? Math.min(-25, Math.max(-60, noiseFloor + 12)) : params.threshold
  if (!scope.length) return { threshold, noiseFloor, regions: [] }

  const minSilence = Math.max(1, Math.round(params.minSilence / FRAME))
  const minPhrase = Math.max(1, Math.round(params.minPhrase / FRAME))

  // Speech runs: frames between silent runs of at least minSilence frames.
  const speech: [number, number][] = [] // [first, last+1] in scope frames
  let runStart = -1 // start of the current speech run
  let silentSince = -1
  for (let i = 0; i <= scope.length; i++) {
    const silent = i === scope.length || scope[i] < threshold
    if (!silent) {
      if (runStart < 0) runStart = i
      silentSince = -1
      continue
    }
    if (silentSince < 0) silentSince = i
    const pauseLong = i === scope.length || i - silentSince + 1 >= minSilence
    if (runStart >= 0 && pauseLong) {
      speech.push([runStart, silentSince])
      runStart = -1
    }
  }

  const kept = speech.filter(([a, b]) => b - a >= minPhrase)
  const regions = kept.map(([a, b], k) => {
    const start = params.from + a * FRAME
    const end = Math.min(params.to, params.from + b * FRAME)
    // Padding never reaches past the middle of the adjacent pause (or the scope).
    const prevEnd = k > 0 ? params.from + kept[k - 1][1] * FRAME : params.from
    const nextStart = k < kept.length - 1 ? params.from + kept[k + 1][0] * FRAME : params.to
    return {
      start: Math.max(start - params.padding, k > 0 ? (prevEnd + start) / 2 : prevEnd),
      end: Math.min(end + params.padding, k < kept.length - 1 ? (end + nextStart) / 2 : nextStart),
    }
  })
  return { threshold, noiseFloor, regions }
}
