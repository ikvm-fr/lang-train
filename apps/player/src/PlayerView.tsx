import { useEffect, useReducer, useRef, useState } from 'react'
import type { KeepAliveMode, Player, Settings } from './engine/Player'
import { loadDisplay, saveDisplay, saveOverrides, saveSettings, type Display } from './storage'

// Re-render on engine events, plus frequent polling while the screen is visible.
function usePlayerTick(player: Player) {
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => player.subscribe(force), [player])
  useEffect(() => {
    let raf = 0
    let last = 0
    const loop = (t: number) => {
      if (t - last > 100) {
        last = t
        force()
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [player])
}

function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        const l = await navigator.wakeLock.request('screen')
        if (cancelled) void l.release()
        else lock = l
      } catch {
        /* denied, e.g. the page is no longer visible */
      }
    }
    const onVis = () => document.visibilityState === 'visible' && void acquire()
    void acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
      void lock?.release()
    }
  }, [enabled])
}

function Stepper(props: { label: string; value: string; onDec: () => void; onInc: () => void; hint?: string }) {
  return (
    <div className="stepper">
      <span className="label">{props.label}</span>
      <button onClick={props.onDec} aria-label="decrease">
        −
      </button>
      <span className="value">{props.value}</span>
      <button onClick={props.onInc} aria-label="increase">
        +
      </button>
      {props.hint && <span className="hint">{props.hint}</span>}
    </div>
  )
}

const round = (x: number) => Math.round(x * 10) / 10

