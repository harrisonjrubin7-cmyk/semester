// Migration trn-001: transition and orientation (First Year Staff, Orientation Leader, Admitted Student role apps).
// Enforced here: roles (first-year staff, orientation leaders, admissions) are granted by an administrator, never self.
// First-year staff build transition cohorts and checklists; items that need verification are verified by staff who are not the
// student. Outreach is logged by staff about other people. Belonging check-ins are the student's own; staff see an individual
// response only when the student chose to share it, otherwise only cohort aggregates of five or more (computed in the endpoint).
// Onboarding blockers are raised by the student, a leader or staff, resolved by staff who are not the student, and leaders can
// escalate. Orientation sessions have capacity; attendance is marked only by a leader assigned to that session. Admitted students
// record their own enrollment intent; admissions records the deposit with an external reference (no payment here) and placement
// results, never for themselves. Append-only history.
export const TRN_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS trn_staff (tenant_id text NOT NULL, user_id text NOT NULL, role text NOT NULL CHECK (role IN ('first_year','leader','admissions')),
     granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id, role), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS trn_cohorts (id bigserial PRIMARY KEY, tenant_id text NOT NULL, name text NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 120), term text NOT NULL,
     created_by text NOT NULL, UNIQUE (tenant_id, name, term))`,
  `CREATE TABLE IF NOT EXISTS trn_members (cohort_id bigint NOT NULL REFERENCES trn_cohorts(id), student_id text NOT NULL, added_by text NOT NULL, PRIMARY KEY (cohort_id, student_id))`,
  `CREATE TABLE IF NOT EXISTS trn_items (id bigserial PRIMARY KEY, cohort_id bigint NOT NULL REFERENCES trn_cohorts(id), title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200),
     due date, needs_verification boolean NOT NULL DEFAULT false, created_by text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS trn_done (item_id bigint NOT NULL REFERENCES trn_items(id), student_id text NOT NULL, done_at timestamptz NOT NULL DEFAULT now(), verified_by text, verified_at timestamptz,
     PRIMARY KEY (item_id, student_id), CHECK (verified_by IS NULL OR verified_by <> student_id))`,
  `CREATE TABLE IF NOT EXISTS trn_outreach (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, staff_id text NOT NULL, channel text NOT NULL CHECK (channel IN ('message','call','meeting','email')),
     note text NOT NULL CHECK (length(trim(note)) BETWEEN 5 AND 2000), outcome text NOT NULL CHECK (outcome IN ('reached','no_response','follow_up')), at timestamptz NOT NULL DEFAULT clock_timestamp(),
     CHECK (staff_id <> student_id))`,
  `CREATE TABLE IF NOT EXISTS trn_checkins (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, term text NOT NULL, score int NOT NULL CHECK (score BETWEEN 1 AND 5),
     note text NOT NULL DEFAULT '' CHECK (length(note) <= 1000), shared boolean NOT NULL DEFAULT false, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE TABLE IF NOT EXISTS trn_blockers (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, category text NOT NULL CHECK (category IN ('housing','financial','registration','technology','health_access','other')),
     detail text NOT NULL CHECK (length(trim(detail)) BETWEEN 5 AND 2000), raised_by text NOT NULL, escalated boolean NOT NULL DEFAULT false, assigned_to text,
     state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','resolved')), resolution text NOT NULL DEFAULT '', resolved_by text, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (resolved_by IS NULL OR resolved_by <> student_id), CHECK (state <> 'resolved' OR (resolved_by IS NOT NULL AND length(trim(resolution)) >= 5)))`,
  `CREATE TABLE IF NOT EXISTS trn_sessions (id bigserial PRIMARY KEY, tenant_id text NOT NULL, title text NOT NULL, starts_at timestamptz NOT NULL, location text NOT NULL DEFAULT '',
     capacity int NOT NULL CHECK (capacity > 0), created_by text NOT NULL, cancelled boolean NOT NULL DEFAULT false)`,
  `CREATE TABLE IF NOT EXISTS trn_session_leaders (session_id bigint NOT NULL REFERENCES trn_sessions(id), leader_id text NOT NULL, PRIMARY KEY (session_id, leader_id))`,
  `CREATE TABLE IF NOT EXISTS trn_registrations (session_id bigint NOT NULL REFERENCES trn_sessions(id), student_id text NOT NULL, attended boolean, marked_by text, at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (session_id, student_id), CHECK (marked_by IS NULL OR marked_by <> student_id))`,
  `CREATE TABLE IF NOT EXISTS trn_intents (tenant_id text NOT NULL, student_id text NOT NULL, term text NOT NULL, intent text NOT NULL CHECK (intent IN ('enroll','decline','undecided')),
     deposit_ref text NOT NULL DEFAULT '', deposit_by text, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, student_id, term),
     CHECK (deposit_by IS NULL OR deposit_by <> student_id), CHECK ((deposit_by IS NULL) = (deposit_ref = '')))`,
  `CREATE TABLE IF NOT EXISTS trn_placements (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, subject text NOT NULL, level text NOT NULL, basis text NOT NULL CHECK (length(trim(basis)) >= 3),
     recorded_by text NOT NULL, at timestamptz NOT NULL DEFAULT now(), CHECK (recorded_by <> student_id))`,
  `CREATE TABLE IF NOT EXISTS trn_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL, ref text, step text NOT NULL, actor_id text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION trn_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trn_events_append_only') THEN
       CREATE TRIGGER trn_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON trn_events FOR EACH STATEMENT EXECUTE FUNCTION trn_refuse_change(); END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trn_outreach_append_only') THEN
       CREATE TRIGGER trn_outreach_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON trn_outreach FOR EACH STATEMENT EXECUTE FUNCTION trn_refuse_change(); END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION trn_has(p_tenant text, p_user text, p_role text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM trn_staff WHERE tenant_id = p_tenant AND user_id = p_user AND role = p_role AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION trn_set_staff(p_admin text, p_tenant text, p_user text, p_role text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own access.'; END IF;
     IF p_role NOT IN ('first_year','leader','admissions') THEN RETURN 'Unknown role.'; END IF;
     IF p_on THEN INSERT INTO trn_staff (tenant_id, user_id, role, granted_by) VALUES (p_tenant, p_user, p_role, p_admin)
       ON CONFLICT (tenant_id, user_id, role) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE trn_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND role = p_role AND revoked_at IS NULL; END IF;
     INSERT INTO trn_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'staff', p_user || ' ' || p_role, CASE WHEN p_on THEN 'grant' ELSE 'revoke' END, p_admin);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION trn_cohort(p_actor text, p_tenant text, p_name text, p_term text, p_students text[]) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT trn_has(p_tenant, p_actor, 'first_year') THEN RETURN 'Only first-year staff build transition cohorts.'; END IF;
     INSERT INTO trn_cohorts (tenant_id, name, term, created_by) VALUES (p_tenant, trim(p_name), trim(p_term), p_actor)
       ON CONFLICT (tenant_id, name, term) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_id;
     INSERT INTO trn_members (cohort_id, student_id, added_by) SELECT v_id, x, p_actor FROM unnest(coalesce(p_students, '{}')) x ON CONFLICT DO NOTHING;
     INSERT INTO trn_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'cohort', v_id::text, 'save', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION trn_item(p_actor text, p_tenant text, p_cohort bigint, p_title text, p_due date, p_verify boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT trn_has(p_tenant, p_actor, 'first_year') THEN RETURN 'Only first-year staff edit checklists.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM trn_cohorts WHERE id = p_cohort AND tenant_id = p_tenant) THEN RETURN 'Cohort not found.'; END IF;
     INSERT INTO trn_items (cohort_id, title, due, needs_verification, created_by) VALUES (p_cohort, trim(p_title), p_due, p_verify, p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION trn_mark(p_actor text, p_tenant text, p_item bigint, p_student text, p_step text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE it trn_items; d trn_done;
   BEGIN
     SELECT i.* INTO it FROM trn_items i JOIN trn_cohorts c ON c.id = i.cohort_id WHERE i.id = p_item AND c.tenant_id = p_tenant;
     IF it.id IS NULL OR NOT EXISTS (SELECT 1 FROM trn_members WHERE cohort_id = it.cohort_id AND student_id = p_student) THEN RETURN 'Checklist item not found.'; END IF;
     IF p_step = 'done' THEN
       IF p_actor <> p_student THEN RETURN 'Students mark their own items.'; END IF;
       INSERT INTO trn_done (item_id, student_id) VALUES (p_item, p_student) ON CONFLICT DO NOTHING;
     ELSIF p_step = 'verify' THEN
       IF NOT trn_has(p_tenant, p_actor, 'first_year') THEN RETURN 'Only first-year staff verify.'; END IF;
       IF p_actor = p_student THEN RETURN 'Someone else verifies your own item.'; END IF;
       SELECT * INTO d FROM trn_done WHERE item_id = p_item AND student_id = p_student FOR UPDATE;
       IF d.item_id IS NULL THEN RETURN 'The student has not marked this done yet.'; END IF;
       UPDATE trn_done SET verified_by = p_actor, verified_at = now() WHERE item_id = p_item AND student_id = p_student;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO trn_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'item', p_item || ' ' || p_student, p_step, p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION trn_outreach_log(p_actor text, p_tenant text, p_student text, p_channel text, p_note text, p_outcome text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT trn_has(p_tenant, p_actor, 'first_year') THEN RETURN 'Only first-year staff log outreach.'; END IF;
     IF p_actor = p_student THEN RETURN 'Outreach is about other students.'; END IF;
     INSERT INTO trn_outreach (tenant_id, student_id, staff_id, channel, note, outcome) VALUES (p_tenant, p_student, p_actor, p_channel, trim(p_note), p_outcome);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION trn_blocker(p_actor text, p_tenant text, p_student text, p_category text, p_detail text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF p_actor <> p_student AND NOT (trn_has(p_tenant, p_actor, 'first_year') OR trn_has(p_tenant, p_actor, 'leader')) THEN RETURN 'Raise blockers for yourself, or as staff or an orientation leader.'; END IF;
     INSERT INTO trn_blockers (tenant_id, student_id, category, detail, raised_by) VALUES (p_tenant, p_student, p_category, trim(p_detail), p_actor) RETURNING id INTO v_id;
     INSERT INTO trn_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'blocker', v_id::text, 'raise', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION trn_blocker_step(p_actor text, p_tenant text, p_blocker bigint, p_step text, p_text text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE b trn_blockers;
   BEGIN
     SELECT * INTO b FROM trn_blockers WHERE id = p_blocker AND tenant_id = p_tenant FOR UPDATE;
     IF b.id IS NULL THEN RETURN 'Blocker not found.'; END IF;
     IF b.state <> 'open' THEN RETURN 'Already resolved.'; END IF;
     IF p_step = 'escalate' THEN
       IF NOT (trn_has(p_tenant, p_actor, 'leader') OR b.student_id = p_actor) THEN RETURN 'Leaders or the student escalate.'; END IF;
       UPDATE trn_blockers SET escalated = true WHERE id = p_blocker;
     ELSIF p_step = 'claim' THEN
       IF NOT trn_has(p_tenant, p_actor, 'first_year') THEN RETURN 'First-year staff take blockers.'; END IF;
       IF p_actor = b.student_id THEN RETURN 'Someone else handles your own blocker.'; END IF;
       UPDATE trn_blockers SET assigned_to = p_actor WHERE id = p_blocker;
     ELSIF p_step = 'resolve' THEN
       IF NOT trn_has(p_tenant, p_actor, 'first_year') THEN RETURN 'First-year staff resolve blockers.'; END IF;
       IF p_actor = b.student_id THEN RETURN 'Someone else resolves your own blocker.'; END IF;
       IF length(trim(coalesce(p_text, ''))) < 5 THEN RETURN 'Record what resolved it.'; END IF;
       UPDATE trn_blockers SET state = 'resolved', resolution = trim(p_text), resolved_by = p_actor WHERE id = p_blocker;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO trn_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'blocker', p_blocker::text, p_step, p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION trn_session(p_actor text, p_tenant text, p_title text, p_starts timestamptz, p_location text, p_capacity int, p_leaders text[]) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT trn_has(p_tenant, p_actor, 'first_year') THEN RETURN 'Only first-year staff schedule orientation sessions.'; END IF;
     IF EXISTS (SELECT 1 FROM unnest(coalesce(p_leaders, '{}')) x WHERE NOT trn_has(p_tenant, x, 'leader')) THEN RETURN 'Assign people who hold the orientation-leader role.'; END IF;
     INSERT INTO trn_sessions (tenant_id, title, starts_at, location, capacity, created_by) VALUES (p_tenant, trim(p_title), p_starts, coalesce(p_location, ''), p_capacity, p_actor) RETURNING id INTO v_id;
     INSERT INTO trn_session_leaders (session_id, leader_id) SELECT v_id, x FROM unnest(coalesce(p_leaders, '{}')) x;
     INSERT INTO trn_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'session', v_id::text, 'schedule', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION trn_register(p_student text, p_tenant text, p_session bigint, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE s trn_sessions;
   BEGIN
     SELECT * INTO s FROM trn_sessions WHERE id = p_session AND tenant_id = p_tenant FOR UPDATE;
     IF s.id IS NULL OR s.cancelled THEN RETURN 'Session not found.'; END IF;
     IF NOT p_on THEN DELETE FROM trn_registrations WHERE session_id = p_session AND student_id = p_student AND attended IS NULL; RETURN NULL; END IF;
     IF s.starts_at < now() THEN RETURN 'This session has already started.'; END IF;
     IF (SELECT count(*) FROM trn_registrations WHERE session_id = p_session) >= s.capacity THEN RETURN 'This session is full.'; END IF;
     INSERT INTO trn_registrations (session_id, student_id) VALUES (p_session, p_student) ON CONFLICT DO NOTHING;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION trn_attend(p_actor text, p_tenant text, p_session bigint, p_student text, p_attended boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM trn_session_leaders l JOIN trn_sessions s ON s.id = l.session_id WHERE l.session_id = p_session AND l.leader_id = p_actor AND s.tenant_id = p_tenant)
        OR NOT trn_has(p_tenant, p_actor, 'leader') THEN RETURN 'Only a leader assigned to this session marks attendance.'; END IF;
     IF p_actor = p_student THEN RETURN 'Someone else marks your own attendance.'; END IF;
     UPDATE trn_registrations SET attended = p_attended, marked_by = p_actor WHERE session_id = p_session AND student_id = p_student;
     IF NOT FOUND THEN RETURN 'That student is not registered.'; END IF;
     INSERT INTO trn_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'attendance', p_session || ' ' || p_student, CASE WHEN p_attended THEN 'present' ELSE 'absent' END, p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION trn_intent(p_student text, p_tenant text, p_term text, p_intent text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     INSERT INTO trn_intents (tenant_id, student_id, term, intent) VALUES (p_tenant, p_student, trim(p_term), p_intent)
       ON CONFLICT (tenant_id, student_id, term) DO UPDATE SET intent = EXCLUDED.intent, updated_at = now();
     INSERT INTO trn_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'intent', trim(p_term), p_intent, p_student);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION trn_deposit(p_actor text, p_tenant text, p_student text, p_term text, p_ref text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE i trn_intents;
   BEGIN
     IF NOT trn_has(p_tenant, p_actor, 'admissions') THEN RETURN 'Only admissions records deposits.'; END IF;
     IF p_actor = p_student THEN RETURN 'Someone else records your own deposit.'; END IF;
     SELECT * INTO i FROM trn_intents WHERE tenant_id = p_tenant AND student_id = p_student AND term = trim(p_term) FOR UPDATE;
     IF i.student_id IS NULL OR i.intent <> 'enroll' THEN RETURN 'The student has not confirmed they intend to enroll.'; END IF;
     IF i.deposit_by IS NOT NULL THEN RETURN 'The deposit is already recorded.'; END IF;
     IF length(trim(coalesce(p_ref, ''))) < 3 THEN RETURN 'Record the payment-system reference (the deposit is paid outside Semester).'; END IF;
     UPDATE trn_intents SET deposit_ref = trim(p_ref), deposit_by = p_actor, updated_at = now() WHERE tenant_id = p_tenant AND student_id = p_student AND term = trim(p_term);
     INSERT INTO trn_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'deposit', p_student || ' ' || trim(p_term), 'recorded', p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION trn_checkin(p_student text, p_tenant text, p_term text, p_score int, p_note text, p_shared boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_score NOT BETWEEN 1 AND 5 THEN RETURN 'Choose 1 to 5.'; END IF;
     INSERT INTO trn_checkins (tenant_id, student_id, term, score, note, shared) VALUES (p_tenant, p_student, trim(p_term), p_score, coalesce(p_note, ''), p_shared);
     RETURN NULL;
   END $$`,
  // Cohort belonging: an average only when at least five distinct students answered (latest answer each), otherwise NULL.
  `CREATE OR REPLACE FUNCTION trn_belonging(p_cohort bigint) RETURNS numeric LANGUAGE sql STABLE AS $$
     WITH latest AS (SELECT DISTINCT ON (k.student_id) k.score FROM trn_checkins k JOIN trn_members m ON m.student_id = k.student_id AND m.cohort_id = p_cohort
       JOIN trn_cohorts c ON c.id = p_cohort AND c.tenant_id = k.tenant_id AND c.term = k.term ORDER BY k.student_id, k.at DESC)
     SELECT CASE WHEN count(*) >= 5 THEN round(avg(score), 2) END FROM latest $$`,
  `CREATE OR REPLACE FUNCTION trn_placement(p_actor text, p_tenant text, p_student text, p_subject text, p_level text, p_basis text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT (trn_has(p_tenant, p_actor, 'admissions') OR trn_has(p_tenant, p_actor, 'first_year')) THEN RETURN 'Only admissions or first-year staff record placement.'; END IF;
     IF p_actor = p_student THEN RETURN 'Someone else records your own placement.'; END IF;
     INSERT INTO trn_placements (tenant_id, student_id, subject, level, basis, recorded_by) VALUES (p_tenant, p_student, trim(p_subject), trim(p_level), trim(p_basis), p_actor);
     INSERT INTO trn_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'placement', p_student || ' ' || trim(p_subject), 'recorded', p_actor);
     RETURN NULL;
   END $$`,
];
