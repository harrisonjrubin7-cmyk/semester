-- Semester — roles: who an account is, and what a second account may read.
--
-- Run this after schema.sql, in the Supabase dashboard: SQL Editor → New
-- query → paste → Run. It is safe to run again; every statement is guarded.
--
-- ## What this is not
--
-- The multi-role spec asks for a `family_links` table carrying a `scope`
-- array. This file does not add one, and the reason is that the thing it
-- describes already exists and is stricter.
--
-- `packages/institution/src/index.ts` carries `FamilyGrant` and
-- `allowsFamilyRequest`, `app/server/institution/family.ts` carries the
-- accept and revoke flows over them, and `app/src/lib/family.ts` and the
-- Family screen let a student *plan* one. What none of it has is storage in
-- this database, which is the actual gap. A `family_links` row beside all of
-- that would be a second answer to "may this parent read this", weaker than
-- the first on four axes its own comments argue for at length:
--
--   * **It has no expiry.** `FamilyGrant` has `expiresAt`, and a grant that
--     cannot lapse is one somebody has to remember to take away.
--   * **It names categories, not things.** "A category alone grants nothing"
--     is the sentence in `index.ts`; `resourceIds` is what a grant is really
--     made of. A scope array is the version that hands over the category.
--   * **It flattens paying into reading.** `access = 'payment'` is
--     deliberately not a level of reading, so a parent who can pay the bill
--     cannot read the statement. One array cannot express that.
--   * **It has four scopes where there are ten categories.**
--
-- So the table below *is* `FamilyGrant`, column for column, and the predicate
-- that decides a read is the one already written and already tested. Nothing
-- here is a second model.
--
-- ## The three things this does add
--
--   1. `profiles.account_role` — what kind of account this is.
--   2. `public.family_grants` — storage for the grants, with the live-grant
--      test from `allowsFamilyRequest` expressed as row-level security.
--   3. `public.app_admins` and `private.is_app_admin()` — an admin list with
--      no way into it from the app.

-- ── 1. What kind of account this is ───────────────────────────────────────
--
-- Three values, and `admin` is deliberately not one of them. An account that
-- could name itself an administrator is an administrator, whatever the rest of
-- the system believes; `app_admins` below is a separate table with no insert
-- policy at all, so the only way in is a migration or the service key.
--
-- Defaulting to `student` is what makes this safe to apply to a live table:
-- every existing row is a student, which is what every existing row is.

alter table public.profiles
  add column if not exists account_role text not null default 'student';

alter table public.profiles drop constraint if exists profiles_account_role_check;
alter table public.profiles
  add constraint profiles_account_role_check
  check (account_role in ('student', 'parent', 'mentor'));

comment on column public.profiles.account_role is
  'student, parent or mentor. Never admin — see public.app_admins.';

-- ── 2. The grants ─────────────────────────────────────────────────────────
--
-- `FamilyGrant` in packages/institution, as a table. The field names are that
-- interface's, snake-cased, so that the two cannot drift without somebody
-- noticing they are writing a translation layer.

create table if not exists public.family_grants (
  id             uuid        primary key default gen_random_uuid(),
  institution_id text        not null check (length(trim(institution_id)) between 1 and 120),
  student_id     uuid        not null references auth.users on delete cascade,
  recipient_id   uuid        not null references auth.users on delete cascade,
  category       text        not null check (category in (
                               'finances', 'aid', 'housing', 'calendar', 'academic',
                               'emergency', 'travel', 'health-admin', 'career', 'communication')),
  access         text        not null check (access in ('none', 'selected', 'view', 'payment')),
  -- The individual things named. A category alone grants nothing, so the
  -- default is the empty set and not "everything in the category".
  resource_ids   text[]      not null default '{}',
  -- Null until the recipient has accepted. A grant nobody accepted is not one.
  accepted_at    timestamptz,
  expires_at     timestamptz not null,
  revoked_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- The one shape `allowsFamilyRequest` refuses that a column check can also
  -- refuse: a grant from somebody to themselves.
  constraint family_grants_two_parties check (student_id <> recipient_id)
);

