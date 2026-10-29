// Migration prw-001: periodic program review (role app "Dean": program review). Builds on prg-001 (published programs and their
// department), dea-001 (dea_covers: a dean over the department; dea_is_chair) and tcp-001.
// Cycle, each step held by a different person:
//   open (a dean over the program's department) -> self_study (the department chair writes and submits) -> external_review
//   (the dean records an external reviewer who declared no conflict of interest, then the reviewer's report, findings and an
//   advisory recommendation) -> action_plan (the chair answers every finding with at least one dated action) -> plan_approved
//   (a dean, never the plan's author, approves the plan seen; actions become tracked items) -> closed (when every action is done,
//   or with a written note carrying the rest forward).
// The recommendation is advisory: nothing here changes a program's published state. Reviewers are recorded, never contacted
// from Semester. History is append-only.
export const PRW_SECTIONS = ['mission_and_outcomes', 'curriculum', 'student_success', 'faculty_and_resources'] as const;
const SECS = PRW_SECTIONS.map((s) => `'${s}'`).join(', ');

export const PRW_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS prw_reviews (id bigserial PRIMARY KEY, tenant_id text NOT NULL, program_code text NOT NULL, program_id bigint NOT NULL REFERENCES prg_programs(id),
     dept_id bigint NOT NULL REFERENCES inst_departments(id), cycle text NOT NULL CHECK (cycle ~ '^[0-9]{4}-[0-9]{2}$'), self_study_due date NOT NULL,
     state text NOT NULL DEFAULT 'self_study' CHECK (state IN ('self_study', 'external_review', 'action_plan', 'plan_submitted', 'plan_approved', 'closed', 'cancelled')),
     opened_by text NOT NULL, self_study jsonb NOT NULL DEFAULT '{}', self_study_by text, self_study_at timestamptz,
     reviewer_name text, reviewer_affiliation text, reviewer_no_conflict boolean NOT NULL DEFAULT false, report text, findings jsonb, recommendation text
       CHECK (recommendation IS NULL OR recommendation IN ('continue', 'continue_with_conditions', 'revise', 'consider_closure')), report_by text, report_at timestamptz,
     plan jsonb, plan_hash text, plan_by text, plan_decided_by text, plan_note text NOT NULL DEFAULT '', closed_by text, close_note text NOT NULL DEFAULT '',
     rev int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     CHECK (plan_decided_by IS NULL OR plan_decided_by <> plan_by),
     CHECK (report IS NULL OR (reviewer_name IS NOT NULL AND reviewer_no_conflict)))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS prw_one_open ON prw_reviews (tenant_id, program_code) WHERE state NOT IN ('closed', 'cancelled')`,
  `CREATE TABLE IF NOT EXISTS prw_actions (review_id bigint NOT NULL REFERENCES prw_reviews(id), idx int NOT NULL, action text NOT NULL, finding int NOT NULL, owner text NOT NULL, due date NOT NULL,
     done_at timestamptz, done_by text, done_note text, PRIMARY KEY (review_id, idx))`,
  `CREATE TABLE IF NOT EXISTS prw_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, review_id bigint, actor_id text NOT NULL, step text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION prw_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'prw_events_append_only') THEN
       CREATE TRIGGER prw_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON prw_events FOR EACH STATEMENT EXECUTE FUNCTION prw_refuse_change();
     END IF;
   END $$`,
  // Every finding (0-based) is answered by at least one action; every action names a real finding, an owner and a date.
  `CREATE OR REPLACE FUNCTION prw_plan_problem(p_plan jsonb, p_findings jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
   DECLARE a jsonb; nf int; i int;
   BEGIN
     IF p_plan IS NULL OR jsonb_typeof(p_plan) <> 'array' OR jsonb_array_length(p_plan) NOT BETWEEN 1 AND 40 THEN RETURN 'List 1 to 40 actions.'; END IF;
     nf := coalesce(jsonb_array_length(p_findings), 0);
     FOR a IN SELECT * FROM jsonb_array_elements(p_plan) LOOP
       IF length(trim(coalesce(a->>'action', ''))) < 10 OR length(trim(coalesce(a->>'owner', ''))) < 2 THEN RETURN 'Each action needs a description and an owner.'; END IF;
       IF coalesce(a->>'due', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN 'Each action needs a due date.'; END IF;
       IF coalesce(a->>'finding', '') !~ '^[0-9]+$' OR (a->>'finding')::int >= nf THEN RETURN 'Each action answers one of the reviewer''s findings.'; END IF;
     END LOOP;
     FOR i IN 0 .. nf - 1 LOOP
       IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_plan) x WHERE (x->>'finding')::int = i) THEN RETURN 'Finding ' || (i + 1) || ' has no action yet.'; END IF;
     END LOOP;
     RETURN NULL;
   END $$`,

  `CREATE OR REPLACE FUNCTION prw_step(p_tenant text, p_actor text, p_step text, p_id bigint, p_expected int, p_payload jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r prw_reviews; v_id bigint; prog prg_programs; s text; bad text; open_n int; i int; a jsonb;
   BEGIN
     IF p_step = 'open' THEN
       SELECT * INTO prog FROM prg_programs WHERE tenant_id = p_tenant AND code = p_payload->>'code' AND state = 'published';
       IF NOT FOUND THEN RETURN 'Only a published program is reviewed.'; END IF;
       IF NOT dea_covers(p_tenant, p_actor, prog.department_id) THEN RETURN 'Only a dean over this program''s department opens its review.'; END IF;
       IF coalesce(p_payload->>'cycle', '') !~ '^[0-9]{4}-[0-9]{2}$' THEN RETURN 'Give the review cycle like 2026-27.'; END IF;
       IF coalesce(p_payload->>'due', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR (p_payload->>'due')::date <= current_date THEN RETURN 'Set a self-study due date in the future.'; END IF;
       IF EXISTS (SELECT 1 FROM prw_reviews WHERE tenant_id = p_tenant AND program_code = prog.code AND state NOT IN ('closed', 'cancelled')) THEN RETURN 'This program already has a review in progress.'; END IF;
       INSERT INTO prw_reviews (tenant_id, program_code, program_id, dept_id, cycle, self_study_due, opened_by) VALUES (p_tenant, prog.code, prog.id, prog.department_id, p_payload->>'cycle', (p_payload->>'due')::date, p_actor) RETURNING id INTO v_id;
       INSERT INTO prw_events (tenant_id, review_id, actor_id, step) VALUES (p_tenant, v_id, p_actor, 'open');
       RETURN 'ok:' || v_id;
     END IF;
     SELECT * INTO r FROM prw_reviews WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'Review not found.'; END IF;
     IF r.rev IS DISTINCT FROM p_expected THEN RETURN 'Someone changed this review. Reload and try again.'; END IF;

     IF p_step IN ('save_self_study', 'submit_self_study') THEN
       IF NOT dea_is_chair(p_tenant, r.dept_id, p_actor) THEN RETURN 'The department chair writes the self-study.'; END IF;
       IF r.state <> 'self_study' THEN RETURN 'The self-study is already submitted.'; END IF;
       IF jsonb_typeof(coalesce(p_payload->'sections', 'null')) <> 'object' THEN RETURN 'Write the self-study sections.'; END IF;
       IF p_step = 'submit_self_study' THEN
         FOREACH s IN ARRAY ARRAY[${SECS}] LOOP
           IF length(trim(coalesce(p_payload->'sections'->>s, ''))) < 50 THEN RETURN 'Every section needs at least 50 characters before you submit (' || replace(s, '_', ' ') || ').'; END IF;
         END LOOP;
       END IF;
       UPDATE prw_reviews SET self_study = p_payload->'sections', self_study_by = p_actor,
         state = CASE WHEN p_step = 'submit_self_study' THEN 'external_review' ELSE state END, self_study_at = CASE WHEN p_step = 'submit_self_study' THEN now() ELSE self_study_at END,
         rev = rev + 1, updated_at = now() WHERE id = r.id;

     ELSIF p_step IN ('set_reviewer', 'record_report', 'approve_plan', 'return_plan', 'close', 'cancel') THEN
       IF NOT dea_covers(p_tenant, p_actor, r.dept_id) THEN RETURN 'Only a dean over this program''s department does this.'; END IF;
       IF p_step = 'set_reviewer' THEN
         IF r.state <> 'external_review' THEN RETURN 'The reviewer is set after the self-study is submitted.'; END IF;
         IF length(trim(coalesce(p_payload->>'name', ''))) < 3 OR length(trim(coalesce(p_payload->>'affiliation', ''))) < 3 THEN RETURN 'Give the reviewer''s name and affiliation.'; END IF;
         IF coalesce((p_payload->>'noConflict')::boolean, false) IS NOT TRUE THEN RETURN 'Record that the reviewer declared no conflict of interest.'; END IF;
         UPDATE prw_reviews SET reviewer_name = trim(p_payload->>'name'), reviewer_affiliation = trim(p_payload->>'affiliation'), reviewer_no_conflict = true, rev = rev + 1, updated_at = now() WHERE id = r.id;
       ELSIF p_step = 'record_report' THEN
         IF r.state <> 'external_review' THEN RETURN 'This review is not waiting for the reviewer''s report.'; END IF;
         IF r.reviewer_name IS NULL OR NOT r.reviewer_no_conflict THEN RETURN 'Record the reviewer and their conflict declaration first.'; END IF;
         IF length(trim(coalesce(p_payload->>'report', ''))) < 200 THEN RETURN 'Record the reviewer''s full report (200+ characters).'; END IF;
         IF jsonb_typeof(coalesce(p_payload->'findings', 'null')) <> 'array' OR jsonb_array_length(p_payload->'findings') NOT BETWEEN 1 AND 20 THEN RETURN 'List 1 to 20 findings from the report.'; END IF;
         IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_payload->'findings') f WHERE length(trim(f)) < 10) THEN RETURN 'Each finding needs at least 10 characters.'; END IF;
         IF coalesce(p_payload->>'recommendation', '') NOT IN ('continue', 'continue_with_conditions', 'revise', 'consider_closure') THEN RETURN 'Choose the reviewer''s recommendation.'; END IF;
         UPDATE prw_reviews SET report = trim(p_payload->>'report'), findings = p_payload->'findings', recommendation = p_payload->>'recommendation', report_by = p_actor, report_at = now(),
           state = 'action_plan', rev = rev + 1, updated_at = now() WHERE id = r.id;
       ELSIF p_step IN ('approve_plan', 'return_plan') THEN
         IF r.state <> 'plan_submitted' THEN RETURN 'No action plan is waiting for a decision.'; END IF;
         IF r.plan_by = p_actor THEN RETURN 'You wrote this plan, so another dean decides it.'; END IF;
         IF p_payload->>'seen' IS DISTINCT FROM r.plan_hash THEN RETURN 'The plan changed since you opened it. Reload and read it again.'; END IF;
         IF p_step = 'return_plan' THEN
           IF length(trim(coalesce(p_payload->>'note', ''))) < 10 THEN RETURN 'Say what the plan needs (10+ characters).'; END IF;
           UPDATE prw_reviews SET state = 'action_plan', plan_note = trim(p_payload->>'note'), rev = rev + 1, updated_at = now() WHERE id = r.id;
         ELSE
           UPDATE prw_reviews SET state = 'plan_approved', plan_decided_by = p_actor, plan_note = trim(coalesce(p_payload->>'note', '')), rev = rev + 1, updated_at = now() WHERE id = r.id;
           i := 0;
           FOR a IN SELECT * FROM jsonb_array_elements(r.plan) LOOP
             INSERT INTO prw_actions (review_id, idx, action, finding, owner, due) VALUES (r.id, i, trim(a->>'action'), (a->>'finding')::int, trim(a->>'owner'), (a->>'due')::date);
             i := i + 1;
           END LOOP;
         END IF;
       ELSIF p_step = 'close' THEN
         IF r.state <> 'plan_approved' THEN RETURN 'A review closes after its action plan is approved.'; END IF;
         SELECT count(*) INTO open_n FROM prw_actions WHERE review_id = r.id AND done_at IS NULL;
         IF open_n > 0 AND length(trim(coalesce(p_payload->>'note', ''))) < 20 THEN RETURN open_n || ' action(s) are still open. Finish them or explain how they carry forward (20+ characters).'; END IF;
         UPDATE prw_reviews SET state = 'closed', closed_by = p_actor, close_note = trim(coalesce(p_payload->>'note', '')), rev = rev + 1, updated_at = now() WHERE id = r.id;
       ELSE
         IF r.state IN ('closed', 'cancelled') THEN RETURN 'This review is already finished.'; END IF;
         IF length(trim(coalesce(p_payload->>'note', ''))) < 10 THEN RETURN 'Say why it is cancelled (10+ characters).'; END IF;
         UPDATE prw_reviews SET state = 'cancelled', closed_by = p_actor, close_note = trim(p_payload->>'note'), rev = rev + 1, updated_at = now() WHERE id = r.id;
       END IF;

     ELSIF p_step IN ('save_plan', 'submit_plan') THEN
       IF NOT dea_is_chair(p_tenant, r.dept_id, p_actor) THEN RETURN 'The department chair writes the action plan.'; END IF;
       IF r.state <> 'action_plan' THEN RETURN 'The action plan is not open for changes.'; END IF;
       IF p_step = 'submit_plan' THEN bad := prw_plan_problem(p_payload->'plan', r.findings); IF bad IS NOT NULL THEN RETURN bad; END IF; END IF;
       UPDATE prw_reviews SET plan = p_payload->'plan', plan_hash = md5(coalesce(p_payload->'plan', 'null')::text), plan_by = p_actor,
         state = CASE WHEN p_step = 'submit_plan' THEN 'plan_submitted' ELSE state END, rev = rev + 1, updated_at = now() WHERE id = r.id;

     ELSIF p_step = 'action_done' THEN
       IF NOT dea_is_chair(p_tenant, r.dept_id, p_actor) THEN RETURN 'The department chair records progress on actions.'; END IF;
       IF r.state <> 'plan_approved' THEN RETURN 'Actions are tracked once the plan is approved.'; END IF;
       IF length(trim(coalesce(p_payload->>'note', ''))) < 10 THEN RETURN 'Say what was done (10+ characters).'; END IF;
       UPDATE prw_actions SET done_at = now(), done_by = p_actor, done_note = trim(p_payload->>'note') WHERE review_id = r.id AND idx = (p_payload->>'idx')::int AND done_at IS NULL;
       IF NOT FOUND THEN RETURN 'That action is not open.'; END IF;
       UPDATE prw_reviews SET rev = rev + 1, updated_at = now() WHERE id = r.id;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO prw_events (tenant_id, review_id, actor_id, step, detail) VALUES (p_tenant, r.id, p_actor, p_step, left(coalesce(p_payload->>'note', ''), 500));
     RETURN 'ok:' || r.id;
   END $$`,
];
