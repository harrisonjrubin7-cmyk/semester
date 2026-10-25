// Migration tut-001: tutoring service (role apps Tutor + Learning Center Staff; student side in Learn).
// Blueprint flow: tutor publishes subjects/availability → center verifies qualifications → student requests → center matches
// (or waitlists) → tutor schedules and runs the session → tutor records attendance, a scoped summary and student-owned follow-ups.
// Visibility (pack boundaries): tutors see only sessions assigned to them, and never grades or private plans; center staff see
// operational metadata (subject, state, attendance) but not the student's goal or the session summary; the student sees all of
// their own request. Center staff are granted by an administrator, never self; nobody verifies themselves or tutors themselves.
// One function call = one transaction; events are append-only; tenant always from the caller's membership.
export const TUT_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS tut_staff (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
     PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS tut_tutors (tenant_id text NOT NULL, user_id text NOT NULL, subjects text[] NOT NULL, availability text NOT NULL,
     verified_by text, verified_at timestamptz, active boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (tenant_id, user_id), CHECK (verified_by IS NULL OR verified_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS tut_requests (id text PRIMARY KEY, number serial, tenant_id text NOT NULL, student_id text NOT NULL, subject text NOT NULL,
     goal text NOT NULL CHECK (length(goal) BETWEEN 10 AND 1000),
     state text NOT NULL DEFAULT 'requested' CHECK (state IN ('requested', 'waitlisted', 'matched', 'scheduled', 'completed', 'cancelled')),
     tutor_id text, matched_by text, session_at timestamptz, attended boolean, summary text, followups text[], version int NOT NULL DEFAULT 1,
     created_at timestamptz NOT NULL DEFAULT now(), CHECK (tutor_id IS NULL OR tutor_id <> student_id))`,
  `CREATE TABLE IF NOT EXISTS tut_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_id text, actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION tut_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS tut_events_append_only ON tut_events`,
  `CREATE TRIGGER tut_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON tut_events FOR EACH STATEMENT EXECUTE FUNCTION tut_refuse_change()`,
  `CREATE OR REPLACE FUNCTION tut_is_staff(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM tut_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION tut_set_staff(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'You cannot change your own learning-center access.'; END IF;
     IF p_on THEN INSERT INTO tut_staff (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE tut_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     INSERT INTO tut_events (tenant_id, actor_id, action, detail) VALUES (p_tenant, p_admin, CASE WHEN p_on THEN 'staff_granted' ELSE 'staff_revoked' END, p_user);
     RETURN NULL;
   END $$`,
  // A tutor publishes or edits their own profile. Changing subjects clears verification: the center re-checks qualifications.
  `CREATE OR REPLACE FUNCTION tut_profile(p_user text, p_tenant text, p_subjects text[], p_availability text, p_active boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE t tut_tutors%ROWTYPE;
   BEGIN
     IF coalesce(array_length(p_subjects, 1), 0) = 0 THEN RETURN 'List at least one subject you can tutor.'; END IF;
     IF length(trim(coalesce(p_availability, ''))) < 5 THEN RETURN 'Say when you are available.'; END IF;
     SELECT * INTO t FROM tut_tutors WHERE tenant_id = p_tenant AND user_id = p_user FOR UPDATE;
     IF NOT FOUND THEN
       INSERT INTO tut_tutors (tenant_id, user_id, subjects, availability, active) VALUES (p_tenant, p_user, p_subjects, trim(p_availability), p_active);
     ELSE
       UPDATE tut_tutors SET subjects = p_subjects, availability = trim(p_availability), active = p_active, updated_at = now(),
         verified_by = CASE WHEN t.subjects @> p_subjects THEN t.verified_by ELSE NULL END,
         verified_at = CASE WHEN t.subjects @> p_subjects THEN t.verified_at ELSE NULL END
       WHERE tenant_id = p_tenant AND user_id = p_user;
     END IF;
     INSERT INTO tut_events (tenant_id, actor_id, action, detail) VALUES (p_tenant, p_user, 'profile', array_to_string(p_subjects, ', '));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION tut_verify(p_actor text, p_tenant text, p_tutor text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT tut_is_staff(p_tenant, p_actor) THEN RETURN 'Only learning-center staff verify tutors.'; END IF;
     IF p_actor = p_tutor THEN RETURN 'Someone else verifies your own qualifications.'; END IF;
     UPDATE tut_tutors SET verified_by = CASE WHEN p_on THEN p_actor END, verified_at = CASE WHEN p_on THEN now() END WHERE tenant_id = p_tenant AND user_id = p_tutor;
     IF NOT FOUND THEN RETURN 'Tutor not found.'; END IF;
     INSERT INTO tut_events (tenant_id, actor_id, action, detail) VALUES (p_tenant, p_actor, CASE WHEN p_on THEN 'verified' ELSE 'unverified' END, p_tutor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION tut_request(p_student text, p_tenant text, p_id text, p_subject text, p_goal text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF EXISTS (SELECT 1 FROM tut_requests WHERE id = p_id) THEN RETURN NULL; END IF;
     IF length(trim(coalesce(p_goal, ''))) < 10 THEN RETURN 'Say what you want help with (10+ characters).'; END IF;
     IF (SELECT count(*) FROM tut_requests WHERE tenant_id = p_tenant AND student_id = p_student AND state IN ('requested','waitlisted','matched','scheduled')) >= 3 THEN
       RETURN 'You have three open tutoring requests. Finish or cancel one first.'; END IF;
     INSERT INTO tut_requests (id, tenant_id, student_id, subject, goal) VALUES (p_id, p_tenant, p_student, trim(p_subject), trim(p_goal));
     INSERT INTO tut_events (tenant_id, request_id, actor_id, action, detail) VALUES (p_tenant, p_id, p_student, 'requested', p_subject);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION tut_match(p_actor text, p_tenant text, p_id text, p_version int, p_tutor text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r tut_requests%ROWTYPE; t tut_tutors%ROWTYPE;
   BEGIN
     IF NOT tut_is_staff(p_tenant, p_actor) THEN RETURN 'Only learning-center staff match requests.'; END IF;
     SELECT * INTO r FROM tut_requests WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'Request not found.'; END IF;
     IF r.version <> p_version THEN RETURN 'This request changed since you opened it. Reload.'; END IF;
     IF r.state NOT IN ('requested', 'waitlisted') THEN RETURN 'This request is already matched or closed.'; END IF;
     IF p_tutor IS NULL THEN
       UPDATE tut_requests SET state = 'waitlisted', version = version + 1 WHERE id = p_id;
       INSERT INTO tut_events (tenant_id, request_id, actor_id, action) VALUES (p_tenant, p_id, p_actor, 'waitlisted');
       RETURN NULL;
     END IF;
     IF p_tutor = r.student_id THEN RETURN 'A student cannot be matched with themselves.'; END IF;
     SELECT * INTO t FROM tut_tutors WHERE tenant_id = p_tenant AND user_id = p_tutor;
     IF NOT FOUND OR t.verified_by IS NULL OR NOT t.active THEN RETURN 'Only verified, active tutors can be matched.'; END IF;
     IF NOT (lower(r.subject) = ANY (SELECT lower(x) FROM unnest(t.subjects) x)) THEN RETURN 'That tutor is not verified for this subject.'; END IF;
     UPDATE tut_requests SET state = 'matched', tutor_id = p_tutor, matched_by = p_actor, version = version + 1 WHERE id = p_id;
     INSERT INTO tut_events (tenant_id, request_id, actor_id, action, detail) VALUES (p_tenant, p_id, p_actor, 'matched', p_tutor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION tut_schedule(p_tutor text, p_tenant text, p_id text, p_version int, p_at timestamptz) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r tut_requests%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM tut_requests WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant OR r.tutor_id IS DISTINCT FROM p_tutor THEN RETURN 'Session not found.'; END IF;
     IF r.version <> p_version THEN RETURN 'This session changed since you opened it. Reload.'; END IF;
     IF r.state NOT IN ('matched', 'scheduled') THEN RETURN 'This session cannot be scheduled now.'; END IF;
     IF p_at IS NULL OR p_at < now() THEN RETURN 'Pick a time in the future.'; END IF;
     UPDATE tut_requests SET state = 'scheduled', session_at = p_at, version = version + 1 WHERE id = p_id;
     INSERT INTO tut_events (tenant_id, request_id, actor_id, action, detail) VALUES (p_tenant, p_id, p_tutor, 'scheduled', p_at::text);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION tut_complete(p_tutor text, p_tenant text, p_id text, p_version int, p_attended boolean, p_summary text, p_followups text[]) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r tut_requests%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM tut_requests WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant OR r.tutor_id IS DISTINCT FROM p_tutor THEN RETURN 'Session not found.'; END IF;
     IF r.version <> p_version THEN RETURN 'This session changed since you opened it. Reload.'; END IF;
     IF r.state <> 'scheduled' THEN RETURN 'Schedule the session before closing it.'; END IF;
     IF p_attended AND length(trim(coalesce(p_summary, ''))) < 10 THEN RETURN 'Write a short summary for the student (10+ characters).'; END IF;
     UPDATE tut_requests SET state = 'completed', attended = p_attended, summary = CASE WHEN p_attended THEN trim(p_summary) END,
       followups = CASE WHEN p_attended THEN p_followups END, version = version + 1 WHERE id = p_id;
     INSERT INTO tut_events (tenant_id, request_id, actor_id, action, detail) VALUES (p_tenant, p_id, p_tutor, 'completed', CASE WHEN p_attended THEN 'attended' ELSE 'no_show' END);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION tut_cancel(p_actor text, p_tenant text, p_id text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r tut_requests%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM tut_requests WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'Request not found.'; END IF;
     IF r.student_id <> p_actor AND NOT tut_is_staff(p_tenant, p_actor) THEN RETURN 'Only the student or the learning center can cancel.'; END IF;
     IF r.state IN ('completed', 'cancelled') THEN RETURN 'This request is closed.'; END IF;
     UPDATE tut_requests SET state = 'cancelled', version = version + 1 WHERE id = p_id;
     INSERT INTO tut_events (tenant_id, request_id, actor_id, action) VALUES (p_tenant, p_id, p_actor, 'cancelled');
     RETURN NULL;
   END $$`,
];
