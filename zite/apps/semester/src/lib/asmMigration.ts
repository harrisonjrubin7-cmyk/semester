// Migration asm-001: Course Studio assessments. A published question set is frozen as an append-only version; attempts
// pin the version they started on. One open attempt per student; attempts limited; the window and time limit are
// enforced at start and submit. Scores are set by submit (automatic part) and by a grader who is not the student;
// students see a score only after release. The endpoint decides who teaches or is enrolled (Zite section data).
export const ASM_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS asm_assessments (id bigserial PRIMARY KEY, tenant_id text NOT NULL, section_id text NOT NULL,
     title text NOT NULL CHECK (length(title) BETWEEN 3 AND 200), state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','published','closed')),
     opens_at timestamptz NOT NULL, closes_at timestamptz NOT NULL, time_limit_min int CHECK (time_limit_min IS NULL OR time_limit_min BETWEEN 1 AND 600),
     attempts_allowed int NOT NULL DEFAULT 1 CHECK (attempts_allowed BETWEEN 1 AND 10), created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (closes_at > opens_at))`,
  `CREATE TABLE IF NOT EXISTS asm_versions (assessment_id bigint NOT NULL REFERENCES asm_assessments(id), version int NOT NULL,
     questions jsonb NOT NULL, total_points numeric NOT NULL CHECK (total_points > 0), published_by text NOT NULL,
     published_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY (assessment_id, version))`,
  `CREATE OR REPLACE FUNCTION asm_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'asm_versions_append_only') THEN
       CREATE TRIGGER asm_versions_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON asm_versions FOR EACH STATEMENT EXECUTE FUNCTION asm_refuse_change();
     END IF;
   END $$`,
  `CREATE TABLE IF NOT EXISTS asm_attempts (id bigserial PRIMARY KEY, tenant_id text NOT NULL, assessment_id bigint NOT NULL REFERENCES asm_assessments(id),
     version int NOT NULL, student_id text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), submitted_at timestamptz,
     answers jsonb NOT NULL DEFAULT '{}'::jsonb, auto_score numeric, manual_score numeric, feedback text NOT NULL DEFAULT '',
     state text NOT NULL DEFAULT 'in_progress' CHECK (state IN ('in_progress','submitted','graded','released')),
     graded_by text, released_at timestamptz, late boolean NOT NULL DEFAULT false,
     CHECK (graded_by IS NULL OR graded_by <> student_id), CHECK ((state = 'in_progress') = (submitted_at IS NULL)),
     FOREIGN KEY (assessment_id, version) REFERENCES asm_versions (assessment_id, version))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS asm_one_open_attempt ON asm_attempts (assessment_id, student_id) WHERE state = 'in_progress'`,
  `CREATE OR REPLACE FUNCTION asm_publish(p_tenant text, p_id bigint, p_actor text, p_questions jsonb, p_total numeric, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v int; a asm_assessments%ROWTYPE;
   BEGIN
     SELECT * INTO a FROM asm_assessments WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Assessment not found.'; END IF;
     IF a.state = 'closed' THEN RETURN 'This assessment is closed.'; END IF;
     SELECT coalesce(max(version), 0) INTO v FROM asm_versions WHERE assessment_id = p_id;
     IF v <> p_expected THEN RETURN 'Someone published a newer version since you opened it. Reload.'; END IF;
     IF v > 0 AND EXISTS (SELECT 1 FROM asm_attempts WHERE assessment_id = p_id AND state <> 'in_progress') THEN
       RETURN 'Students have already submitted; publish a new assessment instead of changing this one.';
     END IF;
     INSERT INTO asm_versions (assessment_id, version, questions, total_points, published_by) VALUES (p_id, v + 1, p_questions, p_total, p_actor);
     UPDATE asm_assessments SET state = 'published' WHERE id = p_id;
     RETURN NULL;
   END $$`,
  // Returns {attemptId, version} or {error}. Reuses an open attempt instead of starting a second one.
  `CREATE OR REPLACE FUNCTION asm_start(p_tenant text, p_id bigint, p_student text) RETURNS jsonb LANGUAGE plpgsql AS $$
   DECLARE a asm_assessments%ROWTYPE; v int; used int; att bigint;
   BEGIN
     SELECT * INTO a FROM asm_assessments WHERE id = p_id AND tenant_id = p_tenant;
     IF NOT FOUND OR a.state <> 'published' THEN RETURN jsonb_build_object('error', 'This assessment is not open.'); END IF;
     PERFORM pg_advisory_xact_lock(hashtext('asm:' || p_id || ':' || p_student));
     SELECT id, version INTO att, v FROM asm_attempts WHERE assessment_id = p_id AND student_id = p_student AND state = 'in_progress';
     IF FOUND THEN RETURN jsonb_build_object('attemptId', att, 'version', v); END IF;
     IF now() < a.opens_at OR now() >= a.closes_at THEN RETURN jsonb_build_object('error', 'This assessment is not open right now.'); END IF;
     SELECT count(*) INTO used FROM asm_attempts WHERE assessment_id = p_id AND student_id = p_student;
     IF used >= a.attempts_allowed THEN RETURN jsonb_build_object('error', 'You have used all your attempts.'); END IF;
     SELECT max(version) INTO v FROM asm_versions WHERE assessment_id = p_id;
     INSERT INTO asm_attempts (tenant_id, assessment_id, version, student_id) VALUES (p_tenant, p_id, v, p_student) RETURNING id INTO att;
     RETURN jsonb_build_object('attemptId', att, 'version', v);
   END $$`,
  // The caller scores the answers against the attempt's frozen version (lib/assessRules) and passes the result in.
  // Late submissions (after close or the time limit, with a 2-minute grace) are accepted but marked late.
  `CREATE OR REPLACE FUNCTION asm_submit(p_tenant text, p_attempt bigint, p_student text, p_answers jsonb, p_auto numeric, p_needs_manual boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE t asm_attempts%ROWTYPE; a asm_assessments%ROWTYPE; is_late boolean;
   BEGIN
     SELECT * INTO t FROM asm_attempts WHERE id = p_attempt AND tenant_id = p_tenant AND student_id = p_student FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Attempt not found.'; END IF;
     IF t.state <> 'in_progress' THEN RETURN 'This attempt was already submitted.'; END IF;
     SELECT * INTO a FROM asm_assessments WHERE id = t.assessment_id;
     is_late := now() > a.closes_at + interval '2 minutes'
       OR (a.time_limit_min IS NOT NULL AND now() > t.started_at + make_interval(mins => a.time_limit_min) + interval '2 minutes');
     UPDATE asm_attempts SET answers = p_answers, auto_score = p_auto, submitted_at = now(), late = is_late,
       state = CASE WHEN p_needs_manual THEN 'submitted' ELSE 'graded' END WHERE id = p_attempt;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION asm_grade(p_tenant text, p_attempt bigint, p_grader text, p_manual numeric, p_feedback text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE t asm_attempts%ROWTYPE; total numeric;
   BEGIN
     SELECT * INTO t FROM asm_attempts WHERE id = p_attempt AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Attempt not found.'; END IF;
     IF t.student_id = p_grader THEN RETURN 'You cannot grade your own attempt.'; END IF;
     IF t.state NOT IN ('submitted','graded') THEN RETURN 'Only submitted, unreleased attempts can be graded.'; END IF;
     SELECT total_points INTO total FROM asm_versions WHERE assessment_id = t.assessment_id AND version = t.version;
     IF p_manual < 0 OR coalesce(t.auto_score, 0) + p_manual > total THEN RETURN 'The score would be outside 0 and the total points.'; END IF;
     UPDATE asm_attempts SET manual_score = p_manual, feedback = trim(coalesce(p_feedback, '')), graded_by = p_grader, state = 'graded' WHERE id = p_attempt;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION asm_release(p_tenant text, p_id bigint) RETURNS int LANGUAGE plpgsql AS $$
   DECLARE n int;
   BEGIN
     UPDATE asm_attempts SET state = 'released', released_at = now() WHERE assessment_id = p_id AND tenant_id = p_tenant AND state = 'graded';
     GET DIAGNOSTICS n = ROW_COUNT;
     RETURN n;
   END $$`,
  // asm-002: extended time. The attempt stores the extra minutes decided at start from an approved accommodation the
  // student sent to this section (acc_time_multiplier, if the accommodations tables exist). Instructors see only that time
  // was extended, never the request. Lateness and the start window use the extended figures.
  `ALTER TABLE asm_attempts ADD COLUMN IF NOT EXISTS extra_min int NOT NULL DEFAULT 0 CHECK (extra_min BETWEEN 0 AND 1200)`,
  `CREATE OR REPLACE FUNCTION asm_start(p_tenant text, p_id bigint, p_student text) RETURNS jsonb LANGUAGE plpgsql AS $$
   DECLARE a asm_assessments%ROWTYPE; v int; used int; att bigint; ex int; mult numeric := 1;
   BEGIN
     SELECT * INTO a FROM asm_assessments WHERE id = p_id AND tenant_id = p_tenant;
     IF NOT FOUND OR a.state <> 'published' THEN RETURN jsonb_build_object('error', 'This assessment is not open.'); END IF;
     PERFORM pg_advisory_xact_lock(hashtext('asm:' || p_id || ':' || p_student));
     SELECT id, version, extra_min INTO att, v, ex FROM asm_attempts WHERE assessment_id = p_id AND student_id = p_student AND state = 'in_progress';
     IF FOUND THEN RETURN jsonb_build_object('attemptId', att, 'version', v, 'limitMin', a.time_limit_min, 'extraMin', ex); END IF;
     IF now() < a.opens_at OR now() >= a.closes_at THEN RETURN jsonb_build_object('error', 'This assessment is not open right now.'); END IF;
     SELECT count(*) INTO used FROM asm_attempts WHERE assessment_id = p_id AND student_id = p_student;
     IF used >= a.attempts_allowed THEN RETURN jsonb_build_object('error', 'You have used all your attempts.'); END IF;
     IF a.time_limit_min IS NOT NULL AND to_regprocedure('acc_time_multiplier(text,text,text)') IS NOT NULL THEN
       mult := acc_time_multiplier(p_tenant, p_student, a.section_id);
     END IF;
     ex := CASE WHEN a.time_limit_min IS NULL OR mult <= 1 THEN 0 ELSE ceil(a.time_limit_min * (mult - 1))::int END;
     SELECT max(version) INTO v FROM asm_versions WHERE assessment_id = p_id;
     INSERT INTO asm_attempts (tenant_id, assessment_id, version, student_id, extra_min) VALUES (p_tenant, p_id, v, p_student, ex) RETURNING id INTO att;
     RETURN jsonb_build_object('attemptId', att, 'version', v, 'limitMin', a.time_limit_min, 'extraMin', ex);
   END $$`,
  `CREATE OR REPLACE FUNCTION asm_submit(p_tenant text, p_attempt bigint, p_student text, p_answers jsonb, p_auto numeric, p_needs_manual boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE t asm_attempts%ROWTYPE; a asm_assessments%ROWTYPE; is_late boolean;
   BEGIN
     SELECT * INTO t FROM asm_attempts WHERE id = p_attempt AND tenant_id = p_tenant AND student_id = p_student FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Attempt not found.'; END IF;
     IF t.state <> 'in_progress' THEN RETURN 'This attempt was already submitted.'; END IF;
     SELECT * INTO a FROM asm_assessments WHERE id = t.assessment_id;
     is_late := now() > a.closes_at + make_interval(mins => t.extra_min) + interval '2 minutes'
       OR (a.time_limit_min IS NOT NULL AND now() > t.started_at + make_interval(mins => a.time_limit_min + t.extra_min) + interval '2 minutes');
     UPDATE asm_attempts SET answers = p_answers, auto_score = p_auto, submitted_at = now(), late = is_late,
       state = CASE WHEN p_needs_manual THEN 'submitted' ELSE 'graded' END WHERE id = p_attempt;
     RETURN NULL;
   END $$`,
];
