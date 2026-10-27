// Migration car-001: career services (Career Coach and Career Center Staff role apps).
// Roles (coach, center staff) are granted by an administrator, never self. A coach sees a student's plan, resumes and portfolio
// notes only while the student shares them with that coach (expiring share). Resume feedback is attached to a specific resume
// version. Mock interviews are booked with a coach and scored on a fixed rubric. Follow-up actions are assigned by a coach to a
// shared student; the student completes them and the coach confirms. Career fairs are run by center staff: students register up
// to capacity and staff other than the student check them in. Outcomes are self-reported by the student and verified by center
// staff other than the student; outcome reports show only groups of five or more. Append-only history.
export const CAR_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS car_staff (tenant_id text NOT NULL, user_id text NOT NULL, role text NOT NULL CHECK (role IN ('coach','center')), granted_by text NOT NULL,
     granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id, role), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS car_plans (tenant_id text NOT NULL, student_id text NOT NULL, goal text NOT NULL DEFAULT '' CHECK (length(goal) <= 1000), target_roles text NOT NULL DEFAULT '' CHECK (length(target_roles) <= 1000),
     steps text NOT NULL DEFAULT '' CHECK (length(steps) <= 4000), version int NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, student_id))`,
  `CREATE TABLE IF NOT EXISTS car_shares (tenant_id text NOT NULL, student_id text NOT NULL, coach_id text NOT NULL, expires_on date NOT NULL, revoked_at timestamptz,
     created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, student_id, coach_id), CHECK (student_id <> coach_id))`,
  `CREATE TABLE IF NOT EXISTS car_resumes (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, label text NOT NULL CHECK (length(trim(label)) BETWEEN 2 AND 80),
     body text NOT NULL CHECK (length(trim(body)) BETWEEN 50 AND 20000), version int NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, student_id, label, version))`,
  `CREATE TABLE IF NOT EXISTS car_feedback (id bigserial PRIMARY KEY, resume_id bigint NOT NULL REFERENCES car_resumes(id), coach_id text NOT NULL, section text NOT NULL CHECK (length(trim(section)) BETWEEN 2 AND 80),
     comment text NOT NULL CHECK (length(trim(comment)) BETWEEN 5 AND 2000), at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE TABLE IF NOT EXISTS car_interviews (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, coach_id text NOT NULL, starts_at timestamptz NOT NULL,
     focus text NOT NULL CHECK (length(trim(focus)) BETWEEN 3 AND 200), state text NOT NULL DEFAULT 'booked' CHECK (state IN ('booked','scored','cancelled','no_show')),
     structure int CHECK (structure BETWEEN 1 AND 5), evidence int CHECK (evidence BETWEEN 1 AND 5), communication int CHECK (communication BETWEEN 1 AND 5), notes text NOT NULL DEFAULT '',
     CHECK (student_id <> coach_id), CHECK (state <> 'scored' OR (structure IS NOT NULL AND evidence IS NOT NULL AND communication IS NOT NULL AND length(trim(notes)) >= 10)))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS car_interviews_coach_slot ON car_interviews (coach_id, starts_at) WHERE state = 'booked'`,
  `CREATE TABLE IF NOT EXISTS car_actions (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, coach_id text NOT NULL, title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200),
     due date, state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','done','confirmed','dropped')), student_note text NOT NULL DEFAULT '', CHECK (student_id <> coach_id))`,
  `CREATE TABLE IF NOT EXISTS car_fairs (id bigserial PRIMARY KEY, tenant_id text NOT NULL, title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 120), starts_at timestamptz NOT NULL,
     location text NOT NULL DEFAULT '', employers text NOT NULL DEFAULT '' CHECK (length(employers) <= 4000), capacity int NOT NULL CHECK (capacity > 0), created_by text NOT NULL, cancelled boolean NOT NULL DEFAULT false)`,
  `CREATE TABLE IF NOT EXISTS car_fair_regs (fair_id bigint NOT NULL REFERENCES car_fairs(id), student_id text NOT NULL, checked_in_by text, PRIMARY KEY (fair_id, student_id),
     CHECK (checked_in_by IS NULL OR checked_in_by <> student_id))`,
  `CREATE TABLE IF NOT EXISTS car_outcomes (tenant_id text NOT NULL, student_id text NOT NULL, cohort text NOT NULL CHECK (length(trim(cohort)) BETWEEN 2 AND 40),
     kind text NOT NULL CHECK (kind IN ('employed','grad_school','service','military','seeking','not_seeking')), organization text NOT NULL DEFAULT '' CHECK (length(organization) <= 200),
     verified_by text, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, student_id, cohort), CHECK (verified_by IS NULL OR verified_by <> student_id))`,
  `CREATE TABLE IF NOT EXISTS car_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL, ref text, step text NOT NULL, actor_id text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION car_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'car_events_append_only') THEN
       CREATE TRIGGER car_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON car_events FOR EACH STATEMENT EXECUTE FUNCTION car_refuse_change(); END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'car_feedback_append_only') THEN
       CREATE TRIGGER car_feedback_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON car_feedback FOR EACH STATEMENT EXECUTE FUNCTION car_refuse_change(); END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'car_resumes_append_only') THEN
       CREATE TRIGGER car_resumes_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON car_resumes FOR EACH STATEMENT EXECUTE FUNCTION car_refuse_change(); END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION car_has(p_tenant text, p_user text, p_role text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM car_staff WHERE tenant_id = p_tenant AND user_id = p_user AND role = p_role AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION car_shared(p_tenant text, p_student text, p_coach text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT car_has(p_tenant, p_coach, 'coach') AND EXISTS (SELECT 1 FROM car_shares WHERE tenant_id = p_tenant AND student_id = p_student AND coach_id = p_coach
       AND revoked_at IS NULL AND expires_on >= current_date) $$`,
  `CREATE OR REPLACE FUNCTION car_log(p_tenant text, p_subject text, p_ref text, p_step text, p_actor text) RETURNS void LANGUAGE sql AS $$
     INSERT INTO car_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, p_subject, p_ref, p_step, p_actor) $$`,
  `CREATE OR REPLACE FUNCTION car_set_staff(p_admin text, p_tenant text, p_user text, p_role text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own access.'; END IF;
     IF p_role NOT IN ('coach','center') THEN RETURN 'Unknown role.'; END IF;
     IF p_on THEN INSERT INTO car_staff (tenant_id, user_id, role, granted_by) VALUES (p_tenant, p_user, p_role, p_admin)
       ON CONFLICT (tenant_id, user_id, role) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE car_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND role = p_role AND revoked_at IS NULL; END IF;
     PERFORM car_log(p_tenant, 'staff', p_user || ' ' || p_role, CASE WHEN p_on THEN 'grant' ELSE 'revoke' END, p_admin);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION car_share(p_student text, p_tenant text, p_coach text, p_until date, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_on THEN
       IF NOT car_has(p_tenant, p_coach, 'coach') THEN RETURN 'Choose a career coach.'; END IF;
       IF p_student = p_coach THEN RETURN 'Share with someone else.'; END IF;
       IF p_until < current_date OR p_until > current_date + 365 THEN RETURN 'Choose an end date within the next year.'; END IF;
       INSERT INTO car_shares (tenant_id, student_id, coach_id, expires_on) VALUES (p_tenant, p_student, p_coach, p_until)
         ON CONFLICT (tenant_id, student_id, coach_id) DO UPDATE SET expires_on = EXCLUDED.expires_on, revoked_at = NULL;
     ELSE UPDATE car_shares SET revoked_at = now() WHERE tenant_id = p_tenant AND student_id = p_student AND coach_id = p_coach AND revoked_at IS NULL; END IF;
     PERFORM car_log(p_tenant, 'share', p_coach, CASE WHEN p_on THEN 'share' ELSE 'stop' END, p_student);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION car_plan(p_student text, p_tenant text, p_goal text, p_roles text, p_steps text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v int;
   BEGIN
     SELECT version INTO v FROM car_plans WHERE tenant_id = p_tenant AND student_id = p_student FOR UPDATE;
     IF v IS NULL THEN INSERT INTO car_plans (tenant_id, student_id, goal, target_roles, steps) VALUES (p_tenant, p_student, coalesce(p_goal, ''), coalesce(p_roles, ''), coalesce(p_steps, ''));
     ELSIF v <> p_version THEN RETURN 'Your plan changed in another window. Reload and try again.';
     ELSE UPDATE car_plans SET goal = coalesce(p_goal, ''), target_roles = coalesce(p_roles, ''), steps = coalesce(p_steps, ''), version = version + 1, updated_at = now() WHERE tenant_id = p_tenant AND student_id = p_student; END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION car_resume(p_student text, p_tenant text, p_label text, p_body text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v int; v_id bigint;
   BEGIN
     SELECT coalesce(max(version), 0) + 1 INTO v FROM car_resumes WHERE tenant_id = p_tenant AND student_id = p_student AND label = trim(p_label);
     INSERT INTO car_resumes (tenant_id, student_id, label, body, version) VALUES (p_tenant, p_student, trim(p_label), trim(p_body), v) RETURNING id INTO v_id;
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION car_comment(p_coach text, p_tenant text, p_resume bigint, p_section text, p_comment text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r car_resumes;
   BEGIN
     SELECT * INTO r FROM car_resumes WHERE id = p_resume AND tenant_id = p_tenant;
     IF r.id IS NULL THEN RETURN 'Resume not found.'; END IF;
     IF NOT car_shared(p_tenant, r.student_id, p_coach) THEN RETURN 'The student has not shared their career materials with you.'; END IF;
     INSERT INTO car_feedback (resume_id, coach_id, section, comment) VALUES (p_resume, p_coach, trim(p_section), trim(p_comment));
     PERFORM car_log(p_tenant, 'resume', p_resume::text, 'feedback', p_coach);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION car_book(p_student text, p_tenant text, p_coach text, p_starts timestamptz, p_focus text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT car_has(p_tenant, p_coach, 'coach') THEN RETURN 'Choose a career coach.'; END IF;
     IF p_student = p_coach THEN RETURN 'Book with someone else.'; END IF;
     IF p_starts <= now() THEN RETURN 'Choose a time in the future.'; END IF;
     INSERT INTO car_interviews (tenant_id, student_id, coach_id, starts_at, focus) VALUES (p_tenant, p_student, p_coach, p_starts, trim(p_focus)) RETURNING id INTO v_id;
     PERFORM car_log(p_tenant, 'interview', v_id::text, 'book', p_student);
     RETURN 'ok:' || v_id;
   EXCEPTION WHEN unique_violation THEN RETURN 'That coach is already booked at that time.';
   END $$`,
  `CREATE OR REPLACE FUNCTION car_interview_step(p_actor text, p_tenant text, p_id bigint, p_step text, p_s int, p_e int, p_c int, p_notes text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE i car_interviews;
   BEGIN
     SELECT * INTO i FROM car_interviews WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF i.id IS NULL THEN RETURN 'Interview not found.'; END IF;
     IF i.state <> 'booked' THEN RETURN 'This interview is already finished.'; END IF;
     IF p_step = 'cancel' THEN
       IF p_actor NOT IN (i.student_id, i.coach_id) THEN RETURN 'Only the student or the coach cancels.'; END IF;
       UPDATE car_interviews SET state = 'cancelled' WHERE id = p_id;
     ELSIF p_step IN ('score','no_show') THEN
       IF p_actor <> i.coach_id THEN RETURN 'The coach records the result.'; END IF;
       IF i.starts_at > now() THEN RETURN 'Record the result after the interview starts.'; END IF;
       IF p_step = 'no_show' THEN UPDATE car_interviews SET state = 'no_show' WHERE id = p_id;
       ELSE
         IF p_s IS NULL OR p_e IS NULL OR p_c IS NULL OR length(trim(coalesce(p_notes, ''))) < 10 THEN RETURN 'Score all three areas and add notes.'; END IF;
         UPDATE car_interviews SET state = 'scored', structure = p_s, evidence = p_e, communication = p_c, notes = trim(p_notes) WHERE id = p_id;
       END IF;
     ELSE RETURN 'Unknown step.'; END IF;
     PERFORM car_log(p_tenant, 'interview', p_id::text, p_step, p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION car_assign(p_coach text, p_tenant text, p_student text, p_title text, p_due date) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT car_shared(p_tenant, p_student, p_coach) THEN RETURN 'The student has not shared their career materials with you.'; END IF;
     INSERT INTO car_actions (tenant_id, student_id, coach_id, title, due) VALUES (p_tenant, p_student, p_coach, trim(p_title), p_due);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION car_action_step(p_actor text, p_tenant text, p_id bigint, p_step text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE x car_actions;
   BEGIN
     SELECT * INTO x FROM car_actions WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF x.id IS NULL THEN RETURN 'Action not found.'; END IF;
     IF p_step = 'done' THEN
       IF p_actor <> x.student_id THEN RETURN 'The student marks their own action done.'; END IF;
       IF x.state <> 'open' THEN RETURN 'Only open actions are marked done.'; END IF;
       UPDATE car_actions SET state = 'done', student_note = coalesce(p_note, '') WHERE id = p_id;
     ELSIF p_step IN ('confirm','reopen','drop') THEN
       IF p_actor <> x.coach_id THEN RETURN 'The assigning coach does this.'; END IF;
       IF p_step = 'confirm' AND x.state <> 'done' THEN RETURN 'The student has not marked it done.'; END IF;
       IF p_step = 'reopen' AND x.state <> 'done' THEN RETURN 'Only done actions are reopened.'; END IF;
       UPDATE car_actions SET state = CASE p_step WHEN 'confirm' THEN 'confirmed' WHEN 'reopen' THEN 'open' ELSE 'dropped' END WHERE id = p_id;
     ELSE RETURN 'Unknown step.'; END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION car_fair(p_actor text, p_tenant text, p_title text, p_starts timestamptz, p_location text, p_employers text, p_capacity int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT car_has(p_tenant, p_actor, 'center') THEN RETURN 'Only career center staff run fairs.'; END IF;
     INSERT INTO car_fairs (tenant_id, title, starts_at, location, employers, capacity, created_by) VALUES (p_tenant, trim(p_title), p_starts, coalesce(p_location, ''), coalesce(p_employers, ''), p_capacity, p_actor) RETURNING id INTO v_id;
     PERFORM car_log(p_tenant, 'fair', v_id::text, 'create', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION car_fair_reg(p_student text, p_tenant text, p_fair bigint, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE f car_fairs;
   BEGIN
     SELECT * INTO f FROM car_fairs WHERE id = p_fair AND tenant_id = p_tenant FOR UPDATE;
     IF f.id IS NULL OR f.cancelled THEN RETURN 'Fair not found.'; END IF;
     IF NOT p_on THEN DELETE FROM car_fair_regs WHERE fair_id = p_fair AND student_id = p_student AND checked_in_by IS NULL; RETURN NULL; END IF;
     IF f.starts_at <= now() THEN RETURN 'Registration has closed.'; END IF;
     IF (SELECT count(*) FROM car_fair_regs WHERE fair_id = p_fair) >= f.capacity THEN RETURN 'This fair is full.'; END IF;
     INSERT INTO car_fair_regs (fair_id, student_id) VALUES (p_fair, p_student) ON CONFLICT DO NOTHING;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION car_checkin(p_actor text, p_tenant text, p_fair bigint, p_student text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT car_has(p_tenant, p_actor, 'center') THEN RETURN 'Only career center staff check students in.'; END IF;
     IF p_actor = p_student THEN RETURN 'Someone else checks you in.'; END IF;
     UPDATE car_fair_regs SET checked_in_by = p_actor WHERE fair_id = p_fair AND student_id = p_student AND fair_id IN (SELECT id FROM car_fairs WHERE tenant_id = p_tenant);
     IF NOT FOUND THEN RETURN 'That student is not registered.'; END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION car_outcome(p_student text, p_tenant text, p_cohort text, p_kind text, p_org text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     INSERT INTO car_outcomes (tenant_id, student_id, cohort, kind, organization) VALUES (p_tenant, p_student, trim(p_cohort), p_kind, coalesce(trim(p_org), ''))
       ON CONFLICT (tenant_id, student_id, cohort) DO UPDATE SET kind = EXCLUDED.kind, organization = EXCLUDED.organization, verified_by = NULL, updated_at = now();
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION car_verify(p_actor text, p_tenant text, p_student text, p_cohort text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT car_has(p_tenant, p_actor, 'center') THEN RETURN 'Only career center staff verify outcomes.'; END IF;
     IF p_actor = p_student THEN RETURN 'Someone else verifies your own outcome.'; END IF;
     UPDATE car_outcomes SET verified_by = p_actor WHERE tenant_id = p_tenant AND student_id = p_student AND cohort = p_cohort;
     IF NOT FOUND THEN RETURN 'Outcome not found.'; END IF;
     PERFORM car_log(p_tenant, 'outcome', p_student || ' ' || p_cohort, 'verify', p_actor);
     RETURN NULL;
   END $$`,
  // Outcome report: counts per kind for a cohort; any group under five is suppressed (returned as NULL).
  `CREATE OR REPLACE FUNCTION car_outcome_report(p_tenant text, p_cohort text) RETURNS TABLE (kind text, n int) LANGUAGE sql STABLE AS $$
     SELECT kind, CASE WHEN count(*) >= 5 THEN count(*)::int END FROM car_outcomes WHERE tenant_id = p_tenant AND cohort = p_cohort GROUP BY kind ORDER BY kind $$`,
];
