-- The eight characters between a student and a grant.
--
-- `family_grants` has had no way to acquire a row since it landed, because a
-- grant names its recipient and a student sharing a bill does not know their
-- parent's account id. `family_invites` is what goes first, and this suite is
-- about the two things that makes possible and the several it must not.
--
-- What this covers:
--
--   * **A code is generated, never chosen.** There is no insert policy, so a
--     student cannot write their own row, and `make_family_invite` is the only
--     way one appears.
--   * **An invite is readable by the student who made it and by nobody else**
--     — including the person holding the code. That is the one worth arguing
--     with: it means somebody who guesses eight characters cannot read the
--     categories, the resource ids or which student issued it without
--     claiming, and claiming leaves a `claimed_by`.
--   * **Claiming makes one accepted grant per category**, addressed to the
--     claimant, and the grant policies then behave exactly as they did before:
--     the claimant sees theirs, a stranger sees none.
--   * **A code is single use.** The second claim is refused, and refused
--     without having written anything.
--   * **An expired code, a revoked code and a code that never existed are the
--     same answer**, because a distinct answer for "that one was real" is an
--     oracle handed to somebody who by definition holds no valid code.
--   * **Nobody claims their own code**, which would be a grant from somebody
--     to themselves.
--   * A student may revoke, and may not rewrite what a code is worth.
--
-- ## The control this suite would be worthless without
--
-- Every refusal below is "no rows" or a word, and both are what a function
-- that does nothing at all also produces. So the claim that works comes
-- first, and each refusal is measured against a code that is identical except
-- for the one thing being tested.
--
--   How to run it: supabase/check.sh familyinvites

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

do $$
declare
  student  uuid;
  parent   uuid;
  other    uuid;
  loner    uuid;
  first    text;   -- not `code`: it is also a column on this table, and
                   -- plpgsql resolves the name to the variable inside the
                   -- UPDATEs below, which is an ambiguity Postgres refuses.
  second   text;
  n        bigint;
  word     text;
