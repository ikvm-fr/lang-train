import { useEffect, useReducer, useRef, useState } from 'react'
import { DEFAULT_FIELDS, fieldDisplay, primaryField, type FieldDef } from '@lang-train/pack'
import { LanguageSelect } from '@lang-train/i18n'
import type { KeepAliveMode, Player, Settings } from './engine/Player'
import { i18n, useI18n } from './i18n'
import {
  loadDisplay,
  loadFieldVisibility,
  saveDisplay,
  saveFieldVisibility,
  saveOverrides,
  saveUserSettings,
  type Display,
} from './storage'

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
  const { t } = useI18n()
  return (
    <div className="stepper">
      <span className="label">{props.label}</span>
      <button onClick={props.onDec} aria-label={t('aria.decrease')}>
        −
      </button>
      <span className="value">{props.value}</span>
      <button onClick={props.onInc} aria-label={t('aria.increase')}>
        +
      </button>
      {props.hint && <span className="hint">{props.hint}</span>}
    </div>
  )
}

const round = (x: number) => Math.round(x * 10) / 10

// Default field names (still English, as in prototype and demo packs) are shown in the UI language.
function fieldLabel(f: FieldDef): string {
  const isDefault = DEFAULT_FIELDS.some((d) => d.key === f.key && d.label === f.label)
  return (isDefault && i18n.tryT(`field.${f.key}`)) || f.label
}

