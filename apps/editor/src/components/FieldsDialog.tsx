import { FIELD_KEY_PATTERN, isReservedColumn, type FieldDef, type FieldDisplay, type FieldRole } from '@lang-train/pack'
import { useState } from 'react'
import { useI18n } from '../i18n'
import { store } from '../state/store'
import { Dialog } from './Dialog'

// Edits the field model. Keys are generated from the label when a field is added and then stay fixed.

function keyFromLabel(label: string, taken: Set<string>): string {
  let base = label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!FIELD_KEY_PATTERN.test(base)) base = `field_${base}`.replace(/_+$/, '')
  if (!FIELD_KEY_PATTERN.test(base) || isReservedColumn(base)) base = `field_${base}`
  let key = base
  for (let n = 2; taken.has(key); n++) key = `${base}_${n}`
  return key
}

export function FieldsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const [fields, setFields] = useState<FieldDef[]>(() => store.getState().fields.map((f) => ({ ...f })))
  const [newLabel, setNewLabel] = useState('')

  const update = (i: number, patch: Partial<FieldDef>) =>
    setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)))

  const setRole = (i: number, role: FieldRole | '') =>
    setFields((fs) =>
      fs.map((f, j) => {
        if (j === i) return { ...f, role: role || undefined }
        return role && f.role === role ? { ...f, role: undefined } : f
      }),
    )

  const move = (i: number, d: number) =>
    setFields((fs) => {
      const j = i + d
      if (j < 0 || j >= fs.length) return fs
      const next = [...fs]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const remove = (i: number) => {
    const key = fields[i].key
    const used = store.getState().regions.some((r) => r.values[key]?.trim())
    if (used && !confirm(t('fields.confirmRemove', { label: fields[i].label }))) return
    setFields((fs) => fs.filter((_, j) => j !== i))
  }

  const add = () => {
    const label = newLabel.trim()
    if (!label) return
    const key = keyFromLabel(label, new Set(fields.map((f) => f.key)))
    setFields((fs) => [...fs, { key, label }])
    setNewLabel('')
  }

  const save = () => {
    if (!fields.length) return alert(t('fields.keepOne'))
    store.setFields(fields.map((f) => ({ ...f, label: f.label.trim() || f.key })))
    onClose()
  }

  return (
    <Dialog
      title={t('fields.title')}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>{t('common.cancel')}</button>
          <button className="primary" onClick={save}>
            {t('fields.save')}
          </button>
        </>
      }
    >
      <table className="fields">
        <thead>
          <tr>
            <th>{t('fields.label')}</th>
            <th>{t('fields.key')}</th>
            <th>{t('fields.role')}</th>
            <th>{t('fields.player')}</th>
            <th>{t('fields.multiline')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={f.key}>
              <td>
                <input value={f.label} onChange={(e) => update(i, { label: e.target.value })} aria-label={t('fields.label')} />
              </td>
              <td className="muted">
                <code>{f.key}</code>
              </td>
              <td>
                <select value={f.role ?? ''} onChange={(e) => setRole(i, e.target.value as FieldRole | '')}>
                  <option value="">—</option>
                  <option value="primary">{t('fields.rolePrimary')}</option>
                  <option value="translation">{t('fields.roleTranslation')}</option>
                </select>
              </td>
              <td>
                <select
                  value={f.display ?? 'toggle'}
                  disabled={f.role === 'primary'}
                  onChange={(e) => update(i, { display: e.target.value as FieldDisplay })}
                >
                  <option value="toggle">{t('fields.showToggle')}</option>
                  <option value="always">{t('fields.showAlways')}</option>
                  <option value="hidden">{t('fields.showHidden')}</option>
                </select>
              </td>
              <td>
                <input type="checkbox" checked={!!f.multiline} onChange={(e) => update(i, { multiline: e.target.checked || undefined })} />
              </td>
              <td className="row-actions">
                <button className="icon" title={t('fields.moveUp')} onClick={() => move(i, -1)} disabled={i === 0}>
                  ↑
                </button>
                <button className="icon" title={t('fields.moveDown')} onClick={() => move(i, 1)} disabled={i === fields.length - 1}>
                  ↓
                </button>
                <button className="icon" title={t('fields.remove')} onClick={() => remove(i)}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="add-field">
        <input
          placeholder={t('fields.newPlaceholder')}
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} disabled={!newLabel.trim()}>
          {t('fields.add')}
        </button>
      </div>
      <p className="muted small">{t('fields.help')}</p>
    </Dialog>
  )
}
