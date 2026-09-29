import { describe, expect, it } from 'vitest'
import { packSources, projectFromPack } from './fromPack'
import { samplePack } from './testFixtures'

describe('packSources', () => {
  it('lists recordings with positioned phrases', () => {
    expect(packSources(samplePack())).toEqual({
      sources: [
        { id: 's1', name: 'a.mp3', duration: 30, count: 2 },
        { id: 's2', name: 'b.mp3', duration: 20, count: 1 },
      ],
      unplaced: 1,
    })
  })
})

describe('projectFromPack', () => {
  it('rebuilds regions of one recording with ids, texts and per-phrase values', () => {
    const { project, dropped } = projectFromPack(samplePack(), 's1', { name: 'a.mp3', size: 9, duration: 30 })
    expect(dropped).toBe(0)
    expect(project.packId).toBe('pack-1')
    expect(project.origin).toEqual({ title: 'Unit 3', lang: { target: 'de' }, sourceId: 's1' })
    expect(project.regions).toEqual([
      { id: 'p0001', start: 1, end: 2, values: { text: 'A', translation: 'a' }, repeats: 2 },
      { id: 'p0002', start: 3, end: 4, values: { text: 'B', translation: 'b' }, pause: 1.5 },
    ])
    expect(project.nextId).toBe(10) // above every id in the pack, including p0009 of the other recording
  })

  it('drops phrases that overlap or lie outside the recording', () => {
    const pack = samplePack()
    pack.phrases[1].start = 1.5
    const { project, dropped } = projectFromPack(pack, 's1', { name: 'a.mp3', size: 9, duration: 30 })
    expect(project.regions.map((r) => r.id)).toEqual(['p0001'])
    expect(dropped).toBe(1)
    expect(projectFromPack(samplePack(), 's1', { name: 'a.mp3', size: 9, duration: 0.5 }).dropped).toBe(2)
  })
})
