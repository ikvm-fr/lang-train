import { strToU8, zipSync, type Zippable } from 'fflate'
import Papa from 'papaparse'
import type { Pack } from './types'

// Writes a pack ZIP in format v1. Audio is stored uncompressed.

const BOM = '﻿'

function formatSeconds(n: number): string {
  return n.toFixed(3)
}

export function buildPhrasesCsv(pack: Pack): string {
  const { phrases } = pack
  const fieldKeys = pack.meta.fields.map((f) => f.key)
  const optional = (['pause', 'repeats', 'source', 'start', 'end'] as const).filter((c) =>
    phrases.some((p) => p[c] !== undefined),
  )
  const header = ['id', 'file', ...fieldKeys, ...optional]
  const rows = phrases.map((p) => [
    p.id,
    p.file,
    ...fieldKeys.map((k) => p.values[k] ?? ''),
    ...optional.map((c) => {
      const v = p[c]
      if (v === undefined) return ''
      return c === 'start' || c === 'end' ? formatSeconds(v as number) : String(v)
    }),
  ])
  return BOM + Papa.unparse({ fields: header, data: rows }, { newline: '\r\n' }) + '\r\n'
}

export function buildPackJson(pack: Pack): string {
  // JSON.stringify drops keys whose value is undefined.
  return JSON.stringify(pack.meta, null, 2) + '\n'
}

export function writePack(pack: Pack): Uint8Array {
  const entries: Zippable = {
    'pack.json': [strToU8(buildPackJson(pack)), { level: 6 }],
    'phrases.csv': [strToU8(buildPhrasesCsv(pack)), { level: 6 }],
  }
  for (const p of pack.phrases) entries[p.file] = [p.audio, { level: 0 }]
  return zipSync(entries)
}
