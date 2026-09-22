-- Semester — what a role may do, in one place, and the first two policies to ask.
--
-- The fourth of the four foundations `docs/ROLE_REQUIREMENTS.md` puts before
-- every other item in it, and the one it is most insistent about the order of:
--
--     Splitting `private.is_app_admin()` into named capabilities — before, not
--     after, the moderator queue and the platform dashboard are built against
--     it, because both will otherwise be written to ask a boolean.
--
-- That deadline arrived. `20260921214500_report_status.sql` gave `public.reports`
-- a status and two policies, and both ask `private.is_app_admin()`, because it
-- was the only thing there to ask. Its author said so and deliberately did not
-- build the screen, citing the sentence above. This is the other half.
--
-- ## What is wrong with one boolean, precisely
--
-- `private.is_app_admin()` answers one question for every purpose. Items 294
-- to 301 need at least four different answers: a moderator may act on a report
-- and may not configure a university; a platform admin may set a feature flag
-- and should not read a private note; a superadmin action wants
-- re-authentication; support impersonation wants a reason and a banner. A
-- boolean asked to express those grows into exactly the global `isAdmin` item
-- 239 opens by refusing.
--
-- So a capability is a named thing you may do, a role holds a set of them, and
-- `public.role_grants` says who holds which role over what. The policy asks for
-- the capability and never for the role — which is what lets the matrix change
-- without touching a policy.
--
-- ## Both tables are empty, and that is why this is safe to do now
--
-- Measured on the live project before writing this: `public.app_admins` has 0
-- rows and `public.role_grants` has 0 rows. Nobody is an administrator yet —
-- `#648` is about that — so repointing the two report policies changes what
-- exactly nobody can do, and the moment somebody is granted `moderator` they
-- get a queue that was built for a capability rather than for a flag.
--
-- `app_admins` is not deprecated by this and is not consulted by it. Its own
-- comment says what it is for — "who may open the administrator dashboard" —
-- and that is a narrower job than reading complaints. Whoever adds the first
-- moderator adds a `role_grants` row, not an `app_admins` row.

-- ── 1. One vocabulary of roles, in one place ──────────────────────────────
--
-- `20260921223000_role_grants.sql` spelled the twenty roles as a `check`
-- constraint. A second list of the same twenty in this file would be the fault
-- `counts.ts` was written about — a value repeated in two places is a value
-- that will disagree with itself — so the list becomes a table, both tables
-- point at it, and the check constraint goes.
--
-- Safe because `role_grants` is empty: the foreign key validates against no
-- rows, and it is a strictly stronger statement than the constraint it
-- replaces. A role that is not in `app_roles` cannot be granted and cannot be
-- given a capability, and that is now one fact rather than two.

create table if not exists public.app_roles (
  role text primary key,
  -- Whether a grant of it is scoped to a resource or to the platform. Read by
  -- nothing yet; it is the check item 239 wants and item 300 will enforce, and
  -- recording it here is cheaper than deriving it from twenty special cases.
  global boolean not null default false
);

insert into public.app_roles (role, global) values
  ('prospective_student',    false),
  ('undergraduate_student',  false),
  ('graduate_student',       false),
  ('transfer_student',       false),
  ('alumni',                 false),
  ('student',                false),
  ('faculty',                false),
  ('teaching_assistant',     false),
  ('academic_advisor',       false),
  ('tutor',                  false),
  ('organization_member',    false),
  ('organization_officer',   false),
  ('organization_admin',     false),
  ('employer',               false),
  ('business_admin',         false),
  ('university_staff',       false),
  ('department_admin',       false),
  ('university_admin',       false),
  ('moderator',              true),
  ('platform_admin',         true)
on conflict (role) do nothing;

alter table public.role_grants
  drop constraint if exists role_grants_role_check;

alter table public.role_grants
  drop constraint if exists role_grants_role_fkey;
alter table public.role_grants
  add constraint role_grants_role_fkey
  foreign key (role) references public.app_roles (role);

-- The foreign key needs a covering index and `role_grants_by_role` already is
-- one: `indexes.check.sql` counts a key as covered when its columns are a
-- prefix of the index's, and that index leads with `role`. Adding another would
-- be the dead weight the same suite fails on.

-- ── 2. The capabilities, and what each one means ──────────────────────────
--
-- Item 299's list, with the two it names under `USER` deliberately absent:
-- `profile:read` and `profile:update:self` belong to every account, are already
-- carried by the policies and column grants on `public.profiles`, and putting
-- them here would invent a grant nobody should need and make the predicate
-- below answer false for a thing everybody may do.
--
-- `about` is not decoration. A capability whose meaning lives only in a screen
-- is one the next person guesses at, and the guess is what widens it.

