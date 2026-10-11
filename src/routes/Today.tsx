import { useEffect, useMemo, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { useBoardContext } from '../hooks/BoardProvider'
import { useAuth } from '../lib/auth'
import {
  bucketOf,
  checkLeader,
  completeInstance,
  isPersonal,
  pointsLabel,
  uncompleteInstance,
} from '../lib/chores'
import { ChoreCard } from '../components/ChoreCard'
import { Empty } from '../components/Empty'
import { PageHeader } from '../components/PageHeader'
import type { InstanceWithChore, Profile } from '../lib/types'
import { isToday, parseISO } from 'date-fns'

export function Today() {
  const { instances, profiles, loading, error, online, reload } = useBoardContext()
  const { session } = useAuth()
  const [stamping, setStamping] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(t)
  }, [toast])

  const groups = useMemo(() => {
    // One card per chore: the earliest open instance. The data layer already
    // keeps it that way; this just stops a race between phones from showing.
    const seen = new Set<string>()
    const open = instances.filter((i) => {
      if (i.status !== 'open' || seen.has(i.chore_id)) return false
      seen.add(i.chore_id)
      return true
    })
    return {
      overdue: open.filter((i) => bucketOf(i) === 'overdue'),
      today: open.filter((i) => bucketOf(i) === 'today'),
      upcoming: open.filter((i) => bucketOf(i) === 'upcoming'),
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
        setToast('Iemand anders was je voor.')
      } else if (isPersonal(instance.chore)) {
        setToast('Gedaan.')
      } else {
        setToast(`+${pointsLabel(instance.chore.points)}`)
        checkLeader()
      }
      await reload()
    } catch (e) {
      console.error(e)
      setStamping(null)
      setToast(online ? 'Opslaan is mislukt.' : 'Je bent offline.')
    } finally {
      setBusy(null)
      window.setTimeout(() => setStamping(null), 1500)
    }
  }

  async function onUndo(instance: InstanceWithChore) {
    setBusy(instance.id)
    try {
      await uncompleteInstance(instance)
      if (!isPersonal(instance.chore)) checkLeader(true)
      await reload()
    } catch (e) {
      console.error(e)
      setToast('Ongedaan maken is mislukt.')
    } finally {
      setBusy(null)
    }
  }

  // Progress counts what was due by today; "Binnenkort" doesn't count against it.
  const dueCount = groups.overdue.length + groups.today.length + groups.doneToday.length
  const doneCount = groups.doneToday.length
  const nothingOpen =
    groups.overdue.length === 0 && groups.today.length === 0 && groups.upcoming.length === 0

  return (
    <>
      <PageHeader
        title="Vandaag"
        status={
          loading ? null : dueCount === 0 ? 'niets te doen' : `${doneCount} van ${dueCount} gedaan`
        }
        progress={loading || dueCount === 0 ? null : doneCount / dueCount}
      />

      <main className="page">
        {!online && (
          <p className="banner banner--warn">
            <WifiOff size={15} aria-hidden="true" />
            Offline — je kunt de lijst bekijken, maar voor afvinken heb je verbinding nodig.
          </p>
        )}
        {error && online && <p className="banner banner--warn">{error}</p>}

        {loading ? (
          <div className="center-pad">
            <div className="spinner" role="status" aria-label="Laden" />
          </div>
        ) : nothingOpen && groups.doneToday.length === 0 ? (
          <Empty
            title="Het appartement is opgeruimd"
            body="Er hoeft niets te gebeuren. Voeg een taak toe via het tabblad Taken."
          />
        ) : (
          <>
            <Section
              title="Te laat"
              items={groups.overdue}
              profiles={profiles}
              stamping={stamping}
              busy={busy}
              onComplete={onComplete}
              onUndo={onUndo}
            />
            <Section
              title="Vandaag"
              items={groups.today}
              profiles={profiles}
              stamping={stamping}
              busy={busy}
              onComplete={onComplete}
              onUndo={onUndo}
            />
            <Section
              title="Vandaag gedaan"
              items={groups.doneToday}
              profiles={profiles}
              stamping={stamping}
              busy={busy}
              onComplete={onComplete}
              onUndo={onUndo}
            />
            <Section
              title="Binnenkort"
              items={groups.upcoming}
              profiles={profiles}
              stamping={stamping}
              busy={busy}
              onComplete={onComplete}
              onUndo={onUndo}
            />

            {nothingOpen && groups.doneToday.length > 0 && (
              <Empty
                title="Alles gedaan voor vandaag"
                body="Er staat niets meer open."
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
