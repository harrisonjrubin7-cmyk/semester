-- 013_audit_logging.sql: student-record audit events, scoped subject tokens, disclosure link (ERP PDF part 2, 6 Oct). After 012. NOT executed or parsed.
-- Two different records: a SECURITY audit (every access, allowed or denied) and the FERPA DISCLOSURE record (011, only where the
-- law requires it). Logging school-official access is an accountability control even where disclosure recordkeeping has an exception.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Subject tokens: logs reference a scoped token, not a name, email or student id. Resolution is restricted.
CREATE TABLE sx_private.subject_tokens (
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  token text NOT NULL CHECK (token ~ '^st_[A-Za-z0-9]{24}$'),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, token), UNIQUE (tenant_id, user_id)
);
CREATE FUNCTION sx_private.subject_token(p_tenant uuid, p_user uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t text;
BEGIN
  SELECT token INTO t FROM sx_private.subject_tokens WHERE tenant_id = p_tenant AND user_id = p_user;
  IF t IS NULL THEN
    t := 'st_' || substr(translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', 'xyz'), 1, 24);
    INSERT INTO sx_private.subject_tokens(tenant_id, token, user_id) VALUES (p_tenant, t, p_user) ON CONFLICT (tenant_id, user_id) DO NOTHING;
    SELECT token INTO t FROM sx_private.subject_tokens WHERE tenant_id = p_tenant AND user_id = p_user;
  END IF;
  RETURN t;
END $$;

CREATE TABLE sx_private.student_record_audit_events (
  tenant_id uuid NOT NULL REFERENCES sx.tenants(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  actor_kind text NOT NULL CHECK (actor_kind IN ('person', 'service', 'anonymous')),
  actor_user_id uuid REFERENCES auth.users(id),
  actor_service text,
  subject_token text,
  request_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('read', 'list', 'create', 'update', 'approve', 'release', 'export', 'download_url_issued', 'download_confirmed', 'disclose', 'delete', 'role_change', 'consent_change', 'privileged_access', 'launch', 'service_call')),
  resource_domain text NOT NULL CHECK (resource_domain IN ('admissions', 'registrar', 'housing', 'dining', 'identity', 'governance', 'learning')),
  resource_type text NOT NULL,
  resource_id uuid,
  decision text NOT NULL CHECK (decision IN ('allow', 'deny', 'error')),
  reason_code text NOT NULL,
  purpose_code text REFERENCES sx_private.purpose_policies(code),
  policy_version text NOT NULL,
  lti_deployment_id uuid REFERENCES sx_private.lti_deployments(id),
  returned_record_count integer CHECK (returned_record_count IS NULL OR returned_record_count >= 0),
  field_categories text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (tenant_id, id),
  CHECK ((actor_kind = 'person' AND actor_user_id IS NOT NULL AND actor_service IS NULL)
      OR (actor_kind = 'service' AND actor_service IS NOT NULL AND actor_user_id IS NULL)
      OR (actor_kind = 'anonymous' AND actor_user_id IS NULL AND actor_service IS NULL)),
  -- Only allow-listed metadata keys; free-form JSON collects sensitive data by accident.
  CHECK (jsonb_typeof(metadata) = 'object' AND NOT (metadata ?| ARRAY['jwt', 'id_token', 'access_token', 'email', 'ssn', 'dob', 'password', 'notes', 'body']))
);
CREATE INDEX audit_subject ON sx_private.student_record_audit_events(tenant_id, subject_token, occurred_at DESC);
CREATE INDEX audit_actor ON sx_private.student_record_audit_events(tenant_id, actor_user_id, occurred_at DESC);
CREATE INDEX audit_resource ON sx_private.student_record_audit_events(tenant_id, resource_domain, resource_type, resource_id, occurred_at DESC);
CREATE INDEX audit_request ON sx_private.student_record_audit_events(tenant_id, request_id);
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON sx_private.student_record_audit_events FOR EACH ROW EXECUTE FUNCTION sx_private.append_only();

CREATE TABLE sx_private.audit_metadata_keys (key text PRIMARY KEY);
INSERT INTO sx_private.audit_metadata_keys VALUES ('query_category'), ('export_manifest_id'), ('grant_id'), ('scope_kind'), ('section_count'), ('retry_of');

-- The only write path. Application roles insert through this; nobody updates or deletes.
CREATE FUNCTION sx_private.record_audit(p_tenant uuid, p_request text, p_action text, p_domain text, p_type text, p_resource uuid, p_subject uuid,
  p_decision text, p_reason text, p_purpose text, p_fields text[], p_count integer, p_metadata jsonb DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e uuid; k text;
BEGIN
  FOR k IN SELECT jsonb_object_keys(coalesce(p_metadata, '{}')) LOOP
    IF NOT EXISTS (SELECT 1 FROM sx_private.audit_metadata_keys WHERE key = k) THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AUDIT_METADATA_KEY_NOT_ALLOWED'; END IF;
  END LOOP;
  INSERT INTO sx_private.student_record_audit_events(tenant_id, actor_kind, actor_user_id, subject_token, request_id, action, resource_domain, resource_type, resource_id, decision, reason_code, purpose_code, policy_version, returned_record_count, field_categories, metadata)
  VALUES (p_tenant, CASE WHEN auth.uid() IS NULL THEN 'anonymous' ELSE 'person' END, auth.uid(), CASE WHEN p_subject IS NULL THEN NULL ELSE sx_private.subject_token(p_tenant, p_subject) END,
          p_request, p_action, p_domain, p_type, p_resource, p_decision, p_reason, p_purpose, 'ferpa-policy-1', p_count, coalesce(p_fields, '{}'), coalesce(p_metadata, '{}'))
  RETURNING id INTO e;
  RETURN e;
END $$;
-- If sensitive-access logging is unavailable, the read must fail closed: callers record_audit BEFORE returning data, in the same request.

ALTER TABLE sx_private.disclosure_records ADD COLUMN audit_event_id uuid, ADD COLUMN additional_recipients jsonb NOT NULL DEFAULT '[]', ADD COLUMN recorded_by uuid REFERENCES auth.users(id);

ALTER TABLE sx_private.subject_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.student_record_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.audit_metadata_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sx_private.subject_tokens, sx_private.student_record_audit_events, sx_private.audit_metadata_keys FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sx_private.subject_token(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sx_private.record_audit(uuid, text, text, text, text, uuid, uuid, text, text, text, text[], integer, jsonb) TO authenticated;
COMMIT;
