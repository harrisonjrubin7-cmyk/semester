// Migration fa-001: financial aid requirement checklists (Financial Aid Officer app; student side in "You").
// Pack boundary: "official requirements, checklists, permitted hold resolution and human handoffs; no private cost plans or
// protected aid documents". So: the aid office publishes requirements (title, official source link, due date) for all students
// or named students; a student marks an item done; the office verifies it against its own aid system and records the outcome.
// No aid or tax documents are stored, uploaded or sent anywhere from Semester, and no award is decided here.
// Office staff are granted by an administrator, never self; nobody verifies their own item. Events append-only.
export const FA_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS fa_staff (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
     PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS fa_requirements (id text PRIMARY KEY, tenant_id text NOT NULL, term text NOT NULL, title text NOT NULL CHECK (length(title) BETWEEN 3 AND 160),
     instructions text NOT NULL CHECK (length(instructions) BETWEEN 10 AND 2000), source_url text NOT NULL CHECK (source_url LIKE 'https://%'), due_on date NOT NULL,
     audience text NOT NULL CHECK (audience IN ('all_students', 'selected')), created_by text NOT NULL, retired_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS fa_assign (requirement_id text NOT NULL REFERENCES fa_requirements(id), student_id text NOT NULL, PRIMARY KEY (requirement_id, student_id))`,
  `CREATE TABLE IF NOT EXISTS fa_status (requirement_id text NOT NULL REFERENCES fa_requirements(id), student_id text NOT NULL,
     state text NOT NULL DEFAULT 'todo' CHECK (state IN ('todo', 'marked_done', 'verified', 'needs_action', 'waived')),
     marked_at timestamptz, reviewed_by text, reviewed_at timestamptz, note text, PRIMARY KEY (requirement_id, student_id), CHECK (reviewed_by IS NULL OR reviewed_by <> student_id))`,
  `CREATE TABLE IF NOT EXISTS fa_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, ref text NOT NULL, actor_id text NOT NULL, action text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION fa_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS fa_events_append_only ON fa_events`,
  `CREATE TRIGGER fa_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON fa_events FOR EACH STATEMENT EXECUTE FUNCTION fa_refuse_change()`,
  `CREATE OR REPLACE FUNCTION fa_is_staff(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM fa_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION fa_set_staff(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'You cannot change your own aid-office access.'; END IF;
     IF p_on THEN INSERT INTO fa_staff (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE fa_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     INSERT INTO fa_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, p_user, p_admin, CASE WHEN p_on THEN 'staff_granted' ELSE 'staff_revoked' END);
     RETURN NULL;
   END $$`,
  // p_students: the selected students (already checked to be active students of this institution by the endpoint).
  `CREATE OR REPLACE FUNCTION fa_publish(p_actor text, p_tenant text, p_id text, p_term text, p_title text, p_instr text, p_url text, p_due date, p_audience text, p_students text[]) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT fa_is_staff(p_tenant, p_actor) THEN RETURN 'Only the financial aid office publishes requirements.'; END IF;
     IF EXISTS (SELECT 1 FROM fa_requirements WHERE id = p_id) THEN RETURN NULL; END IF;
     IF coalesce(p_url, '') NOT LIKE 'https://%' THEN RETURN 'Link the official source (https).'; END IF;
     IF p_audience = 'selected' AND coalesce(array_length(p_students, 1), 0) = 0 THEN RETURN 'Choose at least one student.'; END IF;
     INSERT INTO fa_requirements (id, tenant_id, term, title, instructions, source_url, due_on, audience, created_by) VALUES (p_id, p_tenant, trim(p_term), trim(p_title), trim(p_instr), p_url, p_due, p_audience, p_actor);
     IF p_audience = 'selected' THEN INSERT INTO fa_assign (requirement_id, student_id) SELECT p_id, unnest(p_students) ON CONFLICT DO NOTHING; END IF;
     INSERT INTO fa_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, p_id, p_actor, 'published');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION fa_applies(p_req text, p_student text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM fa_requirements r WHERE r.id = p_req AND r.retired_at IS NULL AND (r.audience = 'all_students' OR EXISTS (SELECT 1 FROM fa_assign a WHERE a.requirement_id = r.id AND a.student_id = p_student))) $$`,
  `CREATE OR REPLACE FUNCTION fa_mark(p_student text, p_tenant text, p_req text, p_done boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE st text;
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM fa_requirements WHERE id = p_req AND tenant_id = p_tenant) OR NOT fa_applies(p_req, p_student) THEN RETURN 'Requirement not found.'; END IF;
     SELECT state INTO st FROM fa_status WHERE requirement_id = p_req AND student_id = p_student FOR UPDATE;
     IF st IN ('verified', 'waived') THEN RETURN 'The aid office already closed this item.'; END IF;
     INSERT INTO fa_status (requirement_id, student_id, state, marked_at) VALUES (p_req, p_student, CASE WHEN p_done THEN 'marked_done' ELSE 'todo' END, CASE WHEN p_done THEN now() END)
       ON CONFLICT (requirement_id, student_id) DO UPDATE SET state = EXCLUDED.state, marked_at = EXCLUDED.marked_at;
     INSERT INTO fa_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, p_req, p_student, CASE WHEN p_done THEN 'marked_done' ELSE 'unmarked' END);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION fa_review(p_actor text, p_tenant text, p_req text, p_student text, p_state text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT fa_is_staff(p_tenant, p_actor) THEN RETURN 'Only the financial aid office reviews requirements.'; END IF;
     IF p_actor = p_student THEN RETURN 'Someone else in the office reviews your own items.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM fa_requirements WHERE id = p_req AND tenant_id = p_tenant) OR NOT fa_applies(p_req, p_student) THEN RETURN 'Requirement not found for that student.'; END IF;
     IF p_state IN ('needs_action', 'waived') AND length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Tell the student what happens next (10+ characters).'; END IF;
     INSERT INTO fa_status (requirement_id, student_id, state, reviewed_by, reviewed_at, note) VALUES (p_req, p_student, p_state, p_actor, now(), trim(coalesce(p_note, '')))
       ON CONFLICT (requirement_id, student_id) DO UPDATE SET state = p_state, reviewed_by = p_actor, reviewed_at = now(), note = trim(coalesce(p_note, ''));
     INSERT INTO fa_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, p_req || ':' || p_student, p_actor, 'review_' || p_state);
     RETURN NULL;
   END $$`,
];
