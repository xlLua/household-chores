import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  format,
  isAfter,
  parseISO,
} from 'date-fns'
import type { Chore, ChoreInstance, RecurrenceKind } from './types'

export const ISO = 'yyyy-MM-dd'
export const toISO = (d: Date) => format(d, ISO)

export function recurrenceLabel(chore: Chore): string {
  const n = chore.recurrence_interval
  const base: Record<RecurrenceKind, string> = {
    once: 'Eenmalig',
    daily: 'Elke dag',
    weekly: 'Elke week',
    biweekly: 'Elke twee weken',
    monthly: n > 1 ? `Elke ${n} maanden` : 'Elke maand',
    every_n_days: `Elke ${n} dagen`,
  }
  const label = base[chore.recurrence_kind]
  if (chore.recurrence_kind === 'once') return label
  return chore.recurrence_anchor === 'completion' ? `${label}, na de vorige keer` : label
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
      return addMonths(date, monthsOf(chore))
    case 'every_n_days':
      return addDays(date, Math.max(1, chore.recurrence_interval))
  }
}

/**
 * Which due dates are missing for this chore, given the instances that already
 * exist. Pure, so the awkward parts are unit-testable without a database.
 *
 * Every chore has exactly one open instance at a time: the next one is only
 * created once the current one is done (or skipped). So this returns at most
 * one date, and nothing while an instance is still open.
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
  if (existing.some((i) => i.status === 'open')) return []

  // --- one-off ------------------------------------------------------------
  if (chore.recurrence_kind === 'once') {
    return existing.length > 0 ? [] : [chore.start_date]
  }

  // --- completion-anchored: N days after it was last done -----------------
  if (chore.recurrence_anchor === 'completion') {
    const done = existing
      .filter((i) => i.status === 'done' && i.completed_at)
      .sort((a, b) => (a.completed_at! < b.completed_at! ? 1 : -1))

    let next: Date
    if (done.length === 0) {
      if (existing.length > 0) return [] // only skipped instances; leave it be
      next = parseISO(chore.start_date)
    } else {
      next = stepFrom(chore, parseISO(done[0].completed_at!.slice(0, 10)))!
    }

    // A collision with an existing row would otherwise stall the chore
    // forever, since the insert gets silently ignored.
    const taken = new Set(existing.map((i) => i.due_date))
    let guard = 0
    while (taken.has(toISO(next)) && guard++ < 400) next = addDays(next, 1)
    return [toISO(next)]
  }

  // --- calendar-anchored: on schedule, e.g. every Monday ------------------
  // Each occurrence is computed as an offset from start_date, NOT by stepping a
  // cursor forward one occurrence at a time. That matters for monthly: addMonths
  // clamps, so a chore due on the 31st would step to Feb 28 and then stay on the
  // 28th forever. Measuring from the original date makes February a one-month
  // exception instead of a permanent drift.
  const start = parseISO(chore.start_date)

  // The first occurrence after the last one that was dealt with.
  const last = existing.map((i) => i.due_date).sort().at(-1)
  let k = last ? firstIndexOnOrAfter(chore, start, addDays(parseISO(last), 1)) : 0

  // If several occurrences were missed, show only the most recent one rather
  // than one overdue card per missed week.
  const latestPast = firstIndexOnOrAfter(chore, start, addDays(today, 1)) - 1
  if (latestPast > k) k = latestPast

  return [toISO(occurrenceAt(chore, start, k))]
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

/** For 'monthly', recurrence_interval is the number of months (1, 3, 6...). */
function monthsOf(chore: Chore): number {
  return Math.max(1, chore.recurrence_interval)
}

/** The k-th occurrence, measured from start_date. */
function occurrenceAt(chore: Chore, start: Date, k: number): Date {
  if (chore.recurrence_kind === 'monthly') return addMonths(start, k * monthsOf(chore))
  return addDays(start, k * stepDays(chore))
}

/** The smallest k >= 0 whose occurrence falls on or after `date`. */
function firstIndexOnOrAfter(chore: Chore, start: Date, date: Date): number {
  // Jump close with arithmetic, then nudge -- a chore started years ago
  // shouldn't need thousands of iterations.
  let k =
    chore.recurrence_kind === 'monthly'
      ? Math.floor(differenceInCalendarMonths(date, start) / monthsOf(chore))
      : Math.ceil(differenceInCalendarDays(date, start) / stepDays(chore))
  k = Math.max(0, k)
  while (k > 0 && !isAfter(date, occurrenceAt(chore, start, k - 1))) k -= 1
  while (isAfter(date, occurrenceAt(chore, start, k))) k += 1
  return k
}
