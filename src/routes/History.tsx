import { useEffect, useMemo, useState } from 'react'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { nl } from 'date-fns/locale'
import { useBoardContext } from '../hooks/BoardProvider'
import { fetchHistory, pointsLabel } from '../lib/chores'
import { Empty } from '../components/Empty'
import { Glyph } from '../components/glyphs'
import { Avatar } from '../components/Avatar'
import { PageHeader } from '../components/PageHeader'
import type { InstanceWithChore } from '../lib/types'

const DAYS = 30

function dayLabel(date: Date): string {
  if (isToday(date)) return 'Vandaag'
  if (isYesterday(date)) return 'Gisteren'
  const s = format(date, 'EEEE d MMMM', { locale: nl })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function History() {
  // `instances` changes whenever the board reloads (including realtime events
  // from another phone), so the history refetches along with it.
  const { profiles, instances } = useBoardContext()
  const [items, setItems] = useState<InstanceWithChore[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchHistory(DAYS)
      .then((rows) => {
        if (!cancelled) {
          setItems(rows)
          setError(null)
        }
      })
      .catch((e) => {
        console.error(e)
        if (!cancelled) setError('Historie laden is mislukt.')
      })
    return () => {
      cancelled = true
    }
  }, [instances])

  // Grouped by the local day it was done, newest day first (already sorted).
  const days = useMemo(() => {
    const groups: Array<{ key: string; date: Date; items: InstanceWithChore[] }> = []
    for (const item of items ?? []) {
      const date = parseISO(item.completed_at!)
      const key = format(date, 'yyyy-MM-dd')
      const last = groups.at(-1)
      if (last?.key === key) last.items.push(item)
      else groups.push({ key, date, items: [item] })
    }
    return groups
  }, [items])

  const profileOf = (userId: string | null) => profiles.find((p) => p.user_id === userId)

  return (
    <>
      <PageHeader
        title="Historie"
        status={items === null ? null : `${items.length} gedaan in ${DAYS} dagen`}
      />

      <main className="page">
        {error && <p className="banner banner--warn">{error}</p>}

        {items === null && !error ? (
          <div className="center-pad">
            <div className="spinner" role="status" aria-label="Laden" />
          </div>
        ) : items !== null && items.length === 0 ? (
          <Empty
            title="Nog niets gedaan"
            body={`Afgevinkte taken van de afgelopen ${DAYS} dagen verschijnen hier.`}
          />
        ) : (
          days.map((day) => (
            <section className="section" key={day.key}>
              <div className="section__head">
                <span className="label">{dayLabel(day.date)}</span>
                <span className="section__count">{day.items.length}</span>
              </div>
              <ul className="history">
                {day.items.map((item) => (
                  <li className="history__row" key={item.id}>
                    <span className="card__glyph">
                      <Glyph name={item.chore.glyph} />
                    </span>
                    <div className="card__body">
                      <p className="card__title">{item.chore.title}</p>
                      <p className="card__meta">
                        <span className="avatar-inline">
                          <Avatar profile={profileOf(item.completed_by)} size={24} />
                          {profileOf(item.completed_by)?.display_name.split(' ')[0] ?? 'Iemand'}
                        </span>
                        <span className="sep" aria-hidden="true">·</span>
                        <span>{format(parseISO(item.completed_at!), 'HH:mm')}</span>
                        <span className="sep" aria-hidden="true">·</span>
                        <span className="points">{pointsLabel(item.chore.points)}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
    </>
  )
}
