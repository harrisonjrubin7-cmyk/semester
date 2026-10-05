-- Moderation actions must leave immutable, metadata-minimized evidence.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', who::text, 'role', 'authenticated'
  )::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

do $$
declare
  moderator uuid;
  alice uuid;
  bob uuid;
  report uuid;
  event uuid;
  n bigint;
  actor_hash text;
  reporter_hash text;
begin
  moderator := pg_temp.newuser('moderator@example.com');
  alice := pg_temp.newuser('alice@vanderbilt.edu');
  bob := pg_temp.newuser('bob@vanderbilt.edu');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (moderator, 'moderator', 'platform', '', 'platform');

  -- A reporter cannot SELECT a report back, including through INSERT
  -- RETURNING. Generate the opaque identifier before the insert so this test
  -- keeps that privacy boundary intact instead of asking PostgreSQL to weaken
  -- it merely for the test harness.
  report := gen_random_uuid();
  perform pg_temp.become(alice);
  insert into public.reports (id, reporter, about, reason, copy)
  values (report, alice, bob, 'A report that needs review', 'Original message copy');

  perform pg_temp.become(moderator);
  update public.reports set status = 'under_review' where id = report;
  update public.reports set status = 'resolved' where id = report;

  select count(*) into n
    from public.moderation_audit_event where report_id = report;
  perform pg_temp.counted('a moderator sees both status transitions', n, 2);

  update public.reports set status = 'resolved' where id = report;
  select count(*) into n
    from public.moderation_audit_event where report_id = report;
  perform pg_temp.counted('writing the same status does not invent an event', n, 2);

  select count(*) into n
    from public.moderation_audit_event
   where report_id = report
     and ((from_status = 'open' and to_status = 'under_review')
       or (from_status = 'under_review' and to_status = 'resolved'))
     and actor_kind = 'authenticated';
  perform pg_temp.counted('the audit records before, after and actor kind', n, 2);

  perform pg_temp.become(alice);
  select count(*) into n from public.moderation_audit_event;
  reset role;
  perform pg_temp.counted('a student cannot read moderation evidence', n, 0);

  select id, actor_sha256, reporter_sha256
    into event, actor_hash, reporter_hash
    from public.moderation_audit_event
   where report_id = report and to_status = 'resolved';
  if length(actor_hash) <> 64 or actor_hash = moderator::text then
    raise exception 'FAILED: the audit retained a raw or invalid moderator identifier';
  end if;
  if length(reporter_hash) <> 64 or reporter_hash = alice::text then
    raise exception 'FAILED: the audit retained a raw or invalid reporter identifier';
  end if;
  raise notice 'ok  moderation identities are pseudonymized';

  perform pg_temp.become(moderator);
  begin
    insert into public.moderation_audit_event (
      report_id, from_status, to_status, reporter_sha256, actor_kind
    ) values (report, 'open', 'resolved', repeat('0', 64), 'authenticated');
    raise exception 'FAILED: a moderator forged an audit event';
  exception when insufficient_privilege then
    null;
  end;
  reset role;
  raise notice 'ok  moderators cannot forge audit events';

  begin
    update public.moderation_audit_event set to_status = 'dismissed' where id = event;
    raise exception 'FAILED: a moderation audit event was changed';
  exception when others then
    if sqlerrm = 'FAILED: a moderation audit event was changed' then raise; end if;
  end;
  raise notice 'ok  moderation audit events cannot be changed';

  begin
    delete from public.moderation_audit_event where id = event;
    raise exception 'FAILED: a moderation audit event was deleted';
  exception when others then
    if sqlerrm = 'FAILED: a moderation audit event was deleted' then raise; end if;
  end;
  raise notice 'ok  moderation audit events cannot be deleted';
end $$;

rollback;
