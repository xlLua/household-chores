import { LogOut, Share, Smartphone } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useBoardContext } from '../hooks/BoardProvider'

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
      <header className="topbar">
        <div>
          <h1>Instellingen</h1>
          <p className="topbar__sub">Je account en de app.</p>
        </div>
      </header>

      <main className="page">
        <section className="section">
          <div className="section__head">
            <span className="label">Jij</span>
          </div>
          <div className="sheet" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            {profile?.avatar_url ? (
              <img
                className="avatar"
                style={{ width: '2.75rem', height: '2.75rem' }}
                src={profile.avatar_url}
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : null}
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

        {showInstallHint && (
          <section className="section">
            <div className="section__head">
              <span className="label">Installeren</span>
            </div>
            <div className="sheet">
              <p style={{ margin: '0 0 0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Smartphone size={17} aria-hidden="true" />
                <strong>Zet Atelier op je beginscherm</strong>
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
          Atelier · v0.1
        </p>
      </main>
    </>
  )
}
