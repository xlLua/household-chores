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
      } else {
        setToast(`+${instance.chore.points} punten`)
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
      await reload()
    } catch (e) {
      console.error(e)
      setToast('Ongedaan maken is mislukt.')
    } finally {
      setBusy(null)
    }
  }

  const hour = new Date().getHours()
  const timeOfDay = hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond'
  const firstName = profile?.display_name?.split(' ')[0]
  const nothingOpen =
    groups.overdue.length === 0 && groups.today.length === 0 && groups.upcoming.length === 0

  return (
    <>
      <header className="topbar">
        <div>
          <h1>Vandaag</h1>
          <p className="topbar__sub">
            {firstName ? `${timeOfDay}, ${firstName}.` : 'Huishoudtaken'}
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
              title="Binnenkort"
              items={groups.upcoming}
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
