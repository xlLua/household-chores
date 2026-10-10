import { useState, type FormEvent } from 'react'
import { Glyph, GLYPH_NAMES } from './glyphs'
import { toISO } from '../lib/recurrence'
import type { Chore, ChoreDraft, GlyphName, RecurrenceAnchor, RecurrenceKind } from '../lib/types'

const KINDS: Array<{ value: RecurrenceKind; label: string }> = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every two weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'every_n_days', label: 'Every N days' },
  { value: 'once', label: 'One-off' },
]

function emptyDraft(): ChoreDraft {
  return {
    title: '',
    notes: null,
    points: 3,
    glyph: 'broom',
    recurrence_kind: 'weekly',
    recurrence_interval: 7,
    recurrence_anchor: 'calendar',
    start_date: toISO(new Date()),
  }
}

export function ChoreForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Chore
  onSave: (draft: ChoreDraft) => Promise<void>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<ChoreDraft>(() =>
    initial
      ? {
          title: initial.title,
          notes: initial.notes,
          points: initial.points,
          glyph: initial.glyph,
          recurrence_kind: initial.recurrence_kind,
          recurrence_interval: initial.recurrence_interval,
          recurrence_anchor: initial.recurrence_anchor,
          start_date: initial.start_date,
        }
      : emptyDraft(),
  )
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof ChoreDraft>(key: K, value: ChoreDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft.title.trim() || saving) return
    setSaving(true)
    try {
      await onSave({ ...draft, title: draft.title.trim() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="sheet" onSubmit={submit}>
      <label className="field">
        <span className="label">Chore</span>
        <input
          className="input"
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Take out the trash"
          maxLength={80}
          required
          autoFocus
        />
      </label>

      <div className="field">
        <span className="label">Mark</span>
        <div className="glyph-picker">
          {GLYPH_NAMES.map((name: GlyphName) => (
            <button
              key={name}
              type="button"
              aria-pressed={draft.glyph === name}
              aria-label={name}
              onClick={() => set('glyph', name)}
            >
              <Glyph name={name} />
            </button>
          ))}
        </div>
      </div>

      <div className="row">
        <label className="field">
          <span className="label">Repeats</span>
          <select
            className="select"
            value={draft.recurrence_kind}
            onChange={(e) => set('recurrence_kind', e.target.value as RecurrenceKind)}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="label">Points</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={draft.points}
            onChange={(e) => set('points', Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
      </div>

      {draft.recurrence_kind === 'every_n_days' && (
        <label className="field">
          <span className="label">Days between</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            value={draft.recurrence_interval}
            onChange={(e) =>
              set('recurrence_interval', Math.max(1, Number(e.target.value) || 1))
            }
          />
        </label>
      )}

      {draft.recurrence_kind !== 'once' && (
        <label className="field">
          <span className="label">Counted from</span>
          <select
            className="select"
            value={draft.recurrence_anchor}
            onChange={(e) => set('recurrence_anchor', e.target.value as RecurrenceAnchor)}
          >
            <option value="calendar">The calendar — e.g. every Monday</option>
            <option value="completion">When it was last done</option>
          </select>
          <span
            className="card__notes"
            style={{ display: 'block', marginTop: '0.35rem' }}
          >
            {draft.recurrence_anchor === 'calendar'
              ? 'Comes due on schedule whether or not it was done last time.'
              : 'Comes due again once someone has done it, counting from then.'}
          </span>
        </label>
      )}

      <label className="field">
        <span className="label">
          {draft.recurrence_kind === 'once' ? 'Due' : 'Starting'}
        </span>
        <input
          className="input"
          type="date"
          value={draft.start_date}
          onChange={(e) => set('start_date', e.target.value)}
        />
        {draft.recurrence_kind === 'weekly' && (
          <span className="card__notes" style={{ display: 'block', marginTop: '0.35rem' }}>
            Pick the weekday you want it on — the schedule repeats from here.
          </span>
        )}
      </label>

      <label className="field">
        <span className="label">Notes (optional)</span>
        <textarea
          className="textarea"
          value={draft.notes ?? ''}
          onChange={(e) => set('notes', e.target.value || null)}
          placeholder="Blue bin, out by 7am"
          maxLength={280}
        />
      </label>

      <div className="row" style={{ marginTop: '0.25rem' }}>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add chore'}
        </button>
      </div>
    </form>
  )
}
