import type { Pack } from '@lang-train/pack'

// Shared test data: a pack cut from two recordings plus one phrase without a position.

const audio = new Uint8Array([1])
export const samplePack = (): Pack => ({
  meta: {
    format: 'lang-train-pack',
    version: 1,
    id: 'pack-1',
    title: 'Unit 3',
    lang: { target: 'de' },
    fields: [
      { key: 'text', label: 'Original', role: 'primary' },
      { key: 'translation', label: 'Translation', role: 'translation' },
    ],
    sources: [
      { id: 's1', name: 'a.mp3', duration: 30 },
      { id: 's2', name: 'b.mp3', duration: 20 },
    ],
  },
  phrases: [
    { id: 'p0001', file: 'audio/0001.mp3', values: { text: 'A', translation: 'a' }, source: 's1', start: 1, end: 2, repeats: 2, audio },
    { id: 'p0002', file: 'audio/0002.mp3', values: { text: 'B', translation: 'b' }, source: 's1', start: 3, end: 4, pause: 1.5, audio },
    { id: 'p0009', file: 'audio/0003.mp3', values: { text: 'C', translation: 'c' }, source: 's2', start: 0.5, end: 1.5, audio },
    { id: 'x', file: 'audio/0004.mp3', values: { text: 'D', translation: '' }, audio },
  ],
})
