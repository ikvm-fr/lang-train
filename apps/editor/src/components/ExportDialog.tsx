import { primaryField, readPack, type Pack } from '@lang-train/pack'
import { useRef, useState } from 'react'
import { appendToPack, buildPack, downloadBytes, safeFileName, updatePack, type ExportOptions } from '../export/buildPack'
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
  const origin = project.origin
  const [opts, setOpts] = useState<ExportOptions>(() => {
    const prefs = loadPrefs()
    return {
      ...prefs,
      target: origin?.lang?.target ?? prefs.target,
      native: origin?.lang?.native ?? prefs.native,
      title: origin?.title ?? project.audio?.name.replace(/\.[^.]+$/, '') ?? '',
    }
  })
  const [mode, setModeState] = useState<'new' | 'append' | 'update'>(origin ? 'update' : 'new')
  const [target, setTarget] = useState<{ pack: Pack; fileName: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<[number, number] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<ExportOptions>) => setOpts((o) => ({ ...o, ...patch }))

  const primary = primaryField(project.fields)
  const emptyCount = primary ? project.regions.filter((r) => !r.values[primary.key]?.trim()).length : 0

  const setMode = (m: typeof mode) => {
    setModeState(m)
    setTarget(null)
    setError(null)
  }

  const pickPack = async (file: File) => {
    setError(null)
    try {
      const { warnings: _w, ...pack } = await readPack(new Uint8Array(await file.arrayBuffer()), file.name)
      if (mode === 'update' && pack.meta.id !== project.packId) {
        throw new Error(`this is not the pack “${origin?.title}” this project was opened from`)
      }
      setTarget({ pack, fileName: file.name })
    } catch (e) {
      setTarget(null)
      setError(`${file.name}: ${(e as Error).message}`)
    }
  }

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
      const onProgress = (done: number, total: number) => setProgress([done, total])
      if (mode === 'append' && target) {
        const zip = await appendToPack(target.pack, store.getState(), buffer, opts, onProgress)
        downloadBytes(zip, target.fileName)
      } else if (mode === 'update' && target) {
        const zip = await updatePack(target.pack, store.getState(), buffer, opts, onProgress)
        downloadBytes(zip, target.fileName)
      } else {
        const zip = await buildPack(store.getState(), buffer, opts, onProgress)
        downloadBytes(zip, safeFileName(opts.title))
      }
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setProgress(null)
    }
  }

  const busy = progress !== null
  return (
    <Dialog
      title="Export"
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="primary"
            onClick={() => void run()}
            disabled={busy || !project.regions.length || (mode !== 'new' && !target)}
          >
            {mode === 'append'
              ? `Append ${project.regions.length} phrases`
              : mode === 'update'
                ? `Update pack (${project.regions.length} phrases)`
                : `Export ${project.regions.length} phrases`}
          </button>
        </>
      }
    >
      <div className="form">
        <div className="radio-row">
          {origin && (
            <label>
              <input type="radio" checked={mode === 'update'} onChange={() => setMode('update')} disabled={busy} /> Update
              “{origin.title}”
            </label>
          )}
          <label>
            <input type="radio" checked={mode === 'new'} onChange={() => setMode('new')} disabled={busy} /> New pack
          </label>
          <label>
            <input type="radio" checked={mode === 'append'} onChange={() => setMode('append')} disabled={busy} /> Append to an
            existing pack
          </label>
        </div>
        {mode !== 'new' && (
          <div className="append-target">
            <button onClick={() => fileInput.current?.click()} disabled={busy}>
              Choose pack ZIP…
            </button>{' '}
            {target ? (
              <span>
                {target.fileName}: “{target.pack.meta.title}”, {target.pack.phrases.length} phrases
              </span>
            ) : (
              <span className="muted">
                {mode === 'update'
                  ? `Choose the pack “${origin?.title}” you opened. `
                  : ''}
                The result downloads as a new file with the same name.
              </span>
            )}
            <input
              ref={fileInput}
              type="file"
              accept=".zip,application/zip"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void pickPack(f)
              }}
            />
          </div>
        )}
        {mode === 'new' && (
          <label>
            Title
            <input value={opts.title} onChange={(e) => set({ title: e.target.value })} disabled={busy} />
          </label>
        )}
        {mode === 'new' && (
          <>
            <label>
              Language being learned
              <input placeholder="e.g. de" value={opts.target} onChange={(e) => set({ target: e.target.value })} disabled={busy} />
            </label>
            <label>
              Learner's language
              <input placeholder="e.g. en" value={opts.native} onChange={(e) => set({ native: e.target.value })} disabled={busy} />
            </label>
          </>
        )}
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
