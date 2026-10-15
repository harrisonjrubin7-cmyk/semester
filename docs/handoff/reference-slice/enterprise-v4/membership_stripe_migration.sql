-- Membership extension for consolidated sx reference. Trusted owner; staging first.
BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE sx_private.memberships
 ADD COLUMN sponsorship_status text NOT NULL DEFAULT 'none' CHECK(sponsorship_status IN ('none','pending','active','revoked')),
 ADD COLUMN sponsored_bundle text CHECK(sponsored_bundle IS NULL OR sponsored_bundle IN ('plus','pro')),
 ADD COLUMN sponsorship_ends_at timestamptz;
CREATE TABLE sx_private.personal_memberships(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 tier text NOT NULL DEFAULT 'free' CHECK(tier IN ('free','plus','pro')),
 status text NOT NULL DEFAULT 'free' CHECK(status IN ('free','active','trialing','past_due','canceled','suspended')),
 access_until timestamptz,
 stripe_customer_id text UNIQUE,
 stripe_subscription_id text UNIQUE,
 trial_approved boolean NOT NULL DEFAULT false,
 cancel_at_period_end boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(tier='free' OR access_until IS NOT NULL)
);
CREATE TABLE sx_private.stripe_prices(
 price_id text PRIMARY KEY,
 tier text NOT NULL CHECK(tier IN ('plus','pro')),
 cadence text NOT NULL CHECK(cadence IN ('month','year')),
 livemode boolean NOT NULL,
 enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE sx_private.stripe_events(
 event_id text PRIMARY KEY,
 event_type text NOT NULL,
 customer_id text,
 subscription_id text,
 livemode boolean NOT NULL,
 payload jsonb NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processed','retry_wait','dead_letter')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 diagnostic text,
 received_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz
);
CREATE INDEX stripe_due ON sx_private.stripe_events(next_attempt_at) WHERE state IN ('pending','retry_wait');
ALTER TABLE sx_private.personal_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.stripe_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.stripe_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sx_private.personal_memberships,sx_private.stripe_prices,sx_private.stripe_events FROM PUBLIC,anon,authenticated;
CREATE FUNCTION sx_private.personal_tier() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT CASE WHEN p.tier IN ('plus','pro') AND p.status IN ('active','past_due','trialing') AND p.access_until>now() AND (p.status<>'trialing' OR p.trial_approved) THEN p.tier ELSE 'free' END FROM sx_private.personal_memberships p WHERE p.user_id=auth.uid()),'free'); $$;
CREATE FUNCTION sx_private.has_feature(p_feature text,p_tenant uuid DEFAULT NULL) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND CASE
 WHEN p_feature IN ('personal_planner','personal_notes','basic_study') THEN true
 WHEN p_feature IN ('advanced_study','calendar_sync','advanced_search','personal_analytics') THEN
  sx_private.personal_tier() IN ('plus','pro') OR EXISTS(SELECT 1 FROM sx_private.memberships m JOIN sx.tenants t ON t.id=m.tenant_id WHERE m.user_id=auth.uid() AND m.tenant_id=p_tenant AND m.status='active' AND t.status='active' AND m.sponsorship_status='active' AND m.sponsored_bundle IN ('plus','pro') AND m.sponsorship_ends_at>now())
 WHEN p_feature IN ('research_workspace','workflow_automation','priority_support') THEN
  sx_private.personal_tier()='pro' OR EXISTS(SELECT 1 FROM sx_private.memberships m JOIN sx.tenants t ON t.id=m.tenant_id WHERE m.user_id=auth.uid() AND m.tenant_id=p_tenant AND m.status='active' AND t.status='active' AND m.sponsorship_status='active' AND m.sponsored_bundle='pro' AND m.sponsorship_ends_at>now())
 ELSE false END; $$;
-- Feature eligibility is not resource authorization or quota accounting.
REVOKE ALL ON FUNCTION sx_private.personal_tier(),sx_private.has_feature(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sx_private.personal_tier(),sx_private.has_feature(text,uuid) TO authenticated;
COMMIT;
