import { useEffect, useState } from 'react'
import {
  clearSavedProjects,
  deleteSavedProject,
  listSavedProjects,
  savedProjectKey,
  type SavedProjectInfo,
} from '../state/persist'
import { i18n, useI18n } from '../i18n'
import { store } from '../state/store'
import { Dialog } from './Dialog'

const kb = (bytes: number) => (bytes < 1024 ? `${i18n.number(bytes)} B` : `${i18n.number(Math.round(bytes / 1024))} KB`)

// Lists autosaved projects in IndexedDB and deletes them.
export function SavedProjectsDialog({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { t } = useI18n()
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
    if (confirm(t('saved.confirmDelete', { name: it.name, regions: t('count.regions', { count: it.regions }) }))) {
      void run(() => deleteSavedProject(it.key))
    }
  }
  const removeAll = () => {
    if (items && confirm(t('saved.confirmDeleteAll', { count: items.length }))) void run(clearSavedProjects)
  }

  return (
    <Dialog
      title={t('saved.title')}
      onClose={onClose}
      footer={
        <>
          <button onClick={removeAll} disabled={!items?.length} className="danger">
            {t('saved.deleteAll')}
          </button>
          <div className="spacer" />
          <button className="primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </>
      }
    >
      <p className="muted small">{t('saved.help')}</p>
      {items === null && !error && <p className="muted">{t('common.loading')}</p>}
      {items?.length === 0 && <p>{t('saved.nothing')}</p>}
      {!!items?.length && (
        <table className="saved">
          <thead>
            <tr>
              <th>{t('saved.recording')}</th>
              <th>{t('saved.regions')}</th>
              <th>{t('saved.savedAt')}</th>
              <th>{t('saved.size')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.key}>
                <td>
                  {it.name}
                  {it.key === currentKey && <span className="muted"> {t('saved.openNow')}</span>}
                </td>
                <td>{it.regions}</td>
                <td>{it.savedAt ? i18n.dateTime(it.savedAt) : '—'}</td>
                <td>{kb(it.bytes)}</td>
                <td>
                  <button className="icon" title={t('saved.delete')} onClick={() => remove(it)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {currentKey && items?.some((it) => it.key === currentKey) && (
        <p className="muted small">{t('saved.reSaved')}</p>
      )}
      {error && <p className="error">{error}</p>}
    </Dialog>
  )
}
