-- ═══════════════════════════════════════════════════════════════════════════
-- Organizations: the first thing in this schema that a person holds a rank in
--
-- Run once, after `20260921170000_schools.sql`. Idempotent: every statement is
-- written so a second run is a no-op.
--
-- ── What this is, against what `groups` already is ───────────────────────
--
-- `docs/ROLE_REQUIREMENTS.md` (items 255–258) names the gap exactly:
--
--   "`group_members` is `(group_id, user_id, joined_at)` with no role and no
--    settings, and `private.in_group()` answers only whether somebody is in.
--    That predicate is the right pattern … and an organization version needs
--    the same trick for the same reason."
--
-- A study group is four people inside one class for one term. An organization
-- outlives its founder, admits and refuses people, and has officers who are
-- not each other's equals. Three things follow that `groups` never had to
-- answer, and each one is a place this file could be quietly wrong.
--
-- ── 1. Officers are a set, not a ladder ──────────────────────────────────
--
-- Item 256 is explicit, and it is the decision the rest of the file hangs on:
--
--   "Tiers cannot express a treasurer who sees finances and cannot admit
--    members, or a communications officer who posts announcements and sees no
--    budget … officer permissions are a **set of capabilities granted per
--    organization**, and the named roles above are presets over that set
--    rather than positions in an order."
--
-- So `capabilities` is a `text[]` against a closed vocabulary, and there is no
-- integer anywhere in this file that one officer has more of than another.
--
-- `ADMIN` is the one entry that implies the others, which is a tier in
-- everything but name and is here on purpose: item 257's dashboard is "a view
-- of permissions rather than a separate thing to secure", and somebody has to
-- be able to grant the first capability to anybody. It is one implication,
-- written once, in `private.org_can()`, and it is the only one.
--
-- ── 2. Nobody may write their own rank ───────────────────────────────────
--
-- This table has the shape that went wrong in `20260921170000_schools.sql`:
-- a column whose whole worth is that its subject did not write it.
-- `20260921211500_pin_profile_school.sql` is what that cost, and the sentence
-- worth carrying forward from it is not about column privileges — it is that
-- the fix was verified by reading the statement rather than by attempting the
-- write.
--
-- So `organization_members` is closed to both API roles for INSERT, UPDATE and
-- DELETE outright. Not a column list: a column list is a judgement about which
-- columns matter, and the whole row is a judgement somebody else made about a
-- person. Six `security definer` functions are the only way in, each of which
-- asks what the caller may do before it does anything, and
-- `organizations.check.sql` *attempts* each refusal as the account it should
-- refuse rather than asserting that a grant statement is present.
--
-- ── 3. `DISCOVERED` is not stored, and that is a decision ────────────────
--
-- Item 258's lifecycle opens with it, and the same document says why it is
-- absent here: "Storing it would mean recording that a person looked at an
-- organization, which is a browsing history nobody asked for." The absence of
-- a row is the state. Nothing below can write one, because nothing below is
-- called by reading a page.

-- ── The organizations ─────────────────────────────────────────────────────

create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),

  -- The campus. `on delete restrict` rather than the `set null` that
  -- `profiles.school_id` uses, and the difference is the point: a student
  -- whose university is un-listed is still a student, and a campus
  -- organization with no campus is not anything. `supabase/schools.check.sql`
  -- argues the set-null case for people; this is the other half of the same
  -- argument. Removing a university now fails loudly while its organizations
  -- exist, which is the answer a maintenance script should get.
  school_id  text not null references public.schools on delete restrict,

  -- The name in a URL, unique on its campus. Same shape as a school id,
  -- because the same client builds both.
  slug       text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$'),

  name       text not null check (length(trim(name)) between 2 and 120),
  about      text not null default '' check (length(about) <= 400),

  -- Whether it appears to students who are not in it. False is a real
  -- organization that admits by invitation; it is not a soft delete, and
  -- members see it either way.
  listed     boolean not null default true,

  -- `on delete set null`, which is the opposite of what `groups.created_by`
  -- does and is right for the opposite reason. A study group whose starter
  -- deletes their account is four people's abandoned term; an organization
  -- whose founder graduates and closes their account is the organization,
  -- unchanged, with one fewer member. Nothing in this file reads this column
  -- to decide anything — it is provenance, not authority, and the delete
  -- policy below asks `ADMIN` rather than asking who started it.
  created_by uuid references auth.users on delete set null,

  created_at timestamptz not null default now(),

  unique (school_id, slug)
);

