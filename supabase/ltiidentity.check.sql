-- Which account a Brightspace launch opens, and the two proofs it takes to
-- change that.
--
-- `20260921160100_lti_identity.sql` makes one claim that everything else rests
-- on: **a platform alone cannot move an account, and a signed-in person alone
-- cannot claim a launch.** This suite is where that claim is tested rather
-- than asserted, by trying each half on its own and watching it fail.
--
-- What this covers:
--
--   * Neither table is reachable by a signed-out visitor or a signed-in
--     account, for anything. `lti_identity` says which account a launch opens;
--     a writable row there is somebody else's account.
--   * `adopt_lti_identity` is callable by a signed-in account and by nobody
--     else — deliberately, because the session is half the proof. The other
--     half is a ticket only this server mints, and a caller with a session and
--     no ticket gets nowhere.
--   * A ticket spends exactly once. The second attempt is refused, which is
--     the same replay guard `lti_nonce` has and is tested the same way.
--   * **A used account is never silently retired.** The adoption story is only
--     safe because the provisioned account is empty; this walks the case where
--     it is not and asserts both the refusal and that nothing moved.
--   * `lti_account_untouched` answers about content and not about activity. A
--     fresh account is untouched; one with a semester in it is not.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', who::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.become_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end $$;

create or replace function pg_temp.make_user(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000',
          'authenticated', 'authenticated', address, now(), now(), now());
  return who;
end $$;

create or replace function pg_temp.refused(sql text)
returns boolean language plpgsql as $$
declare n bigint;
begin
  execute sql into n;
  return coalesce(n, 0) = 0;
exception when insufficient_privilege or undefined_table or undefined_function then
  return true;
end $$;

create or replace function pg_temp.must(what text, ok boolean)
returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;

-- ── Is an account untouched? ──────────────────────────────────────────────

do $$
declare fresh uuid; used uuid;
begin
  fresh := pg_temp.make_user('fresh.lti.test@example.edu');
  used  := pg_temp.make_user('used.lti.test@example.edu');

  perform pg_temp.must('a brand new account is untouched',
    public.lti_account_untouched(fresh));

  insert into public.state (user_id, data) values (used, '{"courses":[]}'::jsonb);

  perform pg_temp.must('an account with a semester in it is not',
    not public.lti_account_untouched(used));

  /*
   * The distinction the function exists to draw. An access-log row is what
   * opening the app leaves behind; counting it would make every account look
   * used and turn every adoption into a refusal.
   */
  insert into public.access_log (user_id, what, client)
  values (fresh, 'calendar_feed', 'browser')
  on conflict do nothing;

  perform pg_temp.must('and opening the app does not make an account used',
    public.lti_account_untouched(fresh));
end $$;

-- ── The happy path: a student attaches the account they already had ───────

do $$
declare mine uuid; made uuid; said text;
begin
  mine := pg_temp.make_user('already.mine.test@example.edu');
  made := pg_temp.make_user('provisioned.one.test@example.edu');

  insert into public.lti_identity (issuer, subject, user_id, origin)
  values ('https://brightspace.test.edu', 'subject-1', made, 'provisioned');

  insert into public.lti_link_ticket (ticket, issuer, subject, provisioned_user_id, expires_at)
  values ('ticket-good', 'https://brightspace.test.edu', 'subject-1', made, now() + interval '5 minutes');

  perform pg_temp.become(mine);
  said := public.adopt_lti_identity('ticket-good');
  reset role;

  perform pg_temp.must('a signed-in student holding a launch ticket adopts the identity', said = 'ok');

  perform pg_temp.must('and the identity now points at their own account',
    (select user_id from public.lti_identity
      where issuer = 'https://brightspace.test.edu' and subject = 'subject-1') = mine);

  perform pg_temp.must('and is recorded as linked rather than provisioned',
    (select origin from public.lti_identity
      where issuer = 'https://brightspace.test.edu' and subject = 'subject-1') = 'linked');

  perform pg_temp.must('and the empty account the launch made is gone',
    not exists (select 1 from auth.users where id = made));

  /*
   * A second press of the button, refused — but note *why*, because the first
   * version of this file stopped here and was testing nothing. Deleting the
   * provisioned account cascades its ticket away, so this case is refused
   * whether or not `spent_at` is ever looked at. Removing the single-use guard
   * left the suite green. The real replay test is on the in-use path below,
   * where the account survives and the ticket has to refuse on its own.
   */
  perform pg_temp.become(mine);
  said := public.adopt_lti_identity('ticket-good');
  reset role;
  perform pg_temp.must('a second press after a successful adopt is refused', said = 'stale');