create table if not exists public.app_capabilities (
  capability text primary key,
  about      text not null check (length(trim(about)) between 1 and 300)
);

insert into public.app_capabilities (capability, about) values
  ('organization:read',    'See an organization''s private member information, files and meetings.'),
  ('organization:update',  'Change an organization''s profile and settings.'),
  ('member:manage',        'Admit, remove and promote members of one organization.'),
  ('application:manage',   'Read, comment on and decide applications to one organization.'),
  ('event:create',         'Create an event for one organization.'),
  ('event:update',         'Edit, publish, cancel and check people in to one organization''s events.'),
  ('report:read',          'Read the trust-and-safety report queue.'),
  ('moderation:action',    'Move a report along, and take the actions item 296 lists.'),
  ('platform:configure',   'Change Semester''s own configuration: universities, feature flags, integrations.')
on conflict (capability) do nothing;

-- ── 3. The matrix ─────────────────────────────────────────────────────────
--
-- Sets, not tiers, and the reason is `allowsFamilyRequest` in
-- `packages/institution`: its `payment` level lets a payer pay and read
-- nothing, so the four are deliberately not an ordinal scale. The same applies
-- here and item 256 is explicit about it — a treasurer sees finances and does
-- not admit members; requiring every officer to hold what an admin holds is the
-- thing that item refuses. `organization_officer` is therefore a subset of
-- `organization_admin` by what is listed, not by being one rung below it.
--
-- `platform_admin` does **not** hold every capability. It holds three, and
-- extending it is a row somebody adds deliberately. A role that implicitly held
-- everything would be the boolean again with a longer name.

create table if not exists public.role_capabilities (
  role       text not null references public.app_roles (role) on delete cascade,
  capability text not null references public.app_capabilities (capability) on delete cascade,
  primary key (role, capability)
);

-- The primary key leads with `role`, so it covers that foreign key. `capability`
-- is covered by nothing, and this is the index for it.
create index if not exists role_capabilities_by_capability
  on public.role_capabilities (capability);

insert into public.role_capabilities (role, capability) values
  ('organization_member',  'organization:read'),

  ('organization_officer', 'organization:read'),
  ('organization_officer', 'event:create'),
  ('organization_officer', 'event:update'),

  ('organization_admin',   'organization:read'),
  ('organization_admin',   'organization:update'),
  ('organization_admin',   'member:manage'),
  ('organization_admin',   'application:manage'),
  ('organization_admin',   'event:create'),
  ('organization_admin',   'event:update'),

  ('moderator',            'report:read'),
  ('moderator',            'moderation:action'),

  ('platform_admin',       'report:read'),
  ('platform_admin',       'moderation:action'),
  ('platform_admin',       'platform:configure')
on conflict (role, capability) do nothing;

-- ── 4. Reference data: readable, and writable by nobody ───────────────────
--
-- All three are reference tables rather than anybody's data: the same rows for
-- every account, and no row about a person. Item 240's context switcher needs
-- to read the matrix to know which tools to offer, and nothing here is a
-- secret — every row is in `docs/ROLE_REQUIREMENTS.md` in prose.
--
-- Writable by nobody, by the two locks `role_grants` uses and for the same
-- reason: Supabase's default privileges grant ALL on every new table in
-- `public` to both API roles, so the revoke is the outer lock and the absence
-- of any write policy is the inner one. A client that could add a row to
-- `role_capabilities` could grant itself `platform:configure` without ever
-- touching `role_grants`.

alter table public.app_roles         enable row level security;
alter table public.app_capabilities  enable row level security;
alter table public.role_capabilities enable row level security;

revoke all on table public.app_roles         from anon, authenticated;
revoke all on table public.app_capabilities  from anon, authenticated;
revoke all on table public.role_capabilities from anon, authenticated;

grant select on table public.app_roles         to authenticated;
grant select on table public.app_capabilities  to authenticated;
grant select on table public.role_capabilities to authenticated;

create policy "the role vocabulary is public to signed-in accounts" on public.app_roles
  for select to authenticated using (true);
create policy "the capability vocabulary is public to signed-in accounts" on public.app_capabilities
  for select to authenticated using (true);
create policy "the matrix is public to signed-in accounts" on public.role_capabilities
  for select to authenticated using (true);

