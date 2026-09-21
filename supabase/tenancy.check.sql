-- Which university the server believes you belong to.
--
-- `20260921170000_schools.sql` added the first thing in this project that can
-- answer "same campus?" without taking the client's word for it: a `schools`
-- table, a `profiles.school_id` that only one function may write, and two
-- helpers — `private.school_of()` and `private.same_school()` — for the
-- policies that will eventually read them.
--
-- Nothing reads them yet. That is the sequencing the migration argued for and
-- it is right: every profile has `school_id` null the moment it lands, so a
-- policy requiring a claimed school would empty every room the instant it was
-- applied. The order is: this lands, an admin adds the schools, the screen
-- offers the claim, members claim, *then* the policies tighten.
--
-- ## So what is this suite for, before the policies exist
--
-- The foundation is load-bearing and entirely untested. Between now and the
-- tightening, every one of these properties can be broken by an ordinary
-- migration without anything noticing:
--
--   * the column stops being pinned, and the school becomes self-declared —
--     a longer way of writing down what somebody typed
--   * the domain check loosens, and an address the university does not
--     publish claims a seat at it
--   * `same_school()` stops being null-safe, and every student who has
--     claimed nothing becomes a classmate of every other one
--
-- The last is the one worth stating twice, because it is the failure that
-- would arrive *looking like* the feature working. `null = null` is null in
-- SQL and a policy reads null as false, which is the behaviour wanted — but
-- it is behaviour inherited from an operator rather than written down, and
-- the obvious rewrite of that expression has the opposite meaning.
--
-- ## The gap this suite does not close, and does not pretend to
--
-- There is no cross-tenant isolation in this project today. A confirmed
-- address of any domain can still enter any school's course room, because
-- `verified_student()` asks only that the address be confirmed.
-- `20260901000300_classmates_schools.sql` chose that deliberately over
-- refusing every non-Vanderbilt student outright, and said so plainly.
--
-- This file guards the machinery that closes it. It does not claim it is
-- closed. When a policy first calls `same_school()`, the assertion for that
-- policy belongs in the suite for that table, and the last section here says
-- what shape it should take.
--
--   How to run it: supabase/check.sh tenancy

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end $$;

/**
 * A user with a confirmed address, and a profile for them to claim into.
 *
 * `claim_school` updates `public.profiles` and returns whether it matched
 * nothing, so a user without a profile row would take the happy path through
 * every assertion below while writing to no row at all. Creating the profile
 * here is not setup convenience; it is what makes a pass mean something.
 */
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

/** Whether `claim_school` refused, rather than what it said. */
create or replace function pg_temp.refused(who uuid, want text)
returns boolean language plpgsql as $$
begin
  perform pg_temp.become(who);
  perform public.claim_school(want);
  return false;
exception
  when insufficient_privilege then return true;
end $$;

-- ── The addresses a school publishes are the whole of the check ──────────

do $$
declare
  ok_user   uuid;
  bad_user  uuid;
  unconf    uuid;
  landed    text;
begin
  set local role postgres;

  insert into public.schools (id, name, email_domains) values
    ('northern', 'Northern University', array['northern.edu', 'ALUMNI.Northern.edu']),
    ('southern', 'Southern University', array['southern.edu']),
    ('closed',   'Closed University',   array[]::text[]);

  ok_user  := pg_temp.newuser('ada@northern.edu');
  bad_user := pg_temp.newuser('bob@southern.edu');
  unconf   := pg_temp.newuser('cal@northern.edu', false);

  -- The address the school publishes, claimed by the person holding it.
  perform pg_temp.become(ok_user);
  perform public.claim_school('northern');

  set local role postgres;
  select school_id into landed from public.profiles where user_id = ok_user;
  if landed is distinct from 'northern' then
    raise exception
      'FAILED: an address northern.edu publishes did not claim it (got %)',
      coalesce(landed, 'null');
  end if;
  raise notice 'ok  a published address claims the school that publishes it';

  -- The control. Without it, a `claim_school` that admitted everybody would
  -- pass the assertion above and look exactly like a working one.
  if not pg_temp.refused(bad_user, 'northern') then
    raise exception
      'FAILED: a southern.edu address claimed northern — the domain list is not '
      'being checked, and any confirmed address can take a seat at any school';
  end if;
  raise notice 'ok  an address the school does not publish is refused';

  -- A school that publishes nothing admits nobody. Empty is a better state
  -- than a wrong domain: it refuses everybody rather than admitting the
  -- wrong body.
  if not pg_temp.refused(ok_user, 'closed') then
    raise exception
      'FAILED: a school with no published domains admitted somebody';
  end if;
  raise notice 'ok  a school that publishes no domain admits nobody';

  -- Confirmation is the thing that makes the address evidence. Without it the
  -- address is one somebody typed, and the column would be self-declaration
  -- again by a longer route.
  if not pg_temp.refused(unconf, 'northern') then
    raise exception
      'FAILED: an unconfirmed address claimed a school — the confirmation check '
      'is not running, so the column records a claim rather than a fact';
  end if;
  raise notice 'ok  an unconfirmed address cannot claim anything';
