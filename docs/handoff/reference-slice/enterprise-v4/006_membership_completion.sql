-- 006_membership_completion.sql: what membership_stripe_migration.sql leaves out.
-- Order: complete_enterprise_schema → 002_access → 003_permission_seed → 004_note_command
--        → membership_stripe_migration → THIS FILE. Trusted owner, staging first. NOT executed or parsed.
--
-- membership_stripe_migration.sql already owns:
--   personal tier state (sx_private.personal_memberships), approved Stripe prices (stripe_prices),
--   durable webhook receipt + worker queue (stripe_events), institution sponsorship columns on
--   sx_private.memberships, and sx_private.has_feature().
-- This file adds the four things it doesn't model:
--   1. How a purchase starts: checkout sessions bound to an APPROVED price, created by the server.
--   2. Scheduled plan changes the person can see and withdraw.
--   3. Person-to-person sponsorship (e.g. a parent paying for Plus), with the beneficiary's consent.
--   4. What is used: monthly AI-credit allowances per source, append-only usage events, quota checks.
--   Plus institution buyer requests and a read model for the membership screen.
-- Payment state still comes ONLY from the Stripe worker processing verified events. Nothing here sets tier.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- ------------------------------------------------ 0. price approval (stripe_prices rows alone don't approve a price)
ALTER TABLE sx_private.stripe_prices
  ADD COLUMN unit_amount bigint CHECK (unit_amount > 0),
  ADD COLUMN currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  ADD COLUMN approved_at timestamptz,
  ADD COLUMN approved_by uuid REFERENCES auth.users(id),
  ADD CONSTRAINT stripe_price_approval CHECK ((approved_at IS NULL) = (approved_by IS NULL)),
  ADD CONSTRAINT stripe_price_amount_when_approved CHECK (approved_at IS NULL OR unit_amount IS NOT NULL);
CREATE UNIQUE INDEX one_live_price_per_tier_cadence ON sx_private.stripe_prices(tier, cadence, livemode) WHERE enabled AND approved_at IS NOT NULL;

-- Allowances per tier. Values are the DRAFT catalog (30 / 250 / 750 credits, 2 / 50 / 100 GB): approve before use.
CREATE TABLE sx_private.tier_allowances (
  tier text PRIMARY KEY CHECK (tier IN ('free', 'plus', 'pro')),
  ai_credits_per_month integer NOT NULL CHECK (ai_credits_per_month >= 0),
  storage_bytes bigint NOT NULL CHECK (storage_bytes >= 0),
  approved_at timestamptz
);
INSERT INTO sx_private.tier_allowances(tier, ai_credits_per_month, storage_bytes) VALUES
  ('free', 30, 2::bigint * 1024 * 1024 * 1024), ('plus', 250, 50::bigint * 1024 * 1024 * 1024), ('pro', 750, 100::bigint * 1024 * 1024 * 1024);

-- ------------------------------------------------ 1. checkout sessions
CREATE TABLE sx_private.checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  request_key uuid NOT NULL,
  request_payload jsonb NOT NULL,
  price_id text NOT NULL REFERENCES sx_private.stripe_prices(price_id),
  tier text NOT NULL CHECK (tier IN ('plus', 'pro')),
  cadence text NOT NULL CHECK (cadence IN ('month', 'year')),
  unit_amount bigint NOT NULL CHECK (unit_amount > 0),
  currency text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('new', 'upgrade')),
  paid_by uuid NOT NULL REFERENCES auth.users(id),        -- owner, or a person sponsor paying for them
  sponsorship_id uuid,
  return_path text NOT NULL CHECK (return_path IN ('/app/student', '/account/subscription')),
  stripe_checkout_session_id text UNIQUE,                  -- set by the server after it creates the Stripe session
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'open', 'completed', 'expired', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  UNIQUE (paid_by, request_key)
);

-- ------------------------------------------------ 2. scheduled changes
CREATE TABLE sx_private.membership_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  kind text NOT NULL CHECK (kind IN ('downgrade', 'cadence_change', 'cancel')),
  to_tier text CHECK (to_tier IN ('free', 'plus', 'pro')),
  to_cadence text CHECK (to_cadence IN ('month', 'year')),
  effective_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'scheduled_at_stripe', 'applied', 'withdrawn', 'failed')),
  request_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, request_key)
);
CREATE UNIQUE INDEX one_open_change ON sx_private.membership_changes(owner_id) WHERE status IN ('requested', 'scheduled_at_stripe');