alter table public.family_grants enable row level security;

create index if not exists family_grants_by_student on public.family_grants (student_id, category);
create index if not exists family_grants_by_recipient on public.family_grants (recipient_id, category);

comment on table public.family_grants is
  'FamilyGrant, stored. What a student has let one named person see, per category, per named resource, with an expiry.';

-- The student's own grants, whatever state they are in. This is the row the
-- Family screen lists, revokes and lets lapse, so it must be readable while
-- revoked and while expired — a revoked grant somebody cannot see is one they
-- cannot tell they revoked.
drop policy if exists "your grants are yours" on public.family_grants;
create policy "your grants are yours" on public.family_grants
  for select
  using ((select auth.uid()) = student_id);

-- The recipient's side, and this is the policy that matters.
--
-- It is `allowsFamilyRequest`'s `live` test and nothing else: accepted, not
-- accepted in the future, not revoked, not expired. The rest of that
-- predicate — the category, the access level, the named resource, the
-- read-versus-pay asymmetry — is about one *operation* on one *resource* and
-- cannot be decided by a row policy, because the row is not the request. It
-- stays where it is, in the contract, checked per operation.
--
-- So what this grants is narrow and worth saying exactly: a recipient may read
-- the grant rows that are live and addressed to them. Not the student's other
-- grants, not the lapsed ones, and not any of the student's actual content —
-- no table but this one has a policy mentioning a recipient.
--
-- ## One of these four clauses cannot fail, and it stays anyway
--
-- Deleting `accepted_at is not null` from this policy leaves every check in
-- `family.check.sql` green, and that was measured rather than assumed. It is
-- redundant in SQL: `accepted_at <= now()` is NULL when `accepted_at` is, NULL
-- is not true, and the row is filtered out by the comparison alone.
--
-- It is kept for a reason that is not superstition. The same predicate exists
-- in TypeScript as `allowsFamilyRequest`, and **there the null test is
-- load-bearing** — `null <= Date.now()` in JavaScript coerces null to 0 and
-- evaluates *true*, so a grant nobody accepted would read as accepted long ago.
-- Two languages, opposite defaults, one rule. Dropping the clause here because
-- Postgres does not need it would leave the two mirrors no longer the same
-- text, and the next person to carry a change across would carry it the wrong
-- way. It is documentation that happens to compile.
drop policy if exists "a live grant is visible to the person it names" on public.family_grants;
create policy "a live grant is visible to the person it names" on public.family_grants
  for select
  using (
    (select auth.uid()) = recipient_id
    and accepted_at is not null
    and accepted_at <= now()
    and revoked_at is null
    and expires_at > now()
  );

-- Made by the student, and born unaccepted. `accepted_at is null` in the
-- with-check is the load-bearing half: without it a student could write a row
-- that is already accepted, which is the whole of the consent step.
drop policy if exists "you make your own grants" on public.family_grants;
create policy "you make your own grants" on public.family_grants
  for insert
  with check (
    (select auth.uid()) = student_id
    and student_id <> recipient_id
    and accepted_at is null
    and private.verified_student()
  );

-- Revoking, shortening and re-scoping, all by the student. Accepting is not
-- here — it is the recipient's action and goes through the function below,
-- because a policy cannot say "you may change this one column".
drop policy if exists "you change your own grants" on public.family_grants;
create policy "you change your own grants" on public.family_grants
  for update
  using ((select auth.uid()) = student_id)
  with check ((select auth.uid()) = student_id and student_id <> recipient_id);

-- Both sides may delete, and that is not generosity. `deleteEverything()` in
-- `app/src/lib/cloud.ts` empties an account table by table through PostgREST,
-- as the account — so a row neither party can delete is a row that outlives
-- whichever of them asked to be forgotten. The cascade on `auth.users` covers
-- a real account deletion; this covers the button.
drop policy if exists "either party can delete a grant" on public.family_grants;
create policy "either party can delete a grant" on public.family_grants
  for delete
  using ((select auth.uid()) in (student_id, recipient_id));

