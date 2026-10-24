// Migration acc-001: accessibility accommodations (APP-006 Campus Services; book gap register P0 "Accommodation approved").
// Gate: "accommodation privacy"; "housing, dining, library and accessibility staff do not automatically share each other's
// sensitive records". Design:
// - The student's description stays between the student and the institution's accessibility office (acc_staff).
// - The office approves specific ARRANGEMENTS (e.g. "Extended exam time, 1.5x"); instructors only ever see arrangements,
//   only for courses the student chose to send a letter to, and only while they teach that section.
// - Office membership is granted by an institution administrator, never to themselves. Office staff cannot decide their
//   own request. Everything is tenant-scoped; the tenant always comes from the caller's membership on the server.
// - One function call = one transaction; events are append-only.
export const ACC_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS acc_staff (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
     PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS acc_requests (id text PRIMARY KEY, number serial, tenant_id text NOT NULL, student_id text NOT NULL,
     category text NOT NULL CHECK (category IN ('testing', 'classroom', 'course_materials', 'housing', 'other')),
     description text NOT NULL CHECK (length(description) BETWEEN 20 AND 4000), documentation_offered boolean NOT NULL DEFAULT false,
     state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted', 'info_requested', 'approved', 'declined', 'withdrawn')),
     arrangements text[], decided_by text, decided_at timestamptz, decision_note text, valid_until date,
     version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), CHECK (decided_by IS NULL OR decided_by <> student_id))`,
  `CREATE TABLE IF NOT EXISTS acc_letters (request_id text NOT NULL REFERENCES acc_requests(id), section_id text NOT NULL, sent_at timestamptz NOT NULL DEFAULT now(), withdrawn_at timestamptz,
     PRIMARY KEY (request_id, section_id))`,
  `CREATE TABLE IF NOT EXISTS acc_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_id text, actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION acc_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS acc_events_append_only ON acc_events`,
  `CREATE TRIGGER acc_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON acc_events FOR EACH STATEMENT EXECUTE FUNCTION acc_refuse_change()`,
  `CREATE OR REPLACE FUNCTION acc_is_staff(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM acc_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  // Institution administrator grants or revokes office membership (the endpoint checks the admin role first).
  `CREATE OR REPLACE FUNCTION acc_set_staff(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'You cannot change your own accessibility-office access.'; END IF;
     IF p_on THEN
       INSERT INTO acc_staff (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin)
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE
       UPDATE acc_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL;
     END IF;
     INSERT INTO acc_events (tenant_id, actor_id, action, detail) VALUES (p_tenant, p_admin, CASE WHEN p_on THEN 'office_granted' ELSE 'office_revoked' END, p_user);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION acc_submit(p_student text, p_tenant text, p_id text, p_category text, p_description text, p_docs boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF EXISTS (SELECT 1 FROM acc_requests WHERE id = p_id) THEN RETURN NULL; END IF;
     IF length(trim(coalesce(p_description, ''))) < 20 THEN RETURN 'Describe what would help (20+ characters).'; END IF;
     INSERT INTO acc_requests (id, tenant_id, student_id, category, description, documentation_offered) VALUES (p_id, p_tenant, p_student, p_category, trim(p_description), p_docs);
     INSERT INTO acc_events (tenant_id, request_id, actor_id, action, detail) VALUES (p_tenant, p_id, p_student, 'submitted', p_category);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION acc_decide(p_actor text, p_tenant text, p_id text, p_version int, p_decision text, p_arrangements text[], p_note text, p_valid_until date) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r acc_requests%ROWTYPE;
   BEGIN
     IF NOT acc_is_staff(p_tenant, p_actor) THEN RETURN 'Only the accessibility office decides accommodations.'; END IF;
     SELECT * INTO r FROM acc_requests WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'Request not found.'; END IF;
     IF r.student_id = p_actor THEN RETURN 'You cannot decide your own request.'; END IF;
     IF r.version <> p_version THEN RETURN 'This request changed since you opened it. Reload.'; END IF;
     IF r.state NOT IN ('submitted', 'info_requested', 'approved') THEN RETURN 'This request is closed.'; END IF;
     IF p_decision = 'approve' THEN
       IF coalesce(array_length(p_arrangements, 1), 0) = 0 THEN RETURN 'List at least one arrangement instructors should provide.'; END IF;
       IF p_valid_until IS NULL OR p_valid_until <= current_date THEN RETURN 'Set a future end date for the accommodation.'; END IF;
       UPDATE acc_requests SET state = 'approved', arrangements = p_arrangements, valid_until = p_valid_until, decided_by = p_actor, decided_at = now(), decision_note = p_note, version = version + 1 WHERE id = r.id;
     ELSIF p_decision IN ('decline', 'request_info') THEN
       IF length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Explain this to the student (10+ characters).'; END IF;
       UPDATE acc_requests SET state = CASE WHEN p_decision = 'decline' THEN 'declined' ELSE 'info_requested' END, decided_by = p_actor, decided_at = now(), decision_note = p_note,
         arrangements = CASE WHEN p_decision = 'decline' THEN NULL ELSE arrangements END, version = version + 1 WHERE id = r.id;
       IF p_decision = 'decline' THEN UPDATE acc_letters SET withdrawn_at = now() WHERE request_id = r.id AND withdrawn_at IS NULL; END IF;
     ELSE RETURN 'Unknown decision.'; END IF;
     INSERT INTO acc_events (tenant_id, request_id, actor_id, action, detail) VALUES (p_tenant, r.id, p_actor, p_decision, coalesce(array_to_string(p_arrangements, '; '), ''));
     RETURN NULL;
   END $$`,
  // Student sends (or withdraws) the letter to a course section they are enrolled in; the endpoint verifies enrollment.
  `CREATE OR REPLACE FUNCTION acc_letter(p_student text, p_tenant text, p_id text, p_section text, p_send boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r acc_requests%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM acc_requests WHERE id = p_id;
     IF NOT FOUND OR r.student_id <> p_student OR r.tenant_id <> p_tenant THEN RETURN 'Request not found.'; END IF;
     IF p_send AND (r.state <> 'approved' OR r.valid_until < current_date) THEN RETURN 'Only an active, approved accommodation can be sent.'; END IF;
     IF p_send THEN
       INSERT INTO acc_letters (request_id, section_id) VALUES (r.id, p_section) ON CONFLICT (request_id, section_id) DO UPDATE SET withdrawn_at = NULL, sent_at = now();
     ELSE UPDATE acc_letters SET withdrawn_at = now() WHERE request_id = r.id AND section_id = p_section AND withdrawn_at IS NULL; END IF;
     INSERT INTO acc_events (tenant_id, request_id, actor_id, action, detail) VALUES (p_tenant, r.id, p_student, CASE WHEN p_send THEN 'letter_sent' ELSE 'letter_withdrawn' END, p_section);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION acc_withdraw(p_student text, p_tenant text, p_id text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r acc_requests%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM acc_requests WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.student_id <> p_student OR r.tenant_id <> p_tenant THEN RETURN 'Request not found.'; END IF;
     IF r.state IN ('withdrawn', 'declined') THEN RETURN 'This request is already closed.'; END IF;
     UPDATE acc_requests SET state = 'withdrawn', version = version + 1 WHERE id = r.id;
     UPDATE acc_letters SET withdrawn_at = now() WHERE request_id = r.id AND withdrawn_at IS NULL;
     INSERT INTO acc_events (tenant_id, request_id, actor_id, action) VALUES (p_tenant, r.id, p_student, 'withdrawn');
     RETURN NULL;
   END $$`,
  // What an instructor may see: arrangements only, for sections the endpoint has verified they teach, active letters only.
  `CREATE OR REPLACE FUNCTION acc_instructor_letters(p_tenant text, p_sections text[]) RETURNS TABLE (request_id text, student_id text, section_id text, arrangements text[], valid_until date, sent_at timestamptz)
   LANGUAGE sql STABLE AS $$
     SELECT r.id, r.student_id, l.section_id, r.arrangements, r.valid_until, l.sent_at
     FROM acc_letters l JOIN acc_requests r ON r.id = l.request_id
     WHERE r.tenant_id = p_tenant AND l.section_id = ANY (p_sections) AND l.withdrawn_at IS NULL AND r.state = 'approved' AND r.valid_until >= current_date $$`,
];
