import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { errorText, LanguageSelect } from '@lang-train/i18n'
import { primaryField } from '@lang-train/pack'
import { LONG_FILE_SECONDS, decodeFile } from './audio/decode'
import { DetectPanel } from './components/DetectPanel'
import { ExportDialog } from './components/ExportDialog'
import { FieldsDialog } from './components/FieldsDialog'
import { OpenPackDialog, type PackToOpen } from './components/OpenPackDialog'
import { SavedProjectsDialog } from './components/SavedProjectsDialog'
import { RegionTable } from './components/RegionTable'
import { Waveform, type WaveformHandle } from './components/Waveform'
import { formatTime } from './format'
import { i18n, t, useI18n, type Text } from './i18n'
import { downloadBytes } from './export/buildPack'
import { projectFromPack } from './state/fromPack'
import { deleteSavedProject, loadSavedProject, savedProjectKey, saveProject } from './state/persist'
import { formatAudacityLabels, parseAudacityLabels, parseProjectFile, toProjectFile, type ProjectFile } from './state/projectFile'
import { store, useProject, type Region } from './state/store'

// [key label (translated if it is a key of the dictionary), description key]
const SHORTCUTS: [string, Parameters<typeof t>[0]][] = [
  ['key.drag', 'sc.drag'],
  ['key.edges', 'sc.edges'],
  ['key.space', 'sc.space'],
  ['key.io', 'sc.io'],
  ['key.enter', 'sc.enter'],
  ['L', 'sc.loop'],
  ['↑ / ↓', 'sc.select'],
  ['← / →', 'sc.nudgeStart'],
  ['Alt + ← / →', 'sc.nudgeEnd'],
  ['S', 'sc.split'],
  ['M', 'sc.merge'],
  ['key.delete', 'sc.delete'],
  ['Ctrl+Z / Ctrl+Shift+Z', 'sc.undo'],
  ['+ / −', 'sc.zoom'],
  ['Esc', 'sc.esc'],
  ['Ctrl+Enter', 'sc.ctrlEnter'],
]

// Latin letter of a key press on any keyboard layout (e.g. Cyrillic): the typed letter if it is
// Latin, otherwise the physical key.
function letterOf(e: KeyboardEvent): string {
  const k = e.key.length === 1 ? e.key.toLowerCase() : ''
  if (/^[a-z]$/.test(k)) return k
  return e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : ''
}

const withFile = (file: string, e: unknown): Text => () =>
  t('err.withFile', { file, detail: e instanceof SyntaxError ? t('err.notJson') : errorText(i18n, e) })

function isTextTarget(t: EventTarget | null) {
  return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

function usePlayerTick(handle: WaveformHandle | null) {
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => handle?.player.subscribe(force), [handle])
}

