-- 007_lti_ags.sql: LTI 1.3 launch + AGS grade sync + submission evidence (from the LTI launch / AGS PDF, 6 Oct 2026).
-- After 006_membership_completion.sql. Trusted owner, staging first. NOT executed or parsed.
-- The launch id_token authenticates a launch only. Grade calls use a separate OAuth client-credentials token, server-side.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- ------------------------------------------------ registrations, deployments, contexts
CREATE TABLE sx_private.lti_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('canvas', 'blackboard', 'brightspace', 'moodle', 'other')),
  issuer text NOT NULL,
  client_id text NOT NULL,
  auth_login_url text NOT NULL CHECK (auth_login_url ~ '^https://'),
  token_url text NOT NULL CHECK (token_url ~ '^https://'),
  jwks_url text NOT NULL CHECK (jwks_url ~ '^https://'),        -- the ONLY key source; never a token-supplied URL
  allowed_algs text[] NOT NULL DEFAULT ARRAY['RS256'],
  tool_key_id text NOT NULL,                                     -- our signing key for client assertions (secret lives in the vault)
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'retired')),
  approved_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issuer, client_id),
  CHECK (status <> 'active' OR approved_by IS NOT NULL)
);
CREATE TABLE sx_private.lti_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES sx_private.lti_registrations(id),
  deployment_id text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),             -- the institution this install belongs to
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  UNIQUE (registration_id, deployment_id)
);
CREATE TABLE sx_private.lti_identities (
  registration_id uuid NOT NULL REFERENCES sx_private.lti_registrations(id),
  platform_sub text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  linked_by text NOT NULL CHECK (linked_by IN ('sso_match', 'admin_link', 'invitation')),  -- never an unverified email match
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (registration_id, platform_sub)
);
CREATE TABLE sx_private.lti_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id uuid NOT NULL REFERENCES sx_private.lti_deployments(id),
  context_id text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  section_id uuid,                                               -- bound by an authorized mapping, not by title
  title text,
  UNIQUE (deployment_id, context_id)
);
CREATE TABLE sx_private.lti_resource_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id uuid NOT NULL REFERENCES sx_private.lti_contexts(id),
  resource_link_id text NOT NULL,
  assignment_id uuid,
  UNIQUE (context_id, resource_link_id)
);

-- ------------------------------------------------ one-time launch transactions (state + nonce)
CREATE TABLE sx_private.lti_launch_transactions (
  state text PRIMARY KEY CHECK (length(state) >= 32),
  nonce text NOT NULL UNIQUE CHECK (length(nonce) >= 32),
  registration_id uuid NOT NULL REFERENCES sx_private.lti_registrations(id),
  target_link_uri text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes',
  consumed_at timestamptz
);
-- Consume atomically: returns the row once, then never again. Called after JWT signature/claims pass.
CREATE FUNCTION sx_private.consume_launch(p_state text, p_nonce text) RETURNS sx_private.lti_launch_transactions
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE sx_private.lti_launch_transactions SET consumed_at = now()
  WHERE state = p_state AND nonce = p_nonce AND consumed_at IS NULL AND expires_at > now()
  RETURNING * $$;

-- ------------------------------------------------ line items and score delivery
CREATE TABLE sx_private.ags_lineitems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id uuid NOT NULL REFERENCES sx_private.lti_contexts(id),
  assignment_id uuid NOT NULL,
  lineitem_url text NOT NULL CHECK (lineitem_url ~ '^https://'),
  score_maximum numeric NOT NULL CHECK (score_maximum > 0),
  tool_owned boolean NOT NULL DEFAULT true,
  UNIQUE (context_id, assignment_id),
  UNIQUE (lineitem_url)
);
-- One row per published grade revision to send. Exactly one live row per (line item, platform user): newer supersedes older.
CREATE TABLE sx_private.ags_score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lineitem_id uuid NOT NULL REFERENCES sx_private.ags_lineitems(id),
  platform_sub text NOT NULL,
  grade_revision_id uuid NOT NULL,
  score_given numeric CHECK (score_given >= 0),
  score_maximum numeric NOT NULL CHECK (score_maximum > 0),
  activity_progress text NOT NULL CHECK (activity_progress IN ('Initialized', 'Started', 'InProgress', 'Submitted', 'Completed')),
  grading_progress text NOT NULL CHECK (grading_progress IN ('NotReady', 'Pending', 'PendingManual', 'FullyGraded', 'Failed')),
  comment text,                                                  -- student-visible on Canvas: only approved feedback
  event_timestamp timestamptz NOT NULL,                          -- preserved across retries
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'validating', 'delivering', 'retry_scheduled', 'outcome_unknown', 'delivered', 'delivered_unverified', 'reconciling', 'verified', 'conflict', 'action_required', 'superseded')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  diagnostic text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grade_revision_id, lineitem_id, platform_sub),
  CHECK (score_given IS NULL OR score_given <= score_maximum * 2)          -- allow extra credit, catch unit mistakes
);
CREATE UNIQUE INDEX one_live_score_event ON sx_private.ags_score_events(lineitem_id, platform_sub)
  WHERE state IN ('queued', 'validating', 'delivering', 'retry_scheduled', 'outcome_unknown', 'reconciling');
