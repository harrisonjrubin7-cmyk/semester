-- A school leaves in steps (full-beta gate G3, 20260930200000).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- What must hold:
--   * a school row is never deleted, at any stage, not by an administrator, not
--     by the operator's own role, not after a purge is authorized
--   * a case moves one step at a time; a step cannot be skipped or repeated
--   * two people, one from each side, approve a departure; the proposer cannot
--   * nobody approves a departure that has not been sized (the inventory)
--   * disabling access needs the students' notice on record, revokes the
--     school's grants and connections and ends their holders' sessions, and
--     touches no other school at all
--   * while a school is leaving it takes no new grant, member or connection
--   * an export is verified by a different operator, against the school as it
--     now stands, and a changed or incomplete export is refused
--   * archiving keeps everything, for at least thirty days
--   * purge eligibility waits for the window, refuses a live legal hold, and
--     needs a third person; it authorizes and deletes nothing
--   * restore gives back exactly what was revoked, by a different operator,
--     with a reason, and not after a purge is authorized
--   * every act is in the audit record, with no name in it

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, split_part(address, '@', 1), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

-- True when the statement is refused for any reason.
create or replace function pg_temp.refused(statement text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  return true;
end $$;

create or replace function pg_temp.must_refuse(what text, statement text)
returns void language plpgsql as $$
begin
  if not pg_temp.refused(statement) then raise exception 'FAILED: % was allowed', what; end if;
  raise notice 'ok  % is refused', what;
end $$;

-- True only when the statement is refused *saying* something: a delete
-- that fails for an unrelated foreign key is not the guard working.
create or replace function pg_temp.refused_saying(statement text, fragment text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  return position(fragment in sqlerrm) > 0;
end $$;

do $$
declare
  n_admin uuid; n_admin2 uuid; s_admin uuid; m_n uuid; m_n2 uuid; m_s uuid; newcomer uuid;
  op1 uuid; op2 uuid; op3 uuid; student uuid;
  n_case uuid; s_case uuid; c2 uuid; k uuid;
  n bigint; inv jsonb; res jsonb; counts jsonb; until timestamptz;
  s_grant uuid; s_conn uuid; n_conn uuid; sess int;
begin
  insert into public.schools (id, name, email_domains) values
    ('north-off', 'North Offboarding University', array['north-off.example']),
    ('south-off', 'South Offboarding College', array['south-off.example']);

  n_admin  := pg_temp.newuser('na@north-off.example', 'north-off');
  n_admin2 := pg_temp.newuser('na2@north-off.example', 'north-off');
  s_admin  := pg_temp.newuser('sa@south-off.example', 'south-off');
  m_n      := pg_temp.newuser('mn@north-off.example', 'north-off');
  m_n2     := pg_temp.newuser('mn2@north-off.example', 'north-off');
  m_s      := pg_temp.newuser('ms@south-off.example', 'south-off');
  newcomer := pg_temp.newuser('new@north-off.example', null);
  student  := pg_temp.newuser('st@elsewhere.example', null);
  op1 := pg_temp.newuser('op1@ops.example', null);
  op2 := pg_temp.newuser('op2@ops.example', null);
  op3 := pg_temp.newuser('op3@ops.example', null);
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (op1, 'platform_admin', 'platform', '', 'platform'),
    (op2, 'platform_admin', 'platform', '', 'platform'),
    (op3, 'platform_admin', 'platform', '', 'platform');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (n_admin,  'university_admin', 'school', 'north-off', 'institution'),
    (n_admin2, 'university_admin', 'school', 'north-off', 'institution'),
    (s_admin,  'university_admin', 'school', 'south-off', 'institution');

  insert into public.integration_connections (tenant_id, provider_domain, provider_name, connection_name, status, credentials_reference, approved_at)
  values ('north-off', 'lms', 'Canvas', 'North LMS', 'healthy', 'vault:north/lms', now()) returning id into n_conn;
  insert into public.integration_connections (tenant_id, provider_domain, provider_name, connection_name, status, credentials_reference, approved_at)
  values ('south-off', 'lms', 'Canvas', 'South LMS', 'healthy', 'vault:south/lms', now()) returning id into s_conn;
  insert into public.tenant_rollout (tenant_id, state, reason) values
    ('north-off', 'requested', 'north asked'), ('south-off', 'requested', 'south asked');

  -- The real sessions table is GoTrue's; the disposable database may not have
  -- one, and the delete only needs the user column.
  if to_regclass('auth.sessions') is null then
    create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null);
  end if;
  insert into auth.sessions (user_id) values (n_admin), (n_admin2), (s_admin), (m_n);

  -- ── A school row is never deleted ────────────────────────────────────────
  if not pg_temp.refused_saying($q$delete from public.schools where id = 'south-off'$q$, 'is never deleted') then
    raise exception 'FAILED: a school with nothing special about it was deleted, or refused for some other reason';
  end if;
  insert into public.schools (id, name) values ('bare-off', 'A school with nothing hanging from it');
  if not pg_temp.refused_saying($q$delete from public.schools where id = 'bare-off'$q$, 'is never deleted') then
    raise exception 'FAILED: a school with no dependents was deleted';
  end if;
  raise notice 'ok  deleting a school is refused by the guard, with or without dependents';
  perform pg_temp.become(n_admin);
  -- Row-level security may filter the delete to nothing rather than raise, so
  -- the outcome is what is asserted.
  begin
    delete from public.schools where id = 'north-off';
  exception when others then null;
  end;
  reset role;
  perform pg_temp.counted('a school administrator cannot delete their own school',
    (select count(*) from public.schools where id = 'north-off'), 1);

  -- ── Proposing ────────────────────────────────────────────────────────────
  perform pg_temp.become(student);
  perform pg_temp.must_refuse('a stranger proposing a departure',
    $q$select public.propose_offboarding('north-off', 'x', 'school')$q$);
  reset role;
  perform pg_temp.become(s_admin);
  perform pg_temp.must_refuse('another school''s administrator proposing north''s departure',
    $q$select public.propose_offboarding('north-off', 'x', 'school')$q$);
  reset role;
  perform pg_temp.become(n_admin);
  perform pg_temp.must_refuse('a school administrator proposing as the operator',
    $q$select public.propose_offboarding('north-off', 'x', 'operator')$q$);
  perform pg_temp.must_refuse('a departure with no reason',
    $q$select public.propose_offboarding('north-off', '  ', 'school')$q$);
  n_case := public.propose_offboarding('north-off', 'The contract ends on 30 June.', 'school');
  perform pg_temp.must_refuse('a second open case for the same school',
    $q$select public.propose_offboarding('north-off', 'again', 'school')$q$);
  reset role;
  raise notice 'ok  a school administrator proposes their own school''s departure, once';

  -- ── Nobody approves what has not been sized ──────────────────────────────
  perform pg_temp.become(op1);
  perform pg_temp.must_refuse('approving before the inventory exists',
    format($q$select public.approve_offboarding(%L)$q$, n_case));
  reset role;
  perform pg_temp.become(s_admin);
  perform pg_temp.must_refuse('another school''s administrator taking north''s inventory',
    format($q$select public.offboarding_preflight(%L)$q$, n_case));
  reset role;
  perform pg_temp.become(n_admin);
  inv := public.offboarding_preflight(n_case);
  reset role;
  perform pg_temp.counted('the inventory counts north''s members', (inv->>'members')::bigint, 4);
  perform pg_temp.counted('and its live grants', (inv->>'role_grants')::bigint, 2);
  perform pg_temp.counted('and its live connections', (inv->>'live_connections')::bigint, 1);
  perform pg_temp.counted('and lists no south row among its tables',
    (select count(*) from jsonb_array_elements(inv->'tables') t where (t->>'rows')::bigint > 5 and t->>'table' = 'profiles'), 0);

  -- ── Approving: a different person, from the other side ───────────────────
  perform pg_temp.become(n_admin);
  perform pg_temp.must_refuse('the proposer approving their own proposal',
    format($q$select public.approve_offboarding(%L)$q$, n_case));
  reset role;
  perform pg_temp.become(n_admin2);
  perform pg_temp.must_refuse('a second administrator of the same school approving (same side)',
    format($q$select public.approve_offboarding(%L)$q$, n_case));
  reset role;
  perform pg_temp.become(op1);
  perform public.approve_offboarding(n_case);
  reset role;
  perform pg_temp.counted('the operator approves a school-side proposal', (select count(*) from public.school_offboarding where id = n_case and status = 'approved'), 1);

  -- ── Disabling access ─────────────────────────────────────────────────────
  perform pg_temp.become(op1);
  perform pg_temp.must_refuse('disabling access before students have been told',
    format($q$select public.disable_school_access(%L)$q$, n_case));
  perform pg_temp.must_refuse('recording a notice dated in the future',
    format($q$select public.record_offboarding_notice(%L, current_date + 3)$q$, n_case));
  perform public.record_offboarding_notice(n_case, current_date - 14);
  reset role;
  perform pg_temp.become(n_admin);
  perform pg_temp.must_refuse('a school administrator disabling access (operator-only)',
    format($q$select public.disable_school_access(%L)$q$, n_case));
  reset role;
  perform pg_temp.become(op1);
  res := public.disable_school_access(n_case);
  reset role;
  perform pg_temp.counted('two grants revoked', (res->>'grants')::bigint, 2);
  perform pg_temp.counted('one connection disconnected', (res->>'connections')::bigint, 1);
  perform pg_temp.counted('the roll-out suspended', (res->>'rollout_suspended')::boolean::int, 1);
  perform pg_temp.counted('the holders'' sessions ended (2 of the school''s 3 live sessions)',
    (select count(*) from auth.sessions where user_id in (n_admin, n_admin2)), 0);
  perform pg_temp.counted('a student''s own session is not touched', (select count(*) from auth.sessions where user_id = m_n), 1);
  perform pg_temp.counted('their credential pointer is cleared',
    (select count(*) from public.integration_connections where id = n_conn and status = 'disconnected' and credentials_reference is null), 1);
  perform pg_temp.counted('nothing was deleted: north''s members are all still there', (select count(*) from public.profiles where school_id = 'north-off'), 4);

  -- Another school is untouched, in every particular.
  perform pg_temp.counted('CROSS-TENANT: south''s grant is live',
    (select count(*) from public.role_grants where scope_id = 'south-off' and revoked_at is null), 1);
  perform pg_temp.counted('CROSS-TENANT: south''s connection is as it was',
    (select count(*) from public.integration_connections where id = s_conn and status = 'healthy' and credentials_reference = 'vault:south/lms'), 1);
  perform pg_temp.counted('CROSS-TENANT: south''s roll-out has not moved',
    (select count(*) from public.tenant_rollout where tenant_id = 'south-off' and state = 'requested'), 1);
  perform pg_temp.counted('CROSS-TENANT: south''s administrator''s session is untouched', (select count(*) from auth.sessions where user_id = s_admin), 1);
  perform pg_temp.become(s_admin);
  perform pg_temp.counted('CROSS-TENANT: south''s administrator still holds the capability',
    (select case when private.has_capability('tenant:configure', 'school', 'south-off') then 1 else 0 end), 1);
  reset role;
  perform pg_temp.become(n_admin);
  perform pg_temp.counted('north''s administrator no longer does',
    (select case when private.has_capability('tenant:configure', 'school', 'north-off') then 1 else 0 end), 0);
  reset role;

  -- While it leaves, nothing new attaches to it; another school is unaffected.
  set local role postgres;
  perform pg_temp.must_refuse('a new grant over the leaving school',
    format($q$insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values (%L, 'university_admin', 'school', 'north-off', 'institution')$q$, student));
  perform pg_temp.must_refuse('un-revoking a grant directly',
    format($q$update public.role_grants set revoked_at = null where subject = %L and scope_id = 'north-off'$q$, n_admin));
  perform pg_temp.must_refuse('a new member joining the leaving school',
    format($q$update public.profiles set school_id = 'north-off' where user_id = %L$q$, newcomer));
  perform pg_temp.must_refuse('a new integration connection at the leaving school',
    $q$insert into public.integration_connections (tenant_id, provider_domain, provider_name, connection_name, status) values ('north-off', 'sis', 'Banner', 'North SIS', 'configuring')$q$);
  perform pg_temp.must_refuse('reactivating the disconnected connection',
    format($q$update public.integration_connections set status = 'healthy' where id = %L$q$, n_conn));
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values (student, 'university_admin', 'school', 'south-off', 'institution');
  update public.profiles set school_id = 'south-off' where user_id = newcomer;
  raise notice 'ok  CONTROL: the same acts are allowed at a school that is not leaving';
  update public.profiles set school_id = null where user_id = newcomer;
  delete from public.role_grants where subject = student;
  reset role;

  -- ── Steps cannot be skipped or repeated ──────────────────────────────────
  perform pg_temp.become(op1);
  perform pg_temp.must_refuse('archiving before an export is verified',
    format($q$select public.archive_school(%L, 90)$q$, n_case));
  perform pg_temp.must_refuse('disabling access twice',
    format($q$select public.disable_school_access(%L)$q$, n_case));
  perform pg_temp.must_refuse('verifying an export that was never recorded',
    format($q$select public.verify_offboarding_export(%L)$q$, n_case));
  perform pg_temp.must_refuse('cancelling once access is disabled',
    format($q$select public.cancel_offboarding(%L, 'never mind')$q$, n_case));
  reset role;

  -- ── Export and verification ──────────────────────────────────────────────
  -- What the export tool would record: the live count of each table the
  -- preflight found, taken now, after access was disabled (disabling itself
  -- wrote a roll-out history row).
  counts := '{}'::jsonb;
  for k in select 1 where false loop end loop;
  declare
    tbl record; live bigint; col text;
  begin
    for tbl in select t->>'table' as name from jsonb_array_elements(inv->'tables') t loop
      select min(column_name) into col from information_schema.columns
       where table_schema = 'public' and table_name = tbl.name and column_name in ('tenant_id', 'school_id');
      execute format('select count(*) from public.%I where %I::text = $1', tbl.name, col) into live using 'north-off';
      counts := counts || jsonb_build_object(tbl.name, live);
    end loop;
  end;
  perform pg_temp.become(op1);
  perform pg_temp.must_refuse('an export with a malformed hash',
    format($q$select public.record_offboarding_export(%L, 'abc', %L::jsonb, 'registrar')$q$, n_case, counts));
  perform public.record_offboarding_export(n_case, repeat('a', 64), counts, 'the registrar, by secure transfer');
  perform pg_temp.must_refuse('the recorder verifying their own export',
    format($q$select public.verify_offboarding_export(%L)$q$, n_case));
  reset role;
  perform pg_temp.become(n_admin);
  perform pg_temp.must_refuse('the school''s administrator (no longer holding the grant) verifying',
    format($q$select public.verify_offboarding_export(%L)$q$, n_case));
  reset role;

  -- A member leaves after the export was taken: the export is now stale.
  set local role postgres;
  update public.profiles set school_id = null where user_id = m_n2;
  reset role;
  perform pg_temp.become(op2);
  res := public.verify_offboarding_export(n_case);
  reset role;
  perform pg_temp.counted('a stale export is not verified', (res->>'verified')::boolean::int, 0);
  perform pg_temp.counted('the case has not moved', (select count(*) from public.school_offboarding where id = n_case and status = 'access_disabled'), 1);
  perform pg_temp.counted('and the rejection is in the audit record',
    (select count(*) from public.audit_event where action = 'school.offboarding_export_rejected' and outcome = 'denied'), 1);
  set local role postgres;
  -- Put the member back (the join guard is what a restoration steps around).
  perform set_config('semester.offboarding_restore', 'on', true);
  update public.profiles set school_id = 'north-off' where user_id = m_n2;
  perform set_config('semester.offboarding_restore', 'off', true);
  reset role;

  -- A table that was EMPTY at preflight gains its first row afterwards, and the
  -- export (built from the preflight's tables) leaves it out: not verified.
  set local role postgres;
  insert into public.school_membership_requests (user_id, school_id, status, note)
  values (newcomer, 'north-off', 'pending', 'asked after the inventory was taken');
  reset role;
  perform pg_temp.become(op2);
  res := public.verify_offboarding_export(n_case);
  reset role;
  perform pg_temp.counted('an export that omits a table which gained rows since preflight is not verified', (res->>'verified')::boolean::int, 0);
  perform pg_temp.counted('and the rejection names that table',
    (select count(*) from jsonb_array_elements(res->'differences') d
      where d->>'table' = 'school_membership_requests' and d->>'why' like 'has rows now%'), 1);
  set local role postgres;
  delete from public.school_membership_requests where school_id = 'north-off';
  reset role;

  -- An export that leaves out a table the inventory found is refused too.
  perform pg_temp.become(op3);
  perform pg_temp.must_refuse('recording an export as a third operator over the top of the first',
    format($q$select public.record_offboarding_export(%L, %L, '{}'::jsonb, 'x')$q$, n_case, repeat('b', 64)));
  reset role;

  perform pg_temp.become(op2);
  res := public.verify_offboarding_export(n_case);
  reset role;
  perform pg_temp.counted('a complete, unchanged export is verified by a different operator', (res->>'verified')::boolean::int, 1);

  -- ── Archive ──────────────────────────────────────────────────────────────
  perform pg_temp.become(op2);
  perform pg_temp.must_refuse('a retention window under thirty days',
    format($q$select public.archive_school(%L, 10)$q$, n_case));
  until := public.archive_school(n_case, 90);
  reset role;
  perform pg_temp.counted('the case is archived', (select count(*) from public.school_offboarding where id = n_case and status = 'archived'), 1);
  perform pg_temp.counted('with a window of about ninety days', (select (until > now() + interval '89 days')::int), 1);
  perform pg_temp.counted('and every member, connection and grant is still in the database',
    (select count(*) from public.profiles where school_id = 'north-off')
    + (select count(*) from public.role_grants where scope_id = 'north-off')
    + (select count(*) from public.integration_connections where tenant_id = 'north-off'), 7);

  -- ── Purge eligibility: a question, and an authorization that deletes nothing
  perform pg_temp.become(op3);
  res := public.school_purge_eligibility(n_case);
  reset role;
  perform pg_temp.counted('not eligible inside the window', (res->>'eligible')::boolean::int, 0);
  perform pg_temp.become(op3);
  perform pg_temp.must_refuse('authorizing a purge inside the window',
    format($q$select public.authorize_school_purge(%L, 'go')$q$, n_case));
  reset role;

  set local role postgres;
  update public.school_offboarding set retain_until = now() - interval '1 day' where id = n_case;
  -- A real tenant hold, placed by the school's own (now former) administrator.
  -- No signed-in identity here: the hold guard names the placer from the token
  -- when there is one, and this insert is the operator's, as service role.
  perform set_config('request.jwt.claims', '', true);
  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
  values ('tenant', 'north-off', 'north-off', 'Litigation hold', 'MATTER-1', n_admin);
  reset role;
  perform pg_temp.become(op3);
  res := public.school_purge_eligibility(n_case);
  perform pg_temp.counted('a live legal hold blocks eligibility', (res->>'eligible')::boolean::int, 0);
  perform pg_temp.must_refuse('authorizing a purge under a live hold',
    format($q$select public.authorize_school_purge(%L, 'go')$q$, n_case));
  reset role;
  perform pg_temp.counted('and the departure''s size shows it', (private.school_live_holds('north-off'))::bigint, 1);
  perform pg_temp.counted('CROSS-TENANT: another school''s hold count is unaffected', (private.school_live_holds('south-off'))::bigint, 0);

  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
  update public.legal_holds set released_by = op1, released_at = now(), release_reason = 'Matter closed';
  reset role;
  perform pg_temp.become(op1);
  perform pg_temp.must_refuse('the approver authorizing the purge',
    format($q$select public.authorize_school_purge(%L, 'go')$q$, n_case));
  reset role;
  perform pg_temp.become(n_admin);
  perform pg_temp.must_refuse('the proposer authorizing the purge',
    format($q$select public.authorize_school_purge(%L, 'go')$q$, n_case));
  reset role;
  perform pg_temp.become(op3);
  perform pg_temp.must_refuse('an authorization with no reason',
    format($q$select public.authorize_school_purge(%L, ' ')$q$, n_case));
  perform public.authorize_school_purge(n_case, 'Counsel confirmed the window has run.');
  reset role;
  perform pg_temp.counted('a third person authorizes, after the window and with no hold',
    (select count(*) from public.school_offboarding where id = n_case and purge_authorized_by = op3), 1);
  perform pg_temp.counted('and nothing was deleted by it', (select count(*) from public.profiles where school_id = 'north-off'), 4);
  if not pg_temp.refused_saying($q$delete from public.schools where id = 'north-off'$q$, 'is never deleted') then
    raise exception 'FAILED: the school row was deletable after a purge was authorized';
  end if;
  raise notice 'ok  even now, deleting the school row is refused';
  perform pg_temp.become(op2);
  perform pg_temp.must_refuse('restoring after a purge was authorized',
    format($q$select public.restore_school(%L, 'changed our minds')$q$, n_case));
  reset role;

  -- ── A departure that is restored (south, proposed by the operator) ──────
  perform pg_temp.become(op1);
  s_case := public.propose_offboarding('south-off', 'A trial that did not continue.', 'operator');
  inv := public.offboarding_preflight(s_case);
  reset role;
  perform pg_temp.become(op2);
  perform pg_temp.must_refuse('an operator approving an operator-side proposal',
    format($q$select public.approve_offboarding(%L)$q$, s_case));
  reset role;
  perform pg_temp.become(s_admin);
  perform public.approve_offboarding(s_case);
  perform public.record_offboarding_notice(s_case, current_date - 1);
  reset role;
  perform pg_temp.become(op1);
  res := public.disable_school_access(s_case);
  reset role;
  perform pg_temp.counted('south''s grant revoked', (res->>'grants')::bigint, 1);
  perform pg_temp.counted('CROSS-TENANT: north''s case was not touched by south''s',
    (select count(*) from public.school_offboarding where id = n_case and status = 'archived'), 1);
  perform pg_temp.become(op1);
  perform pg_temp.must_refuse('the operator who disabled access restoring it',
    format($q$select public.restore_school(%L, 'we should not')$q$, s_case));
  reset role;
  perform pg_temp.become(op2);
  perform pg_temp.must_refuse('a restoration with no reason',
    format($q$select public.restore_school(%L, ' ')$q$, s_case));
  reset role;
  perform pg_temp.become(s_admin);
  perform pg_temp.must_refuse('the school''s own administrator restoring',
    format($q$select public.restore_school(%L, 'please')$q$, s_case));
  reset role;
  perform pg_temp.become(op2);
  res := public.restore_school(s_case, 'The trial resumed by agreement of both parties.');
  reset role;
  perform pg_temp.counted('restore gives the grant back', (res->>'grants')::bigint, 1);
  perform pg_temp.counted('and the connection, as it was',
    (select count(*) from public.integration_connections where id = s_conn and status = 'healthy' and credentials_reference = 'vault:south/lms'), 1);
  perform pg_temp.counted('and the roll-out, to where it stood',
    (select count(*) from public.tenant_rollout where tenant_id = 'south-off' and state = 'requested'), 1);
  perform pg_temp.become(s_admin);
  perform pg_temp.counted('the administrator holds the capability again',
    (select case when private.has_capability('tenant:configure', 'school', 'south-off') then 1 else 0 end), 1);
  reset role;
  set local role postgres;
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values (student, 'university_admin', 'school', 'south-off', 'institution');
  reset role;
  raise notice 'ok  after a restoration the school takes new grants again';
  perform pg_temp.counted('and the restored case is closed', (select count(*) from public.school_offboarding where id = s_case and status = 'restored'), 1);
  perform pg_temp.counted('CROSS-TENANT: north stayed archived and its grants stayed revoked',
    (select count(*) from public.role_grants where scope_id = 'north-off' and revoked_at is null), 0);

  -- A fresh case can be opened after a restored one, and cancelled before it bites.
  perform pg_temp.become(s_admin);
  c2 := public.propose_offboarding('south-off', 'Second thoughts.', 'school');
  perform pg_temp.must_refuse('cancelling with no reason', format($q$select public.cancel_offboarding(%L, ' ')$q$, c2));
  perform public.cancel_offboarding(c2, 'Decided against.');
  reset role;
  perform pg_temp.counted('a cancelled case is closed', (select count(*) from public.school_offboarding where id = c2 and status = 'cancelled'), 1);

  -- ── The case is a record ─────────────────────────────────────────────────
  set local role postgres;
  perform pg_temp.must_refuse('editing what a case was opened for',
    format($q$update public.school_offboarding set reason = 'rewritten' where id = %L$q$, n_case));
  perform pg_temp.must_refuse('overwriting the recorded approver',
    format($q$update public.school_offboarding set approved_by = %L where id = %L$q$, op3, n_case));
  perform pg_temp.must_refuse('moving a closed case again',
    format($q$update public.school_offboarding set status = 'archived' where id = %L$q$, s_case));
  perform pg_temp.must_refuse('deleting a case', format($q$delete from public.school_offboarding where id = %L$q$, n_case));
  perform pg_temp.must_refuse('editing what a revocation took',
    $q$update public.school_offboarding_undo set prior = '{}'::jsonb$q$);
  reset role;
  perform pg_temp.become(n_admin2);
  perform pg_temp.must_refuse('writing a case directly through the API',
    $q$insert into public.school_offboarding (tenant_id, reason, proposed_by, proposed_side) values ('north-off', 'x', gen_random_uuid(), 'school')$q$);
  reset role;

  -- ── Who can read a case ──────────────────────────────────────────────────
  perform pg_temp.become(s_admin);
  select count(*) into n from public.school_offboarding where tenant_id = 'north-off';
  reset role;
  perform pg_temp.counted('CROSS-TENANT: south''s administrator reads none of north''s cases', n, 0);
  perform pg_temp.become(newcomer);
  select count(*) into n from public.school_offboarding;
  reset role;
  perform pg_temp.counted('a stranger reads no case', n, 0);
  perform pg_temp.become(m_n);
  perform pg_temp.must_refuse('a student reading what was revoked', $q$select count(*) from public.school_offboarding_undo$q$);
  reset role;
  perform pg_temp.become(n_admin2);
  perform pg_temp.must_refuse('a school administrator reading what was revoked (the API has no access)', $q$select count(*) from public.school_offboarding_undo$q$);
  reset role;
  perform pg_temp.become(op1);
  select count(*) into n from public.school_offboarding;
  reset role;
  perform pg_temp.counted('the operator reads them all', n, 3);

  -- ── The audit record ─────────────────────────────────────────────────────
  select count(distinct action) into n from public.audit_event where action like 'school.offboarding_%';
  perform pg_temp.counted('every kind of step is in the audit record', n, 12);
  select count(*) into n from public.audit_event where action like 'school.offboarding_%'
     and (detail::text ~ '@' or detail::text ~* 'example');
  perform pg_temp.counted('and no event carries an address or a name', n, 0);
end $$;

rollback;