-- ------------------------------------------------ 3. person sponsorships (institution sponsorship stays on sx_private.memberships)
CREATE TABLE sx_private.person_sponsorships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES auth.users(id),
  beneficiary_id uuid NOT NULL REFERENCES auth.users(id),
  tier text NOT NULL CHECK (tier IN ('plus', 'pro')),
  status text NOT NULL DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'declined', 'ended')),
  sponsor_sees text NOT NULL DEFAULT 'status_only' CHECK (sponsor_sees IN ('status_only')),  -- never usage detail, notes or coursework
  stripe_subscription_id text UNIQUE,                       -- sponsor's own Stripe subscription
  access_until timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sponsor_id <> beneficiary_id),
  CHECK ((status = 'accepted') = (accepted_at IS NOT NULL) OR status = 'ended')
);
CREATE UNIQUE INDEX one_active_person_sponsorship ON sx_private.person_sponsorships(beneficiary_id) WHERE status = 'accepted';
ALTER TABLE sx_private.checkout_sessions ADD FOREIGN KEY (sponsorship_id) REFERENCES sx_private.person_sponsorships(id);

-- ------------------------------------------------ 4. usage
CREATE TABLE sx_private.usage_allowances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  source text NOT NULL CHECK (source IN ('personal_tier', 'person_sponsor', 'institution')),
  institution_tenant_id uuid REFERENCES sx.tenants(id),
  scope text NOT NULL CHECK (scope IN ('any', 'course_work')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL CHECK (period_end > period_start),
  credits_granted integer NOT NULL CHECK (credits_granted >= 0),
  credits_used integer NOT NULL DEFAULT 0 CHECK (credits_used >= 0 AND credits_used <= credits_granted),
  CHECK ((source = 'institution') = (institution_tenant_id IS NOT NULL)),
  CHECK (source <> 'institution' OR scope = 'course_work')   -- institution pools pay for course work only
);
CREATE UNIQUE INDEX one_allowance_per_period ON sx_private.usage_allowances(owner_id, source, COALESCE(institution_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), period_start);
CREATE TABLE sx_private.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  allowance_id uuid NOT NULL REFERENCES sx_private.usage_allowances(id),
  action_code text NOT NULL CHECK (action_code ~ '^[a-z][a-z0-9_.]{1,63}$'),
  credits integer NOT NULL CHECK (credits > 0),
  section_id uuid,
  cost_disclosed_at timestamptz NOT NULL,
  request_key uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, request_key)
);
CREATE FUNCTION sx_private.append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'append-only'; END $$;
CREATE TRIGGER usage_events_append_only BEFORE UPDATE OR DELETE ON sx_private.usage_events FOR EACH ROW EXECUTE FUNCTION sx_private.append_only();

-- ------------------------------------------------ 5. institution buyer requests
CREATE TABLE sx_private.institution_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id),
  request_key uuid NOT NULL,
  institution_name text NOT NULL CHECK (length(btrim(institution_name)) BETWEEN 1 AND 200),
  contact_email text NOT NULL CHECK (contact_email ~ '^[^@\s]+@[^@\s]+$'),
  enrolled_students integer NOT NULL CHECK (enrolled_students BETWEEN 1 AND 10000000),
  requested_modules text[] NOT NULL CHECK (cardinality(requested_modules) BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'qualifying', 'quoted', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, request_key)
);

-- All new tables are private: clients read through the functions below, never directly.
ALTER TABLE sx_private.tier_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.membership_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.person_sponsorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.usage_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.institution_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sx_private.tier_allowances, sx_private.checkout_sessions, sx_private.membership_changes, sx_private.person_sponsorships, sx_private.usage_allowances, sx_private.usage_events, sx_private.institution_requests FROM PUBLIC, anon, authenticated;

CREATE FUNCTION sx_private.lock_key(p_owner uuid, p_key uuid) RETURNS void LANGUAGE sql SET search_path = '' AS $$
  SELECT pg_advisory_xact_lock(hashtextextended(p_owner::text || ':' || p_key::text, 0)) $$;

