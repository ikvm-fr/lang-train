import { describe, expect, it } from 'vitest'
import { formatAudacityLabels, parseAudacityLabels, parseProjectFile, PROJECT_FORMAT } from './projectFile'

describe('Audacity labels', () => {
  it('parses labels, skipping spectral lines, and round-trips', () => {
    const text = '1.5\t2.25\tGuten Morgen!\n\\\t100\t2000\n3,0\t4\t\n'
    const labels = parseAudacityLabels(text)
    expect(labels).toEqual([
      { start: 1.5, end: 2.25, label: 'Guten Morgen!' },
      { start: 3, end: 4, label: '' },
    ])
    const regions = labels.map((l, i) => ({ id: `p${i}`, start: l.start, end: l.end, values: { text: l.label } }))
    expect(parseAudacityLabels(formatAudacityLabels(regions, 'text'))).toEqual(labels)
  })

  it('rejects files that are not labels', () => {
    expect(() => parseAudacityLabels('hello world')).toThrow(/Not an Audacity label line/)
  })
})

describe('project file', () => {
  const valid = {
    format: PROJECT_FORMAT,
    version: 1,
    packId: 'x',
    audio: { name: 'a.mp3', size: 10, duration: 5 },
    fields: [{ key: 'text', label: 'Original', role: 'primary' }],
    regions: [
      { id: 'p0007', start: 2, end: 3, values: { text: 'b', bad: 1 } },
      { id: 'p0002', start: 0, end: 1, values: { text: 'a' } },
      { id: 'broken' },
    ],
    nextId: 3,
  }

  it('validates, sorts regions and fixes nextId', () => {
    const p = parseProjectFile(valid)
    expect(p.regions.map((r) => r.id)).toEqual(['p0002', 'p0007'])
    expect(p.regions[1].values).toEqual({ text: 'b' })
    expect(p.nextId).toBe(8)
  })

  it('rejects other files', () => {
    expect(() => parseProjectFile({ format: 'lang-train-pack' })).toThrow(/Not a Lang Train project/)
    expect(() => parseProjectFile({ ...valid, version: 2 })).toThrow(/newer version/)
    expect(() => parseProjectFile({ ...valid, fields: [{ key: 'file' }] })).toThrow(
      expect.objectContaining({ code: 'projectInvalid', params: { what: 'field' } }),
    )
  })
})
