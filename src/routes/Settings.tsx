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
          <h1>Settings</h1>
          <p className="topbar__sub">Your corner of the atelier.</p>
        </div>
      </header>

      <main className="page">
        <section className="section">
          <div className="section__head">
            <span className="label">You</span>
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
              <span className="label">Install it</span>
            </div>
            <div className="sheet">
              <p style={{ margin: '0 0 0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Smartphone size={17} aria-hidden="true" />
                <strong>Add Atelier to your home screen</strong>
              </p>
              <p style={{ margin: 0, fontSize: 'var(--t-small)', color: 'var(--text-muted)' }}>
                {isIos() ? (
                  <>
                    In Safari, tap <Share size={13} style={{ verticalAlign: '-2px' }} aria-hidden="true" />{' '}
                    <strong>Share</strong> → <strong>Add to Home Screen</strong>. It then opens
                    like an app, and it&rsquo;s also what web notifications will need later.
                  </>
                ) : (
                  <>
                    Use your browser menu → <strong>Install app</strong> (or{' '}
                    <strong>Add to Home screen</strong>).
                  </>
                )}
              </p>
            </div>
          </section>
        )}

        <section className="section">
          <div className="section__head">
            <span className="label">Household</span>
          </div>
          <div className="sheet">
            <p style={{ margin: 0, fontSize: 'var(--t-small)', color: 'var(--text-muted)' }}>
              {profiles.length} {profiles.length === 1 ? 'roommate' : 'roommates'} ·{' '}
              {chores.filter((c) => !c.archived_at).length} chores on the list
            </p>
          </div>
        </section>

        <section className="section">
          <button type="button" className="btn btn--danger" onClick={() => void signOut()}>
            <LogOut size={16} strokeWidth={1.9} aria-hidden="true" />
            Sign out
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
