-- Checks for campus_services_invariants.sql + campus_operations_core.sql. Run on a branch DB after both are applied
-- (needs the live_integration migration for live_outbox). Self-contained: own institution, beds, students. Rolls back.
-- Every line prints `ok …`; the first failure raises and aborts.
begin;
create or replace function pg_temp.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond then raise notice 'ok %', label; else raise exception 'FAILED: %', label; end if; end $$;
create or replace function pg_temp.fails(sql text, label text, want_state text default null) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then
    if want_state is null or sqlstate = want_state then raise notice 'ok % (refused: %)', label, sqlerrm; return; end if;
    raise exception 'FAILED: % — wrong error % %', label, sqlstate, sqlerrm;
  end;
  raise exception 'FAILED: % — was accepted', label;
end $$;

do $$
declare inst uuid := gen_random_uuid(); s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid(); s3 uuid := gen_random_uuid();
  b1 uuid; b2 uuid; b3 uuid; fall tstzrange := tstzrange('2026-08-20','2026-12-18'); a public.cs_occupancy_assignments;
  e uuid; r1 public.cs_redemptions; r2 public.cs_redemptions; g uuid; run uuid; n int; d record;
begin
  perform set_config('cs.inst', inst::text, true); perform set_config('cs.s1', s1::text, true); perform set_config('cs.s2', s2::text, true);
  insert into cs_bed_spaces (institution_id, residence, unit, label) values (inst,'Hale','214','A') returning id into b1;
  insert into cs_bed_spaces (institution_id, residence, unit, label) values (inst,'Hale','214','B') returning id into b2;
  insert into cs_bed_spaces (institution_id, residence, unit, label) values (inst,'Hale','301','A') returning id into b3;
  perform set_config('cs.b1', b1::text, true); perform set_config('cs.b2', b2::text, true);

  -- Housing
  a := cs_select_bed(inst, b1, s1, 1, fall);
  perform pg_temp.ok(a.status = 'reserved' and a.reserved_until > now(), 'select bed → expiring reservation');
  perform pg_temp.ok((select inventory_version from cs_bed_spaces where id = b1) = 2, 'selection bumps inventory version');
  perform pg_temp.fails(format('select cs_select_bed(%L,%L,%L,1,%L)', inst, b1, s2, fall), 'stale inventory version refused', '40001');
  perform pg_temp.fails(format('select cs_select_bed(%L,%L,%L,2,%L)', inst, b1, s2, fall), 'second occupant for the same bed + period refused', '23P01');
  update cs_occupancy_assignments set status = 'assigned' where id = a.id;
  perform pg_temp.fails(format('select cs_select_bed(%L,%L,%L,1,%L)', inst, b2, s1, fall), 'student can''t hold two beds in one period', '23P01');
  perform pg_temp.ok((select count(*) from cs_select_bed(inst, b2, s1, 1, tstzrange('2027-01-10','2027-05-07'))) = 1, 'same student, non-overlapping spring period allowed');
  perform pg_temp.fails(format($q$insert into cs_occupancy_assignments (institution_id,bed_id,student_id,period,status,created_by,override_reason) values (%L,%L,%L,tstzrange('2027-06-01','2027-07-01'),'assigned',%L,'staff exception')$q$, inst, b3, s3, s3), 'override without a named approver refused', '23514');
  perform pg_temp.fails(format($q$insert into cs_occupancy_assignments (institution_id,bed_id,student_id,period,status,created_by) values (%L,%L,%L,tstzrange('2027-06-01','2027-07-01'),'reserved',%L)$q$, inst, b3, s3, s3), 'reservation without expiry refused', '23514');

  -- Dining entitlements
  insert into cs_entitlements (institution_id, student_id, kind, unit, granted, effective, source_ref) values (inst, s1, 'meal_unit', 'meal', 2, tstzrange(now() - interval '1 day', now() + interval '90 days'), 'plan v2026.1') returning id into e;
  r1 := cs_redeem(inst, e, 1, 'order-0001-key-aaaaaaaa', 'O-1');
  r2 := cs_redeem(inst, e, 1, 'order-0001-key-aaaaaaaa', 'O-1');
  perform pg_temp.ok(r1.id = r2.id, 'device retry returns the original redemption');
  perform pg_temp.ok((select sum(qty) from cs_redemptions where entitlement_id = e) = 1, 'balance decremented once');
  perform pg_temp.fails(format('select cs_redeem(%L,%L,2,%L,%L)', inst, e, 'order-0001-key-aaaaaaaa', 'O-1'), 'same key, different quantity refused', '22023');
  perform cs_redeem(inst, e, 1, 'order-0002-key-bbbbbbbb', 'O-2');
  perform pg_temp.fails(format('select cs_redeem(%L,%L,1,%L,%L)', inst, e, 'order-0003-key-cccccccc', 'O-3'), 'can''t overdraw the last meal', '23514');
  perform pg_temp.fails(format('insert into cs_redemptions (institution_id,entitlement_id,qty,idempotency_key) values (%L,%L,-1,%L)', inst, e, 'neg-without-reverses-1'), 'negative quantity without a reversal link refused', '23514');
  perform pg_temp.ok((select count(*) from cs_redemptions where entitlement_id = e) = 2, 'redemptions append-only (2 rows)');

  -- Roommate groups (acceptance is tied to the group version; membership changes bump it)
  insert into cs_roommate_groups (institution_id) values (inst) returning id into g;
  insert into cs_roommate_memberships (group_id, student_id) values (g, s1), (g, s2);
  select version into n from cs_roommate_groups where id = g;
  perform pg_temp.ok(n = 3, 'adding two members bumps the group version twice');
  update cs_roommate_memberships set accepted_at = now(), accepted_by = s1, accepted_group_version = n where group_id = g and student_id = s1;
  perform pg_temp.fails(format('update cs_roommate_memberships set accepted_at = now(), accepted_by = %L, accepted_group_version = %s where group_id = %L and student_id = %L', s3, n, g, s2), 'another user can''t accept for a student', '23514');
  perform pg_temp.fails(format('update cs_roommate_memberships set accepted_at = now(), accepted_by = %L where group_id = %L and student_id = %L', s2, g, s2), 'acceptance must name the group version', '23514');
  update cs_roommate_memberships set accepted_at = now(), accepted_by = s2, accepted_group_version = n where group_id = g and student_id = s2;
  -- AT003: preview at version n, then a member joins → commit with the old version refused
  insert into cs_roommate_memberships (group_id, student_id) values (g, s3);
  perform pg_temp.fails(format('select cs_select_group_beds(%L,%L,%s,array[%L,%L,%L]::uuid[],1,%L,%L)', inst, g, n, b1, b2, b3, tstzrange('2027-08-20','2027-12-18'), 'group-sel-key-0000000001'), 'AT003 group version mismatch blocks commit', '40001');
  -- Even at the new version, the two earlier acceptances no longer count
  update cs_roommate_memberships set accepted_at = now(), accepted_by = s3, accepted_group_version = n + 1 where group_id = g and student_id = s3;
  perform pg_temp.fails(format('select cs_select_group_beds(%L,%L,%s,array[%L,%L,%L]::uuid[],1,%L,%L)', inst, g, n + 1, b1, b2, b3, tstzrange('2027-08-20','2027-12-18'), 'group-sel-key-0000000002'), 'acceptances of the old group don''t count after a membership change', '23514');

  -- Bed closure: a blocked claim with no student shares the bed exclusion
  perform pg_temp.fails(format($q$insert into cs_occupancy_assignments (institution_id,bed_id,student_id,period,status,created_by) values (%L,%L,null,%L,'blocked',%L)$q$, inst, b1, fall, s3), 'closure overlapping an assignment refused', '23P01');
  insert into cs_occupancy_assignments (institution_id,bed_id,student_id,period,status,created_by) values (inst, b1, null, tstzrange('2026-12-18','2027-01-10'), 'blocked', s3);
  perform pg_temp.ok(true, 'adjacent closure (winter break) accepted');
  perform pg_temp.fails(format($q$insert into cs_occupancy_assignments (institution_id,bed_id,student_id,period,status,created_by) values (%L,%L,%L,tstzrange('2027-06-01','2027-07-01'),'blocked',%L)$q$, inst, b3, s3, s3), 'closure can''t name a student', '23514');

  -- Allocation runs
  insert into cs_allocation_runs (institution_id, housing_period, policy_version, inventory_version, eligible_list_sha256, accommodation_set_sha256, group_membership_version, method, operator)
    values (inst, 'Fall 2026', 'v2026.3', 7, 'abc', 'def', 1, 'self_selection', s3) returning id into run;
  perform pg_temp.fails(format($q$insert into cs_allocation_runs (institution_id,housing_period,policy_version,inventory_version,eligible_list_sha256,accommodation_set_sha256,group_membership_version,method,operator) values (%L,'Fall','v1',1,'a','b',1,'lottery',%L)$q$, inst, s3), 'lottery without a seed refused', '23514');
  perform pg_temp.fails(format('update cs_allocation_runs set published_at = now() where id = %L', run), 'publish without a reviewer refused', '23514');
  perform pg_temp.fails(format('update cs_allocation_runs set reviewer = %L where id = %L', s3, run), 'reviewer must differ from operator', '23514');
  update cs_allocation_runs set reviewer = s2, published_at = now() where id = run;
  perform pg_temp.fails(format('update cs_allocation_runs set policy_version = %L where id = %L', 'v2026.4', run), 'published run immutable');

  -- Reservation release never while payment outcome is unknown
  a := cs_select_bed(inst, b3, s3, 1, fall);
  update cs_occupancy_assignments set reserved_until = now() - interval '1 minute' where id = a.id;
  insert into cs_payment_attempts (institution_id, student_id, reference, amount_minor, status, idempotency_key) values (inst, s3, a.id::text, 25000, 'outcome_unknown', 'deposit-key-0000000001');
  n := cs_release_expired_reservations(inst);
  perform pg_temp.ok(n = 0 and (select status from cs_occupancy_assignments where id = a.id) = 'reserved', 'expired reservation kept while deposit outcome unknown');
  update cs_payment_attempts set status = 'failed' where reference = a.id::text;
  n := cs_release_expired_reservations(inst);
  perform pg_temp.ok(n = 1, 'released once the deposit failed');

  -- AT013: repeat rollover for the same lot + policy version refused
  insert into cs_rollover_runs (institution_id, source_lot, policy_version, transferred) values (inst, e, 'rollover-v1', 0);
  perform pg_temp.fails(format($q$insert into cs_rollover_runs (institution_id, source_lot, policy_version, transferred) values (%L,%L,'rollover-v1',0)$q$, inst, e), 'AT013 repeat rollover batch refused', '23505');

  -- Payments: duplicate provider event
  insert into cs_provider_events values (inst, 'evt_1');
  perform pg_temp.fails(format('insert into cs_provider_events values (%L,%L)', inst, 'evt_1'), 'duplicate provider event refused', '23505');

  -- Title IV deadline
  select * into d from cs_title_iv_due('2026-08-20','2026-08-24'); perform pg_temp.ok(d.due_on = date '2026-09-07', 'Title IV: created before classes → first day + 14');
  select * into d from cs_title_iv_due('2026-09-03','2026-08-24'); perform pg_temp.ok(d.due_on = date '2026-09-17', 'Title IV: created after classes began → creation + 14');
  select * into d from cs_title_iv_due('2026-08-20','2026-08-24','2026-10-01'); perform pg_temp.ok(d.due_on = date '2026-10-15', 'Title IV: authorization cancelled → notice + 14');

  -- Credit-balance obligation can't close without delivery
  insert into cs_credit_balance_obligations (institution_id, student_id, payment_period, kind, amount_minor, calculation_version, created_on, classes_start, due_on, due_basis, recipient, responsible_officer)
    values (inst, s1, 'Fall 2026', 'title_iv', 41000, 'cb-v1', '2026-08-20', '2026-08-24', '2026-09-07', 'first day + 14', 'student', s3);
  perform pg_temp.fails(format($q$update cs_credit_balance_obligations set status = 'closed' where institution_id = %L$q$, inst), 'close without delivery reference refused', '23514');
end $$;
rollback;
