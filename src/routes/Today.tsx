import { useEffect, useMemo, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useBoardContext } from '../hooks/BoardProvider'
import { useAuth } from '../lib/auth'
import { bucketOf, completeInstance, uncompleteInstance } from '../lib/chores'
import { ChoreCard } from '../components/ChoreCard'
import { Empty } from '../components/Empty'
import type { InstanceWithChore, Profile } from '../lib/types'
import { isToday, parseISO } from 'date-fns'

export function Today() {
  const { instances, profiles, loading, error, online, reload } = useBoardContext()
  const { session, profile } = useAuth()
  const [stamping, setStamping] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(t)
  }, [toast])

  const groups = useMemo(() => {
    const open = instances.filter((i) => i.status === 'open')
    return {
      overdue: open.filter((i) => bucketOf(i) === 'overdue'),
      today: open.filter((i) => bucketOf(i) === 'today'),
      upcoming: open.filter((i) => bucketOf(i) === 'upcoming').slice(0, 8),
      doneToday: instances.filter(
        (i) => i.status === 'done' && i.completed_at && isToday(parseISO(i.completed_at)),
      ),
    }
  }, [instances])

  async function onComplete(instance: InstanceWithChore) {
    if (!session) return
    setBusy(instance.id)
    setStamping(instance.id)
    try {
      const { raced } = await completeInstance(instance, session.user.id)
      if (raced) {
        setStamping(null)
        setToast('Someone already got that one.')
      } else {
        setToast(`+${instance.chore.points} pts`)
      }
      await reload()
    } catch (e) {
      console.error(e)
      setStamping(null)
      setToast(online ? 'Could not save that.' : 'You are offline.')
    } finally {
      setBusy(null)
      window.setTimeout(() => setStamping(null), 1500)
    }
  }

  async function onUndo(instance: InstanceWithChore) {
    setBusy(instance.id)
    try {
      await uncompleteInstance(instance.id)
      await reload()
    } catch (e) {
      console.error(e)
      setToast('Could not undo that.')
    } finally {
      setBusy(null)
    }
  }

  const hour = new Date().getHours()
  const timeOfDay = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'
  const firstName = profile?.display_name?.split(' ')[0]
  const nothingOpen =
    groups.overdue.length === 0 && groups.today.length === 0 && groups.upcoming.length === 0

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Today</h1>
          <p className="topbar__sub">
            {firstName ? `${timeOfDay}, ${firstName}.` : 'The household ledger.'}
          </p>
        </div>
        {profile?.avatar_url && (
          <img className="avatar" src={profile.avatar_url} alt="" referrerPolicy="no-referrer" />
        )}
      </header>

      <main className="page">
        {!online && (
          <p className="banner banner--warn">
            <WifiOff size={15} aria-hidden="true" />
            Offline — you can read the list, but ticking things off needs a signal.
          </p>
        )}
        {error && online && <p className="banner banner--warn">{error}</p>}

        {loading ? (
          <div className="center-pad">
            <div className="spinner" role="status" aria-label="Loading" />
          </div>
        ) : nothingOpen && groups.doneToday.length === 0 ? (
          <Empty
            title="The atelier is tidy"
            body="Nothing is due. Add a chore from the Chores tab to start the ledger."
          />
        ) : (
          <>
            <Section
              title="Overdue"
              items={groups.overdue}
              profiles={profiles}
              stamping={stamping}
              busy={busy}
              onComplete={onComplete}
              onUndo={onUndo}
            />
            <Section
              title="Due today"
              items={groups.today}
              profiles={profiles}
              stamping={stamping}
              busy={busy}
              onComplete={onComplete}
              onUndo={onUndo}
            />
            <Section
              title="Coming up"
              items={groups.upcoming}
              profiles={profiles}
              stamping={stamping}
              busy={busy}
              onComplete={onComplete}
              onUndo={onUndo}
            />
            <Section
              title="Done today"
              items={groups.doneToday}
              profiles={profiles}
              stamping={stamping}
              busy={busy}
              onComplete={onComplete}
              onUndo={onUndo}
            />

            {nothingOpen && groups.doneToday.length > 0 && (
              <Empty
                title="All done for today"
                body="Nothing left on the ledger."
                art={false}
              />
            )}
          </>
        )}
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  )
}

function Section({
  title,
  items,
  profiles,
  stamping,
  busy,
  onComplete,
  onUndo,
}: {
  title: string
  items: InstanceWithChore[]
  profiles: Profile[]
  stamping: string | null
  busy: string | null
  onComplete: (i: InstanceWithChore) => void
  onUndo: (i: InstanceWithChore) => void
}) {
  if (items.length === 0) return null
  return (
    <section className="section">
      <div className="section__head">
        <span className="label">{title}</span>
        <span className="section__count">{items.length}</span>
      </div>
      <div className="cards">
        {items.map((i) => (
          <ChoreCard
            key={i.id}
            instance={i}
            profiles={profiles}
            stamping={stamping === i.id}
            busy={busy === i.id}
            onComplete={() => onComplete(i)}
            onUndo={() => onUndo(i)}
          />
        ))}
      </div>
    </section>
  )
}
