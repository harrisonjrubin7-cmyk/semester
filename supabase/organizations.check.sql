-- Who may say what about whom, in an organization.
--
-- `20260921230000_organizations.sql` is the first table in this schema where
-- one person's row is another person's decision. `profiles.school_id` was the
-- first column of that kind and it shipped open, because
-- `20260921170000_schools.sql` verified the statement that pinned it rather
-- than attempting the write it was meant to refuse: a column-level REVOKE
-- against a table-level GRANT, which Postgres accepts, warns about, and
-- ignores. `20260921211500_pin_profile_school.sql` is the fix.
--
-- So every refusal below is *attempted*, as the account that should be
-- refused, and the assertion is on what the table says afterwards. Nothing
-- here reads a grant, a policy definition or a migration's text.
--
-- ## The two shapes a refusal takes, and why both are checked
--
-- A write can be refused loudly or quietly, and only one of them raises.
--
--   **Loudly** when the privilege is missing: both API roles are off INSERT,
--   UPDATE and DELETE on `organization_members` entirely, so a direct write
--   there is `permission denied`.
--
--   **Quietly** when the privilege is there and the policy matches no row: an
--   ordinary member updating the organization's name has the column grant, so
--   the statement succeeds and changes nothing. A suite that only caught
--   exceptions would pass against a policy that had been deleted.
--
-- Both are here, and the quiet ones assert the value afterwards.
--
--   How to run it: supabase/check.sh organizations

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.become_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end $$;

create or replace function pg_temp.ok(what text)
returns void language plpgsql as $$
begin raise notice 'ok  %', what; end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null');
  end if;
  raise notice 'ok  %', what;
end $$;

/**
 * Run a statement as somebody, and say whether the server refused it.
 *
 * Deliberately catches everything rather than one errcode. A refusal here can
 * arrive as `permission denied` (42501), as a row-level security violation
 * (also 42501), as one of the functions' own `restrict_violation`, or as a
 * check constraint — and which one it is is an implementation detail of where
 * the rule happens to live. What the suite is asserting is that the write did
 * not happen, and the assertions after each of these say what the table holds.
 */
create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  execute 'reset role';
  return false;
exception when others then
  execute 'reset role';
  return true;
end $$;

/** The same, for a statement run with no session at all. */
create or replace function pg_temp.refused_anon(statement text)
returns boolean language plpgsql as $$
begin
  perform pg_temp.become_anon();
  execute statement;
  execute 'reset role';
  return false;
exception when others then
  execute 'reset role';
  return true;
end $$;

/** How many rows of a table somebody can see. */
create or replace function pg_temp.visible(who uuid, what text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute format('select count(*) from %s', what) into n;
  execute 'reset role';
  return n;
end $$;

/** An account with a confirmed address and a profile, as the app makes one. */
create or replace function pg_temp.newuser(address text, confirmed boolean default true)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          address, case when confirmed then now() else null end, now(), now());
  insert into public.profiles (user_id, handle) values (who, 'someone');
  return who;
end $$;

/** Claim a school the way the app does, through the function and as the user. */
create or replace function pg_temp.claims(who uuid, want text)
returns void language plpgsql as $$
begin
  perform pg_temp.become(who);
  perform public.claim_school(want);
  execute 'reset role';
end $$;

do $$
declare
  founder    uuid;
  officer    uuid;      -- MEMBERSHIP, and nothing else
  plain      uuid;      -- a member with no capabilities
  hopeful    uuid;      -- an applicant
  bystander  uuid;      -- same campus, no relationship to the organization
  unclaimed  uuid;      -- same address domain, has not claimed
  elsewhere  uuid;      -- another campus entirely
  chess      uuid;
  quiet      uuid;      -- an unlisted organization
  n          bigint;
  got        text;
  caps       text[];
  who        uuid;
  org        uuid;
  readable   boolean;
  selectable boolean;
  agree      integer;
  differ     integer;
  before     text;
