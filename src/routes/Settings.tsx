import { useEffect, useState } from 'react'
import { Bell, BellOff, LogOut, Share, Smartphone } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { disablePush, enablePush, getPushState, type PushState } from '../lib/push'
import { getThemePreference, setThemePreference, type ThemePreference } from '../lib/theme'
import { useBoardContext } from '../hooks/BoardProvider'
import { PageHeader } from '../components/PageHeader'
import { Avatar } from '../components/Avatar'

/** iOS Safari never fires beforeinstallprompt, so the only way to get the app
 *  onto an iPhone home screen is to tell people how. */
function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS-only legacy flag, still the reliable signal there.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function SettingsPage() {
  const { profile, session, signOut } = useAuth()
  const { profiles, chores } = useBoardContext()
  const showInstallHint = !isStandalone()

  return (
    <>
      <PageHeader title="Instellingen" />

      <main className="page">
        <section className="section">
          <div className="section__head">
            <span className="label">Jij</span>
          </div>
          <div className="sheet" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <Avatar profile={profile} size={44} />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>{profile?.display_name}</p>
              <p
                style={{
                  margin: 0,
                  fontSize: 'var(--t-small)',
                  color: 'var(--text-muted)',
                  overflowWrap: 'anywhere',
                }}
              >
                {session?.user.email}
              </p>
            </div>
          </div>
        </section>

        <AppearanceSection />
        <NotificationsSection />

        {showInstallHint && (
          <section className="section">
            <div className="section__head">
              <span className="label">Installeren</span>
            </div>
            <div className="sheet">
              <p style={{ margin: '0 0 0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Smartphone size={17} aria-hidden="true" />
                <strong>Zet Onder één Hoedje op je beginscherm</strong>
              </p>
              <p style={{ margin: 0, fontSize: 'var(--t-small)', color: 'var(--text-muted)' }}>
                {isIos() ? (
                  <>
                    Tik in Safari op <Share size={13} style={{ verticalAlign: '-2px' }} aria-hidden="true" />{' '}
                    <strong>Deel</strong> → <strong>Zet op beginscherm</strong>. Dan opent het als
                    een app; dat is later ook nodig voor meldingen.
                  </>
                ) : (
                  <>
                    Kies in het browsermenu <strong>App installeren</strong> (of{' '}
                    <strong>Toevoegen aan startscherm</strong>).
                  </>
                )}
              </p>
            </div>
          </section>
        )}

        <section className="section">
          <div className="section__head">
            <span className="label">Huishouden</span>
          </div>
          <div className="sheet">
            <p style={{ margin: 0, fontSize: 'var(--t-small)', color: 'var(--text-muted)' }}>
              {profiles.length} {profiles.length === 1 ? 'huisgenoot' : 'huisgenoten'} ·{' '}
              {chores.filter((c) => !c.archived_at).length} actieve taken
            </p>
          </div>
        </section>

        <section className="section">
          <button type="button" className="btn btn--danger" onClick={() => void signOut()}>
            <LogOut size={16} strokeWidth={1.9} aria-hidden="true" />
            Uitloggen
          </button>
        </section>

        <p
          style={{
            marginTop: '2rem',
            textAlign: 'center',
            fontSize: 'var(--t-micro)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--rule-strong)',
          }}
        >
          Onder één Hoedje · v0.1
        </p>
        <p className="legal-links">
          <a href="/privacy">Privacybeleid</a>
          <span aria-hidden="true"> · </span>
          <a href="/terms">Gebruiksvoorwaarden</a>
        </p>
      </main>
    </>
  )
}

const THEMES: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'Systeem' },
  { value: 'light', label: 'Licht' },
  { value: 'dark', label: 'Donker' },
]

function AppearanceSection() {
  const [theme, setTheme] = useState(getThemePreference)
  return (
    <section className="section">
      <div className="section__head">
        <span className="label">Weergave</span>
      </div>
      <div className="segmented" role="radiogroup" aria-label="Weergave">
        {THEMES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={theme === t.value}
            onClick={() => {
              setThemePreference(t.value)
              setTheme(t.value)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </section>
  )
}

const PUSH_HINT: Record<PushState, string> = {
  on: 'Aan op dit apparaat.',
  off: 'Uit op dit apparaat.',
  denied: 'Meldingen zijn geblokkeerd. Zet ze aan in de instellingen van je telefoon.',
  'needs-install': 'Zet de app eerst op je beginscherm; op een iPhone werken meldingen alleen daar.',
  unsupported: 'Deze browser ondersteunt geen meldingen.',
}

function NotificationsSection() {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPushState().then(setState, () => setState('unsupported'))
  }, [])

  async function toggle() {
    if (!state || busy) return
    setBusy(true)
    setError(null)
    try {
      setState(state === 'on' ? await disablePush() : await enablePush())
    } catch (e) {
      console.error(e)
      setError('Dat is niet gelukt. Probeer het opnieuw.')
    } finally {
      setBusy(false)
    }
  }

  const canToggle = state === 'on' || state === 'off'
  return (
    <section className="section">
      <div className="section__head">
        <span className="label">Meldingen</span>
      </div>
      <div className="sheet">
        <p style={{ margin: '0 0 0.75rem', fontSize: 'var(--t-small)', color: 'var(--text-muted)' }}>
          Is er een taak te laat, dan krijgen de twee huisgenoten met de minste punten van deze
          maand elke ochtend een melding. En iedereen krijgt een melding als er een nieuwe
          koploper is op het scorebord.
        </p>
        {canToggle && (
          <button
            type="button"
            className={state === 'on' ? 'btn btn--ghost' : 'btn btn--primary'}
            onClick={() => void toggle()}
            disabled={busy}
          >
            {state === 'on' ? (
              <BellOff size={16} strokeWidth={1.9} aria-hidden="true" />
            ) : (
              <Bell size={16} strokeWidth={1.9} aria-hidden="true" />
            )}
            {state === 'on' ? 'Meldingen uitzetten' : 'Meldingen aanzetten'}
          </button>
        )}
        {state && (
          <p style={{ margin: canToggle ? '0.6rem 0 0' : 0, fontSize: 'var(--t-small)', color: 'var(--text-muted)' }}>
            {PUSH_HINT[state]}
          </p>
        )}
        {error && <p className="banner banner--warn" style={{ marginTop: '0.75rem' }}>{error}</p>}
      </div>
    </section>
  )
}
