import { readPack } from '@lang-train/pack'
import { describe, expect, it, vi } from 'vitest'
import { samplePack } from '../state/testFixtures'
import { projectFromPack } from '../state/fromPack'
import type { ProjectState, Region } from '../state/store'
import { appendToPack, updatePack, type ExportOptions } from './buildPack'

// Workers are not available in Node: the "MP3" is just the clip length.
vi.mock('../audio/encode', () => ({
  Mp3EncoderPool: class {
    encode = async (samples: Float32Array) => new Uint8Array([samples.length % 256])
    dispose() {}
  },
}))
vi.stubGlobal('__APP_VERSION__', 'test')

const buffer = {
  sampleRate: 100,
  length: 3000,
  getChannelData: () => new Float32Array(3000),
} as unknown as AudioBuffer
const opts: ExportOptions = { title: '', target: '', native: '', padding: 0, kbps: 64 }
const noop = () => {}

function editedProject(): ProjectState {
  const { project } = projectFromPack(samplePack(), 's1', { name: 'a2.mp3', size: 9, duration: 30 })
  // Edit: change a text, move a boundary, delete p0002, add a new region.
  const regions: Region[] = [
    { ...project.regions[0], end: 2.5, values: { text: 'A!', translation: 'a' } },
    { id: 'p0010', start: 5, end: 6, values: { text: 'New' } },
  ]
  return { ...project, regions, selectedId: null, fields: [...project.fields, { key: 'notes', label: 'Notes' }] }
}

describe('updatePack', () => {
  it('replaces the phrases of one recording and keeps the rest', async () => {
    const zip = await updatePack(samplePack(), editedProject(), buffer, opts, noop)
    const pack = await readPack(zip)
    expect(pack.meta.id).toBe('pack-1')
    expect(pack.meta.title).toBe('Unit 3')
    expect(pack.phrases.map((p) => [p.id, p.source, p.values.text])).toEqual([
      ['p0001', 's1', 'A!'],
      ['p0010', 's1', 'New'],
      ['p0009', 's2', 'C'],
      ['x', undefined, 'D'],
    ])
    expect(pack.phrases[0]).toMatchObject({ end: 2.5, repeats: 2 })
    // New clip names avoid the files that were kept.
    expect(new Set(pack.phrases.map((p) => p.file)).size).toBe(4)
    expect(pack.meta.fields.map((f) => f.key)).toEqual(['text', 'translation', 'notes'])
    expect(pack.meta.sources).toEqual([
      { id: 's2', name: 'b.mp3', duration: 20 },
      { id: 's1', name: 'a2.mp3', duration: 30 },
    ])
  })

  it('refuses projects that were not opened from a pack', async () => {
    await expect(updatePack(samplePack(), { ...editedProject(), origin: undefined }, buffer, opts, noop)).rejects.toThrow(
      /not opened from a pack/,
    )
  })
})

describe('appendToPack', () => {
  it('continues numbering and renames clashing ids', async () => {
    const project = { ...editedProject(), regions: [{ id: 'p0001', start: 7, end: 8, values: { text: 'Z' } }] }
    const pack = await readPack(await appendToPack(samplePack(), project, buffer, opts, noop))
    const added = pack.phrases.at(-1)!
    expect(pack.phrases).toHaveLength(5)
    expect(added).toMatchObject({ id: 'p0010', file: 'audio/0005.mp3', source: 's3' })
  })
})
