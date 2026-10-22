import { errorText } from '@lang-train/i18n'
import { primaryField, readPack, type Pack } from '@lang-train/pack'
import { useRef, useState } from 'react'
import { appendToPack, buildPack, downloadBytes, safeFileName, updatePack, type ExportOptions } from '../export/buildPack'
import { editorError } from '../errors'
import { i18n, useI18n, type Text } from '../i18n'
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
  const { t } = useI18n()
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
  const [error, setError] = useState<Text | null>(null)
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
        throw editorError('wrongPack', { title: origin?.title ?? '' })
      }
      setTarget({ pack, fileName: file.name })
    } catch (e) {
      setTarget(null)
      setError(() => () => t('err.withFile', { file: file.name, detail: errorText(i18n, e) }))
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
      setError(() => () => errorText(i18n, e))
      setProgress(null)
    }
  }

  const busy = progress !== null
  return (
    <Dialog
      title={t('export.title')}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button
            className="primary"
            onClick={() => void run()}
            disabled={busy || !project.regions.length || (mode !== 'new' && !target)}
          >
            {t(mode === 'append' ? 'export.btnAppend' : mode === 'update' ? 'export.btnUpdate' : 'export.btnNew', {
              count: project.regions.length,
            })}
          </button>
        </>
      }
    >
      <div className="form">
        <div className="radio-row">
          {origin && (
            <label>
              <input type="radio" checked={mode === 'update'} onChange={() => setMode('update')} disabled={busy} />{' '}
              {t('export.modeUpdate', { title: origin.title })}
            </label>
          )}
          <label>
            <input type="radio" checked={mode === 'new'} onChange={() => setMode('new')} disabled={busy} />{' '}
            {t('export.modeNew')}
          </label>
          <label>
            <input type="radio" checked={mode === 'append'} onChange={() => setMode('append')} disabled={busy} />{' '}
            {t('export.modeAppend')}
          </label>
        </div>
        {mode !== 'new' && (
          <div className="append-target">
            <button onClick={() => fileInput.current?.click()} disabled={busy}>
              {t('export.choosePack')}
            </button>{' '}
            {target ? (
              <span>
                {t('export.packInfo', {
                  file: target.fileName,
                  title: target.pack.meta.title,
                  phrases: t('count.phrases', { count: target.pack.phrases.length }),
                })}
              </span>
            ) : (
              <span className="muted">
                {mode === 'update' ? `${t('export.updateHint', { title: origin?.title ?? '' })} ` : ''}
                {t('export.sameName')}
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
            {t('export.packTitle')}
            <input value={opts.title} onChange={(e) => set({ title: e.target.value })} disabled={busy} />
          </label>
        )}
        {mode === 'new' && (
          <>
            <label>
              {t('export.langTarget')}
              <input
                placeholder={t('export.langExample', { code: 'de' })} value={opts.target} onChange={(e) => set({ target: e.target.value })} disabled={busy} />
            </label>
            <label>
              {t('export.langNative')}
              <input
                placeholder={t('export.langExample', { code: 'en' })} value={opts.native} onChange={(e) => set({ native: e.target.value })} disabled={busy} />
            </label>
          </>
        )}
        <label>
          {t('export.padding')}
          <input
            type="number"
            min={0}
            max={500}
            step={10}
            value={Math.round(opts.padding * 1000)}
            onChange={(e) => set({ padding: Math.max(0, Math.min(500, Number(e.target.value) || 0)) / 1000 })}
            disabled={busy}
          />
          <span className="muted small">{t('export.paddingHelp')}</span>
        </label>
        <label>
          {t('export.bitrate')}
          <select value={opts.kbps} onChange={(e) => set({ kbps: Number(e.target.value) })} disabled={busy}>
            {[48, 64, 96].map((v) => (
              <option key={v} value={v}>
                {t('unit.kbps', { value: v })}
              </option>
            ))}
          </select>
        </label>
      </div>
      {emptyCount > 0 && (
        <p className="warning">
          {t('export.emptyWarning', { count: emptyCount, field: primary?.label ?? '' })}
        </p>
      )}
      {busy && (
        <div className="export-progress">
          <progress max={progress[1]} value={progress[0]} /> {t('export.encoding', { done: progress[0], total: progress[1] })}
        </div>
      )}
      {error && <p className="error">{error()}</p>}
    </Dialog>
  )
}
