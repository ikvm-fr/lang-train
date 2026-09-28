import { useEffect, useMemo, useState } from 'react'
import { defaultDetectParams, detectSpeech, frameLevels } from '../audio/silence'
import { store } from '../state/store'
import { PREVIEW_PREFIX, type WaveformHandle } from './Waveform'

// Silence detection with a live preview drawn on the waveform (grey segments).

function Slider(props: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
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
      <span className="value">
        {Math.round(props.value * k)} {props.unit}
      </span>
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
  onDone: (message: string) => void
}) {
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
    onDone(`Added ${added} regions${skipped ? `, skipped ${skipped} that overlap existing ones` : ''}. Ctrl+Z undoes.`)
    onClose()
  }

  return (
    <section className="detect">
      <div className="detect-head">
        <strong>Detect pauses</strong>
        <span className="muted">
          {result.regions.length} phrases found
          {overlapping ? `, ${overlapping} overlap existing regions and will be skipped` : ''} · noise floor{' '}
          {Math.round(result.noiseFloor)} dBFS
        </span>
        <div className="spacer" />
        <label>
          <input type="radio" checked={scope === 'file'} onChange={() => setScope('file')} /> Whole file
        </label>
        <label>
          <input type="radio" checked={scope === 'view'} onChange={() => setScope('view')} /> Visible part
        </label>
      </div>
      <div className="detect-controls">
        <div className="slider">
          <label>
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto threshold
          </label>
        </div>
        <Slider
          label="Silence below"
          value={auto ? result.threshold : manual}
          min={-60}
          max={-20}
          step={1}
          unit="dBFS"
          disabled={auto}
          onChange={setManual}
        />
        <Slider label="Min pause" value={minSilence} min={100} max={2000} step={50} unit="ms" scale={1000} onChange={setMinSilence} />
        <Slider label="Min phrase" value={minPhrase} min={100} max={2000} step={50} unit="ms" scale={1000} onChange={setMinPhrase} />
        <Slider label="Padding" value={padding} min={0} max={500} step={10} unit="ms" scale={1000} onChange={setPadding} />
      </div>
      <div className="detect-actions">
        <button onClick={onClose}>Cancel</button>
        <button className="primary" onClick={apply} disabled={!result.regions.length || overlapping === result.regions.length}>
          Add {result.regions.length - overlapping} regions
        </button>
      </div>
    </section>
  )
}
