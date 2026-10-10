import { LogOut } from 'lucide-react'
import { useAuth } from '../lib/auth'

/** Signed in with a Google account that isn't on the household list. */
export function NoAccess() {
  const { session, signOut } = useAuth()
  return (
    <main className="signin">
      <div className="sheet signin__card">
        <h1 className="signin__title">Onder één Hoedje</h1>
        <p className="signin__family">Van Rijswijck</p>
        <p className="signin__body">
          <strong>{session?.user.email}</strong> heeft geen toegang tot deze app.
          <br />
          Log in met het account waarmee je bent uitgenodigd.
        </p>
        <button type="button" className="btn btn--ghost" onClick={() => void signOut()}>
          <LogOut size={16} strokeWidth={1.9} aria-hidden="true" />
          Uitloggen
        </button>
      </div>
      <p className="legal-links">
        <a href="/privacy">Privacybeleid</a>
        <span aria-hidden="true"> · </span>
        <a href="/terms">Gebruiksvoorwaarden</a>
      </p>
    </main>
  )
}
