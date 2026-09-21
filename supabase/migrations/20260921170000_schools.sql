-- ═══════════════════════════════════════════════════════════════════════════
-- Schools, and a membership the server can check
--
-- Run once. Idempotent: every statement is written so a second run is a no-op.
--
-- ── The debt this pays ────────────────────────────────────────────────────
--
-- `20260901000300_classmates_schools.sql` took the Vanderbilt domain check out
-- of `verified_student()`, because a per-school test inside a row-level
-- security policy refused every student at every other university outright.
-- That was right, and it said plainly what it cost:
--
--   "today a Vanderbilt student knows everyone in a room holds a
--    vanderbilt.edu mailbox, and after this they do not. The client still
--    applies the domain check where the school profile lists domains … but a
--    client check is not security, and this file has always said the policies
--    are the security."
--
-- And it named the fix:
--
--   "Restoring server-side strength for every school needs the `schools`
--    table from Phase 2 and a `school_id` on `profiles`, so the policy can
--    compare an address against that school's domains. That is a bigger
--    change than this, and it is the right place to put the strength back."
--
-- This is that table and that column. It does not itself re-tighten any
-- existing policy — see the last section for why that is a separate change
-- and not an omission.
--
-- ── Why the id is a slug and not a uuid ───────────────────────────────────
--
-- Because one already exists and is load-bearing. A room key is
-- "vanderbilt/ECON 1020"; `enrollments.code` and `messages.code` hold that
-- string, `roomKey()` in `lib/classmates.ts` builds it, and the client derives
-- the prefix from the school profile's own id. A uuid here would mean a
-- second identifier for the same thing and a join to translate between them,
-- and the first time the two disagreed every room in that school would go
-- quiet with nothing reporting why.

-- ── The schools ───────────────────────────────────────────────────────────

create table if not exists public.schools (
  -- The slug the client already generates: lower case, digits, hyphens.
  id            text        primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name          text        not null check (length(trim(name)) between 2 and 120),
  short_name    text        not null default '' check (length(short_name) <= 60),
  -- The addresses this university publishes as its own, lower case, no '@'.
  -- Empty is allowed and means "nobody can claim this one yet", which is a
  -- better state than a wrong domain: it refuses everybody rather than
  -- admitting the wrong body.
  email_domains text[]      not null default '{}',
  created_at    timestamptz not null default now()
);

alter table public.schools enable row level security;

-- A list of universities is not private, and every client needs it before
-- anybody has signed in — it is what the picker reads.
drop policy if exists schools_read on public.schools;
create policy schools_read on public.schools
  for select using (true);

-- Writing is an admin act. Not because a student cannot be trusted with a row,
-- but because `email_domains` is the whole of the check below: anyone who can
-- write it can admit anyone. `private.is_app_admin()` is from roles.sql.
drop policy if exists schools_write on public.schools;
create policy schools_write on public.schools
  for all using (private.is_app_admin()) with check (private.is_app_admin());

-- No school is seeded here, and that is deliberate. Seeding Vanderbilt would
-- put one university's name in the schema every other university has to live
-- in, which is the thing the multi-campus rule exists to stop. The app's
-- bundled profiles are a client-side matter; this table is about who the
-- server believes belongs where.

-- ── The membership ────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists school_id text references public.schools on delete set null;

create index if not exists profiles_by_school on public.profiles (school_id)
  where school_id is not null;

-- Pinned against a direct write, which is the entire point.
--
-- If a student could `update profiles set school_id = 'vanderbilt'`, this
-- column would be a self-declaration and exactly as strong as the client check
-- it replaces — a longer way of writing down what somebody typed. The only
-- way in is `claim_school()` below, which reads the address the server
-- confirmed rather than the one the row claims.
--
-- A column privilege rather than the `refuse_column_change` trigger the groups
-- table uses, and the difference matters. That trigger is the right tool for a
-- column nothing may ever change; this one has exactly one legitimate writer,
-- and a definer function cannot step over its own trigger without
-- `alter table … disable trigger`, which is DDL, is not session-local, and
-- would open the column to every other connection for as long as it were off.
-- Revoking the privilege closes it to the API roles and leaves it open to the
-- function's owner, which is precisely the split wanted.
revoke update (school_id) on public.profiles from anon, authenticated;

-- ── Claiming one ──────────────────────────────────────────────────────────

/*
 * Set your school, if the address the server confirmed says you may.
 *
 * Security definer so it can read `auth.users` and write past the trigger
 * above, and `volatile` because it writes. It refuses rather than returning
 * false: a claim that silently does nothing is one the screen would report as
 * success, and the whole value of this column is that it cannot be bluffed.
 *
 * The domain is compared case-insensitively on both sides, and taken from the
 * last '@' rather than the first — an address may contain one in a quoted
 * local part, and `split_part(addr, '@', 2)` on `"a@b"@vanderbilt.edu` yields
 * `b"` and matches nothing, which fails closed but for the wrong reason.
 */
create or replace function public.claim_school(want text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  addr   text;
  domain text;
begin
  select u.email into addr
    from auth.users u
   where u.id = (select auth.uid())
     and u.email_confirmed_at is not null;

  if addr is null then
    raise exception 'confirm your address before claiming a school'
      using errcode = 'insufficient_privilege';
  end if;

  domain := lower(substring(addr from '[^@]+$'));

  if not exists (
    select 1
      from public.schools s
     where s.id = want
       and exists (
         select 1 from unnest(s.email_domains) d where lower(d) = domain
       )
  ) then
    raise exception 'that address is not one % publishes', want
      using errcode = 'insufficient_privilege';
  end if;

  update public.profiles
     set school_id = want, updated_at = now()
   where user_id = (select auth.uid());

  return want;
end;
$$;

revoke all on function public.claim_school(text) from public, anon;
grant execute on function public.claim_school(text) to authenticated;

-- ── What a policy can ask, once people have claimed ───────────────────────

create or replace function private.school_of()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.school_id from public.profiles p where p.user_id = (select auth.uid());
$$;

revoke all on function private.school_of() from public;
grant execute on function private.school_of() to anon, authenticated;

/*
 * Whether somebody else is at the same university as you.
 *
 * Null-safe on both sides and deliberately so: two students who have claimed
 * nothing are not thereby classmates. `null = null` is null in SQL, which a
 * policy reads as false — correct here, and worth stating because the obvious
 * reading of the expression is the opposite.
 */
create or replace function private.same_school(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles me, public.profiles them
     where me.user_id = (select auth.uid())
       and them.user_id = other
       and me.school_id is not null
       and me.school_id = them.school_id
  );
$$;

revoke all on function private.same_school(uuid) from public;
grant execute on function private.same_school(uuid) to anon, authenticated;

-- ── What this file does not do ────────────────────────────────────────────
--
-- It does not put the domain check back into `verified_student()`, and that is
-- a sequencing decision rather than an oversight. Every profile has
-- `school_id` null the moment this runs, so a policy that required a claimed
-- school would empty every existing room the instant it was applied — every
-- student refused the feature outright, which is the failure the migration
-- this pays back was written to end.
--
-- The order that works: this lands, an admin adds the schools, the screen
-- offers the claim, and only once a room's members have claimed does
-- tightening its policy refuse strangers rather than everybody. The helpers
-- above are what that change will read; nothing calls them yet, and a guard
-- in `lib/schoolclaim.test.ts` holds the shape they must keep until it does.
