import type { Pack } from '@lang-train/pack'

// Playback engine. Independent of React.
//
// Core idea: phrases and pauses are laid out ahead of time on the AudioContext timeline
// (AudioBufferSourceNode.start(when)). Sound follows the audio clock, so timers throttled
// in the background (screen off) cannot break the pauses. JS only has to keep topping up
// the schedule with the next steps, LOOKAHEAD seconds ahead.

export type KeepAliveMode = 'silent-audio' | 'stream' | 'none'

export interface Settings {
  pauseFactor: number // pause = phrase duration × pauseFactor + pauseExtra
  pauseExtra: number
  repeats: number
  loop: boolean
  keepAlive: KeepAliveMode
}

export interface SegmentOverride {
  pauseExtra?: number
  repeats?: number
}

export type Status = 'idle' | 'playing' | 'paused' | 'ended'

export interface Snapshot {
  status: Status
  seg: number
  rep: number // index of the current play-through, 0-based
  totalRepeats: number
  phase: 'speaking' | 'pause' | 'waiting'
  phaseProgress: number // 0..1
  phaseRemaining: number // seconds
}

export interface LogEntry {
  wall: number
  ctx: number
  msg: string
}

interface Step {
  seg: number
  rep: number
  start: number
  end: number
  next: number
  src: AudioBufferSourceNode | null
}

const LOOKAHEAD = 30 // seconds of audio scheduled ahead
const MAX_PLANNED = 12
const TICK_MS = 250
const START_GAP = 0.08 // seconds before start on an immediate jump
const DECODE_AHEAD = 4

export const defaultSettings: Settings = {
  pauseFactor: 1.2,
  pauseExtra: 1.0,
  repeats: 1,
  loop: false,
  keepAlive: 'silent-audio',
}

function silentWavUrl(seconds = 10, rate = 8000): string {
  const n = seconds * rate
  const buf = new ArrayBuffer(44 + n * 2)
  const v = new DataView(buf)
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 36 + n * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, n * 2, true)
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}

let instances = 0

export class Player {
  readonly instance = ++instances
  readonly pack: Pack
  private settings: Settings
  private overrides: Record<string, SegmentOverride>
  private bonus = new Map<number, number>() // "+N repeats" for the current pass
  private ctx: AudioContext | null = null
  private out: AudioNode | null = null
  private keepAliveEl: HTMLAudioElement | null = null
  private keepAliveUrl: string | null = null
  private buffers = new Map<number, AudioBuffer>()
  private decoding = new Map<number, Promise<AudioBuffer>>()
  private planned: Step[] = []
  private cursor: { seg: number; rep: number; at: number } | null = null
  private startSeg = 0
  private status: Status = 'idle'
  private timer: number | null = null
  private ticking = false
  private lastTickWall = 0
  private lastReportedSeg = -1
  private listeners = new Set<() => void>()
  private logListeners = new Set<() => void>()
  private logEntries: LogEntry[] = []
  private disposed = false

  constructor(pack: Pack, settings: Settings, overrides: Record<string, SegmentOverride>) {
    this.pack = pack
    this.settings = { ...settings }
    this.overrides = { ...overrides }
    document.addEventListener('visibilitychange', this.onVisibility)
    this.log(`pack "${pack.title}", phrases: ${pack.segments.length}`)
  }

  // ---------- subscriptions ----------

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  subscribeLog(fn: () => void): () => void {
    this.logListeners.add(fn)
    return () => this.logListeners.delete(fn)
  }

  private emit() {
    this.listeners.forEach((fn) => fn())
  }

  getLog(): readonly LogEntry[] {
    return this.logEntries
  }

  log(msg: string) {
    this.logEntries = [...this.logEntries.slice(-299), { wall: Date.now(), ctx: this.ctx?.currentTime ?? 0, msg }]
    this.logListeners.forEach((fn) => fn())
  }

  // ---------- settings ----------

  getSettings(): Settings {
    return this.settings
  }

  getOverride(seg: number): SegmentOverride {
    return this.overrides[this.pack.segments[seg].id] ?? {}
  }

  getOverrides(): Record<string, SegmentOverride> {
    return this.overrides
  }

  setSettings(patch: Partial<Settings>) {
    // keepAlive only affects a new AudioContext: the UI recreates the player when it changes.
    this.settings = { ...this.settings, ...patch }
    this.replan()
    this.emit()
  }

