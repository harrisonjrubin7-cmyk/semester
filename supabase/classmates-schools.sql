-- ═══════════════════════════════════════════════════════════════════════════
-- Classmates, for any university
--
-- Run once against the project that already has classmates.sql applied. It is
-- idempotent: every statement is written so a second run is a no-op.
--
-- ── What is wrong today ───────────────────────────────────────────────────
--
-- `verified_student()` requires an address ending `@vanderbilt.edu`. That is a
-- per-school check in a row-level-security policy, which means every student
-- at every other university is refused the feature outright — not shown less
-- of it, refused it. The ground rules for school support say never to restrict
-- by email domain, and this is the only place in the project that does.
--
-- ── What replaces it, and what that costs ─────────────────────────────────
--
-- The server checks that the address is *confirmed*, and stops there. It no
-- longer asks which university it belongs to.
--
-- Be clear about what that gives up: today a Vanderbilt student knows everyone
-- in a room holds a vanderbilt.edu mailbox, and after this they do not. The
-- client still applies the domain check where the school profile lists domains
-- — Vanderbilt's lists vanderbilt.edu, so the experience is unchanged for
-- somebody using the app normally — but a client check is not security, and
-- this file has always said the policies are the security.
--
-- Restoring server-side strength for every school needs the `schools` table
-- from Phase 2 and a `school_id` on `profiles`, so the policy can compare an
-- address against that school's domains. That is a bigger change than this,
-- and it is the right place to put the strength back. Until then the honest
-- position is the one the screen now states: a room is people who *say* they
-- are in the class, and a confirmed address proves a mailbox and nothing else.
--
-- ── Rooms get a school ────────────────────────────────────────────────────
--
-- `code` was "ECON 1020". Unambiguous only because one university could reach
-- the feature at all. With the gate gone, four campuses' ECON 1020 would be
-- one conversation, so the key becomes "<school>/ECON 1020" and the check
-- constraint widens to allow the prefix.
--
-- Existing rows are migrated to the `vanderbilt/` prefix rather than deleted.
-- Every row that exists was written under the old policy, so every one of them
-- is a Vanderbilt row by construction — this is a rename, not a guess.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. The eligibility check ──────────────────────────────────────────────
-- Confirmed, not Vanderbilt.

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
  );
$$;

revoke all on function public.verified_student() from public;
grant execute on function public.verified_student() to authenticated;

-- ── 2. Widen the room key ─────────────────────────────────────────────────
-- The constraint has to come off before the data can be rewritten, or the
-- update fails on its own first row.

alter table public.enrollments drop constraint if exists enrollments_code_check;

-- ── 3. Move existing rooms under their school ─────────────────────────────
-- Only rows that have no prefix yet, so a second run changes nothing.

update public.enrollments
   set code = 'vanderbilt/' || code
 where code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$';

update public.messages
   set code = 'vanderbilt/' || code
 where code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$';

-- ── 4. Put the constraint back, in its new shape ──────────────────────────
-- A school id is the slug the client generates: lower case, digits, hyphens.
-- The course part is unchanged, so a malformed code is still refused.

alter table public.enrollments
  add constraint enrollments_code_check
  check (code ~ '^[a-z0-9][a-z0-9-]{0,60}/[A-Z]{2,4} [0-9]{3,4}[A-Z]?$');

-- The index is on (term, code) and the values got longer; rebuilding keeps it
-- honest about its own statistics rather than leaving them describing the old
-- distribution.
reindex index enrollments_by_class;
reindex index messages_by_room;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
-- Only useful before anybody outside Vanderbilt has joined a room. After that,
-- the `where` clause below would strip the prefix off other schools' rows and
-- merge them into Vanderbilt's, which is worse than leaving this applied.
--
--   begin;
--   alter table public.enrollments drop constraint if exists enrollments_code_check;
--   update public.enrollments set code = substring(code from position('/' in code) + 1)
--    where code like 'vanderbilt/%';
--   update public.messages set code = substring(code from position('/' in code) + 1)
--    where code like 'vanderbilt/%';
--   alter table public.enrollments
--     add constraint enrollments_code_check
--     check (code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$');
--   create or replace function public.verified_student()
--   returns boolean language sql stable security definer
--   set search_path = public, auth as $$
--     select exists (
--       select 1 from auth.users u
--       where u.id = auth.uid() and u.email_confirmed_at is not null
--         and lower(u.email) like '%@vanderbilt.edu');
--   $$;
--   commit;
-- ═══════════════════════════════════════════════════════════════════════════
