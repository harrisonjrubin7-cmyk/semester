// Migration dfm-001: department forms (role app "Department Admin": forms). Builds on sreq-001 (inst_departments, chair_id).
// Enforced here:
// - Department admins are appointed by an institution administrator, never themselves; revocation applies on the next call.
// - A department admin drafts a form (fields: text, long text, choice, date). Before it opens, the department chair or another
//   department admin approves the exact fields (hash); editing an open form is refused — close it and copy it instead.
// - Anyone in the audience (students, staff or everyone in the institution) submits once (idempotent per key; one live response
//   per person). Answers are validated against the approved fields here: required, choice options, lengths, dates.
// - Responses are seen only by the respondent and by that department's admins and chair; a reviewer accepts, returns (the
//   respondent may resubmit) or declines with a note the respondent sees. Nobody reviews their own response.
// - History is append-only.
export const DFM_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS dfm_admins (tenant_id text NOT NULL, department_id bigint NOT NULL REFERENCES inst_departments(id), user_id text NOT NULL,
     granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (department_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS dfm_forms (id bigserial PRIMARY KEY, tenant_id text NOT NULL, department_id bigint NOT NULL REFERENCES inst_departments(id),
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 5 AND 140), instructions text NOT NULL DEFAULT '' CHECK (length(instructions) <= 2000),
     fields jsonb NOT NULL CHECK (jsonb_typeof(fields) = 'array' AND jsonb_array_length(fields) BETWEEN 1 AND 25),
     audience text NOT NULL CHECK (audience IN ('students', 'staff', 'everyone')),
     state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'in_review', 'open', 'closed')),
     author_id text NOT NULL, approver_id text, approved_hash text, version int NOT NULL DEFAULT 1,
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     CHECK (approver_id IS NULL OR approver_id <> author_id), CHECK (state NOT IN ('open', 'closed') OR approver_id IS NOT NULL OR state = 'closed'))`,
  `CREATE TABLE IF NOT EXISTS dfm_responses (id bigserial PRIMARY KEY, tenant_id text NOT NULL, form_id bigint NOT NULL REFERENCES dfm_forms(id), respondent_id text NOT NULL,
     request_key text NOT NULL, answers jsonb NOT NULL, state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted', 'accepted', 'returned', 'declined')),
     reviewer_id text, note text NOT NULL DEFAULT '', version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (form_id, respondent_id, request_key), CHECK (reviewer_id IS NULL OR reviewer_id <> respondent_id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS dfm_one_live ON dfm_responses (form_id, respondent_id) WHERE state IN ('submitted', 'accepted')`,
  `CREATE TABLE IF NOT EXISTS dfm_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL CHECK (subject IN ('admin', 'form', 'response')),
     subject_id bigint NOT NULL, step text NOT NULL, to_state text NOT NULL, actor_id text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION dfm_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'dfm_events_append_only') THEN
       CREATE TRIGGER dfm_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON dfm_events FOR EACH STATEMENT EXECUTE FUNCTION dfm_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION dfm_hash(p_title text, p_instr text, p_fields jsonb, p_audience text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
     SELECT md5(concat_ws('|', p_title, p_instr, p_fields::text, p_audience)) $$`,
  `CREATE OR REPLACE FUNCTION dfm_is_admin(p_tenant text, p_dept bigint, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM dfm_admins WHERE tenant_id = p_tenant AND department_id = p_dept AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION dfm_is_chair(p_tenant text, p_dept bigint, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM inst_departments WHERE tenant_id = p_tenant AND id = p_dept AND chair_id = p_user) $$`,

  // Field definitions: why they are refused, or NULL.
  `CREATE OR REPLACE FUNCTION dfm_fields_problem(p_fields jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
   DECLARE f jsonb; keys text[] := '{}';
   BEGIN
     IF jsonb_typeof(p_fields) <> 'array' OR jsonb_array_length(p_fields) NOT BETWEEN 1 AND 25 THEN RETURN 'A form needs 1 to 25 fields.'; END IF;
     FOR f IN SELECT * FROM jsonb_array_elements(p_fields) LOOP
       IF coalesce(f->>'key', '') !~ '^[a-z][a-z0-9_]{0,39}$' THEN RETURN 'Each field needs a short key (letters, digits, underscore).'; END IF;
       IF (f->>'key') = ANY(keys) THEN RETURN 'Field keys must be unique.'; END IF;
       keys := keys || (f->>'key');
       IF length(trim(coalesce(f->>'label', ''))) NOT BETWEEN 2 AND 200 THEN RETURN 'Each field needs a label.'; END IF;
       IF coalesce(f->>'type', '') NOT IN ('text', 'longtext', 'choice', 'date') THEN RETURN 'Field types are text, long text, choice or date.'; END IF;
       IF f->>'type' = 'choice' AND (jsonb_typeof(f->'options') IS DISTINCT FROM 'array' OR jsonb_array_length(f->'options') NOT BETWEEN 2 AND 20) THEN RETURN 'A choice field needs 2 to 20 options.'; END IF;
     END LOOP;
     RETURN NULL;
   END $$`,
  // Answers against the approved fields: why they are refused, or NULL.
  `CREATE OR REPLACE FUNCTION dfm_answers_problem(p_fields jsonb, p_answers jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
   DECLARE f jsonb; v text; k text;
   BEGIN
     IF jsonb_typeof(p_answers) <> 'object' THEN RETURN 'Answers are missing.'; END IF;
     FOR k IN SELECT jsonb_object_keys(p_answers) LOOP
       IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_fields) x WHERE x->>'key' = k) THEN RETURN 'An answer does not match any field on this form.'; END IF;
     END LOOP;
     FOR f IN SELECT * FROM jsonb_array_elements(p_fields) LOOP
       v := trim(coalesce(p_answers->>(f->>'key'), ''));
       IF v = '' THEN
         IF coalesce((f->>'required')::boolean, false) THEN RETURN 'Answer “' || (f->>'label') || '”.'; END IF;
         CONTINUE;
       END IF;
       IF f->>'type' = 'text' AND length(v) > 300 THEN RETURN '“' || (f->>'label') || '” is too long (300 characters).'; END IF;
       IF f->>'type' = 'longtext' AND length(v) > 4000 THEN RETURN '“' || (f->>'label') || '” is too long (4000 characters).'; END IF;
       IF f->>'type' = 'choice' AND NOT (f->'options') ? v THEN RETURN 'Choose one of the options for “' || (f->>'label') || '”.'; END IF;
       IF f->>'type' = 'date' AND v !~ '^\\d{4}-\\d{2}-\\d{2}$' THEN RETURN 'Enter a date for “' || (f->>'label') || '”.'; END IF;
     END LOOP;
     RETURN NULL;
   END $$`,

  `CREATE OR REPLACE FUNCTION dfm_set_admin(p_admin text, p_is_admin boolean, p_tenant text, p_dept bigint, p_user text, p_active boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT p_is_admin THEN RETURN 'Only institution administrators appoint department admins.'; END IF;
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own department access.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM inst_departments WHERE id = p_dept AND tenant_id = p_tenant) THEN RETURN 'Department not found.'; END IF;
     IF p_active THEN
       INSERT INTO dfm_admins (tenant_id, department_id, user_id, granted_by) VALUES (p_tenant, p_dept, p_user, p_admin)
         ON CONFLICT (department_id, user_id) DO UPDATE SET granted_by = p_admin, granted_at = now(), revoked_at = NULL;
     ELSE UPDATE dfm_admins SET revoked_at = now() WHERE department_id = p_dept AND user_id = p_user AND revoked_at IS NULL; END IF;
     INSERT INTO dfm_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'admin', p_dept, 'set_admin', CASE WHEN p_active THEN 'admin' ELSE 'revoked' END, p_admin, p_user);
     RETURN NULL;
   END $$`,

  // Form steps. Returns 'ok:id' or the reason it was refused.
  `CREATE OR REPLACE FUNCTION dfm_form(p_tenant text, p_actor text, p_step text, p_id bigint, p_expected int, p_dept bigint, p_title text, p_instr text, p_fields jsonb, p_audience text, p_seen text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE f dfm_forms; v_id bigint; v_to text; e text;
   BEGIN
     IF p_step = 'draft' THEN
       IF NOT EXISTS (SELECT 1 FROM inst_departments WHERE id = p_dept AND tenant_id = p_tenant) THEN RETURN 'Department not found.'; END IF;
       IF NOT dfm_is_admin(p_tenant, p_dept, p_actor) THEN RETURN 'Only that department''s admins create its forms.'; END IF;
       IF length(trim(coalesce(p_title, ''))) < 5 THEN RETURN 'Give the form a title (5+ characters).'; END IF;
       IF coalesce(p_audience, '') NOT IN ('students', 'staff', 'everyone') THEN RETURN 'Choose who the form is for.'; END IF;
       e := dfm_fields_problem(p_fields); IF e IS NOT NULL THEN RETURN e; END IF;
       INSERT INTO dfm_forms (tenant_id, department_id, title, instructions, fields, audience, author_id) VALUES (p_tenant, p_dept, trim(p_title), coalesce(p_instr, ''), p_fields, p_audience, p_actor) RETURNING id INTO v_id;
       INSERT INTO dfm_events (tenant_id, subject, subject_id, step, to_state, actor_id) VALUES (p_tenant, 'form', v_id, 'draft', 'draft', p_actor);
       RETURN 'ok:' || v_id;
     END IF;
     SELECT * INTO f FROM dfm_forms WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR f.tenant_id <> p_tenant OR NOT (dfm_is_admin(p_tenant, f.department_id, p_actor) OR dfm_is_chair(p_tenant, f.department_id, p_actor)) THEN RETURN 'Form not found.'; END IF;
     IF p_expected IS DISTINCT FROM f.version THEN RETURN 'This form changed since you opened it. Refresh and try again.'; END IF;
     IF p_step = 'edit' THEN
       IF f.author_id <> p_actor THEN RETURN 'Only the author edits a draft.'; END IF;
       IF f.state <> 'draft' THEN RETURN 'Only drafts can be edited. Close an open form and copy it to change it.'; END IF;
       IF length(trim(coalesce(p_title, ''))) < 5 THEN RETURN 'Give the form a title (5+ characters).'; END IF;
       IF coalesce(p_audience, '') NOT IN ('students', 'staff', 'everyone') THEN RETURN 'Choose who the form is for.'; END IF;
       e := dfm_fields_problem(p_fields); IF e IS NOT NULL THEN RETURN e; END IF;
       UPDATE dfm_forms SET title = trim(p_title), instructions = coalesce(p_instr, ''), fields = p_fields, audience = p_audience WHERE id = f.id; v_to := 'draft';
     ELSIF p_step = 'submit' THEN
       IF f.author_id <> p_actor THEN RETURN 'Only the author submits it.'; END IF;
       IF f.state <> 'draft' THEN RETURN 'Only drafts are submitted.'; END IF;
       UPDATE dfm_forms SET state = 'in_review' WHERE id = f.id; v_to := 'in_review';
     ELSIF p_step IN ('approve', 'return') THEN
       IF f.author_id = p_actor THEN RETURN 'You built this form, so the chair or another department admin approves it.'; END IF;
       IF f.state <> 'in_review' THEN RETURN 'This form is not waiting for approval.'; END IF;
       IF p_seen IS DISTINCT FROM dfm_hash(f.title, f.instructions, f.fields, f.audience) THEN RETURN 'The form changed since you opened it. Reload and review again.'; END IF;
       IF p_step = 'return' THEN
         IF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say what needs changing.'; END IF;
         UPDATE dfm_forms SET state = 'draft' WHERE id = f.id; v_to := 'draft';
       ELSE UPDATE dfm_forms SET state = 'open', approver_id = p_actor, approved_hash = p_seen WHERE id = f.id; v_to := 'open'; END IF;
     ELSIF p_step = 'close' THEN
       IF NOT dfm_is_admin(p_tenant, f.department_id, p_actor) AND NOT dfm_is_chair(p_tenant, f.department_id, p_actor) THEN RETURN 'Form not found.'; END IF;
       IF f.state <> 'open' THEN RETURN 'Only an open form is closed.'; END IF;
       UPDATE dfm_forms SET state = 'closed' WHERE id = f.id; v_to := 'closed';
     ELSIF p_step = 'copy' THEN
       IF NOT dfm_is_admin(p_tenant, f.department_id, p_actor) THEN RETURN 'Only department admins copy forms.'; END IF;
       INSERT INTO dfm_forms (tenant_id, department_id, title, instructions, fields, audience, author_id) VALUES (p_tenant, f.department_id, f.title, f.instructions, f.fields, f.audience, p_actor) RETURNING id INTO v_id;
       INSERT INTO dfm_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'form', v_id, 'copy', 'draft', p_actor, 'of ' || f.id);
       RETURN 'ok:' || v_id;
     ELSE RETURN 'Unknown step.';
     END IF;
     UPDATE dfm_forms SET version = version + 1, updated_at = now() WHERE id = f.id;
     INSERT INTO dfm_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'form', f.id, p_step, v_to, p_actor, left(coalesce(p_note, ''), 600));
     RETURN 'ok:' || f.id;
   END $$`,

  // Respond. p_is_student / p_is_staff come from the server's role resolution (requireAccess), never from the request.
  `CREATE OR REPLACE FUNCTION dfm_respond(p_tenant text, p_actor text, p_is_student boolean, p_is_staff boolean, p_form bigint, p_key text, p_answers jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE f dfm_forms; r dfm_responses; v_id bigint; e text;
   BEGIN
     SELECT * INTO f FROM dfm_forms WHERE id = p_form;
     IF NOT FOUND OR f.tenant_id <> p_tenant OR f.state <> 'open' THEN RETURN 'This form is not open.'; END IF;
     IF (f.audience = 'students' AND NOT p_is_student) OR (f.audience = 'staff' AND NOT p_is_staff) THEN RETURN 'This form is not for you.'; END IF;
     SELECT * INTO r FROM dfm_responses WHERE form_id = p_form AND respondent_id = p_actor AND request_key = p_key;
     IF FOUND THEN IF r.answers = p_answers THEN RETURN 'replay:' || r.id; END IF; RETURN 'That response was already sent with different answers. Refresh and try again.'; END IF;
     IF length(coalesce(p_key, '')) < 8 THEN RETURN 'Missing request key.'; END IF;
     IF EXISTS (SELECT 1 FROM dfm_responses WHERE form_id = p_form AND respondent_id = p_actor AND state IN ('submitted', 'accepted')) THEN RETURN 'You already sent this form.'; END IF;
     e := dfm_answers_problem(f.fields, p_answers); IF e IS NOT NULL THEN RETURN e; END IF;
     INSERT INTO dfm_responses (tenant_id, form_id, respondent_id, request_key, answers) VALUES (p_tenant, p_form, p_actor, p_key, p_answers) RETURNING id INTO v_id;
     INSERT INTO dfm_events (tenant_id, subject, subject_id, step, to_state, actor_id) VALUES (p_tenant, 'response', v_id, 'submit', 'submitted', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,

  `CREATE OR REPLACE FUNCTION dfm_review(p_tenant text, p_actor text, p_id bigint, p_expected int, p_step text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r dfm_responses; f dfm_forms; v_to text; n text := trim(coalesce(p_note, ''));
   BEGIN
     SELECT * INTO r FROM dfm_responses WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN 'Response not found.'; END IF;
     SELECT * INTO f FROM dfm_forms WHERE id = r.form_id;
     IF NOT (dfm_is_admin(p_tenant, f.department_id, p_actor) OR dfm_is_chair(p_tenant, f.department_id, p_actor)) THEN RETURN 'Response not found.'; END IF;
     IF r.respondent_id = p_actor THEN RETURN 'You sent this response, so someone else in the department reviews it.'; END IF;
     IF p_expected IS DISTINCT FROM r.version THEN RETURN 'This response changed since you opened it. Refresh and try again.'; END IF;
     IF r.state <> 'submitted' THEN RETURN 'This response is already reviewed.'; END IF;
     IF p_step NOT IN ('accept', 'return', 'decline') THEN RETURN 'Unknown step.'; END IF;
     IF p_step <> 'accept' AND length(n) < 10 THEN RETURN 'Write a note the person will see (10+ characters).'; END IF;
     v_to := CASE p_step WHEN 'accept' THEN 'accepted' WHEN 'return' THEN 'returned' ELSE 'declined' END;
     UPDATE dfm_responses SET state = v_to, reviewer_id = p_actor, note = n, version = version + 1, updated_at = now() WHERE id = r.id;
     INSERT INTO dfm_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'response', r.id, p_step, v_to, p_actor, left(n, 600));
     RETURN NULL;
   END $$`,
];
