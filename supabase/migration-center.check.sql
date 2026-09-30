-- The Migration Center (D-144): who may see and run a school's migrations,
-- that a migration moves one stage at a time and only on the evidence its
-- stage asks for, that going back restarts that evidence, that cutover needs
-- every required area approved by someone other than its creator, that
-- evidence is append-only with `passed` computed rather than claimed, and
-- that deleting an account leaves the school's migration standing. Every
-- refusal is attempted as the account that should be refused.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh migration-center

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, replace(split_part(address, '@', 1), '.', '_'), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.seen(who uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute 'select count(*) from (' || q || ') t' into n;
  execute 'reset role';
  return n;
end $$;

create or replace function pg_temp.value_as(who uuid, q text)
returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.become(who);
  execute q into v;
  execute 'reset role';
  return v;
end $$;

-- Rows a statement touched as someone; zero is a refusal by row-level security.
create or replace function pg_temp.touched(who uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute q;
  get diagnostics n = row_count;
  execute 'reset role';
  return n;
exception when others then
  execute 'reset role';
  return -1;
end $$;

-- The error a statement raises as someone, or null when it runs.
create or replace function pg_temp.error_as(who uuid, q text)
returns text language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute q;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
end $$;

create or replace function pg_temp.says(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is null or position(want in got) = 0 then
    raise exception 'FAILED: % — expected "%", got "%"', what, want, got;
  end if;
  raise notice 'ok  % ("%")', what, want;
end $$;

create or replace function pg_temp.runs_clean(what text, got text)
returns void language plpgsql as $$
begin
  if got is not null then
    raise exception 'FAILED: % — refused: %', what, got;
  end if;
  raise notice 'ok  %', what;
end $$;

-- Move a migration to a stage, as someone. Returns the error, or null.
create or replace function pg_temp.move(who uuid, id uuid, stage text)
returns text language plpgsql as $$
begin
  return pg_temp.error_as(who, format('update public.migration_projects set stage = %L where id = %L', stage, id));
end $$;

-- Record a run, as someone. Returns the error, or null.
create or replace function pg_temp.run(who uuid, id uuid, kind text, rows_in int,
                                      failed int default 0, missing int default 0, extra int default 0,
                                      differing int default 0, period text default '')
returns text language plpgsql as $$
begin
  return pg_temp.error_as(who, format(
    'insert into public.migration_runs (tenant_id, project_id, kind, period_label, rows_in, rows_ok, rows_failed,
                                        rows_missing, rows_extra, rows_differing, sample_sha256)
     values (''mc-u'', %L, %L, %L, %s, %s, %s, %s, %s, %s, %L)',
    id, kind, period, rows_in, rows_in - failed - differing, failed, missing, extra, differing, repeat('ab', 32)));
end $$;

create or replace function pg_temp.decide(who uuid, id uuid, area text, decision text)
returns text language plpgsql as $$
begin
  return pg_temp.error_as(who, format(
    'insert into public.migration_approvals (tenant_id, project_id, area, decision, note) values (''mc-u'', %L, %L, %L, ''checked'')',
    id, area, decision));
end $$;

do $$
declare
  lead uuid; lead2 uuid; registrar uuid; admin uuid; researcher uuid; student uuid; far_lead uuid;
  m uuid; gone uuid;
  audits bigint;
begin
  insert into public.schools (id, name, email_domains) values
    ('mc-u', 'Migration Center University', array['mc-u.example']),
    ('mc-other', 'Other University', array['mc-other.example']);

  lead       := pg_temp.newuser('lead@mc-u.example', 'mc-u');
  lead2      := pg_temp.newuser('lead2@mc-u.example', 'mc-u');
  registrar  := pg_temp.newuser('registrar@mc-u.example', 'mc-u');
  admin      := pg_temp.newuser('admin@mc-u.example', 'mc-u');
  researcher := pg_temp.newuser('ir@mc-u.example', 'mc-u');
  student    := pg_temp.newuser('student@mc-u.example', 'mc-u');
  far_lead   := pg_temp.newuser('lead@mc-other.example', 'mc-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (lead,       'implementation_manager',   'school', 'mc-u',     'institution'),
    (lead2,      'integration_admin',        'school', 'mc-u',     'institution'),
    (registrar,  'registrar',                'school', 'mc-u',     'institution'),
    (admin,      'university_admin',         'school', 'mc-u',     'institution'),
    (researcher, 'institutional_researcher', 'school', 'mc-u',     'institution'),
    (student,    'student',                  'school', 'mc-u',     'institution'),
    (far_lead,   'implementation_manager',   'school', 'mc-other', 'institution');

  -- ── who may open and see a migration ───────────────────────────────────
  m := pg_temp.value_as(lead, $q$insert into public.migration_projects (tenant_id, name, domain, stage, created_by)
    values ('mc-u', 'Retire the legacy gradebook', 'lms', 'cutover', null) returning id$q$)::uuid;
  perform pg_temp.counted('a migration is born at inventory whatever the client sends',
    (select count(*) from public.migration_projects where id = m and stage = 'inventory'), 1);
  perform pg_temp.counted('and its creator is the account that opened it',
    (select count(*) from public.migration_projects where id = m and created_by = lead), 1);
  perform pg_temp.says('a registrar cannot open a migration',
    pg_temp.error_as(registrar, $q$insert into public.migration_projects (tenant_id, name, domain) values ('mc-u', 'x', 'lms')$q$),
    'row-level security');
  perform pg_temp.says('a lead cannot open one at another school',
    pg_temp.error_as(far_lead, $q$insert into public.migration_projects (tenant_id, name, domain) values ('mc-u', 'x', 'lms')$q$),
    'row-level security');
  perform pg_temp.counted('the researcher reads the school''s migrations', pg_temp.seen(researcher, 'select * from public.migration_projects'), 1);
  perform pg_temp.counted('the registrar reads them', pg_temp.seen(registrar, 'select * from public.migration_projects'), 1);
  perform pg_temp.counted('a student reads none', pg_temp.seen(student, 'select * from public.migration_projects'), 0);
  perform pg_temp.counted('a lead at another school reads none', pg_temp.seen(far_lead, 'select * from public.migration_projects'), 0);
  perform pg_temp.counted('the researcher cannot change one',
    pg_temp.touched(researcher, format($q$update public.migration_projects set name = 'renamed' where id = %L$q$, m)), 0);
  perform pg_temp.says('a migration does not change school',
    pg_temp.error_as(lead, format($q$update public.migration_projects set tenant_id = 'mc-other' where id = %L$q$, m)), 'stays with its school');

  -- ── one stage at a time, on its evidence ───────────────────────────────
  perform pg_temp.says('inventory needs the source and its owner',
    pg_temp.move(lead, m, 'classification'), 'source_platform, source_version, data_owner');
  perform pg_temp.says('nothing skips a stage',
    pg_temp.move(lead, m, 'mapping'), 'one stage at a time');
  perform pg_temp.error_as(lead, format($q$update public.migration_projects
    set source_platform = 'Legacy LMS', source_version = '2019.4', data_owner = 'Office of the Registrar' where id = %L$q$, m));
  perform pg_temp.runs_clean('inventory complete, it moves to classification', pg_temp.move(lead, m, 'classification'));

  perform pg_temp.says('classification needs classes, retention and a cutoff',
    pg_temp.move(lead, m, 'mapping'), 'classifications, retention, historical_cutoff');
  perform pg_temp.says('an unknown classification is refused',
    pg_temp.error_as(lead, format($q$update public.migration_projects set classifications = array['secret'] where id = %L$q$, m)), 'check constraint');
  perform pg_temp.error_as(lead, format($q$update public.migration_projects
    set classifications = array['confidential'], retention = 'Seven years after graduation', historical_cutoff = '2019-08-01' where id = %L$q$, m));
  perform pg_temp.runs_clean('classified, it moves to mapping', pg_temp.move(lead, m, 'mapping'));

  perform pg_temp.says('mapping needs a field and a key', pg_temp.move(lead, m, 'cleaning'), 'field_map, key_field');
  perform pg_temp.error_as(lead, format($q$insert into public.migration_field_maps (tenant_id, project_id, source_field, target_field, transform, required)
    values ('mc-u', %L, 'Final Grade', 'final_grade', 'uppercase', true)$q$, m));
  perform pg_temp.says('a field but no key is still refused', pg_temp.move(lead, m, 'cleaning'), 'key_field');
  perform pg_temp.counted('the researcher cannot add a field map',
    greatest(pg_temp.touched(researcher, format($q$insert into public.migration_field_maps (tenant_id, project_id, source_field, target_field)
      values ('mc-u', %L, 'x', 'x')$q$, m)), 0), 0);
  perform pg_temp.error_as(lead, format($q$insert into public.migration_field_maps (tenant_id, project_id, source_field, target_field, transform, required, is_key)
    values ('mc-u', %L, 'Student ID', 'student_ref', 'trim', true, true)$q$, m));
  perform pg_temp.runs_clean('mapped with a key, it moves to cleaning', pg_temp.move(lead, m, 'cleaning'));

  perform pg_temp.says('cleaning needs a duplicate rule', pg_temp.move(lead, m, 'preview'), 'duplicate_rule');
  perform pg_temp.error_as(lead, format($q$update public.migration_projects set duplicate_rule = 'reject' where id = %L$q$, m));
  perform pg_temp.runs_clean('a duplicate rule chosen, it moves to preview', pg_temp.move(lead, m, 'preview'));
  perform pg_temp.says('the mapping is fixed after cleaning',
    pg_temp.error_as(lead, format($q$insert into public.migration_field_maps (tenant_id, project_id, source_field, target_field) values ('mc-u', %L, 'Term', 'term')$q$, m)),
    'fixed once a migration is past cleaning');
  perform pg_temp.says('and a map cannot be removed either',
    pg_temp.error_as(lead, format($q$delete from public.migration_field_maps where project_id = %L$q$, m)), 'fixed once');

  perform pg_temp.says('preview needs a preview run', pg_temp.move(lead, m, 'sample_import'), 'preview_run');
  perform pg_temp.says('passed is computed, never recorded',
    pg_temp.error_as(lead, format($q$insert into public.migration_runs (tenant_id, project_id, kind, rows_in, sample_sha256, passed)
      values ('mc-u', %L, 'validation', 10, %L, true)$q$, m, repeat('ab', 32))), 'non-DEFAULT value into column "passed"');
  perform pg_temp.says('a run carries a SHA-256, not a row',
    pg_temp.error_as(lead, format($q$insert into public.migration_runs (tenant_id, project_id, kind, rows_in, sample_sha256)
      values ('mc-u', %L, 'preview', 10, 'Jane Doe, 900123456, A-')$q$, m)), 'check constraint');
  perform pg_temp.says('the researcher cannot record a run', pg_temp.run(researcher, m, 'preview', 20), 'row-level security');
  perform pg_temp.runs_clean('the lead records a preview', pg_temp.run(lead, m, 'preview', 20));
  perform pg_temp.counted('the run is stamped with the project''s stage and the recorder',
    (select count(*) from public.migration_runs where project_id = m and stage = 'preview' and recorded_by = lead), 1);
  perform pg_temp.runs_clean('previewed, it moves to sample import', pg_temp.move(lead, m, 'sample_import'));

  perform pg_temp.says('a preview run does not count as a sample import', pg_temp.move(lead, m, 'validation'), 'sample_import_run');
  perform pg_temp.runs_clean('the lead records a sample import', pg_temp.run(lead, m, 'sample_import', 4812, 37));
  perform pg_temp.runs_clean('sampled, it moves to validation', pg_temp.move(lead, m, 'validation'));

  perform pg_temp.runs_clean('a validation with failures is recorded', pg_temp.run(lead, m, 'validation', 4812, 3));
  perform pg_temp.says('and does not pass the gate', pg_temp.move(lead, m, 'reconciliation'), 'validation_passed');
  perform pg_temp.runs_clean('a clean validation is recorded', pg_temp.run(lead, m, 'validation', 4812));
  perform pg_temp.runs_clean('validated, it moves to reconciliation', pg_temp.move(lead, m, 'reconciliation'));

  perform pg_temp.runs_clean('a reconciliation with missing records', pg_temp.run(lead, m, 'reconciliation', 4812, 0, 2));
  perform pg_temp.says('missing records block reconciliation', pg_temp.move(lead, m, 'parallel_run'), 'reconciliation_passed');

  -- ── going back restarts the evidence ───────────────────────────────────
  perform pg_temp.runs_clean('it may go back to validation', pg_temp.move(lead, m, 'validation'));
  perform pg_temp.says('the clean validation from before no longer counts', pg_temp.move(lead, m, 'reconciliation'), 'validation_passed');
  perform pg_temp.runs_clean('validated again', pg_temp.run(lead, m, 'validation', 4814));
  perform pg_temp.runs_clean('and forward to reconciliation', pg_temp.move(lead, m, 'reconciliation'));
  perform pg_temp.runs_clean('a reconciliation where every record matches', pg_temp.run(lead, m, 'reconciliation', 4814));
  perform pg_temp.runs_clean('reconciled, it moves to the parallel run', pg_temp.move(lead, m, 'parallel_run'));

  -- ── the parallel run ───────────────────────────────────────────────────
  perform pg_temp.says('a parallel run needs a period', pg_temp.run(lead, m, 'parallel_run', 4814), 'migration_run_period');
  perform pg_temp.runs_clean('week one matches', pg_temp.run(lead, m, 'parallel_run', 4814, 0, 0, 0, 0, 'Week 1'));
  perform pg_temp.runs_clean('week one again', pg_temp.run(lead, m, 'parallel_run', 4814, 0, 0, 0, 0, 'week 1 '));
  perform pg_temp.says('the same period twice is one period', pg_temp.move(lead, m, 'cutover'), 'parallel_runs');
  perform pg_temp.runs_clean('week two matches', pg_temp.run(lead, m, 'parallel_run', 4820, 0, 0, 0, 0, 'Week 2'));
  perform pg_temp.runs_clean('week three differs', pg_temp.run(lead, m, 'parallel_run', 4820, 0, 0, 0, 4, 'Week 3'));
  perform pg_temp.says('a latest period that differs blocks cutover', pg_temp.move(lead, m, 'cutover'), 'parallel_runs');
  perform pg_temp.says('approvals wait for cutover', pg_temp.decide(registrar, m, 'data_owner', 'approved'), 'recorded at cutover');
  perform pg_temp.runs_clean('week four matches', pg_temp.run(lead, m, 'parallel_run', 4820, 0, 0, 0, 0, 'Week 4'));
  perform pg_temp.runs_clean('two clean periods, the latest clean: it moves to cutover', pg_temp.move(lead, m, 'cutover'));

  -- ── cutover ────────────────────────────────────────────────────────────
  perform pg_temp.says('cutover needs a date, a rollback plan and the approvals',
    pg_temp.move(lead, m, 'archive'), 'cutover_date, rollback_plan, approvals');
  perform pg_temp.error_as(lead, format($q$update public.migration_projects
    set cutover_date = '2027-01-04', rollback_plan = 'Re-enable the legacy gradebook; Semester returns to shadow mode.' where id = %L$q$, m));
  perform pg_temp.says('a lead cannot approve', pg_temp.decide(lead2, m, 'it', 'approved'), 'row-level security');
  update public.role_grants set role = 'registrar' where subject = lead2 and role = 'integration_admin';
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values (lead, 'registrar', 'school', 'mc-u', 'institution');
  perform pg_temp.says('the creator cannot approve their own migration, whatever they hold',
    pg_temp.decide(lead, m, 'data_owner', 'approved'), 'does not approve its cutover');
  perform pg_temp.runs_clean('the registrar approves as data owner', pg_temp.decide(registrar, m, 'data_owner', 'approved'));
  perform pg_temp.says('one of two areas is not enough', pg_temp.move(lead, m, 'archive'), 'approvals');
  perform pg_temp.runs_clean('the administrator rejects for IT', pg_temp.decide(admin, m, 'it', 'rejected'));
  perform pg_temp.says('a rejection is named', pg_temp.move(lead, m, 'archive'), 'rejected');
  perform pg_temp.runs_clean('the administrator approves for IT', pg_temp.decide(admin, m, 'it', 'approved'));
  perform pg_temp.counted('the approval is stamped with its approver',
    (select count(*) from public.migration_approvals where project_id = m and approver_id = admin), 2);
  perform pg_temp.says('one area named twice is one area',
    pg_temp.error_as(lead, format($q$update public.migration_projects set required_approvals = array['it', 'it'] where id = %L$q$, m)),
    'named once');
  perform pg_temp.runs_clean('after every approval, the rollback plan is changed',
    pg_temp.error_as(lead, format($q$update public.migration_projects set rollback_plan = 'Restore the legacy gradebook from the 3 Jan export.' where id = %L$q$, m)));
  perform pg_temp.says('and approvals of the old plan no longer count', pg_temp.move(lead, m, 'archive'), 'approvals');
  perform pg_temp.runs_clean('the registrar approves the new plan', pg_temp.decide(registrar, m, 'data_owner', 'approved'));
  perform pg_temp.runs_clean('and the administrator', pg_temp.decide(admin, m, 'it', 'approved'));
  perform pg_temp.runs_clean('every area approved: cutover happens', pg_temp.move(lead, m, 'archive'));
  perform pg_temp.says('past cutover there is no going back', pg_temp.move(lead, m, 'parallel_run'), 'does not go back');

  perform pg_temp.says('archive needs a location', pg_temp.move(lead, m, 'monitoring'), 'archive_location');
  perform pg_temp.error_as(lead, format($q$update public.migration_projects set archive_location = 'Records vault, export of 4 Jan 2027' where id = %L$q$, m));
  perform pg_temp.runs_clean('archived, it moves to monitoring', pg_temp.move(lead, m, 'monitoring'));
  perform pg_temp.says('monitoring is the last stage', pg_temp.move(lead, m, 'archive'), 'does not go back');

  -- ── evidence is append-only ────────────────────────────────────────────
  perform pg_temp.says('a client cannot edit a run', pg_temp.error_as(lead, format($q$update public.migration_runs set rows_failed = 0 where project_id = %L$q$, m)), 'permission denied');
  perform pg_temp.counted('nor deleted by a client', greatest(pg_temp.touched(lead, format($q$delete from public.migration_runs where project_id = %L$q$, m)), 0), 0);
  begin
    update public.migration_runs set rows_failed = 0 where project_id = m;
    raise exception 'FAILED: the owner edited a run';
  exception when insufficient_privilege then
    raise notice 'ok  nor even by the database owner';
  end;
  begin
    delete from public.migration_approvals where project_id = m;
    raise exception 'FAILED: the owner deleted an approval';
  exception when insufficient_privilege then
    raise notice 'ok  the owner cannot delete an approval either';
  end;

  -- Twenty project writes (the insert, seven edits, twelve stage moves), two
  -- field maps, twelve runs, five approvals: every one that succeeded, and
  -- none of the refused.
  select count(*) into audits from public.tenant_policy_audit_event where tenant_id = 'mc-u' and entity_type like 'migration_%';
  perform pg_temp.counted('every change is audited, and nothing refused is', audits, 39);
  perform pg_temp.counted('a stage move is attributed to the grant that allowed it',
    (select count(*) from public.tenant_policy_audit_event e
      join public.role_grants g on g.id = e.actor_grant_id
     where e.entity_type = 'migration_projects' and e.entity_id = m::text and e.action = 'update'
       and e.new_data ->> 'stage' = 'monitoring' and g.subject = lead), 1);

  -- ── an account goes; the school's migration stays ──────────────────────
  gone := lead;
  perform set_config('request.jwt.claims', '', true);
  delete from auth.users where id = gone;
  perform pg_temp.counted('the migration stays with the school', (select count(*) from public.migration_projects where id = m), 1);
  perform pg_temp.counted('no longer naming its creator', (select count(*) from public.migration_projects where id = m and created_by is null), 1);
  perform pg_temp.counted('and its runs stay, no longer naming who recorded them',
    (select count(*) from public.migration_runs where project_id = m and recorded_by is null), 12);
end $$;

reset role;
do $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  perform count(*) from public.migration_projects;
  raise exception 'FAILED: anon read the migrations';
exception when insufficient_privilege then
  raise notice 'ok  anon cannot read a migration';
end $$;
reset role;

rollback;
