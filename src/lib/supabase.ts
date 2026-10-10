import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && anonKey)

if (!isConfigured) {
  // Surfaced as a setup screen rather than a blank page -- this is the most
  // likely first-run failure, so it should say exactly what is missing.
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.',
  )
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Needed by the signInWithOAuth redirect fallback; harmless for the
    // primary Google Identity Services flow.
    detectSessionInUrl: true,
  },
})
