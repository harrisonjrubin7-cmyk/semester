// Migration aud-001: audit and assurance (S-76 E32; mirrors lib/auditRules.ts).
// Enforced here: audit access is a grant to one person for a stated purpose, named areas and at most 180 days, made by an
// administrator who is not that person, revocable, and checked on every call through aud_live() (no read-all role); plans,
// controls, evidence, tests and findings are reachable only through a live grant for their area; evidence is a reference
// plus a SHA-256, append-only, and re-hashing logs whether it still matches; tests cite only evidence from their own plan;
// findings are issued to a management owner who is not the issuer, answered and remediated only by that owner, and closed only
// by an auditor with live access who is neither owner nor remediator, citing evidence collected after the remediation.
// Expected-version on finding steps, request-key idempotency on evidence and findings, append-only history.
export const AUD_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS aud_grants (id bigserial PRIMARY KEY, tenant_id text NOT NULL, auditor_id text NOT NULL,
     purpose text NOT NULL CHECK (length(trim(purpose)) BETWEEN 10 AND 500),
     areas text[] NOT NULL CHECK (cardinality(areas) > 0 AND areas <@ ARRAY['finance','admissions','registrar','financial_aid','it_security','facilities','research','privacy','hr']::text[]),
     granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, revoked_by text, revoked_at timestamptz,
     CHECK (granted_by <> auditor_id), CHECK (expires_at > granted_at AND expires_at <= granted_at + interval '180 days'))`,
  `CREATE TABLE IF NOT EXISTS aud_controls (id bigserial PRIMARY KEY, tenant_id text NOT NULL, code text NOT NULL CHECK (code ~ '^[A-Z]{2,6}-[0-9]{1,4}$'),
     area text NOT NULL, title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200), objective text NOT NULL DEFAULT '' CHECK (length(objective) <= 2000),
     created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, code))`,
  `CREATE TABLE IF NOT EXISTS aud_plans (id bigserial PRIMARY KEY, tenant_id text NOT NULL, grant_id bigint NOT NULL REFERENCES aud_grants(id), area text NOT NULL,
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200), scope_note text NOT NULL DEFAULT '' CHECK (length(scope_note) <= 2000),
     state text NOT NULL DEFAULT 'planned' CHECK (state IN ('planned','fieldwork','reporting','closed')), created_by text NOT NULL,
     version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS aud_evidence (id bigserial PRIMARY KEY, tenant_id text NOT NULL, plan_id bigint NOT NULL REFERENCES aud_plans(id),
     ref text NOT NULL CHECK (length(trim(ref)) BETWEEN 3 AND 500), sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'), note text NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
     collected_by text NOT NULL, collected_at timestamptz NOT NULL DEFAULT clock_timestamp(), request_key text NOT NULL, UNIQUE (plan_id, request_key))`,
  `CREATE TABLE IF NOT EXISTS aud_tests (id bigserial PRIMARY KEY, tenant_id text NOT NULL, plan_id bigint NOT NULL REFERENCES aud_plans(id), control_id bigint NOT NULL REFERENCES aud_controls(id),
     evidence_ids bigint[] NOT NULL CHECK (cardinality(evidence_ids) > 0), sample_size int NOT NULL CHECK (sample_size BETWEEN 1 AND 100000),
     result text NOT NULL CHECK (result IN ('pass','fail','exception')), note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000), tester_id text NOT NULL, tested_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS aud_findings (id bigserial PRIMARY KEY, tenant_id text NOT NULL, plan_id bigint NOT NULL REFERENCES aud_plans(id), control_id bigint REFERENCES aud_controls(id),
     severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')), title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200),
     detail text NOT NULL DEFAULT '' CHECK (length(detail) <= 4000), owner_id text NOT NULL, issued_by text NOT NULL, due date,
     state text NOT NULL DEFAULT 'issued' CHECK (state IN ('issued','responded','awaiting_verification','closed')),
     response text NOT NULL DEFAULT '' CHECK (length(response) <= 4000), remediation_note text NOT NULL DEFAULT '' CHECK (length(remediation_note) <= 4000),
     remediated_by text, remediated_at timestamptz, verified_by text, verify_evidence_id bigint REFERENCES aud_evidence(id), verified_at timestamptz,
     version int NOT NULL DEFAULT 1, request_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (plan_id, request_key),
     CHECK (owner_id <> issued_by),
     CHECK (state = 'issued' OR length(trim(response)) > 0),
     CHECK (state NOT IN ('awaiting_verification','closed') OR (remediated_by IS NOT NULL AND remediated_at IS NOT NULL)),
     CHECK (state <> 'closed' OR (verified_by IS NOT NULL AND verify_evidence_id IS NOT NULL AND verified_by <> owner_id AND verified_by <> remediated_by)))`,
  `CREATE TABLE IF NOT EXISTS aud_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL, ref bigint, step text NOT NULL, actor_id text NOT NULL,
     note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION aud_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'aud_events_append_only') THEN
       CREATE TRIGGER aud_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON aud_events FOR EACH STATEMENT EXECUTE FUNCTION aud_refuse_change();
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'aud_evidence_append_only') THEN
       CREATE TRIGGER aud_evidence_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON aud_evidence FOR EACH STATEMENT EXECUTE FUNCTION aud_refuse_change();
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'aud_tests_append_only') THEN
       CREATE TRIGGER aud_tests_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON aud_tests FOR EACH STATEMENT EXECUTE FUNCTION aud_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION aud_live(p_tenant text, p_user text, p_area text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM aud_grants WHERE tenant_id = p_tenant AND auditor_id = p_user AND revoked_at IS NULL AND expires_at > now() AND p_area = ANY(areas)) $$`,
  `CREATE OR REPLACE FUNCTION aud_grant(p_admin text, p_tenant text, p_user text, p_purpose text, p_areas text[], p_days int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to grant you audit access.'; END IF;
     IF length(trim(coalesce(p_purpose, ''))) < 10 THEN RETURN 'State the purpose of the audit (at least 10 characters).'; END IF;
     IF p_days IS NULL OR p_days < 1 OR p_days > 180 THEN RETURN 'Audit access lasts between 1 and 180 days.'; END IF;
     IF coalesce(cardinality(p_areas), 0) = 0 OR (SELECT count(DISTINCT x) FROM unnest(p_areas) x) <> cardinality(p_areas)
        OR NOT (p_areas <@ ARRAY['finance','admissions','registrar','financial_aid','it_security','facilities','research','privacy','hr']::text[]) THEN
       RETURN 'Choose the areas this audit covers.'; END IF;
     INSERT INTO aud_grants (tenant_id, auditor_id, purpose, areas, granted_by, expires_at) VALUES (p_tenant, p_user, trim(p_purpose), p_areas, p_admin, now() + make_interval(days => p_days))
       RETURNING id INTO v_id;
     INSERT INTO aud_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'grant', v_id, 'grant', p_admin, p_user || ' ' || array_to_string(p_areas, ','));
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION aud_revoke(p_admin text, p_tenant text, p_grant bigint) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     UPDATE aud_grants SET revoked_at = now(), revoked_by = p_admin WHERE id = p_grant AND tenant_id = p_tenant AND revoked_at IS NULL;
     IF NOT FOUND THEN RETURN 'That grant is not active.'; END IF;
     INSERT INTO aud_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'grant', p_grant, 'revoke', p_admin);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION aud_control(p_actor text, p_tenant text, p_code text, p_area text, p_title text, p_objective text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT aud_live(p_tenant, p_actor, p_area) THEN RETURN 'You need live audit access to this area.'; END IF;
     IF p_code !~ '^[A-Z]{2,6}-[0-9]{1,4}$' THEN RETURN 'Control codes look like FIN-12.'; END IF;
     IF EXISTS (SELECT 1 FROM aud_controls WHERE tenant_id = p_tenant AND code = p_code) THEN RETURN 'That control code is already defined.'; END IF;
     INSERT INTO aud_controls (tenant_id, code, area, title, objective, created_by) VALUES (p_tenant, p_code, p_area, trim(p_title), coalesce(p_objective, ''), p_actor) RETURNING id INTO v_id;
     INSERT INTO aud_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'control', v_id, 'define', p_actor, p_code);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION aud_plan(p_actor text, p_tenant text, p_grant bigint, p_area text, p_title text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE g aud_grants; v_id bigint;
   BEGIN
     SELECT * INTO g FROM aud_grants WHERE id = p_grant AND tenant_id = p_tenant;
     IF g.id IS NULL OR g.auditor_id <> p_actor THEN RETURN 'Plans are opened under your own audit grant.'; END IF;
     IF NOT (p_area = ANY(g.areas)) OR NOT aud_live(p_tenant, p_actor, p_area) THEN RETURN 'Your grant does not cover that area, or it has ended.'; END IF;
     INSERT INTO aud_plans (tenant_id, grant_id, area, title, scope_note, created_by) VALUES (p_tenant, p_grant, p_area, trim(p_title), coalesce(p_note, ''), p_actor) RETURNING id INTO v_id;
     INSERT INTO aud_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'plan', v_id, 'open', p_actor, g.purpose);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION aud_plan_step(p_actor text, p_tenant text, p_plan bigint, p_to text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE p aud_plans;
   BEGIN
     SELECT * INTO p FROM aud_plans WHERE id = p_plan AND tenant_id = p_tenant FOR UPDATE;
     IF p.id IS NULL OR NOT aud_live(p_tenant, p_actor, p.area) THEN RETURN 'You need live audit access to this area.'; END IF;
     IF p.version <> p_version THEN RETURN 'This plan changed since you opened it. Reload and try again.'; END IF;
     IF NOT ((p.state = 'planned' AND p_to = 'fieldwork') OR (p.state = 'fieldwork' AND p_to = 'reporting') OR (p.state = 'reporting' AND p_to = 'closed')) THEN
       RETURN 'Plans move planned → fieldwork → reporting → closed.'; END IF;
     IF p_to = 'closed' AND EXISTS (SELECT 1 FROM aud_findings WHERE plan_id = p_plan AND state = 'issued') THEN
       RETURN 'Every finding needs a management response before the plan closes.'; END IF;
     UPDATE aud_plans SET state = p_to, version = version + 1, updated_at = now() WHERE id = p_plan;
     INSERT INTO aud_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'plan', p_plan, p_to, p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION aud_evidence_add(p_actor text, p_tenant text, p_plan bigint, p_ref text, p_sha text, p_note text, p_key text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE p aud_plans; e aud_evidence; v_id bigint;
   BEGIN
     SELECT * INTO p FROM aud_plans WHERE id = p_plan AND tenant_id = p_tenant;
     IF p.id IS NULL OR NOT aud_live(p_tenant, p_actor, p.area) THEN RETURN 'You need live audit access to this area.'; END IF;
     SELECT * INTO e FROM aud_evidence WHERE plan_id = p_plan AND request_key = p_key;
     IF e.id IS NOT NULL THEN
       IF e.ref = trim(p_ref) AND e.sha256 = p_sha THEN RETURN 'replay:' || e.id; END IF;
       RETURN 'That request was already used for different evidence.';
     END IF;
     IF p.state = 'closed' THEN RETURN 'This plan is closed.'; END IF;
     IF p_sha !~ '^[0-9a-f]{64}$' THEN RETURN 'Record the SHA-256 of the evidence (64 lowercase hex characters).'; END IF;
     INSERT INTO aud_evidence (tenant_id, plan_id, ref, sha256, note, collected_by, request_key) VALUES (p_tenant, p_plan, trim(p_ref), p_sha, coalesce(p_note, ''), p_actor, p_key) RETURNING id INTO v_id;
     INSERT INTO aud_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'evidence', v_id, 'collect', p_actor, p_sha);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION aud_reproduce(p_actor text, p_tenant text, p_evidence bigint, p_sha text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e aud_evidence; v_area text; v_match boolean;
   BEGIN
     SELECT * INTO e FROM aud_evidence WHERE id = p_evidence AND tenant_id = p_tenant;
     SELECT area INTO v_area FROM aud_plans WHERE id = e.plan_id;
     IF e.id IS NULL OR NOT aud_live(p_tenant, p_actor, v_area) THEN RETURN 'You need live audit access to this area.'; END IF;
     v_match := (e.sha256 = lower(trim(p_sha)));
     INSERT INTO aud_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'evidence', p_evidence, CASE WHEN v_match THEN 'reproduced' ELSE 'tamper_suspected' END, p_actor, lower(trim(p_sha)));
     RETURN CASE WHEN v_match THEN 'match' ELSE 'mismatch' END;
   END $$`,
  `CREATE OR REPLACE FUNCTION aud_test(p_actor text, p_tenant text, p_plan bigint, p_control bigint, p_evidence bigint[], p_sample int, p_result text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE p aud_plans; c aud_controls; v_id bigint;
   BEGIN
     SELECT * INTO p FROM aud_plans WHERE id = p_plan AND tenant_id = p_tenant;
     IF p.id IS NULL OR NOT aud_live(p_tenant, p_actor, p.area) THEN RETURN 'You need live audit access to this area.'; END IF;
     IF p.state <> 'fieldwork' THEN RETURN 'Tests are recorded during fieldwork.'; END IF;
     SELECT * INTO c FROM aud_controls WHERE id = p_control AND tenant_id = p_tenant;
     IF c.id IS NULL OR c.area <> p.area THEN RETURN 'Choose a control in this plan''s area.'; END IF;
     IF coalesce(cardinality(p_evidence), 0) = 0 OR (SELECT count(*) FROM aud_evidence WHERE plan_id = p_plan AND id = ANY(p_evidence)) <> (SELECT count(DISTINCT x) FROM unnest(p_evidence) x)
        OR (SELECT count(DISTINCT x) FROM unnest(p_evidence) x) <> cardinality(p_evidence) THEN
       RETURN 'Cite evidence collected for this plan.'; END IF;
     IF p_sample IS NULL OR p_sample < 1 THEN RETURN 'Record the sample size.'; END IF;
     INSERT INTO aud_tests (tenant_id, plan_id, control_id, evidence_ids, sample_size, result, note, tester_id) VALUES (p_tenant, p_plan, p_control, p_evidence, p_sample, p_result, coalesce(p_note, ''), p_actor)
       RETURNING id INTO v_id;
     INSERT INTO aud_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'test', v_id, p_result, p_actor, c.code);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION aud_issue(p_actor text, p_tenant text, p_plan bigint, p_control bigint, p_severity text, p_title text, p_detail text, p_owner text, p_due date, p_key text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE p aud_plans; f aud_findings; v_id bigint;
   BEGIN
     SELECT * INTO p FROM aud_plans WHERE id = p_plan AND tenant_id = p_tenant;
     IF p.id IS NULL OR NOT aud_live(p_tenant, p_actor, p.area) THEN RETURN 'You need live audit access to this area.'; END IF;
     SELECT * INTO f FROM aud_findings WHERE plan_id = p_plan AND request_key = p_key;
     IF f.id IS NOT NULL THEN
       IF f.title = trim(p_title) AND f.owner_id = p_owner AND f.severity = p_severity THEN RETURN 'replay:' || f.id; END IF;
       RETURN 'That request was already used for a different finding.';
     END IF;
     IF p.state NOT IN ('fieldwork','reporting') THEN RETURN 'Findings are issued during fieldwork or reporting.'; END IF;
     IF p_owner = p_actor THEN RETURN 'Issue the finding to a management owner other than yourself.'; END IF;
     IF p_control IS NOT NULL AND NOT EXISTS (SELECT 1 FROM aud_controls WHERE id = p_control AND tenant_id = p_tenant AND area = p.area) THEN
       RETURN 'Choose a control in this plan''s area.'; END IF;
     INSERT INTO aud_findings (tenant_id, plan_id, control_id, severity, title, detail, owner_id, issued_by, due, request_key)
       VALUES (p_tenant, p_plan, p_control, p_severity, trim(p_title), coalesce(p_detail, ''), p_owner, p_actor, p_due, p_key) RETURNING id INTO v_id;
     INSERT INTO aud_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'finding', v_id, 'issue', p_actor, p_severity);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION aud_finding_step(p_actor text, p_tenant text, p_finding bigint, p_step text, p_text text, p_evidence bigint, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE f aud_findings; v_area text; v_live boolean; e aud_evidence;
   BEGIN
     SELECT * INTO f FROM aud_findings WHERE id = p_finding AND tenant_id = p_tenant FOR UPDATE;
     IF f.id IS NULL THEN RETURN 'Finding not found.'; END IF;
     SELECT area INTO v_area FROM aud_plans WHERE id = f.plan_id;
     v_live := aud_live(p_tenant, p_actor, v_area);
     IF p_actor <> f.owner_id AND NOT v_live THEN RETURN 'Finding not found.'; END IF;
     IF f.version <> p_version THEN RETURN 'This finding changed since you opened it. Reload and try again.'; END IF;
     IF f.state = 'closed' THEN RETURN 'This finding is closed.'; END IF;
     IF p_step = 'respond' THEN
       IF p_actor <> f.owner_id THEN RETURN 'Only the management owner responds to a finding.'; END IF;
       IF f.state NOT IN ('issued','responded') THEN RETURN 'The response is already recorded; remediation is under way.'; END IF;
       IF length(trim(coalesce(p_text, ''))) < 5 THEN RETURN 'Write the management response.'; END IF;
       UPDATE aud_findings SET state = 'responded', response = trim(p_text), version = version + 1 WHERE id = p_finding;
     ELSIF p_step = 'remediate' THEN
       IF p_actor <> f.owner_id THEN RETURN 'Only the management owner records remediation.'; END IF;
       IF f.state = 'issued' THEN RETURN 'Record a management response first.'; END IF;
       IF f.state <> 'responded' THEN RETURN 'Remediation is already awaiting verification.'; END IF;
       IF length(trim(coalesce(p_text, ''))) < 5 THEN RETURN 'Describe what was fixed.'; END IF;
       UPDATE aud_findings SET state = 'awaiting_verification', remediation_note = trim(p_text), remediated_by = p_actor, remediated_at = clock_timestamp(), version = version + 1 WHERE id = p_finding;
     ELSIF p_step IN ('verify_accept','verify_reject') THEN
       IF NOT v_live THEN RETURN 'You need live audit access to this area.'; END IF;
       IF p_actor = f.owner_id THEN RETURN 'The management owner cannot verify their own finding.'; END IF;
       IF p_actor = f.remediated_by THEN RETURN 'Someone other than the person who remediated verifies closure.'; END IF;
       IF f.state <> 'awaiting_verification' THEN RETURN 'Nothing is awaiting verification yet.'; END IF;
       IF p_step = 'verify_accept' THEN
         SELECT * INTO e FROM aud_evidence WHERE id = p_evidence AND plan_id = f.plan_id;
         IF e.id IS NULL OR e.collected_at < f.remediated_at THEN RETURN 'Cite evidence from this plan collected after the remediation.'; END IF;
         UPDATE aud_findings SET state = 'closed', verified_by = p_actor, verify_evidence_id = e.id, verified_at = now(), version = version + 1 WHERE id = p_finding;
       ELSE
         IF length(trim(coalesce(p_text, ''))) < 5 THEN RETURN 'Say why the remediation is not accepted.'; END IF;
         UPDATE aud_findings SET state = 'responded', remediated_by = NULL, remediated_at = NULL, version = version + 1 WHERE id = p_finding;
       END IF;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO aud_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'finding', p_finding, p_step, p_actor, coalesce(p_text, ''));
     RETURN NULL;
   END $$`,
];
