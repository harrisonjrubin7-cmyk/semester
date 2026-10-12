-- 008_lti_hardening.sql: from "Interactive LTI 1.3 sequence builder" PDF (6 Oct). After 007_lti_ags.sql. NOT executed or parsed.
-- Model chosen: SHARED REGISTRY. One trusted registration (issuer + client_id); each approved deployment maps to one tenant.
-- (issuer, client_id) is never mapped to a tenant: Canvas allows many deployments under one Developer Key.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Environment + granted scopes on the registration (Canvas prod / beta / test each get their own row).
ALTER TABLE sx_private.lti_registrations
  ADD COLUMN environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'beta', 'test')),
  ADD COLUMN granted_scopes text[] NOT NULL DEFAULT ARRAY[]::text[]
    CHECK (granted_scopes <@ ARRAY['https://purl.imsglobal.org/spec/lti-ags/scope/score', 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
                                   'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly', 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem']),
  DROP CONSTRAINT IF EXISTS lti_registrations_issuer_client_id_key,
  ADD CONSTRAINT lti_registration_unique UNIQUE (issuer, client_id, environment);

-- Semester's own signing keys (public part published at our JWKS; private part stays in the vault).
CREATE TABLE sx_private.lti_tool_keys (
  kid text PRIMARY KEY CHECK (length(kid) BETWEEN 8 AND 64),
  alg text NOT NULL DEFAULT 'RS256' CHECK (alg IN ('RS256')),
  public_jwk jsonb NOT NULL CHECK (NOT (public_jwk ? 'd') AND NOT (public_jwk ? 'p') AND NOT (public_jwk ? 'q')),   -- never private material
  vault_reference text NOT NULL,
  status text NOT NULL CHECK (status IN ('next', 'active', 'retiring', 'retired')),
  activated_at timestamptz,
  retire_after timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_tool_key ON sx_private.lti_tool_keys(status) WHERE status = 'active';
-- What /lti/.well-known/jwks.json serves: next + active + retiring, so rotation overlaps.
CREATE FUNCTION sx_private.tool_jwks() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('keys', coalesce(jsonb_agg(public_jwk || jsonb_build_object('kid', kid, 'alg', alg, 'use', 'sig')), '[]'))
  FROM sx_private.lti_tool_keys WHERE status IN ('next', 'active', 'retiring') $$;

-- Cached platform keys, refreshed on a schedule or an unknown kid (bounded), only from the registration's jwks_url.
CREATE TABLE sx_private.lti_platform_keys (
  registration_id uuid NOT NULL REFERENCES sx_private.lti_registrations(id),
  kid text NOT NULL,
  public_jwk jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (registration_id, kid)
);

-- Line items: a stable resource id we control, and the binding source.
ALTER TABLE sx_private.ags_lineitems
  ADD COLUMN resource_id text NOT NULL DEFAULT gen_random_uuid()::text,
  ADD COLUMN tag text NOT NULL DEFAULT 'primary-grade',
  ADD COLUMN bound_by text NOT NULL DEFAULT 'launch_claim' CHECK (bound_by IN ('launch_claim', 'discovered', 'created', 'deep_link')),
  ADD COLUMN creation_state text NOT NULL DEFAULT 'bound' CHECK (creation_state IN ('bound', 'creating', 'creation_unknown'));

-- Resolve-or-claim: serializes two simultaneous launches so they can't both create a column.
-- Returns ('existing', url) when bound, ('create', NULL) when the caller holds the right to create (state = creating),
-- or ('wait', NULL) when another worker is creating or an earlier creation timed out and must be reconciled first.
CREATE FUNCTION sx_private.claim_lineitem(p_context uuid, p_assignment uuid, p_max numeric)
RETURNS TABLE(decision text, lineitem_url text, lineitem_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE li record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('lineitem:' || p_context || ':' || p_assignment, 0));
  SELECT * INTO li FROM sx_private.ags_lineitems WHERE context_id = p_context AND assignment_id = p_assignment FOR UPDATE;
  IF FOUND THEN
    IF li.creation_state = 'bound' THEN RETURN QUERY SELECT 'existing', li.lineitem_url, li.id; RETURN; END IF;
    RETURN QUERY SELECT 'wait', NULL::text, li.id; RETURN;                                  -- creating or creation_unknown: reconcile, don't POST again
  END IF;
  INSERT INTO sx_private.ags_lineitems(context_id, assignment_id, lineitem_url, score_maximum, bound_by, creation_state)
  VALUES (p_context, p_assignment, 'pending:' || gen_random_uuid(), p_max, 'created', 'creating') RETURNING * INTO li;
  RETURN QUERY SELECT 'create', NULL::text, li.id;
END $$;
-- After the POST (or after discovery finds a column with our resource_id + tag): record the opaque URL the LMS returned.
CREATE FUNCTION sx_private.bind_lineitem(p_lineitem uuid, p_url text, p_bound_by text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_url !~ '^https://' THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Line item URL must be https'; END IF;
  UPDATE sx_private.ags_lineitems SET lineitem_url = p_url, bound_by = p_bound_by, creation_state = 'bound' WHERE id = p_lineitem AND creation_state IN ('creating', 'creation_unknown');
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LINEITEM_NOT_CLAIMED'; END IF;
END $$;
-- A creation POST that timed out: mark unknown so the next resolver discovers by resource_id + tag before any new POST.
CREATE FUNCTION sx_private.mark_lineitem_unknown(p_lineitem uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE sx_private.ags_lineitems SET creation_state = 'creation_unknown' WHERE id = p_lineitem AND creation_state = 'creating' $$;

-- Course copies: copied LMS courses get new context ids, so mappings are rediscovered, never reused by title or old id.
ALTER TABLE sx_private.lti_contexts ADD COLUMN copied_from_context text;

ALTER TABLE sx_private.lti_tool_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sx_private.lti_platform_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sx_private.lti_tool_keys, sx_private.lti_platform_keys FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sx_private.claim_lineitem(uuid, uuid, numeric), sx_private.bind_lineitem(uuid, text, text), sx_private.mark_lineitem_unknown(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sx_private.tool_jwks() TO anon, authenticated;   -- public key material only
COMMIT;
