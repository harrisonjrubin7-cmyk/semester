-- What a parent can see, and the four states in which the answer is nothing.
--
-- `public.family_grants` is `FamilyGrant` from `packages/institution` stored in
-- Postgres, and the row policy on it is that interface's `live` test:
-- accepted, not accepted in the future, not revoked, not expired. This suite
-- walks a student and a parent through the states either side of that line.
--
-- What this covers:
--
--   * **An unlinked parent gets nothing.** The baseline, and the one that
--     would be worth writing even if it could not fail.
--   * **A linked but unaccepted grant gets nothing**, which is the consent
--     step. A grant nobody accepted is not one.
--   * **A revoked grant, an expired grant and a grant accepted in the future**
--     each get nothing, separately, because they are separate clauses and a
--     suite that tested them together would pass with two of them deleted.
--   * **An accepted, live grant is visible to the person it names** — and to
--     nobody else, including a second parent with their own live grant from
--     the same student.
--   * **A recipient cannot accept their way past the student.** Accepting is
--     `accept_family_grant`, and it refuses a grant addressed to somebody
--     else, an already-revoked one and an expired one.
--   * **A recipient cannot re-scope what they were given.** The UPDATE policy
--     names the student only, which is the reason accepting is a function at
--     all: a policy that let the recipient write would let them write
--     `resource_ids`.
--   * **A student cannot write a grant that is already accepted**, which is
--     the same consent step from the other side.
--
-- ## The controls, and why this file would be wrong without them
--
-- Four of the checks below assert that somebody sees no rows, and `CLAUDE.md`
-- is blunt about what that is worth on its own: a probe that reads zero for
-- everything reads zero for the things that are working too. The first
-- version of this suite had exactly that bug — `become()` was called with the
-- parent's id before the grant was inserted, so every read was empty and
-- every check passed, including the one that was supposed to prove a live
-- grant *is* visible.
--
-- So each "sees nothing" is paired: the same account, the same query, with the
-- one disqualifying field put right, sees exactly one row. A zero that cannot
-- be turned into a one is not evidence.
--
--   How to run it: supabase/check.sh family

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
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          address, now(), now(), now());
  return who;
end $$;

/**
 * A grant in whatever state the caller names, written as the owner.
 *
 * Inserted with the row policies out of the way — `set local role postgres` —
 * because several of the states this suite needs are ones the insert policy
 * correctly refuses to create. A grant that is already accepted is the clearest
 * of them: the policy forbids writing one, and the suite still has to be able
 * to put one in front of a reader to prove the *select* side separately.
 */
create or replace function pg_temp.grantrow(
  student uuid, recipient uuid, cat text, acc text, resources text[],
  accepted timestamptz, expires timestamptz, revoked timestamptz)
returns uuid language plpgsql as $$
declare id uuid;
begin
  insert into public.family_grants
    (institution_id, student_id, recipient_id, category, access,
     resource_ids, accepted_at, expires_at, revoked_at)
  values ('vanderbilt', student, recipient, cat, acc,
          resources, accepted, expires, revoked)
  returning family_grants.id into id;
  return id;
end $$;

do $$
declare
  student   uuid;
  parent    uuid;
  other     uuid;
  stranger  uuid;
  nobody    uuid;
  live      uuid;
  pending   uuid;
  n         bigint;
  ok        boolean;