export default function App() {
  useI18n()
  const audio = useProject((s) => s.audio)
  const regionCount = useProject((s) => s.regions.length)
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null)
  const [handle, setHandle] = useState<WaveformHandle | null>(null)
  const [busy, setBusy] = useState<Text | null>(null)
  const [error, setError] = useState<Text | null>(null)
  const [notice, setNotice] = useState<Text | null>(null)
  const [dialog, setDialog] = useState<'fields' | 'export' | 'open-pack' | 'saved' | null>(null)
  const [markIn, setMarkIn] = useState<number | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [saved, setSaved] = useState<ProjectFile | null>(null) // last project, shown on the start screen
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const projectInput = useRef<HTMLInputElement>(null)
  const flushRef = useRef<() => void>(() => {})
  const labelsInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  usePlayerTick(handle)
  useProject((s) => s) // re-render on any change (undo/redo button state)

  const openFile = useCallback(async (file: File, fromPack?: PackToOpen) => {
    // The current project is autosaved per recording; store its latest changes before switching.
    flushRef.current()
    setBusy(() => () => t('busy.decoding', { name: file.name }))
    setError(null)
    setNotice(null)
    try {
      const decoded = await decodeFile(file)
      const info = { name: file.name, size: file.size, duration: decoded.duration }
      const saved = await loadSavedProject(info)
      if (fromPack) {
        const source = fromPack.pack.meta.sources?.find((s) => s.id === fromPack.sourceId)
        if (source && source.name !== file.name && !confirm(t('confirm.packSourceName', { expected: source.name, actual: file.name }))) {
          return
        }
        const { project, dropped } = projectFromPack(fromPack.pack, fromPack.sourceId, info)
        if (
          saved?.regions.length &&
          !confirm(
            t('confirm.replaceAutosave', {
              name: file.name,
              regions: t('count.regions', { count: saved.regions.length }),
              phrases: t('count.phrases', { count: project.regions.length }),
            }),
          )
        ) {
          return
        }
        store.loadProject(project)
        const title = fromPack.pack.meta.title
        const count = project.regions.length
        const lengthDiffers = !!source?.duration && Math.abs(source.duration - decoded.duration) > 0.05
        setNotice(() => () =>
          [
            t('notice.packOpened', { title, phrases: t('count.phrases', { count }) }),
            dropped ? t('notice.packDropped', { count: dropped }) : '',
            lengthDiffers ? t('notice.packLengthDiffers') : '',
            t('notice.packUpdateHint'),
          ]
            .filter(Boolean)
            .join(' '),
        )
      } else if (
        saved?.regions.length &&
        confirm(t('confirm.continueProject', { name: file.name, regions: t('count.regions', { count: saved.regions.length }) }))
      ) {
        store.loadProject({ ...saved, audio: info })
        if (Math.abs(saved.audio.duration - decoded.duration) > 0.05) {
          setNotice(() => () => t('notice.lengthDiffers'))
        }
      } else {
        store.newProject(info)
      }
      // Remount the waveform for the new recording.
      setBuffer(null)
      setMarkIn(null)
      setDetecting(false)
      setSaved(null)
      setBuffer(decoded)
      if (decoded.duration > LONG_FILE_SECONDS) {
        setNotice(() => () => t('notice.longFile', { duration: formatTime(decoded.duration) }))
      }
    } catch (e) {
      setError(() => () => errorText(i18n, e))
    } finally {
      setBusy(null)
    }
  }, [])

  const playRegion = useCallback(
    (r: Region, loop = false) => {
      handle?.player.playRange(r.start, r.end, loop)
    },
    [handle],
  )

  // Show a pending "I" mark on the waveform.
  useEffect(() => {
    const peaks = handle?.peaks
    if (!peaks) return
    peaks.points.removeById('mark-in')
    if (markIn !== null) peaks.points.add({ id: 'mark-in', time: markIn, labelText: 'IN', color: '#e11d48', editable: false })
  }, [handle, markIn])

  // Keep the selected region in view.
  const selectedId = useProject((s) => s.selectedId)
  useEffect(() => {
    const r = store.selected()
    const zoomview = handle?.peaks.views.getView('zoomview')
    if (!r || !zoomview) return
    if (r.start < zoomview.getStartTime() || r.end > zoomview.getEndTime()) {
      zoomview.setStartTime(Math.max(0, r.start - 0.5))
    }
  }, [handle, selectedId])

  // Keyboard shortcuts.
  useEffect(() => {
    if (!handle) return
    const { player, peaks } = handle
    const onKey = (e: KeyboardEvent) => {
      if (dialog) return
      if (e.target instanceof HTMLElement && e.target.closest('.menu, .detect')) return
      const inText = isTextTarget(e.target)
      const sel = store.selected()
      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl && e.key === 'Enter') {
        if (sel) playRegion(sel)
        e.preventDefault()
        return
      }
      if (inText) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur()
        return
      }
      const letter = letterOf(e)
      if (ctrl && letter === 'z') {
        if (e.shiftKey) store.redo()
        else store.undo()
        e.preventDefault()
        return
      }
      if (ctrl && letter === 'y') {
        store.redo()
        e.preventDefault()
        return
      }
      if (ctrl || e.altKey && !e.key.startsWith('Arrow')) return

      const step = e.shiftKey ? 0.1 : 0.01
      const now = player.getCurrentTime()
      let handled = true
      // Letters by layout-independent `letter`, other keys by `e.key`.
      switch (letter || e.key) {
        case ' ':
          if (player.isPlaying()) player.pause()
          else void player.play()
          break
        case 'i':
          setMarkIn(now)
          break
        case 'o':
          if (markIn !== null) {
            if (!store.addRegion(markIn, now)) setNotice(() => () => t('notice.noRoom'))
            setMarkIn(null)
          }
          break
        case 'Enter':
          if (sel) playRegion(sel)
          break
        case 'l':
          if (player.isLooping()) player.pause()
          else if (sel) playRegion(sel, true)
          break
        case 'ArrowUp':
          store.selectRelative(-1)
          break
        case 'ArrowDown':
          store.selectRelative(1)
          break
        case 'ArrowLeft':
        case 'ArrowRight':
          if (sel) store.nudge(sel.id, e.altKey ? 'end' : 'start', e.key === 'ArrowLeft' ? -step : step)
          break
        case 's':
          if (sel && !store.split(sel.id, now)) setNotice(() => () => t('notice.splitHint'))
          break
        case 'm':
          if (sel) store.mergeWithNext(sel.id)
          break
        case 'Delete':
        case 'Backspace':
          if (sel) store.remove(sel.id)
          break
        case '+':
        case '=':
          peaks.zoom.zoomIn()
          break
        case '-':
        case '_':
          peaks.zoom.zoomOut()
          break
        default:
          handled = false
      }
      if (handled) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handle, dialog, markIn, playRegion])

  // Offer the last project on the start screen.
  useEffect(() => {
    void loadSavedProject().then((p) => p?.regions.length && setSaved(p))
  }, [])

  // Autosave to IndexedDB, 1 s after the last change and when the page is hidden.
  useEffect(() => {
    let timer = 0
    let dirty = false // only save real changes, so deleted saves do not come back on their own
    const flush = () => {
      clearTimeout(timer)
      if (!dirty) return
      const p = toProjectFile(store.getState())
      if (!p) return
      dirty = false
      // A recording without regions keeps no saved project.
      const done = p.regions.length ? saveProject(p) : deleteSavedProject(savedProjectKey(p.audio))
      done.then(() => setSavedAt(new Date())).catch(() => setNotice(() => () => t('notice.autosaveFailed')))
    }
    flushRef.current = flush
    let last = store.getState()
    const unsubscribe = store.subscribe(() => {
      const next = store.getState()
      // Selection changes alone are not worth saving.
      if (next.regions === last.regions && next.fields === last.fields && next.audio === last.audio) {
        last = next
        return
      }
      last = next
      dirty = true
      clearTimeout(timer)
      timer = window.setTimeout(flush, 1000)
    })
    const onHide = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => {
      unsubscribe()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
    }
  }, [])

  const saveProjectFile = () => {
    const p = toProjectFile(store.getState())
    if (!p) return
    const bytes = new TextEncoder().encode(JSON.stringify(p, null, 2))
    downloadBytes(bytes, `${p.audio.name.replace(/\.[^.]+$/, '')}.project.json`, 'application/json')
  }

  const openProjectFile = async (file: File) => {
    try {
      const p = parseProjectFile(JSON.parse(await file.text()))
      const current = store.getState().audio
      if (!current || !buffer) {
        // Remember it; it is restored when the matching audio is opened.
        await saveProject(p)
        setSaved(p)
        setNotice(() => () => t('notice.projectLoaded', { name: p.audio.name }))
        return
      }
      if (current.name !== p.audio.name && !confirm(t('confirm.projectOtherAudio', { expected: p.audio.name, actual: current.name }))) {
        return
      }
      if (store.getState().regions.length && !confirm(t('confirm.replaceRegions'))) return
      store.loadProject({ ...p, audio: current })
    } catch (e) {
      setError(() => withFile(file.name, e))
    }
  }

  const importLabels = async (file: File) => {
    try {
      const labels = parseAudacityLabels(await file.text())
      const key = primaryField(store.getState().fields)?.key
      const { added, skipped } = store.addRegions(
        labels.map((l) => ({ start: l.start, end: l.end, values: key && l.label ? { [key]: l.label } : {} })),
      )
      setNotice(() => () =>
        [t('notice.regionsAdded', { count: added }), skipped ? t('notice.regionsSkipped', { count: skipped }) : '']
          .filter(Boolean)
          .join(' '),
      )
    } catch (e) {
      setError(() => withFile(file.name, e))
    }
  }

  const exportLabels = () => {
    const { regions, fields, audio } = store.getState()
    const text = formatAudacityLabels(regions, primaryField(fields)?.key)
    downloadBytes(new TextEncoder().encode(text), `${(audio?.name ?? 'labels').replace(/\.[^.]+$/, '')}.labels.txt`, 'text/plain')
  }

  // Drag & drop an audio file anywhere on the page.
  useEffect(() => {
    const over = (e: DragEvent) => e.preventDefault()
    const drop = (e: DragEvent) => {
      e.preventDefault()
      const f = e.dataTransfer?.files[0]
      if (f) void openFile(f)
    }
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [openFile])

  const player = handle?.player
  const playing = player?.isPlaying() ?? false

  return (
    <div className="app">
      <header className="top">
        <h1>Lang Train Editor</h1>
        {audio && (
          <span className="file muted">
            {t('header.fileInfo', {
              name: audio.name,
              duration: formatTime(audio.duration),
              regions: t('count.regions', { count: regionCount }),
            })}
            {savedAt && ` · ${t('header.saved', { time: i18n.time(savedAt) })}`}
          </span>
        )}
        <div className="spacer" />
        <button onClick={() => fileInput.current?.click()} disabled={!!busy}>
          {t('header.openAudio')}
        </button>
        <button onClick={() => setDetecting((v) => !v)} disabled={!handle} className={detecting ? 'active' : ''}>
          {t('header.detect')}
        </button>
        <button onClick={() => setDialog('fields')}>{t('header.fields')}</button>
        <details className="menu">
          <summary>{t('header.project')}</summary>
          <div className="menu-items" onClick={(e) => ((e.currentTarget.parentElement as HTMLDetailsElement).open = false)}>
            <button onClick={() => setDialog('open-pack')}>{t('menu.openPack')}</button>
            <hr />
            <button onClick={saveProjectFile} disabled={!audio}>
              {t('menu.saveProject')}
            </button>
            <button onClick={() => projectInput.current?.click()}>{t('menu.openProject')}</button>
            <hr />
            <button onClick={() => setDialog('saved')}>{t('menu.saved')}</button>
            <hr />
            <button onClick={() => labelsInput.current?.click()} disabled={!buffer}>
              {t('menu.importLabels')}
            </button>
            <button onClick={exportLabels} disabled={!regionCount}>
              {t('menu.exportLabels')}
            </button>
          </div>
        </details>
        <button className="primary" onClick={() => setDialog('export')} disabled={!buffer || !regionCount}>
          {t('header.export')}
        </button>
        <LanguageSelect i18n={i18n} label={t('common.language')} className="lang" />
        <a href="../" className="small">
          {t('header.player')}
        </a>
        <input
          ref={projectInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void openProjectFile(f)
          }}
        />
        <input
          ref={labelsInput}
          type="file"
          accept=".txt,text/plain"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void importLabels(f)
          }}
        />
        <input
          ref={fileInput}
          type="file"
          accept="audio/*,.mp3,.wav"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void openFile(f)
          }}
        />
      </header>

      {busy && <p className="muted">{busy()}</p>}
      {error && <p className="error">{error()}</p>}
      {notice && (
        <p className="notice">
          {notice()}{' '}
          <button className="link" onClick={() => setNotice(null)}>
            {t('common.dismiss')}
          </button>
        </p>
      )}

      {!buffer && !busy && (
        <main className="start">
          <p>{t('start.intro')}</p>
          <div className="start-actions">
            <button className="primary" onClick={() => fileInput.current?.click()}>
              {t('header.openAudio')}
            </button>
            <button onClick={() => setDialog('open-pack')}>{t('start.openPack')}</button>
          </div>
          {saved && (
            <p className="last-project">
              {t('start.lastProject', {
                name: saved.audio.name,
                regions: t('count.regions', { count: saved.regions.length }),
                time: saved.savedAt ? i18n.dateTime(saved.savedAt) : '—',
              })}{' '}
              <button className="link" onClick={() => setDialog('saved')}>
                {t('start.manageSaved')}
              </button>
            </p>
          )}
        </main>
      )}

      {buffer && (
        <main className="editor">
          <div className="transport">
            <button
              className="play"
              onClick={() => (playing ? player?.pause() : void player?.play())}
              disabled={!player}
              title={t('transport.play')}
            >
              {playing ? '⏸' : '▶'}
            </button>
            <span className="clock">
              {formatTime(player?.getCurrentTime() ?? 0)} / {formatTime(buffer.duration)}
            </span>
            {markIn !== null && <span className="mark">{t('transport.mark', { time: formatTime(markIn) })}</span>}
            <div className="spacer" />
            <button onClick={() => store.undo()} disabled={!store.canUndo()} title={t('transport.undo')}>
              ↶
            </button>
            <button onClick={() => store.redo()} disabled={!store.canRedo()} title={t('transport.redo')}>
              ↷
            </button>
            <button onClick={() => handle?.peaks.zoom.zoomOut()} title={t('transport.zoomOut')}>
              −
            </button>
            <button onClick={() => handle?.peaks.zoom.zoomIn()} title={t('transport.zoomIn')}>
              +
            </button>
            <button onClick={() => setShowHelp((v) => !v)} className={showHelp ? 'active' : ''}>
              {t('transport.shortcuts')}
            </button>
          </div>
          {showHelp && (
            <dl className="shortcuts">
              {SHORTCUTS.map(([k, v]) => (
                <div key={k}>
                  <dt>{i18n.tryT(k) ?? k}</dt>
                  <dd>{t(v)}</dd>
                </div>
              ))}
            </dl>
          )}
          {detecting && handle && (
            <DetectPanel buffer={buffer} handle={handle} onClose={() => setDetecting(false)} onDone={(text) => setNotice(() => text)} />
          )}
          <Waveform buffer={buffer} onReady={setHandle} />
          <RegionTable onPlay={(r) => playRegion(r)} />
        </main>
      )}

      {dialog === 'fields' && <FieldsDialog onClose={() => setDialog(null)} />}
      {dialog === 'saved' && (
        <SavedProjectsDialog
          onClose={() => setDialog(null)}
          onChanged={() => void loadSavedProject().then((p) => setSaved(p?.regions.length ? p : null))}
        />
      )}
      {dialog === 'open-pack' && (
        <OpenPackDialog
          onClose={() => setDialog(null)}
          onOpen={(file, target) => {
            setDialog(null)
            void openFile(file, target)
          }}
        />
      )}
      {dialog === 'export' && buffer && <ExportDialog buffer={buffer} onClose={() => setDialog(null)} />}

      <footer className="muted">
        v{__APP_VERSION__} · {__COMMIT__} · {__BRANCH__} · {i18n.dateTime(__BUILD_TIME__)}
      </footer>
    </div>
  )
}
