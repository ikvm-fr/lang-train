import type { EventEmitterForPlayerEvents, PlayerAdapter } from 'peaks.js'

// peaks.js player adapter that plays the decoded buffer through Web Audio.
// Seeking through <audio> in a VBR MP3 is imprecise; playing the same PCM the export cuts from
// guarantees that what you hear at a position is exactly what gets exported.

export class WebAudioPlayer implements PlayerAdapter {
  private ctx: AudioContext | null = null
  private emitter: EventEmitterForPlayerEvents | null = null
  private source: AudioBufferSourceNode | null = null
  private offset = 0 // position while paused
  private startedAt = 0 // ctx time corresponding to position 0 while playing
  private range: { end: number; loop: boolean; start: number } | null = null
  private raf = 0
  private listeners = new Set<() => void>()
  private readonly buffer: AudioBuffer

  constructor(buffer: AudioBuffer) {
    this.buffer = buffer
  }

  // ----- PlayerAdapter -----

  init(emitter: EventEmitterForPlayerEvents): Promise<void> {
    this.emitter = emitter
    this.ctx = new AudioContext()
    emitter.emit('player.canplay')
    return Promise.resolve()
  }

  destroy() {
    this.stopSource()
    cancelAnimationFrame(this.raf)
    void this.ctx?.close()
    this.ctx = null
    this.listeners.clear()
  }

  async play(): Promise<void> {
    this.range = null
    await this.start(this.offset >= this.getDuration() ? 0 : this.offset)
  }

  pause() {
    if (!this.source) return
    this.offset = this.getCurrentTime()
    this.stopSource()
    this.range = null
    this.emitter?.emit('player.pause', this.offset)
    this.notify()
  }

  isPlaying(): boolean {
    return this.source !== null
  }

  isSeeking(): boolean {
    return false
  }

  getCurrentTime(): number {
    if (!this.source || !this.ctx) return this.offset
    return Math.min(this.ctx.currentTime - this.startedAt, this.getDuration())
  }

  getDuration(): number {
    return this.buffer.duration
  }

  seek(time: number) {
    const t = Math.max(0, Math.min(time, this.getDuration()))
    if (this.source) {
      const range = this.range
      void this.start(t, range && t < range.end ? range : null)
    } else {
      this.offset = t
      this.notify()
    }
    this.emitter?.emit('player.seeked', t)
    this.emitter?.emit('player.timeupdate', t)
  }

  // ----- extras -----

  // Plays [start, end) sample-accurately, optionally looping.
  playRange(start: number, end: number, loop = false) {
    void this.start(start, { start, end, loop })
  }

  isLooping(): boolean {
    return !!this.range?.loop
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  // ----- internals -----

  private async start(from: number, range: WebAudioPlayer['range'] = null) {
    const ctx = this.ctx
    if (!ctx) return
    this.stopSource()
    if (ctx.state !== 'running') await ctx.resume()
    const src = ctx.createBufferSource()
    src.buffer = this.buffer
    src.connect(ctx.destination)
    const when = ctx.currentTime + 0.01
    if (range) src.start(when, from, Math.max(0, range.end - from))
    else src.start(when, from)
    this.source = src
    this.range = range
    this.startedAt = when - from
    src.onended = () => {
      if (this.source !== src) return
      this.source = null
      const r = this.range
      if (r?.loop) {
        void this.start(r.start, r)
        return
      }
      this.offset = r ? r.end : this.getDuration()
      this.range = null
      this.emitter?.emit('player.pause', this.offset)
      if (!r) this.emitter?.emit('player.ended')
      this.notify()
    }
    this.emitter?.emit('player.playing', from)
    this.notify()
    this.tick()
  }

  private stopSource() {
    const src = this.source
    this.source = null
    if (!src) return
    src.onended = null
    try {
      src.stop()
    } catch {
      /* already stopped */
    }
    src.disconnect()
  }

  private tick = () => {
    cancelAnimationFrame(this.raf)
    if (!this.source) return
    this.emitter?.emit('player.timeupdate', this.getCurrentTime())
    this.notify()
    this.raf = requestAnimationFrame(this.tick)
  }

  private notify() {
    this.listeners.forEach((fn) => fn())
  }
}
