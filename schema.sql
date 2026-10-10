-- Atelier — household chores schema
-- Paste this whole file into the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Safe to re-run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Exists only so the leaderboard can show other roommates' names: the client
-- cannot read auth.users. Upserted from the Google ID token on every sign-in.
create table if not exists profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Roommate',
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- The chore *definition*, including how it repeats.
create table if not exists chores (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (length(trim(title)) > 0),
  notes               text,
  points              int  not null default 1 check (points between 1 and 100),
  glyph               text not null default 'broom',

  recurrence_kind     text not null default 'weekly'
    check (recurrence_kind in ('once','daily','weekly','biweekly','monthly','every_n_days')),
  -- Only read when recurrence_kind = 'every_n_days'.
  recurrence_interval int  not null default 1 check (recurrence_interval between 1 and 365),
  -- 'calendar'   = every Monday, whenever it was last done (trash)
  -- 'completion' = ~7 days after someone last did it (vacuuming)
  recurrence_anchor   text not null default 'calendar'
    check (recurrence_anchor in ('calendar','completion')),
  -- Seeds the schedule. Set to a Monday for a weekly Monday chore.
  start_date          date not null default current_date,

  archived_at         timestamptz,
  created_at          timestamptz not null default now()
);

-- One materialized occurrence. The unique constraint is what makes the
-- client-side generator idempotent and lets it run on every app open.
create table if not exists chore_instances (
  id           uuid primary key default gen_random_uuid(),
  chore_id     uuid not null references chores (id) on delete cascade,
  due_date     date not null,
  status       text not null default 'open'
    check (status in ('open','done','skipped')),
  completed_by uuid references profiles (user_id) on delete set null,
  completed_at timestamptz,
  unique (chore_id, due_date)
);

create index if not exists chore_instances_due_idx
  on chore_instances (status, due_date);
create index if not exists chore_instances_scorer_idx
  on chore_instances (completed_by, completed_at);
create index if not exists chores_active_idx
  on chores (archived_at);

-- ---------------------------------------------------------------------------
-- Access: one policy per table, "must be signed in", nothing per-user.
--
-- This is deliberately the simplest thing that isn't broken. It is NOT
-- multi-tenant scoping -- there is one household. The reason it isn't just
-- disabled: the anon key ships inside the frontend bundle, so with RLS off
-- anyone who finds the URL could read and delete the chore list.
--
-- To restrict to specific people, add to each `using` clause:
--     and auth.email() in ('you@gmail.com','sam@gmail.com')
-- To drop access control entirely, delete this whole section.
-- ---------------------------------------------------------------------------

alter table profiles        enable row level security;
alter table chores          enable row level security;
alter table chore_instances enable row level security;

drop policy if exists "signed in" on profiles;
create policy "signed in" on profiles
  for all to authenticated using (true) with check (true);

drop policy if exists "signed in" on chores;
create policy "signed in" on chores
  for all to authenticated using (true) with check (true);

drop policy if exists "signed in" on chore_instances;
create policy "signed in" on chore_instances
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Realtime. Without this the tables emit no change events and phones only
-- update on refresh -- easy to forget, and it fails silently.
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    alter publication supabase_realtime add table chore_instances;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table chores;
  exception when duplicate_object then null;
  end;
end $$;
