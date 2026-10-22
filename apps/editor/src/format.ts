// m:ss.mmm (or h:mm:ss.mmm)
export function formatTime(t: number): string {
  const ms = Math.round(t * 1000)
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor(ms / 60_000) % 60
  const s = Math.floor(ms / 1000) % 60
  const frac = String(ms % 1000).padStart(3, '0')
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}.${frac}` : `${m}:${ss}.${frac}`
}
