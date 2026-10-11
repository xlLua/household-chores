import { useState, type FormEvent } from 'react'
import { Glyph, GLYPH_NAMES } from './glyphs'
import { toISO } from '../lib/recurrence'
import { useAuth } from '../lib/auth'
import type { Chore, ChoreDraft, GlyphName, RecurrenceAnchor, RecurrenceKind } from '../lib/types'

/** Repeat options as shown; the monthly ones differ only in interval, which
 *  for 'monthly' is the number of months. */
const REPEATS: Array<{ id: string; label: string; kind: RecurrenceKind; interval?: number }> = [
  { id: 'daily', label: 'Elke dag', kind: 'daily' },
  { id: 'weekly', label: 'Elke week', kind: 'weekly' },
  { id: 'biweekly', label: 'Elke twee weken', kind: 'biweekly' },
  { id: 'monthly', label: 'Elke maand', kind: 'monthly', interval: 1 },
  { id: 'quarterly', label: 'Elke 3 maanden', kind: 'monthly', interval: 3 },
  { id: 'halfyearly', label: 'Elke 6 maanden', kind: 'monthly', interval: 6 },
  { id: 'every_n_days', label: 'Elke N dagen', kind: 'every_n_days' },
  { id: 'once', label: 'Eenmalig', kind: 'once' },
]

function repeatOf(draft: ChoreDraft): string {
  const match = REPEATS.find(
    (r) =>
      r.kind === draft.recurrence_kind &&
      (r.interval === undefined || r.interval === draft.recurrence_interval),
  )
  return (match ?? REPEATS.find((r) => r.kind === draft.recurrence_kind))!.id
}

function emptyDraft(): ChoreDraft {
  return {
    title: '',
    notes: null,
    points: 3,
    glyph: 'broom',
    recurrence_kind: 'weekly',
    recurrence_interval: 1,
    recurrence_anchor: 'calendar',
    start_date: toISO(new Date()),
    owner_id: null,
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
          owner_id: initial.owner_id,
        }
      : emptyDraft(),
  )
  const [saving, setSaving] = useState(false)
  const { session } = useAuth()
  const personal = draft.owner_id !== null

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
        <span className="label">Taak</span>
        <input
          className="input"
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Vuilnis buitenzetten"
          maxLength={80}
          required
          autoFocus
        />
      </label>

      <div className="field">
        <span className="label">Icoon</span>
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
          <span className="label">Herhaling</span>
          <select
            className="select"
            value={repeatOf(draft)}
            onChange={(e) => {
              const r = REPEATS.find((x) => x.id === e.target.value)!
              // The interval means months for 'monthly' and days for
              // 'every_n_days', so never carry it across from another option.
              const interval =
                r.interval ??
                (r.kind === 'every_n_days'
                  ? draft.recurrence_kind === 'every_n_days'
                    ? draft.recurrence_interval
                    : 7
                  : 1)
              setDraft((d) => ({ ...d, recurrence_kind: r.kind, recurrence_interval: interval }))
            }}
          >
            {REPEATS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        {!personal && (
          <label className="field">
            <span className="label">Punten</span>
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
        )}
      </div>

      {draft.recurrence_kind === 'every_n_days' && (
        <label className="field">
          <span className="label">Aantal dagen</span>
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
          <span className="label">Gerekend vanaf</span>
          <select
            className="select"
            value={draft.recurrence_anchor}
            onChange={(e) => set('recurrence_anchor', e.target.value as RecurrenceAnchor)}
          >
            <option value="calendar">De kalender — bijv. elke maandag</option>
            <option value="completion">De laatste keer dat het gedaan is</option>
          </select>
          <span
            className="card__notes"
            style={{ display: 'block', marginTop: '0.35rem' }}
          >
            {draft.recurrence_anchor === 'calendar'
              ? 'Volgt een vast schema, ook als het een keer later gedaan is.'
              : 'Komt terug nadat iemand het gedaan heeft, gerekend vanaf dat moment.'}
          </span>
        </label>
      )}

      <label className="field">
        <span className="label">
          {draft.recurrence_kind === 'once' ? 'Datum' : 'Vanaf'}
        </span>
        <input
          className="input"
          type="date"
          value={draft.start_date}
          onChange={(e) => set('start_date', e.target.value)}
        />
        {draft.recurrence_kind === 'weekly' && (
          <span className="card__notes" style={{ display: 'block', marginTop: '0.35rem' }}>
            Kies de weekdag waarop het moet gebeuren — het schema herhaalt vanaf hier.
          </span>
        )}
      </label>

      <label className="field">
        <span className="label">Notities (optioneel)</span>
        <textarea
          className="textarea"
          value={draft.notes ?? ''}
          onChange={(e) => set('notes', e.target.value || null)}
          placeholder="Blauwe container, voor 7 uur buiten"
          maxLength={280}
        />
      </label>

      {/* Fixed once the chore exists (the column isn't updatable), so the
          choice is only offered when creating. */}
      {initial ? (
        personal && (
          <p className="card__notes">Persoonlijke taak — alleen jij ziet hem, zonder punten.</p>
        )
      ) : (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={personal}
            onChange={(e) => set('owner_id', e.target.checked ? (session?.user.id ?? null) : null)}
          />
          <span>
            Persoonlijke taak
            <span className="card__notes" style={{ display: 'block', marginTop: '0.1rem' }}>
              Alleen jij ziet deze taak, en afvinken levert geen punten op.
            </span>
          </span>
        </label>
      )}

      <div className="row" style={{ marginTop: '0.25rem' }}>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Annuleren
        </button>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? 'Opslaan…' : initial ? 'Wijzigingen opslaan' : 'Taak toevoegen'}
        </button>
      </div>
    </form>
  )
}
