-- membership_tests.sql: pgTAP checks for membership_stripe_migration.sql + 006_membership_completion.sql.
-- LOCAL DISPOSABLE DATABASE ONLY, after rls_reference_tests.sql fixtures exist. Results not claimed: run it.
BEGIN;
SET LOCAL search_path = extensions, public;
SELECT no_plan();

-- fixtures (deterministic ids; reuse studenta/studentb from rls_reference_tests.sql)
\set a '822368d0-8a7e-56d8-9c83-7e9fdae92f67'
\set b '82c0b311-d29a-5527-8f07-f0efce231f16'
INSERT INTO sx_private.stripe_prices(price_id, tier, cadence, livemode, unit_amount, currency) VALUES ('price_plus_m_draft', 'plus', 'month', false, 899, 'USD');
INSERT INTO sx_private.stripe_prices(price_id, tier, cadence, livemode, unit_amount, currency, approved_at, approved_by) VALUES ('price_pro_m', 'pro', 'month', false, 1799, 'USD', now(), :'a');
UPDATE sx_private.tier_allowances SET approved_at = now();

CREATE FUNCTION pg_temp.act(u uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) $$;

-- 1. Private tables are unreadable by clients
SELECT pg_temp.act(:'a'); SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT * FROM sx_private.checkout_sessions $$, '42501', NULL, 'checkout_sessions not readable by clients');
SELECT throws_ok($$ SELECT * FROM sx_private.usage_events $$, '42501', NULL, 'usage_events not readable by clients');
SELECT throws_ok($$ SELECT * FROM sx_private.personal_memberships $$, '42501', NULL, 'personal_memberships not readable by clients');

-- 2. An unapproved price can't be bought, and the client can't name an amount
SELECT throws_ok($$ SELECT sx_private.start_checkout('11111111-1111-1111-1111-111111111111', 'plus', 'month', '/account/subscription', false) $$, 'P0001', 'PRICE_NOT_APPROVED', 'draft price refused');
SELECT is((sx_private.start_checkout('22222222-2222-2222-2222-222222222222', 'pro', 'month', '/account/subscription', false)->>'amount')::bigint, 1799::bigint, 'amount comes from the approved price');

-- 3. Idempotency: same key same payload replays; same key different payload conflicts
SELECT is(sx_private.start_checkout('22222222-2222-2222-2222-222222222222', 'pro', 'month', '/account/subscription', false)->>'checkoutId',
          sx_private.start_checkout('22222222-2222-2222-2222-222222222222', 'pro', 'month', '/account/subscription', false)->>'checkoutId', 'replay returns the same checkout');
SELECT throws_ok($$ SELECT sx_private.start_checkout('22222222-2222-2222-2222-222222222222', 'pro', 'month', '/app/student', false) $$, '23505', NULL, 'same key, different payload conflicts');

-- 4. Starting checkout does not grant anything
SELECT is(sx_private.personal_tier(), 'free', 'checkout alone leaves the tier at free');
SELECT is(sx_private.has_feature('research_workspace'), false, 'no Pro feature before the worker confirms payment');

-- 5. Free core is always available; paid plans never needed for it
SELECT is(sx_private.has_feature('personal_notes'), true, 'free core feature');

-- 6. Usage: cost must be disclosed first; quota is enforced; no silent borrowing
RESET ROLE;
SELECT sx_private.refresh_allowances(now());
SELECT pg_temp.act(:'a'); SET LOCAL ROLE authenticated;
SELECT throws_ok($$ SELECT sx_private.record_usage('33333333-3333-3333-3333-333333333333', 'ai.explain', 5, NULL, NULL) $$, '22023', 'COST_NOT_DISCLOSED', 'undisclosed cost refused');
SELECT is((sx_private.record_usage('44444444-4444-4444-4444-444444444444', 'ai.explain', 5, NULL, now())->>'source'), 'personal_tier', 'personal work uses the personal allowance');
SELECT throws_ok($$ SELECT sx_private.record_usage('55555555-5555-5555-5555-555555555555', 'ai.research', 1000, NULL, now()) $$, 'P0001', 'QUOTA_EXHAUSTED', 'over quota refused, not borrowed');
SELECT throws_ok($$ SELECT sx_private.record_usage('66666666-6666-6666-6666-666666666666', 'ai.explain', 1, '00000000-0000-0000-0000-0000000000ff', now()) $$, '42501', NULL, 'course-work usage needs a live enrollment in that section');

-- 7. Usage events are append-only, even for the owner role
RESET ROLE;
SELECT throws_ok($$ UPDATE sx_private.usage_events SET credits = 1 $$, '42501', 'append-only', 'usage events cannot be edited');

-- 8. Sponsorship needs the beneficiary's acceptance, and a sponsor can't pay for a stranger
SELECT pg_temp.act(:'b'); SET LOCAL ROLE authenticated;
SELECT throws_ok(format($$ SELECT sx_private.start_checkout('77777777-7777-7777-7777-777777777777', 'pro', 'month', '/account/subscription', false, %L) $$, :'a'), '42501', NULL, 'no sponsorship, no paying for someone else');
SELECT isnt(sx_private.offer_sponsorship('studenta@example.invalid', 'pro'), NULL, 'sponsor can offer');
SELECT is(sx_private.offer_sponsorship('nobody@example.invalid', 'pro'), NULL, 'unknown email gives the same empty answer');
SELECT pg_temp.act(:'a');
SELECT is(sx_private.sponsored_tier(), 'free', 'offered but unaccepted sponsorship grants nothing');

-- 9. Scheduling a change needs a paid tier; withdrawing someone else's change is refused
SELECT throws_ok($$ SELECT sx_private.schedule_change('88888888-8888-8888-8888-888888888888', 'free') $$, 'P0001', 'NO_PAID_TIER', 'free users have nothing to change');
SELECT throws_ok($$ SELECT sx_private.withdraw_change('00000000-0000-0000-0000-0000000000aa') $$, '42501', NULL, 'unknown or foreign change refused');

-- 10. Service-only functions are not callable by clients
SELECT throws_ok($$ SELECT sx_private.attach_stripe_session(gen_random_uuid(), 'cs_test') $$, '42501', NULL, 'attach_stripe_session is service-only');
SELECT throws_ok($$ SELECT sx_private.refresh_allowances(now()) $$, '42501', NULL, 'refresh_allowances is service-only');

SELECT * FROM finish();
ROLLBACK;