begin
  student := pg_temp.newuser('student@vanderbilt.edu');
  parent  := pg_temp.newuser('parent@example.com');
  other   := pg_temp.newuser('other@example.com');
  loner   := pg_temp.newuser('loner@vanderbilt.edu');

  -- ── A code is generated, never chosen ───────────────────────────────────
  perform pg_temp.become(student);
  begin
    insert into public.family_invites
      (code, student_id, institution_id, categories, access, grant_expires_at)
    values ('AAAAAAAA', student, 'vanderbilt', array['finances'], 'view', now() + interval '90 days');
    raise exception 'FAILED: a student wrote their own invite row';
  exception when insufficient_privilege then
    raise notice 'ok  a student cannot write an invite row directly';
  end;

  first := public.make_family_invite(array['finances', 'calendar'], 'view', array['bill-2026fa'], 90);
  perform pg_temp.said('and gets eight characters from the minter',
                       (first ~ '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$')::text, 'true');

  -- ── Who can read it ─────────────────────────────────────────────────────
  select count(*) into n from public.family_invites;
  perform pg_temp.counted('the student sees their own invite', n, 1);

  perform pg_temp.become(parent);
  select count(*) into n from public.family_invites;
  perform pg_temp.counted('the person holding the code cannot read the row', n, 0);

  perform pg_temp.become_anon();
  select count(*) into n from public.family_invites;
  perform pg_temp.counted('and a signed-out visitor cannot', n, 0);

  -- ── Claiming ────────────────────────────────────────────────────────────
  perform pg_temp.become(parent);
  select count(*) into n from public.family_grants;
  perform pg_temp.counted('the claimant holds no grants before claiming', n, 0);

  select public.claim_family_invite(first) into word;
  perform pg_temp.said('claiming a live code works', word, 'claimed');

  select count(*) into n from public.family_grants;
  perform pg_temp.counted('and makes one grant per category it carried', n, 2);

  -- Live, not pending: nothing is left to ask either party.
  set local role postgres;
  select count(*) into n from public.family_grants where accepted_at is not null;
  perform pg_temp.counted('both are accepted', n, 2);
  select count(*) into n from public.family_grants where recipient_id = parent;
  perform pg_temp.counted('and both name the claimant', n, 2);

  perform pg_temp.become(other);
  select count(*) into n from public.family_grants;
  perform pg_temp.counted('a stranger sees none of them', n, 0);

  -- ── Single use ──────────────────────────────────────────────────────────
  perform pg_temp.become(other);
  select public.claim_family_invite(first) into word;
  perform pg_temp.said('a claimed code cannot be claimed again', word, 'taken');

  set local role postgres;
  select count(*) into n from public.family_grants;
  perform pg_temp.counted('and the refused claim wrote nothing', n, 2);

  -- ── The three that answer the same ──────────────────────────────────────
  perform pg_temp.become(student);
  second := public.make_family_invite(array['finances'], 'view', array['bill'], 90);

  perform pg_temp.become(parent);
  perform pg_temp.said('a code that never existed is unknown',
                       public.claim_family_invite('ZZZZZZZZ'), 'unknown');

  set local role postgres;
  update public.family_invites set expires_at = now() - interval '1 second' where code = second;
  perform pg_temp.become(parent);
  perform pg_temp.said('an expired code is unknown, not expired',
                       public.claim_family_invite(second), 'unknown');

  -- The control for that pair: the same code, in date, is claimable. Without
  -- it "unknown" is also what a function that always says unknown returns.
  set local role postgres;
  update public.family_invites set expires_at = now() + interval '7 days' where code = second;
  perform pg_temp.become(parent);
  perform pg_temp.said('and the same code in date is claimable',
                       public.claim_family_invite(second), 'claimed');

  -- Revoked, on a third code, so the control above is not disturbed.
  perform pg_temp.become(student);
  second := public.make_family_invite(array['housing'], 'view', array['room'], 90);
  update public.family_invites set revoked_at = now() where code = second;
  perform pg_temp.become(parent);
  perform pg_temp.said('a revoked code is unknown too',
                       public.claim_family_invite(second), 'unknown');

  -- ── Nobody claims their own ─────────────────────────────────────────────
  perform pg_temp.become(student);
  second := public.make_family_invite(array['career'], 'view', array['cv'], 90);
  perform pg_temp.said('a student cannot claim their own code',
                       public.claim_family_invite(second), 'yourself');

  -- ── What a student may and may not change ───────────────────────────────
  perform pg_temp.become(student);
  update public.family_invites set revoked_at = now() where code = second;
  get diagnostics n = row_count;
  perform pg_temp.counted('a student may call off their own code', n, 1);

  perform pg_temp.become(other);
  update public.family_invites set revoked_at = null;
  get diagnostics n = row_count;
  perform pg_temp.counted('and nobody else may touch it', n, 0);

  -- ── An invite has to be worth something ─────────────────────────────────
  perform pg_temp.become(student);
  begin
    perform public.make_family_invite(array[]::text[], 'view', '{}', 90);
    raise exception 'FAILED: minted a code that grants nothing';
  exception when check_violation then
    raise notice 'ok  a code with no categories is refused';
  end;

  begin
    perform public.make_family_invite(array['finances'], 'view', '{}', 4000);
    raise exception 'FAILED: minted a code with an absurd expiry';
  exception when check_violation then
    raise notice 'ok  and so is an expiry outside one to four hundred days';
  end;

  -- ── A code outstanding is not an untouched account ──────────────────────
  --
  -- `lti_account_untouched` decides whether a Brightspace launch may attach
  -- itself to an account that already exists, and `20260921235500` walks a
  -- list of tables to answer it. The test enforcing that list only reads the
  -- SQL as text, so this is the half that proves the behaviour — and the
  -- control comes first, so the `false` is about the invite rather than about
  -- a function that says no to everybody.
  -- `loner` and nobody else, because `student` by now also holds
  -- `family_grants` rows from the claim above — and those are on the same list,
  -- so asking about `student` answers `false` whether or not `family_invites`
  -- is on it. Measured: taking the table back out of the list left that
  -- version of this check green. An account whose *only* mark is an invite is
  -- the one that isolates the entry.
  set local role postgres;
  perform pg_temp.said('an account with nothing in it is untouched',
    public.lti_account_untouched(loner)::text, 'true');

  perform pg_temp.become(loner);
  perform public.make_family_invite(array['calendar'], 'view', array['term-dates'], 30);

  set local role postgres;
  perform pg_temp.said('and the same account is not, once it holds one code and nothing else',
    public.lti_account_untouched(loner)::text, 'false');

  -- ── Signed out ──────────────────────────────────────────────────────────
  perform pg_temp.become_anon();
  begin
    perform public.make_family_invite(array['finances'], 'view', '{}', 90);
    raise exception 'FAILED: a signed-out visitor minted a code';
  exception when insufficient_privilege then
    raise notice 'ok  a signed-out visitor cannot mint one';
  end;
end $$;

rollback;