end $$;

-- ── One proof is never enough ─────────────────────────────────────────────

do $$
declare mine uuid; made uuid; said text;
begin
  mine := pg_temp.make_user('two.proofs.test@example.edu');
  made := pg_temp.make_user('provisioned.two.test@example.edu');

  insert into public.lti_identity (issuer, subject, user_id, origin)
  values ('https://brightspace.test.edu', 'subject-2', made, 'provisioned');
  insert into public.lti_link_ticket (ticket, issuer, subject, provisioned_user_id, expires_at)
  values ('ticket-two', 'https://brightspace.test.edu', 'subject-2', made, now() + interval '5 minutes');

  /*
   * A session and no ticket. This is the whole of what a malicious signed-in
   * account can bring on its own, and it must get nothing — the ticket is a
   * value only this server mints and it cannot be guessed at.
   */
  perform pg_temp.become(mine);
  said := public.adopt_lti_identity('ticket-i-made-up');
  reset role;
  perform pg_temp.must('a session with no real ticket adopts nothing', said = 'stale');

  perform pg_temp.must('and the identity has not moved',
    (select user_id from public.lti_identity
      where issuer = 'https://brightspace.test.edu' and subject = 'subject-2') = made);

  /*
   * A ticket and no session. This is the whole of what a platform can bring on
   * its own — it can cause a launch and therefore a ticket, and it still
   * cannot name an account to attach, because there is no `auth.uid()`.
   */
  perform pg_temp.become_anon();
  begin
    said := public.adopt_lti_identity('ticket-two');
  exception when insufficient_privilege then
    said := 'signed-out';
  end;
  reset role;
  perform pg_temp.must('a ticket with no session adopts nothing', said = 'signed-out');

  perform pg_temp.must('and the identity still has not moved',
    (select user_id from public.lti_identity
      where issuer = 'https://brightspace.test.edu' and subject = 'subject-2') = made);
end $$;

-- ── A used account is a merge, and a merge is refused ─────────────────────

do $$
declare mine uuid; made uuid; said text;
begin
  mine := pg_temp.make_user('late.linker.test@example.edu');
  made := pg_temp.make_user('provisioned.used.test@example.edu');

  insert into public.lti_identity (issuer, subject, user_id, origin)
  values ('https://brightspace.test.edu', 'subject-3', made, 'provisioned');
  insert into public.lti_link_ticket (ticket, issuer, subject, provisioned_user_id, expires_at)
  values ('ticket-used', 'https://brightspace.test.edu', 'subject-3', made, now() + interval '5 minutes');

  -- Three weeks of work in the account the launch made.
  insert into public.state (user_id, data) values (made, '{"courses":["econ"]}'::jsonb);

  perform pg_temp.become(mine);
  said := public.adopt_lti_identity('ticket-used');
  reset role;

  perform pg_temp.must('adopting an account that has been used is refused', said = 'in-use');
  perform pg_temp.must('the identity is left where it was',
    (select user_id from public.lti_identity
      where issuer = 'https://brightspace.test.edu' and subject = 'subject-3') = made);
  perform pg_temp.must('and nothing was deleted',
    exists (select 1 from auth.users where id = made)
    and exists (select 1 from public.state where user_id = made));

  /*
   * **The real single-use test.** The refusal above left the account standing,
   * so the ticket is still reachable and the only thing that can refuse a
   * second attempt is `spent_at`. Delete `and t.spent_at is null` from the
   * migration and this line goes red while every other line stays green —
   * which is the whole reason it is on this path and not on the happy one.
   *
   * It also pins something worth pinning: a ticket is spent by being *used*,
   * not by succeeding. An attempt that ends in a refusal has still spent it,
   * so a student cannot sit on one ticket trying accounts.
   */
  perform pg_temp.become(mine);
  said := public.adopt_lti_identity('ticket-used');
  reset role;
  perform pg_temp.must('a ticket is spent even when the attempt was refused', said = 'stale');
end $$;

-- ── Adopting the account you are already in ───────────────────────────────

