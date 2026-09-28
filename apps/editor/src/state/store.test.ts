import { beforeEach, describe, expect, it } from 'vitest'
import { ProjectStore } from './store'

let s: ProjectStore
const regions = () => s.getState().regions.map((r) => [r.id, r.start, r.end])

beforeEach(() => {
  s = new ProjectStore()
  s.newProject({ name: 'a.mp3', size: 1, duration: 20 })
})

describe('ProjectStore', () => {
  it('adds regions sorted, clamped to neighbours and the file, with sequential ids', () => {
    expect(s.addRegion(5, 7)).toBe('p0001')
    expect(s.addRegion(1, 2)).toBe('p0002')
    expect(s.addRegion(6.5, 9)).toBeNull() // starts inside p0001
    expect(s.addRegion(4, 6)).toBe('p0003') // clamped to p0001's start
    expect(s.addRegion(19, 25)).toBe('p0004') // clamped to duration
    expect(regions()).toEqual([
      ['p0002', 1, 2],
      ['p0003', 4, 5],
      ['p0001', 5, 7],
      ['p0004', 19, 20],
    ])
    expect(s.addRegion(3, 3.05)).toBeNull() // too short
  })

  it('moves boundaries within neighbours and keeps a minimum length', () => {
    s.addRegion(1, 2)
    s.addRegion(3, 4)
    s.setBounds('p0002', 1.5, 3.5) // start would overlap p0001
    expect(regions()[1]).toEqual(['p0002', 2, 3.5])
    s.nudge('p0002', 'start', 10)
    expect(regions()[1][1]).toBeCloseTo(3.4)
  })

  it('splits, merges and undoes with selection restored', () => {
    s.addRegion(1, 3)
    s.setValue('p0001', 'text', 'Hallo')
    expect(s.split('p0001', 1.05)).toBe(false)
    expect(s.split('p0001', 2)).toBe(true)
    expect(regions()).toEqual([
      ['p0001', 1, 2],
      ['p0002', 2, 3],
    ])
    s.setValue('p0002', 'text', 'Welt')
    expect(s.mergeWithNext('p0001')).toBe(true)
    expect(s.getState().regions).toEqual([{ id: 'p0001', start: 1, end: 3, values: { text: 'Hallo Welt' } }])
    s.undo()
    expect(regions()).toHaveLength(2)
    s.undo()
    expect(regions()).toEqual([['p0001', 1, 3]])
    expect(s.getState().selectedId).toBe('p0001')
    s.redo()
    expect(regions()).toHaveLength(2)
  })

  it('selects neighbours after delete and on relative moves', () => {
    s.addRegion(1, 2)
    s.addRegion(3, 4)
    s.addRegion(5, 6)
    s.select('p0002')
    s.remove('p0002')
    expect(s.getState().selectedId).toBe('p0003')
    s.selectRelative(-1)
    expect(s.getState().selectedId).toBe('p0001')
    s.selectRelative(-1)
    expect(s.getState().selectedId).toBe('p0001')
  })
})
