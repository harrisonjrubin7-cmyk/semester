// Migration cur-001: curriculum governance (mirrors lib/curriculumRules.ts). Requires cat-001 (cat_courses) and sreq-001
// (inst_departments with chair_id) to have run first.
// Enforced here: committee members are granted by an administrator (never themselves); a proposal names an active department
// that has a chair; outcomes, syllabus template (assessment weights total 100) and prerequisites are validated; prerequisites
// must be published, non-retired catalog courses and may not loop back (recursive walk of the published graph); one open
// proposal per course code; idempotent submit; the chair endorses (never the author); a committee member approves (neither
// author nor endorsing chair), which files the version into cat_courses as a proposal by the author, so a registrar other
// than the author publishes it through the existing catalog approval; expected-version; append-only history.
export const CUR_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS cur_committee (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(),
     revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE OR REPLACE FUNCTION cur_is_committee(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM cur_committee WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE TABLE IF NOT EXISTS cur_proposals (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_key text NOT NULL, author_id text NOT NULL,
     department_id bigint NOT NULL REFERENCES inst_departments(id), code text NOT NULL, title text NOT NULL CHECK (length(title) BETWEEN 3 AND 160),
     credits numeric NOT NULL CHECK (credits > 0 AND credits <= 12), description text NOT NULL CHECK (length(description) BETWEEN 20 AND 4000),
     prereqs text[] NOT NULL DEFAULT '{}', outcomes jsonb NOT NULL, syllabus jsonb NOT NULL, effective_term text NOT NULL CHECK (length(trim(effective_term)) >= 3),
     rationale text NOT NULL CHECK (length(rationale) BETWEEN 20 AND 4000),
     state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted','chair_endorsed','committee_approved','returned','withdrawn')),
     version int NOT NULL DEFAULT 1, chair_by text, committee_by text, cat_course_id bigint, note text NOT NULL DEFAULT '',
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, author_id, request_key),
     CHECK (chair_by IS NULL OR chair_by <> author_id), CHECK (committee_by IS NULL OR (committee_by <> author_id AND committee_by <> chair_by)))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS cur_one_open ON cur_proposals (tenant_id, code) WHERE state IN ('submitted','chair_endorsed')`,
  `CREATE TABLE IF NOT EXISTS cur_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, proposal_id bigint NOT NULL, step text NOT NULL, to_state text NOT NULL,
     actor_id text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION cur_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'cur_events_append_only') THEN
       CREATE TRIGGER cur_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON cur_events FOR EACH STATEMENT EXECUTE FUNCTION cur_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION cur_set_committee(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own committee membership.'; END IF;
     IF p_on THEN INSERT INTO cur_committee (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE cur_committee SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     INSERT INTO cur_events (tenant_id, proposal_id, step, to_state, actor_id, note) VALUES (p_tenant, 0, 'set_committee', CASE WHEN p_on THEN 'granted' ELSE 'revoked' END, p_admin, p_user);
     RETURN NULL;
   END $$`,
  // The published catalog: the latest approved, non-retired version of each code, keyed without spaces.
  `CREATE OR REPLACE FUNCTION cur_published(p_tenant text) RETURNS TABLE (code text, prereq_text text) LANGUAGE sql STABLE AS $$
     SELECT DISTINCT ON (replace(c.code, ' ', '')) replace(c.code, ' ', ''), c.prerequisites FROM cat_courses c
     WHERE c.tenant_id = p_tenant AND c.state = 'approved' ORDER BY replace(c.code, ' ', ''), c.version DESC $$`,
  `CREATE OR REPLACE FUNCTION cur_check(p_tenant text, p_code text, p_prereqs text[], p_outcomes jsonb, p_syllabus jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE k text := replace(upper(trim(p_code)), ' ', ''); p text; total numeric; n int; a jsonb; loops boolean;
   BEGIN
     IF jsonb_typeof(p_outcomes) <> 'array' OR jsonb_array_length(p_outcomes) NOT BETWEEN 1 AND 12 THEN RETURN 'List between 1 and 12 learning outcomes.'; END IF;
     IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_outcomes) o WHERE length(trim(o)) < 10) THEN RETURN 'Write each outcome as a full statement (10+ characters).'; END IF;
     IF coalesce((p_syllabus->>'weeks')::int, 0) NOT BETWEEN 1 AND 30 THEN RETURN 'A course runs between 1 and 30 weeks.'; END IF;
     IF jsonb_typeof(p_syllabus->'assessments') <> 'array' THEN RETURN 'List between 1 and 12 assessments.'; END IF;
     n := jsonb_array_length(p_syllabus->'assessments');
     IF n NOT BETWEEN 1 AND 12 THEN RETURN 'List between 1 and 12 assessments.'; END IF;
     FOR a IN SELECT * FROM jsonb_array_elements(p_syllabus->'assessments') LOOP
       IF length(trim(coalesce(a->>'name', ''))) < 2 OR coalesce((a->>'weight')::numeric, 0) <= 0 THEN RETURN 'Each assessment needs a name and a weight above 0.'; END IF;
     END LOOP;
     SELECT sum((x->>'weight')::numeric) INTO total FROM jsonb_array_elements(p_syllabus->'assessments') x;
     IF abs(total - 100) > 0.001 THEN RETURN 'Assessment weights must total 100% (now ' || total || '%).'; END IF;
     IF length(trim(coalesce(p_syllabus->>'policies', ''))) < 20 THEN RETURN 'Add course policies (attendance, late work, integrity, accessibility; 20+ characters).'; END IF;
     FOREACH p IN ARRAY coalesce(p_prereqs, '{}') LOOP
       IF replace(upper(trim(p)), ' ', '') = k THEN RETURN 'A course cannot be its own prerequisite.'; END IF;
       IF NOT EXISTS (SELECT 1 FROM cur_published(p_tenant) c WHERE c.code = replace(upper(trim(p)), ' ', '')) THEN RETURN 'Not in the published catalog: ' || upper(trim(p)) || '.'; END IF;
     END LOOP;
     WITH RECURSIVE g(code) AS (
       SELECT replace(upper(trim(x)), ' ', '') FROM unnest(coalesce(p_prereqs, '{}')) x
       UNION
       SELECT replace(m[1], ' ', '') FROM g JOIN cur_published(p_tenant) c ON c.code = g.code CROSS JOIN LATERAL regexp_matches(upper(c.prereq_text), '([A-Z]{2,6} ?[0-9]{3,4}[A-Z]?)', 'g') m
     ) SELECT EXISTS (SELECT 1 FROM g WHERE g.code = k) INTO loops;
     IF loops THEN RETURN 'These prerequisites would create a loop back to this course.'; END IF;
     RETURN NULL;
   END $$`,
  // Returns 'ok:<id>', 'replay:<id>' or a refusal.
  `CREATE OR REPLACE FUNCTION cur_submit(p_tenant text, p_key text, p_author text, p_dept bigint, p_code text, p_title text, p_credits numeric, p_desc text,
     p_prereqs text[], p_outcomes jsonb, p_syllabus jsonb, p_term text, p_rationale text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE pr cur_proposals; c text := upper(regexp_replace(trim(coalesce(p_code, '')), '\\s+', ' ', 'g')); e text; nid bigint; d inst_departments;
   BEGIN
     SELECT * INTO pr FROM cur_proposals WHERE tenant_id = p_tenant AND author_id = p_author AND request_key = p_key;
     IF FOUND THEN
       IF pr.code = c AND pr.title = trim(p_title) AND pr.syllabus = p_syllabus AND pr.outcomes = p_outcomes THEN RETURN 'replay:' || pr.id; END IF;
       RETURN 'This proposal was already sent with different details.';
     END IF;
     IF c !~ '^[A-Z]{2,6} ?[0-9]{3,4}[A-Z]?$' THEN RETURN 'Use a course code like HIST 214.'; END IF;
     SELECT * INTO d FROM inst_departments WHERE id = p_dept AND tenant_id = p_tenant;
     IF NOT FOUND OR NOT d.active THEN RETURN 'Choose an active department.'; END IF;
     IF d.chair_id IS NULL THEN RETURN 'This department has no chair to review proposals yet.'; END IF;
     IF length(trim(coalesce(p_desc, ''))) < 20 THEN RETURN 'Write a catalog description (20+ characters).'; END IF;
     IF length(trim(coalesce(p_rationale, ''))) < 20 THEN RETURN 'Explain why the course is needed (20+ characters).'; END IF;
     IF p_credits IS NULL OR p_credits <= 0 OR p_credits > 12 THEN RETURN 'Credits must be between 0 and 12.'; END IF;
     e := cur_check(p_tenant, c, p_prereqs, p_outcomes, p_syllabus);
     IF e IS NOT NULL THEN RETURN e; END IF;
     PERFORM pg_advisory_xact_lock(hashtext('cur:' || p_tenant || replace(c, ' ', '')));
     IF EXISTS (SELECT 1 FROM cur_proposals WHERE tenant_id = p_tenant AND replace(code, ' ', '') = replace(c, ' ', '') AND state IN ('submitted','chair_endorsed'))
       OR EXISTS (SELECT 1 FROM cat_courses WHERE tenant_id = p_tenant AND replace(code, ' ', '') = replace(c, ' ', '') AND state = 'proposed')
       THEN RETURN 'A change to this course is already under review.'; END IF;
     INSERT INTO cur_proposals (tenant_id, request_key, author_id, department_id, code, title, credits, description, prereqs, outcomes, syllabus, effective_term, rationale)
       VALUES (p_tenant, p_key, p_author, p_dept, c, trim(p_title), p_credits, trim(p_desc), (SELECT coalesce(array_agg(upper(trim(x))), '{}') FROM unnest(coalesce(p_prereqs, '{}')) x),
         p_outcomes, p_syllabus, trim(p_term), trim(p_rationale)) RETURNING id INTO nid;
     INSERT INTO cur_events (tenant_id, proposal_id, step, to_state, actor_id) VALUES (p_tenant, nid, 'submit', 'submitted', p_author);
     RETURN 'ok:' || nid;
   END $$`,
  `CREATE OR REPLACE FUNCTION cur_step(p_tenant text, p_id bigint, p_actor text, p_step text, p_expected int, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE pr cur_proposals; chair text; nxt text; t text := trim(coalesce(p_note, '')); e text; v int; cid bigint;
   BEGIN
     SELECT * INTO pr FROM cur_proposals WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Proposal not found.'; END IF;
     IF pr.version <> p_expected THEN RETURN 'This proposal changed since you opened it. Reload.'; END IF;
     SELECT chair_id INTO chair FROM inst_departments WHERE id = pr.department_id;
     nxt := CASE
       WHEN p_step = 'endorse' AND p_actor = chair AND p_actor <> pr.author_id AND pr.state = 'submitted' THEN 'chair_endorsed'
       WHEN p_step = 'approve' AND cur_is_committee(p_tenant, p_actor) AND p_actor <> pr.author_id AND p_actor IS DISTINCT FROM pr.chair_by AND pr.state = 'chair_endorsed' THEN 'committee_approved'
       WHEN p_step = 'return' AND ((p_actor = chair AND pr.state = 'submitted') OR (cur_is_committee(p_tenant, p_actor) AND pr.state = 'chair_endorsed')) AND p_actor <> pr.author_id THEN 'returned'
       WHEN p_step = 'withdraw' AND p_actor = pr.author_id AND pr.state IN ('submitted','chair_endorsed') THEN 'withdrawn'
       ELSE NULL END;
     IF nxt IS NULL THEN
       IF p_actor = pr.author_id AND p_step IN ('endorse','approve','return') THEN RETURN 'You cannot review your own proposal.'; END IF;
       IF p_step = 'approve' AND p_actor = pr.chair_by THEN RETURN 'The chair who endorsed this cannot also approve it for the committee.'; END IF;
       RETURN 'That step is not open to you now.';
     END IF;
     IF p_step = 'return' AND length(t) < 10 THEN RETURN 'Say what needs to change (10+ characters).'; END IF;
     IF p_step = 'approve' THEN
       -- Re-check against today's published catalog: prerequisites may have changed since submission.
       e := cur_check(p_tenant, pr.code, pr.prereqs, pr.outcomes, pr.syllabus);
       IF e IS NOT NULL THEN RETURN 'Cannot approve: ' || e; END IF;
       IF EXISTS (SELECT 1 FROM cat_courses WHERE tenant_id = p_tenant AND replace(code, ' ', '') = replace(pr.code, ' ', '') AND state = 'proposed') THEN RETURN 'Another change to this course is waiting for the registrar.'; END IF;
       PERFORM pg_advisory_xact_lock(hashtext('cat:' || p_tenant || pr.code));
       SELECT coalesce(max(version), 0) + 1 INTO v FROM cat_courses WHERE tenant_id = p_tenant AND code = pr.code;
       INSERT INTO cat_courses (tenant_id, code, version, title, credits, description, prerequisites, effective_term, retire, proposed_by)
         VALUES (p_tenant, pr.code, v, pr.title, pr.credits, pr.description, array_to_string(pr.prereqs, ', '), pr.effective_term, false, pr.author_id) RETURNING id INTO cid;
       INSERT INTO cat_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, pr.code || ' v' || v, p_actor, 'course_proposed_by_committee');
     END IF;
     UPDATE cur_proposals SET state = nxt, version = version + 1, updated_at = now(), note = CASE WHEN t <> '' THEN t ELSE note END,
       chair_by = CASE WHEN p_step = 'endorse' THEN p_actor ELSE chair_by END, committee_by = CASE WHEN p_step = 'approve' THEN p_actor ELSE committee_by END,
       cat_course_id = CASE WHEN p_step = 'approve' THEN cid ELSE cat_course_id END WHERE id = pr.id;
     INSERT INTO cur_events (tenant_id, proposal_id, step, to_state, actor_id, note) VALUES (p_tenant, pr.id, p_step, nxt, p_actor, t);
     RETURN NULL;
   END $$`,
];