export function PlayerView({ player, onKeepAlive }: { player: Player; onKeepAlive: (m: KeepAliveMode) => void }) {
  const { t, number } = useI18n()
  usePlayerTick(player)
  const [display, setDisplay] = useState<Display>(loadDisplay)
  const [visibility, setVisibility] = useState(() => loadFieldVisibility(player.pack.meta.id))
  useWakeLock(display.wakeLock)
  const listRef = useRef<HTMLOListElement>(null)

  const { meta, phrases } = player.pack
  const fields = meta.fields
  const primary = primaryField(fields)
  const toggleable = fields.filter((f) => fieldDisplay(f, fields) === 'toggle')
  const isShown = (f: FieldDef) => {
    const d = fieldDisplay(f, fields)
    return d === 'always' || (d === 'toggle' && visibility[f.key] !== false)
  }
  const primaryText = (i: number) => (primary && phrases[i].values[primary.key]) || phrases[i].file

  const snap = player.snapshot()
  const settings = player.getSettings()
  const phrase = phrases[snap.seg]
  const ov = player.getOverride(snap.seg)
  const baseRepeats = ov.repeats ?? phrase.repeats ?? settings.repeats
  const pauseExtra = ov.pauseExtra ?? phrase.pause ?? settings.pauseExtra
  const bonus = player.bonusFor(snap.seg)
  const hint = (own: unknown, fromPack: unknown) =>
    own != null ? t('hint.custom') : fromPack != null ? t('hint.pack') : undefined
  const seconds = (v: number) => t('unit.seconds', { value: number(v, 1) })

  useEffect(() => {
    listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' })
  }, [snap.seg])

  const setDisp = (patch: Partial<Display>) => {
    const d = { ...display, ...patch }
    setDisplay(d)
    saveDisplay(d)
  }
  const setShown = (key: string, shown: boolean) => {
    const v = { ...visibility, [key]: shown }
    setVisibility(v)
    saveFieldVisibility(meta.id, v)
  }
  const setSettings = (patch: Partial<Settings>) => {
    player.setSettings(patch)
    saveUserSettings(patch)
  }
  const setOverride = (patch: Parameters<Player['setOverride']>[1]) => {
    player.setOverride(snap.seg, patch)
    saveOverrides(meta.id, player.getOverrides())
  }

  const phaseLabel =
    snap.status === 'idle'
      ? t('phase.press')
      : snap.status === 'paused'
        ? t('phase.paused')
        : snap.status === 'ended'
          ? t('phase.finished')
          : snap.phase === 'speaking'
            ? t('phase.listen')
            : snap.phase === 'pause'
              ? t('phase.repeat', { seconds: number(snap.phaseRemaining, 1) })
              : t('phase.ready')

  return (
    <main className="player">
      <div className="pack-title">{meta.title}</div>

      <section className={`card phase-${snap.status === 'playing' ? snap.phase : snap.status}`}>
        <div className="meta">
          <span>
            {snap.seg + 1} / {phrases.length}
          </span>
          <span>{t('card.repeatOf', { n: Math.min(snap.rep + 1, snap.totalRepeats), total: snap.totalRepeats })}</span>
        </div>
        <div className="phase">{phaseLabel}</div>
        <div className="progress">
          <div style={{ width: `${Math.round(snap.phaseProgress * 100)}%` }} />
        </div>
        <p className="text" lang={primary?.lang} dir={primary?.dir}>
          {primaryText(snap.seg)}
        </p>
        {fields
          .filter((f) => f !== primary && isShown(f) && phrase.values[f.key])
          .map((f) => (
            <p
              key={f.key}
              className={`field${f.role ? ` role-${f.role}` : ''}${f.multiline ? ' multiline' : ''}`}
              lang={f.lang}
              dir={f.dir}
              title={fieldLabel(f)}
            >
              {phrase.values[f.key]}
            </p>
          ))}
      </section>

      <div className="controls">
        <button onClick={() => player.prev()} aria-label={t('aria.previous')}>
          ⏮
        </button>
        <button className="primary big" onClick={() => player.toggle()} aria-label={t('aria.playPause')}>
          {snap.status === 'playing' ? '⏸' : '▶'}
        </button>
        <button onClick={() => player.next()} aria-label={t('aria.next')}>
          ⏭
        </button>
      </div>

      <div className="quick">
        <button onClick={() => player.replayNow()}>{t('quick.again')}</button>
        <button onClick={() => player.addRepeats(1)}>{t('quick.plusOne')}</button>
        <button onClick={() => player.addRepeats(3)}>+3</button>
      </div>

      <section className="panel">
        <h2>{t('phrase.title')}</h2>
        <Stepper
          label={t('phrase.repeats')}
          value={String(baseRepeats)}
          hint={bonus ? t('hint.now', { n: bonus }) : hint(ov.repeats, phrase.repeats)}
          onDec={() => setOverride({ repeats: Math.max(1, baseRepeats - 1) })}
          onInc={() => setOverride({ repeats: Math.min(20, baseRepeats + 1) })}
        />
        <Stepper
          label={t('phrase.extraPause')}
          value={seconds(pauseExtra)}
          hint={hint(ov.pauseExtra, phrase.pause)}
          onDec={() => setOverride({ pauseExtra: Math.max(0, round(pauseExtra - 0.5)) })}
          onInc={() => setOverride({ pauseExtra: Math.min(30, round(pauseExtra + 0.5)) })}
        />
        {(ov.repeats != null || ov.pauseExtra != null) && (
          <button className="ghost" onClick={() => setOverride({ repeats: undefined, pauseExtra: undefined })}>
            {t('phrase.reset')}
          </button>
        )}
      </section>

      <details className="panel">
        <summary>{t('settings.title')}</summary>
        <Stepper
          label={t('settings.pauseFactor')}
          value={number(settings.pauseFactor, 1)}
          onDec={() => setSettings({ pauseFactor: Math.max(0, round(settings.pauseFactor - 0.1)) })}
          onInc={() => setSettings({ pauseFactor: Math.min(5, round(settings.pauseFactor + 0.1)) })}
        />
        <Stepper
          label={t('settings.plusSeconds')}
          value={number(settings.pauseExtra, 1)}
          onDec={() => setSettings({ pauseExtra: Math.max(0, round(settings.pauseExtra - 0.5)) })}
          onInc={() => setSettings({ pauseExtra: Math.min(30, round(settings.pauseExtra + 0.5)) })}
        />
        <Stepper
          label={t('settings.repeats')}
          value={String(settings.repeats)}
          onDec={() => setSettings({ repeats: Math.max(1, settings.repeats - 1) })}
          onInc={() => setSettings({ repeats: Math.min(20, settings.repeats + 1) })}
        />
        <label className="check">
          <input type="checkbox" checked={settings.loop} onChange={(e) => setSettings({ loop: e.target.checked })} />
          {t('settings.loop')}
        </label>
        {toggleable.map((f) => (
          <label className="check" key={f.key}>
            <input type="checkbox" checked={visibility[f.key] !== false} onChange={(e) => setShown(f.key, e.target.checked)} />
            {fieldLabel(f)}
          </label>
        ))}
        <label className="check">
          <input type="checkbox" checked={display.wakeLock} onChange={(e) => setDisp({ wakeLock: e.target.checked })} />
          {t('settings.keepScreenOn')}
        </label>
        <label className="select">
          {t('common.language')}
          <LanguageSelect i18n={i18n} label={t('common.language')} />
        </label>
        <label className="select">
          {t('settings.background')}
          <select value={settings.keepAlive} onChange={(e) => onKeepAlive(e.target.value as KeepAliveMode)}>
            <option value="silent-audio">{t('settings.bgSilent')}</option>
            <option value="stream">{t('settings.bgStream')}</option>
            <option value="none">{t('settings.bgNone')}</option>
          </select>
        </label>
        <p className="muted small">{t('settings.bgNote')}</p>
      </details>

      <details className="panel">
        <summary>{t('phrases.title')}</summary>
        <ol className="list" ref={listRef}>
          {phrases.map((p, i) => (
            <li key={p.id} className={i === snap.seg ? 'active' : ''} onClick={() => player.jumpTo(i)}>
              {primaryText(i)}
            </li>
          ))}
        </ol>
      </details>

      <LogPanel player={player} />
    </main>
  )
}

function LogPanel({ player }: { player: Player }) {
  const { t } = useI18n()
  const [, force] = useReducer((x: number) => x + 1, 0)
  const [open, setOpen] = useState(false)
  useEffect(() => (open ? player.subscribeLog(force) : undefined), [player, open])
  const entries = player.getLog()
  const fmt = (e: (typeof entries)[number]) =>
    `${new Date(e.wall).toLocaleTimeString('en-GB')} [${e.ctx.toFixed(2)}] ${e.msg}`

  return (
    <details className="panel" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>{t('log.title')}</summary>
      <button
        className="ghost"
        onClick={() => void navigator.clipboard?.writeText(entries.map(fmt).join('\n')).catch(() => {})}
      >
        {t('log.copy')}
      </button>
      <pre className="log">{open ? [...entries].reverse().map(fmt).join('\n') : ''}</pre>
    </details>
  )
}
