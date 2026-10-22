import { unzipSync } from 'fflate'
import Papa from 'papaparse'
import { packError } from './errors'
import { DEFAULT_FIELDS, FIELD_KEY_PATTERN, isReservedColumn } from './fields'
import { PACK_FORMAT, PACK_VERSION, type FieldDef, type PackMeta, type Phrase, type ReadResult } from './types'

// Reads a pack ZIP (format v1, or the prototype format without pack.json).

function decodeText(bytes: Uint8Array): string {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    // Excel on Russian-locale Windows saves CSV as cp1251.
    text = new TextDecoder('windows-1251').decode(bytes)
  }
  return text.replace(/^﻿/, '')
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '')
}

async function hashId(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) return `csv-${bytes.length}`
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('')
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const optString = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

function parseFields(raw: unknown, warnings: string[]): FieldDef[] {
  if (!Array.isArray(raw) || raw.length === 0) throw packError('fieldsInvalid')
  const seen = new Set<string>()
  const roles = new Set<string>()
  return raw.map((f, i) => {
    if (!isObject(f)) throw packError('fieldNotObject', { index: i })
    const key = typeof f.key === 'string' ? f.key.trim() : ''
    if (!FIELD_KEY_PATTERN.test(key)) throw packError('invalidFieldKey', { key })
    if (isReservedColumn(key)) throw packError('reservedFieldKey', { key })
    if (seen.has(key)) throw packError('duplicateFieldKey', { key })
    seen.add(key)

    const field: FieldDef = { key, label: optString(f.label) ?? key }
    if (f.role === 'primary' || f.role === 'translation') {
      if (roles.has(f.role)) warnings.push(`pack.json: more than one field with role "${f.role}", ignored on "${key}"`)
      else {
        roles.add(f.role)
        field.role = f.role
      }
    } else if (f.role !== undefined) warnings.push(`pack.json: unknown role "${String(f.role)}" on "${key}"`)
    if (f.multiline === true) field.multiline = true
    if (f.display === 'always' || f.display === 'toggle' || f.display === 'hidden') field.display = f.display
    else if (f.display !== undefined) warnings.push(`pack.json: unknown display "${String(f.display)}" on "${key}"`)
    const lang = optString(f.lang)
    if (lang) field.lang = lang
    if (f.dir === 'ltr' || f.dir === 'rtl') field.dir = f.dir
    return field
  })
}

function parseDefaults(raw: unknown): PackMeta['defaults'] {
  if (!isObject(raw)) return undefined
  const out: NonNullable<PackMeta['defaults']> = {}
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined)
  if (num(raw.pauseFactor) !== undefined) out.pauseFactor = num(raw.pauseFactor)
  if (num(raw.pauseExtra) !== undefined) out.pauseExtra = num(raw.pauseExtra)
  const r = num(raw.repeats)
  if (r !== undefined && Number.isInteger(r) && r >= 1) out.repeats = r
  return Object.keys(out).length ? out : undefined
}

function parseSources(raw: unknown): PackMeta['sources'] {
  if (!Array.isArray(raw)) return undefined
  return raw
    .filter(isObject)
    .filter((s) => typeof s.id === 'string' && typeof s.name === 'string')
    .map((s) => ({
      id: s.id as string,
      name: s.name as string,
      ...(typeof s.duration === 'number' ? { duration: s.duration } : {}),
    }))
}

function parseMeta(raw: unknown, warnings: string[]): Partial<PackMeta> & { legacy: boolean } {
  if (!isObject(raw)) throw packError('metaNotObject')
  if (raw.format === undefined) {
    // Prototype pack.json: only id and title.
    return { legacy: true, id: optString(raw.id), title: optString(raw.title) }
  }
  if (raw.format !== PACK_FORMAT) throw packError('unknownFormat', { format: String(raw.format) })
  const version = raw.version ?? 1
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw packError('invalidVersion')
  }
  if (version > PACK_VERSION) {
    throw packError('newerVersion', { version, supported: PACK_VERSION })
  }
  const id = optString(raw.id)
  if (!id) throw packError('missingId')
  return {
    ...raw,
    legacy: false,
    format: PACK_FORMAT,
    version,
    id,
    title: optString(raw.title),
    fields: parseFields(raw.fields, warnings),
    defaults: parseDefaults(raw.defaults),
    sources: parseSources(raw.sources),
  }
}

