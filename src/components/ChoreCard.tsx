import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { Check, Undo2 } from 'lucide-react'
import { Glyph } from './glyphs'
import { Sigil } from './Sigil'
import { bucketOf } from '../lib/chores'
import type { InstanceWithChore, Profile } from '../lib/types'
import { recurrenceLabel } from '../lib/recurrence'

function dueText(dueDate: string): string {
  const days = differenceInCalendarDays(parseISO(dueDate), new Date())
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days === -1) return 'A day overdue'
  if (days < -1) return `${Math.abs(days)} days overdue`
  if (days < 7) return `Due ${format(parseISO(dueDate), 'EEEE')}`
  return `Due ${format(parseISO(dueDate), 'd MMM')}`
}

export function ChoreCard({
  instance,
  profiles,
  stamping,
  busy,
  onComplete,
  onUndo,
}: {
  instance: InstanceWithChore
  profiles: Profile[]
  stamping: boolean
  busy: boolean
  onComplete: () => void
  onUndo: () => void
}) {
  const bucket = bucketOf(instance)
  const done = instance.status === 'done'
  const doer = profiles.find((p) => p.user_id === instance.completed_by)

  const classes = [
    'card',
    done && 'card--done',
    !done && bucket === 'overdue' && 'card--overdue',
    stamping && 'card--stamping',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article className={classes}>
      <Sigil playing={stamping} />

      <span className="card__glyph">
        <Glyph name={instance.chore.glyph} />
      </span>

      <div className="card__body">
        <h3 className="card__title">{instance.chore.title}</h3>
        <p className="card__meta">
          {done ? (
            <span>
              Done by {doer?.display_name ?? 'someone'}
              {instance.completed_at
                ? ` · ${format(parseISO(instance.completed_at), 'd MMM')}`
                : ''}
            </span>
          ) : (
            <>
              <span>{dueText(instance.due_date)}</span>
              <span aria-hidden="true">·</span>
              <span>{recurrenceLabel(instance.chore)}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span className="points">{instance.chore.points} pts</span>
        </p>
        {instance.chore.notes && !done && (
          <p className="card__notes">{instance.chore.notes}</p>
        )}
      </div>

      {done ? (
        <button
          type="button"
          className="card__action"
          onClick={onUndo}
          disabled={busy}
          aria-label={`Undo ${instance.chore.title}`}
        >
          <Undo2 size={18} strokeWidth={1.8} />
        </button>
      ) : (
        <button
          type="button"
          className="card__action"
          onClick={onComplete}
          disabled={busy}
          aria-label={`Mark ${instance.chore.title} done`}
        >
          <Check size={20} strokeWidth={2} />
        </button>
      )}
    </article>
  )
}
