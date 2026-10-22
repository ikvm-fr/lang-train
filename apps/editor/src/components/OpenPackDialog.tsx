import { errorText } from '@lang-train/i18n'
import { readPack, type Pack } from '@lang-train/pack'
import { useRef, useState } from 'react'
import { editorError } from '../errors'
import { formatTime } from '../format'
import { i18n, useI18n, type Text } from '../i18n'
import { packSources } from '../state/fromPack'
import { Dialog } from './Dialog'

export interface PackToOpen {
  pack: Pack
  sourceId: string
}

// Step 1: choose a pack ZIP (and which recording, if it was cut from several).
// Step 2: open that recording; the regions are rebuilt from the positions stored in the pack.
export function OpenPackDialog({ onOpen, onClose }: { onOpen: (audio: File, target: PackToOpen) => void; onClose: () => void }) {
  const { t } = useI18n()
  const [pack, setPack] = useState<{ pack: Pack; fileName: string } | null>(null)
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [error, setError] = useState<Text | null>(null)
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
        throw editorError('noPositions')
      }
      setPack({ pack: p, fileName: file.name })
      setSourceId(sources[0].id)
    } catch (e) {
      setPack(null)
      setError(() => () => t('err.withFile', { file: file.name, detail: errorText(i18n, e) }))
    }
  }

  return (
    <Dialog
      title={t('open.title')}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>{t('common.cancel')}</button>
          <button className="primary" disabled={!source} onClick={() => audioInput.current?.click()}>
            {source ? t('open.btnOpen', { name: source.name }) : t('open.btnOpenGeneric')}
          </button>
        </>
      }
    >
      <div className="form">
        <div className="append-target">
          <button onClick={() => packInput.current?.click()}>{t('open.choosePack')}</button>
          {pack && (
            <span>
              {t('open.packInfo', {
                file: pack.fileName,
                title: pack.pack.meta.title,
                phrases: t('count.phrases', { count: pack.pack.phrases.length }),
              })}
            </span>
          )}
        </div>
        {info && info.sources.length > 1 && (
          <div>
            <p>{t('open.whichSource')}</p>
            {info.sources.map((s) => (
              <label key={s.id} className="radio-line">
                <input type="radio" checked={s.id === sourceId} onChange={() => setSourceId(s.id)} /> {s.name}
                <span className="muted">
                  {' '}
                  · {t('count.phrases', { count: s.count })}
                  {s.duration ? ` · ${formatTime(s.duration)}` : ''}
                </span>
              </label>
            ))}
            <p className="muted small">{t('open.othersKept')}</p>
          </div>
        )}
        {source && (
          <p>
            {t('open.nowOpen', {
              name: source.duration ? `${source.name} (${formatTime(source.duration)})` : source.name,
              phrases: t('count.phrases', { count: source.count }),
            })}
          </p>
        )}
        {info && info.unplaced > 0 && (
          <p className="warning">{t('open.unplaced', { count: info.unplaced })}</p>
        )}
        {error && <p className="error">{error()}</p>}
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
