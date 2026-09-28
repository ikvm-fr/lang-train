import { primaryField } from '@lang-train/pack'
import { useState } from 'react'
import { buildPack, downloadBytes, safeFileName, type ExportOptions } from '../export/buildPack'
import { store } from '../state/store'
import { Dialog } from './Dialog'

const PREFS_KEY = 'lte:export'

function loadPrefs(): Omit<ExportOptions, 'title'> {
  const defaults = { target: '', native: '', padding: 0.1, kbps: 64 }
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }
  } catch {
    return defaults
  }
}

export function ExportDialog({ buffer, onClose }: { buffer: AudioBuffer; onClose: () => void }) {
  const project = store.getState()
  const [opts, setOpts] = useState<ExportOptions>(() => ({
    ...loadPrefs(),
    title: project.audio?.name.replace(/\.[^.]+$/, '') ?? '',
  }))
  const [progress, setProgress] = useState<[number, number] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<ExportOptions>) => setOpts((o) => ({ ...o, ...patch }))

  const primary = primaryField(project.fields)
  const emptyCount = primary ? project.regions.filter((r) => !r.values[primary.key]?.trim()).length : 0

  const run = async () => {
    setError(null)
    setProgress([0, project.regions.length])
    try {
      const { title: _title, ...prefs } = opts
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
      /* storage unavailable */
    }
    try {
      const zip = await buildPack(store.getState(), buffer, opts, (done, total) => setProgress([done, total]))
      downloadBytes(zip, safeFileName(opts.title))
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setProgress(null)
    }
  }

  const busy = progress !== null
  return (
    <Dialog
      title="Export pack"
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="primary" onClick={() => void run()} disabled={busy || !project.regions.length}>
            Export {project.regions.length} phrases
          </button>
        </>
      }
    >
      <div className="form">
        <label>
          Title
          <input value={opts.title} onChange={(e) => set({ title: e.target.value })} disabled={busy} />
        </label>
        <label>
          Language being learned
          <input placeholder="e.g. de" value={opts.target} onChange={(e) => set({ target: e.target.value })} disabled={busy} />
        </label>
        <label>
          Learner's language
          <input placeholder="e.g. en" value={opts.native} onChange={(e) => set({ native: e.target.value })} disabled={busy} />
        </label>
        <label>
          Padding around each phrase, ms
          <input
            type="number"
            min={0}
            max={500}
            step={10}
            value={Math.round(opts.padding * 1000)}
            onChange={(e) => set({ padding: Math.max(0, Math.min(500, Number(e.target.value) || 0)) / 1000 })}
            disabled={busy}
          />
        </label>
        <label>
          MP3 bitrate
          <select value={opts.kbps} onChange={(e) => set({ kbps: Number(e.target.value) })} disabled={busy}>
            <option value={48}>48 kbit/s</option>
            <option value={64}>64 kbit/s</option>
            <option value={96}>96 kbit/s</option>
          </select>
        </label>
      </div>
      {emptyCount > 0 && (
        <p className="warning">
          {emptyCount} of {project.regions.length} regions have an empty “{primary?.label}”. They will be exported anyway.
        </p>
      )}
      {busy && (
        <div className="export-progress">
          <progress max={progress[1]} value={progress[0]} /> Encoding {progress[0]} / {progress[1]}
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </Dialog>
  )
}
