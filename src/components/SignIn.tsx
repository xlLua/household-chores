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

        <h1 className="signin__title">Onder één Hoedje</h1>
        <p className="signin__family">Van Rijswijck</p>
        <p className="signin__body">
          Huishoudtaken voor het appartement.
          <br />
          Log in om te zien wat er moet gebeuren.
        </p>

        <div className="signin__google" ref={ref} />

        {!gisReady && (
          <p className="signin__fallback">
            Inloggen met Google is niet geladen.{' '}
            <button type="button" onClick={() => void signInWithRedirect()}>
              Toch doorgaan met Google
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
