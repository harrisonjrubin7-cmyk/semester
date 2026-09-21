-- Two performance findings, and neither changes who can see what.
--
-- ── 1. `auth.uid()` was being re-evaluated per row ────────────────────────
--
-- `auth.uid()` reads a GUC and is STABLE, but written bare in a policy the
-- planner treats it as a per-row expression: scan a thousand rows and it runs
-- a thousand times. Wrapped in `(select ...)` it becomes an InitPlan —
-- evaluated once, before the scan, and compared as a constant.
--
-- The rewrite is mechanical and the truth value is identical for every row,
-- because the thing being hoisted does not depend on the row.
--
-- ── 2. Two permissive policies covering the same SELECT ───────────────────
--
-- `enrollments` and `profiles` each carried an ALL policy and a SELECT
-- policy. Permissive policies are ORed, so on SELECT both ran:
--
--     (uid = user_id) OR (uid = user_id OR classmate(user_id))
--
-- whose left side is contained in its right. The ALL policy contributed
-- nothing to SELECT and cost a second evaluation of every row — including,
-- on `profiles`, a second call into `classmate`.
--
-- So the ALL policies are split into the three commands they were actually
-- for, and SELECT is left to the policy that was already deciding it. The
-- resulting permission set is the same expression, evaluated once.

-- ── blocks ────────────────────────────────────────────────────────────────
drop policy if exists "blocks are yours alone" on public.blocks;
create policy "blocks are yours alone" on public.blocks
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── courses ───────────────────────────────────────────────────────────────
drop policy if exists "courses are private" on public.courses;
create policy "courses are private" on public.courses
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── state ─────────────────────────────────────────────────────────────────
drop policy if exists "state is private" on public.state;
create policy "state is private" on public.state
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── usage ─────────────────────────────────────────────────────────────────
drop policy if exists "usage is readable by its owner" on public.usage;
create policy "usage is readable by its owner" on public.usage
  for select
  using ((select auth.uid()) = user_id);

-- ── push_devices / push_queue ─────────────────────────────────────────────
drop policy if exists "own devices" on public.push_devices;
create policy "own devices" on public.push_devices
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own queue" on public.push_queue;
create policy "own queue" on public.push_queue
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ── enrollments: the ALL policy split away from SELECT ────────────────────
drop policy if exists "join and leave your own classes" on public.enrollments;

create policy "join your own classes" on public.enrollments
  for insert
  with check ((select auth.uid()) = user_id and private.verified_student());

create policy "change your own enrollment" on public.enrollments
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and private.verified_student());

create policy "leave your own classes" on public.enrollments
  for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "see who shares a class" on public.enrollments;
create policy "see who shares a class" on public.enrollments
  for select
  using ((select auth.uid()) = user_id or private.classmate(user_id));

-- ── profiles: the same split ──────────────────────────────────────────────
drop policy if exists "profiles are yours to write" on public.profiles;

create policy "create your own profile" on public.profiles
  for insert
  with check ((select auth.uid()) = user_id and private.verified_student());

create policy "edit your own profile" on public.profiles
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and private.verified_student());

create policy "delete your own profile" on public.profiles
  for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "profiles are visible to classmates" on public.profiles;
create policy "profiles are visible to classmates" on public.profiles
  for select
  using ((select auth.uid()) = user_id or private.classmate(user_id));

-- ── messages ──────────────────────────────────────────────────────────────
drop policy if exists "read your classes" on public.messages;
create policy "read your classes" on public.messages
  for select
  using (
    private.verified_student()
    and private.in_class(term, code)
    -- The block list is the reader's own, so it does not depend on the row
    -- being read either — the whole NOT EXISTS hoists with the uid.
    and not exists (
      select 1 from public.blocks b
      where b.user_id = (select auth.uid()) and b.blocked = messages.user_id
    )
  );

drop policy if exists "post to your classes as yourself" on public.messages;
create policy "post to your classes as yourself" on public.messages
  for insert
  with check (
    (select auth.uid()) = user_id
    and private.verified_student()
    and private.in_class(term, code)
  );

drop policy if exists "delete your own messages" on public.messages;
create policy "delete your own messages" on public.messages
  for delete
  using ((select auth.uid()) = user_id);

-- ── reports ───────────────────────────────────────────────────────────────
drop policy if exists "anyone verified may report" on public.reports;
create policy "anyone verified may report" on public.reports
  for insert
  with check ((select auth.uid()) = reporter and private.verified_student());