-- 017_command_tests.sql: behavioral pgTAP for 014 + 017, covering AC-04, 05, 06, 07, 11 and 14 from your access standard plus the
-- housing and dining command checks. Disposable local database only. Fixture rows are inserted as the migration owner (omitted
-- here like 014's test). Results not claimed.
BEGIN;
SET LOCAL search_path = semester, extensions, public;
SELECT no_plan();
\set T  '11111111-0000-0000-0000-000000000001'
\set T2 '11111111-0000-0000-0000-000000000002'
\set U_MAYA '22222222-0000-0000-0000-000000000001'
\set U_SAM  '22222222-0000-0000-0000-000000000005'
\set U_DINING_A '22222222-0000-0000-0000-000000000010'
\set U_DINING_B '22222222-0000-0000-0000-000000000011'
\set U_POS '22222222-0000-0000-0000-000000000012'
-- Fixtures assumed: cycle C1 with an open window for Maya; bed B1 available; Maya's native wallet W1 with +1000 minor units;
-- an adjustment request R1 (+500) submitted by DINING_A; Sam is a peer student; T2 has its own wallet W2.
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$ SELECT set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) $$;

-- AC-04 / AC-05: spoofed owner or tenant, moving a row between tenants
SELECT pg_temp.as_user(:'U_MAYA'); SET LOCAL ROLE authenticated;
SELECT throws_ok($$ INSERT INTO semester.housing_allocations(tenant_id, cycle_id, bed_id, person_id, occupancy_range, state, expires_at, request_key) VALUES ('11111111-0000-0000-0000-000000000001', gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), tstzrange(now(), now() + interval '1 month'), 'reserved', now(), 'x') $$, '42501', NULL, 'AC-04: no direct insert with a spoofed owner');
SELECT throws_ok($$ UPDATE semester.campus_wallets SET tenant_id = '11111111-0000-0000-0000-000000000002' $$, '42501', NULL, 'AC-05: no direct update moving a wallet to another tenant');
-- AC-06: self-grant
SELECT throws_ok($$ INSERT INTO semester.role_assignments(tenant_id, person_id, role_id, scope_type, scope_reference, starts_at) VALUES ('11111111-0000-0000-0000-000000000001', gen_random_uuid(), gen_random_uuid(), 'institution', 'x', now()) $$, '42501', NULL, 'AC-06: cannot grant yourself a role');
-- Housing commands
SELECT lives_ok($$ SELECT semester.reserve_bed('11111111-0000-0000-0000-000000000001', (SELECT id FROM semester.housing_cycles LIMIT 1), (SELECT id FROM semester.housing_beds LIMIT 1), tstzrange('2027-08-21', '2028-05-08'), 'req-1') $$, 'student reserves a bed in an open window');
SELECT is(semester.reserve_bed('11111111-0000-0000-0000-000000000001', (SELECT id FROM semester.housing_cycles LIMIT 1), (SELECT id FROM semester.housing_beds LIMIT 1), tstzrange('2027-08-21', '2028-05-08'), 'req-1'),
          semester.reserve_bed('11111111-0000-0000-0000-000000000001', (SELECT id FROM semester.housing_cycles LIMIT 1), (SELECT id FROM semester.housing_beds LIMIT 1), tstzrange('2027-08-21', '2028-05-08'), 'req-1'), 'replaying the same request key returns the same allocation');
-- AC-07: definer RPC with a foreign id
SELECT throws_ok($$ SELECT semester.spend_from_wallet('11111111-0000-0000-0000-000000000001', (SELECT id FROM semester.campus_wallets LIMIT 1), 100, NULL, 'k1') $$, '42501', 'FORBIDDEN', 'AC-07/AC-11: a student cannot call the POS spend command');
RESET ROLE;

