import { editorError } from '../errors'
import type { EncodeRequest, EncodeResponse } from './encode.worker'

// Promise-based client for the MP3 encoding worker.

export class Mp3EncoderPool {
  private worker = new Worker(new URL('./encode.worker.ts', import.meta.url), { type: 'module' })
  private pending = new Map<number, { resolve: (b: Uint8Array) => void; reject: (e: Error) => void }>()
  private nextId = 1

  constructor() {
    this.worker.onmessage = (e: MessageEvent<EncodeResponse>) => {
      const p = this.pending.get(e.data.id)
      if (!p) return
      this.pending.delete(e.data.id)
      if (e.data.mp3) p.resolve(e.data.mp3)
      else p.reject(editorError('encodeFailed', { detail: e.data.error ?? '?' }))
    }
    this.worker.onerror = (e) => {
      const err = editorError('encodeFailed', { detail: e.message })
      this.pending.forEach((p) => p.reject(err))
      this.pending.clear()
    }
  }

  encode(samples: Float32Array, sampleRate: number, kbps: number): Promise<Uint8Array> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      const req: EncodeRequest = { id, samples, sampleRate, kbps }
      this.worker.postMessage(req, [samples.buffer])
    })
  }

  dispose() {
    this.worker.terminate()
  }
}
