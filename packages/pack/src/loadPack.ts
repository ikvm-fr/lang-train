import { unzipSync } from 'fflate'
import Papa from 'papaparse'

// Provisional pack format (prototype):
//   phrases.csv — required: file,text,translation,transcription,notes
//   pack.json   — optional: { id, title }
//   audio files — paths in the `file` column, relative to phrases.csv
// The pack may be nested inside a single top-level folder.

export interface Segment {
  id: string
  file: string
  text: string
  translation: string
  transcription: string
  notes: string
  audio: Uint8Array
}

export interface Pack {
  id: string
  title: string
  segments: Segment[]
}

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
  if (!crypto.subtle) return `csv-${bytes.length}`
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function loadPack(zipBytes: Uint8Array, fallbackTitle: string): Promise<Pack> {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(zipBytes)
  } catch (e) {
    throw new Error(`Failed to unpack ZIP: ${(e as Error).message}`)
  }

  const names = Object.keys(files).filter((n) => !n.startsWith('__MACOSX/'))
  const csvName = names
    .filter((n) => n.split('/').pop()?.toLowerCase() === 'phrases.csv')
    .sort((a, b) => a.split('/').length - b.split('/').length)[0]
  if (!csvName) throw new Error('phrases.csv not found in the archive')
  const dir = csvName.includes('/') ? csvName.slice(0, csvName.lastIndexOf('/') + 1) : ''

  const lookup = new Map<string, string>()
  for (const n of names) lookup.set(n.toLowerCase(), n)
  const find = (rel: string) => lookup.get((dir + normalizePath(rel)).toLowerCase())

  let meta: { id?: string; title?: string } = {}
  const metaName = find('pack.json')
  if (metaName) {
    try {
      meta = JSON.parse(decodeText(files[metaName]))
    } catch {
      throw new Error('pack.json: invalid JSON')
    }
  }

  const csvBytes = files[csvName]
  const parsed = Papa.parse<Record<string, string>>(decodeText(csvBytes), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase(),
  })
  if (!parsed.meta.fields?.includes('file')) throw new Error('phrases.csv: missing `file` column')

  const segments: Segment[] = []
  const missing: string[] = []
  for (const row of parsed.data) {
    const file = (row.file ?? '').trim()
    if (!file) continue
    const name = find(file)
    if (!name) {
      missing.push(file)
      continue
    }
    segments.push({
      id: row.id?.trim() || file,
      file,
      text: row.text?.trim() ?? '',
      translation: row.translation?.trim() ?? '',
      transcription: row.transcription?.trim() ?? '',
      notes: row.notes?.trim() ?? '',
      audio: files[name],
    })
  }
  if (missing.length) throw new Error(`Audio files not found: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`)
  if (!segments.length) throw new Error('phrases.csv contains no phrases')

  return {
    id: meta.id || (await hashId(csvBytes)),
    title: meta.title || fallbackTitle.replace(/\.zip$/i, ''),
    segments,
  }
}
