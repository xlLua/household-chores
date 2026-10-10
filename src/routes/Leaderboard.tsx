import { useEffect, useMemo, useState } from 'react'
import { addMonths, format, isSameMonth, startOfMonth } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchScores, type Score } from '../lib/chores'
import { useBoardContext } from '../hooks/BoardProvider'
import { useAuth } from '../lib/auth'
import { Empty } from '../components/Empty'

/** First place. Gold always travels with this mark, never on its own. */
function Laurel() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      className="score__laurel"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 20c-3.4-2-5-5.6-4.6-10.6C6.7 10 9 12.4 9.6 16" />
      <path d="M16 20c3.4-2 5-5.6 4.6-10.6C17.3 10 15 12.4 14.4 16" />
      <path d="M12 21v-6" />
      <path d="m12 3 1.1 2.4 2.4 1.1-2.4 1.1L12 11l-1.1-2.4L8.5 6.5l2.4-1.1Z" />
    </svg>
  )
}

interface Row extends Score {
  name: string
  isMe: boolean
}

export function Leaderboard() {
  const { profiles } = useBoardContext()
  const { session } = useAuth()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [scores, setScores] = useState<Score[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setScores(null)
    setError(null)
    fetchScores(month)
      .then((s) => {
        if (!cancelled) setScores(s)
      })
      .catch((e) => {
        console.error(e)
        if (!cancelled) setError('Could not load the tally.')
      })
    return () => {
      cancelled = true
    }
  }, [month])

  // Everyone appears, including roommates on zero -- an uneven split is the
  // whole point of this screen, and it's invisible if they're filtered out.
  const rows: Row[] = useMemo(() => {
    if (!scores) return []
    return profiles
      .map((p) => {
        const found = scores.find((s) => s.userId === p.user_id)
        return {
          userId: p.user_id,
          name: p.display_name,
          points: found?.points ?? 0,
          completed: found?.completed ?? 0,
          isMe: p.user_id === session?.user.id,
        }
      })
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
  }, [scores, profiles, session?.user.id])

  const max = Math.max(1, ...rows.map((r) => r.points))
  const total = rows.reduce((sum, r) => sum + r.points, 0)
  const atCurrentMonth = isSameMonth(month, new Date())

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Scores</h1>
          <p className="topbar__sub">Who has been carrying the household.</p>
        </div>
      </header>

      <main className="page">
        <div className="month-switch">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={18} strokeWidth={1.9} />
          </button>
          <span className="month-switch__label">{format(month, 'MMMM yyyy')}</span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            disabled={atCurrentMonth}
            aria-label="Next month"
          >
            <ChevronRight size={18} strokeWidth={1.9} />
          </button>
        </div>

        {error && <p className="banner banner--warn">{error}</p>}

        {scores === null && !error ? (
          <div className="center-pad">
            <div className="spinner" role="status" aria-label="Loading" />
          </div>
        ) : total === 0 ? (
          <Empty
            title="Nothing tallied yet"
            body={
              atCurrentMonth
                ? 'Tick a chore off and the first points land here.'
                : 'No chores were completed this month.'
            }
          />
        ) : (
          <>
            {/* A single measure across 3-4 people: one hue for every bar, the
                value direct-labelled on each row. No legend -- there is only
                one series -- and no tooltip, because on a phone there is no
                hover and every number is already on screen. */}
            <div className="scores">
              {rows.map((row, index) => {
                const lead = index === 0 && row.points > 0
                return (
                  <div
                    key={row.userId}
                    className={lead ? 'score score--lead' : 'score'}
                  >
                    <span className="score__rank" aria-hidden="true">
                      {index + 1}
                    </span>

                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                      {lead && <Laurel />}
                      <span style={{ minWidth: 0 }}>
                        <span className="score__name">
                          {row.name}
                          {row.isMe && (
                            <span className="score__sub" style={{ fontWeight: 400 }}>
                              {' '}
                              · you
                            </span>
                          )}
                        </span>
                        <span className="score__sub" style={{ display: 'block' }}>
                          {row.completed} {row.completed === 1 ? 'chore' : 'chores'}
                        </span>
                      </span>
                    </span>

                    <span
                      className="score__bar"
                      role="img"
                      aria-label={`${row.points} of ${max} points`}
                    >
                      <span style={{ width: `${(row.points / max) * 100}%` }} />
                    </span>

                    <span className="score__points">{row.points}</span>
                  </div>
                )
              })}
            </div>

            <p
              style={{
                marginTop: '1.25rem',
                textAlign: 'center',
                fontSize: 'var(--t-small)',
                color: 'var(--text-muted)',
              }}
            >
              {total} points across the household this month
            </p>
          </>
        )}
      </main>
    </>
  )
}
