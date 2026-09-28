import { strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { DEFAULT_FIELDS, fieldDisplay, mergeFields, primaryField, translationField } from './fields'
import { readPack } from './read'
import { PACK_FORMAT, type Pack } from './types'
import { buildPhrasesCsv, writePack } from './write'

const audio = (n: number) => new Uint8Array([0xff, 0xfb, n])

function zip(files: Record<string, string | Uint8Array>): Uint8Array {
  const entries: Record<string, Uint8Array> = {}
  for (const [k, v] of Object.entries(files)) entries[k] = typeof v === 'string' ? strToU8(v) : v
  return zipSync(entries)
}

const v1Meta = {
  format: PACK_FORMAT,
  version: 1,
  id: 'pack-1',
  title: 'Test',
  fields: [
    { key: 'text', label: 'Original', role: 'primary' },
    { key: 'translation', label: 'Translation', role: 'translation' },
    { key: 'notes', label: 'Notes', multiline: true, display: 'hidden' },
  ],
  defaults: { pauseFactor: 1.5, repeats: 2, bogus: 'x' },
  custom: { kept: true },
}

describe('readPack', () => {
  it('reads a v1 pack', async () => {
    const pack = await readPack(
      zip({
        'pack.json': JSON.stringify(v1Meta),
        'phrases.csv':
          'id,file,text,translation,notes,pause,repeats,source,start,end\r\n' +
          'p1,audio/0001.mp3,Hallo,Hello,"line 1\nline 2",2.5,3,s1,1.000,2.500\r\n' +
          'p2,audio/0002.mp3,Tschüss,Bye,,,,,,\r\n',
        'audio/0001.mp3': audio(1),
        'audio/0002.mp3': audio(2),
      }),
    )
    expect(pack.warnings).toEqual([])
    expect(pack.meta.id).toBe('pack-1')
    expect(pack.meta.fields.map((f) => f.key)).toEqual(['text', 'translation', 'notes'])
    expect(pack.meta.defaults).toEqual({ pauseFactor: 1.5, repeats: 2 })
    expect(pack.meta.custom).toEqual({ kept: true })
    expect(pack.phrases).toHaveLength(2)
    expect(pack.phrases[0]).toMatchObject({
      id: 'p1',
      values: { text: 'Hallo', translation: 'Hello', notes: 'line 1\nline 2' },
      pause: 2.5,
      repeats: 3,
      source: 's1',
      start: 1,
      end: 2.5,
    })
    expect(pack.phrases[0].audio).toEqual(audio(1))
    expect(pack.phrases[1].pause).toBeUndefined()
  })

  it('reads the prototype format with default fields and a hashed id', async () => {
    const pack = await readPack(
      zip({
        'phrases.csv': 'file,text,translation,transcription,notes\na.mp3,Hallo,Hello,[halo],\n',
        'a.mp3': audio(1),
      }),
      'lesson.zip',
    )
    expect(pack.meta.title).toBe('lesson')
    expect(pack.meta.id).toMatch(/^[0-9a-f]{16}$/)
    expect(pack.meta.fields.map((f) => f.key)).toEqual(DEFAULT_FIELDS.map((f) => f.key))
    expect(pack.phrases[0].id).toBe('a.mp3')
    expect(pack.phrases[0].values.transcription).toBe('[halo]')
  })

  it('treats undeclared columns as extra fields', async () => {
    const pack = await readPack(
      zip({
        'pack.json': JSON.stringify(v1Meta),
        'phrases.csv': 'file,text,Literal\na.mp3,Hallo,hello-lit\n',
        'a.mp3': audio(1),
      }),
    )
    expect(pack.meta.fields.at(-1)).toEqual({ key: 'literal', label: 'literal', display: 'toggle' })
    expect(pack.phrases[0].values).toEqual({ text: 'Hallo', translation: '', notes: '', literal: 'hello-lit' })
  })

  it('finds a pack nested in a folder, case-insensitively, and decodes cp1251 + BOM', async () => {
    const cp1251 = new Uint8Array([...strToU8('file,text\r\nA.MP3,'), 0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2])
    const pack = await readPack(zip({ 'lesson/phrases.csv': cp1251, 'lesson/a.mp3': audio(1), '__MACOSX/x': 'x' }))
    expect(pack.phrases[0].values.text).toBe('Привет')
    const bom = await readPack(zip({ 'phrases.csv': '﻿file,text\na.mp3,x\n', 'a.mp3': audio(1) }))
    expect(bom.phrases[0].values.text).toBe('x')
  })

  it('warns about and ignores invalid numbers', async () => {
    const pack = await readPack(
      zip({ 'phrases.csv': 'file,pause,repeats\na.mp3,-1,1.5\nb.mp3,"1,5",2\n', 'a.mp3': audio(1), 'b.mp3': audio(2) }),
    )
    expect(pack.phrases[0].pause).toBeUndefined()
    expect(pack.phrases[0].repeats).toBeUndefined()
    expect(pack.phrases[1]).toMatchObject({ pause: 1.5, repeats: 2 })
    expect(pack.warnings.filter((w) => w.includes('invalid'))).toHaveLength(2)
  })

  it.each([
    [{ 'phrases.csv': 'text\nx\n' }, /missing `file`/],
    [{ 'phrases.csv': 'file\na.mp3\n' }, /Audio files not found: a.mp3/],
    [{ 'x.txt': 'x' }, /phrases.csv not found/],
    [{ 'phrases.csv': 'file,id\na.mp3,1\nb.mp3,1\n', 'a.mp3': audio(1), 'b.mp3': audio(1) }, /duplicate phrase id/],
    [{ 'pack.json': '{', 'phrases.csv': 'file\n' }, /invalid JSON/],
    [{ 'pack.json': JSON.stringify({ ...v1Meta, version: 2 }), 'phrases.csv': 'file\n' }, /version 2/],
    [{ 'pack.json': JSON.stringify({ ...v1Meta, format: 'other' }), 'phrases.csv': 'file\n' }, /unknown format/],
    [
      { 'pack.json': JSON.stringify({ ...v1Meta, fields: [{ key: 'file', label: 'x' }] }), 'phrases.csv': 'file\n' },
      /reserved/,
    ],
    [
      { 'pack.json': JSON.stringify({ ...v1Meta, fields: [{ key: 'Bad Key', label: 'x' }] }), 'phrases.csv': 'file\n' },
      /invalid field key/,
    ],
  ])('rejects invalid packs (%#)', async (files, error) => {
    await expect(readPack(zip(files as Record<string, string | Uint8Array>))).rejects.toThrow(error)
  })
})

describe('writePack', () => {
  const pack: Pack = {
    meta: { ...(v1Meta as unknown as Pack['meta']), defaults: { repeats: 2 } },
    phrases: [
      { id: 'p1', file: 'audio/0001.mp3', values: { text: 'A, "quoted"', translation: 'B', notes: 'x\ny' }, start: 1.23456, end: 2, source: 's1', audio: audio(1) },
      { id: 'p2', file: 'audio/0002.mp3', values: { text: 'C' }, repeats: 2, audio: audio(2) },
    ],
  }

  it('round-trips through readPack', async () => {
    const back = await readPack(writePack(pack))
    expect(back.warnings).toEqual([])
    expect(back.meta.id).toBe('pack-1')
    expect(back.meta.custom).toEqual({ kept: true })
    expect(back.phrases.map((p) => p.values)).toEqual([
      { text: 'A, "quoted"', translation: 'B', notes: 'x\ny' },
      { text: 'C', translation: '', notes: '' },
    ])
    expect(back.phrases[0]).toMatchObject({ start: 1.235, end: 2, source: 's1' })
    expect(back.phrases[1].repeats).toBe(2)
    expect(back.phrases[1].audio).toEqual(audio(2))
  })

  it('writes a BOM, only used optional columns, and stores audio uncompressed', () => {
    const csv = buildPhrasesCsv(pack)
    expect(csv.startsWith('﻿id,file,text,translation,notes,repeats,source,start,end\r\n')).toBe(true)
    expect(Object.keys(unzipSync(writePack(pack)))).toEqual(['pack.json', 'phrases.csv', 'audio/0001.mp3', 'audio/0002.mp3'])
  })
})

describe('fields', () => {
  it('resolves roles and display', () => {
    const fields = [{ key: 'a', label: 'A' }, { key: 'b', label: 'B', role: 'translation' as const, display: 'hidden' as const }]
    expect(primaryField(fields)?.key).toBe('a')
    expect(translationField(fields)?.key).toBe('b')
    expect(fieldDisplay(fields[0], fields)).toBe('always')
    expect(fieldDisplay(fields[1], fields)).toBe('hidden')
  })

  it('merges field models without duplicating keys or roles', () => {
    const merged = mergeFields(DEFAULT_FIELDS, [
      { key: 'text', label: 'Other' },
      { key: 'gloss', label: 'Gloss', role: 'translation' },
    ])
    expect(merged.map((f) => f.key)).toEqual(['text', 'transcription', 'translation', 'notes', 'gloss'])
    expect(merged[0].label).toBe('Original')
    expect(merged[4].role).toBeUndefined()
  })
})

describe('demo pack', () => {
  it('is a valid v1 pack without warnings', async () => {
    const { readFileSync } = await import('node:fs')
    const bytes = readFileSync(new URL('../../../apps/player/public/demo/demo.zip', import.meta.url))
    const pack = await readPack(new Uint8Array(bytes))
    expect(pack.warnings).toEqual([])
    expect(pack.meta.fields.map((f) => f.key)).toEqual(['text', 'transcription', 'translation', 'literal', 'notes'])
    expect(pack.phrases).toHaveLength(6)
    expect(pack.phrases[1]).toMatchObject({ id: 'p0002', repeats: 2, values: { notes: 'zum = zu dem' } })
  })
})