  setOverride(seg: number, patch: SegmentOverride) {
    const id = this.pack.segments[seg].id
    const next = { ...this.overrides[id], ...patch }
    for (const k of Object.keys(next) as (keyof SegmentOverride)[]) if (next[k] === undefined) delete next[k]
    this.overrides = { ...this.overrides }
    if (Object.keys(next).length) this.overrides[id] = next
    else delete this.overrides[id]
    this.replan()
    this.emit()
  }

  repeatsFor(seg: number): number {
    return Math.max(1, (this.getOverride(seg).repeats ?? this.settings.repeats) + (this.bonus.get(seg) ?? 0))
  }

  pauseFor(seg: number, duration: number): number {
    const extra = this.getOverride(seg).pauseExtra ?? this.settings.pauseExtra
    return Math.max(0, duration * this.settings.pauseFactor + extra)
  }

  bonusFor(seg: number): number {
    return this.bonus.get(seg) ?? 0
  }

  // ---------- audio ----------

  private ensureContext() {
    if (this.ctx) return
    const ctx = new AudioContext({ latencyHint: 'playback' })
    this.ctx = ctx
    const mode = this.settings.keepAlive
    const el = new Audio()
    el.setAttribute('playsinline', '')
    if (mode === 'stream') {
      const dest = ctx.createMediaStreamDestination()
      this.out = dest
      el.srcObject = dest.stream
      this.keepAliveEl = el
    } else {
      this.out = ctx.destination
      if (mode === 'silent-audio') {
        this.keepAliveUrl = silentWavUrl()
        el.src = this.keepAliveUrl
        el.loop = true
        this.keepAliveEl = el
      }
    }
    ctx.onstatechange = () => this.log(`AudioContext: ${ctx.state}`)
    this.log(`AudioContext created, ${ctx.sampleRate} Hz, keep-alive: ${mode}`)
    this.setupMediaSession()
  }

  private decode(seg: number): Promise<AudioBuffer> {
    const ready = this.buffers.get(seg)
    if (ready) return Promise.resolve(ready)
    let p = this.decoding.get(seg)
    if (!p) {
      const bytes = this.pack.segments[seg].audio
      // decodeAudioData detaches the buffer, so pass a copy.
      p = this.ctx!.decodeAudioData(bytes.slice().buffer).then((b) => {
        this.buffers.set(seg, b)
        this.decoding.delete(seg)
        return b
      })
      p.catch((e) => {
        this.decoding.delete(seg)
        this.log(`decode error ${this.pack.segments[seg].file}: ${e}`)
      })
      this.decoding.set(seg, p)
    }
    return p
  }

  // Keep only a window around the current phrase in memory.
  private trimBuffers(center: number) {
    const n = this.pack.segments.length
    for (const k of this.buffers.keys()) {
      const d = Math.min(Math.abs(k - center), n - Math.abs(k - center))
      if (d > DECODE_AHEAD + 2) this.buffers.delete(k)
    }
  }

  private nextOf(seg: number, rep: number): { seg: number; rep: number } | null {
    if (rep + 1 < this.repeatsFor(seg)) return { seg, rep: rep + 1 }
    if (seg + 1 < this.pack.segments.length) return { seg: seg + 1, rep: 0 }
    return this.settings.loop ? { seg: 0, rep: 0 } : null
  }

