import { describe, expect, it } from 'vitest'
import { detectSpeech, frameLevels, FRAME } from './silence'

const RATE = 1000

// Builds a signal from [seconds, amplitude] parts.
function signal(parts: [number, number][]): Float32Array {
  const out: number[] = []
  for (const [sec, amp] of parts) for (let i = 0; i < Math.round(sec * RATE); i++) out.push(i % 2 ? amp : -amp)
  return Float32Array.from(out)
}

const base = { threshold: 'auto' as const, minSilence: 0.4, minPhrase: 0.3, padding: 0, from: 0 }

describe('silence detection', () => {
  it('finds phrases separated by pauses and ignores short dips', () => {
    // noise | phrase 1 with a short dip | pause | phrase 2 | noise
    const s = signal([[1, 0.001], [0.5, 0.3], [0.1, 0.001], [0.5, 0.3], [0.6, 0.001], [0.8, 0.3], [1, 0.001]])
    const levels = frameLevels(s, RATE)
    const r = detectSpeech(levels, { ...base, to: s.length / RATE })
    expect(r.noiseFloor).toBeCloseTo(-60, 0)
    expect(r.regions).toHaveLength(2)
    expect(r.regions[0].start).toBeCloseTo(1, 1)
    expect(r.regions[0].end).toBeCloseTo(2.1, 1)
    expect(r.regions[1].start).toBeCloseTo(2.7, 1)
    expect(r.regions[1].end).toBeCloseTo(3.5, 1)
  })

  it('drops phrases shorter than minPhrase (clicks) and respects the scope', () => {
    const s = signal([[1, 0.001], [0.06, 0.5], [1, 0.001], [0.8, 0.3], [1, 0.001]])
    const levels = frameLevels(s, RATE)
    expect(detectSpeech(levels, { ...base, to: s.length / RATE }).regions).toHaveLength(1)
    expect(detectSpeech(levels, { ...base, from: 0, to: 2 }).regions).toHaveLength(0)
  })

  it('pads without passing the middle of the adjacent pause', () => {
    const s = signal([[0.5, 0.001], [0.5, 0.3], [0.4, 0.001], [0.5, 0.3], [0.5, 0.001]])
    const levels = frameLevels(s, RATE)
    const r = detectSpeech(levels, { ...base, minSilence: 0.3, padding: 0.3, to: s.length / RATE })
    expect(r.regions).toHaveLength(2)
    expect(r.regions[0].start).toBeCloseTo(0.2, 1)
    expect(r.regions[0].end).toBeCloseTo(1.2, 1) // middle of the 0.4 s pause
    expect(r.regions[1].start).toBeCloseTo(1.2, 1)
    expect(r.regions[0].end).toBeLessThanOrEqual(r.regions[1].start + FRAME)
  })

  it('uses a manual threshold', () => {
    const s = signal([[1, 0.02], [0.5, 0.3], [1, 0.02]])
    const levels = frameLevels(s, RATE)
    expect(detectSpeech(levels, { ...base, threshold: -60, to: 2.5 }).regions).toHaveLength(1) // everything is "speech"
    expect(detectSpeech(levels, { ...base, threshold: -20, to: 2.5 }).regions[0].start).toBeCloseTo(1, 1)
  })
})
