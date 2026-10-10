import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  format,
  isAfter,
  isBefore,
  parseISO,
} from 'date-fns'
import type { Chore, ChoreInstance, RecurrenceKind } from './types'

/** How far ahead instances are materialised. */
export const HORIZON_DAYS = 14
/** How far back the generator is willing to create missed occurrences. Stops a
 *  chore started in January from spawning 200 overdue rows in October. */
export const BACKFILL_DAYS = 30

export const ISO = 'yyyy-MM-dd'
export const toISO = (d: Date) => format(d, ISO)

export function recurrenceLabel(chore: Chore): string {
  const n = chore.recurrence_interval
  const base: Record<RecurrenceKind, string> = {
    once: 'One-off',
    daily: 'Every day',
    weekly: 'Weekly',
    biweekly: 'Every two weeks',
    monthly: 'Monthly',
    every_n_days: `Every ${n} days`,
  }
  const label = base[chore.recurrence_kind]
  if (chore.recurrence_kind === 'once') return label
  return chore.recurrence_anchor === 'completion' ? `${label}, after it's done` : label
}

/** The next occurrence after `date`, or null for a one-off. */
export function stepFrom(chore: Chore, date: Date): Date | null {
  switch (chore.recurrence_kind) {
    case 'once':
      return null
    case 'daily':
      return addDays(date, 1)
    case 'weekly':
      return addDays(date, 7)
    case 'biweekly':
      return addDays(date, 14)
    case 'monthly':
      return addMonths(date, 1)
    case 'every_n_days':
      return addDays(date, Math.max(1, chore.recurrence_interval))
  }
}

/**
 * Which due dates are missing for this chore, given the instances that already
 * exist. Pure, so the awkward parts are unit-testable without a database.
 *
 * Idempotent by construction: it only ever returns dates not already present,
 * and `unique (chore_id, due_date)` catches anything that races past it.
 */
export function missingDueDates(
  chore: Chore,
  existing: ChoreInstance[],
  today: Date,
): string[] {
  if (chore.archived_at) return []

  const taken = new Set(existing.map((i) => i.due_date))
  const horizon = addDays(today, HORIZON_DAYS)
  const floor = addDays(today, -BACKFILL_DAYS)

  // --- completion-anchored: one open instance at a time -------------------
  // The next occurrence is normally created at completion time; this branch is
  // the self-healing path, so a failed write can't make a chore disappear.
  if (chore.recurrence_anchor === 'completion') {
    if (existing.some((i) => i.status === 'open')) return []

    const done = existing
      .filter((i) => i.status === 'done' && i.completed_at)
      .sort((a, b) => (a.completed_at! < b.completed_at! ? 1 : -1))

    let next: Date
    if (done.length === 0) {
      if (existing.length > 0) return [] // only skipped instances; leave it be
      next = parseISO(chore.start_date)
    } else {
      const from = stepFrom(chore, parseISO(done[0].completed_at!.slice(0, 10)))
      if (!from) return [] // one-off, already done
      next = from
    }

    // A collision with an existing row would otherwise stall the chore
    // forever, since the insert gets silently ignored.
    let guard = 0
    while (taken.has(toISO(next)) && guard++ < 400) next = addDays(next, 1)
    return [toISO(next)]
  }

  // --- one-off ------------------------------------------------------------
  if (chore.recurrence_kind === 'once') {
    return existing.length > 0 ? [] : [chore.start_date]
  }

  // --- calendar-anchored --------------------------------------------------
  // Each occurrence is computed as an offset from start_date, NOT by stepping a
  // cursor forward one occurrence at a time. That matters for monthly: addMonths
  // clamps, so a chore due on the 31st would step to Feb 28 and then stay on the
  // 28th forever. Measuring from the original date makes February a one-month
  // exception instead of a permanent drift.
  const start = parseISO(chore.start_date)

  // Jump straight to the first occurrence at or after the backfill floor.
  let k = 0
  if (isBefore(start, floor)) {
    const span = differenceInCalendarDays(floor, start)
    k =
      chore.recurrence_kind === 'monthly'
        ? Math.max(0, differenceInCalendarMonths(floor, start))
        : Math.max(0, Math.floor(span / stepDays(chore)))
  }

  const out: string[] = []
  let guard = 0
  while (guard++ < 500) {
    const at = occurrenceAt(chore, start, k)
    if (isBefore(at, floor)) {
      k += 1
      continue
    }
    if (isAfter(at, horizon)) break
    const iso = toISO(at)
    if (!taken.has(iso)) out.push(iso)
    k += 1
  }
  return out
}

/** Days between occurrences, for the day-based kinds. */
function stepDays(chore: Chore): number {
  switch (chore.recurrence_kind) {
    case 'daily':
      return 1
    case 'weekly':
      return 7
    case 'biweekly':
      return 14
    case 'every_n_days':
      return Math.max(1, chore.recurrence_interval)
    default:
      return 1
  }
}

/** The k-th occurrence, measured from start_date. */
function occurrenceAt(chore: Chore, start: Date, k: number): Date {
  if (chore.recurrence_kind === 'monthly') return addMonths(start, k)
  return addDays(start, k * stepDays(chore))
}
