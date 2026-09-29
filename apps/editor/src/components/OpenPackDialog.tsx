import { readPack, type Pack } from '@lang-train/pack'
import { useRef, useState } from 'react'
import { formatTime } from '../format'
import { packSources } from '../state/fromPack'
import { Dialog } from './Dialog'

export interface PackToOpen {
  pack: Pack
  sourceId: string
}

// Step 1: choose a pack ZIP (and which recording, if it was cut from several).
// Step 2: open that recording; the regions are rebuilt from the positions stored in the pack.
export function OpenPackDialog({ onOpen, onClose }: { onOpen: (audio: File, target: PackToOpen) => void; onClose: () => void }) {
  const [pack, setPack] = useState<{ pack: Pack; fileName: string } | null>(null)
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const packInput = useRef<HTMLInputElement>(null)
  const audioInput = useRef<HTMLInputElement>(null)

  const info = pack ? packSources(pack.pack) : null
  const source = info?.sources.find((s) => s.id === sourceId)

  const pickPack = async (file: File) => {
    setError(null)
    try {
      const { warnings: _w, ...p } = await readPack(new Uint8Array(await file.arrayBuffer()), file.name)
      const { sources } = packSources(p)
      if (!sources.length) {
        throw new Error('This pack does not store where its phrases are in the original recording, so it cannot be reopened.')
      }
      setPack({ pack: p, fileName: file.name })
      setSourceId(sources[0].id)
    } catch (e) {
      setPack(null)
      setError(`${file.name}: ${(e as Error).message}`)
    }
  }

  return (
    <Dialog
      title="Open pack for editing"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!source} onClick={() => audioInput.current?.click()}>
            {source ? `Open ${source.name}…` : 'Open recording…'}
          </button>
        </>
      }
    >
      <div className="form">
        <div className="append-target">
          <button onClick={() => packInput.current?.click()}>Choose pack ZIP…</button>
          {pack && (
            <span>
              {pack.fileName}: “{pack.pack.meta.title}”, {pack.pack.phrases.length} phrases
            </span>
          )}
        </div>
        {info && info.sources.length > 1 && (
          <div>
            <p>This pack was cut from several recordings. Which one do you want to edit?</p>
            {info.sources.map((s) => (
              <label key={s.id} className="radio-line">
                <input type="radio" checked={s.id === sourceId} onChange={() => setSourceId(s.id)} /> {s.name}
                <span className="muted">
                  {' '}
                  · {s.count} phrases{s.duration ? ` · ${formatTime(s.duration)}` : ''}
                </span>
              </label>
            ))}
            <p className="muted small">Phrases from the other recordings stay in the pack unchanged when you update it.</p>
          </div>
        )}
        {source && (
          <p>
            Now open the original recording <strong>{source.name}</strong>
            {source.duration ? ` (${formatTime(source.duration)})` : ''}. Its {source.count} phrases will become regions you
            can edit.
          </p>
        )}
        {info && info.unplaced > 0 && (
          <p className="warning">{info.unplaced} phrases have no position in a recording; they stay in the pack but cannot be edited here.</p>
        )}
        {error && <p className="error">{error}</p>}
      </div>
      <input
        ref={packInput}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void pickPack(f)
        }}
      />
      <input
        ref={audioInput}
        type="file"
        accept="audio/*,.mp3,.wav"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f && pack && sourceId) onOpen(f, { pack: pack.pack, sourceId })
        }}
      />
    </Dialog>
  )
}