alter table public.organizations enable row level security;

create index if not exists organizations_by_school on public.organizations (school_id, name);
create index if not exists organizations_by_founder on public.organizations (created_by);

-- ── The membership ────────────────────────────────────────────────────────

create table if not exists public.organization_members (
  org_id  uuid not null references public.organizations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,

  /*
   * Item 258's lifecycle, minus `DISCOVERED`, which is the absence of a row.
   *
   * It is deliberately not an ordered type, and a check constraint over text
   * rather than an enum says so in the schema: `WAITLISTED` can precede
   * `ACCEPTED` or terminate, and `ALUMNI_MEMBER` follows `MEMBER` without
   * being a demotion. An enum invites `>` and there is no `>` here.
   *
   * Two of these are the person's own statement about themselves — `FOLLOWER`
   * and `APPLICANT` — and the rest are the organization's statement about the
   * person. That split is not visible in the column; it is enforced by which
   * function writes it, and it is why there are two sets of functions below.
   */
  standing text not null check (standing in (
    'FOLLOWER', 'APPLICANT', 'WAITLISTED', 'ACCEPTED',
    'MEMBER', 'ALUMNI_MEMBER', 'DECLINED', 'REMOVED'
  )),

  /*
   * The officer's capabilities, as a set. Item 256's five presets are values
   * in here rather than rows of their own, plus `ADMIN`.
   *
   * `<@` rather than a per-element trigger: containment against a literal
   * array is the constraint Postgres can check on its own, and an unknown
   * capability is then a write that fails rather than a permission that
   * silently grants nothing.
   */
  capabilities text[] not null default '{}' check (
    capabilities <@ array[
      'ADMIN', 'MEMBERSHIP', 'EVENTS', 'TREASURY', 'COMMUNICATIONS', 'SECRETARY'
    ]::text[]
  ),

  /*
   * An officer is a member. Stated as a constraint rather than left to the
   * functions, because the failure it prevents is the quiet one: somebody
   * removed from an organization who keeps `TREASURY` is not visibly anything
   * — they are gone from the roster and still hold a key.
   */
  check (cardinality(capabilities) = 0 or standing = 'MEMBER'),

  since      timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (org_id, user_id)
);

alter table public.organization_members enable row level security;

-- `org_id` leads the primary key, so its foreign key is covered. `user_id` is
-- not, and `indexes.check.sql` is right to ask: deleting an account has to
-- find every membership it holds.
create index if not exists organization_members_by_user on public.organization_members (user_id);

-- ── What a policy may ask ─────────────────────────────────────────────────
--
-- All three are `security definer` for the reason `groups.sql` gives at
-- length: the policy on `organization_members` cannot read
-- `organization_members`, and would deadlock on itself if it tried.
--
-- All three are in `private` for the other reason that file gives: PostgREST
-- publishes what it can execute in `public`, so a helper there is also a URL.
-- `org_standing` is the one that would matter most — it answers "what is this
-- account to this organization" and an enumeration away from a membership
-- list of every club on campus.

