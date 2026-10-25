// Migration cat-001: course catalog versions and registration rules (Registrar app: "catalog, rules").
// Both follow the calendar's two-person rule: one registrar proposes, a different registrar approves (also a CHECK), the latest
// approved version is effective, older versions are kept. Catalog entries are the institution's published course descriptions;
// applying them to live sections and enrollment records is a separate activation step and is not done here.
// Registration rules: an approved max-credit limit is enforced when students submit registration.
export const CAT_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS cat_courses (id bigserial PRIMARY KEY, tenant_id text NOT NULL, code text NOT NULL, version int NOT NULL,
     title text NOT NULL CHECK (length(title) BETWEEN 3 AND 160), credits numeric NOT NULL CHECK (credits > 0 AND credits <= 12),
     description text NOT NULL CHECK (length(description) BETWEEN 20 AND 4000), prerequisites text NOT NULL DEFAULT '', effective_term text NOT NULL,
     retire boolean NOT NULL DEFAULT false, state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed', 'approved', 'rejected', 'superseded')),
     proposed_by text NOT NULL, decided_by text, decided_at timestamptz, decision_note text, created_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, code, version), CHECK (decided_by IS NULL OR decided_by <> proposed_by))`,
  `CREATE TABLE IF NOT EXISTS cat_rules (id bigserial PRIMARY KEY, tenant_id text NOT NULL, version int NOT NULL, max_credits numeric NOT NULL CHECK (max_credits BETWEEN 1 AND 30),
     overload_note text NOT NULL DEFAULT '', state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed', 'approved', 'rejected', 'superseded')),
     proposed_by text NOT NULL, decided_by text, decided_at timestamptz, decision_note text, created_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, version), CHECK (decided_by IS NULL OR decided_by <> proposed_by))`,
  `CREATE TABLE IF NOT EXISTS cat_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, ref text NOT NULL, actor_id text NOT NULL, action text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION cat_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS cat_events_append_only ON cat_events`,
  `CREATE TRIGGER cat_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON cat_events FOR EACH STATEMENT EXECUTE FUNCTION cat_refuse_change()`,
  `CREATE OR REPLACE FUNCTION cat_propose_course(p_actor text, p_tenant text, p_code text, p_title text, p_credits numeric, p_desc text, p_prereq text, p_term text, p_retire boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v int; c text := upper(regexp_replace(trim(coalesce(p_code, '')), '\\s+', ' ', 'g'));
   BEGIN
     IF c !~ '^[A-Z]{2,6} ?[0-9]{3,4}[A-Z]?$' THEN RETURN 'Use a course code like HIST 214.'; END IF;
     IF length(trim(coalesce(p_desc, ''))) < 20 THEN RETURN 'Write a catalog description (20+ characters).'; END IF;
     IF p_credits IS NULL OR p_credits <= 0 OR p_credits > 12 THEN RETURN 'Credits must be between 0 and 12.'; END IF;
     IF length(trim(coalesce(p_term, ''))) < 3 THEN RETURN 'Say which term it takes effect.'; END IF;
     IF EXISTS (SELECT 1 FROM cat_courses WHERE tenant_id = p_tenant AND code = c AND state = 'proposed') THEN RETURN 'A change to this course is already waiting for approval.'; END IF;
     PERFORM pg_advisory_xact_lock(hashtext('cat:' || p_tenant || c));
     SELECT coalesce(max(version), 0) + 1 INTO v FROM cat_courses WHERE tenant_id = p_tenant AND code = c;
     INSERT INTO cat_courses (tenant_id, code, version, title, credits, description, prerequisites, effective_term, retire, proposed_by)
       VALUES (p_tenant, c, v, trim(p_title), p_credits, trim(p_desc), trim(coalesce(p_prereq, '')), trim(p_term), coalesce(p_retire, false), p_actor);
     INSERT INTO cat_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, c || ' v' || v, p_actor, 'course_proposed');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION cat_propose_rules(p_actor text, p_tenant text, p_max numeric, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v int;
   BEGIN
     IF p_max IS NULL OR p_max < 1 OR p_max > 30 THEN RETURN 'Set a credit limit between 1 and 30.'; END IF;
     IF EXISTS (SELECT 1 FROM cat_rules WHERE tenant_id = p_tenant AND state = 'proposed') THEN RETURN 'A rules change is already waiting for approval.'; END IF;
     PERFORM pg_advisory_xact_lock(hashtext('catrules:' || p_tenant));
     SELECT coalesce(max(version), 0) + 1 INTO v FROM cat_rules WHERE tenant_id = p_tenant;
     INSERT INTO cat_rules (tenant_id, version, max_credits, overload_note, proposed_by) VALUES (p_tenant, v, p_max, trim(coalesce(p_note, '')), p_actor);
     INSERT INTO cat_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, 'rules v' || v, p_actor, 'rules_proposed');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION cat_decide(p_actor text, p_tenant text, p_kind text, p_id bigint, p_approve boolean, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_prop text; v_state text; v_code text; v_ref text;
   BEGIN
     IF NOT p_approve AND length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say why it is rejected.'; END IF;
     IF p_kind = 'course' THEN
       SELECT proposed_by, state, code, code || ' v' || version INTO v_prop, v_state, v_code, v_ref FROM cat_courses WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     ELSE
       SELECT proposed_by, state, NULL, 'rules v' || version INTO v_prop, v_state, v_code, v_ref FROM cat_rules WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     END IF;
     IF v_prop IS NULL THEN RETURN 'Proposal not found.'; END IF;
     IF v_state <> 'proposed' THEN RETURN 'This proposal was already decided.'; END IF;
     IF v_prop = p_actor THEN RETURN 'A different registrar must approve your proposal.'; END IF;
     IF p_kind = 'course' THEN
       IF p_approve THEN UPDATE cat_courses SET state = 'superseded' WHERE tenant_id = p_tenant AND code = v_code AND state = 'approved'; END IF;
       UPDATE cat_courses SET state = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, decided_by = p_actor, decided_at = now(), decision_note = trim(coalesce(p_note, '')) WHERE id = p_id;
     ELSE
       IF p_approve THEN UPDATE cat_rules SET state = 'superseded' WHERE tenant_id = p_tenant AND state = 'approved'; END IF;
       UPDATE cat_rules SET state = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, decided_by = p_actor, decided_at = now(), decision_note = trim(coalesce(p_note, '')) WHERE id = p_id;
     END IF;
     INSERT INTO cat_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, v_ref, p_actor, CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION cat_max_credits(p_tenant text) RETURNS numeric LANGUAGE sql STABLE AS $$
     SELECT max_credits FROM cat_rules WHERE tenant_id = p_tenant AND state = 'approved' ORDER BY version DESC LIMIT 1 $$`,
];