begin
  -- ── Two campuses, neither of them a real one ──────────────────────────
  --
  -- The multi-campus rule in the specification is that no university's name
  -- belongs in the schema, and a fixture is schema enough: a suite written
  -- around `vanderbilt` is one whose author has stopped seeing the second
  -- campus, which is the case half the assertions below are about.
  insert into public.schools (id, name, email_domains)
       values ('northerly', 'Northerly College', array['northerly.edu']),
              ('southerly', 'Southerly College', array['southerly.edu']);

  founder   := pg_temp.newuser('founder@northerly.edu');
  officer   := pg_temp.newuser('officer@northerly.edu');
  plain     := pg_temp.newuser('member@northerly.edu');
  hopeful   := pg_temp.newuser('hopeful@northerly.edu');
  bystander := pg_temp.newuser('bystander@northerly.edu');
  unclaimed := pg_temp.newuser('unclaimed@northerly.edu');
  elsewhere := pg_temp.newuser('elsewhere@southerly.edu');

  perform pg_temp.claims(founder, 'northerly');
  perform pg_temp.claims(officer, 'northerly');
  perform pg_temp.claims(plain, 'northerly');
  perform pg_temp.claims(hopeful, 'northerly');
  perform pg_temp.claims(bystander, 'northerly');
  perform pg_temp.claims(elsewhere, 'southerly');

  -- ── Starting one ──────────────────────────────────────────────────────

  /*
   * The first refusal, and the sequencing argument from tenancy.check.sql
   * made concrete. An account that has not claimed a campus has no campus to
   * put an organization on, and the alternative — taking the campus as an
   * argument — is the self-declaration `claim_school()` exists to refuse.
   */
  if not pg_temp.refused(unclaimed,
      $q$select public.start_organization('chess', 'Chess Club')$q$) then
    raise exception 'FAILED: an account that has claimed no university started an organization';
  end if;
  perform pg_temp.ok('an account with no claimed campus cannot start an organization');

  perform pg_temp.become(founder);
  chess := public.start_organization('chess', 'Chess Club', 'Tuesdays, Buttrick 101');
  reset role;
  perform pg_temp.counted('the organization exists', (
    select count(*) from public.organizations o where o.id = chess), 1);

  /*
   * The half-second that cannot exist. `organizations` has no insert policy,
   * so if these two statements were ever separated there would be no way for
   * anybody to write the second one — and an organization with no
   * administrator can never be edited, can admit nobody, and can appoint
   * nobody, because all three ask ADMIN.
   */
  select m.standing into got from public.organization_members m
   where m.org_id = chess and m.user_id = founder;
  perform pg_temp.said('and its founder is a member of it in the same statement', got, 'MEMBER');
  select m.capabilities into caps from public.organization_members m
   where m.org_id = chess and m.user_id = founder;
  perform pg_temp.said('holding ADMIN', array_to_string(caps, ','), 'ADMIN');

  -- ── Who sees it ───────────────────────────────────────────────────────

  perform pg_temp.counted('a student on the same campus sees a listed organization',
    pg_temp.visible(bystander, 'public.organizations'), 1);
  perform pg_temp.counted('a student on another campus does not',
    pg_temp.visible(elsewhere, 'public.organizations'), 0);

  /*
   * The one that pays for `claim_school()`. Until an account has claimed,
   * `private.school_of()` is null and `is not distinct from` compares it
   * against a school id that is never null — so the directory is empty. That
   * is the intended reading: a list of every campus's clubs, to anybody
   * holding the publishable key, is the state the column exists to end.
   */
  perform pg_temp.counted('an account that has claimed nothing sees no organizations',
    pg_temp.visible(unclaimed, 'public.organizations'), 0);

  perform pg_temp.become_anon();
  select count(*) into n from public.organizations;
  reset role;
  perform pg_temp.counted('and a signed-out visitor sees none either', n, 0);

  -- An unlisted organization is a real one that admits by invitation, not a
  -- deleted one: its members see it and the campus does not.
  perform pg_temp.become(founder);
  quiet := public.start_organization('quiet', 'Quiet Society');
  update public.organizations set listed = false where id = quiet;
  reset role;
  perform pg_temp.counted('an unlisted organization is hidden from its own campus',
    pg_temp.visible(bystander, 'public.organizations'), 1);
  perform pg_temp.counted('and visible to its members',
    pg_temp.visible(founder, 'public.organizations'), 2);

  /*
   * The drift guard. `private.org_readable()` is a second copy of the read
   * policy, written because the definer functions do not see policies and
   * `follow_organization(some_uuid)` that did not ask would let an account
   * join an organization at a university it has nothing to do with.
   *
   * A second copy of a rule is worth exactly as much as the check that the
   * two still say the same thing, so: every account against every
   * organization, compared both ways.
   *
   * The comparison has to be made one id at a time, from outside. The first
   * version of this loop asked each account to count the organizations it
   * could select where `org_readable` disagreed — which is vacuous, because
   * the select is subject to the very policy being checked and never returns
   * a hidden row to disagree about. `org_readable` is `security definer` and
   * will answer for an id its caller cannot see, which is what makes the
   * question askable at all, and also exactly what makes it worth asking.
   */
  agree := 0;
  differ := 0;
  for who in select unnest(array[founder, officer, plain, hopeful, bystander,
                                 unclaimed, elsewhere])
  loop
    for org in select o.id from public.organizations o
    loop
      perform pg_temp.become(who);
      select private.org_readable(org) into readable;
      select exists (select 1 from public.organizations o where o.id = org)
        into selectable;
      reset role;

      if readable is distinct from selectable then
        raise exception 'FAILED: org_readable says % for an organization the read '
          'policy says % about, for one of the accounts', readable, selectable;
      end if;
      if selectable then agree := agree + 1; else differ := differ + 1; end if;
    end loop;
  end loop;

  /*
   * The control. Every assertion in that loop passes if both sides answer
   * false for every pair — a `school_of()` that returned null for everybody,
   * or an `org_readable` whose `exists` matched nothing, would sail through
   * it. So the sweep has to have seen both answers, and the numbers are
   * printed rather than hidden behind a boolean.
   */
  if agree = 0 or differ = 0 then
    raise exception 'FAILED: the org_readable sweep saw % visible and % hidden — '
      'one of those being zero means it proved nothing', agree, differ;
  end if;
  perform pg_temp.ok(format(
    'private.org_readable agrees with the read policy (%s visible, %s hidden)',
    agree, differ));


  -- ── The roster, and who is not on it ──────────────────────────────────

  perform pg_temp.become(officer);
  perform public.apply_to_organization(chess);
  reset role;
  perform pg_temp.become(plain);
  perform public.apply_to_organization(chess);
  reset role;
  perform pg_temp.become(hopeful);
  perform public.apply_to_organization(chess);
  reset role;

  perform pg_temp.become(founder);
  perform public.set_member_standing(chess, officer, 'MEMBER');
  perform public.set_member_standing(chess, plain, 'MEMBER');
  perform public.set_member_capabilities(chess, officer, array['MEMBERSHIP']);
  reset role;

  /*
   * Three different questions, and the table answers them differently on
   * purpose. `hopeful` is still an applicant throughout: a plain member does
   * not get to see who applied and was not taken.
   */
  perform pg_temp.counted('a plain member sees the roster and not the applicants',
    pg_temp.visible(plain, format('public.organization_members m where m.org_id = %L', chess)), 3);
  perform pg_temp.counted('a membership officer sees the applicants too',
    pg_temp.visible(officer, format('public.organization_members m where m.org_id = %L', chess)), 4);
  perform pg_temp.counted('an applicant sees their own row, which is their status',
    pg_temp.visible(hopeful, format('public.organization_members m where m.org_id = %L', chess)), 1);
  perform pg_temp.counted('somebody with no relationship to it sees nothing',
    pg_temp.visible(bystander, format('public.organization_members m where m.org_id = %L', chess)), 0);

  -- ── The write nobody may make ─────────────────────────────────────────
  --
  -- The section this suite exists for. `profiles.school_id` shipped writable
  -- by the account it described, because the migration that pinned it asserted
  -- the statement rather than attempting the write. Each of these attempts the
  -- write, as the account that should be refused, and then reads the table.

  if not pg_temp.refused(plain, format(
      $q$update public.organization_members set capabilities = array['ADMIN']
          where org_id = %L and user_id = %L$q$, chess, plain)) then
    raise exception 'FAILED: a member made themselves an administrator by writing the column';
  end if;
  select array_to_string(m.capabilities, ',') into got from public.organization_members m
   where m.org_id = chess and m.user_id = plain;
  perform pg_temp.said('a member cannot write their own capabilities', got, '');

  if not pg_temp.refused(plain, format(
      $q$update public.organization_members set standing = 'MEMBER'
          where org_id = %L and user_id = %L$q$, chess, hopeful)) then
    raise exception 'FAILED: a member admitted an applicant by writing the column';
  end if;
  select m.standing into got from public.organization_members m
   where m.org_id = chess and m.user_id = hopeful;
  perform pg_temp.said('nor anybody elses standing', got, 'APPLICANT');

  if not pg_temp.refused(bystander, format(
      $q$insert into public.organization_members (org_id, user_id, standing, capabilities)
         values (%L, %L, 'MEMBER', array['ADMIN'])$q$, chess, bystander)) then
    raise exception 'FAILED: a stranger wrote themselves in as an administrator';
  end if;
  perform pg_temp.counted('and cannot write themselves in at all', (
    select count(*) from public.organization_members m
     where m.org_id = chess and m.user_id = bystander), 0);

  if not pg_temp.refused(plain, format(
      $q$delete from public.organization_members where org_id = %L and user_id = %L$q$,
      chess, founder)) then
    raise exception 'FAILED: a member deleted the founders membership row';
  end if;
  perform pg_temp.counted('nor delete somebody out of one', (
    select count(*) from public.organization_members m
     where m.org_id = chess and m.user_id = founder), 1);

  -- ── The quiet refusal ─────────────────────────────────────────────────
  --
  -- `name` is on the update grant, so this statement is permitted and simply
  -- matches no row. Nothing raises. A suite that only caught exceptions would
  -- pass here against a policy that had been deleted, which is why the
  -- assertion is on the name afterwards rather than on an error.

  select o.name into before from public.organizations o where o.id = chess;
  perform pg_temp.become(plain);
  update public.organizations set name = 'Renamed By A Member' where id = chess;
  reset role;
  select o.name into got from public.organizations o where o.id = chess;
  perform pg_temp.said('a member renaming the organization changes nothing, silently', got, before);

  perform pg_temp.become(officer);
  update public.organizations set name = 'Renamed By An Officer' where id = chess;
  reset role;
  select o.name into got from public.organizations o where o.id = chess;
  perform pg_temp.said('and a membership officer is not an administrator either', got, before);

  perform pg_temp.become(founder);
  update public.organizations set name = 'Chess Society' where id = chess;
  reset role;
  select o.name into got from public.organizations o where o.id = chess;
  perform pg_temp.said('an administrator renames it', got, 'Chess Society');

  /*
   * The `groups.code` lesson, one table over. The read policy compares
   * `school_id` against the caller's claimed school, so an organization that
   * could be moved between campuses is a roster that could be moved in front
   * of a campus that never admitted it. The column is off the update grant and
   * pinned by a trigger, and this attempts it as the one account that can do
   * everything else to the row.
   */
  if not pg_temp.refused(founder, format(
      $q$update public.organizations set school_id = 'southerly' where id = %L$q$, chess)) then
    raise exception 'FAILED: an administrator moved the organization to another campus';
  end if;
  select o.school_id into got from public.organizations o where o.id = chess;
  perform pg_temp.said('an administrator cannot move it to another campus', got, 'northerly');

  /*
   * And the same attempt as `service_role`, which is a different question with
   * the same answer.
   *
   * The check above is carried entirely by the column grant: `school_id` is
   * not on the update list for `authenticated`, so the statement is refused
   * before any trigger runs — which means it passes against a schema with no
   * trigger at all, and the first version of this suite did exactly that.
   *
   * `service_role` has the table-level grant Supabase hands every new table
   * and `bypassrls` besides, so nothing but the trigger is left. That is the
   * case `20260921142841_group_columns_pinned.sql` says it wants: "a group
   * moving rooms should be a thing somebody decided to do, not something a
   * maintenance script does by rewriting a row."
   */
  begin
    set local role service_role;
    update public.organizations set school_id = 'southerly' where id = chess;
    reset role;
    raise exception 'FAILED: the service key moved an organization to another campus — '
      'the column grant refuses a browser and nothing refuses a script';
  exception when restrict_violation then
    reset role;
    perform pg_temp.ok('nor can the service key, which only the trigger refuses');
  end;

  -- ── The functions, asked by the wrong person ──────────────────────────

  if not pg_temp.refused(plain, format(
      $q$select public.set_member_capabilities(%L, %L, array['ADMIN'])$q$, chess, plain)) then
    raise exception 'FAILED: an ordinary member appointed themselves an officer';
  end if;
  perform pg_temp.ok('an ordinary member cannot appoint officers');

  /*
   * The one that decides whether this is a set model or a ladder. A membership
   * officer may admit and remove people; appointing officers is a different
   * capability, and an officer who could hand themselves ADMIN would make
   * every capability a step on one staircase.
   */
  if not pg_temp.refused(officer, format(
      $q$select public.set_member_capabilities(%L, %L, array['ADMIN'])$q$, chess, officer)) then
    raise exception 'FAILED: a membership officer appointed themselves an administrator';
  end if;
  select array_to_string(m.capabilities, ',') into got from public.organization_members m
   where m.org_id = chess and m.user_id = officer;
  perform pg_temp.said('a membership officer cannot appoint officers either', got, 'MEMBERSHIP');

  if not pg_temp.refused(officer, format(
      $q$select public.set_member_standing(%L, %L, 'MEMBER')$q$, chess, officer)) then
    raise exception 'FAILED: an officer set their own standing';
  end if;
  perform pg_temp.ok('nobody sets their own standing, the officer who sets everyone elses included');

  if not pg_temp.refused(officer, format(
      $q$select public.set_member_standing(%L, %L, 'APPLICANT')$q$, chess, hopeful)) then
    raise exception 'FAILED: an organization marked somebody an applicant';
  end if;
  perform pg_temp.ok('an organization cannot say somebody applied — that is theirs to say');

  perform pg_temp.become(officer);
  perform public.set_member_standing(chess, hopeful, 'DECLINED');
  reset role;
  select m.standing into got from public.organization_members m
   where m.org_id = chess and m.user_id = hopeful;
  perform pg_temp.said('a membership officer decides an application', got, 'DECLINED');

  /*
   * `DECLINED` is terminal, and both ways out of it are closed: leaving would
   * delete the organization's record of a decision it made, and reapplying
   * would write over it. Either one hands a person a clean slate the
   * organization never gave them.
   */
  if not pg_temp.refused(hopeful, format($q$select public.leave_organization(%L)$q$, chess)) then
    raise exception 'FAILED: somebody cleared a decline by leaving';
  end if;
  if not pg_temp.refused(hopeful, format($q$select public.apply_to_organization(%L)$q$, chess)) then
    raise exception 'FAILED: somebody cleared a decline by applying again';
  end if;
  select m.standing into got from public.organization_members m
   where m.org_id = chess and m.user_id = hopeful;
  perform pg_temp.said('and a decline cannot be cleared by the person it is about', got, 'DECLINED');

  -- ── Capabilities come off with the standing ───────────────────────────
  --
  -- The quietest failure this table has: somebody off the roster who still
  -- holds a key. The table constraint refuses that row; this is what makes the
  -- refusal a clearing rather than an error an officer has to route around.

  perform pg_temp.become(founder);
  perform public.set_member_capabilities(chess, plain, array['TREASURY']);
  reset role;
  perform pg_temp.become(officer);
  perform public.set_member_standing(chess, plain, 'ALUMNI_MEMBER');
  reset role;
  select array_to_string(m.capabilities, ',') into got from public.organization_members m
   where m.org_id = chess and m.user_id = plain;
  perform pg_temp.said('a treasurer moved off the roster does not keep the treasury', got, '');

  -- ── The last administrator ────────────────────────────────────────────
  --
  -- An organization with members and no administrator is locked: it cannot be
  -- edited, cannot admit anybody and cannot appoint a replacement, because all
  -- three ask ADMIN. There is no route back, so there are two ways into that
  -- state and both are closed.

  if not pg_temp.refused(founder, format($q$select public.leave_organization(%L)$q$, chess)) then
    raise exception 'FAILED: the only administrator left, locking the organization';
  end if;
  perform pg_temp.ok('the only administrator cannot leave');

  if not pg_temp.refused(officer, format(
      $q$select public.set_member_standing(%L, %L, 'REMOVED')$q$, chess, founder)) then
    raise exception 'FAILED: a membership officer removed the only administrator';
  end if;
  perform pg_temp.ok('and cannot be removed by a membership officer');

  -- Once there are two, either may step down. The control for the pair above:
  -- without it they would both pass against a rule that refused everything.
  perform pg_temp.become(founder);
  perform public.set_member_capabilities(chess, officer, array['MEMBERSHIP', 'ADMIN']);
  perform public.leave_organization(chess);
  reset role;
  perform pg_temp.counted('once there are two, one may leave', (
    select count(*) from public.organization_members m
     where m.org_id = chess and m.user_id = founder), 0);
  perform pg_temp.counted('and the organization still has an administrator', (
    select count(*) from public.organization_members m
     where m.org_id = chess and m.standing = 'MEMBER' and 'ADMIN' = any(m.capabilities)), 1);

  -- ── The other campus ──────────────────────────────────────────────────

  if not pg_temp.refused(elsewhere, format(
      $q$select public.follow_organization(%L)$q$, chess)) then
    raise exception 'FAILED: a student at another university followed this ones organization';
  end if;
  perform pg_temp.counted('a student at another university cannot follow it', (
    select count(*) from public.organization_members m
     where m.org_id = chess and m.user_id = elsewhere), 0);

  /*
   * Knowing the id is not permission to use it. The definer functions do not
   * see the read policy, so without `org_readable` the only thing between an
   * account and an organization on a campus it has nothing to do with would be
   * that the uuid is hard to guess.
   */
  if not pg_temp.refused(bystander, format(
      $q$select public.follow_organization(%L)$q$, quiet)) then
    raise exception 'FAILED: an unlisted organization was joined by somebody who cannot see it';
  end if;
  perform pg_temp.ok('nor can somebody follow an unlisted organization they cannot see');

  -- ── An unknown capability ─────────────────────────────────────────────

  if not pg_temp.refused(officer, format(
      $q$select public.set_member_capabilities(%L, %L, array['PRESIDENT'])$q$, chess, plain)) then
    raise exception 'FAILED: a capability nothing checks was granted';
  end if;
  perform pg_temp.ok('a capability the vocabulary does not have is refused, not stored');

  -- ── And a university cannot be removed out from under one ─────────────
  --
  -- `profiles.school_id` is `on delete set null` and `schools.check.sql` is
  -- glad of it: a student whose university is un-listed is still a student. An
  -- organization with no campus is not anything, so this reference is
  -- `on delete restrict` instead, and the difference is the whole of what this
  -- asserts.

  begin
    delete from public.schools where id = 'northerly';
    raise exception 'FAILED: a university with organizations on it was removed anyway';
  exception when foreign_key_violation then
    perform pg_temp.ok('a university cannot be removed while it has organizations');
  end;
