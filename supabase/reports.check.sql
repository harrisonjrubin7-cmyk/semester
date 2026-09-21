-- Who may read a report, and the four states one can be in.
--
-- `20260921214500_report_status.sql` changed `public.reports` from a table
-- nobody could read into one administrators can. That is a privilege
-- boundary, and a privilege boundary is only ever wrong in a way you notice
-- when a second account is involved — so this walks four of them.
--
-- What this covers:
--
--   * A verified student may still file a report, and **may not read one
--     back** — not somebody else's, and not their own. The second half is the
--     one worth stating: the obvious "let a reporter see their own" is
--     refused on purpose, because a row names a third party.
--   * A signed-out visitor reads nothing and writes nothing.
--   * An administrator reads every report, and may move its status.
--   * An administrator may **not** rewrite what was said — not the reason, not
--     the copy, not who it was about. That is a *column* grant rather than a
--     policy, because row-level security chooses rows and says nothing about
--     columns; the first draft of the migration got this wrong and claimed
--     otherwise in a comment.
--   * `status` defaults to `open`, accepts the other three, and refuses a
--     fourth value that is not on the list.
--
-- ## The control
--
-- Every assertion above except one is "cannot". A policy that refused
-- *everybody* would satisfy all of them and would also be completely broken —
-- the queue would still be unreadable, which is the defect this migration was
-- written to fix. So the administrator read is asserted by count, against a
-- known number of rows, and an administrator who reads zero fails this file.
--
-- That is the same shape `admins.check.sql` uses for `is_app_admin()` itself:
-- "A guard that answers false for everyone protects everything and is
-- indistinguishable from a guard that is broken."
--
--   How to run it: supabase/check.sh reports

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
  admin    uuid;
  alice    uuid;
  bob      uuid;
  n        bigint;
  st       text;
begin
  admin := pg_temp.newuser('admin@example.com');
  alice := pg_temp.newuser('alice@vanderbilt.edu');
  bob   := pg_temp.newuser('bob@vanderbilt.edu');

  insert into public.app_admins (user_id, note) values (admin, 'reports check');

  -- ── A student files one ─────────────────────────────────────────────────
  perform pg_temp.become(alice);
  insert into public.reports (reporter, about, reason, copy)
    values (alice, bob, 'said something worth reporting', 'the message as it stood');

  -- …and cannot read it back. Hers or anybody's.
  select count(*) into n from public.reports;
  perform pg_temp.counted('a reporter cannot read her own report back', n, 0);

  perform pg_temp.become(bob);
  insert into public.reports (reporter, about, reason, copy)
    values (bob, alice, 'a second report, from the other side', 'and its copy');
  select count(*) into n from public.reports;
  perform pg_temp.counted('nor can the person a report is about read it', n, 0);

  -- ── Signed out ──────────────────────────────────────────────────────────
  perform pg_temp.become_anon();
  select count(*) into n from public.reports;
  perform pg_temp.counted('a signed-out visitor reads no reports', n, 0);

  -- ── The administrator, and the control ──────────────────────────────────
  --
  -- Two rows went in above. If this reads 0 the policy refuses everybody, the
  -- queue is still unreadable, and every "cannot" asserted above is worthless.
  perform pg_temp.become(admin);
  select count(*) into n from public.reports;
  perform pg_temp.counted('an administrator reads every report — THE CONTROL', n, 2);

  -- A new report is open.
  select status into st from public.reports where reporter = alice;
  perform pg_temp.said('a new report is open', st, 'open');

  -- And may be moved along, through each of the other three.
  update public.reports set status = 'under_review' where reporter = alice;
  select status into st from public.reports where reporter = alice;
  perform pg_temp.said('an administrator may take it under review', st, 'under_review');

  update public.reports set status = 'resolved' where reporter = alice;
  select status into st from public.reports where reporter = alice;
  perform pg_temp.said('and resolve it', st, 'resolved');

  update public.reports set status = 'dismissed' where reporter = alice;
  select status into st from public.reports where reporter = alice;
  perform pg_temp.said('or dismiss it', st, 'dismissed');

  -- A fifth value is not a status.
  begin
    update public.reports set status = 'looked-at-briefly' where reporter = alice;
    raise exception 'FAILED: a report took a status that is not one of the four';
  exception when check_violation then
    raise notice 'ok  a status outside the four is refused';
  end;

  -- ── What an administrator may not do ────────────────────────────────────
  --
  -- The complaint is what was said at the time, and the reviewer is the last
  -- person who should be able to edit it. This is asserted rather than noted,
  -- because the first version of this file only *noted* it — and the note was
  -- raised, and `check.sh` does not print notices, so a real hole read as
  -- silence. An assertion cannot be read that way.
  --
  -- The refusal comes from the column grant, not from row-level security: RLS
  -- chooses rows and has nothing to say about columns.
  begin
    update public.reports set reason = 'something else entirely' where reporter = alice;
    raise exception 'FAILED: an administrator rewrote the complaint';
  exception when insufficient_privilege then
    raise notice 'ok  an administrator cannot rewrite the reason';
  end;

  begin
    update public.reports set copy = 'a different message' where reporter = alice;
    raise exception 'FAILED: an administrator rewrote the copy of the message';
  exception when insufficient_privilege then
    raise notice 'ok  nor the copy kept with it';
  end;

  begin
    update public.reports set about = admin where reporter = alice;
    raise exception 'FAILED: an administrator changed who a report was about';
  exception when insufficient_privilege then
    raise notice 'ok  nor who it was about';
  end;

  -- And the status still moves, after all that — otherwise the three refusals
  -- above would be satisfied by an update grant of nothing at all.
  update public.reports set status = 'open' where reporter = alice;
  select status into st from public.reports where reporter = alice;
  perform pg_temp.said('and the status still moves — THE SECOND CONTROL', st, 'open');

  -- ── Back to a student, with rows now present ────────────────────────────
  --
  -- Re-checked after the administrator's writes rather than only before them:
  -- a policy that leaked only once a row had been touched would pass the
  -- first check and fail here.
  perform pg_temp.become(alice);
  select count(*) into n from public.reports;
  perform pg_temp.counted('a student still reads nothing after review', n, 0);

  raise notice 'reports: every check passed';
end $$;

rollback;