end $$;

-- ── Case, and where the domain is taken from ─────────────────────────────
--
-- Both halves are compared lower case, and the domain is read from the last
-- '@' rather than the first. `split_part(addr, '@', 2)` on `"a@b"@northern.edu`
-- yields `b"` and matches nothing — which fails closed, but for the wrong
-- reason, and would refuse a real student holding a legitimately quoted local
-- part. The school row above publishes `ALUMNI.Northern.edu` in mixed case on
-- purpose, so the comparison is exercised from both sides at once.

do $$
declare
  mixed  uuid;
  quoted uuid;
  landed text;
begin
  set local role postgres;

  mixed  := pg_temp.newuser('dee@Alumni.NORTHERN.edu');
  quoted := pg_temp.newuser('"e@f"@northern.edu');

  perform pg_temp.become(mixed);
  perform public.claim_school('northern');

  set local role postgres;
  select school_id into landed from public.profiles where user_id = mixed;
  if landed is distinct from 'northern' then
    raise exception
      'FAILED: a published domain in different case was refused — the compare '
      'is case-sensitive on one side';
  end if;
  raise notice 'ok  the domain compare ignores case on both sides';

  perform pg_temp.become(quoted);
  perform public.claim_school('northern');

  set local role postgres;
  select school_id into landed from public.profiles where user_id = quoted;
  if landed is distinct from 'northern' then
    raise exception
      'FAILED: an address with an @ in a quoted local part was refused — the '
      'domain is being taken from the first @ rather than the last';
  end if;
  raise notice 'ok  the domain is read from the last @, not the first';
end $$;

-- ── The column is pinned, and that is the entire point ───────────────────
--
-- If a student could `update profiles set school_id = 'northern'`, this column
-- would be exactly as strong as the client check it replaces. A column
-- privilege rather than a trigger, so that `claim_school`'s owner keeps the
-- one legitimate way in while the API roles have none.

do $$
declare
  person uuid;
  fresh  uuid;
  landed text;
begin
  set local role postgres;
  person := pg_temp.newuser('fay@southern.edu');

  perform pg_temp.become(person);
  begin
    update public.profiles set school_id = 'northern' where user_id = person;
    raise exception
      'FAILED: a signed-in account wrote school_id directly — the column is not '
      'pinned, so the school is self-declared and proves nothing';
  exception
    when insufficient_privilege then null;
  end;

  set local role postgres;
  select school_id into landed from public.profiles where user_id = person;
  if landed is not null then
    raise exception 'FAILED: school_id is % after a refused write', landed;
  end if;
  raise notice 'ok  school_id cannot be written by the account it describes';

  -- The same hole by the other verb. A pin that closes UPDATE and leaves
  -- INSERT open is not a pin: a profile does not exist until the client
  -- creates one, and `lib/classmates.ts` creates it with an upsert. Setting
  -- the column on the way in needs no update privilege at all.
  set local role postgres;
  fresh := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (fresh, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'gus@southern.edu', now(), now(), now());

  perform pg_temp.become(fresh);
  begin
    insert into public.profiles (user_id, handle, school_id)
    values (fresh, 'someone', 'northern');
  exception
    when insufficient_privilege then null;
  end;

  set local role postgres;
  select school_id into landed from public.profiles where user_id = fresh;
  if landed is not null then
    raise exception
      'FAILED: a new profile was created with school_id already set to % — the '
      'column is pinned against UPDATE and open on INSERT, and the client '
      'creates this row with an upsert', landed;
  end if;
  raise notice 'ok  school_id cannot be set when the profile is created either';

  -- The other half of the pin: the domain list itself. Anyone who can write
  -- `email_domains` can admit anyone, which makes it exactly as sensitive as
  -- the column above.
  perform pg_temp.become(person);
  begin
    update public.schools set email_domains = array['southern.edu'] where id = 'northern';
  exception
    when insufficient_privilege then null;
  end;

  set local role postgres;
  if exists (
    select 1 from public.schools
     where id = 'northern'
       and exists (select 1 from unnest(email_domains) d where lower(d) = 'southern.edu')
  ) then
    raise exception
      'FAILED: an ordinary account added a domain to another school — anybody '
      'who can write email_domains can admit anybody';
  end if;
  raise notice 'ok  an ordinary account cannot change which addresses a school publishes';
