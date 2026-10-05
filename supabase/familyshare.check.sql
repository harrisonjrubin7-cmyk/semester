-- supabase/familyshare.check.sql — what a supporter reads, and the log of it.
--
-- For 20260928307000_family_shared_items.sql, slice 3 of the owner-approved
-- consent design (D-037). The design's own list of what every slice's check
-- suite must prove (§8), and where each is below:
--
--   * a non-recipient reads nothing                  — "a stranger"
--   * an expired, revoked or unaccepted share reads nothing
--                                                    — "ending a share"
--   * every read is logged                           — "the log"
--   * the student can list and revoke                — "the student's side"
--
-- Plus what this migration adds: content travels only with a confirmed code,
-- and only the items the code names, each in the category it names.
--
-- ## The control
--
-- Every refusal here is "no rows", which is also what a reader that returns
-- nothing to anybody produces. So the read that works comes first, and each
-- refusal after it changes one thing about the same grant.
--
--   How to run it: supabase/check.sh familyshare

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
  student uuid;
  parent  uuid;
  other   uuid;
  loner   uuid;
  second  uuid;
  again   text;
  before  uuid[];
  given   text;
  n       bigint;
  word    text;
  two     constant jsonb := '[
    {"id": "bill", "category": "finances", "kind": "budget", "title": "Spring tuition bill",
     "body": "Due before classes start.", "due": "2027-01-05", "done": false, "amount": 1200},
    {"id": "exam", "category": "calendar", "kind": "information", "title": "Finals week",
     "body": "", "due": "2026-12-10", "done": false, "amount": 0}
  ]';
