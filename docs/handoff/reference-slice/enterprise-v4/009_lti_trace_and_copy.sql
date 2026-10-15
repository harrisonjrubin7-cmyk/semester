-- 009_lti_trace_and_copy.sql: sanitized launch traces + course-copy rebinding (from the LTI audit / trace PDF, 6 Oct).
-- After 008_lti_hardening.sql. NOT executed or parsed.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- ------------------------------------------------ launch trace: decisions only, never the data behind them
-- No raw JWTs, platform subjects, emails, nonces, access tokens, client assertions or free-text error objects.
CREATE TABLE sx_private.lti_launch_traces (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trace_id uuid NOT NULL,
  stage text NOT NULL CHECK (stage IN ('login_initiation', 'authorization_redirect', 'callback_received', 'jwt_verified', 'claims_validated', 'transaction_consumed', 'context_authorized', 'launch_rejected')),
  outcome text NOT NULL CHECK (outcome IN ('ok', 'rejected')),
  reason_code text CHECK (reason_code IN ('STATE_INVALID', 'JWT_INVALID', 'NONCE_INVALID', 'DEPLOYMENT_UNTRUSTED', 'TARGET_INVALID', 'LTI_CLAIMS_INVALID', 'REPLAY_REJECTED', 'ACCESS_DENIED')),
  registration_id uuid REFERENCES sx_private.lti_registrations(id),
  tenant_id uuid REFERENCES sx.tenants(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((outcome = 'rejected') = (reason_code IS NOT NULL)),
  CHECK (stage <> 'launch_rejected' OR outcome = 'rejected')
);
CREATE INDEX lti_traces_by_trace ON sx_private.lti_launch_traces(trace_id, occurred_at);
CREATE INDEX lti_traces_retention ON sx_private.lti_launch_traces(occurred_at);
-- Retention: 30 days. Run daily.
CREATE FUNCTION sx_private.purge_launch_traces(p_now timestamptz) RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH d AS (DELETE FROM sx_private.lti_launch_traces WHERE occurred_at < p_now - interval '30 days' RETURNING 1) SELECT count(*)::integer FROM d $$;

-- Viewer for support and integration admins of that tenant only (permission 'integration.manage').
CREATE FUNCTION sx_private.launch_trace(p_trace uuid) RETURNS TABLE(stage text, outcome text, reason_code text, occurred_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT t.stage, t.outcome, t.reason_code, t.occurred_at FROM sx_private.lti_launch_traces t
  WHERE t.trace_id = p_trace AND EXISTS (
    SELECT 1 FROM sx_private.lti_launch_traces t2
    JOIN sx_private.memberships m ON m.tenant_id = t2.tenant_id AND m.user_id = auth.uid() AND m.status = 'active'
    JOIN sx_private.role_assignments ra ON ra.membership_id = m.id AND (ra.expires_at IS NULL OR ra.expires_at > now())
    JOIN sx_private.role_permissions rp ON rp.role_id = ra.role_id JOIN sx_private.permissions p ON p.id = rp.permission_id AND p.code = 'integration.manage'
    WHERE t2.trace_id = p_trace)
  ORDER BY t.occurred_at $$;
INSERT INTO sx_private.permissions(code) VALUES ('integration.manage') ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------ course copy: template vs instance
-- LTI doesn't promise a copy notification, and resource_link.id isn't preserved across copies.
-- Gradebook copies can keep the tool's resourceId + tag, so those carry a stable template key we control.
CREATE TABLE sx.assignment_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  template_key text NOT NULL CHECK (template_key ~ '^semester:template:[a-z0-9-]{3,80}$'),   -- e.g. semester:template:research-report-v1
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, template_key),
  UNIQUE (tenant_id, id)
);
-- Correction (sequence-builder PDF, part 2): one template can be used by several graded activities (e.g. a report in week 4 and
-- week 10). The template key alone can't tell them apart, so each activity also gets an activity_key, preserved in copied
-- launch parameters and used as the line-item resourceId. Three identities: template_id (content), activity_key (which
-- graded use), assignment instance (this course's dates, attempts and grades).
ALTER TABLE sx.assignments ADD COLUMN template_id uuid, ADD COLUMN activity_key text CHECK (activity_key ~ '^[a-z0-9][a-z0-9-]{2,80}
ALTER TABLE sx.assignments ADD CONSTRAINT assignments_template_fk FOREIGN KEY (tenant_id, template_id) REFERENCES sx.assignment_templates(tenant_id, id);
-- One instance per template per section: a copied course gets a NEW instance (new dates, policy, submissions, grades).
CREATE UNIQUE INDEX one_instance_per_activity_section ON sx.assignments(tenant_id, section_id, activity_key) WHERE activity_key IS NOT NULL;
ALTER TABLE sx.assignments ADD CONSTRAINT activity_needs_template CHECK (activity_key IS NULL OR template_id IS NOT NULL);

-- Line items carry the ACTIVITY key as resourceId (plus tag), so copies can be found again. Unique per context.
-- Multiple columns sharing one resourceId + tag can't be told apart, so this combination must be unique.
ALTER TABLE sx_private.ags_lineitems ADD COLUMN activity_key text;
CREATE UNIQUE INDEX one_lineitem_per_activity_tag ON sx_private.ags_lineitems(context_id, activity_key, tag) WHERE activity_key IS NOT NULL;
-- Never write to a column outside the launch's own context: refuse at enqueue, not by hoping the LMS rejects it.
CREATE FUNCTION sx_private.assert_same_context(p_lineitem uuid, p_context uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sx_private.ags_lineitems WHERE id = p_lineitem AND context_id = p_context) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'WRONG_CONTEXT_DESTINATION'; END IF;
END $$;
REVOKE ALL ON FUNCTION sx_private.assert_same_context(uuid, uuid) FROM PUBLIC, anon, authenticated;

ALTER TABLE sx_private.lti_launch_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx.assignment_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sx_private.lti_launch_traces FROM PUBLIC, anon, authenticated;
REVOKE ALL ON sx.assignment_templates FROM PUBLIC, anon;
GRANT SELECT ON sx.assignment_templates TO authenticated;
CREATE POLICY template_read ON sx.assignment_templates FOR SELECT TO authenticated USING (sx_private.member(tenant_id));
REVOKE ALL ON FUNCTION sx_private.purge_launch_traces(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sx_private.launch_trace(uuid) TO authenticated;
COMMIT;
);
ALTER TABLE sx.assignments ADD CONSTRAINT assignments_template_fk FOREIGN KEY (tenant_id, template_id) REFERENCES sx.assignment_templates(tenant_id, id);
-- One instance per template per section: a copied course gets a NEW instance (new dates, policy, submissions, grades).
CREATE UNIQUE INDEX one_instance_per_template_section ON sx.assignments(tenant_id, section_id, template_id) WHERE template_id IS NOT NULL;

-- Line items carry the template key as resourceId, so copies can be found again. Unique per context.
ALTER TABLE sx_private.ags_lineitems ADD COLUMN template_key text;
CREATE UNIQUE INDEX one_lineitem_per_template_tag ON sx_private.ags_lineitems(context_id, template_key, tag) WHERE template_key IS NOT NULL;

ALTER TABLE sx_private.lti_launch_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx.assignment_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sx_private.lti_launch_traces FROM PUBLIC, anon, authenticated;
REVOKE ALL ON sx.assignment_templates FROM PUBLIC, anon;
GRANT SELECT ON sx.assignment_templates TO authenticated;
CREATE POLICY template_read ON sx.assignment_templates FOR SELECT TO authenticated USING (sx_private.member(tenant_id));
REVOKE ALL ON FUNCTION sx_private.purge_launch_traces(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sx_private.launch_trace(uuid) TO authenticated;
COMMIT;
