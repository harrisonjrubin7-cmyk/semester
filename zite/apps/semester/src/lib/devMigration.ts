// Migration dev-001: developer apps, installations and call log (controlled Postgres backend).
// Tokens are stored only as SHA-256 hashes. Installs are tenant-scoped. Every call re-checks the install.
export const DEV_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS dev_apps (id text PRIMARY KEY, name text NOT NULL, developer_id text NOT NULL, redirect_note text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'sandbox' CHECK (status IN ('sandbox','suspended')), created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS dev_installs (id text PRIMARY KEY, tenant_id text NOT NULL, app_id text NOT NULL REFERENCES dev_apps(id), scopes text[] NOT NULL, token_hash text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')), installed_by text NOT NULL, revoked_by text, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz)`,
  `CREATE INDEX IF NOT EXISTS dev_installs_tenant ON dev_installs (tenant_id)`,
  `CREATE TABLE IF NOT EXISTS dev_calls (id bigserial PRIMARY KEY, install_id text, tenant_id text, scope text NOT NULL, result text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS dev_audit (id bigserial PRIMARY KEY, tenant_id text NOT NULL, actor_id text NOT NULL, action text NOT NULL, target text NOT NULL, detail text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now())`,
  // The audit trail and the call log are evidence: append-only for every role subject to triggers, the owner included.
  `CREATE OR REPLACE FUNCTION dev_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'AUDIT_APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS dev_audit_append_only ON dev_audit`,
  `CREATE TRIGGER dev_audit_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON dev_audit FOR EACH STATEMENT EXECUTE FUNCTION dev_refuse_change()`,
  `DROP TRIGGER IF EXISTS dev_calls_append_only ON dev_calls`,
  `CREATE TRIGGER dev_calls_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON dev_calls FOR EACH STATEMENT EXECUTE FUNCTION dev_refuse_change()`,
  // App review (APP-017). Publisher review by Semester is separate from each institution's install approval.
  `ALTER TABLE dev_apps ADD COLUMN IF NOT EXISTS developer_tenant text`,
  `ALTER TABLE dev_apps ADD COLUMN IF NOT EXISTS requested_scopes text[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE dev_apps ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed', 'approved', 'rejected'))`,
  `ALTER TABLE dev_apps ADD COLUMN IF NOT EXISTS reviewed_scopes text[]`,
  `ALTER TABLE dev_apps ADD COLUMN IF NOT EXISTS reviewed_by text`,
  `ALTER TABLE dev_apps ADD COLUMN IF NOT EXISTS reviewed_at timestamptz`,
  `ALTER TABLE dev_apps ADD COLUMN IF NOT EXISTS review_note text`,
  // Install = one transaction. Granted scopes ⊆ requested; outside the developer's institution the app must be approved
  // for exactly the scopes it now requests, and the grant must stay within what was reviewed.
  `CREATE OR REPLACE FUNCTION dev_install(p_actor text, p_tenant text, p_app text, p_scopes text[], p_token_hash text, p_days int, p_id text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE a dev_apps%ROWTYPE;
BEGIN
  SELECT * INTO a FROM dev_apps WHERE id = p_app FOR UPDATE;
  IF NOT FOUND THEN RETURN 'App not found.'; END IF;
  IF a.status = 'suspended' THEN RETURN 'Suspended apps cannot be installed.'; END IF;
  IF coalesce(array_length(p_scopes, 1), 0) = 0 THEN RETURN 'Choose at least one scope.'; END IF;
  IF NOT (p_scopes <@ a.requested_scopes) THEN RETURN 'The app did not request: ' || array_to_string(ARRAY(SELECT unnest(p_scopes) EXCEPT SELECT unnest(a.requested_scopes)), ', ') || '.'; END IF;
  IF a.developer_tenant IS DISTINCT FROM p_tenant THEN
    IF a.review_status <> 'approved' OR a.reviewed_scopes IS NULL OR NOT (a.requested_scopes <@ a.reviewed_scopes AND a.reviewed_scopes <@ a.requested_scopes) THEN
      RETURN 'This app is from another institution and has not passed Semester review for the scopes it requests.';
    END IF;
  END IF;
  INSERT INTO dev_installs (id, tenant_id, app_id, scopes, token_hash, installed_by, expires_at)
    VALUES (p_id, p_tenant, a.id, p_scopes, p_token_hash, p_actor, now() + make_interval(days => p_days));
  INSERT INTO dev_audit (tenant_id, actor_id, action, target, detail) VALUES (p_tenant, p_actor, 'install', p_id, a.id || ' · ' || array_to_string(p_scopes, ', '));
  RETURN NULL;
END $$`,
  // Changing what an app asks for voids its review (scope expansion needs renewed approval). Existing installs keep their grants.
  `CREATE OR REPLACE FUNCTION dev_request_scopes(p_actor text, p_tenant text, p_app text, p_scopes text[]) RETURNS text LANGUAGE plpgsql AS $$
DECLARE a dev_apps%ROWTYPE;
BEGIN
  SELECT * INTO a FROM dev_apps WHERE id = p_app FOR UPDATE;
  IF NOT FOUND OR a.developer_id <> p_actor THEN RETURN 'Only the app''s developer can change what it requests.'; END IF;
  IF coalesce(array_length(p_scopes, 1), 0) = 0 THEN RETURN 'Choose at least one scope.'; END IF;
  UPDATE dev_apps SET requested_scopes = p_scopes,
    review_status = CASE WHEN p_scopes <@ requested_scopes AND requested_scopes <@ p_scopes THEN review_status ELSE 'unreviewed' END
    WHERE id = a.id;
  INSERT INTO dev_audit (tenant_id, actor_id, action, target, detail) VALUES (p_tenant, p_actor, 'request_scopes', a.id, array_to_string(p_scopes, ', '));
  RETURN NULL;
END $$`,
  // Semester's publisher review. The reviewer must not be the developer, and decides on the exact scopes they were shown.
  `CREATE OR REPLACE FUNCTION dev_review(p_reviewer text, p_app text, p_approve boolean, p_seen_scopes text[], p_note text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE a dev_apps%ROWTYPE;
BEGIN
  SELECT * INTO a FROM dev_apps WHERE id = p_app FOR UPDATE;
  IF NOT FOUND THEN RETURN 'App not found.'; END IF;
  IF a.developer_id = p_reviewer THEN RETURN 'You registered this app, so someone else must review it.'; END IF;
  IF NOT (p_seen_scopes <@ a.requested_scopes AND a.requested_scopes <@ p_seen_scopes) THEN RETURN 'The app''s requested scopes changed since you opened it. Reload and review again.'; END IF;
  IF coalesce(length(trim(p_note)), 0) < 5 THEN RETURN 'Write a short review note.'; END IF;
  UPDATE dev_apps SET review_status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    reviewed_scopes = CASE WHEN p_approve THEN a.requested_scopes ELSE NULL END, reviewed_by = p_reviewer, reviewed_at = now(), review_note = p_note
    WHERE id = a.id;
  INSERT INTO dev_audit (tenant_id, actor_id, action, target, detail) VALUES ('semester-company', p_reviewer, CASE WHEN p_approve THEN 'review.approve' ELSE 'review.reject' END, a.id, array_to_string(a.requested_scopes, ', ') || ' · ' || p_note);
  RETURN NULL;
END $$`,
];