function parseNumber(v: string | undefined, what: string, row: number, warnings: string[], check: (n: number) => boolean) {
  const s = v?.trim()
  if (!s) return undefined
  const n = Number(s.replace(',', '.'))
  if (!Number.isFinite(n) || !check(n)) {
    warnings.push(`phrases.csv row ${row}: invalid ${what} "${s}", ignored`)
    return undefined
  }
  return n
}

export async function readPack(zipBytes: Uint8Array, fallbackTitle = 'Untitled'): Promise<ReadResult> {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(zipBytes)
  } catch (e) {
    throw packError('unzipFailed', { detail: (e as Error).message })
  }
  const warnings: string[] = []

  const names = Object.keys(files).filter((n) => !n.startsWith('__MACOSX/') && !n.endsWith('/'))
  const csvName = names
    .filter((n) => n.split('/').pop()?.toLowerCase() === 'phrases.csv')
    .sort((a, b) => a.split('/').length - b.split('/').length)[0]
  if (!csvName) throw packError('csvNotFound')
  const dir = csvName.includes('/') ? csvName.slice(0, csvName.lastIndexOf('/') + 1) : ''

  const lookup = new Map<string, string>()
  for (const n of names) lookup.set(n.toLowerCase(), n)
  const find = (rel: string) => lookup.get((dir + normalizePath(rel)).toLowerCase())

  let meta: ReturnType<typeof parseMeta> = { legacy: true }
  const metaName = find('pack.json')
  if (metaName) {
    let json: unknown
    try {
      json = JSON.parse(decodeText(files[metaName]))
    } catch {
      throw packError('metaInvalidJson')
    }
    meta = parseMeta(json, warnings)
  }

  const csvBytes = files[csvName]
  const parsed = Papa.parse<Record<string, string>>(decodeText(csvBytes), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  })
  const columns = parsed.meta.fields ?? []
  if (!columns.includes('file')) throw packError('missingFileColumn')

  // Declared fields first, then undeclared CSV columns as extra fields.
  const declared: FieldDef[] = meta.legacy ? DEFAULT_FIELDS.map((f) => ({ ...f })) : [...meta.fields!]
  const declaredKeys = new Set(declared.map((f) => f.key))
  const extra: FieldDef[] = columns
    .filter((c) => c && !isReservedColumn(c) && !declaredKeys.has(c))
    .map((c) => ({ key: c, label: c, display: 'toggle' }))
  const fields = [...declared, ...extra]

  const phrases: Phrase[] = []
  const missing: string[] = []
  const ids = new Set<string>()
  parsed.data.forEach((row, i) => {
    const rowNo = i + 2 // header is row 1
    const file = row.file?.trim()
    if (!file) {
      warnings.push(`phrases.csv row ${rowNo}: empty \`file\`, skipped`)
      return
    }
    const name = find(file)
    if (!name) {
      missing.push(file)
      return
    }
    const id = row.id?.trim() || file
    if (ids.has(id)) throw packError('duplicatePhraseId', { id })
    ids.add(id)

    const values: Record<string, string> = {}
    for (const f of fields) values[f.key] = (row[f.key] ?? '').replace(/^\s+|\s+$/g, '')

    const phrase: Phrase = { id, file, values, audio: files[name] }
    const pause = parseNumber(row.pause, 'pause', rowNo, warnings, (n) => n >= 0)
    const repeats = parseNumber(row.repeats, 'repeats', rowNo, warnings, (n) => Number.isInteger(n) && n >= 1)
    const start = parseNumber(row.start, 'start', rowNo, warnings, (n) => n >= 0)
    const end = parseNumber(row.end, 'end', rowNo, warnings, (n) => n >= 0)
    if (pause !== undefined) phrase.pause = pause
    if (repeats !== undefined) phrase.repeats = repeats
    if (start !== undefined) phrase.start = start
    if (end !== undefined) phrase.end = end
    const source = row.source?.trim()
    if (source) phrase.source = source
    phrases.push(phrase)
  })
  if (missing.length) {
    throw packError('audioNotFound', { files: `${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}` })
  }
  if (!phrases.length) throw packError('noPhrases')

  const { legacy, ...rest } = meta
  const result: PackMeta = {
    ...rest,
    format: PACK_FORMAT,
    version: rest.version ?? PACK_VERSION,
    id: rest.id ?? (await hashId(csvBytes)),
    title: rest.title ?? fallbackTitle.replace(/\.zip$/i, ''),
    fields,
  }
  if (legacy) warnings.push('Prototype pack without a v1 pack.json; default fields assumed')
  return { meta: result, phrases, warnings }
}
