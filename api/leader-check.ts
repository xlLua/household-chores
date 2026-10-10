/**
 * "New leader" notifications. The app POSTs here after every completion (and,
 * with { silent: true }, after an undo). The client only says "something
 * changed"; the server recomputes this month's standings itself and compares
 * the leader with the one stored in leader_state.
 *
 * Rules:
 *  - A leader is someone strictly ahead with more than 0 points. A tie for
 *    first changes nothing.
 *  - The first leader of a month is recorded, not announced.
 *  - The switch is a compare-and-set on leader_state, so two completions
 *    landing at once announce it once.
 *  - silent (after an undo) resyncs the stored leader without notifying, so
 *    undoing a completion never announces a "new" leader.
 *
 * Auth: the caller's Supabase access token, which must belong to a household
 * member (is_household_member()).
 */
import { createClient } from '@supabase/supabase-js'
import { adminDb, env, localDate, monthStandings, sendToUser } from './_lib/push.js'

const pointsLabel = (n: number) => (n === 1 ? '1 punt' : `${n} punten`)
const firstName = (name: string) => name.split(' ')[0]

export async function POST(request: Request): Promise<Response> {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return new Response('Unauthorized', { status: 401 })

  // Ask the database, as the caller, whether they're in the household. An
  // invalid or expired token fails here too.
  const asCaller = createClient(env('VITE_SUPABASE_URL'), env('VITE_SUPABASE_ANON_KEY'), {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: member, error: memberError } = await asCaller.rpc('is_household_member')
  if (memberError || member !== true) return new Response('Forbidden', { status: 403 })

  const { silent = false } = (await request.json().catch(() => ({}))) as { silent?: boolean }

  const db = adminDb()
  const month = localDate(new Date()).slice(0, 7)
  const standings = (await monthStandings(db, month)).sort((a, b) => b.points - a.points)
  const [top, second] = standings
  if (!top || top.points === 0 || (second && second.points === top.points)) {
    return Response.json({ month, leader: null, changed: false })
  }

  const { data: stored, error: storedError } = await db
    .from('leader_state')
    .select('user_id')
    .eq('month', month)
    .maybeSingle()
  if (storedError) throw storedError

  if (!stored) {
    // First leader this month: record quietly.
    const { error } = await db
      .from('leader_state')
      .upsert({ month, user_id: top.user_id }, { onConflict: 'month', ignoreDuplicates: true })
    if (error) throw error
    return Response.json({ month, leader: top.display_name, changed: false })
  }
  if (stored.user_id === top.user_id) {
    return Response.json({ month, leader: top.display_name, changed: false })
  }

  // Compare-and-set: only one concurrent caller gets the row back.
  const { data: switched, error: switchError } = await db
    .from('leader_state')
    .update({ user_id: top.user_id, updated_at: new Date().toISOString() })
    .eq('month', month)
    .eq('user_id', stored.user_id)
    .select('month')
  if (switchError) throw switchError
  if (!switched || switched.length === 0 || silent) {
    return Response.json({ month, leader: top.display_name, changed: false, silent })
  }

  const previous = standings.find((p) => p.user_id === stored.user_id)
  const name = firstName(top.display_name)
  const score = pointsLabel(top.points)
  let sent = 0
  for (const person of standings) {
    const payload =
      person.user_id === top.user_id
        ? {
            title: 'Je staat bovenaan',
            body: previous
              ? `Met ${score} deze maand heb je ${firstName(previous.display_name)} ingehaald.`
              : `Met ${score} deze maand.`,
          }
        : person.user_id === previous?.user_id
          ? { title: `${name} heeft je ingehaald`, body: `${name} staat nu bovenaan met ${score}.` }
          : { title: `Nieuwe koploper: ${name}`, body: `${name} staat nu bovenaan met ${score}.` }
    sent += await sendToUser(db, person.user_id, { ...payload, url: '/scores' })
  }

  return Response.json({ month, leader: top.display_name, changed: true, sent })
}