CREATE TABLE sx_private.ags_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score_event_id uuid NOT NULL REFERENCES sx_private.ags_score_events(id),
  attempt integer NOT NULL,
  http_status integer,
  outcome text NOT NULL CHECK (outcome IN ('success', 'transient', 'permanent', 'timeout_after_send', 'rate_limited', 'auth_failed')),
  at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (score_event_id, attempt)
);
CREATE TABLE sx_private.ags_result_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lineitem_id uuid NOT NULL REFERENCES sx_private.ags_lineitems(id),
  platform_sub text NOT NULL,
  result_score numeric,
  result_maximum numeric,
  observed_at timestamptz NOT NULL DEFAULT now(),
  matches_event uuid REFERENCES sx_private.ags_score_events(id)
);

-- Enqueue on publication (call inside the same transaction that publishes the grade revision).
-- Supersedes older unsent work for the same student and line item so a stale revision can't overtake a newer one.
CREATE FUNCTION sx_private.enqueue_score(p_lineitem uuid, p_sub text, p_revision uuid, p_score numeric, p_max numeric, p_comment text, p_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_lineitem::text || ':' || p_sub, 0));
  UPDATE sx_private.ags_score_events SET state = 'superseded'
   WHERE lineitem_id = p_lineitem AND platform_sub = p_sub AND state IN ('queued', 'retry_scheduled', 'validating');
  INSERT INTO sx_private.ags_score_events(lineitem_id, platform_sub, grade_revision_id, score_given, score_maximum, activity_progress, grading_progress, comment, event_timestamp)
  VALUES (p_lineitem, p_sub, p_revision, p_score, p_max, 'Completed', 'FullyGraded', p_comment, p_at)
  ON CONFLICT (grade_revision_id, lineitem_id, platform_sub) DO UPDATE SET state = sx_private.ags_score_events.state
  RETURNING id INTO e;
  RETURN e;
END $$;

-- Every table is private; the worker and launch handler use the server credential. Clients never read these directly.
ALTER TABLE sx_private.lti_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.lti_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.lti_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.lti_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.lti_resource_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.lti_launch_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.ags_lineitems ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.ags_score_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.ags_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.ags_result_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sx_private.lti_registrations, sx_private.lti_deployments, sx_private.lti_identities, sx_private.lti_contexts, sx_private.lti_resource_links, sx_private.lti_launch_transactions, sx_private.ags_lineitems, sx_private.ags_score_events, sx_private.ags_deliveries, sx_private.ags_result_snapshots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sx_private.consume_launch(text, text), sx_private.enqueue_score(uuid, text, uuid, numeric, numeric, text, timestamptz) FROM PUBLIC, anon, authenticated;

-- Faculty-facing read model: sync status for a section the caller teaches (no tokens, URLs or raw payloads).
CREATE FUNCTION sx_private.grade_sync_status(p_section uuid) RETURNS TABLE(assignment_id uuid, platform_sub_masked text, state text, attempts integer, updated timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT li.assignment_id, left(e.platform_sub, 4) || '…', e.state, e.attempts, e.next_attempt_at
  FROM sx_private.ags_score_events e JOIN sx_private.ags_lineitems li ON li.id = e.lineitem_id JOIN sx_private.lti_contexts c ON c.id = li.context_id
  WHERE c.section_id = p_section AND e.state <> 'superseded'
    AND EXISTS (SELECT 1 FROM sx_private.role_assignments ra JOIN sx_private.role_permissions rp ON rp.role_id = ra.role_id JOIN sx_private.permissions p ON p.id = rp.permission_id
                JOIN sx_private.memberships m ON m.id = ra.membership_id
                WHERE m.user_id = auth.uid() AND m.status = 'active' AND p.code = 'course.manage' AND ra.section_id = p_section AND (ra.expires_at IS NULL OR ra.expires_at > now())) $$;
GRANT EXECUTE ON FUNCTION sx_private.grade_sync_status(uuid) TO authenticated;
COMMIT;
