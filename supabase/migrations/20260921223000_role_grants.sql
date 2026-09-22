-- Semester — a role somebody holds, over something, granted by somebody.
--
-- The first of the four foundations `docs/ROLE_REQUIREMENTS.md` puts before
-- every other item in it: items 239 and 300, the grant row and the predicate
-- that reads it.
--
-- ## Why this is a table and not a column
--
-- `profiles.account_role` already exists and is not this. The distinction is
-- written down twice on this project — in `20260921161500_roles.sql`, which
-- created it, and in `20260921211500_pin_profile_school.sql`, which had to
-- decide whether to take the client's write privilege away and deliberately
-- did not:
--
--     `account_role` … is what an account *says* it is — chosen at sign-up,
--     writable by its owner, and it decides nothing about authorization; it
--     picks which dashboard the app draws. Every value it can hold is one
--     anybody may give themselves.
--
-- That is the correct decision for that column and it is also the reason it
-- can never carry a role that grants anything. A permission its subject can
-- write is not a permission. So this table is the other half of that sentence,
-- for the nineteen roles that are not `student`:
--
--   * one row per role held, so a person can hold several at once — the shape
--     item 239 asks for, which a single `text` column cannot express however
--     many values its `check` allows
--   * scoped, because `ORGANIZATION_ADMIN` is always admin *of a particular
--     organization* and `FACULTY` is faculty *of particular courses*. Only
--     `platform_admin` and `moderator` are genuinely global
--   * with a provenance, because item 246, 250, 251, 274 and 286 all require
--     that the access be *institutionally authorized*, and that is
--     unenforceable unless the row records who said so
--   * written by nobody through the API, which is the whole point and is
--     enforced twice below
--
-- ## What this file is not
--
-- It is not the permission matrix. Item 299 maps capabilities
-- (`event:create`, `member:manage`) onto roles, and that mapping is a later
-- migration with its own argument. This answers one narrower question — does
-- this person hold this role over this thing, right now — and a capability
-- check is built *on* that answer rather than instead of it.
--
-- It also grants nobody anything. There is no path in this file by which a
-- role comes to exist; the table arrives empty and stays empty until either
-- the service key writes a row or a later migration adds the one self-service
-- route item 254 needs (`tutor`, and nothing else, because a tutor is a
-- student who opted in and a professor is not).

-- ── The vocabulary ────────────────────────────────────────────────────────
--
-- Item 239's twenty, lowercased, and deliberately *not* the six in
-- `app/src/lib/role.ts` or `packages/institution`'s `UNIVERSITY_ROLES`.
-- `docs/ROLE_REQUIREMENTS.md` records why those two and `account_role`
-- disagree with each other; this is the list that decides authorization, and
-- reconciling the other three against it is item 239's remaining work rather
-- than something to do quietly here.
--
-- `student` is on the list even though every account is one. A grant row for
-- it is what an institution asserting *this person is enrolled* looks like —
-- which is what item 269's "valid student verification required" and item
-- 293's verification both need, and is a different fact from an account
-- having typed `student` into its own profile.

create table if not exists public.role_grants (
  id           uuid        primary key default gen_random_uuid(),
  -- Who holds it.
  subject      uuid        not null references auth.users on delete cascade,
  role         text        not null check (role in (
                             'prospective_student', 'undergraduate_student',
                             'graduate_student', 'transfer_student', 'alumni',
                             'faculty', 'teaching_assistant', 'academic_advisor',
                             'tutor',
                             'organization_member', 'organization_officer',
                             'organization_admin',
                             'employer', 'business_admin',
                             'university_staff', 'department_admin',
                             'university_admin',
                             'moderator', 'platform_admin',
                             'student')),
  -- What it is held over.
  scope_kind   text        not null check (scope_kind in (
                             'platform', 'organization', 'course', 'department',
                             'office', 'residence', 'business', 'employer')),
  -- Empty exactly when the scope is the platform itself. Text rather than uuid
  -- because a course is identified here by `school/CODE` — see `public.groups`,
  -- whose `code` column is the same shape — and an organization will be a uuid.
  -- One column that holds both is the cost of not having an organization table
  -- yet; when there is one this becomes a uuid and a `scope_kind` check.
  scope_id     text        not null default '' check (length(scope_id) <= 200),
  -- Who says so. `self` is a preference, `institution` is a launch or an SIS,
  -- `platform` is Semester's own staff. Item 254's verification is the
  -- difference between the first and the other two.
  provenance   text        not null check (provenance in ('self', 'institution', 'platform')),
  -- Null for `institution` and `platform`, where the grantor is a system
  -- rather than an account, and on delete set null so removing a member of
  -- staff does not remove the grants they made.
  granted_by   uuid        references auth.users on delete set null,
  granted_at   timestamptz not null default now(),
  -- Null means no expiry. A role an institution asserts should usually have
  -- one — a teaching assistant is a TA for a term.
  expires_at   timestamptz,
  revoked_at   timestamptz,

  -- A platform role is scoped to nothing and everything else is scoped to
  -- something. Written as one equivalence rather than two checks so it cannot
  -- be half-true: a `platform_admin` row with an organization id in it, or an
  -- `organization_admin` row with none, are both nonsense and both refused.
  constraint role_grants_scope_matches_kind
    check ((scope_kind = 'platform') = (scope_id = '')),

  -- One row per role per scope. Re-granting is an update to that row —
  -- clearing `revoked_at` — rather than a second row that has to be sorted by
  -- date to be read, which is the shape a predicate can get wrong.
  constraint role_grants_one_per_scope unique (subject, role, scope_kind, scope_id)
);