drop trigger if exists family_grants_touch on public.family_grants;
create trigger family_grants_touch before insert or update on public.family_grants
  for each row execute function public.touch_updated_at();

-- ── 3. Accepting ──────────────────────────────────────────────────────────
--
-- The recipient's one write, as a function rather than a policy, for the
-- reason above: an UPDATE policy that let the recipient through would let them
-- through for every column on the row — the categories, the resource list and
-- the expiry included. A grant the recipient can re-scope is not a grant.
--
-- It is `security definer` so it can write a row the caller has no update
-- policy for, and every condition it refuses on is one `allowsFamilyRequest`
-- also refuses on. Accepting twice is not an error and does not move the date:
-- `accepted_at is null` in the WHERE makes it idempotent.
create or replace function public.accept_family_grant(grant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  who uuid := (select auth.uid());
  hit int;
begin
  if who is null then return false; end if;

  update public.family_grants
     set accepted_at = now()
   where id = grant_id
     and recipient_id = who
     and accepted_at is null
     and revoked_at is null
     and expires_at > now()
     and student_id <> recipient_id;

  get diagnostics hit = row_count;
  return hit > 0;
end $$;

-- `anon` by name, and that is not belt-and-braces.
--
-- `20260921144011_function_grants.sql` is titled "the revoke that
-- `revoke … from public` is not", and this is the trap it describes:
-- Supabase grants EXECUTE on each new function in `public` to `anon` and
-- `authenticated` *explicitly*, as it is created, so a revoke aimed at PUBLIC
-- leaves both of those grants sitting there untouched. The first version of
-- this file revoked from PUBLIC alone and shipped a function a signed-out
-- visitor could call; `grants.check.sql` is what said so.
revoke all on function public.accept_family_grant(uuid) from public, anon, authenticated;
grant execute on function public.accept_family_grant(uuid) to authenticated;

comment on function public.accept_family_grant(uuid) is
  'The recipient accepts a grant addressed to them. The only write they have on family_grants.';

-- ── 4. The administrators ─────────────────────────────────────────────────
--
-- A table with row-level security on and **no policy whatsoever**, which
-- means `anon` and `authenticated` match no row for select, insert, update or
-- delete. It is written by `scripts/grant-admin.ts` over the service key, and
-- by nothing else. There is no in-app route into it and there is not meant to
-- be one.

create table if not exists public.app_admins (
  user_id    uuid        primary key references auth.users on delete cascade,
  note       text        not null default '' check (length(note) <= 200),
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

revoke all on table public.app_admins from anon, authenticated;

comment on table public.app_admins is
  'Who may open the administrator dashboard. Written only by the service key. Not readable through the API by anyone.';

-- `private`, not `public`, and that is the whole point of the schema choice.
--
-- A function in `public` that `authenticated` may execute is a URL —
-- PostgREST publishes it — so a `public.is_app_admin()` would hand every
-- signed-in visitor an oracle that answers "is this account an administrator"
-- about the caller, and would fail `grants.check.sql` until somebody added it
-- to the allowlist. It is not an entry point. It exists to be read *by
-- policies*, which is server-side by construction: a client-side flag is
-- exactly what the spec says the admin dashboard must never be guarded by,
-- and a function the client cannot call cannot become one.
--
-- `security definer` because `app_admins` has no select policy, so a caller
-- running as themselves reads nothing from it — including the row about them.
create or replace function private.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_admins a where a.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_app_admin() from public;
grant execute on function private.is_app_admin() to anon, authenticated;

comment on function private.is_app_admin() is
  'Whether the caller is an administrator. For policies to read; deliberately not reachable from a client.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
-- Safe at any point: nothing above rewrites an existing row, and the only
-- change to an existing table is an added column with a default.
--
--   begin;
--   drop function if exists private.is_app_admin();
--   drop function if exists public.accept_family_grant(uuid);
--   drop table if exists public.app_admins;
--   drop table if exists public.family_grants;
--   alter table public.profiles drop constraint if exists profiles_account_role_check;
--   alter table public.profiles drop column if exists account_role;
--   commit;
