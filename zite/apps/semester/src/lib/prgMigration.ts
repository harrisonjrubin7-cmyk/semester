// Migration prg-001: programs and pathways (mirrors lib/programRules.ts). Requires cat-001, sreq-001 and cur-001.
// Enforced here: only the department's chair proposes; pathway courses must be published, appear once, follow their
// in-pathway prerequisites, stay within the per-term cap and reach the program total; every outcome maps to pathway courses;
// one open version per program code; idempotent submit; a committee member approves (not the author); a registrar publishes
// (neither author nor approver; the endpoint checks the registrar capability) after re-validating against today's catalog,
// and the previous published version is superseded; returns need a note; expected-version; append-only history.
export const PRG_MIGRATION: string[] = [
  `CREATE OR REPLACE FUNCTION prg_catalog(p_tenant text) RETURNS TABLE (code text, credits numeric, prereq_text text) LANGUAGE sql STABLE AS $$
     SELECT DISTINCT ON (replace(c.code, ' ', '')) replace(c.code, ' ', ''), c.credits, c.prerequisites FROM cat_courses c
     WHERE c.tenant_id = p_tenant AND c.state = 'approved' ORDER BY replace(c.code, ' ', ''), c.version DESC $$`,
  `CREATE TABLE IF NOT EXISTS prg_programs (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_key text NOT NULL, author_id text NOT NULL,
     department_id bigint NOT NULL REFERENCES inst_departments(id), code text NOT NULL CHECK (code ~ '^[A-Z0-9-]{2,24}$'), version int NOT NULL,
     name text NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 160), credential text NOT NULL CHECK (credential IN ('certificate','associate','bachelor','master','doctoral','professional')),
     total_credits numeric NOT NULL CHECK (total_credits > 0 AND total_credits <= 300), term_cap numeric NOT NULL CHECK (term_cap > 0 AND term_cap <= 30),
     terms jsonb NOT NULL, outcomes jsonb NOT NULL, effective_term text NOT NULL CHECK (length(trim(effective_term)) >= 3), rationale text NOT NULL CHECK (length(rationale) BETWEEN 20 AND 4000),
     state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted','committee_approved','published','returned','withdrawn','superseded')),
     row_version int NOT NULL DEFAULT 1, committee_by text, published_by text, note text NOT NULL DEFAULT '',
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, author_id, request_key), UNIQUE (tenant_id, code, version),
     CHECK (committee_by IS NULL OR committee_by <> author_id), CHECK (published_by IS NULL OR (published_by <> author_id AND published_by <> committee_by)))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS prg_one_open ON prg_programs (tenant_id, code) WHERE state IN ('submitted','committee_approved')`,
  `CREATE UNIQUE INDEX IF NOT EXISTS prg_one_published ON prg_programs (tenant_id, code) WHERE state = 'published'`,
  `CREATE TABLE IF NOT EXISTS prg_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, program_id bigint NOT NULL, step text NOT NULL, to_state text NOT NULL,
     actor_id text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION prg_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'prg_events_append_only') THEN
       CREATE TRIGGER prg_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON prg_events FOR EACH STATEMENT EXECUTE FUNCTION prg_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION prg_check(p_tenant text, p_terms jsonb, p_outcomes jsonb, p_total numeric, p_cap numeric) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE t int; n int; cr numeric; sum_all numeric := 0; k text; raw text; pre text; o jsonb; seen jsonb := '{}'::jsonb; cat record;
   BEGIN
     IF jsonb_typeof(p_terms) <> 'array' OR jsonb_array_length(p_terms) NOT BETWEEN 1 AND 16 THEN RETURN 'A pathway has between 1 and 16 terms.'; END IF;
     n := jsonb_array_length(p_terms);
     FOR t IN 0 .. n - 1 LOOP
       IF jsonb_typeof(p_terms->t) <> 'array' THEN RETURN 'Each term is a list of courses.'; END IF;
       cr := 0;
       FOR raw IN SELECT jsonb_array_elements_text(p_terms->t) LOOP
         k := replace(upper(trim(raw)), ' ', '');
         SELECT * INTO cat FROM prg_catalog(p_tenant) c WHERE c.code = k;
         IF NOT FOUND THEN RETURN 'Not in the published catalog: ' || raw || '.'; END IF;
         IF seen ? k THEN RETURN raw || ' appears in more than one term.'; END IF;
         seen := seen || jsonb_build_object(k, t);
         cr := cr + cat.credits;
       END LOOP;
       IF cr > p_cap THEN RETURN 'Term ' || (t + 1) || ' has ' || cr || ' credits, over the cap of ' || p_cap || '.'; END IF;
       sum_all := sum_all + cr;
     END LOOP;
     FOR k IN SELECT jsonb_object_keys(seen) LOOP
       FOR pre IN SELECT replace(m[1], ' ', '') FROM prg_catalog(p_tenant) c CROSS JOIN LATERAL regexp_matches(upper(c.prereq_text), '([A-Z]{2,6} ?[0-9]{3,4}[A-Z]?)', 'g') m WHERE c.code = k LOOP
         IF seen ? pre AND (seen->>pre)::int >= (seen->>k)::int THEN RETURN k || ' needs ' || pre || ' in an earlier term.'; END IF;
       END LOOP;
     END LOOP;
     IF sum_all < p_total THEN RETURN 'The pathway reaches ' || sum_all || ' of the program''s ' || p_total || ' credits.'; END IF;
     IF jsonb_typeof(p_outcomes) <> 'array' OR jsonb_array_length(p_outcomes) NOT BETWEEN 1 AND 12 THEN RETURN 'List between 1 and 12 program outcomes.'; END IF;
     FOR o IN SELECT * FROM jsonb_array_elements(p_outcomes) LOOP
       IF length(trim(coalesce(o->>'text', ''))) < 10 THEN RETURN 'Write each program outcome as a full statement (10+ characters).'; END IF;
       IF jsonb_typeof(o->'courses') <> 'array' OR jsonb_array_length(o->'courses') = 0 THEN RETURN 'Map "' || left(o->>'text', 40) || '" to at least one course.'; END IF;
       FOR raw IN SELECT jsonb_array_elements_text(o->'courses') LOOP
         IF NOT seen ? replace(upper(trim(raw)), ' ', '') THEN RETURN 'Outcome maps to ' || raw || ', which is not in the pathway.'; END IF;
       END LOOP;
     END LOOP;
     RETURN NULL;
   END $$`,
  // Returns 'ok:<id>', 'replay:<id>' or a refusal.
  `CREATE OR REPLACE FUNCTION prg_submit(p_tenant text, p_key text, p_author text, p_dept bigint, p_code text, p_name text, p_credential text, p_total numeric, p_cap numeric,
     p_terms jsonb, p_outcomes jsonb, p_term text, p_rationale text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE pr prg_programs; d inst_departments; c text := upper(trim(coalesce(p_code, ''))); e text; v int; nid bigint;
   BEGIN
     SELECT * INTO pr FROM prg_programs WHERE tenant_id = p_tenant AND author_id = p_author AND request_key = p_key;
     IF FOUND THEN
       IF pr.code = c AND pr.terms = p_terms AND pr.outcomes = p_outcomes AND pr.name = trim(p_name) THEN RETURN 'replay:' || pr.id; END IF;
       RETURN 'This proposal was already sent with different details.';
     END IF;
     SELECT * INTO d FROM inst_departments WHERE id = p_dept AND tenant_id = p_tenant;
     IF NOT FOUND OR NOT d.active THEN RETURN 'Choose an active department.'; END IF;
     IF d.chair_id IS DISTINCT FROM p_author THEN RETURN 'Only the department chair proposes programs for this department.'; END IF;
     IF c !~ '^[A-Z0-9-]{2,24}$' THEN RETURN 'Use a program code like BA-ECON.'; END IF;
     IF length(trim(coalesce(p_rationale, ''))) < 20 THEN RETURN 'Explain the change (20+ characters).'; END IF;
     e := prg_check(p_tenant, p_terms, p_outcomes, p_total, p_cap);
     IF e IS NOT NULL THEN RETURN e; END IF;
     PERFORM pg_advisory_xact_lock(hashtext('prg:' || p_tenant || c));
     IF EXISTS (SELECT 1 FROM prg_programs WHERE tenant_id = p_tenant AND code = c AND state IN ('submitted','committee_approved')) THEN RETURN 'A version of this program is already under review.'; END IF;
     IF EXISTS (SELECT 1 FROM prg_programs WHERE tenant_id = p_tenant AND code = c AND department_id <> p_dept) THEN RETURN 'That program code belongs to another department.'; END IF;
     SELECT coalesce(max(version), 0) + 1 INTO v FROM prg_programs WHERE tenant_id = p_tenant AND code = c;
     INSERT INTO prg_programs (tenant_id, request_key, author_id, department_id, code, version, name, credential, total_credits, term_cap, terms, outcomes, effective_term, rationale)
       VALUES (p_tenant, p_key, p_author, p_dept, c, v, trim(p_name), p_credential, p_total, p_cap, p_terms, p_outcomes, trim(p_term), trim(p_rationale)) RETURNING id INTO nid;
     INSERT INTO prg_events (tenant_id, program_id, step, to_state, actor_id, note) VALUES (p_tenant, nid, 'submit', 'submitted', p_author, c || ' v' || v);
     RETURN 'ok:' || nid;
   END $$`,
  // p_registrar: the endpoint has verified the registrar capability for this actor.
  `CREATE OR REPLACE FUNCTION prg_step(p_tenant text, p_id bigint, p_actor text, p_step text, p_expected int, p_note text, p_registrar boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE pr prg_programs; nxt text; t text := trim(coalesce(p_note, '')); e text; committee boolean := cur_is_committee(p_tenant, p_actor);
   BEGIN
     SELECT * INTO pr FROM prg_programs WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Program not found.'; END IF;
     IF pr.row_version <> p_expected THEN RETURN 'This program changed since you opened it. Reload.'; END IF;
     IF p_actor = pr.author_id AND p_step IN ('approve','publish','return') THEN RETURN 'You cannot review your own proposal.'; END IF;
     IF p_step = 'publish' AND p_actor = pr.committee_by THEN RETURN 'The committee member who approved this cannot also publish it.'; END IF;
     nxt := CASE
       WHEN p_step = 'approve' AND committee AND pr.state = 'submitted' THEN 'committee_approved'
       WHEN p_step = 'publish' AND p_registrar AND pr.state = 'committee_approved' THEN 'published'
       WHEN p_step = 'return' AND ((committee AND pr.state = 'submitted') OR (p_registrar AND pr.state = 'committee_approved')) THEN 'returned'
       WHEN p_step = 'withdraw' AND p_actor = pr.author_id AND pr.state IN ('submitted','committee_approved') THEN 'withdrawn'
       ELSE NULL END;
     IF nxt IS NULL THEN RETURN 'That step is not open to you now.'; END IF;
     IF p_step = 'return' AND length(t) < 10 THEN RETURN 'Say what needs to change (10+ characters).'; END IF;
     IF p_step IN ('approve','publish') THEN
       e := prg_check(p_tenant, pr.terms, pr.outcomes, pr.total_credits, pr.term_cap);
       IF e IS NOT NULL THEN RETURN 'The catalog changed: ' || e; END IF;
     END IF;
     IF p_step = 'publish' THEN
       UPDATE prg_programs SET state = 'superseded', row_version = row_version + 1, updated_at = now() WHERE tenant_id = p_tenant AND code = pr.code AND state = 'published';
     END IF;
     UPDATE prg_programs SET state = nxt, row_version = row_version + 1, updated_at = now(), note = CASE WHEN t <> '' THEN t ELSE note END,
       committee_by = CASE WHEN p_step = 'approve' THEN p_actor ELSE committee_by END, published_by = CASE WHEN p_step = 'publish' THEN p_actor ELSE published_by END WHERE id = pr.id;
     INSERT INTO prg_events (tenant_id, program_id, step, to_state, actor_id, note) VALUES (p_tenant, pr.id, p_step, nxt, p_actor, t);
     RETURN NULL;
   END $$`,
];