  private async tick() {
    if (this.ticking || !this.ctx || this.status !== 'playing' || this.disposed) return
    this.ticking = true
    try {
      const wall = performance.now()
      if (this.lastTickWall && wall - this.lastTickWall > 3000) {
        this.log(`timer gap ${((wall - this.lastTickWall) / 1000).toFixed(1)} s (${document.visibilityState})`)
      }
      this.lastTickWall = wall
      const ctx = this.ctx
      const now = ctx.currentTime
      this.planned = this.planned.filter((s) => s.next > now - 1)

      while (
        this.cursor &&
        this.planned.length < MAX_PLANNED &&
        (this.planned.length < 2 || this.cursor.at < now + LOOKAHEAD)
      ) {
        const { seg, rep } = this.cursor
        const buf = await this.decode(seg)
        if (this.disposed || this.status !== 'playing' || this.cursor?.seg !== seg || this.cursor.rep !== rep) break
        const t = ctx.currentTime
        let start = this.cursor.at
        if (start < t + 0.02) {
          if (start < t - 0.05 && this.planned.length) this.log(`late by ${(t - start).toFixed(2)} s`)
          start = t + START_GAP
        }
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.connect(this.out!)
        src.start(start)
        const step: Step = { seg, rep, start, end: start + buf.duration, next: 0, src }
        step.next = step.end + this.pauseFor(seg, buf.duration)
        src.onended = () => {
          src.disconnect()
          void this.tick()
        }
        this.planned.push(step)
        const nx = this.nextOf(seg, rep)
        this.cursor = nx ? { ...nx, at: step.next } : null
        for (let k = 1; k <= DECODE_AHEAD; k++) {
          const s = (seg + k) % this.pack.segments.length
          if (s > seg || this.settings.loop) void this.decode(s).catch(() => {})
        }
      }

      const cur = this.current()
      if (cur && cur.seg !== this.lastReportedSeg) {
        this.lastReportedSeg = cur.seg
        for (const k of this.bonus.keys()) if (k !== cur.seg) this.bonus.delete(k)
        this.trimBuffers(cur.seg)
        this.updateMetadata(cur.seg)
        this.emit()
      }
      if (!this.cursor && !this.planned.some((s) => s.next > now)) {
        this.log('end of pack')
        this.status = 'ended'
        this.startSeg = 0
        this.stopTimer()
        this.keepAliveEl?.pause()
        this.setPlaybackState('none')
        this.emit()
      }
    } catch (e) {
      this.log(`error: ${(e as Error).message ?? e}`)
    } finally {
      this.ticking = false
    }
  }

  private current(): Step | null {
    if (!this.ctx) return null
    const now = this.ctx.currentTime
    for (const s of this.planned) if (now < s.next) return s
    return null
  }

  // Cancels everything not yet started and rebuilds the plan with the current settings.
  private replan() {
    if (!this.ctx || this.status === 'idle' || this.status === 'ended') return
    const now = this.ctx.currentTime
    const keep = this.planned.filter((s) => s.start <= now)
    const dropped = this.planned.filter((s) => s.start > now)
    dropped.forEach((s) => this.cancelStep(s))
    this.planned = keep
    const cur = keep[keep.length - 1]
    if (cur) {
      cur.next = cur.end + this.pauseFor(cur.seg, cur.end - cur.start)
      const nx = this.nextOf(cur.seg, cur.rep)
      this.cursor = nx ? { ...nx, at: cur.next } : null
    } else if (dropped.length) {
      const first = dropped[0]
      this.cursor = { seg: first.seg, rep: first.rep, at: first.start }
    }
    void this.tick()
  }

  private cancelStep(s: Step) {
    if (!s.src) return
    s.src.onended = null
    try {
      s.src.stop()
    } catch {
      /* not started yet in some browsers */
    }
    s.src.disconnect()
    s.src = null
  }

  private startTimer() {
    if (this.timer == null) this.timer = window.setInterval(() => void this.tick(), TICK_MS)
  }

  private stopTimer() {
    if (this.timer != null) clearInterval(this.timer)
    this.timer = null
  }

  // ---------- commands ----------

  async play() {
    if (this.status === 'playing') return
    this.ensureContext()
    const ctx = this.ctx!
    this.keepAliveEl?.play().catch((e) => this.log(`keep-alive play(): ${e}`))
    if (ctx.state !== 'running') await ctx.resume()
    if (this.status === 'idle' || this.status === 'ended') {
      this.planned.forEach((s) => this.cancelStep(s))
      this.planned = []
      this.bonus.clear()
      this.cursor = { seg: this.startSeg, rep: 0, at: 0 }
    }
    this.status = 'playing'
    this.lastTickWall = 0
    this.setPlaybackState('playing')
    this.startTimer()
    this.log('play')
    this.emit()
    await this.tick()
  }

  async pause() {
    if (this.status !== 'playing' || !this.ctx) return
    this.status = 'paused'
    this.stopTimer()
    await this.ctx.suspend()
    this.keepAliveEl?.pause()
    this.setPlaybackState('paused')
    this.log('pause')
    this.emit()
  }

  toggle() {
    void (this.status === 'playing' ? this.pause() : this.play())
  }

