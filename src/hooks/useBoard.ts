import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ensureInstances, fetchBoard, fetchChores, fetchProfiles } from '../lib/chores'
import type { Chore, InstanceWithChore, Profile } from '../lib/types'

export interface Board {
  instances: InstanceWithChore[]
  chores: Chore[]
  profiles: Profile[]
  loading: boolean
  error: string | null
  online: boolean
  reload: () => Promise<void>
}

/**
 * The single source of board data. Any change -- local or from another phone --
 * refetches rather than patching rows in place: for four people and a few
 * hundred rows that costs nothing, and it can't drift out of sync the way
 * incremental patching does.
 */
export function useBoard(): Board {
  const [instances, setInstances] = useState<InstanceWithChore[]>([])
  const [chores, setChores] = useState<Chore[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const seeded = useRef(false)

  const reload = useCallback(async () => {
    try {
      const [nextInstances, nextChores, nextProfiles] = await Promise.all([
        fetchBoard(),
        fetchChores(true),
        fetchProfiles(),
      ])
      setInstances(nextInstances)
      setChores(nextChores)
      setProfiles(nextProfiles)
      setError(null)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Could not reach the atelier.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Generate any missing occurrences on open, then load. This is the whole
  // scheduler: no cron, no server process.
  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    ;(async () => {
      try {
        await ensureInstances()
      } catch (e) {
        console.error('instance generation failed', e)
      }
      await reload()
    })()
  }, [reload])

  // Realtime. Requires the tables to be in the supabase_realtime publication
  // (schema.sql does that) or this silently never fires.
  useEffect(() => {
    const channel = supabase
      .channel('atelier-board')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chore_instances' },
        () => void reload(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chores' },
        () => void reload(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [reload])

  useEffect(() => {
    const up = () => {
      setOnline(true)
      void reload()
    }
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [reload])

  // Coming back to an installed PWA after a while shows stale data otherwise.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  return { instances, chores, profiles, loading, error, online, reload }
}