begin
  student  := pg_temp.newuser('student@vanderbilt.edu');
  parent   := pg_temp.newuser('parent@example.com');
  other    := pg_temp.newuser('other-parent@example.com');
  stranger := pg_temp.newuser('stranger@example.com');
  -- Party to nothing, ever. `stranger` is made the recipient of a control
  -- grant further down, so it stops being a stranger halfway through the file
  -- — which is precisely what the final delete check caught when it was used
  -- there. An account that is never any grant's student or recipient is the
  -- only honest subject for "sees nothing, deletes nothing".
  nobody   := pg_temp.newuser('nobody@example.com');

  -- ── (a) An unlinked parent ──────────────────────────────────────────────
  perform pg_temp.become(parent);
  select count(*) into n from public.family_grants;
  perform pg_temp.counted('an unlinked parent sees no grants', n, 0);

  -- ── (b) Linked, not yet accepted ────────────────────────────────────────
  set local role postgres;
  pending := pg_temp.grantrow(student, parent, 'finances', 'view',
                              array['bill-2026fa'], null, now() + interval '30 days', null);

  perform pg_temp.become(parent);
  select count(*) into n from public.family_grants;
  perform pg_temp.counted('an invited parent sees nothing until they accept', n, 0);

  -- The control for it: the same row, the same reader, accepted.
  set local role postgres;
  update public.family_grants set accepted_at = now() where id = pending;
  perform pg_temp.become(parent);
  select count(*) into n from public.family_grants;
  perform pg_temp.counted('and sees it once it is accepted', n, 1);

  -- ── Each disqualifying clause, on its own ───────────────────────────────
  -- Revoked.
  set local role postgres;
  update public.family_grants set revoked_at = now() where id = pending;
  perform pg_temp.become(parent);
  select count(*) into n from public.family_grants;
  perform pg_temp.counted('a revoked grant shows nothing', n, 0);

  set local role postgres;
  update public.family_grants set revoked_at = null where id = pending;
  perform pg_temp.become(parent);
  select count(*) into n from public.family_grants;
  perform pg_temp.counted('and comes back when the revocation is lifted', n, 1);

  -- Expired.
  set local role postgres;
  update public.family_grants set expires_at = now() - interval '1 day' where id = pending;
  perform pg_temp.become(parent);
  select count(*) into n from public.family_grants;
  perform pg_temp.counted('an expired grant shows nothing', n, 0);

  set local role postgres;
  update public.family_grants set expires_at = now() + interval '30 days' where id = pending;

  -- Accepted in the future, which is the clause a suite forgets.
  set local role postgres;
  update public.family_grants set accepted_at = now() + interval '1 day' where id = pending;
  perform pg_temp.become(parent);
  select count(*) into n from public.family_grants;
  perform pg_temp.counted('a grant accepted in the future shows nothing', n, 0);

  set local role postgres;
  update public.family_grants set accepted_at = now() - interval '1 minute' where id = pending;
  live := pending;

  -- ── (c) The right parent, and only the right parent ─────────────────────
  perform pg_temp.become(parent);
  select count(*) into n from public.family_grants;
  perform pg_temp.counted('the named parent sees exactly their own grant', n, 1);

  perform pg_temp.said('and it is the category they were given',
    (select category from public.family_grants limit 1), 'finances');

  -- A second parent, with their own live grant from the same student, sees
  -- theirs and never the first one. This is the check that a policy written
  -- with `or` instead of `and` would fail.
  set local role postgres;
  perform pg_temp.grantrow(student, other, 'calendar', 'selected',
                           array['term-dates'], now() - interval '1 minute',
                           now() + interval '30 days', null);

  perform pg_temp.become(other);
  select count(*) into n from public.family_grants;
  perform pg_temp.counted('a second parent sees only their own', n, 1);
  perform pg_temp.said('and it is their category, not the other parent''s',
    (select category from public.family_grants limit 1), 'calendar');

  perform pg_temp.become(stranger);
  select count(*) into n from public.family_grants;
  perform pg_temp.counted('a stranger sees none of them', n, 0);

  perform pg_temp.become_anon();
  select count(*) into n from public.family_grants;
  perform pg_temp.counted('and a signed-out visitor sees none of them', n, 0);

  -- ── The student's own side ──────────────────────────────────────────────
  perform pg_temp.become(student);
  select count(*) into n from public.family_grants;
  perform pg_temp.counted('the student sees both grants they made', n, 2);

  set local role postgres;
  update public.family_grants set revoked_at = now() where id = live;
  perform pg_temp.become(student);
  select count(*) into n from public.family_grants;
  perform pg_temp.counted('including the one they just revoked', n, 2);

  set local role postgres;
  update public.family_grants set revoked_at = null where id = live;

  -- ── Accepting ───────────────────────────────────────────────────────────
  set local role postgres;
  pending := pg_temp.grantrow(student, parent, 'academic', 'view',
                              array['gpa'], null, now() + interval '30 days', null);

  -- The wrong person cannot accept it.
  perform pg_temp.become(other);
  select public.accept_family_grant(pending) into ok;
  perform pg_temp.said('a grant addressed to somebody else cannot be accepted',
                       ok::text, 'false');

  -- Nor can a stranger, and nor can the student on the parent's behalf.
  perform pg_temp.become(student);
  select public.accept_family_grant(pending) into ok;
  perform pg_temp.said('the student cannot accept on the parent''s behalf',
                       ok::text, 'false');

  -- The named recipient can, once.
  perform pg_temp.become(parent);
  select public.accept_family_grant(pending) into ok;
  perform pg_temp.said('the named recipient can accept it', ok::text, 'true');

  select public.accept_family_grant(pending) into ok;
  perform pg_temp.said('and accepting twice changes nothing', ok::text, 'false');

  -- ── A recipient cannot re-scope what they were given ────────────────────
  perform pg_temp.become(parent);
  update public.family_grants
     set resource_ids = array['gpa', 'transcript', 'bill-2026fa']
   where id = pending;
  get diagnostics n = row_count;
  perform pg_temp.counted('a recipient cannot widen their own grant', n, 0);

  update public.family_grants set expires_at = now() + interval '900 days' where id = pending;
  get diagnostics n = row_count;
  perform pg_temp.counted('nor extend it', n, 0);

  -- The control: the student can do both.
  perform pg_temp.become(student);
  update public.family_grants set resource_ids = array['gpa', 'transcript'] where id = pending;
  get diagnostics n = row_count;
  perform pg_temp.counted('and the student can', n, 1);

  -- ── A grant cannot be born accepted ─────────────────────────────────────
  perform pg_temp.become(student);
  begin
    insert into public.family_grants
      (institution_id, student_id, recipient_id, category, access,
       resource_ids, accepted_at, expires_at)
    values ('vanderbilt', student, stranger, 'finances', 'view',
            array['bill'], now(), now() + interval '30 days');
    raise exception 'FAILED: a student wrote a grant that was already accepted';
  exception when insufficient_privilege then
    raise notice 'ok  a grant cannot be written already accepted';
  end;

  -- The control: the same insert, unaccepted, goes in.
  insert into public.family_grants
    (institution_id, student_id, recipient_id, category, access,
     resource_ids, expires_at)
  values ('vanderbilt', student, stranger, 'finances', 'view',
          array['bill'], now() + interval '30 days');
  raise notice 'ok  and the same grant goes in unaccepted';

  -- ── Nobody grants themselves anything ───────────────────────────────────
  begin
    insert into public.family_grants
      (institution_id, student_id, recipient_id, category, access,
       resource_ids, expires_at)
    values ('vanderbilt', student, student, 'finances', 'view',
            array['bill'], now() + interval '30 days');
    raise exception 'FAILED: a student granted themselves';
  exception when check_violation or insufficient_privilege then
    raise notice 'ok  a grant from somebody to themselves is refused';
  end;

  -- ── A shared account is not an untouched one ────────────────────────────
  --
  -- `lti_account_untouched` decides whether a Brightspace launch may attach
  -- itself to an account that already exists, and `20260921160100` walks a
  -- list of tables to answer it. `family_grants` was added to that list by the
  -- migration this suite covers, and the test that enforces the list only
  -- reads the SQL as text — so this is the half that proves the behaviour.
  --
  -- The control comes first and is the point: an account with nothing in it
  -- reads as untouched, so the `false` below is a fact about the grant rather
  -- than about a function that says no to everybody.
  set local role postgres;
  perform pg_temp.said('an account with nothing in it is untouched',
    public.lti_account_untouched(nobody)::text, 'true');

  perform pg_temp.said('and a student who has shared something is not',
    public.lti_account_untouched(student)::text, 'false');

  -- ── Deletion, which is the privacy page's promise ───────────────────────
  perform pg_temp.become(parent);
  delete from public.family_grants where id = pending;
  get diagnostics n = row_count;
  perform pg_temp.counted('a recipient can delete a grant addressed to them', n, 1);

  perform pg_temp.become(student);
  delete from public.family_grants where id = live;
  get diagnostics n = row_count;
  perform pg_temp.counted('and a student can delete one they made', n, 1);

  perform pg_temp.become(nobody);
  select count(*) into n from public.family_grants;
  perform pg_temp.counted('an account party to nothing sees nothing', n, 0);

  delete from public.family_grants;
  get diagnostics n = row_count;
  perform pg_temp.counted('and deletes nothing', n, 0);

  -- The control for both: the rows are still there, as the student.
  perform pg_temp.become(student);
  select count(*) into n from public.family_grants;
  perform pg_temp.counted('while the student still has theirs', n, 2);
end $$;

rollback;
