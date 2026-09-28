/// <reference lib="webworker" />
import { Mp3Encoder } from '@breezystack/lamejs'

// Encodes mono float PCM into MP3 (CBR).

export interface EncodeRequest {
  id: number
  samples: Float32Array
  sampleRate: number
  kbps: number
}

export interface EncodeResponse {
  id: number
  mp3?: Uint8Array
  error?: string
}

const BLOCK = 1152

self.onmessage = (e: MessageEvent<EncodeRequest>) => {
  const { id, samples, sampleRate, kbps } = e.data
  try {
    const pcm = new Int16Array(samples.length)
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]))
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    const encoder = new Mp3Encoder(1, sampleRate, kbps)
    const chunks: Uint8Array[] = []
    for (let i = 0; i < pcm.length; i += BLOCK) {
      const out = encoder.encodeBuffer(pcm.subarray(i, i + BLOCK))
      if (out.length) chunks.push(out)
    }
    const tail = encoder.flush()
    if (tail.length) chunks.push(tail)
    const mp3 = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
    let o = 0
    for (const c of chunks) {
      mp3.set(c, o)
      o += c.length
    }
    ;(self as unknown as Worker).postMessage({ id, mp3 } satisfies EncodeResponse, [mp3.buffer])
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, error: String(err) } satisfies EncodeResponse)
  }
}