comment on table public.app_roles is
  'The one vocabulary of roles. Referenced by role_grants and role_capabilities; written only by migration.';
comment on table public.app_capabilities is
  'Every named thing a role may be allowed to do, with what it means. Written only by migration.';
comment on table public.role_capabilities is
  'Which capabilities each role carries — the permission matrix of item 299. Written only by migration.';

-- ── 5. The predicate ──────────────────────────────────────────────────────
--
-- One question, one boolean, no partial results — the phrasing
-- `private.holds_role()` and `allowsFamilyRequest` both use, for the reason the
-- second states: an authorization that can be half-computed is one a caller can
-- use half of.
--
-- It composes rather than duplicates: a live grant of a role that carries the
-- capability, over this scope. Liveness stays where `holds_role` put it —
-- inside the predicate, because the call site that forgets is the one nobody
-- finds.
--
-- `private` for the reason `is_app_admin()` is there: PostgREST publishes every
-- function in `public` that a client may execute, so a `public.has_capability()`
-- would be a URL answering "may I moderate", and `grants.check.sql` would fail
-- on it until somebody added it to the allowlist.
create or replace function private.has_capability(
  want_capability text,
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
      join public.role_capabilities rc on rc.role = g.role
     where g.subject = (select auth.uid())
       and rc.capability = want_capability
       and g.scope_kind = want_scope_kind
       and g.scope_id = want_scope_id
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
  );
$$;

revoke all on function private.has_capability(text, text, text) from public;
grant execute on function private.has_capability(text, text, text) to anon, authenticated;

comment on function private.has_capability(text, text, text) is
  'Whether the caller holds a live role carrying this capability over this scope. For policies to read; deliberately not reachable from a client.';

-- ── 6. The two policies that were waiting for this ────────────────────────
--
-- `20260921214500_report_status.sql` is applied to the live project, so it is
-- not edited — `ROLLBACK.md` is a document about how expensive it is when a
-- file disagrees with the database it was applied to. The policies are replaced
-- here instead, by name, and everything else that migration argued for stays
-- exactly as it was.
--
-- In particular the column grant stays, and it is the load-bearing half: that
-- file found by probe that an `for update` policy cannot stop an administrator
-- rewriting the complaint, because row-level security chooses *rows* and has
-- nothing to say about *columns*. `grant update (status)` is what narrows it,
-- this migration does not touch it, and `reports.check.sql` is what would
-- notice if it ever did.
--
-- `report:read` and `moderation:action` are separate on purpose, and this is
-- where the split earns itself: reading the queue and acting on it are
-- different permissions, item 296's five actions are graduated, and a
-- reviewer-only role is now expressible without inventing a second boolean.

drop policy if exists "administrators may read reports" on public.reports;
create policy "whoever may read the queue reads reports" on public.reports
  for select
  using (private.has_capability('report:read'));

drop policy if exists "administrators may move a report along" on public.reports;
create policy "whoever may act on a report moves it along" on public.reports
  for update
  using (private.has_capability('moderation:action'))
  with check (private.has_capability('moderation:action'));

comment on table public.reports is
  'Reports of a message or an account. Readable by a live role carrying report:read, through private.has_capability(); the status column is movable by one carrying moderation:action.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
-- The policies are the only part that touches anything that already existed,
-- and restoring them is the two statements `20260921214500` contains.
--
--   begin;
--   drop policy if exists "whoever may read the queue reads reports" on public.reports;
--   drop policy if exists "whoever may act on a report moves it along" on public.reports;
--   create policy "administrators may read reports" on public.reports
--     for select using (private.is_app_admin());
--   create policy "administrators may move a report along" on public.reports
--     for update using (private.is_app_admin()) with check (private.is_app_admin());
--   drop function if exists private.has_capability(text, text, text);
--   drop table if exists public.role_capabilities;
--   drop table if exists public.app_capabilities;
--   alter table public.role_grants drop constraint if exists role_grants_role_fkey;
--   alter table public.role_grants add constraint role_grants_role_check
--     check (role in ('prospective_student', 'undergraduate_student',
--       'graduate_student', 'transfer_student', 'alumni', 'faculty',
--       'teaching_assistant', 'academic_advisor', 'tutor',
--       'organization_member', 'organization_officer', 'organization_admin',
--       'employer', 'business_admin', 'university_staff', 'department_admin',
--       'university_admin', 'moderator', 'platform_admin', 'student'));
--   drop table if exists public.app_roles;
--   commit;
