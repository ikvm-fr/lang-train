import { describe, expect, it } from 'vitest'
import { cutClip, safeFileName } from './buildPack'

function fakeBuffer(samples: Float32Array, sampleRate: number): AudioBuffer {
  return { sampleRate, length: samples.length, getChannelData: () => samples } as unknown as AudioBuffer
}

describe('cutClip', () => {
  it('cuts with padding, clamps to the file and fades the edges', () => {
    const rate = 1000
    const buf = fakeBuffer(new Float32Array(3000).fill(1), rate)
    const clip = cutClip(buf, 1, 2, 0.1)
    expect(clip.length).toBe(1200)
    expect(clip[0]).toBe(0)
    expect(clip[600]).toBe(1)
    expect(clip[clip.length - 1]).toBeLessThan(1)
    expect(cutClip(buf, 0.05, 2.99, 0.1).length).toBe(3000)
  })
})

describe('safeFileName', () => {
  it('strips characters that are not allowed in file names', () => {
    expect(safeFileName('Unit 3: A/B?')).toBe('Unit 3_ A_B_.zip')
    expect(safeFileName('  ')).toBe('pack.zip')
  })
})