end $$;

-- ── What happens when somebody stops existing ─────────────────────────────
--
-- `20260921234500_organization_succession.sql` answers the question the first
-- migration left open, and the answer has three moving parts: the cascade from
-- `auth.users`, a trigger that deletes an organization once nobody is in it,
-- and a function any member can call to take on one that has no administrator.
--
-- Each is attempted the way it actually happens. The cascade in particular is
-- not simulated by deleting the membership row — deleting the `auth.users` row
-- is what a real account removal does, and it is the path no function of ours
-- runs on.

do $$
declare
  boss    uuid;
  second  uuid;
  turned  uuid;
  solo    uuid;
  club    uuid;
  onlyone uuid;
  caps    text[];
  got     text;
  n       bigint;
begin
  boss   := pg_temp.newuser('boss@northerly.edu');
  second := pg_temp.newuser('second@northerly.edu');
  turned := pg_temp.newuser('turned@northerly.edu');
  solo   := pg_temp.newuser('solo@northerly.edu');
  perform pg_temp.claims(boss, 'northerly');
  perform pg_temp.claims(second, 'northerly');
  perform pg_temp.claims(turned, 'northerly');
  perform pg_temp.claims(solo, 'northerly');

  perform pg_temp.become(boss);
  club := public.start_organization('rowing', 'Rowing Club');
  reset role;
  perform pg_temp.become(second);
  perform public.apply_to_organization(club);
  reset role;
  perform pg_temp.become(turned);
  perform public.apply_to_organization(club);
  reset role;
  perform pg_temp.become(boss);
  perform public.set_member_capabilities(club, boss, array['ADMIN', 'MEMBERSHIP']);
  perform public.set_member_standing(club, second, 'MEMBER');
  perform public.set_member_standing(club, turned, 'DECLINED');
  reset role;

  -- ── A member cannot take on an organization that has an administrator ──

  if not pg_temp.refused(second, format(
      $q$select public.claim_abandoned_organization(%L)$q$, club)) then
    raise exception 'FAILED: a member took over an organization that had an administrator';
  end if;
  perform pg_temp.ok('a member cannot take on an organization that has an administrator');

  -- ── The cascade, as it actually happens ───────────────────────────────

  delete from auth.users u where u.id = boss;

  perform pg_temp.counted('deleting an account takes its membership rows with it', (
    select count(*) from public.organization_members m where m.user_id = boss), 0);
  perform pg_temp.counted('the organization is not deleted with its last administrator', (
    select count(*) from public.organizations o where o.id = club), 1);
  perform pg_temp.counted('and it now has no administrator at all', (
    select count(*) from public.organization_members m
     where m.org_id = club and 'ADMIN' = any(m.capabilities)), 0);

  /*
   * And now — only now — the question of who may take it on is a real one.
   *
   * These two were asserted earlier in the file's first draft, against an
   * organization that still had an administrator, and they passed without
   * touching the rule they name: the claim was refused by the "this one has an
   * administrator" check and the standing check was never reached. Removing
   * the standing check entirely left the suite green at 54. They are here
   * instead, where the organization is adminless and the standing check is the
   * only thing left to refuse them.
   */
  if not pg_temp.refused(turned, format(
      $q$select public.claim_abandoned_organization(%L)$q$, club)) then
    raise exception 'FAILED: somebody the organization declined took it over';
  end if;
  perform pg_temp.ok('somebody who was declined cannot take on an abandoned organization');

  if not pg_temp.refused(solo, format(
      $q$select public.claim_abandoned_organization(%L)$q$, club)) then
    raise exception 'FAILED: a stranger took over an abandoned organization';
  end if;
  perform pg_temp.ok('and neither can somebody with no row in it at all');

  /*
   * Which is the state the whole file is about. Adminless is honest — that is
   * what has happened — and it is recoverable by the people it belongs to,
   * rather than fixed by a rule promoting somebody who never agreed to it.
   */
  perform pg_temp.become(second);
  caps := public.claim_abandoned_organization(club);
  reset role;
  perform pg_temp.said('a member takes on an organization nobody is running',
    array_to_string(caps, ','), 'ADMIN');

  -- And the control for that pair: having taken it on, they are an
  -- administrator by every other measure, not just by a returned array.
  perform pg_temp.become(second);
  update public.organizations set name = 'Rowing Society' where id = club;
  reset role;
  select o.name into got from public.organizations o where o.id = club;
  perform pg_temp.said('and can do the things an administrator does', got, 'Rowing Society');

  -- ── An organization whose last member goes is deleted ─────────────────
  --
  -- The one case adminless cannot be recovered from, because there is nobody
  -- to recover it. Leaving the row would put a shell nobody can enter in a
  -- campus directory forever.

  perform pg_temp.become(solo);
  onlyone := public.start_organization('fencing', 'Fencing Club');
  reset role;
  perform pg_temp.counted('an organization with one member exists', (
    select count(*) from public.organizations o where o.id = onlyone), 1);

  delete from auth.users u where u.id = solo;
  perform pg_temp.counted('and is gone once that member is', (
    select count(*) from public.organizations o where o.id = onlyone), 0);

  /*
   * The control for the trigger, and it is the one that matters: a trigger
   * that deleted the organization on *every* departure would pass the
   * assertion above and would have deleted the rowing club three checks ago.
   * That it did not is asserted there; this says the two cases are different
   * on purpose.
   */
  perform pg_temp.counted('while an organization with members left standing still stands', (
    select count(*) from public.organizations o where o.id = club), 1);

  -- ── Forgetting, which is not leaving ──────────────────────────────────
  --
  -- `leave_organization()` refuses to touch DECLINED and REMOVED, because that
  -- is the organization's record of a decision and the person it is about is
  -- still here. An account being deleted is not still here, and `profiles`
  -- goes in the same pass — so a row left behind would be a decision about
  -- somebody nobody can identify or ask about.

  perform pg_temp.counted('somebody who was declined still has a row', (
    select count(*) from public.organization_members m
     where m.org_id = club and m.user_id = turned), 1);

  perform pg_temp.become(turned);
  n := public.forget_my_organizations();
  reset role;
  perform pg_temp.counted('forgetting takes it, which leaving would not have', n, 1);
  perform pg_temp.counted('and the row is gone', (
    select count(*) from public.organization_members m
     where m.org_id = club and m.user_id = turned), 0);

  /*
   * And it takes the sole administrator's row too, where `leave_organization`
   * refuses. Same reason: there is nobody left to appoint a successor, so the
   * refusal has nothing to offer. The organization is left adminless and, this
   * time, with no members either — so the trigger removes it.
   */
  perform pg_temp.become(second);
  n := public.forget_my_organizations();
  reset role;
  perform pg_temp.counted('the sole administrator can forget, where they could not leave', n, 1);
  perform pg_temp.counted('and the organization goes with its last member', (
    select count(*) from public.organizations o where o.id = club), 0);
end $$;

rollback;
