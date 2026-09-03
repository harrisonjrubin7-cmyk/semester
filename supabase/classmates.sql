-- Semester — classmates: verified students, grouped by the courses they take.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded. It expects
-- schema.sql to have been run first.
--
-- ## What this is, and what it is not
--
-- Everything in schema.sql is private to one account. This file is the first
-- thing in the app where one person's row is visible to another, so the rules
-- are written out rather than assumed.
--
-- **Verification proves an address, not an enrolment.** A confirmed
-- @vanderbilt.edu address means the person controls a Vanderbilt mailbox. It
-- does not mean they are in ECON 1020, because nothing here can read the
-- registrar. Anyone verified can claim any course code, and the app says so on
-- the screen rather than implying a roster.
--
-- **Blocking is enforced here, not in the interface.** A blocked person's
-- messages are removed by the policy below, so they never reach the device at
-- all. Filtering in the client would leave the text sitting in the browser.
--
-- **Reports are stored, not moderated.** There is no queue and no moderator
-- unless the person running this instance reads the table. The app must not
-- imply otherwise; blocking is the remedy that actually works, and it is
-- immediate.
--
-- **What a classmate can see about you:** the display name you chose, and the
-- courses you and they share. Not your email, not your other courses, not your
-- work.

-- ── Who is allowed in ─────────────────────────────────────────────────────
-- Security definer because it reads auth.users, which no ordinary role may.
-- It takes no argument and interpolates nothing, so there is nothing to inject.

create or replace function public.verified_student()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and lower(u.email) like '%@vanderbilt.edu'
  );
$$;

revoke all on function public.verified_student() from public;
grant execute on function public.verified_student() to authenticated;

-- ── Profiles ──────────────────────────────────────────────────────────────
-- A display name of your choosing. Deliberately not your real name by default
-- and never your email: this row is the one thing about you that strangers in
-- a large lecture can read.

create table if not exists public.profiles (
  user_id     uuid        primary key references auth.users on delete cascade,
  handle      text        not null check (length(trim(handle)) between 2 and 40),
  about       text        not null default '' check (length(about) <= 140),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are yours to write" on public.profiles;
create policy "profiles are yours to write" on public.profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.verified_student());

-- ── Enrolments ────────────────────────────────────────────────────────────
-- What you have told the app you are taking. `code` is normalised by the
-- client to "ECON 1020" and `term` to "2026FA", because a group is only a
-- group if everybody spells it the same way.

create table if not exists public.enrollments (
  user_id     uuid        not null references auth.users on delete cascade,
  term        text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  code        text        not null check (code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'),
  created_at  timestamptz not null default now(),
  primary key (user_id, term, code)
);

create index if not exists enrollments_by_class on public.enrollments (term, code);

alter table public.enrollments enable row level security;

-- Security definer so that reading one row does not have to consult the policy
-- on the same table, which would recurse.
create or replace function public.classmate(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.enrollments mine
    join public.enrollments theirs
      on theirs.term = mine.term and theirs.code = mine.code
    where mine.user_id = auth.uid()
      and theirs.user_id = other
  );
$$;

revoke all on function public.classmate(uuid) from public;
grant execute on function public.classmate(uuid) to authenticated;

create or replace function public.in_class(want_term text, want_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.enrollments e
    where e.user_id = auth.uid() and e.term = want_term and e.code = want_code
  );
$$;

revoke all on function public.in_class(text, text) from public;
grant execute on function public.in_class(text, text) to authenticated;

drop policy if exists "join and leave your own classes" on public.enrollments;
create policy "join and leave your own classes" on public.enrollments
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.verified_student());

-- Separate from the policy above so that reading is wider than writing: you
-- see the enrolments of people who share a class with you, and nobody else's.
drop policy if exists "see who shares a class" on public.enrollments;
create policy "see who shares a class" on public.enrollments
  for select
  using (auth.uid() = user_id or public.classmate(user_id));

drop policy if exists "profiles are visible to classmates" on public.profiles;
create policy "profiles are visible to classmates" on public.profiles
  for select
  using (auth.uid() = user_id or public.classmate(user_id));

-- ── Blocking ──────────────────────────────────────────────────────────────
-- Yours alone, and never visible to the person blocked.

create table if not exists public.blocks (
  user_id     uuid        not null references auth.users on delete cascade,
  blocked     uuid        not null references auth.users on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, blocked),
  constraint no_self_block check (user_id <> blocked)
);

alter table public.blocks enable row level security;

drop policy if exists "blocks are yours alone" on public.blocks;
create policy "blocks are yours alone" on public.blocks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Messages ──────────────────────────────────────────────────────────────
-- One room per class per term. No editing: a message someone acted on should
-- not be able to change out from under them, and an edit history is a bigger
-- feature than it looks. Deleting your own is allowed.

create table if not exists public.messages (
  id          uuid        primary key default gen_random_uuid(),
  term        text        not null,
  code        text        not null,
  user_id     uuid        not null references auth.users on delete cascade,
  body        text        not null check (length(trim(body)) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index if not exists messages_by_room on public.messages (term, code, created_at desc);

alter table public.messages enable row level security;

-- Reading is gated three ways: you are verified, you are in that class, and
-- the sender is not somebody you have blocked. The last one is here rather
-- than in the client so a blocked person's words never reach the device.
drop policy if exists "read your classes" on public.messages;
create policy "read your classes" on public.messages
  for select
  using (
    public.verified_student()
    and public.in_class(term, code)
    and not exists (
      select 1 from public.blocks b
      where b.user_id = auth.uid() and b.blocked = messages.user_id
    )
  );

drop policy if exists "post to your classes as yourself" on public.messages;
create policy "post to your classes as yourself" on public.messages
  for insert
  with check (
    auth.uid() = user_id
    and public.verified_student()
    and public.in_class(term, code)
  );

drop policy if exists "delete your own messages" on public.messages;
create policy "delete your own messages" on public.messages
  for delete
  using (auth.uid() = user_id);

-- ── Reports ───────────────────────────────────────────────────────────────
-- Write-only from the app. Nobody reads these through the API; whoever runs
-- this instance reads them in the dashboard with the service role. The app is
-- careful not to promise that anyone is watching.

create table if not exists public.reports (
  id          uuid        primary key default gen_random_uuid(),
  reporter    uuid        not null references auth.users on delete cascade,
  message_id  uuid        references public.messages on delete set null,
  about       uuid        references auth.users on delete set null,
  reason      text        not null check (length(trim(reason)) between 1 and 500),
  -- Kept because a report about a deleted message is otherwise unreadable.
  copy        text        not null default '',
  created_at  timestamptz not null default now()
);

alter table public.reports enable row level security;

drop policy if exists "anyone verified may report" on public.reports;
create policy "anyone verified may report" on public.reports
  for insert
  with check (auth.uid() = reporter and public.verified_student());

-- No select policy at all, which means no client can read this table.

-- ── Keeping updated_at honest ─────────────────────────────────────────────

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before insert or update on public.profiles
  for each row execute function public.touch_updated_at();

-- ── Live updates ──────────────────────────────────────────────────────────
-- Realtime respects row-level security, so a subscriber is sent only the rows
-- the select policy above would have given them anyway.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end
$$;
