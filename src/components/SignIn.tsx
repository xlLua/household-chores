import { useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { Flourish } from './Flourish'

export function SignIn() {
  const { mountGoogleButton, gisReady, signInWithRedirect, error } = useAuth()

  // Callback ref: the Google button must be rendered into the node by their
  // script, so we hand it over as soon as it exists.
  const ref = useCallback(
    (el: HTMLDivElement | null) => mountGoogleButton(el),
    [mountGoogleButton],
  )

  return (
    <main className="signin">
      <div className="sheet signin__card">
        <Flourish className="flourish flourish--tl" />
        <Flourish className="flourish flourish--br" />

        <h1 className="signin__title">Atelier</h1>
        <p className="signin__body">
          A shared grimoire of household chores.
          <br />
          Sign in to see what&rsquo;s due.
        </p>

        <div className="signin__google" ref={ref} />

        {!gisReady && (
          <p className="signin__fallback">
            Google&rsquo;s sign-in didn&rsquo;t load.{' '}
            <button type="button" onClick={() => void signInWithRedirect()}>
              Continue with Google instead
            </button>
          </p>
        )}

        {error && (
          <p className="banner banner--warn" style={{ marginTop: '1rem' }}>
            {error}
          </p>
        )}
      </div>
    </main>
  )
}
