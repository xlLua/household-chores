/** The most likely first-run failure, so it says exactly what is missing
 *  rather than rendering a blank page. */
export function SetupNeeded() {
  return (
    <main className="signin">
      <div className="sheet signin__card" style={{ textAlign: 'left' }}>
        <h1 className="signin__title" style={{ textAlign: 'center' }}>
          Bijna klaar
        </h1>
        <p className="signin__body" style={{ textAlign: 'center' }}>
          De configuratie ontbreekt nog.
        </p>
        <p style={{ fontSize: 'var(--t-small)', color: 'var(--text-muted)' }}>
          Kopieer <code>.env.example</code> naar <code>.env.local</code> en vul in:
        </p>
        <ul
          style={{
            fontSize: 'var(--t-small)',
            lineHeight: 1.9,
            paddingLeft: '1.1rem',
            color: 'var(--text-muted)',
          }}
        >
          <li><code>VITE_SUPABASE_URL</code></li>
          <li><code>VITE_SUPABASE_ANON_KEY</code></li>
          <li><code>VITE_GOOGLE_CLIENT_ID</code></li>
        </ul>
        <p style={{ fontSize: 'var(--t-small)', color: 'var(--text-muted)' }}>
          Start daarna de dev-server opnieuw. In <code>README.md</code> staat waar
          elke waarde vandaan komt.
        </p>
      </div>
    </main>
  )
}
