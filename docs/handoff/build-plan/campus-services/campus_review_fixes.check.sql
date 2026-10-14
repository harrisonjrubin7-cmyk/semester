-- Checks for campus_review_fixes.sql. Same harness as campus_services.check.sql: paste its pg_temp helpers
-- (pg_temp.ok / pg_temp.fails) at the top. Runs in one transaction and rolls back. NOT RUN.
begin;
do $$ declare inst uuid := gen_random_uuid(); other uuid := gen_random_uuid(); s1 uuid; s2 uuid; bed uuid; a1 uuid; cl uuid; c1 uuid; c2 uuid;
  per tstzrange := tstzrange('2027-08-20','2027-12-18');
begin
  select id into s1 from auth.users order by created_at limit 1; select id into s2 from auth.users order by created_at offset 1 limit 1;
  insert into cs_bed_spaces (institution_id, residence, unit, label) values (inst, 'Hall R', '101', 'A') returning id into bed;

  -- P1 closure lifecycle
  insert into cs_occupancy_assignments (institution_id, bed_id, student_id, period, status, claim_kind, created_by) values (inst, bed, null, tstzrange('2027-06-01','2027-06-10'), 'blocked', 'closure', s1) returning id into cl;
  update cs_occupancy_assignments set status = 'cancelled' where id = cl;
  perform pg_temp.ok((select status = 'cancelled' from cs_occupancy_assignments where id = cl), 'closure retires to cancelled with no student');
  perform pg_temp.fails(format('update cs_occupancy_assignments set claim_kind = %L where id = %L', 'student', cl), 'claim kind is fixed after creation', 'P0001');
  perform pg_temp.fails(format($q$insert into cs_occupancy_assignments (institution_id, bed_id, student_id, period, status, claim_kind, created_by) values (%L,%L,%L,%L,'blocked','student',%L)$q$, inst, bed, s1, per, s1), 'a student claim can''t be blocked', '23514');

  -- P0 correspondence
  insert into cs_contract_versions (institution_id, student_id, period, terms_sha256, policy_version, accepted_at, accepted_by) values (inst, s1, per, 'x', 'housing-2027', now(), s1) returning id into c1;
  insert into cs_contract_versions (institution_id, student_id, period, terms_sha256, policy_version) values (inst, s2, per, 'x', 'housing-2027') returning id into c2;
  insert into cs_occupancy_assignments (institution_id, bed_id, student_id, period, status, reserved_until, created_by) values (inst, bed, s1, per, 'reserved', now() + interval '10 minutes', s1) returning id into a1;
  perform pg_temp.fails(format('update cs_occupancy_assignments set contract_version_id = %L where id = %L', c2, a1), 'another student''s contract id refused', '23503');
  perform pg_temp.fails(format($q$insert into cs_contract_versions (institution_id, student_id, period, terms_sha256, policy_version, accepted_at, accepted_by) values (%L,%L,%L,'x','v',now(),%L)$q$, inst, s1, per, s2), 'someone else can''t accept a student''s contract', '23514');

  -- P0 lifecycle
  perform pg_temp.fails(format($q$update cs_occupancy_assignments set status = 'assigned', reserved_until = null where id = %L$q$, a1), 'assigned without a contract refused', '23514');
  perform pg_temp.fails(format('select cs_confirm_assignment(%L,%L,%L)', inst, a1, c2), 'confirm with another student''s contract refused', '23503');
  perform cs_confirm_assignment(inst, a1, c1);
  perform pg_temp.ok((select status = 'assigned' and contract_version_id = c1 from cs_occupancy_assignments where id = a1), 'confirmed with matching accepted contract');
  perform cs_confirm_assignment(inst, a1, c1);
  perform pg_temp.ok((select count(*) = 1 from live_outbox where payload->>'assignment' = a1::text and event = 'housing.assignment.confirmed'), 'confirm retry is idempotent (one event)');
  update cs_occupancy_assignments set status = 'cancelled' where id = a1;
  insert into cs_occupancy_assignments (institution_id, bed_id, student_id, period, status, reserved_until, created_by) values (inst, bed, s1, per, 'reserved', now() - interval '1 minute', s1) returning id into a1;
  perform pg_temp.fails(format('select cs_confirm_assignment(%L,%L,%L)', inst, a1, c1), 'expired reservation can''t be confirmed', '23514');
  perform pg_temp.ok(cs_expire_reservations(inst) >= 1, 'expiry worker retires it');

  -- Authorization (role facts)
  perform pg_temp.ok(not (select rolcanlogin from pg_roles where rolname = 'semester_writer'), 'semester_writer cannot log in');
  perform pg_temp.ok(not (select rolbypassrls from pg_roles where rolname = 'authenticated'), 'authenticated does not bypass RLS');
  perform pg_temp.ok(not has_function_privilege('authenticated', 'public.cs_confirm_assignment(uuid,uuid,uuid)', 'execute'), 'browser role can''t call confirm directly');
  perform pg_temp.ok(not has_table_privilege('authenticated', 'public.cs_occupancy_assignments', 'insert'), 'browser role can''t insert claims');
end $$;
rollback;

-- Row-level read checks need a real signed-in session per role — see live-integration/e2e/campus-acceptance.spec (AT008, AT030).