-- ------------------------------------------------ person sponsorship counts toward features
-- Replaces has_feature() from membership_stripe_migration.sql with one added branch: an accepted, unexpired person sponsorship.
CREATE OR REPLACE FUNCTION sx_private.sponsored_tier() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT tier FROM sx_private.person_sponsorships WHERE beneficiary_id = auth.uid() AND status = 'accepted' AND access_until > now()), 'free') $$;
CREATE OR REPLACE FUNCTION sx_private.has_feature(p_feature text, p_tenant uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT auth.uid() IS NOT NULL AND CASE
 WHEN p_feature IN ('personal_planner', 'personal_notes', 'basic_study') THEN true
 WHEN p_feature IN ('advanced_study', 'calendar_sync', 'advanced_search', 'personal_analytics') THEN
  sx_private.personal_tier() IN ('plus', 'pro') OR sx_private.sponsored_tier() IN ('plus', 'pro')
  OR EXISTS (SELECT 1 FROM sx_private.memberships m JOIN sx.tenants t ON t.id = m.tenant_id WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant AND m.status = 'active' AND t.status = 'active' AND m.sponsorship_status = 'active' AND m.sponsored_bundle IN ('plus', 'pro') AND m.sponsorship_ends_at > now())
 WHEN p_feature IN ('research_workspace', 'workflow_automation', 'priority_support') THEN
  sx_private.personal_tier() = 'pro' OR sx_private.sponsored_tier() = 'pro'
  OR EXISTS (SELECT 1 FROM sx_private.memberships m JOIN sx.tenants t ON t.id = m.tenant_id WHERE m.user_id = auth.uid() AND m.tenant_id = p_tenant AND m.status = 'active' AND t.status = 'active' AND m.sponsorship_status = 'active' AND m.sponsored_bundle = 'pro' AND m.sponsorship_ends_at > now())
 ELSE false END $$;

-- ------------------------------------------------ client commands
-- start_checkout: binds a session to the single approved, enabled price for tier + cadence. The server then
-- creates the Stripe Checkout Session with that price_id, and calls attach_stripe_session (service role).
-- p_beneficiary NULL = buying for yourself; otherwise the caller must hold an accepted-or-offered sponsorship to that person.
CREATE FUNCTION sx_private.start_checkout(p_key uuid, p_tier text, p_cadence text, p_return text, p_livemode boolean, p_beneficiary uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid(); owner uuid; payload jsonb; old record; pr record; pm record; sp uuid; s uuid;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Unauthenticated'; END IF;
  IF p_key IS NULL OR p_tier NOT IN ('plus', 'pro') OR p_cadence NOT IN ('month', 'year') OR p_return NOT IN ('/app/student', '/account/subscription') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid checkout input'; END IF;
  owner := coalesce(p_beneficiary, u);
  payload := jsonb_build_object('tier', p_tier, 'cadence', p_cadence, 'return', p_return, 'for', owner);
  PERFORM sx_private.lock_key(u, p_key);
  SELECT * INTO old FROM sx_private.checkout_sessions WHERE paid_by = u AND request_key = p_key;
  IF FOUND THEN
    IF old.request_payload <> payload THEN RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Idempotency conflict'; END IF;
    RETURN jsonb_build_object('checkoutId', old.id, 'priceId', old.price_id, 'amount', old.unit_amount, 'currency', old.currency, 'state', old.status);
  END IF;
  IF owner <> u THEN
    SELECT id INTO sp FROM sx_private.person_sponsorships WHERE sponsor_id = u AND beneficiary_id = owner AND tier = p_tier AND status IN ('offered', 'accepted');
    IF sp IS NULL THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No sponsorship'; END IF;
  END IF;
  SELECT * INTO pr FROM sx_private.stripe_prices WHERE tier = p_tier AND cadence = p_cadence AND livemode = p_livemode AND enabled AND approved_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PRICE_NOT_APPROVED'; END IF;
  SELECT * INTO pm FROM sx_private.personal_memberships WHERE user_id = owner;
  IF owner = u AND FOUND AND pm.tier <> 'free' AND pm.access_until > now() THEN
    IF pm.tier = p_tier THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ALREADY_ON_TIER'; END IF;
    IF NOT (pm.tier = 'plus' AND p_tier = 'pro') THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'USE_SCHEDULE_CHANGE'; END IF;
  END IF;
  INSERT INTO sx_private.checkout_sessions(owner_id, request_key, request_payload, price_id, tier, cadence, unit_amount, currency, purpose, paid_by, sponsorship_id, return_path)
  VALUES (owner, p_key, payload, pr.price_id, p_tier, p_cadence, pr.unit_amount, pr.currency,
          CASE WHEN owner = u AND FOUND AND pm.tier = 'plus' THEN 'upgrade' ELSE 'new' END, u, sp, p_return)
  RETURNING id INTO s;
  RETURN jsonb_build_object('checkoutId', s, 'priceId', pr.price_id, 'amount', pr.unit_amount, 'currency', pr.currency, 'state', 'created');
END $$;

-- schedule_change: downgrade, cadence change or cancel, effective at the paid-through date. The worker mirrors it to a
-- Stripe subscription schedule and marks it 'scheduled_at_stripe'. Upgrades are purchases: use start_checkout.
CREATE FUNCTION sx_private.schedule_change(p_key uuid, p_tier text, p_cadence text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid(); pm record; old record; k text; c uuid;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Unauthenticated'; END IF;
  IF p_tier NOT IN ('free', 'plus', 'pro') OR (p_tier <> 'free' AND p_cadence NOT IN ('month', 'year')) THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid change'; END IF;
  PERFORM sx_private.lock_key(u, p_key);
  SELECT * INTO old FROM sx_private.membership_changes WHERE owner_id = u AND request_key = p_key;
  IF FOUND THEN RETURN jsonb_build_object('changeId', old.id, 'effectiveAt', old.effective_at, 'paymentRequired', false); END IF;
  SELECT * INTO pm FROM sx_private.personal_memberships WHERE user_id = u FOR UPDATE;
  IF NOT FOUND OR pm.tier = 'free' OR pm.access_until <= now() THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NO_PAID_TIER'; END IF;
  IF pm.tier = 'plus' AND p_tier = 'pro' THEN RETURN jsonb_build_object('changeId', NULL, 'effectiveAt', NULL, 'paymentRequired', true); END IF;
  k := CASE WHEN p_tier = 'free' THEN 'cancel' WHEN p_tier <> pm.tier THEN 'downgrade' ELSE 'cadence_change' END;
  UPDATE sx_private.membership_changes SET status = 'withdrawn' WHERE owner_id = u AND status IN ('requested', 'scheduled_at_stripe');
  INSERT INTO sx_private.membership_changes(owner_id, kind, to_tier, to_cadence, effective_at, request_key)
  VALUES (u, k, p_tier, CASE WHEN p_tier = 'free' THEN NULL ELSE p_cadence END, pm.access_until, p_key) RETURNING id INTO c;
  RETURN jsonb_build_object('changeId', c, 'effectiveAt', pm.access_until, 'paymentRequired', false);
END $$;

CREATE FUNCTION sx_private.withdraw_change(p_change uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE sx_private.membership_changes SET status = 'withdrawn' WHERE id = p_change AND owner_id = auth.uid() AND status IN ('requested', 'scheduled_at_stripe');
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not found'; END IF;   -- the worker removes the Stripe schedule
END $$;

CREATE FUNCTION sx_private.offer_sponsorship(p_beneficiary_email text, p_tier text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid(); b uuid; s uuid;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Unauthenticated'; END IF;
  SELECT id INTO b FROM auth.users WHERE lower(email) = lower(p_beneficiary_email);
  -- Same response whether or not the email has an account, so offers can't be used to probe who's registered.
  IF b IS NULL OR b = u THEN RETURN NULL; END IF;
  INSERT INTO sx_private.person_sponsorships(sponsor_id, beneficiary_id, tier) VALUES (u, b, p_tier) RETURNING id INTO s;
  RETURN s;
END $$;

CREATE FUNCTION sx_private.respond_sponsorship(p_sponsorship uuid, p_accept boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE sx_private.person_sponsorships SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END, accepted_at = CASE WHEN p_accept THEN now() END
  WHERE id = p_sponsorship AND beneficiary_id = auth.uid() AND status = 'offered';
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not found'; END IF;
END $$;

CREATE FUNCTION sx_private.end_sponsorship(p_sponsorship uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN   -- either party may end it; access runs to access_until, the worker cancels the sponsor's Stripe subscription at period end
  UPDATE sx_private.person_sponsorships SET status = 'ended' WHERE id = p_sponsorship AND (sponsor_id = auth.uid() OR beneficiary_id = auth.uid()) AND status IN ('offered', 'accepted');
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not found'; END IF;
END $$;

-- record_usage: spend credits. Course work (p_section set, caller actively enrolled) uses the institution pool first;
-- personal work never touches the institution pool. Raises QUOTA_EXHAUSTED rather than borrowing silently.
CREATE FUNCTION sx_private.record_usage(p_key uuid, p_action text, p_credits integer, p_section uuid, p_disclosed_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid(); old record; a record; t uuid;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Unauthenticated'; END IF;
  IF p_credits IS NULL OR p_credits <= 0 OR p_disclosed_at IS NULL OR p_disclosed_at > now() THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'COST_NOT_DISCLOSED'; END IF;
  PERFORM sx_private.lock_key(u, p_key);
  SELECT * INTO old FROM sx_private.usage_events WHERE owner_id = u AND request_key = p_key;
  IF FOUND THEN RETURN jsonb_build_object('allowanceId', old.allowance_id, 'credits', old.credits, 'replayed', true); END IF;
  IF p_section IS NOT NULL THEN
    SELECT e.tenant_id INTO t FROM sx.enrollments e JOIN sx_private.memberships m ON m.tenant_id = e.tenant_id AND m.id = e.membership_id
     WHERE e.section_id = p_section AND m.user_id = u AND m.status = 'active' AND e.status = 'active';
    IF t IS NULL THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Not enrolled in section'; END IF;
  END IF;
  SELECT * INTO a FROM sx_private.usage_allowances
   WHERE owner_id = u AND now() >= period_start AND now() < period_end AND credits_granted - credits_used >= p_credits
     AND ((source = 'institution' AND p_section IS NOT NULL AND institution_tenant_id = t) OR source IN ('personal_tier', 'person_sponsor'))
   ORDER BY CASE source WHEN 'institution' THEN 0 WHEN 'personal_tier' THEN 1 ELSE 2 END LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'QUOTA_EXHAUSTED'; END IF;
  UPDATE sx_private.usage_allowances SET credits_used = credits_used + p_credits WHERE id = a.id;
  INSERT INTO sx_private.usage_events(owner_id, allowance_id, action_code, credits, section_id, cost_disclosed_at, request_key)
  VALUES (u, a.id, p_action, p_credits, p_section, p_disclosed_at, p_key);
  RETURN jsonb_build_object('allowanceId', a.id, 'source', a.source, 'credits', p_credits, 'remaining', a.credits_granted - a.credits_used - p_credits);
END $$;

CREATE FUNCTION sx_private.request_institution_offer(p_key uuid, p_name text, p_email text, p_students integer, p_modules text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid(); old record; r uuid;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Unauthenticated'; END IF;
  IF NOT p_modules <@ ARRAY['learning', 'advising', 'registration', 'student_accounts', 'reporting'] THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Unknown module'; END IF;
  PERFORM sx_private.lock_key(u, p_key);
  SELECT * INTO old FROM sx_private.institution_requests WHERE requester_id = u AND request_key = p_key;
  IF FOUND THEN RETURN jsonb_build_object('requestId', old.id, 'state', old.status); END IF;
  INSERT INTO sx_private.institution_requests(requester_id, request_key, institution_name, contact_email, enrolled_students, requested_modules)
  VALUES (u, p_key, btrim(p_name), lower(p_email), p_students, p_modules) RETURNING id INTO r;
  RETURN jsonb_build_object('requestId', r, 'state', 'submitted');
END $$;

-- Read model for GET /membership. Masks Stripe ids; never returns payment methods.
CREATE FUNCTION sx_private.my_membership() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'personalPlan', sx_private.personal_tier(),
    'sponsoredPlan', sx_private.sponsored_tier(),
    'membership', (SELECT jsonb_build_object('tier', tier, 'status', status, 'accessUntil', access_until, 'cancelAtPeriodEnd', cancel_at_period_end) FROM sx_private.personal_memberships WHERE user_id = auth.uid()),
    'pendingChange', (SELECT jsonb_build_object('id', id, 'kind', kind, 'toTier', to_tier, 'toCadence', to_cadence, 'effectiveAt', effective_at) FROM sx_private.membership_changes WHERE owner_id = auth.uid() AND status IN ('requested', 'scheduled_at_stripe')),
    'sponsorships', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'role', CASE WHEN sponsor_id = auth.uid() THEN 'sponsor' ELSE 'beneficiary' END, 'tier', tier, 'status', status, 'accessUntil', access_until)) FROM sx_private.person_sponsorships WHERE sponsor_id = auth.uid() OR beneficiary_id = auth.uid()), '[]'),
    'allowances', coalesce((SELECT jsonb_agg(jsonb_build_object('source', source, 'scope', scope, 'granted', credits_granted, 'used', credits_used, 'resets', period_end)) FROM sx_private.usage_allowances WHERE owner_id = auth.uid() AND now() >= period_start AND now() < period_end), '[]')) $$;

-- ------------------------------------------------ service-role only (server and Stripe worker)
CREATE FUNCTION sx_private.attach_stripe_session(p_checkout uuid, p_stripe_session text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE sx_private.checkout_sessions SET stripe_checkout_session_id = p_stripe_session, status = 'open' WHERE id = p_checkout AND status = 'created' AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CHECKOUT_NOT_OPENABLE'; END IF;
END $$;

-- Monthly allowance refresh for everyone, from tier, person sponsorship and institution sponsorship. Idempotent per period.
CREATE FUNCTION sx_private.refresh_allowances(p_now timestamptz) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE ps timestamptz := date_trunc('month', p_now); pe timestamptz := date_trunc('month', p_now) + interval '1 month'; n integer;
BEGIN
  INSERT INTO sx_private.usage_allowances(owner_id, source, scope, period_start, period_end, credits_granted)
  SELECT u.id, 'personal_tier', 'any', ps, pe, ta.ai_credits_per_month
  FROM auth.users u LEFT JOIN sx_private.personal_memberships pm ON pm.user_id = u.id
  JOIN sx_private.tier_allowances ta ON ta.tier = CASE WHEN pm.tier IN ('plus', 'pro') AND pm.status IN ('active', 'past_due', 'trialing') AND pm.access_until > p_now AND (pm.status <> 'trialing' OR pm.trial_approved) THEN pm.tier ELSE 'free' END
  WHERE ta.approved_at IS NOT NULL
  ON CONFLICT DO NOTHING;
  INSERT INTO sx_private.usage_allowances(owner_id, source, scope, period_start, period_end, credits_granted)
  SELECT s.beneficiary_id, 'person_sponsor', 'any', ps, pe, ta.ai_credits_per_month - coalesce((SELECT ta2.ai_credits_per_month FROM sx_private.tier_allowances ta2 WHERE ta2.tier = 'free'), 0)
  FROM sx_private.person_sponsorships s JOIN sx_private.tier_allowances ta ON ta.tier = s.tier
  WHERE s.status = 'accepted' AND s.access_until > p_now AND ta.approved_at IS NOT NULL
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
-- Institution pools (2,400 credits per enrolled student per year, DRAFT) are granted by the contractual
-- activation command for that tenant, scope 'course_work', never by this function.

REVOKE ALL ON FUNCTION sx_private.attach_stripe_session(uuid, text), sx_private.refresh_allowances(timestamptz), sx_private.lock_key(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sx_private.start_checkout(uuid, text, text, text, boolean, uuid), sx_private.schedule_change(uuid, text, text), sx_private.withdraw_change(uuid), sx_private.offer_sponsorship(text, text), sx_private.respond_sponsorship(uuid, boolean), sx_private.end_sponsorship(uuid), sx_private.record_usage(uuid, text, integer, uuid, timestamptz), sx_private.request_institution_offer(uuid, text, text, integer, text[]), sx_private.my_membership(), sx_private.sponsored_tier() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sx_private.start_checkout(uuid, text, text, text, boolean, uuid), sx_private.schedule_change(uuid, text, text), sx_private.withdraw_change(uuid), sx_private.offer_sponsorship(text, text), sx_private.respond_sponsorship(uuid, boolean), sx_private.end_sponsorship(uuid), sx_private.record_usage(uuid, text, integer, uuid, timestamptz), sx_private.request_institution_offer(uuid, text, text, integer, text[]), sx_private.my_membership(), sx_private.sponsored_tier() TO authenticated;
COMMIT;