/** This account's standing in an organization, or null for no row at all. */
create or replace function private.org_standing(want_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.standing from public.organization_members m
   where m.org_id = want_org and m.user_id = (select auth.uid());
$$;

/**
 * Whether this account is *in* an organization, which is narrower than having
 * a row in it.
 *
 * A follower, an applicant and somebody who was turned down all have rows.
 * None of them is a member, and the difference is most of what this table is
 * for. `ALUMNI_MEMBER` counts: item 258 says it follows `MEMBER` without being
 * a demotion, and an alumnus who can no longer see the organization they
 * belonged to would be a demotion.
 */
create or replace function private.in_org(want_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
     where m.org_id = want_org
       and m.user_id = (select auth.uid())
       and m.standing in ('MEMBER', 'ALUMNI_MEMBER')
  );
$$;

/**
 * Whether this account holds a capability in an organization.
 *
 * The one place `ADMIN` implies anything, written once. Everywhere else in
 * this file capabilities are compared for equality and nothing is greater than
 * anything.
 *
 * `standing = 'MEMBER'` is checked here as well as in the table constraint,
 * which is not redundancy worth removing: the constraint stops the row from
 * existing, and this stops a row that somehow exists from being obeyed.
 */
create or replace function private.org_can(want_org uuid, want_cap text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
     where m.org_id = want_org
       and m.user_id = (select auth.uid())
       and m.standing = 'MEMBER'
       and (want_cap = any(m.capabilities) or 'ADMIN' = any(m.capabilities))
  );
$$;

revoke all on function private.org_standing(uuid) from public;
revoke all on function private.in_org(uuid) from public;
revoke all on function private.org_can(uuid, text) from public;
grant execute on function private.org_standing(uuid) to anon, authenticated;
grant execute on function private.in_org(uuid) to anon, authenticated;
grant execute on function private.org_can(uuid, text) to anon, authenticated;

-- ── Who sees an organization ──────────────────────────────────────────────
--
-- A member always. Otherwise: listed, and on your campus.
--
-- "On your campus" is `private.school_of()`, which is null until an account
-- has claimed a school through `claim_school()`. So an account that has not
-- claimed sees an empty directory, and that is the intended reading rather
-- than a gap to paper over: `20260901000300_classmates_schools.sql` gave up
-- the server-side school check and said what it cost, `20260921170000` built
-- the column to put it back, and this is the first thing that spends it. A
-- directory of every campus's clubs to anybody holding the publishable key is
-- the state that column exists to end.

drop policy if exists organizations_read on public.organizations;
create policy organizations_read on public.organizations
  for select using (
    private.in_org(id)
    or (listed and school_id is not distinct from private.school_of())
  );

-- Editing is `ADMIN`. Not "an officer": item 257's settings panel is one
-- capability among eleven, and a communications officer renaming the
-- organization is the thing the set model exists to make impossible.
drop policy if exists organizations_write on public.organizations;
create policy organizations_write on public.organizations
  for update using (private.org_can(id, 'ADMIN')) with check (private.org_can(id, 'ADMIN'));

drop policy if exists organizations_close on public.organizations;
create policy organizations_close on public.organizations
  for delete using (private.org_can(id, 'ADMIN'));

-- No insert policy, and no gap. `start_organization()` below is the only way
-- a row appears, because creating one and being its first administrator have
-- to be one act: an organization that exists for the half-second before its
-- founder's membership row lands is an organization anybody could have taken.

-- ── Which columns a client may write ──────────────────────────────────────
--
-- The lesson of `20260921211500_pin_profile_school.sql`, applied before rather
-- than after: a column-level REVOKE cannot subtract from the table-level GRANT
-- Supabase hands every new table. So the table-level verbs come off and an
-- explicit list goes back.

revoke insert, update on public.organizations from anon, authenticated;
grant update (name, about, listed) on public.organizations to anon, authenticated;

-- `school_id` is absent, and it is the `groups.code` lesson one table over:
-- the read policy above compares it against the caller's claimed school, so an
-- organization that could be moved between campuses is a roster that could be
-- moved in front of a campus that never admitted it. `slug` is absent too —
-- it is in a unique constraint and in every link anybody has sent.
-- `created_by`, `created_at` and `id` are provenance and identity.
--
-- A trigger as well as the missing grant, for the reason the pin on
-- `profiles.school_id` could not use one and this can: nothing here is written
-- by a definer function that would have to step over its own trigger.
-- `start_organization()` inserts, and a BEFORE UPDATE trigger never sees an
-- insert.

drop trigger if exists organizations_pinned on public.organizations;
create trigger organizations_pinned
  before update on public.organizations
  for each row
  execute function private.refuse_column_change('id', 'school_id', 'slug', 'created_by', 'created_at');

-- ── Who sees a membership row ─────────────────────────────────────────────
--
-- Three answers, and they are different questions.
--
--   Your own row, always. An applicant has to be able to see that they are an
--   applicant — item 260: "Students see their status."
--
--   The roster, to members. `MEMBER` and `ALUMNI_MEMBER` rows only, so being
--   in an organization tells you who else is in it and not who was turned
--   down.
--
--   Everything, to a membership officer. That is the panel item 257 names,
--   and it is the only way to review an application.

drop policy if exists organization_members_read on public.organization_members;
create policy organization_members_read on public.organization_members
  for select using (
    user_id = (select auth.uid())
    or (private.in_org(org_id) and standing in ('MEMBER', 'ALUMNI_MEMBER'))
    or private.org_can(org_id, 'MEMBERSHIP')
  );

-- And nothing else. No insert, update or delete policy exists, and the verbs
-- are taken off both API roles besides, so a missing policy cannot be restored
-- by a later migration adding a permissive one by habit.
revoke insert, update, delete on public.organization_members from anon, authenticated;

-- ── The one predicate two things have to agree about ──────────────────────
--
-- The read policy above is written inline, against the row's own columns,
-- because it runs once per row of a directory listing and a function call that
-- re-selects the row by id is an index lookup per club on campus.
--
-- The functions below cannot use it. They are `security definer`, so they do
-- not see the policy at all — which is the point of them and also the trap:
-- `follow_organization(some_uuid)` that did not ask would let an account join
-- an organization at a university it has nothing to do with, and the only
-- thing standing in the way would be that the uuid is hard to guess. "Hard to
-- guess" is not an access control.
--
-- So the rule is written a second time here, and `organizations.check.sql`
-- asserts the two agree for every account it makes against every organization
-- it makes. A second copy that is checked is a different thing from a second
-- copy.
create or replace function private.org_readable(want_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organizations o
     where o.id = want_org
       and (
         private.in_org(o.id)
         or (o.listed and o.school_id is not distinct from private.school_of())
       )
  );
$$;

revoke all on function private.org_readable(uuid) from public;
grant execute on function private.org_readable(uuid) to anon, authenticated;

-- ── Starting one ──────────────────────────────────────────────────────────

/**
 * Start an organization on your own campus, and be its first administrator.
 *
 * One statement for both, because they cannot be two: an organization that
 * exists for the half-second before its founder's membership row lands is an
 * organization with no administrator, and the table has no insert policy for
 * anybody to write the second row with.
 *
 * The school is `private.school_of()` and is not an argument. An argument
 * would be a campus somebody types, which is the self-declaration
 * `claim_school()` exists to refuse, one table along.
 */
create or replace function public.start_organization(
  want_slug text, want_name text, want_about text default ''
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  mine   text;
  made   uuid;
  me     uuid := (select auth.uid());
begin
  if not private.verified_student() then
    raise exception 'confirm your address before starting an organization'
      using errcode = 'insufficient_privilege';
  end if;

  mine := private.school_of();
  if mine is null then
    raise exception 'claim your university first — an organization belongs to a campus'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.organizations (school_id, slug, name, about, created_by)
       values (mine, lower(trim(want_slug)), trim(want_name), coalesce(trim(want_about), ''), me)
    returning id into made;

  insert into public.organization_members (org_id, user_id, standing, capabilities)
       values (made, me, 'MEMBER', array['ADMIN']);

  return made;
end;
$$;

-- ── What a person may say about themselves ────────────────────────────────
--
-- Two standings, and they are the two that are a statement rather than a
-- decision: you follow an organization, and you apply to one. Everything else
-- in item 258's lifecycle is the organization's answer, and lives in the
-- functions after these.

/**
 * Follow, or stop following.
 *
 * `want` is true to follow and false to stop. Stopping is a delete rather than
 * a standing, because "used to follow" is not a state anybody asked to be
 * recorded in — the same argument that keeps `DISCOVERED` out of the table.
 *
 * It refuses rather than doing nothing when there is already a standing the
 * organization set. A member who presses follow has not made a mistake worth
 * a silent no-op; they have found a screen that offered them something they
 * already have, and the message says which.
 */
create or replace function public.follow_organization(org uuid, want boolean default true)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me  uuid := (select auth.uid());
  now_standing text;
begin
  if not private.org_readable(org) then
    raise exception 'there is no such organization on your campus'
      using errcode = 'insufficient_privilege';
  end if;

  now_standing := private.org_standing(org);

  if now_standing is not null and now_standing not in ('FOLLOWER') then
    raise exception 'you are already % here, which is not something following changes',
      lower(replace(now_standing, '_', ' ')) using errcode = 'restrict_violation';
  end if;

  if not want then
    delete from public.organization_members m where m.org_id = org and m.user_id = me;
    return 'NONE';
  end if;

  insert into public.organization_members (org_id, user_id, standing)
       values (org, me, 'FOLLOWER')
  on conflict (org_id, user_id) do nothing;

  return 'FOLLOWER';
end;
$$;

/**
 * Apply.
 *
 * Only from nothing or from following, which is the whole of the rule: an
 * applicant reapplying is the same row, and somebody the organization has
 * declined cannot clear that by applying again. Item 258 lists `DECLINED` as a
 * terminal state and this is where that is true.
 */
create or replace function public.apply_to_organization(org uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  now_standing text;
begin
  if not private.verified_student() then
    raise exception 'confirm your address before applying'
      using errcode = 'insufficient_privilege';
  end if;
  if not private.org_readable(org) then
    raise exception 'there is no such organization on your campus'
      using errcode = 'insufficient_privilege';
  end if;

  now_standing := private.org_standing(org);

  if now_standing is not null and now_standing not in ('FOLLOWER', 'APPLICANT') then
    raise exception 'you are already % here'
      , lower(replace(now_standing, '_', ' ')) using errcode = 'restrict_violation';
  end if;

  insert into public.organization_members (org_id, user_id, standing)
       values (org, me, 'APPLICANT')
  on conflict (org_id, user_id)
    do update set standing = 'APPLICANT', updated_at = now();

  return 'APPLICANT';
end;
$$;

/**
 * Leave.
 *
 * Two things it will not do.
 *
 * It will not clear `DECLINED` or `REMOVED`. Those are the organization's
 * record of a decision it made, and a person who could delete them could
 * reapply into a clean slate the organization never gave them. Leaving is for
 * standings you put yourself in or were given.
 *
 * It will not take the last administrator out. An organization with members
 * and no administrator cannot admit anybody, cannot edit itself and cannot
 * appoint a replacement, because every one of those asks `ADMIN` — it is
 * locked, permanently, by one person pressing a button that said "leave".
 */
create or replace function public.leave_organization(org uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  mine record;
  others integer;
begin
  select m.standing, m.capabilities into mine
    from public.organization_members m
   where m.org_id = org and m.user_id = me;

  if not found then
    raise exception 'you are not on this organization''s list at all'
      using errcode = 'restrict_violation';
  end if;

  if mine.standing in ('DECLINED', 'REMOVED') then
    raise exception 'that is the organization''s record of a decision, not yours to clear'
      using errcode = 'restrict_violation';
  end if;

  if 'ADMIN' = any(mine.capabilities) then
    select count(*) into others
      from public.organization_members m
     where m.org_id = org and m.user_id <> me
       and m.standing = 'MEMBER' and 'ADMIN' = any(m.capabilities);
    if others = 0 then
      raise exception 'you are the only administrator — appoint another one first, '
        'or the organization is left with nobody who can admit, edit or appoint'
        using errcode = 'restrict_violation';
    end if;
  end if;

  delete from public.organization_members m where m.org_id = org and m.user_id = me;
  return 'NONE';
end;
$$;

-- ── What an organization may say about a person ───────────────────────────

/**
 * Decide somebody's standing, as an officer who may.
 *
 * Four rules, each of which is a way this could otherwise be a promotion
 * mechanism rather than a membership one.
 *
 *   **`MEMBERSHIP`, not `MEMBER`.** Item 256's point: admitting people is a
 *   capability somebody was given, and most members do not have it.
 *
 *   **Never yourself.** An officer who can set their own standing can set it
 *   to whatever a later capability check reads, and the first rule of this
 *   table is that nobody writes their own rank.
 *
 *   **Not `FOLLOWER` or `APPLICANT`.** Those two are the person's statement
 *   about themselves. An organization that could mark somebody an applicant
 *   has put words in their mouth.
 *
 *   **Capabilities come off with the standing.** A treasurer moved to
 *   `ALUMNI_MEMBER` or `REMOVED` who kept `TREASURY` would be off the roster
 *   and still holding a key — the quietest failure this table has. The table
 *   constraint refuses the row, so this is what makes the refusal a clearing
 *   rather than an error somebody works around.
 */
create or replace function public.set_member_standing(org uuid, who uuid, want text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  target record;
  others integer;
begin
  if not private.org_can(org, 'MEMBERSHIP') then
    raise exception 'you are not a membership officer of this organization'
      using errcode = 'insufficient_privilege';
  end if;

  if who = me then
    raise exception 'you cannot set your own standing'
      using errcode = 'insufficient_privilege';
  end if;

  if want not in ('WAITLISTED', 'ACCEPTED', 'MEMBER', 'ALUMNI_MEMBER', 'DECLINED', 'REMOVED') then
    raise exception '% is not a standing an organization sets — FOLLOWER and APPLICANT '
      'are what a person says about themselves', want using errcode = 'restrict_violation';
  end if;

  select m.standing, m.capabilities into target
    from public.organization_members m
   where m.org_id = org and m.user_id = who;

  if not found then
    raise exception 'that account has no standing here, and this does not create one'
      using errcode = 'restrict_violation';
  end if;

  if 'ADMIN' = any(target.capabilities) and want <> 'MEMBER' then
    select count(*) into others
      from public.organization_members m
     where m.org_id = org and m.user_id <> who
       and m.standing = 'MEMBER' and 'ADMIN' = any(m.capabilities);
    if others = 0 then
      raise exception 'that is the only administrator — appoint another one first'
        using errcode = 'restrict_violation';
    end if;
  end if;

  update public.organization_members m
     set standing = want,
         capabilities = case when want = 'MEMBER' then m.capabilities else '{}'::text[] end,
         updated_at = now()
   where m.org_id = org and m.user_id = who;

  return want;
end;
$$;

/**
 * Set somebody's capabilities, as an administrator.
 *
 * `ADMIN` rather than `MEMBERSHIP`, because this is the function that hands
 * out `MEMBERSHIP`: an officer who can appoint officers is an administrator
 * whatever the column says.
 *
 * Self is allowed here, and only here, in one direction that matters — an
 * administrator stepping down once somebody else can do the job. The last-
 * administrator check is what makes that safe, and it is the same check
 * `leave_organization` makes for the same reason.
 */
create or replace function public.set_member_capabilities(org uuid, who uuid, want text[])
returns text[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target record;
  tidy   text[];
  bad    text;
  others integer;
begin
  if not private.org_can(org, 'ADMIN') then
    raise exception 'only an administrator of this organization may appoint officers'
      using errcode = 'insufficient_privilege';
  end if;

  select array_agg(distinct upper(trim(c)) order by upper(trim(c)))
    into tidy
    from unnest(coalesce(want, '{}'::text[])) as c
   where trim(c) <> '';
  tidy := coalesce(tidy, '{}'::text[]);

  select c into bad from unnest(tidy) as c
   where c not in ('ADMIN', 'MEMBERSHIP', 'EVENTS', 'TREASURY', 'COMMUNICATIONS', 'SECRETARY')
   limit 1;
  if bad is not null then
    raise exception '% is not a capability this organization has to give', bad
      using errcode = 'restrict_violation';
  end if;

  select m.standing, m.capabilities into target
    from public.organization_members m
   where m.org_id = org and m.user_id = who;

  if not found then
    raise exception 'that account has no standing here' using errcode = 'restrict_violation';
  end if;

  if target.standing <> 'MEMBER' and cardinality(tidy) > 0 then
    raise exception 'capabilities are for members, and that account is %',
      lower(replace(target.standing, '_', ' ')) using errcode = 'restrict_violation';
  end if;

  if 'ADMIN' = any(target.capabilities) and not ('ADMIN' = any(tidy)) then
    select count(*) into others
      from public.organization_members m
     where m.org_id = org and m.user_id <> who
       and m.standing = 'MEMBER' and 'ADMIN' = any(m.capabilities);
    if others = 0 then
      raise exception 'that is the only administrator — appoint another one first'
        using errcode = 'restrict_violation';
    end if;
  end if;

  update public.organization_members m
     set capabilities = tidy, updated_at = now()
   where m.org_id = org and m.user_id = who;

  return tidy;
end;
$$;

-- ── Who may call these ────────────────────────────────────────────────────
--
-- Supabase grants EXECUTE on every new function in `public` to `anon` and
-- `authenticated` as it is created, so silence here is a signed-out visitor
-- with six new buttons. `grants.check.sql` is the sweep that would catch it;
-- these six lines are so that it does not have to.

revoke all on function public.start_organization(text, text, text) from public, anon;
revoke all on function public.follow_organization(uuid, boolean) from public, anon;
revoke all on function public.apply_to_organization(uuid) from public, anon;
revoke all on function public.leave_organization(uuid) from public, anon;
revoke all on function public.set_member_standing(uuid, uuid, text) from public, anon;
revoke all on function public.set_member_capabilities(uuid, uuid, text[]) from public, anon;

grant execute on function public.start_organization(text, text, text) to authenticated;
grant execute on function public.follow_organization(uuid, boolean) to authenticated;
grant execute on function public.apply_to_organization(uuid) to authenticated;
grant execute on function public.leave_organization(uuid) to authenticated;
grant execute on function public.set_member_standing(uuid, uuid, text) to authenticated;
grant execute on function public.set_member_capabilities(uuid, uuid, text[]) to authenticated;

comment on table public.organizations is
  'A student organization on one campus. Created only by public.start_organization(), '
  'which makes its founder the first administrator in the same statement.';

comment on column public.organization_members.capabilities is
  'An officer''s capabilities, as a set rather than a rank — see items 256–257 of '
  'docs/ROLE_REQUIREMENTS.md. ADMIN implies the rest, in private.org_can() and nowhere '
  'else. Written only by public.set_member_capabilities(); both API roles are off '
  'INSERT, UPDATE and DELETE on this table entirely.';
