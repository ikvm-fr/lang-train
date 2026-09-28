import { FIELD_KEY_PATTERN, isReservedColumn, type FieldDef, type FieldDisplay, type FieldRole } from '@lang-train/pack'
import { useState } from 'react'
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
    if (used && !confirm(`Field "${fields[i].label}" has text in some regions. Remove it anyway?`)) return
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
    if (!fields.length) return alert('Keep at least one field.')
    store.setFields(fields.map((f) => ({ ...f, label: f.label.trim() || f.key })))
    onClose()
  }

  return (
    <Dialog
      title="Fields"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={save}>
            Save
          </button>
        </>
      }
    >
      <table className="fields">
        <thead>
          <tr>
            <th>Label</th>
            <th>Key</th>
            <th>Role</th>
            <th>Player</th>
            <th>Multiline</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={f.key}>
              <td>
                <input value={f.label} onChange={(e) => update(i, { label: e.target.value })} aria-label="Label" />
              </td>
              <td className="muted">
                <code>{f.key}</code>
              </td>
              <td>
                <select value={f.role ?? ''} onChange={(e) => setRole(i, e.target.value as FieldRole | '')}>
                  <option value="">—</option>
                  <option value="primary">Primary</option>
                  <option value="translation">Translation</option>
                </select>
              </td>
              <td>
                <select
                  value={f.display ?? 'toggle'}
                  disabled={f.role === 'primary'}
                  onChange={(e) => update(i, { display: e.target.value as FieldDisplay })}
                >
                  <option value="toggle">Shown, can hide</option>
                  <option value="always">Always shown</option>
                  <option value="hidden">Hidden</option>
                </select>
              </td>
              <td>
                <input type="checkbox" checked={!!f.multiline} onChange={(e) => update(i, { multiline: e.target.checked || undefined })} />
              </td>
              <td className="row-actions">
                <button className="icon" title="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                  ↑
                </button>
                <button className="icon" title="Move down" onClick={() => move(i, 1)} disabled={i === fields.length - 1}>
                  ↓
                </button>
                <button className="icon" title="Remove" onClick={() => remove(i)}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="add-field">
        <input
          placeholder="New field label, e.g. Word by word"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} disabled={!newLabel.trim()}>
          Add field
        </button>
      </div>
      <p className="muted small">
        The primary field is the main phrase text. The translation field is shown under it in the phone notification.
        Your field setup is remembered for new projects.
      </p>
    </Dialog>
  )
}
