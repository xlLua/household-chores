import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'
import { Check, Undo2 } from 'lucide-react'
import { Glyph } from './glyphs'
import { Sigil } from './Sigil'
import { bucketOf } from '../lib/chores'
import type { InstanceWithChore, Profile } from '../lib/types'
import { recurrenceLabel } from '../lib/recurrence'

function dueText(dueDate: string): string {
  const days = differenceInCalendarDays(parseISO(dueDate), new Date())
  if (days === 0) return 'Vandaag'
  if (days === 1) return 'Morgen'
  if (days === -1) return '1 dag te laat'
  if (days < -1) return `${Math.abs(days)} dagen te laat`
  if (days < 7) return capitalize(format(parseISO(dueDate), 'EEEE', { locale: nl }))
  return format(parseISO(dueDate), 'd MMM', { locale: nl })
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
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
              Gedaan door {doer?.display_name ?? 'iemand'}
              {instance.completed_at
                ? ` · ${format(parseISO(instance.completed_at), 'd MMM', { locale: nl })}`
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
          <span className="points">{instance.chore.points} punten</span>
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
          aria-label={`${instance.chore.title} ongedaan maken`}
        >
          <Undo2 size={18} strokeWidth={1.8} />
        </button>
      ) : (
        <button
          type="button"
          className="card__action"
          onClick={onComplete}
          disabled={busy}
          aria-label={`${instance.chore.title} afvinken`}
        >
          <Check size={20} strokeWidth={2} />
        </button>
      )}
    </article>
  )
}