export function PlayerView({ player, onKeepAlive }: { player: Player; onKeepAlive: (m: KeepAliveMode) => void }) {
  usePlayerTick(player)
  const [display, setDisplay] = useState<Display>(loadDisplay)
  useWakeLock(display.wakeLock)
  const listRef = useRef<HTMLOListElement>(null)

  const snap = player.snapshot()
  const settings = player.getSettings()
  const seg = player.pack.segments[snap.seg]
  const ov = player.getOverride(snap.seg)
  const baseRepeats = ov.repeats ?? settings.repeats
  const pauseExtra = ov.pauseExtra ?? settings.pauseExtra
  const bonus = player.bonusFor(snap.seg)

  useEffect(() => {
    listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' })
  }, [snap.seg])

  const setDisp = (patch: Partial<Display>) => {
    const d = { ...display, ...patch }
    setDisplay(d)
    saveDisplay(d)
  }
  const setSettings = (patch: Partial<Settings>) => {
    player.setSettings(patch)
    saveSettings(player.getSettings())
  }
  const setOverride = (patch: Parameters<Player['setOverride']>[1]) => {
    player.setOverride(snap.seg, patch)
    saveOverrides(player.pack.id, player.getOverrides())
  }

  const phaseLabel =
    snap.status === 'idle'
      ? 'Press ▶'
      : snap.status === 'paused'
        ? 'Paused'
        : snap.status === 'ended'
          ? 'Finished'
          : snap.phase === 'speaking'
            ? 'Listen'
            : snap.phase === 'pause'
              ? `Repeat · ${snap.phaseRemaining.toFixed(1)} s`
              : 'Getting ready…'

  return (
    <main className="player">
      <div className="pack-title">{player.pack.title}</div>

      <section className={`card phase-${snap.status === 'playing' ? snap.phase : snap.status}`}>
        <div className="meta">
          <span>
            {snap.seg + 1} / {player.pack.segments.length}
          </span>
          <span>
            repeat {Math.min(snap.rep + 1, snap.totalRepeats)} / {snap.totalRepeats}
          </span>
        </div>
        <div className="phase">{phaseLabel}</div>
        <div className="progress">
          <div style={{ width: `${Math.round(snap.phaseProgress * 100)}%` }} />
        </div>
        <p className="text">{seg.text || seg.file}</p>
        {display.transcription && seg.transcription && <p className="transcription">{seg.transcription}</p>}
        {display.translation && seg.translation && <p className="translation">{seg.translation}</p>}
        {display.notes && seg.notes && <p className="notes">{seg.notes}</p>}
      </section>

      <div className="controls">
        <button onClick={() => player.prev()} aria-label="previous">
          ⏮
        </button>
        <button className="primary big" onClick={() => player.toggle()} aria-label="play/pause">
          {snap.status === 'playing' ? '⏸' : '▶'}
        </button>
        <button onClick={() => player.next()} aria-label="next">
          ⏭
        </button>
      </div>

      <div className="quick">
        <button onClick={() => player.replayNow()}>↻ Again now</button>
        <button onClick={() => player.addRepeats(1)}>+1 repeat</button>
        <button onClick={() => player.addRepeats(3)}>+3</button>
      </div>

      <section className="panel">
        <h2>This phrase</h2>
        <Stepper
          label="Repeats"
          value={String(baseRepeats)}
          hint={bonus ? `+${bonus} now` : ov.repeats != null ? 'custom' : undefined}
          onDec={() => setOverride({ repeats: Math.max(1, baseRepeats - 1) })}
          onInc={() => setOverride({ repeats: Math.min(20, baseRepeats + 1) })}
        />
        <Stepper
          label="Extra pause"
          value={`${pauseExtra.toFixed(1)} s`}
          hint={ov.pauseExtra != null ? 'custom' : undefined}
          onDec={() => setOverride({ pauseExtra: Math.max(0, round(pauseExtra - 0.5)) })}
          onInc={() => setOverride({ pauseExtra: Math.min(30, round(pauseExtra + 0.5)) })}
        />
        {(ov.repeats != null || ov.pauseExtra != null) && (
          <button className="ghost" onClick={() => setOverride({ repeats: undefined, pauseExtra: undefined })}>
            Reset to defaults
          </button>
        )}
      </section>

      <details className="panel">
        <summary>General settings</summary>
        <Stepper
          label="Pause × length"
          value={settings.pauseFactor.toFixed(1)}
          onDec={() => setSettings({ pauseFactor: Math.max(0, round(settings.pauseFactor - 0.1)) })}
          onInc={() => setSettings({ pauseFactor: Math.min(5, round(settings.pauseFactor + 0.1)) })}
        />
        <Stepper
          label="+ seconds"
          value={settings.pauseExtra.toFixed(1)}
          onDec={() => setSettings({ pauseExtra: Math.max(0, round(settings.pauseExtra - 0.5)) })}
          onInc={() => setSettings({ pauseExtra: Math.min(30, round(settings.pauseExtra + 0.5)) })}
        />
        <Stepper
          label="Repeats"
          value={String(settings.repeats)}
          onDec={() => setSettings({ repeats: Math.max(1, settings.repeats - 1) })}
          onInc={() => setSettings({ repeats: Math.min(20, settings.repeats + 1) })}
        />
        <label className="check">
          <input type="checkbox" checked={settings.loop} onChange={(e) => setSettings({ loop: e.target.checked })} />
          Loop
        </label>
        <label className="check">
          <input type="checkbox" checked={display.translation} onChange={(e) => setDisp({ translation: e.target.checked })} />
          Translation
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={display.transcription}
            onChange={(e) => setDisp({ transcription: e.target.checked })}
          />
          Transcription
        </label>
        <label className="check">
          <input type="checkbox" checked={display.notes} onChange={(e) => setDisp({ notes: e.target.checked })} />
          Notes
        </label>
        <label className="check">
          <input type="checkbox" checked={display.wakeLock} onChange={(e) => setDisp({ wakeLock: e.target.checked })} />
          Keep screen on
        </label>
        <label className="select">
          Background mode (test)
          <select value={settings.keepAlive} onChange={(e) => onKeepAlive(e.target.value as KeepAliveMode)}>
            <option value="silent-audio">Silent track alongside</option>
            <option value="stream">Sound via &lt;audio&gt; stream</option>
            <option value="none">No keep-alive</option>
          </select>
        </label>
        <p className="muted small">Changing the background mode stops playback.</p>
      </details>

      <details className="panel">
        <summary>Phrases</summary>
        <ol className="list" ref={listRef}>
          {player.pack.segments.map((s, i) => (
            <li key={s.id} className={i === snap.seg ? 'active' : ''} onClick={() => player.jumpTo(i)}>
              {s.text || s.file}
            </li>
          ))}
        </ol>
      </details>

      <LogPanel player={player} />
    </main>
  )
}

function LogPanel({ player }: { player: Player }) {
  const [, force] = useReducer((x: number) => x + 1, 0)
  const [open, setOpen] = useState(false)
  useEffect(() => (open ? player.subscribeLog(force) : undefined), [player, open])
  const entries = player.getLog()
  const fmt = (e: (typeof entries)[number]) =>
    `${new Date(e.wall).toLocaleTimeString('en-GB')} [${e.ctx.toFixed(2)}] ${e.msg}`

  return (
    <details className="panel" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Log (background debugging)</summary>
      <button
        className="ghost"
        onClick={() => void navigator.clipboard?.writeText(entries.map(fmt).join('\n')).catch(() => {})}
      >
        Copy
      </button>
      <pre className="log">{open ? [...entries].reverse().map(fmt).join('\n') : ''}</pre>
    </details>
  )
}