SELECT pg_temp.as_user(:'U_SAM'); SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT semester.confirm_bed('11111111-0000-0000-0000-000000000001', (SELECT id FROM semester.housing_allocations WHERE request_key = 'req-1'), 1) $$, '42501', 'NOT_FOUND', 'AC-07: a peer cannot confirm someone else’s hold, and gets the same answer as for a missing one');
RESET ROLE;

-- Hold expiry checked inside the lock
UPDATE semester.housing_allocations SET expires_at = now() - interval '1 second' WHERE request_key = 'req-1';
SELECT pg_temp.as_user(:'U_MAYA'); SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT semester.confirm_bed('11111111-0000-0000-0000-000000000001', (SELECT id FROM semester.housing_allocations WHERE request_key = 'req-1'), 1) $$, 'P0001', 'HOLD_EXPIRED', 'an expired hold cannot be confirmed');
RESET ROLE;

-- Dining: overdraft, separation of duties, reversals
SELECT pg_temp.as_user(:'U_POS'); SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT semester.spend_from_wallet('11111111-0000-0000-0000-000000000001', (SELECT id FROM semester.campus_wallets WHERE authority_connection_id IS NULL LIMIT 1), 999999, NULL, 'k-over') $$, 'P0001', 'INSUFFICIENT_FUNDS', 'no overdraft');
SELECT lives_ok($$ SELECT semester.spend_from_wallet('11111111-0000-0000-0000-000000000001', (SELECT id FROM semester.campus_wallets WHERE authority_connection_id IS NULL LIMIT 1), 300, NULL, 'k-300') $$, 'POS spend within balance');
SELECT is(semester.wallet_balance('11111111-0000-0000-0000-000000000001', (SELECT id FROM semester.campus_wallets WHERE authority_connection_id IS NULL LIMIT 1)), 700::bigint, 'balance is the sum of entries');
RESET ROLE;
SELECT pg_temp.as_user(:'U_DINING_A'); SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT semester.approve_wallet_adjustment('11111111-0000-0000-0000-000000000001', (SELECT id FROM semester.dining_adjustment_requests LIMIT 1)) $$, '42501', 'SELF_APPROVAL_FORBIDDEN', 'requester cannot approve their own adjustment');
RESET ROLE;
SELECT pg_temp.as_user(:'U_DINING_B'); SET LOCAL ROLE authenticated;
SELECT lives_ok($$ SELECT semester.approve_wallet_adjustment('11111111-0000-0000-0000-000000000001', (SELECT id FROM semester.dining_adjustment_requests LIMIT 1)) $$, 'a second person approves');
SELECT lives_ok($$ SELECT semester.reverse_wallet_entry('11111111-0000-0000-0000-000000000001', (SELECT id FROM semester.campus_wallet_entries WHERE idempotency_key = 'k-300'), 'customer dispute') $$, 'reverse a purchase');
SELECT throws_ok($$ SELECT semester.reverse_wallet_entry('11111111-0000-0000-0000-000000000001', (SELECT id FROM semester.campus_wallet_entries WHERE idempotency_key = 'k-300'), 'again') $$, 'P0001', 'ALREADY_REVERSED', 'a purchase reverses once');
RESET ROLE;

-- AC-14: a revoked grant stops the next call in the same session
UPDATE semester.role_assignments SET revoked_at = now() WHERE person_id = (SELECT person_id FROM semester.identity_links WHERE subject = :'U_DINING_B');
SELECT pg_temp.as_user(:'U_DINING_B'); SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT semester.reverse_wallet_entry('11111111-0000-0000-0000-000000000001', (SELECT id FROM semester.campus_wallet_entries LIMIT 1), 'x') $$, '42501', 'FORBIDDEN', 'AC-14: revocation takes effect immediately');
RESET ROLE;
-- Concurrency (two sessions spending the last balance at once) needs two connections: run with pg_prove's parallel harness or a small
-- Node script; expected result is exactly one success and one INSUFFICIENT_FUNDS.
SELECT * FROM finish();
ROLLBACK;