do $$
declare made uuid; said text;
begin
  made := pg_temp.make_user('same.account.test@example.edu');
  insert into public.lti_identity (issuer, subject, user_id, origin)
  values ('https://brightspace.test.edu', 'subject-4', made, 'provisioned');
  insert into public.lti_link_ticket (ticket, issuer, subject, provisioned_user_id, expires_at)
  values ('ticket-same', 'https://brightspace.test.edu', 'subject-4', made, now() + interval '5 minutes');

  perform pg_temp.become(made);
  said := public.adopt_lti_identity('ticket-same');
  reset role;

  perform pg_temp.must('pressing connect while in the provisioned account says so', said = 'same-account');
  perform pg_temp.must('and does not delete the account out from under them',
    exists (select 1 from auth.users where id = made));
end $$;

-- ── An expired ticket ─────────────────────────────────────────────────────

do $$
declare mine uuid; made uuid; said text; gone integer;
begin
  mine := pg_temp.make_user('too.slow.test@example.edu');
  made := pg_temp.make_user('provisioned.expired.test@example.edu');
  insert into public.lti_identity (issuer, subject, user_id, origin)
  values ('https://brightspace.test.edu', 'subject-5', made, 'provisioned');
  insert into public.lti_link_ticket (ticket, issuer, subject, provisioned_user_id, expires_at)
  values ('ticket-old', 'https://brightspace.test.edu', 'subject-5', made, now() - interval '1 minute');

  perform pg_temp.become(mine);
  said := public.adopt_lti_identity('ticket-old');
  reset role;
  perform pg_temp.must('an expired ticket adopts nothing', said = 'stale');

  insert into public.lti_link_ticket (ticket, issuer, subject, provisioned_user_id, expires_at)
  values ('ticket-ancient', 'https://brightspace.test.edu', 'subject-5', made, now() - interval '2 hours');

  gone := public.sweep_lti_link_ticket();
  perform pg_temp.must('the sweep takes a ticket two hours past expiry', gone = 1);
  perform pg_temp.must('and leaves one that expired a minute ago, which is already refused',
    exists (select 1 from public.lti_link_ticket where ticket = 'ticket-old'));
end $$;

-- ── Neither table is reachable from a browser ─────────────────────────────

do $$
begin
  perform pg_temp.become_anon();
  perform pg_temp.must('anon reads no identity',
    pg_temp.refused('select count(*) from public.lti_identity'));
  perform pg_temp.must('anon reads no link ticket',
    pg_temp.refused('select count(*) from public.lti_link_ticket'));
  perform pg_temp.must('anon cannot point an identity at itself', pg_temp.refused($q$
    with w as (update public.lti_identity set user_id = user_id returning 1)
    select count(*) from w $q$));
  perform pg_temp.must('anon cannot mint a ticket', pg_temp.refused($q$
    with w as (
      insert into public.lti_link_ticket (ticket, issuer, subject, provisioned_user_id, expires_at)
      select 'forged', 'https://brightspace.test.edu', 's', id, now() + interval '1 hour'
        from auth.users limit 1
      returning 1)
    select count(*) from w $q$));
  perform pg_temp.must('anon cannot ask whether an account is untouched',
    pg_temp.refused($q$select count(*) from (select public.lti_account_untouched(gen_random_uuid())) t$q$));
end $$;

reset role;

do $$
declare someone uuid := '00000000-0000-4000-8000-0000000001d1';
begin
  perform pg_temp.become(someone);
  perform pg_temp.must('a signed-in account reads no identity',
    pg_temp.refused('select count(*) from public.lti_identity'));
  perform pg_temp.must('a signed-in account reads no link ticket',
    pg_temp.refused('select count(*) from public.lti_link_ticket'));
  perform pg_temp.must('a signed-in account cannot mint a ticket', pg_temp.refused($q$
    with w as (
      insert into public.lti_link_ticket (ticket, issuer, subject, provisioned_user_id, expires_at)
      select 'forged2', 'https://brightspace.test.edu', 's', id, now() + interval '1 hour'
        from auth.users limit 1
      returning 1)
    select count(*) from w $q$));
  perform pg_temp.must('a signed-in account cannot sweep tickets',
    pg_temp.refused('select public.sweep_lti_link_ticket()'));
end $$;

reset role;

rollback;