alter table public.role_grants enable row level security;

-- ── Which indexes, and why exactly these two ──────────────────────────────
--
-- `indexes.check.sql` asks two questions of every table and this file answers
-- both deliberately, because main went red on each of them today.
--
-- Every foreign key needs a covering index, where covering means the key's
-- columns are a *prefix* of the index's. `subject` is covered by
-- `role_grants_one_per_scope`, which leads with it — so a separate index on
-- `(subject)` would be dead weight. `granted_by` is covered by nothing and
-- gets the one index below.
--
-- The second index is the read the role switcher of item 240 does not do:
-- "who holds this role over this thing" is the organization-admin and
-- faculty-roster query, and it leads with `role` because `scope_id` alone is
-- never the question.
create index if not exists role_grants_by_grantor on public.role_grants (granted_by);
create index if not exists role_grants_by_role on public.role_grants (role, scope_kind, scope_id);

comment on table public.role_grants is
  'Which roles somebody holds, over what, and who said so. Written only by the service key; read by private.holds_role().';

-- ── Nobody writes this through the API ────────────────────────────────────
--
-- Two locks, and the order matters. Supabase's default privileges grant ALL on
-- every new table in `public` to `anon` and `authenticated` — that is not a
-- theoretical default, it is what left `anon` holding DELETE on
-- `published_forms` on the live project — so a new table is writable by every
-- visitor until a revoke says otherwise. The revoke is the outer lock.
--
-- The inner lock is that there is no insert, update or delete policy at all.
-- Row-level security with no permissive policy refuses everything, so if a
-- later migration hands the grants back by accident, the table is still
-- closed. `app_admins` is built the same way and `admins.check.sql` says why:
-- a door with two locks is a door you cannot tell is unlocked by trying the
-- handle, so each is tested with the other taken out of the way.
revoke all on table public.role_grants from anon, authenticated;

-- SELECT is the exception, and only through a policy that narrows it to the
-- rows about you. Item 240's context switcher is a view of these rows — a
-- person has to be able to see that they are an officer of the Finance Club,
-- or the app cannot offer to switch to it. `authenticated` only: `anon` has no
-- `auth.uid()`, so the policy would return nothing anyway, and a grant that
-- cannot return a row is a grant worth not making.
grant select on table public.role_grants to authenticated;

create policy "your roles are yours to see" on public.role_grants
  for select
  to authenticated
  using (subject = (select auth.uid()));

-- ── The predicate ─────────────────────────────────────────────────────────
--
-- One question, one boolean, no partial results. The phrasing is taken from
-- `allowsFamilyRequest` in `packages/institution`, whose comment is the reason:
-- "an authorization that can be half-computed is one a caller can use half
-- of."
--
-- `private` rather than `public`, for the reason `private.is_app_admin()` is
-- there: PostgREST publishes every function in `public` that `anon` or
-- `authenticated` may execute, so a `public.holds_role()` would be a URL
-- answering "is this person a moderator" — and `grants.check.sql` would fail
-- on it until somebody added it to the allowlist, which is the belt to this
-- brace. It exists to be read by policies, which is server-side by
-- construction.
--
-- `security definer` because the select policy above narrows the table to the
-- caller's own rows, and a predicate that could only see those could not
-- answer the question an organization's policy needs to ask. `set search_path
-- = ''` because a definer function that resolves names through the caller's
-- path is a definer function the caller chooses the meaning of.
--
-- Live only: a revoked grant and an expired grant are both absent, and that
-- has to be in the predicate rather than at the call sites, because the call
-- site that forgets is the one nobody finds.
create or replace function private.holds_role(
  want_role       text,
  want_scope_kind text default 'platform',
  want_scope_id   text default ''
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.role_grants g
     where g.subject = (select auth.uid())
       and g.role = want_role
       and g.scope_kind = want_scope_kind
       and g.scope_id = want_scope_id
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
  );
$$;

revoke all on function private.holds_role(text, text, text) from public;
grant execute on function private.holds_role(text, text, text) to anon, authenticated;

comment on function private.holds_role(text, text, text) is
  'Whether the caller holds this role over this scope right now. For policies to read; deliberately not reachable from a client.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
-- Safe at any point. Nothing above touches an existing table, an existing
-- column or an existing row: it adds one table, two indexes, one policy and
-- one function, and the table arrives empty.
--
--   begin;
--   drop function if exists private.holds_role(text, text, text);
--   drop table if exists public.role_grants;
--   commit;
