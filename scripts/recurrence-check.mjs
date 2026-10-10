// ===========================================================================
// TEMPORARY. Replace this with a real test against src/lib/recurrence.ts.
//
// This is a hand-written PORT of missingDueDates() into plain JS, written
// because npm was not installed and the real module could not be imported
// (it needs date-fns). It is a SECOND IMPLEMENTATION, which means it can
// drift from the real one and quietly start testing nothing.
//
// It has already earned its keep once: an earlier version of this port used
// Date.setMonth (which overflows) where date-fns addMonths clamps, and that
// discrepancy is what exposed the monthly-drift bug now fixed in the real
// module. Treat a passing run here as evidence about the ALGORITHM, not
// about the shipped code.
//
//   node scripts/recurrence-check.mjs
//
// To do: once `npm install` works, delete this and write the same 13
// scenarios as a real test importing { missingDueDates } from the module.
// ===========================================================================

const HORIZON_DAYS = 14, BACKFILL_DAYS = 30
const parseISO = (s) => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d) }
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x }
const addMonths = (d,n) => {  // date-fns semantics: clamp, don't overflow
  const day = d.getDate()
  const x = new Date(d.getFullYear(), d.getMonth()+n, 1)
  const last = new Date(x.getFullYear(), x.getMonth()+1, 0).getDate()
  x.setDate(Math.min(day, last)); return x
}
const diffCalDays = (a,b) => Math.round((new Date(a.getFullYear(),a.getMonth(),a.getDate()) - new Date(b.getFullYear(),b.getMonth(),b.getDate()))/86400000)
const diffCalMonths = (a,b) => (a.getFullYear()-b.getFullYear())*12 + (a.getMonth()-b.getMonth())
const stepDays = (c) => c.recurrence_kind==='daily'?1:c.recurrence_kind==='weekly'?7:c.recurrence_kind==='biweekly'?14:c.recurrence_kind==='every_n_days'?Math.max(1,c.recurrence_interval):1
const occurrenceAt = (c,start,k) => c.recurrence_kind==='monthly' ? addMonths(start,k) : addDays(start, k*stepDays(c))

function stepFrom(chore, date) {
  switch (chore.recurrence_kind) {
    case 'once': return null
    case 'daily': return addDays(date, 1)
    case 'weekly': return addDays(date, 7)
    case 'biweekly': return addDays(date, 14)
    case 'monthly': return addMonths(date, 1)
    case 'every_n_days': return addDays(date, Math.max(1, chore.recurrence_interval))
  }
}

function missingDueDates(chore, existing, today) {
  if (chore.archived_at) return []
  const taken = new Set(existing.map(i => i.due_date))
  const horizon = addDays(today, HORIZON_DAYS)
  const floor = addDays(today, -BACKFILL_DAYS)

  if (chore.recurrence_anchor === 'completion') {
    if (existing.some(i => i.status === 'open')) return []
    const done = existing.filter(i => i.status === 'done' && i.completed_at)
      .sort((a,b) => a.completed_at < b.completed_at ? 1 : -1)
    let next
    if (done.length === 0) {
      if (existing.length > 0) return []
      next = parseISO(chore.start_date)
    } else {
      const from = stepFrom(chore, parseISO(done[0].completed_at.slice(0,10)))
      if (!from) return []
      next = from
    }
    let g = 0
    while (taken.has(toISO(next)) && g++ < 400) next = addDays(next, 1)
    return [toISO(next)]
  }

  if (chore.recurrence_kind === 'once') return existing.length > 0 ? [] : [chore.start_date]

  const start = parseISO(chore.start_date)
  let k = 0
  if (start < floor) {
    k = chore.recurrence_kind === 'monthly'
      ? Math.max(0, diffCalMonths(floor, start))
      : Math.max(0, Math.floor(diffCalDays(floor, start) / stepDays(chore)))
  }
  const out = []
  let g = 0
  while (g++ < 500) {
    const at = occurrenceAt(chore, start, k)
    if (at < floor) { k += 1; continue }
    if (at > horizon) break
    const iso = toISO(at)
    if (!taken.has(iso)) out.push(iso)
    k += 1
  }
  return out
}

