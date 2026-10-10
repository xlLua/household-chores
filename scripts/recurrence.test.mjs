// Tests for the real generator in src/lib/recurrence.ts -- Node strips the
// types on import, so this exercises the shipped code, not a port.
//
//   npm test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { missingDueDates } from '../src/lib/recurrence.ts'

const day = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const chore = (overrides = {}) => ({
  id: 'c1',
  title: 'Stofzuigen',
  notes: null,
  points: 3,
  glyph: 'broom',
  recurrence_kind: 'weekly',
  recurrence_interval: 7,
  recurrence_anchor: 'calendar',
  start_date: '2026-10-05', // a Monday
  archived_at: null,
  created_at: '2026-10-01T00:00:00Z',
  ...overrides,
})

let n = 0
const inst = (due_date, status = 'done', completed_at = `${due_date}T10:00:00Z`) => ({
  id: `i${++n}`,
  chore_id: 'c1',
  due_date,
  status,
  completed_by: status === 'done' ? 'u1' : null,
  completed_at: status === 'done' ? completed_at : null,
})

const run = (c, existing, today) => missingDueDates(c, existing, day(today))

// --- one open instance at a time -------------------------------------------

test('nothing is generated while an instance is open', () => {
  assert.deepEqual(run(chore(), [inst('2026-10-12', 'open')], '2026-10-07'), [])
  assert.deepEqual(
    run(chore({ recurrence_anchor: 'completion' }), [inst('2026-10-12', 'open')], '2026-10-07'),
    [],
  )
})

test('at most one date is ever returned', () => {
  const daily = chore({ recurrence_kind: 'daily', start_date: '2026-01-01' })
  assert.equal(run(daily, [], '2026-10-07').length, 1)
})

// --- calendar-anchored -----------------------------------------------------

test('calendar: new chore starting today is due today', () => {
  assert.deepEqual(run(chore(), [], '2026-10-05'), ['2026-10-05'])
})

test('calendar: new chore starting later is due on its start date', () => {
  assert.deepEqual(run(chore({ start_date: '2026-10-19' }), [], '2026-10-07'), ['2026-10-19'])
})

test('calendar: after completion, the next one is the following occurrence', () => {
  assert.deepEqual(run(chore(), [inst('2026-10-05')], '2026-10-07'), ['2026-10-12'])
})

test('calendar: done early still moves on to the next occurrence', () => {
  const early = inst('2026-10-12', 'done', '2026-10-07T09:00:00Z')
  assert.deepEqual(run(chore(), [inst('2026-10-05'), early], '2026-10-07'), ['2026-10-19'])
})

test('calendar: several missed weeks collapse into the most recent one', () => {
  assert.deepEqual(run(chore(), [inst('2026-09-07')], '2026-10-07'), ['2026-10-05'])
})

test('calendar: an occurrence falling on today is due today', () => {
  assert.deepEqual(run(chore(), [inst('2026-09-28')], '2026-10-12'), ['2026-10-12'])
})

test('calendar: a chore started years ago lands on the latest past occurrence', () => {
  const old = chore({ start_date: '2020-01-06' }) // a Monday
  assert.deepEqual(run(old, [], '2026-10-07'), ['2026-10-05'])
})

test('calendar: skipping counts as dealt with', () => {
  assert.deepEqual(run(chore(), [inst('2026-10-05', 'skipped')], '2026-10-07'), ['2026-10-12'])
})

test('calendar: biweekly steps two weeks', () => {
  const c = chore({ recurrence_kind: 'biweekly' })
  assert.deepEqual(run(c, [inst('2026-10-05')], '2026-10-07'), ['2026-10-19'])
})

test('monthly: the 31st clamps for February, then returns to the 31st', () => {
  const c = chore({ recurrence_kind: 'monthly', recurrence_interval: 1, start_date: '2027-01-31' })
  assert.deepEqual(run(c, [inst('2027-01-31')], '2027-02-10'), ['2027-02-28'])
  assert.deepEqual(run(c, [inst('2027-01-31'), inst('2027-02-28')], '2027-03-05'), ['2027-03-31'])
  assert.deepEqual(
    run(c, [inst('2027-01-31'), inst('2027-02-28'), inst('2027-03-31')], '2027-04-05'),
    ['2027-04-30'],
  )
})

test('every 3 months: calendar steps by the interval, clamping like monthly', () => {
  const c = chore({ recurrence_kind: 'monthly', recurrence_interval: 3, start_date: '2026-11-30' })
  assert.deepEqual(run(c, [], '2026-10-10'), ['2026-11-30'])
  assert.deepEqual(run(c, [inst('2026-11-30')], '2026-12-05'), ['2027-02-28'])
  assert.deepEqual(run(c, [inst('2026-11-30'), inst('2027-02-28')], '2027-03-01'), ['2027-05-30'])
})

test('every 6 months: a long-missed chore lands on the latest past occurrence', () => {
  const c = chore({ recurrence_kind: 'monthly', recurrence_interval: 6, start_date: '2024-01-15' })
  assert.deepEqual(run(c, [], '2026-10-10'), ['2026-07-15'])
})

// --- completion-anchored ---------------------------------------------------

const every3 = chore({
  recurrence_kind: 'every_n_days',
  recurrence_interval: 3,
  recurrence_anchor: 'completion',
})

test('completion: new chore is due on its start date', () => {
  assert.deepEqual(run(every3, [], '2026-10-05'), ['2026-10-05'])
})

test('completion: next is counted from the day it was done', () => {
  const late = inst('2026-10-05', 'done', '2026-10-09T18:00:00Z')
  assert.deepEqual(run(every3, [late], '2026-10-09'), ['2026-10-12'])
})

test('completion: steps past a collision', () => {
  const done = inst('2026-10-05', 'done', '2026-10-07T18:00:00Z')
  assert.deepEqual(run(every3, [done, inst('2026-10-10', 'skipped')], '2026-10-07'), ['2026-10-11'])
})

test('completion: every 3 months counts from the day it was done', () => {
  const c = chore({ recurrence_kind: 'monthly', recurrence_interval: 3, recurrence_anchor: 'completion' })
  const done = inst('2026-10-01', 'done', '2026-10-04T12:00:00Z')
  assert.deepEqual(run(c, [done], '2026-10-04'), ['2027-01-04'])
})

test('completion: only skipped instances leaves it alone', () => {
  assert.deepEqual(run(every3, [inst('2026-10-05', 'skipped')], '2026-10-07'), [])
})

// --- one-off and archived --------------------------------------------------

test('one-off: due once, never again', () => {
  const once = chore({ recurrence_kind: 'once', start_date: '2026-10-20' })
  assert.deepEqual(run(once, [], '2026-10-07'), ['2026-10-20'])
  assert.deepEqual(run(once, [inst('2026-10-20')], '2026-10-21'), [])
})

test('archived generates nothing', () => {
  assert.deepEqual(run(chore({ archived_at: '2026-10-01T00:00:00Z' }), [], '2026-10-07'), [])
})
