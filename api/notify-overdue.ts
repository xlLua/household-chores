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
import { adminDb, localDate, monthStandings, sendToUser } from './_lib/push.js'

const RECIPIENTS = 2

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

  const db = adminDb()
  const today = localDate(new Date())

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
  const recipients = (await monthStandings(db, today.slice(0, 7)))
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

    sent += await sendToUser(db, person.user_id, payload, subs)
  }

  return Response.json({
    today,
    overdue: overdue.length,
    recipients: recipients.map((r) => `${r.display_name} (${r.points})`),
    sent,
    skipped,
  })
}
