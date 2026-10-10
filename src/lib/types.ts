export type RecurrenceKind =
  | 'once'
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'every_n_days'

/** 'calendar' = every Monday regardless of when it was last done (trash).
 *  'completion' = ~N days after someone last did it (vacuuming). */
export type RecurrenceAnchor = 'calendar' | 'completion'

export type InstanceStatus = 'open' | 'done' | 'skipped'

export type GlyphName = 'broom' | 'kettle' | 'mushroom' | 'leaf' | 'moon' | 'washtub'

export interface Profile {
  user_id: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

export interface Chore {
  id: string
  title: string
  notes: string | null
  points: number
  glyph: GlyphName
  recurrence_kind: RecurrenceKind
  recurrence_interval: number
  recurrence_anchor: RecurrenceAnchor
  /** ISO date, 'yyyy-MM-dd'. Seeds the schedule. */
  start_date: string
  archived_at: string | null
  created_at: string
}

export interface ChoreInstance {
  id: string
  chore_id: string
  /** ISO date, 'yyyy-MM-dd'. */
  due_date: string
  status: InstanceStatus
  completed_by: string | null
  completed_at: string | null
}

export interface InstanceWithChore extends ChoreInstance {
  chore: Chore
}

export type ChoreDraft = Omit<Chore, 'id' | 'created_at' | 'archived_at'>
