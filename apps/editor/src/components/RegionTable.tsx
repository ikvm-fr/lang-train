import { primaryField } from '@lang-train/pack'
import { useEffect, useRef } from 'react'
import { formatTime } from '../format'
import { useI18n } from '../i18n'
import { store, useProject, type Region } from '../state/store'

export function RegionTable({ onPlay }: { onPlay: (r: Region) => void }) {
  const { t, number } = useI18n()
  const regions = useProject((s) => s.regions)
  const fields = useProject((s) => s.fields)
  const selectedId = useProject((s) => s.selectedId)
  const bodyRef = useRef<HTMLTableSectionElement>(null)
  const primary = primaryField(fields)

  useEffect(() => {
    bodyRef.current?.querySelector('tr.selected')?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])

  if (!regions.length) {
    return (
      <p className="muted empty">{t('table.empty')}</p>
    )
  }

  return (
    <table className="regions">
      <thead>
        <tr>
          <th className="num">#</th>
          <th className="time">{t('table.time')}</th>
          {fields.map((f) => (
            <th key={f.key}>{f.label}</th>
          ))}
          <th className="actions" />
        </tr>
      </thead>
      <tbody ref={bodyRef}>
        {regions.map((r, i) => (
          <tr
            key={r.id}
            className={`${r.id === selectedId ? 'selected' : ''}${primary && !r.values[primary.key]?.trim() ? ' missing' : ''}`}
          >
            <td
              className="num clickable"
              title={t('table.play')}
              onClick={() => {
                store.select(r.id)
                onPlay(r)
              }}
            >
              {i + 1}
            </td>
            <td
              className="time clickable"
              title={t('table.play')}
              onClick={() => {
                store.select(r.id)
                onPlay(r)
              }}
            >
              {formatTime(r.start)}
              <br />
              <span className="muted">{t('unit.seconds', { value: number(r.end - r.start, 2) })}</span>
            </td>
            {fields.map((f) => {
              const common = {
                value: r.values[f.key] ?? '',
                lang: f.lang,
                dir: f.dir,
                'aria-label': `${f.label} ${i + 1}`,
                onFocus: () => store.select(r.id),
                onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                  store.setValue(r.id, f.key, e.target.value),
              }
              return (
                <td key={f.key}>{f.multiline ? <textarea rows={1} {...common} /> : <input type="text" {...common} />}</td>
              )
            })}
            <td className="actions">
              <button className="icon" title={t('table.delete')} tabIndex={-1} onClick={() => store.remove(r.id)}>
                ✕
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
