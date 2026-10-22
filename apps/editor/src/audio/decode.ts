import { editorError } from '../errors'
// Decodes an audio file into a mono PCM buffer at a fixed sample rate.
// 24 kHz mono keeps speech quality and needs ~350 MB per hour (see docs/editor.md).

export const SAMPLE_RATE = 24000
export const LONG_FILE_SECONDS = 90 * 60

export async function decodeFile(file: Blob): Promise<AudioBuffer> {
  const bytes = await file.arrayBuffer()
  // decodeAudioData resamples to the context's sample rate.
  const ctx = new OfflineAudioContext({ numberOfChannels: 1, length: 1, sampleRate: SAMPLE_RATE })
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(bytes)
  } catch {
    throw editorError('decodeFailed')
  }
  if (decoded.numberOfChannels === 1) return decoded

  const mono = new AudioBuffer({ length: decoded.length, numberOfChannels: 1, sampleRate: decoded.sampleRate })
  const out = mono.getChannelData(0)
  const n = decoded.numberOfChannels
  for (let c = 0; c < n; c++) {
    const data = decoded.getChannelData(c)
    for (let i = 0; i < data.length; i++) out[i] += data[i] / n
  }
  return mono
}
