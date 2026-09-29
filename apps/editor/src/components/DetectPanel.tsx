import { useEffect, useMemo, useState } from 'react'
import { defaultDetectParams, detectSpeech, frameLevels } from '../audio/silence'
import { useI18n, type Text } from '../i18n'
import { store } from '../state/store'
import { PREVIEW_PREFIX, type WaveformHandle } from './Waveform'

// Silence detection with a live preview drawn on the waveform (grey segments).

function Slider(props: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  scale?: number
  disabled?: boolean
  onChange: (v: number) => void
}) {
  const k = props.scale ?? 1
  return (
    <label className="slider">
      <span>{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value * k}
        disabled={props.disabled}
        onChange={(e) => props.onChange(Number(e.target.value) / k)}
      />
      <span className="value">{props.format(Math.round(props.value * k))}</span>
    </label>
  )
}

export function DetectPanel({
  buffer,
  handle,
  onClose,
  onDone,
}: {
  buffer: AudioBuffer
  handle: WaveformHandle
  onClose: () => void
  onDone: (message: Text) => void
}) {
  const { t } = useI18n()
  const ms = (v: number) => t('unit.ms', { value: v })
  const levels = useMemo(() => frameLevels(buffer.getChannelData(0), buffer.sampleRate), [buffer])
  const [auto, setAuto] = useState(true)
  const [manual, setManual] = useState(-40)
  const [minSilence, setMinSilence] = useState(defaultDetectParams.minSilence)
  const [minPhrase, setMinPhrase] = useState(defaultDetectParams.minPhrase)
  const [padding, setPadding] = useState(defaultDetectParams.padding)
  const [scope, setScope] = useState<'file' | 'view'>('file')

  const range = useMemo(() => {
    if (scope === 'file') return { from: 0, to: buffer.duration }
    const view = handle.peaks.views.getView('zoomview')
    return { from: view?.getStartTime() ?? 0, to: Math.min(buffer.duration, view?.getEndTime() ?? buffer.duration) }
  }, [scope, buffer, handle])

  const result = useMemo(
    () =>
      detectSpeech(levels, { threshold: auto ? 'auto' : manual, minSilence, minPhrase, padding, ...range }),
    [levels, auto, manual, minSilence, minPhrase, padding, range],
  )
  const existing = store.getState().regions
  const overlapping = result.regions.filter((p) => existing.some((r) => r.start < p.end && r.end > p.start)).length

  // Draw the proposal.
  useEffect(() => {
    const { peaks } = handle
    const color = matchMedia('(prefers-color-scheme: dark)').matches ? '#9099a6' : '#677080'
    peaks.segments.add(
      result.regions.map((r, i) => ({
        id: `${PREVIEW_PREFIX}${i}`,
        startTime: r.start,
        endTime: r.end,
        color,
        borderColor: color,
        editable: false,
      })),
    )
    return () => {
      // Copy first: removeById mutates the array getSegments() returns.
      for (const s of [...peaks.segments.getSegments()]) if (s.id?.startsWith(PREVIEW_PREFIX)) peaks.segments.removeById(s.id)
    }
  }, [handle, result])

  const apply = () => {
    const { added, skipped } = store.addRegions(result.regions)
    onDone(() =>
      [
        t('notice.regionsAdded', { count: added }),
        skipped ? t('notice.regionsSkipped', { count: skipped }) : '',
        t('notice.undoHint'),
      ]
        .filter(Boolean)
        .join(' '),
    )
    onClose()
  }

  return (
    <section className="detect">
      <div className="detect-head">
        <strong>{t('detect.title')}</strong>
        <span className="muted">
          {t('detect.found', { count: result.regions.length })}
          {overlapping ? `, ${t('detect.overlap', { count: overlapping })}` : ''} ·{' '}
          {t('detect.noise', { value: Math.round(result.noiseFloor) })}
        </span>
        <div className="spacer" />
        <label>
          <input type="radio" checked={scope === 'file'} onChange={() => setScope('file')} /> {t('detect.wholeFile')}
        </label>
        <label>
          <input type="radio" checked={scope === 'view'} onChange={() => setScope('view')} /> {t('detect.visible')}
        </label>
      </div>
      <div className="detect-controls">
        <div className="slider">
          <label>
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> {t('detect.auto')}
          </label>
        </div>
        <Slider
          label={t('detect.silenceBelow')}
          value={auto ? result.threshold : manual}
          min={-60}
          max={-20}
          step={1}
          format={(v) => t('unit.dbfs', { value: v })}
          disabled={auto}
          onChange={setManual}
        />
        <Slider label={t('detect.minPause')} value={minSilence} min={100} max={2000} step={50} format={ms} scale={1000} onChange={setMinSilence} />
        <Slider label={t('detect.minPhrase')} value={minPhrase} min={100} max={2000} step={50} format={ms} scale={1000} onChange={setMinPhrase} />
        <Slider label={t('detect.padding')} value={padding} min={0} max={500} step={10} format={ms} scale={1000} onChange={setPadding} />
      </div>
      <div className="detect-actions">
        <button onClick={onClose}>{t('common.cancel')}</button>
        <button className="primary" onClick={apply} disabled={!result.regions.length || overlapping === result.regions.length}>
          {t('detect.add', { count: result.regions.length - overlapping })}
        </button>
      </div>
    </section>
  )
}