end $$;

-- ── same_school(), and the null that has to stay false ───────────────────

do $$
declare
  north_a uuid;
  north_b uuid;
  south   uuid;
  blank_a uuid;
  blank_b uuid;
  says    boolean;
begin
  set local role postgres;

  north_a := pg_temp.newuser('gil@northern.edu');
  north_b := pg_temp.newuser('hal@northern.edu');
  south   := pg_temp.newuser('ivy@southern.edu');
  blank_a := pg_temp.newuser('jan@northern.edu');
  blank_b := pg_temp.newuser('kit@northern.edu');

  perform pg_temp.become(north_a); perform public.claim_school('northern');
  perform pg_temp.become(north_b); perform public.claim_school('northern');
  perform pg_temp.become(south);   perform public.claim_school('southern');

  -- Two who claimed the same school.
  perform pg_temp.become(north_a);
  select private.same_school(north_b) into says;
  if says is not true then
    raise exception
      'FAILED: two students who both claimed northern are not same_school — the '
      'helper answers false for everybody, which protects everything and is '
      'indistinguishable from a broken one';
  end if;
  raise notice 'ok  two who claimed one school are the same school';

  -- Two who claimed different ones. The control for the above.
  select private.same_school(south) into says;
  if says is not false then
    raise exception
      'FAILED: northern and southern came back same_school (got %)',
      coalesce(says::text, 'null');
  end if;
  raise notice 'ok  two who claimed different schools are not';

  -- Neither has claimed. This is the one that would arrive looking like the
  -- feature working: on the day the policies tighten, a `same_school` that
  -- answered true here would make every unclaimed student a classmate of
  -- every other unclaimed student, campus-wide, in one deploy.
  perform pg_temp.become(blank_a);
  select private.same_school(blank_b) into says;
  if says is not false then
    raise exception
      'FAILED: two students who have claimed nothing came back same_school (got %) '
      '— null is being read as a match, and every unclaimed profile is now a '
      'classmate of every other one',
      coalesce(says::text, 'null');
  end if;
  raise notice 'ok  two who have claimed nothing are not thereby classmates';

  -- One claimed, one not. The asymmetric case, which a null-handling bug can
  -- get right in one direction and wrong in the other.
  perform pg_temp.become(north_a);
  select private.same_school(blank_a) into says;
  if says is not false then
    raise exception 'FAILED: a claimed student matched an unclaimed one';
  end if;

  perform pg_temp.become(blank_a);
  select private.same_school(north_a) into says;
  if says is not false then
    raise exception 'FAILED: an unclaimed student matched a claimed one';
  end if;
  raise notice 'ok  a claimed and an unclaimed student match in neither direction';
end $$;

-- ── What this file will need when the policies tighten ───────────────────
--
-- Nothing above asserts isolation, because nothing enforces it. When the first
-- policy calls `private.same_school()`, the assertion for it belongs with that
-- table's own suite — `classmates.check.sql` for rooms — and it needs three
-- cases, not one:
--
--   1. a member of the school reads the room                 (it still works)
--   2. a confirmed address at another school does not        (the isolation)
--   3. a member who has claimed nothing does not             (the cutover)
--
-- The third is the one that decides whether the tightening is deployable. On
-- the day it lands every existing member has `school_id` null, so case 3 is
-- not an edge — it is everybody. Either the rollout waits for claims, or the
-- policy accepts null as a grandfathered member and says for how long.
--
-- A suite that checked only case 2 would go green on a policy that locked the
-- entire user base out of its own rooms.

rollback;
