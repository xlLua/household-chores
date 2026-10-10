/**
 * Daily overdue reminder, run by Vercel Cron (see vercel.json).
 *
 * If any chore is overdue, the two roommates with the fewest points this month
 * each get one push notification listing what's overdue. Runs once a morning,
 * so someone who keeps the lowest score gets a reminder each day until the
 * chores are done.
 *
 * Env (Vercel project settings, never shipped to the browser):
 *   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
 */
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const TZ = 'Europe/Amsterdam'
const RECIPIENTS = 2

/** yyyy-MM-dd in the household's timezone, not the server's (UTC). */
const localDate = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d)

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)

function listNl(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} en ${items.at(-1)}`
}

export async function GET(request: Request): Promise<Response> {
  // Vercel Cron sends this header; anything else is turned away.
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const env = (name: string) => {
    const v = process.env[name]
    if (!v) throw new Error(`Missing env ${name}`)
    return v
  }
  const db = createClient(env('VITE_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
  webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))

  const now = new Date()
  const today = localDate(now)
  const month = today.slice(0, 7)

  // --- what's overdue --------------------------------------------------------
  const { data: overdueRows, error: overdueError } = await db
    .from('chore_instances')
    .select('due_date, chore:chores!inner(title, archived_at)')
    .eq('status', 'open')
    .lt('due_date', today)
    .is('chore.archived_at', null)
    .order('due_date', { ascending: true })
  if (overdueError) throw overdueError
  const overdue = (overdueRows ?? []) as unknown as Array<{
    due_date: string
    chore: { title: string }
  }>
  if (overdue.length === 0) return Response.json({ today, overdue: 0, sent: 0 })

  // --- who has the fewest points this month ----------------------------------
  const [{ data: profiles, error: profileError }, { data: done, error: doneError }] =
    await Promise.all([
      db.from('profiles').select('user_id, display_name'),
      db
        .from('chore_instances')
        .select('completed_by, completed_at, chore:chores(points)')
        .eq('status', 'done')
        // Generous window, then filtered to this month in local time below.
        .gte('completed_at', new Date(now.getTime() - 40 * 86_400_000).toISOString()),
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
  const recipients = (profiles ?? [])
    .map((p) => ({ ...p, points: points.get(p.user_id) ?? 0 }))
    .sort((a, b) => a.points - b.points || a.display_name.localeCompare(b.display_name))
    .slice(0, RECIPIENTS)

  // --- the message -----------------------------------------------------------
  const first = overdue[0]
  const late = daysBetween(first.due_date, today)
  const payload =
    overdue.length === 1
      ? {
          title: `Te laat: ${first.chore.title}`,
          body: late === 1 ? 'Dit had gisteren gedaan moeten zijn.' : `Al ${late} dagen te laat.`,
        }
      : {
          title: `${overdue.length} taken te laat`,
          body: `${listNl(overdue.slice(0, 3).map((o) => o.chore.title))}${overdue.length > 3 ? ' en meer' : ''}.`,
        }
  const message = JSON.stringify({ ...payload, url: '/' })

  // --- send ------------------------------------------------------------------
  let sent = 0
  const skipped: string[] = []
  for (const person of recipients) {
    const { data: subs, error: subError } = await db
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', person.user_id)
    if (subError) throw subError
    // Checked before claiming today's slot, so turning notifications on later
    // in the day still gets that day's reminder on the next run.
    if (!subs || subs.length === 0) {
      skipped.push(`${person.display_name}: notifications off`)
      continue
    }

    // Claim today's slot first; a duplicate cron run finds it taken.
    const { data: claimed, error: claimError } = await db
      .from('push_log')
      .upsert({ user_id: person.user_id, sent_on: today }, { ignoreDuplicates: true })
      .select('user_id')
    if (claimError) throw claimError
    if (!claimed || claimed.length === 0) {
      skipped.push(`${person.display_name}: already notified today`)
      continue
    }

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
  }

  return Response.json({
    today,
    overdue: overdue.length,
    recipients: recipients.map((r) => `${r.display_name} (${r.points})`),
    sent,
    skipped,
  })
}