  jumpTo(seg: number) {
    const n = this.pack.segments.length
    seg = ((seg % n) + n) % n
    this.bonus.clear()
    this.startSeg = seg
    this.lastReportedSeg = -1
    if (!this.ctx || this.status === 'idle' || this.status === 'ended') {
      this.emit()
      return
    }
    this.planned.forEach((s) => this.cancelStep(s))
    this.planned = []
    this.cursor = { seg, rep: 0, at: 0 }
    this.log(`jump to phrase ${seg + 1}`)
    if (this.status === 'playing') void this.tick()
    this.emit()
  }

  next() {
    this.jumpTo(this.currentSeg() + 1)
  }

  prev() {
    this.jumpTo(this.currentSeg() - 1)
  }

  replayNow() {
    this.jumpTo(this.currentSeg())
  }

  addRepeats(n: number) {
    const seg = this.currentSeg()
    this.bonus.set(seg, (this.bonus.get(seg) ?? 0) + n)
    this.log(`+${n} repeat(s) for phrase ${seg + 1}`)
    this.replan()
    this.emit()
  }

  currentSeg(): number {
    return this.current()?.seg ?? this.cursor?.seg ?? this.startSeg
  }

  snapshot(): Snapshot {
    const cur = this.current()
    const now = this.ctx?.currentTime ?? 0
    const seg = this.currentSeg()
    const base = { status: this.status, seg, totalRepeats: this.repeatsFor(seg) }
    if (!cur) return { ...base, rep: this.cursor?.rep ?? 0, phase: 'waiting', phaseProgress: 0, phaseRemaining: 0 }
    if (now < cur.start) return { ...base, rep: cur.rep, phase: 'waiting', phaseProgress: 0, phaseRemaining: cur.start - now }
    if (now < cur.end) {
      return {
        ...base,
        rep: cur.rep,
        phase: 'speaking',
        phaseProgress: (now - cur.start) / (cur.end - cur.start),
        phaseRemaining: cur.end - now,
      }
    }
    const len = cur.next - cur.end
    return {
      ...base,
      rep: cur.rep,
      phase: 'pause',
      phaseProgress: len > 0 ? (now - cur.end) / len : 1,
      phaseRemaining: cur.next - now,
    }
  }

  // ---------- Media Session (notification, lock screen, headset buttons) ----------

  private setupMediaSession() {
    if (!('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    const set = (a: MediaSessionAction, h: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(a, h)
      } catch {
        /* action not supported */
      }
    }
    set('play', () => {
      this.log('media: play')
      void this.play()
    })
    set('pause', () => {
      this.log('media: pause')
      void this.pause()
    })
    set('nexttrack', () => {
      this.log('media: next → next phrase')
      this.next()
    })
    set('previoustrack', () => {
      this.log('media: previous → +1 repeat')
      this.addRepeats(1)
    })
    set('seekforward', () => {
      this.log('media: seekforward → next phrase')
      this.next()
    })
    set('seekbackward', () => {
      this.log('media: seekbackward → previous phrase')
      this.prev()
    })
    this.updateMetadata(this.startSeg)
  }

  private updateMetadata(seg: number) {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return
    const s = this.pack.segments[seg]
    navigator.mediaSession.metadata = new MediaMetadata({
      title: s.text || s.file,
      artist: s.translation,
      album: `${this.pack.title} · ${seg + 1}/${this.pack.segments.length}`,
      artwork: [{ src: new URL('icon-512.png', document.baseURI).href, sizes: '512x512', type: 'image/png' }],
    })
  }

  private setPlaybackState(state: MediaSessionPlaybackState) {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = state
  }

  private onVisibility = () => {
    this.log(`page: ${document.visibilityState}`)
    if (document.visibilityState === 'visible') void this.tick()
  }

  // ---------- teardown ----------

  async dispose() {
    this.disposed = true
    this.stopTimer()
    document.removeEventListener('visibilitychange', this.onVisibility)
    this.planned.forEach((s) => this.cancelStep(s))
    this.planned = []
    this.keepAliveEl?.pause()
    if (this.keepAliveEl) {
      this.keepAliveEl.srcObject = null
      this.keepAliveEl.removeAttribute('src')
    }
    if (this.keepAliveUrl) URL.revokeObjectURL(this.keepAliveUrl)
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null
      this.setPlaybackState('none')
    }
    await this.ctx?.close().catch(() => {})
    this.ctx = null
    this.listeners.clear()
    this.logListeners.clear()
  }
}
