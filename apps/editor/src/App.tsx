import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { LONG_FILE_SECONDS, decodeFile } from './audio/decode'
import { ExportDialog } from './components/ExportDialog'
import { FieldsDialog } from './components/FieldsDialog'
import { RegionTable } from './components/RegionTable'
import { Waveform, type WaveformHandle } from './components/Waveform'
import { formatTime } from './format'
import { store, useProject, type Region } from './state/store'

const SHORTCUTS: [string, string][] = [
  ['Drag on waveform', 'Create a region'],
  ['Drag region edges', 'Adjust boundaries'],
  ['Space', 'Play / pause'],
  ['I, then O', 'Mark start / end while listening → new region'],
  ['Enter', 'Play selected region'],
  ['L', 'Loop selected region'],
  ['↑ / ↓', 'Previous / next region'],
  ['← / →', 'Move start by 10 ms (Shift: 100 ms)'],
  ['Alt + ← / →', 'Move end by 10 ms (Shift: 100 ms)'],
  ['S', 'Split region at the playhead'],
  ['M', 'Merge with the next region'],
  ['Delete', 'Delete region'],
  ['Ctrl+Z / Ctrl+Shift+Z', 'Undo / redo'],
  ['+ / −', 'Zoom in / out'],
  ['Esc', 'Leave a text field'],
  ['Ctrl+Enter', 'Play region (also in text fields)'],
]

function isTextTarget(t: EventTarget | null) {
  return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

function usePlayerTick(handle: WaveformHandle | null) {
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => handle?.player.subscribe(force), [handle])
}

export default function App() {
  const audio = useProject((s) => s.audio)
  const regionCount = useProject((s) => s.regions.length)
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null)
  const [handle, setHandle] = useState<WaveformHandle | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'fields' | 'export' | null>(null)
  const [markIn, setMarkIn] = useState<number | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  usePlayerTick(handle)
  useProject((s) => s) // re-render on any change (undo/redo button state)

  const openFile = useCallback(async (file: File) => {
    if (store.getState().regions.length && !confirm('Open another file? The current regions will be discarded.')) return
    setBusy(`Decoding ${file.name}…`)
    setError(null)
    setNotice(null)
    try {
      const decoded = await decodeFile(file)
      setBuffer(null)
      setMarkIn(null)
      store.newProject({ name: file.name, size: file.size, duration: decoded.duration })
      setBuffer(decoded)
      if (decoded.duration > LONG_FILE_SECONDS) {
        setNotice(`This recording is ${formatTime(decoded.duration)} long. Very long files use a lot of memory; consider splitting it.`)
      }
    } catch (e) {
      setError((e as Error).message)
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
      if (ctrl && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) store.redo()
        else store.undo()
        e.preventDefault()
        return
      }
      if (ctrl && e.key.toLowerCase() === 'y') {
        store.redo()
        e.preventDefault()
        return
      }
      if (ctrl || e.altKey && !e.key.startsWith('Arrow')) return

      const step = e.shiftKey ? 0.1 : 0.01
      const t = player.getCurrentTime()
      let handled = true
      switch (e.key) {
        case ' ':
          if (player.isPlaying()) player.pause()
          else void player.play()
          break
        case 'i':
        case 'I':
          setMarkIn(t)
          break
        case 'o':
        case 'O':
          if (markIn !== null) {
            if (!store.addRegion(markIn, t)) setNotice('No room for a region there (overlaps another region or is too short).')
            setMarkIn(null)
          }
          break
        case 'Enter':
          if (sel) playRegion(sel)
          break
        case 'l':
        case 'L':
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
        case 'S':
          if (sel && !store.split(sel.id, t)) setNotice('Put the playhead inside the selected region to split it.')
          break
        case 'm':
        case 'M':
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

  // Warn before losing unsaved work (autosave comes in the next iteration).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (store.getState().regions.length) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

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
            {audio.name} · {formatTime(audio.duration)} · {regionCount} regions
          </span>
        )}
        <div className="spacer" />
        <button onClick={() => fileInput.current?.click()} disabled={!!busy}>
          Open audio
        </button>
        <button onClick={() => setDialog('fields')}>Fields</button>
        <button className="primary" onClick={() => setDialog('export')} disabled={!buffer || !regionCount}>
          Export
        </button>
        <a href="../" className="small">
          Player
        </a>
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

      {busy && <p className="muted">{busy}</p>}
      {error && <p className="error">{error}</p>}
      {notice && (
        <p className="notice">
          {notice}{' '}
          <button className="link" onClick={() => setNotice(null)}>
            dismiss
          </button>
        </p>
      )}

      {!buffer && !busy && (
        <main className="start">
          <p>
            Open an MP3 or WAV recording (or drop it here), mark phrases as regions on the waveform, fill in their texts
            and export a pack for the player.
          </p>
          <button className="primary" onClick={() => fileInput.current?.click()}>
            Open audio
          </button>
        </main>
      )}

      {buffer && (
        <main className="editor">
          <div className="transport">
            <button className="play" onClick={() => (playing ? player?.pause() : void player?.play())} disabled={!player}>
              {playing ? '⏸' : '▶'}
            </button>
            <span className="clock">
              {formatTime(player?.getCurrentTime() ?? 0)} / {formatTime(buffer.duration)}
            </span>
            {markIn !== null && <span className="mark">IN {formatTime(markIn)} — press O to close</span>}
            <div className="spacer" />
            <button onClick={() => store.undo()} disabled={!store.canUndo()} title="Undo (Ctrl+Z)">
              ↶
            </button>
            <button onClick={() => store.redo()} disabled={!store.canRedo()} title="Redo (Ctrl+Shift+Z)">
              ↷
            </button>
            <button onClick={() => handle?.peaks.zoom.zoomOut()} title="Zoom out (−)">
              −
            </button>
            <button onClick={() => handle?.peaks.zoom.zoomIn()} title="Zoom in (+)">
              +
            </button>
            <button onClick={() => setShowHelp((v) => !v)} className={showHelp ? 'active' : ''}>
              Shortcuts
            </button>
          </div>
          {showHelp && (
            <dl className="shortcuts">
              {SHORTCUTS.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          <Waveform buffer={buffer} onReady={setHandle} />
          <RegionTable onPlay={(r) => playRegion(r)} />
        </main>
      )}

      {dialog === 'fields' && <FieldsDialog onClose={() => setDialog(null)} />}
      {dialog === 'export' && buffer && <ExportDialog buffer={buffer} onClose={() => setDialog(null)} />}

      <footer className="muted">
        v{__APP_VERSION__} · {__COMMIT__} · {__BRANCH__} · {new Date(__BUILD_TIME__).toLocaleString('en-GB')}
      </footer>
    </div>
  )
}
