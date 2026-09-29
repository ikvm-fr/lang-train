import { useEffect, useState } from 'react'
import {
  clearSavedProjects,
  deleteSavedProject,
  listSavedProjects,
  savedProjectKey,
  type SavedProjectInfo,
} from '../state/persist'
import { store } from '../state/store'
import { Dialog } from './Dialog'

const kb = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`)

// Lists autosaved projects in IndexedDB and deletes them.
export function SavedProjectsDialog({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [items, setItems] = useState<SavedProjectInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const audio = store.getState().audio
  const currentKey = audio ? savedProjectKey(audio) : null

  const refresh = () =>
    listSavedProjects()
      .then(setItems)
      .catch((e) => setError(String(e)))

  useEffect(() => {
    void refresh()
  }, [])

  const run = async (action: () => Promise<void>) => {
    try {
      await action()
      onChanged()
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }

  const remove = (it: SavedProjectInfo) => {
    if (confirm(`Delete the saved project for ${it.name} (${it.regions} regions)?`)) void run(() => deleteSavedProject(it.key))
  }
  const removeAll = () => {
    if (items && confirm(`Delete all ${items.length} saved projects from this browser?`)) void run(clearSavedProjects)
  }

  return (
    <Dialog
      title="Saved projects"
      onClose={onClose}
      footer={
        <>
          <button onClick={removeAll} disabled={!items?.length} className="danger">
            Delete all
          </button>
          <div className="spacer" />
          <button className="primary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <p className="muted small">
        Autosaved work kept in this browser (IndexedDB), one project per recording. Audio is never stored here. Export a
        pack or a project file first if you want to keep the work.
      </p>
      {items === null && !error && <p className="muted">Loading…</p>}
      {items?.length === 0 && <p>Nothing is saved.</p>}
      {!!items?.length && (
        <table className="saved">
          <thead>
            <tr>
              <th>Recording</th>
              <th>Regions</th>
              <th>Saved</th>
              <th>Size</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.key}>
                <td>
                  {it.name}
                  {it.key === currentKey && <span className="muted"> (open now)</span>}
                </td>
                <td>{it.regions}</td>
                <td>{it.savedAt ? new Date(it.savedAt).toLocaleString('en-GB') : '—'}</td>
                <td>{kb(it.bytes)}</td>
                <td>
                  <button className="icon" title="Delete" onClick={() => remove(it)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {currentKey && items?.some((it) => it.key === currentKey) && (
        <p className="muted small">The project that is open now is saved again as soon as you change something.</p>
      )}
      {error && <p className="error">{error}</p>}
    </Dialog>
  )
}