// ---------------------------------------------------------------- scenarios
const TODAY = new Date(2026, 9, 10)  // Sat 10 Oct 2026
const base = { archived_at: null, recurrence_interval: 1, recurrence_anchor: 'calendar' }
let fails = 0
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fails++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`)
}

// 1. Weekly trash, every Monday, seeded on a Monday, nothing generated yet.
check('weekly Monday from a far-back start',
  missingDueDates({...base, recurrence_kind:'weekly', start_date:'2026-01-05'}, [], TODAY),
  ['2026-09-14','2026-09-21','2026-09-28','2026-10-05','2026-10-12','2026-10-19'])

// all generated dates must be Mondays
const mondays = missingDueDates({...base, recurrence_kind:'weekly', start_date:'2026-01-05'}, [], TODAY)
check('weekly dates are all Mondays', [...new Set(mondays.map(d => parseISO(d).getDay()))], [1])

// 2. Idempotent: re-running with those rows present yields nothing.
check('weekly is idempotent',
  missingDueDates({...base, recurrence_kind:'weekly', start_date:'2026-01-05'},
    mondays.map(d => ({due_date:d, status:'open'})), TODAY),
  [])

// 3. A gap in the middle is backfilled, and only the gap.
check('fills only the missing occurrence',
  missingDueDates({...base, recurrence_kind:'weekly', start_date:'2026-01-05'},
    mondays.filter(d => d !== '2026-10-05').map(d => ({due_date:d, status:'open'})), TODAY),
  ['2026-10-05'])

// 4. every_n_days, calendar anchored
check('every 3 days',
  missingDueDates({...base, recurrence_kind:'every_n_days', recurrence_interval:3, start_date:'2026-10-08'}, [], TODAY),
  ['2026-10-08','2026-10-11','2026-10-14','2026-10-17','2026-10-20','2026-10-23'])

// 5. monthly on the 31st: February clamps, but it must NOT drift afterwards.
const monthly = {...base, recurrence_kind:'monthly'}
const seq = [0,1,2,3,4].map(k => toISO(occurrenceAt(monthly, parseISO('2026-01-31'), k)))
check('monthly on the 31st clamps in Feb and recovers',
  seq, ['2026-01-31','2026-02-28','2026-03-31','2026-04-30','2026-05-31'])

// 6. one-off: emitted once, never again
check('one-off emits once',
  missingDueDates({...base, recurrence_kind:'once', start_date:'2026-10-12'}, [], TODAY), ['2026-10-12'])
check('one-off never repeats',
  missingDueDates({...base, recurrence_kind:'once', start_date:'2026-10-12'},
    [{due_date:'2026-10-12', status:'done', completed_at:'2026-10-12T10:00:00Z'}], TODAY), [])

// 7. completion-anchored: nothing while one is open
check('completion: quiet while open',
  missingDueDates({...base, recurrence_anchor:'completion', recurrence_kind:'every_n_days', recurrence_interval:7, start_date:'2026-10-01'},
    [{due_date:'2026-10-01', status:'open'}], TODAY), [])

// 8. completion-anchored: next is 7 days after it was DONE, not after the due date
check('completion: counts from completion, not due date',
  missingDueDates({...base, recurrence_anchor:'completion', recurrence_kind:'every_n_days', recurrence_interval:7, start_date:'2026-10-01'},
    [{due_date:'2026-10-01', status:'done', completed_at:'2026-10-09T18:00:00Z'}], TODAY),
  ['2026-10-16'])

// 9. completion-anchored: a collision with an existing row must not stall it
check('completion: steps past a collision',
  missingDueDates({...base, recurrence_anchor:'completion', recurrence_kind:'every_n_days', recurrence_interval:7, start_date:'2026-10-01'},
    [{due_date:'2026-10-01', status:'done', completed_at:'2026-10-09T18:00:00Z'},
     {due_date:'2026-10-16', status:'skipped'}], TODAY),
  ['2026-10-17'])

// 10. a chore started long ago does not spawn a year of overdue rows
const old = missingDueDates({...base, recurrence_kind:'daily', start_date:'2020-01-01'}, [], TODAY)
check('daily from 2020 stays inside the backfill window', [old.length, old[0]], [45, '2026-09-10'])

// 11. archived chores generate nothing
check('archived generates nothing',
  missingDueDates({...base, recurrence_kind:'daily', start_date:'2026-10-01', archived_at:'2026-10-05T00:00:00Z'}, [], TODAY), [])

console.log(fails === 0 ? '\nAll scenarios passed.' : `\n${fails} FAILED`)
process.exit(fails ? 1 : 0)
