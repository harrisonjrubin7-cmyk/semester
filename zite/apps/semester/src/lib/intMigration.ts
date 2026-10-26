// Migration int-001: academic integrity cases (S-60 §5; mirrors lib/integrityRules.ts).
// Enforced here: reporter is not the student; idempotent reporting; one state machine where the actor's role in the case
// (student, reporter, integrity officer) decides which steps are open; officers never decide a case they reported or are
// subject of; an appeal goes to a different officer within 14 days; every step carries its reason; append-only history.
// The endpoint checks that the reporter teaches the section and the student is enrolled in it. No grade is changed here.
export const INT_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS int_staff (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(),
     revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE OR REPLACE FUNCTION int_is_officer(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM int_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE TABLE IF NOT EXISTS int_cases (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_key text NOT NULL, section_id text NOT NULL,
     student_id text NOT NULL, reporter_id text NOT NULL, category text NOT NULL CHECK (category IN ('plagiarism','unauthorized_collaboration','unauthorized_ai','exam_misconduct','fabrication','other')),
     allegation text NOT NULL CHECK (length(allegation) BETWEEN 20 AND 4000), work_ref text NOT NULL DEFAULT '',
     state text NOT NULL DEFAULT 'reported' CHECK (state IN ('reported','responded','proposed','resolved_course','referred','decided','appealed','closed','withdrawn')),
     version int NOT NULL DEFAULT 1, student_statement text NOT NULL DEFAULT '', proposed_sanction text, proposal_note text NOT NULL DEFAULT '',
     finding text CHECK (finding IS NULL OR finding IN ('responsible','not_responsible')), sanction text, decision_note text NOT NULL DEFAULT '',
     decided_by text, decided_at timestamptz, appeal_note text NOT NULL DEFAULT '', appeal_outcome text CHECK (appeal_outcome IS NULL OR appeal_outcome IN ('upheld','overturned','modified')),
     appeal_decided_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, reporter_id, request_key), CHECK (reporter_id <> student_id),
     CHECK (sanction IS NULL OR sanction IN ('warning','redo','grade_penalty','zero_on_work','course_failure_recommended','none')),
     CHECK (proposed_sanction IS NULL OR proposed_sanction IN ('warning','redo','grade_penalty','zero_on_work','course_failure_recommended','none')))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS int_cases_one_live ON int_cases (tenant_id, section_id, student_id, work_ref) WHERE state NOT IN ('resolved_course','closed','withdrawn')`,
  `CREATE TABLE IF NOT EXISTS int_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, case_id bigint NOT NULL REFERENCES int_cases(id), step text NOT NULL,
     from_state text, to_state text NOT NULL, actor_role text NOT NULL, actor_id text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION int_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'int_events_append_only') THEN
       CREATE TRIGGER int_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON int_events FOR EACH STATEMENT EXECUTE FUNCTION int_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION int_set_officer(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own integrity-office access.'; END IF;
     IF p_on THEN
       INSERT INTO int_staff (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin)
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE
       UPDATE int_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL;
     END IF;
     RETURN NULL;
   END $$`,
  // Returns 'ok:<id>', 'replay:<id>' or a refusal.
  `CREATE OR REPLACE FUNCTION int_report(p_tenant text, p_key text, p_reporter text, p_section text, p_student text, p_category text, p_allegation text, p_work text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c int_cases; nid bigint;
   BEGIN
     IF p_reporter = p_student THEN RETURN 'You cannot report yourself.'; END IF;
     IF length(trim(coalesce(p_allegation, ''))) < 20 THEN RETURN 'Describe the concern (20+ characters).'; END IF;
     PERFORM pg_advisory_xact_lock(hashtext('int:' || p_tenant || ':' || p_reporter || ':' || p_key));
     SELECT * INTO c FROM int_cases WHERE tenant_id = p_tenant AND reporter_id = p_reporter AND request_key = p_key;
     IF FOUND THEN
       IF c.student_id = p_student AND c.section_id = p_section AND c.category = p_category AND c.allegation = trim(p_allegation) AND c.work_ref = coalesce(p_work, '') THEN RETURN 'replay:' || c.id; END IF;
       RETURN 'This report was already sent with different details. Start a new report.';
     END IF;
     IF EXISTS (SELECT 1 FROM int_cases WHERE tenant_id = p_tenant AND section_id = p_section AND student_id = p_student AND work_ref = coalesce(p_work, '') AND state NOT IN ('resolved_course','closed','withdrawn'))
       THEN RETURN 'An open case already covers this student and this work.'; END IF;
     INSERT INTO int_cases (tenant_id, request_key, section_id, student_id, reporter_id, category, allegation, work_ref)
       VALUES (p_tenant, p_key, p_section, p_student, p_reporter, p_category, trim(p_allegation), coalesce(p_work, '')) RETURNING id INTO nid;
     INSERT INTO int_events (tenant_id, case_id, step, from_state, to_state, actor_role, actor_id) VALUES (p_tenant, nid, 'report', NULL, 'reported', 'reporter', p_reporter);
     RETURN 'ok:' || nid;
   END $$`,
  // p_choice: propose -> sanction; decide -> 'responsible:<sanction>' | 'not_responsible'; decide_appeal -> 'upheld' | 'overturned' | 'modified:<sanction>'.
  `CREATE OR REPLACE FUNCTION int_step(p_tenant text, p_id bigint, p_actor text, p_step text, p_expected int, p_text text, p_choice text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c int_cases; role text; nxt text; need int; t text := trim(coalesce(p_text, '')); sanc text; fnd text;
   BEGIN
     SELECT * INTO c FROM int_cases WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Case not found.'; END IF;
     role := CASE WHEN p_actor = c.student_id THEN 'student' WHEN p_actor = c.reporter_id THEN 'reporter' WHEN int_is_officer(p_tenant, p_actor) THEN 'officer' ELSE NULL END;
     IF role IS NULL THEN RETURN 'You are not part of this case.'; END IF;
     IF c.version <> p_expected THEN RETURN 'This case changed since you opened it. Reload.'; END IF;
     nxt := CASE
       WHEN p_step = 'respond' AND role = 'student' AND c.state = 'reported' THEN 'responded'
       WHEN p_step = 'propose' AND role = 'reporter' AND c.state IN ('reported','responded') THEN 'proposed'
       WHEN p_step = 'accept' AND role = 'student' AND c.state = 'proposed' THEN 'resolved_course'
       WHEN p_step = 'decline' AND role = 'student' AND c.state = 'proposed' THEN 'referred'
       WHEN p_step = 'refer' AND role = 'reporter' AND c.state IN ('reported','responded') THEN 'referred'
       WHEN p_step = 'decide' AND role = 'officer' AND c.state = 'referred' THEN 'decided'
       WHEN p_step = 'appeal' AND role = 'student' AND c.state = 'decided' THEN 'appealed'
       WHEN p_step = 'decide_appeal' AND role = 'officer' AND c.state = 'appealed' THEN 'closed'
       WHEN p_step = 'withdraw' AND role = 'reporter' AND c.state IN ('reported','responded','proposed') THEN 'withdrawn'
       WHEN p_step = 'close' AND role = 'officer' AND c.state = 'decided' THEN 'closed'
       ELSE NULL END;
     IF nxt IS NULL THEN RETURN 'That step is not open to you while the case is ' || replace(c.state, '_', ' ') || '.'; END IF;
     need := CASE p_step WHEN 'respond' THEN 10 WHEN 'propose' THEN 10 WHEN 'refer' THEN 10 WHEN 'withdraw' THEN 10 WHEN 'decide' THEN 20 WHEN 'appeal' THEN 20 WHEN 'decide_appeal' THEN 20 ELSE 0 END;
     IF length(t) < need THEN RETURN 'Add a reason of at least ' || need || ' characters.'; END IF;
     IF p_step = 'propose' THEN
       IF p_choice NOT IN ('warning','redo','grade_penalty','zero_on_work','none') THEN RETURN 'Choose a course-level resolution.'; END IF;
       UPDATE int_cases SET proposed_sanction = p_choice, proposal_note = t WHERE id = c.id;
     ELSIF p_step = 'respond' THEN
       UPDATE int_cases SET student_statement = t WHERE id = c.id;
     ELSIF p_step = 'decide' THEN
       IF p_actor = c.reporter_id OR p_actor = c.student_id THEN RETURN 'Another officer must decide this case.'; END IF;
       fnd := split_part(p_choice, ':', 1); sanc := nullif(split_part(p_choice, ':', 2), '');
       IF fnd = 'not_responsible' THEN sanc := 'none';
       ELSIF fnd <> 'responsible' OR sanc IS NULL OR sanc NOT IN ('warning','redo','grade_penalty','zero_on_work','course_failure_recommended') THEN RETURN 'Record a finding and, if responsible, a sanction.'; END IF;
       UPDATE int_cases SET finding = fnd, sanction = sanc, decision_note = t, decided_by = p_actor, decided_at = now() WHERE id = c.id;
     ELSIF p_step = 'appeal' THEN
       IF c.decided_at < now() - interval '14 days' THEN RETURN 'The 14-day appeal window has closed.'; END IF;
       UPDATE int_cases SET appeal_note = t WHERE id = c.id;
     ELSIF p_step = 'decide_appeal' THEN
       IF p_actor = c.decided_by THEN RETURN 'An appeal must be decided by a different officer.'; END IF;
       IF p_actor = c.reporter_id OR p_actor = c.student_id THEN RETURN 'Another officer must decide this appeal.'; END IF;
       IF p_choice = 'upheld' THEN UPDATE int_cases SET appeal_outcome = 'upheld', appeal_decided_by = p_actor WHERE id = c.id;
       ELSIF p_choice = 'overturned' THEN UPDATE int_cases SET appeal_outcome = 'overturned', finding = 'not_responsible', sanction = 'none', appeal_decided_by = p_actor WHERE id = c.id;
       ELSIF split_part(p_choice, ':', 1) = 'modified' AND split_part(p_choice, ':', 2) IN ('warning','redo','grade_penalty','zero_on_work') THEN
         UPDATE int_cases SET appeal_outcome = 'modified', sanction = split_part(p_choice, ':', 2), appeal_decided_by = p_actor WHERE id = c.id;
       ELSE RETURN 'Uphold, overturn, or modify to a lesser sanction.'; END IF;
     END IF;
     UPDATE int_cases SET state = nxt, version = version + 1, updated_at = now() WHERE id = c.id;
     INSERT INTO int_events (tenant_id, case_id, step, from_state, to_state, actor_role, actor_id, note) VALUES (p_tenant, c.id, p_step, c.state, nxt, role, p_actor, left(t, 2000));
     RETURN NULL;
   END $$`,
];
