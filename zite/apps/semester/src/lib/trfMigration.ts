// Migration trf-001: transfer credit (Transfer Student + Registrar + Transfer Partner Admin apps).
// Blueprint: submit prior coursework → identify candidate equivalencies → receive evaluation → appeal if needed → apply
// approved credits to a plan. Rules:
// - Articulation rules (external institution + course → internal course, elective or no credit) follow the two-person rule:
//   one registrar proposes, a different registrar approves. Students see only approved rules, as "published, provisional".
// - A student lists prior courses (no transcript files: private storage is off). A registrar evaluator decides each line;
//   the student's own suggestion never becomes credit. The student may appeal a decided request once, and a different
//   evaluator reviews the appeal. Decisions are recorded here; posting credit to the official transcript is a separate,
//   activated step and is not done.
// One function call = one transaction; events append-only; tenant always from the caller's membership.
export const TRF_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS trf_rules (id bigserial PRIMARY KEY, tenant_id text NOT NULL, ext_institution text NOT NULL, ext_course text NOT NULL,
     outcome text NOT NULL CHECK (outcome IN ('equivalent', 'elective', 'no_credit')), internal_code text, credits numeric CHECK (credits IS NULL OR (credits > 0 AND credits <= 12)),
     effective_term text NOT NULL, state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed', 'approved', 'rejected', 'superseded')),
     proposed_by text NOT NULL, decided_by text, decided_at timestamptz, decision_note text, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (decided_by IS NULL OR decided_by <> proposed_by), CHECK (outcome <> 'equivalent' OR internal_code IS NOT NULL))`,
  `CREATE TABLE IF NOT EXISTS trf_requests (id text PRIMARY KEY, number serial, tenant_id text NOT NULL, student_id text NOT NULL, ext_institution text NOT NULL,
     state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted', 'decided', 'appealed', 'final', 'withdrawn')),
     evaluator_id text, appeal_text text, appeal_reviewer text, appeal_note text, version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (evaluator_id IS NULL OR evaluator_id <> student_id), CHECK (appeal_reviewer IS NULL OR (appeal_reviewer <> evaluator_id AND appeal_reviewer <> student_id)))`,
  `CREATE TABLE IF NOT EXISTS trf_lines (request_id text NOT NULL REFERENCES trf_requests(id), line int NOT NULL, ext_course text NOT NULL, ext_title text NOT NULL,
     ext_credits numeric NOT NULL CHECK (ext_credits > 0 AND ext_credits <= 12), grade text NOT NULL, student_suggestion text,
     outcome text CHECK (outcome IN ('equivalent', 'elective', 'no_credit')), internal_code text, awarded_credits numeric, reason text, PRIMARY KEY (request_id, line))`,
  `CREATE TABLE IF NOT EXISTS trf_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, ref text NOT NULL, actor_id text NOT NULL, action text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION trf_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS trf_events_append_only ON trf_events`,
  `CREATE TRIGGER trf_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON trf_events FOR EACH STATEMENT EXECUTE FUNCTION trf_refuse_change()`,
  `CREATE OR REPLACE FUNCTION trf_norm(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT upper(regexp_replace(trim(coalesce(t, '')), '\\s+', ' ', 'g')) $$`,
  `CREATE OR REPLACE FUNCTION trf_propose_rule(p_actor text, p_tenant text, p_inst text, p_course text, p_outcome text, p_code text, p_credits numeric, p_term text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF length(trim(coalesce(p_inst, ''))) < 3 OR length(trim(coalesce(p_course, ''))) < 3 THEN RETURN 'Name the other institution and its course.'; END IF;
     IF p_outcome = 'equivalent' AND length(trim(coalesce(p_code, ''))) < 4 THEN RETURN 'Say which of our courses it is equivalent to.'; END IF;
     IF EXISTS (SELECT 1 FROM trf_rules WHERE tenant_id = p_tenant AND trf_norm(ext_institution) = trf_norm(p_inst) AND trf_norm(ext_course) = trf_norm(p_course) AND state = 'proposed') THEN
       RETURN 'A rule for this course is already waiting for approval.'; END IF;
     INSERT INTO trf_rules (tenant_id, ext_institution, ext_course, outcome, internal_code, credits, effective_term, proposed_by)
       VALUES (p_tenant, trim(p_inst), trf_norm(p_course), p_outcome, CASE WHEN p_outcome = 'equivalent' THEN trf_norm(p_code) END, p_credits, trim(p_term), p_actor);
     INSERT INTO trf_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, trim(p_inst) || ' ' || trf_norm(p_course), p_actor, 'rule_proposed');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION trf_decide_rule(p_actor text, p_tenant text, p_id bigint, p_approve boolean, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r trf_rules%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM trf_rules WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Rule not found.'; END IF;
     IF r.state <> 'proposed' THEN RETURN 'Already decided.'; END IF;
     IF r.proposed_by = p_actor THEN RETURN 'A different registrar must approve your rule.'; END IF;
     IF NOT p_approve AND length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say why it is rejected.'; END IF;
     IF p_approve THEN UPDATE trf_rules SET state = 'superseded' WHERE tenant_id = p_tenant AND trf_norm(ext_institution) = trf_norm(r.ext_institution) AND ext_course = r.ext_course AND state = 'approved'; END IF;
     UPDATE trf_rules SET state = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, decided_by = p_actor, decided_at = now(), decision_note = trim(coalesce(p_note, '')) WHERE id = p_id;
     INSERT INTO trf_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, 'rule ' || p_id, p_actor, CASE WHEN p_approve THEN 'rule_approved' ELSE 'rule_rejected' END);
     RETURN NULL;
   END $$`,
  // p_lines: [{course, title, credits, grade, suggestion}]
  `CREATE OR REPLACE FUNCTION trf_submit(p_student text, p_tenant text, p_id text, p_inst text, p_lines jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE l jsonb; n int := 0;
   BEGIN
     IF EXISTS (SELECT 1 FROM trf_requests WHERE id = p_id) THEN RETURN NULL; END IF;
     IF length(trim(coalesce(p_inst, ''))) < 3 THEN RETURN 'Name the institution you took the courses at.'; END IF;
     IF jsonb_array_length(coalesce(p_lines, '[]')) = 0 OR jsonb_array_length(p_lines) > 30 THEN RETURN 'List between 1 and 30 courses.'; END IF;
     INSERT INTO trf_requests (id, tenant_id, student_id, ext_institution) VALUES (p_id, p_tenant, p_student, trim(p_inst));
     FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
       n := n + 1;
       IF length(trim(coalesce(l->>'course', ''))) < 3 OR coalesce((l->>'credits')::numeric, 0) <= 0 THEN RAISE EXCEPTION 'TRF_BAD_LINE'; END IF;
       INSERT INTO trf_lines (request_id, line, ext_course, ext_title, ext_credits, grade, student_suggestion)
         VALUES (p_id, n, trf_norm(l->>'course'), trim(coalesce(l->>'title', '')), (l->>'credits')::numeric, trim(coalesce(l->>'grade', '')), nullif(trf_norm(l->>'suggestion'), ''));
     END LOOP;
     INSERT INTO trf_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, p_id, p_student, 'submitted');
     RETURN NULL;
   EXCEPTION WHEN raise_exception THEN
     IF SQLERRM = 'TRF_BAD_LINE' THEN RETURN 'Each course needs a code and credits.'; END IF; RAISE;
   END $$`,
  // p_decisions: [{line, outcome, code, credits, reason}]. Evaluator decides every line; the evaluator is never the student.
  `CREATE OR REPLACE FUNCTION trf_evaluate(p_actor text, p_tenant text, p_id text, p_version int, p_decisions jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r trf_requests%ROWTYPE; d jsonb; v_total int; v_done int;
   BEGIN
     SELECT * INTO r FROM trf_requests WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'Request not found.'; END IF;
     IF r.student_id = p_actor THEN RETURN 'You cannot evaluate your own transfer credit.'; END IF;
     IF r.version <> p_version THEN RETURN 'This request changed since you opened it. Reload.'; END IF;
     IF r.state <> 'submitted' THEN RETURN 'This request is not waiting for evaluation.'; END IF;
     FOR d IN SELECT * FROM jsonb_array_elements(coalesce(p_decisions, '[]')) LOOP
       IF (d->>'outcome') NOT IN ('equivalent', 'elective', 'no_credit') THEN RETURN 'Choose an outcome for every course.'; END IF;
       IF d->>'outcome' = 'equivalent' AND length(trim(coalesce(d->>'code', ''))) < 4 THEN RETURN 'Name our equivalent course.'; END IF;
       IF length(trim(coalesce(d->>'reason', ''))) < 5 THEN RETURN 'Give a short reason for each decision.'; END IF;
       UPDATE trf_lines SET outcome = d->>'outcome', internal_code = CASE WHEN d->>'outcome' = 'equivalent' THEN trf_norm(d->>'code') END,
         awarded_credits = CASE WHEN d->>'outcome' = 'no_credit' THEN 0 ELSE coalesce((d->>'credits')::numeric, ext_credits) END, reason = trim(d->>'reason')
         WHERE request_id = p_id AND line = (d->>'line')::int;
     END LOOP;
     SELECT count(*), count(outcome) INTO v_total, v_done FROM trf_lines WHERE request_id = p_id;
     IF v_done < v_total THEN RAISE EXCEPTION 'TRF_INCOMPLETE'; END IF;
     UPDATE trf_requests SET state = 'decided', evaluator_id = p_actor, version = version + 1 WHERE id = p_id;
     INSERT INTO trf_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, p_id, p_actor, 'evaluated');
     RETURN NULL;
   EXCEPTION WHEN raise_exception THEN
     IF SQLERRM = 'TRF_INCOMPLETE' THEN RETURN 'Decide every course before finishing.'; END IF; RAISE;
   END $$`,
  `CREATE OR REPLACE FUNCTION trf_appeal(p_student text, p_tenant text, p_id text, p_text text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r trf_requests%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM trf_requests WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant OR r.student_id <> p_student THEN RETURN 'Request not found.'; END IF;
     IF r.state <> 'decided' THEN RETURN 'Only a decided evaluation can be appealed, and only once.'; END IF;
     IF length(trim(coalesce(p_text, ''))) < 20 THEN RETURN 'Explain what should change and why (20+ characters).'; END IF;
     UPDATE trf_requests SET state = 'appealed', appeal_text = trim(p_text), version = version + 1 WHERE id = p_id;
     INSERT INTO trf_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, p_id, p_student, 'appealed');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION trf_review_appeal(p_actor text, p_tenant text, p_id text, p_version int, p_decisions jsonb, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r trf_requests%ROWTYPE; d jsonb;
   BEGIN
     SELECT * INTO r FROM trf_requests WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'Request not found.'; END IF;
     IF r.state <> 'appealed' OR r.version <> p_version THEN RETURN 'This appeal is not open. Reload.'; END IF;
     IF p_actor = r.evaluator_id OR p_actor = r.student_id THEN RETURN 'A different evaluator reviews the appeal.'; END IF;
     IF length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Explain the appeal outcome to the student (10+ characters).'; END IF;
     FOR d IN SELECT * FROM jsonb_array_elements(coalesce(p_decisions, '[]')) LOOP
       IF (d->>'outcome') NOT IN ('equivalent', 'elective', 'no_credit') THEN RETURN 'Invalid outcome.'; END IF;
       UPDATE trf_lines SET outcome = d->>'outcome', internal_code = CASE WHEN d->>'outcome' = 'equivalent' THEN trf_norm(d->>'code') END,
         awarded_credits = CASE WHEN d->>'outcome' = 'no_credit' THEN 0 ELSE coalesce((d->>'credits')::numeric, ext_credits) END, reason = coalesce(nullif(trim(d->>'reason'), ''), reason)
         WHERE request_id = p_id AND line = (d->>'line')::int;
     END LOOP;
     UPDATE trf_requests SET state = 'final', appeal_reviewer = p_actor, appeal_note = trim(p_note), version = version + 1 WHERE id = p_id;
     INSERT INTO trf_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, p_id, p_actor, 'appeal_reviewed');
     RETURN NULL;
   END $$`,
  // Partner-proposed rules (S-76 E30 wiring, 27 Oct): which partner organization proposed it. A registrar still decides.
  `ALTER TABLE trf_rules ADD COLUMN IF NOT EXISTS partner_org_id bigint`,
];
