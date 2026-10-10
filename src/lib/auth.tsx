import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile } from './types'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// Minimal shape of the bit of Google Identity Services we actually use.
interface GoogleIdApi {
  initialize(config: {
    client_id: string
    callback: (res: { credential: string }) => void
    nonce?: string
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
    use_fedcm_for_prompt?: boolean
  }): void
  renderButton(
    parent: HTMLElement,
    options: Record<string, string | number | boolean>,
  ): void
  prompt(): void
  disableAutoSelect(): void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } }
  }
}

/**
 * Google wants the SHA-256 of the nonce; Supabase wants the original. Sending
 * the same value to both fails verification, which is the usual cause of
 * "nonce mismatch" on this flow.
 */
async function makeNoncePair(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const raw = btoa(String.fromCharCode(...bytes))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hashed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return { raw, hashed }
}

function loadGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('gis failed')))
      return
    }
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('gis failed'))
    document.head.appendChild(script)
  })
}

interface AuthValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  /** False when the Google script couldn't load -- the UI then offers the
   *  redirect fallback instead of an empty space where the button should be. */
  gisReady: boolean
  error: string | null
  mountGoogleButton: (el: HTMLElement | null) => void
  signInWithRedirect: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [gisReady, setGisReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nonceRef = useRef<{ raw: string; hashed: string } | null>(null)
  const buttonElRef = useRef<HTMLElement | null>(null)

  // --- session ------------------------------------------------------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // --- mirror the Google profile into `profiles` --------------------------
  // The leaderboard needs other roommates' names and the client can't read
  // auth.users, so name and avatar are copied across on every sign-in.
  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      return
    }
    const meta = session.user.user_metadata as Record<string, string | undefined>
    const row = {
      user_id: session.user.id,
      display_name:
        meta.full_name ?? meta.name ?? session.user.email?.split('@')[0] ?? 'Roommate',
      avatar_url: meta.avatar_url ?? meta.picture ?? null,
    }
    let cancelled = false
    supabase
      .from('profiles')
      .upsert(row, { onConflict: 'user_id' })
      .select('*')
      .single()
      .then(({ data, error: upsertError }) => {
        if (cancelled) return
        if (upsertError) {
          console.error('profile upsert failed', upsertError)
          setProfile({ ...row, created_at: new Date().toISOString() } as Profile)
          return
        }
        setProfile(data as Profile)
      })
    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  const handleCredential = useCallback(async (res: { credential: string }) => {
    try {
      const { error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: res.credential,
        nonce: nonceRef.current?.raw,
      })
      if (signInError) throw signInError
      setError(null)
    } catch (e) {
      console.error(e)
      setError(
        e instanceof Error ? e.message : 'Google sign-in was refused. Try again.',
      )
    }
  }, [])

  const renderInto = useCallback((el: HTMLElement) => {
    if (!window.google?.accounts?.id) return
    el.innerHTML = ''
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    window.google.accounts.id.renderButton(el, {
      type: 'standard',
      theme: dark ? 'filled_black' : 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      logo_alignment: 'left',
      width: 260,
    })
  }, [])

  // --- Google Identity Services -------------------------------------------
  // Chosen over signInWithOAuth because it returns the ID token in-page. A
  // full-page OAuth redirect is the fragile path inside an installed iOS PWA:
  // it can break out of standalone mode and lose the session coming back.
  useEffect(() => {
    if (session || !CLIENT_ID) return
    let cancelled = false

    ;(async () => {
      try {
        await loadGis()
        if (cancelled) return
        const nonce = await makeNoncePair()
        if (cancelled) return
        nonceRef.current = nonce
        window.google!.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: handleCredential,
          nonce: nonce.hashed,
          cancel_on_tap_outside: false,
          use_fedcm_for_prompt: true,
        })
        setGisReady(true)
        if (buttonElRef.current) renderInto(buttonElRef.current)
      } catch {
        if (!cancelled) setGisReady(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [session, handleCredential, renderInto])

  const mountGoogleButton = useCallback(
    (el: HTMLElement | null) => {
      buttonElRef.current = el
      if (el && gisReady) renderInto(el)
    },
    [gisReady, renderInto],
  )

  const signInWithRedirect = useCallback(async () => {
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (oauthError) setError(oauthError.message)
  }, [])

  const signOut = useCallback(async () => {
    window.google?.accounts.id.disableAutoSelect()
    await supabase.auth.signOut()
  }, [])

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      gisReady,
      error,
      mountGoogleButton,
      signInWithRedirect,
      signOut,
    }),
    [session, profile, loading, gisReady, error, mountGoogleButton, signInWithRedirect, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