begin
  student := pg_temp.newuser('student@vanderbilt.edu');
  parent  := pg_temp.newuser('parent@example.com');
  other   := pg_temp.newuser('other@example.com');
  loner   := pg_temp.newuser('loner@vanderbilt.edu');
  second  := pg_temp.newuser('second@example.com');

  -- ── Content travels only with a confirmed code ──────────────────────────
  perform pg_temp.become(student);
  begin
    insert into public.family_shared_items (student_id, item_id, shown_as, category, kind, title)
    values (student, 'bill', 'Sam', 'finances', 'budget', 'Spring tuition bill');
    raise exception 'FAILED: a student stored a copy with no code';
  exception when insufficient_privilege then
    raise notice 'ok  a copy cannot be written on its own';
  end;

  -- The refusals first, each against the share that works below, and each
  -- measured as writing nothing — no code and no copy.
  begin
    perform public.make_family_share(array['finances', 'calendar'], array['bill', 'exam'], 90,
      two || '[{"id": "extra", "category": "finances", "kind": "information", "title": "Not named"}]'::jsonb, 'Sam');
    raise exception 'FAILED: an item the code does not name was stored';
  exception when check_violation then
    raise notice 'ok  an item the code does not name is refused';
  end;
  begin
    perform public.make_family_share(array['finances', 'calendar'], array['bill', 'exam'], 90,
      jsonb_build_array(two->0), 'Sam');
    raise exception 'FAILED: a code naming an item it does not carry was made';
  exception when check_violation then
    raise notice 'ok  a named item that is not carried is refused';
  end;
  begin
    perform public.make_family_share(array['finances'], array['bill', 'exam'], 90, two, 'Sam');
    raise exception 'FAILED: an item outside the code''s categories was stored';
  exception when check_violation then
    raise notice 'ok  an item in a category the code does not cover is refused';
  end;
  begin
    perform public.make_family_share(array['finances', 'calendar'], array['bill', 'exam'], 90, two, '  ');
    raise exception 'FAILED: a share with no name to show was made';
  exception when check_violation then
    raise notice 'ok  a share must say how the student is named';
  end;
  begin
    perform public.make_family_share(array['finances', 'calendar'], array['bill', 'exam'], 201, two, 'Sam');
    raise exception 'FAILED: a share past 200 days was made';
  exception when check_violation then
    raise notice 'ok  and the invite''s own rules still apply (201 days refused)';
  end;
  select count(*) into n from public.family_invites;
  perform pg_temp.counted('and every refusal left no code', n, 0);
  select count(*) into n from public.family_shared_items;
  perform pg_temp.counted('and no copy', n, 0);

  given := public.make_family_share(array['finances', 'calendar'], array['bill', 'exam'], 90, two, ' Sam ');
  select count(*) into n from public.family_shared_items;
  perform pg_temp.counted('a matching share stores exactly its items', n, 2);
  select count(*) into n from public.family_invites where code = given;
  perform pg_temp.counted('with its code', n, 1);

  -- A copy that exists but that no grant names, planted behind the function's
  -- back. It must never be returned: the reader follows the grant's list.
  set local role postgres;
  insert into public.family_shared_items (student_id, code, item_id, shown_as, category, kind, title)
  values (student, given, 'secret', 'Sam', 'finances', 'information', 'Not for anyone');

  -- ── Before a claim, nobody reads anything ───────────────────────────────
  perform pg_temp.become(parent);
  select count(*) into n from public.read_family_share();
  perform pg_temp.counted('an unclaimed code shows the holder nothing', n, 0);
  set local role postgres;
  select count(*) into n from public.family_access_events;
  perform pg_temp.counted('and a read with no live grant logs nothing', n, 0);

  -- ── The read that works ─────────────────────────────────────────────────
  perform pg_temp.become(parent);
  perform pg_temp.said('the parent claims', public.claim_family_invite(given), 'claimed');
  select count(*) into n from public.read_family_share();
  perform pg_temp.counted('and reads exactly the two named items', n, 2);
  select count(*) into n from public.read_family_share() r where r.item_id = 'secret';
  perform pg_temp.counted('never the copy no grant names', n, 0);
  select r.shown_as into word from public.read_family_share() r limit 1;
  perform pg_temp.said('named as the student chose, trimmed', word, 'Sam');
  select r.amount::text into word from public.read_family_share() r where r.item_id = 'bill';
  perform pg_temp.said('with the content as confirmed', word, '1200');

  -- ── Sharing the same item again changes nobody else's copy ─────────────
  -- The bill changes, and the student shares it with somebody else. What the
  -- parent confirmed against was 1200, and that is what the parent still sees;
  -- the second supporter sees the new copy. Before copies were kept per code,
  -- the second share rewrote the one row both grants read.
  set local role postgres;
  select coalesce(array_agg(id), '{}') into before from public.family_access_events;
  perform pg_temp.become(student);
  again := public.make_family_share(array['finances'], array['bill'], 90,
    '[{"id": "bill", "category": "finances", "kind": "budget", "title": "Spring tuition bill",
       "body": "Revised.", "due": "2027-01-05", "done": false, "amount": 1500}]', 'Sam');
  perform pg_temp.become(parent);
  select r.amount::text into word from public.read_family_share() r where r.item_id = 'bill';
  perform pg_temp.said('a later share of the same item leaves the parent''s copy as confirmed', word, '1200');
  select count(*) into n from public.read_family_share();
  perform pg_temp.counted('and the parent still reads exactly two items', n, 2);
  perform pg_temp.become(second);
  perform pg_temp.said('the second supporter claims', public.claim_family_invite(again), 'claimed');
  select r.amount::text into word from public.read_family_share() r where r.item_id = 'bill';
  perform pg_temp.said('and reads the copy confirmed for them', word, '1500');
  -- Put things back for what follows: that share, its grant and its copy.
  set local role postgres;
  delete from public.family_grants where recipient_id = second;
  delete from public.family_invites where code = again;
  delete from public.family_access_events where not (id = any(before));
  select count(*) into n from public.family_shared_items where code = again;
  perform pg_temp.counted('a code''s copies go with it', n, 0);
  perform pg_temp.become(parent);

  -- The supporter reads through the function and nowhere else.
  select count(*) into n from public.family_shared_items;
  perform pg_temp.counted('the parent cannot select the copies directly', n, 0);
  select count(*) into n from public.family_access_events;
  perform pg_temp.counted('nor read the log about them', n, 0);
  delete from public.family_access_events;
  set local role postgres;
  select count(*) into n from public.family_access_events;
  perform pg_temp.counted('nor delete it (four reads above, four rows remain)', n, 4);
  perform pg_temp.become(parent);
  begin
    insert into public.family_access_events (student_id, reader_id) values (student, parent);
    raise exception 'FAILED: a reader wrote their own log row';
  exception when insufficient_privilege then
    raise notice 'ok  nor write to it';
  end;

  -- ── The log ─────────────────────────────────────────────────────────────
  perform pg_temp.become(student);
  select count(*) into n from public.family_access_events where reader_id = parent;
  perform pg_temp.counted('the student sees every read, by who', n, 4);
  select cardinality(item_ids) into n from public.family_access_events limit 1;
  perform pg_temp.counted('and which items each returned', n, 2);

  -- ── A stranger ──────────────────────────────────────────────────────────
  perform pg_temp.become(other);
  select count(*) into n from public.read_family_share();
  perform pg_temp.counted('a stranger reads nothing', n, 0);
  set local role postgres;
  select count(*) into n from public.family_access_events where reader_id = other;
  perform pg_temp.counted('and is not logged as having read', n, 0);

  -- ── Ending a share, one grant at a time ─────────────────────────────────
  -- Revoked, by the student, through the policy they already had.
  perform pg_temp.become(student);
  update public.family_grants set revoked_at = now() where category = 'finances';
  perform pg_temp.become(parent);
  select count(*) into n from public.read_family_share();
  perform pg_temp.counted('a revoked grant stops at the next read; the other still shows', n, 1);

  -- Payment reads nothing (D5).
  set local role postgres;
  update public.family_grants set access = 'payment' where category = 'calendar';
  perform pg_temp.become(parent);
  select count(*) into n from public.read_family_share();
  perform pg_temp.counted('a payment grant shows nothing', n, 0);
  set local role postgres;
  update public.family_grants set access = 'selected' where category = 'calendar';

  -- Unaccepted.
  update public.family_grants set accepted_at = null where category = 'calendar';
  perform pg_temp.become(parent);
  select count(*) into n from public.read_family_share();
  perform pg_temp.counted('an unaccepted grant shows nothing', n, 0);
  set local role postgres;
  update public.family_grants set accepted_at = now() - interval '1 minute' where category = 'calendar';

  -- The control between the two: restored, it reads again.
  perform pg_temp.become(parent);
  select count(*) into n from public.read_family_share();
  perform pg_temp.counted('restored, the same grant reads again', n, 1);

  -- Expired.
  set local role postgres;
  update public.family_grants set expires_at = now() - interval '1 second' where category = 'calendar';
  perform pg_temp.become(parent);
  select count(*) into n from public.read_family_share();
  perform pg_temp.counted('an expired grant shows nothing', n, 0);

  -- ── The student's side ──────────────────────────────────────────────────
  perform pg_temp.become(student);
  select count(*) into n from public.family_shared_items;
  perform pg_temp.counted('the student sees their own copies', n, 3);
  delete from public.family_shared_items where item_id = 'secret';
  select count(*) into n from public.family_shared_items;
  perform pg_temp.counted('and can remove one', n, 2);
  delete from public.family_access_events;
  select count(*) into n from public.family_access_events;
  perform pg_temp.counted('and can clear their own log, as deleting the account does', n, 0);

  -- ── A copy is a used account ────────────────────────────────────────────
  set local role postgres;
  perform pg_temp.said('an account with nothing in it is untouched',
    public.lti_account_untouched(loner)::text, 'true');
  -- A copy needs a code, and any existing code will do for this.
  insert into public.family_shared_items (student_id, code, item_id, shown_as, category, kind, title)
  values (loner, given, 'x', 'L', 'housing', 'information', 'Room');
  perform pg_temp.said('and not once it holds a copy and nothing else',
    public.lti_account_untouched(loner)::text, 'false');
  delete from public.family_shared_items where student_id = loner;
  insert into public.family_access_events (student_id) values (loner);
  perform pg_temp.said('or a read log and nothing else',
    public.lti_account_untouched(loner)::text, 'false');

  -- ── Signed out ──────────────────────────────────────────────────────────
  perform pg_temp.become_anon();
  begin
    perform public.read_family_share();
    raise exception 'FAILED: a signed-out visitor called the reader';
  exception when insufficient_privilege then
    raise notice 'ok  a signed-out visitor cannot read';
  end;
  begin
    perform public.make_family_share(array['finances'], array['bill'], 90, jsonb_build_array(two->0), 'Sam');
    raise exception 'FAILED: a signed-out visitor made a share';
  exception when insufficient_privilege then
    raise notice 'ok  or share';
  end;
end $$;

rollback;
