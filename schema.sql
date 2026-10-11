-- Onder één Hoedje — household chores schema
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
  display_name text not null default 'Huisgenoot',
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- The person's avatar, assigned by the admin: the file name (without
-- extension) of an image in src/assets/avatars/. Null = initials. (avatar_url
-- is no longer filled: Google photos are never stored or shown.)
-- Not part of the sign-in upsert, so it survives every sign-in.
alter table profiles
  add column if not exists avatar_key text check (avatar_key is null or length(avatar_key) between 1 and 100);

-- Avatars are assigned by the admin, not chosen in the app: members may only
-- write the columns the sign-in upsert sets, so avatar_key is read-only to
-- them (set it in the SQL editor or Table Editor instead).
revoke insert, update on profiles from anon, authenticated;
grant insert (user_id, display_name, avatar_url) on profiles to authenticated;
grant update (user_id, display_name, avatar_url) on profiles to authenticated;

-- The chore *definition*, including how it repeats.
create table if not exists chores (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (length(trim(title)) > 0),
  notes               text,
  points              int  not null default 1 check (points between 1 and 100),
  glyph               text not null default 'broom',

  recurrence_kind     text not null default 'weekly'
    check (recurrence_kind in ('once','daily','weekly','biweekly','monthly','every_n_days')),
  -- Days for 'every_n_days', months for 'monthly' (1, 3, 6...); ignored otherwise.
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

-- Personal chores (added 2026-10-11): owner_id set = only that person sees
-- the chore and its occurrences, and completing it awards no points. Null =
-- shared with the household, as before. Chosen when the chore is created and
-- never changed afterwards (see the grants below), so a shared chore's
-- completion history can't vanish from the scoreboard by turning it personal.
alter table chores
  add column if not exists owner_id uuid references profiles (user_id) on delete cascade;
create index if not exists chores_owner_idx on chores (owner_id);

revoke update on chores from anon, authenticated;
grant update (title, notes, points, glyph, recurrence_kind, recurrence_interval,
              recurrence_anchor, start_date, archived_at) on chores to authenticated;

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
-- Access: only the household.
--
-- Any Google account can complete sign-in, but every policy below requires the
-- signed-in email to be on this list, so anyone else sees and changes nothing.
-- The app calls is_household_member() after sign-in to show a "no access"
-- screen instead of an empty board. To add or remove someone, edit the array
-- and re-run this statement.
--
-- The email comes from the Supabase JWT, which Supabase sets from Google's
-- verified address -- unlike user_metadata, users cannot edit it.
-- ---------------------------------------------------------------------------

create or replace function public.is_household_member()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(lower(auth.jwt() ->> 'email'), '') = any (array[
    'dario-verschueren@hotmail.com',
    'leenvangeldorp@gmail.com',
    'lenny.boel@gmail.com'
  ])
$$;

alter table profiles        enable row level security;
alter table chores          enable row level security;
alter table chore_instances enable row level security;

drop policy if exists "signed in" on profiles;
drop policy if exists "household" on profiles;
create policy "household" on profiles
  for all to authenticated
  using ((select public.is_household_member()))
  with check ((select public.is_household_member()));

-- Shared chores for everyone in the household; personal ones only for their owner.
drop policy if exists "signed in" on chores;
drop policy if exists "household" on chores;
create policy "household" on chores
  for all to authenticated
  using ((select public.is_household_member())
         and (owner_id is null or owner_id = (select auth.uid())))
  with check ((select public.is_household_member())
              and (owner_id is null or owner_id = (select auth.uid())));

-- An occurrence is visible exactly when its chore is.
drop policy if exists "signed in" on chore_instances;
drop policy if exists "household" on chore_instances;
create policy "household" on chore_instances
  for all to authenticated
  using ((select public.is_household_member()) and exists (
    select 1 from chores c
    where c.id = chore_id and (c.owner_id is null or c.owner_id = (select auth.uid()))))
  with check ((select public.is_household_member()) and exists (
    select 1 from chores c
    where c.id = chore_id and (c.owner_id is null or c.owner_id = (select auth.uid()))));

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

-- ---------------------------------------------------------------------------
-- Push notifications (added 2026-10-10)
--
-- One row per phone that turned on notifications in Instellingen. Unlike the
-- tables above these ARE per-user: an endpoint lets anyone holding it push to
-- that phone, so each person can only see and manage their own.
--
-- The daily sender (api/notify-overdue.ts) uses the service-role key, which
-- bypasses RLS, to read every subscription and to write push_log.
-- ---------------------------------------------------------------------------

create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

drop policy if exists "own subscriptions" on push_subscriptions;
create policy "own subscriptions" on push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_household_member()))
  with check (user_id = (select auth.uid()) and (select public.is_household_member()));

-- One row per person per day they were notified. The sender inserts here
-- first and only sends if the insert went through, so a cron that fires twice
-- doesn't notify twice. Server-only: RLS on with no policies.
create table if not exists push_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  sent_on date not null,
  primary key (user_id, sent_on)
);

alter table push_log enable row level security;

-- Who led the scoreboard last, per month (yyyy-MM, Europe/Amsterdam), so
-- api/leader-check.ts can tell when the lead changes hands. Server-only:
-- RLS on with no policies.
create table if not exists leader_state (
  month      text primary key check (month ~ '^\d{4}-\d{2}$'),
  user_id    uuid not null references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now()
);
create index if not exists leader_state_user_idx on leader_state (user_id);
alter table leader_state enable row level security;
