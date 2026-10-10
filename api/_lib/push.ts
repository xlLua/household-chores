/**
 * Shared by the push endpoints. Lives under api/_lib/ -- Vercel doesn't turn
 * underscore-prefixed paths into functions, so this is never routable.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export const TZ = 'Europe/Amsterdam'

/** yyyy-MM-dd in the household's timezone, not the server's (UTC). */
export const localDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)

export function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

/** Service-role client: bypasses RLS, server only. */
export function adminDb(): SupabaseClient {
  return createClient(env('VITE_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
}

let vapidReady = false
function ensureVapid() {
  if (vapidReady) return
  webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))
  vapidReady = true
}

export interface Person {
  user_id: string
  display_name: string
  points: number
}

/** Everyone in `profiles` with their points for the given month (yyyy-MM, local). */
export async function monthStandings(db: SupabaseClient, month: string): Promise<Person[]> {
  const [{ data: profiles, error: profileError }, { data: done, error: doneError }] =
    await Promise.all([
      db.from('profiles').select('user_id, display_name'),
      db
        .from('chore_instances')
        .select('completed_by, completed_at, chore:chores(points)')
        .eq('status', 'done')
        // Generous window, then filtered to the month in local time below.
        .gte('completed_at', new Date(Date.now() - 40 * 86_400_000).toISOString()),
    ])
  if (profileError) throw profileError
  if (doneError) throw doneError

  const points = new Map<string, number>()
  for (const row of (done ?? []) as unknown as Array<{
    completed_by: string | null
    completed_at: string
    chore: { points: number } | null
  }>) {
    if (!row.completed_by || localDate(new Date(row.completed_at)).slice(0, 7) !== month) continue
    points.set(row.completed_by, (points.get(row.completed_by) ?? 0) + (row.chore?.points ?? 0))
  }
  return (profiles ?? []).map((p) => ({ ...p, points: points.get(p.user_id) ?? 0 }))
}

export interface PushPayload {
  title: string
  body: string
  url?: string
}

/**
 * Sends to every phone the person has subscribed. Subscriptions the push
 * service reports as gone (404/410) are deleted. Returns how many were sent.
 */
export async function sendToUser(
  db: SupabaseClient,
  userId: string,
  payload: PushPayload,
  subs?: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
): Promise<number> {
  ensureVapid()
  if (!subs) {
    const { data, error } = await db
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)
    if (error) throw error
    subs = data ?? []
  }

  const message = JSON.stringify({ url: '/', ...payload })
  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        message,
        { TTL: 12 * 3600, urgency: 'normal' },
      )
      sent += 1
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      // Gone: the phone unsubscribed or the app was removed. Forget it.
      if (status === 404 || status === 410) {
        await db.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        console.error('push failed', status, e)
      }
    }
  }
  return sent
}
