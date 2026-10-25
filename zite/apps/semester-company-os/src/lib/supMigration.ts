// Migration sup-001: Support Operations scoped access (APP-025; workbook review REV-008).
// Gate: "no standing unrestricted student access; temporary access is purpose-limited, approved, expiring, and audited".
// - A support agent requests access to ONE institution for ONE ticket, with a purpose, scopes and a duration (max 8 h).
// - Scopes never include student records (CHECK). The institution's own administrator approves the exact request.
// - Access is checked on every use (sup_check), expires on its own, and either side can revoke it at any time.
// - Every check that allows or denies a view is written to the append-only access log the institution can read.
export const SUP_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS sup_requests (id text PRIMARY KEY, number serial, agent_id text NOT NULL, tenant_id text NOT NULL, tenant_name text NOT NULL DEFAULT '',
     ticket_ref text NOT NULL, purpose text NOT NULL CHECK (length(purpose) >= 20),
     scopes text[] NOT NULL CHECK (array_length(scopes, 1) >= 1 AND scopes <@ ARRAY['configuration', 'integration_status', 'course_catalog']::text[]),
     hours int NOT NULL CHECK (hours BETWEEN 1 AND 8),
     state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'approved', 'denied', 'revoked', 'withdrawn')),
     decided_by text, decided_at timestamptz, decision_note text, expires_at timestamptz, revoked_by text, revoked_at timestamptz,
     created_at timestamptz NOT NULL DEFAULT now(), CHECK (decided_by IS NULL OR decided_by <> agent_id))`,
  `CREATE TABLE IF NOT EXISTS sup_access_log (id bigserial PRIMARY KEY, request_id text, agent_id text NOT NULL, tenant_id text NOT NULL, scope text NOT NULL,
     allowed boolean NOT NULL, reason text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE TABLE IF NOT EXISTS sup_events (id bigserial PRIMARY KEY, request_id text NOT NULL REFERENCES sup_requests(id), actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION sup_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS sup_access_log_append_only ON sup_access_log`,
  `CREATE TRIGGER sup_access_log_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON sup_access_log FOR EACH STATEMENT EXECUTE FUNCTION sup_refuse_change()`,
  `DROP TRIGGER IF EXISTS sup_events_append_only ON sup_events`,
  `CREATE TRIGGER sup_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON sup_events FOR EACH STATEMENT EXECUTE FUNCTION sup_refuse_change()`,
  `CREATE OR REPLACE FUNCTION sup_request_hash(r sup_requests) RETURNS text LANGUAGE sql IMMUTABLE AS $$
     SELECT md5(concat_ws('|', r.id, r.tenant_id, r.ticket_ref, r.purpose, array_to_string(r.scopes, ','), r.hours)) $$`,
  // Agent side (Company OS). Returns NULL on success, else a reason.
  `CREATE OR REPLACE FUNCTION sup_request(p_agent text, p_id text, p_tenant text, p_tenant_name text, p_ticket text, p_purpose text, p_scopes text[], p_hours int) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF NOT co_has(p_agent, 'support_agent') THEN RETURN 'Requesting access needs the support agent role.'; END IF;
  IF EXISTS (SELECT 1 FROM sup_requests WHERE id = p_id) THEN RETURN NULL; END IF;   -- replay of the same request key
  IF EXISTS (SELECT 1 FROM sup_requests WHERE agent_id = p_agent AND tenant_id = p_tenant AND state = 'pending') THEN RETURN 'You already have a pending request for this institution.'; END IF;
  INSERT INTO sup_requests (id, agent_id, tenant_id, tenant_name, ticket_ref, purpose, scopes, hours) VALUES (p_id, p_agent, p_tenant, p_tenant_name, p_ticket, trim(p_purpose), p_scopes, p_hours);
  INSERT INTO sup_events (request_id, actor_id, action, detail) VALUES (p_id, p_agent, 'requested', array_to_string(p_scopes, ', ') || ' for ' || p_hours || ' h');
  RETURN NULL;
END $$`,
  // Institution side (Semester console). The tenant comes from the approver's own membership, resolved on the server.
  `CREATE OR REPLACE FUNCTION sup_decide(p_actor text, p_tenant text, p_id text, p_approve boolean, p_seen_hash text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r sup_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM sup_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'Request not found for your institution.'; END IF;
  IF r.state <> 'pending' THEN RETURN 'This request was already decided.'; END IF;
  IF r.agent_id = p_actor THEN RETURN 'You cannot decide your own request.'; END IF;
  IF p_seen_hash IS DISTINCT FROM sup_request_hash(r) THEN RETURN 'The request changed since you opened it. Reload and review again.'; END IF;
  IF NOT p_approve AND length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say why you are denying it.'; END IF;
  UPDATE sup_requests SET state = CASE WHEN p_approve THEN 'approved' ELSE 'denied' END, decided_by = p_actor, decided_at = now(), decision_note = p_note,
    expires_at = CASE WHEN p_approve THEN now() + make_interval(hours => r.hours) ELSE NULL END WHERE id = r.id;
  INSERT INTO sup_events (request_id, actor_id, action, detail) VALUES (r.id, p_actor, CASE WHEN p_approve THEN 'approved' ELSE 'denied' END, coalesce(p_note, ''));
  RETURN NULL;
END $$`,
  // Either the requesting agent or the institution's administrator can revoke at any time.
  `CREATE OR REPLACE FUNCTION sup_revoke(p_actor text, p_tenant text, p_id text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r sup_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM sup_requests WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT (r.agent_id = p_actor OR r.tenant_id = coalesce(p_tenant, '')) THEN RETURN 'Request not found.'; END IF;
  IF r.state = 'pending' AND r.agent_id = p_actor THEN
    UPDATE sup_requests SET state = 'withdrawn' WHERE id = r.id;
    INSERT INTO sup_events (request_id, actor_id, action) VALUES (r.id, p_actor, 'withdrawn'); RETURN NULL;
  END IF;
  IF r.state <> 'approved' OR r.expires_at <= now() THEN RETURN 'There is no active access to revoke.'; END IF;
  UPDATE sup_requests SET state = 'revoked', revoked_by = p_actor, revoked_at = now() WHERE id = r.id;
  INSERT INTO sup_events (request_id, actor_id, action) VALUES (r.id, p_actor, 'revoked');
  RETURN NULL;
END $$`,
  // Checked on EVERY use; logs the decision whether it allows or denies.
  `CREATE OR REPLACE FUNCTION sup_check(p_agent text, p_tenant text, p_scope text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r sup_requests%ROWTYPE; v_reason text;
BEGIN
  SELECT * INTO r FROM sup_requests WHERE agent_id = p_agent AND tenant_id = p_tenant AND state = 'approved' AND expires_at > now() ORDER BY decided_at DESC LIMIT 1;
  IF NOT co_has(p_agent, 'support_agent') THEN v_reason := 'no support role';
  ELSIF NOT FOUND THEN v_reason := 'no active approved access';
  ELSIF NOT (p_scope = ANY (r.scopes)) THEN v_reason := 'scope not approved';
  ELSE v_reason := 'ok'; END IF;
  INSERT INTO sup_access_log (request_id, agent_id, tenant_id, scope, allowed, reason) VALUES (r.id, p_agent, p_tenant, p_scope, v_reason = 'ok', v_reason);
  RETURN CASE WHEN v_reason = 'ok' THEN NULL ELSE v_reason END;
END $$`,
];
