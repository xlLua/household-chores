import { supabase } from './supabase'
import { missingDueDates, toISO } from './recurrence'
import type {
  Chore,
  ChoreDraft,
  ChoreInstance,
  InstanceWithChore,
  Profile,
} from './types'
import { addDays, parseISO, startOfToday } from 'date-fns'

const INSTANCE_WITH_CHORE = '*, chore:chores(*)'

// --- reads -----------------------------------------------------------------

export async function fetchChores(includeArchived = false): Promise<Chore[]> {
  let q = supabase.from('chores').select('*').order('created_at', { ascending: true })
  if (!includeArchived) q = q.is('archived_at', null)
  const { data, error } = await q
  if (error) throw error
  return data as Chore[]
}

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*')
  if (error) throw error
  return data as Profile[]
}

/** Everything relevant to the Today board: open instances plus whatever was
 *  completed recently, so finishing a chore doesn't make it vanish instantly. */
export async function fetchBoard(): Promise<InstanceWithChore[]> {
  const today = startOfToday()
  const { data, error } = await supabase
    .from('chore_instances')
    .select(INSTANCE_WITH_CHORE)
    .gte('due_date', toISO(addDays(today, -45)))
    .lte('due_date', toISO(addDays(today, 21)))
    .order('due_date', { ascending: true })
  if (error) throw error
  return (data as unknown as InstanceWithChore[]).filter((i) => i.chore)
}

// --- the generator ---------------------------------------------------------

/**
 * Materialise any missing occurrences. Called on app open and after each
 * completion -- there is no cron and no server process, so the schedule
 * self-heals whenever somebody opens the app.
 *
 * Returns how many rows were created, which is handy when debugging a
 * recurrence rule that isn't behaving.
 */
export async function ensureInstances(): Promise<number> {
  const chores = await fetchChores()
  if (chores.length === 0) return 0

  const { data, error } = await supabase
    .from('chore_instances')
    .select('*')
    .in(
      'chore_id',
      chores.map((c) => c.id),
    )
  if (error) throw error

  const byChore = new Map<string, ChoreInstance[]>()
  for (const inst of (data ?? []) as ChoreInstance[]) {
    const list = byChore.get(inst.chore_id) ?? []
    list.push(inst)
    byChore.set(inst.chore_id, list)
  }

  const today = startOfToday()
  const rows = chores.flatMap((chore) =>
    missingDueDates(chore, byChore.get(chore.id) ?? [], today).map((due_date) => ({
      chore_id: chore.id,
      due_date,
    })),
  )
  if (rows.length === 0) return 0

  const { error: insertError } = await supabase
    .from('chore_instances')
    .upsert(rows, { onConflict: 'chore_id,due_date', ignoreDuplicates: true })
  if (insertError) throw insertError
  return rows.length
}

// --- the core write --------------------------------------------------------

export type CompleteResult = { raced: boolean }

/**
 * Claim a chore. The `.eq('status', 'open')` guard is the whole race fix: in a
 * shared pool two roommates genuinely do tap "done" on the trash at once, and
 * whoever loses must not also get the points. Zero rows back means they lost.
 */
export async function completeInstance(
  instance: InstanceWithChore,
  userId: string,
): Promise<CompleteResult> {
  const { data, error } = await supabase
    .from('chore_instances')
    .update({
      status: 'done',
      completed_by: userId,
      completed_at: new Date().toISOString(),
    })
    .eq('id', instance.id)
    .eq('status', 'open')
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) return { raced: true }

  // Completion-anchored chores schedule their next occurrence from the moment
  // they were done, not from the calendar.
  if (instance.chore.recurrence_anchor === 'completion') {
    await ensureInstances()
  }
  return { raced: false }
}

export async function uncompleteInstance(id: string): Promise<void> {
  const { error } = await supabase
    .from('chore_instances')
    .update({ status: 'open', completed_by: null, completed_at: null })
    .eq('id', id)
  if (error) throw error
}

export async function skipInstance(id: string): Promise<void> {
  const { error } = await supabase
    .from('chore_instances')
    .update({ status: 'skipped', completed_by: null, completed_at: null })
    .eq('id', id)
  if (error) throw error
}

// --- chore definitions -----------------------------------------------------

export async function createChore(draft: ChoreDraft): Promise<Chore> {
  const { data, error } = await supabase.from('chores').insert(draft).select('*').single()
  if (error) throw error
  await ensureInstances()
  return data as Chore
}

export async function updateChore(id: string, patch: Partial<ChoreDraft>): Promise<void> {
  const { error } = await supabase.from('chores').update(patch).eq('id', id)
  if (error) throw error
  await ensureInstances()
}

export async function archiveChore(id: string): Promise<void> {
  const { error } = await supabase
    .from('chores')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  // Drop future occurrences; keep the completed history for the leaderboard.
  await supabase
    .from('chore_instances')
    .delete()
    .eq('chore_id', id)
    .eq('status', 'open')
    .gte('due_date', toISO(startOfToday()))
}

export async function unarchiveChore(id: string): Promise<void> {
  const { error } = await supabase.from('chores').update({ archived_at: null }).eq('id', id)
  if (error) throw error
  await ensureInstances()
}

// --- leaderboard -----------------------------------------------------------

export interface Score {
  userId: string
  points: number
  completed: number
}

/** Points are always derived from the completion log, never stored as a
 *  counter -- a counter drifts the first time someone un-completes a chore. */
export async function fetchScores(monthStart: Date): Promise<Score[]> {
  const start = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1)
  const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)

  const { data, error } = await supabase
    .from('chore_instances')
    .select('completed_by, chore:chores(points)')
    .eq('status', 'done')
    .gte('completed_at', start.toISOString())
    .lt('completed_at', end.toISOString())
  if (error) throw error

  const tally = new Map<string, Score>()
  for (const row of (data ?? []) as unknown as Array<{
    completed_by: string | null
    chore: { points: number } | null
  }>) {
    if (!row.completed_by) continue
    const entry =
      tally.get(row.completed_by) ??
      { userId: row.completed_by, points: 0, completed: 0 }
    entry.points += row.chore?.points ?? 0
    entry.completed += 1
    tally.set(row.completed_by, entry)
  }
  return [...tally.values()].sort((a, b) => b.points - a.points)
}

// --- helpers used by the UI ------------------------------------------------

export type DueBucket = 'overdue' | 'today' | 'upcoming'

export function bucketOf(instance: ChoreInstance, today = startOfToday()): DueBucket {
  const due = parseISO(instance.due_date)
  if (due < today) return 'overdue'
  if (toISO(due) === toISO(today)) return 'today'
  return 'upcoming'
}
