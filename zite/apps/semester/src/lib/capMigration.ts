// Migration cap-001: undergraduate capstone (role app "Undergraduate Student": capstone; supervisors use it from the Faculty app).
// - A student proposes one capstone per term and names an active faculty supervisor; nothing starts until the supervisor
//   accepts (a decline needs a reason). The supervisor names a second reader who is neither the supervisor nor the student.
// - Four milestones in order: proposal, plan, draft, final. The student submits a milestone as text (and an optional https
//   link); the supervisor approves it or asks for revisions with a note. A milestone opens only after the one before is
//   approved; a resubmission makes a new version and the earlier decision stays in history.
// - After the final is approved, the supervisor and the second reader each score a four-criterion rubric (1-4) without seeing
//   the other's scores. The result is a recommendation for the instructor of record, never an official grade. A gap of two
//   or more on any criterion is flagged for the readers to discuss.
// Only the student, the supervisor and the second reader see a capstone. One call = one transaction; append-only history.
export const CAP_MILESTONES = ['proposal', 'plan', 'draft', 'final'] as const;
export const CAP_CRITERIA = ['question', 'method', 'evidence', 'communication'] as const;
export const CAP_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS cap_projects (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, term text NOT NULL CHECK (length(trim(term)) BETWEEN 3 AND 40),
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 5 AND 160), summary text NOT NULL CHECK (length(trim(summary)) BETWEEN 40 AND 3000),
     supervisor_id text NOT NULL, second_reader_id text, state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed', 'declined', 'active', 'evaluated', 'withdrawn')),
     decline_reason text NOT NULL DEFAULT '', version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (supervisor_id <> student_id), CHECK (second_reader_id IS NULL OR (second_reader_id <> supervisor_id AND second_reader_id <> student_id)))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS cap_projects_open ON cap_projects (tenant_id, student_id, lower(term)) WHERE state IN ('proposed', 'active', 'evaluated')`,
  `CREATE TABLE IF NOT EXISTS cap_submissions (id bigserial PRIMARY KEY, project_id bigint NOT NULL REFERENCES cap_projects(id), milestone text NOT NULL CHECK (milestone IN ('proposal', 'plan', 'draft', 'final')),
     version int NOT NULL, body text NOT NULL CHECK (length(trim(body)) BETWEEN 20 AND 8000), url text CHECK (url IS NULL OR url ~ '^https://[^[:space:]]{4,}$'),
     decision text CHECK (decision IN ('approved', 'revise')), note text NOT NULL DEFAULT '', decided_by text, submitted_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
     UNIQUE (project_id, milestone, version), CHECK (decision IS DISTINCT FROM 'revise' OR length(trim(note)) >= 10))`,
  `CREATE TABLE IF NOT EXISTS cap_scores (project_id bigint NOT NULL REFERENCES cap_projects(id), reader_id text NOT NULL, role text NOT NULL CHECK (role IN ('supervisor', 'second_reader')),
     question int NOT NULL CHECK (question BETWEEN 1 AND 4), method int NOT NULL CHECK (method BETWEEN 1 AND 4), evidence int NOT NULL CHECK (evidence BETWEEN 1 AND 4),
     communication int NOT NULL CHECK (communication BETWEEN 1 AND 4), comment text NOT NULL CHECK (length(trim(comment)) >= 20), at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (project_id, role))`,
  `CREATE TABLE IF NOT EXISTS cap_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, project_id bigint, actor_id text NOT NULL, step text NOT NULL, note text NOT NULL DEFAULT '',
     at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION cap_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS cap_events_append_only ON cap_events`,
  `CREATE TRIGGER cap_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON cap_events FOR EACH STATEMENT EXECUTE FUNCTION cap_refuse_change()`,
  `DROP TRIGGER IF EXISTS cap_scores_append_only ON cap_scores`,
  `CREATE TRIGGER cap_scores_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON cap_scores FOR EACH STATEMENT EXECUTE FUNCTION cap_refuse_change()`,
  // A decided submission is never edited: only the decision fields may be filled, once.
  `CREATE OR REPLACE FUNCTION cap_sub_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
     IF TG_OP = 'DELETE' OR (NEW.body, NEW.url, NEW.milestone, NEW.version, NEW.project_id) IS DISTINCT FROM (OLD.body, OLD.url, OLD.milestone, OLD.version, OLD.project_id)
       OR (OLD.decision IS NOT NULL AND (NEW.decision, NEW.note, NEW.decided_by) IS DISTINCT FROM (OLD.decision, OLD.note, OLD.decided_by)) THEN
       RAISE EXCEPTION 'SUBMISSION_FIXED' USING ERRCODE = 'check_violation'; END IF;
     RETURN NEW; END $$`,
  `DROP TRIGGER IF EXISTS cap_submissions_fixed ON cap_submissions`,
  `CREATE TRIGGER cap_submissions_fixed BEFORE UPDATE OR DELETE ON cap_submissions FOR EACH ROW EXECUTE FUNCTION cap_sub_guard()`,
  `CREATE OR REPLACE FUNCTION cap_log(p_tenant text, p_project bigint, p_actor text, p_step text, p_note text) RETURNS void LANGUAGE sql AS $$
     INSERT INTO cap_events (tenant_id, project_id, actor_id, step, note) VALUES (p_tenant, p_project, p_actor, p_step, coalesce(p_note, '')) $$`,
  /** The milestone the student works on now: the first one without an approved submission. NULL when all are approved. */
  `CREATE OR REPLACE FUNCTION cap_current(p_project bigint) RETURNS text LANGUAGE sql STABLE AS $$
     SELECT m FROM unnest(ARRAY['proposal', 'plan', 'draft', 'final']) WITH ORDINALITY AS t(m, n)
     WHERE NOT EXISTS (SELECT 1 FROM cap_submissions s WHERE s.project_id = p_project AND s.milestone = t.m AND s.decision = 'approved') ORDER BY n LIMIT 1 $$`,
  `CREATE OR REPLACE FUNCTION cap_propose(p_tenant text, p_student text, p_is_student boolean, p_supervisor_is_faculty boolean, p jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint; BEGIN
     IF NOT p_is_student THEN RETURN 'Only students propose a capstone.'; END IF;
     IF NOT p_supervisor_is_faculty THEN RETURN 'Choose an active faculty member at your institution as supervisor.'; END IF;
     IF p->>'supervisorId' = p_student THEN RETURN 'You cannot supervise your own capstone.'; END IF;
     IF length(trim(coalesce(p->>'term', ''))) NOT BETWEEN 3 AND 40 THEN RETURN 'Choose the term.'; END IF;
     IF length(trim(coalesce(p->>'title', ''))) NOT BETWEEN 5 AND 160 THEN RETURN 'Give it a title (5 to 160 characters).'; END IF;
     IF length(trim(coalesce(p->>'summary', ''))) NOT BETWEEN 40 AND 3000 THEN RETURN 'Describe the question and approach (40 to 3000 characters).'; END IF;
     IF EXISTS (SELECT 1 FROM cap_projects WHERE tenant_id = p_tenant AND student_id = p_student AND lower(term) = lower(trim(p->>'term')) AND state IN ('proposed', 'active', 'evaluated'))
       THEN RETURN 'You already have a capstone for this term.'; END IF;
     INSERT INTO cap_projects (tenant_id, student_id, term, title, summary, supervisor_id) VALUES (p_tenant, p_student, trim(p->>'term'), trim(p->>'title'), trim(p->>'summary'), p->>'supervisorId') RETURNING id INTO v_id;
     PERFORM cap_log(p_tenant, v_id, p_student, 'propose', trim(p->>'title'));
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION cap_step(p_tenant text, p_actor text, p_step text, p_id bigint, p_version int, p_other_is_faculty boolean, p jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c cap_projects%ROWTYPE; s cap_submissions%ROWTYPE; v_m text; v_n int; v_role text; BEGIN
     SELECT * INTO c FROM cap_projects WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Capstone not found.'; END IF;
     IF p_version IS DISTINCT FROM c.version THEN RETURN 'This capstone changed since you opened it. Reload and try again.'; END IF;
     IF p_step IN ('accept', 'decline') THEN
       IF p_actor <> c.supervisor_id THEN RETURN 'Only the named supervisor answers.'; END IF;
       IF c.state <> 'proposed' THEN RETURN 'This proposal was already answered.'; END IF;
       IF p_step = 'decline' AND length(trim(coalesce(p->>'note', ''))) < 10 THEN RETURN 'Tell the student why (10+ characters).'; END IF;
       UPDATE cap_projects SET state = CASE WHEN p_step = 'accept' THEN 'active' ELSE 'declined' END, decline_reason = trim(coalesce(p->>'note', '')) WHERE id = c.id;
     ELSIF p_step = 'reader' THEN
       IF p_actor <> c.supervisor_id THEN RETURN 'Only the supervisor names the second reader.'; END IF;
       IF c.state <> 'active' THEN RETURN 'Accept the capstone first.'; END IF;
       IF NOT p_other_is_faculty THEN RETURN 'The second reader must be active faculty at your institution.'; END IF;
       IF p->>'readerId' IN (c.supervisor_id, c.student_id) THEN RETURN 'The second reader must be someone other than you and the student.'; END IF;
       IF EXISTS (SELECT 1 FROM cap_scores WHERE project_id = c.id AND role = 'second_reader') THEN RETURN 'The second reader has already scored it.'; END IF;
       UPDATE cap_projects SET second_reader_id = p->>'readerId' WHERE id = c.id;
     ELSIF p_step = 'submit' THEN
       IF p_actor <> c.student_id THEN RETURN 'Only the student submits.'; END IF;
       IF c.state <> 'active' THEN RETURN 'Your supervisor has to accept the capstone first.'; END IF;
       v_m := cap_current(c.id);
       IF v_m IS NULL THEN RETURN 'Every milestone is approved.'; END IF;
       IF p->>'milestone' IS DISTINCT FROM v_m THEN RETURN 'The milestone open now is ' || v_m || '.'; END IF;
       IF EXISTS (SELECT 1 FROM cap_submissions WHERE project_id = c.id AND milestone = v_m AND decision IS NULL) THEN RETURN 'Your last submission is still waiting for your supervisor.'; END IF;
       IF length(trim(coalesce(p->>'body', ''))) NOT BETWEEN 20 AND 8000 THEN RETURN 'Write the submission (20 to 8000 characters).'; END IF;
       IF nullif(trim(coalesce(p->>'url', '')), '') IS NOT NULL AND trim(p->>'url') !~ '^https://[^[:space:]]{4,}$' THEN RETURN 'Links must start with https://.'; END IF;
       SELECT coalesce(max(version), 0) + 1 INTO v_n FROM cap_submissions WHERE project_id = c.id AND milestone = v_m;
       INSERT INTO cap_submissions (project_id, milestone, version, body, url) VALUES (c.id, v_m, v_n, trim(p->>'body'), nullif(trim(coalesce(p->>'url', '')), ''));
     ELSIF p_step IN ('approve', 'revise') THEN
       IF p_actor <> c.supervisor_id THEN RETURN 'Only the supervisor decides milestones.'; END IF;
       SELECT * INTO s FROM cap_submissions WHERE project_id = c.id AND decision IS NULL ORDER BY id DESC LIMIT 1 FOR UPDATE;
       IF NOT FOUND THEN RETURN 'Nothing is waiting for a decision.'; END IF;
       IF p_step = 'revise' AND length(trim(coalesce(p->>'note', ''))) < 10 THEN RETURN 'Say what to revise (10+ characters).'; END IF;
       IF p_step = 'approve' AND s.milestone = 'final' AND c.second_reader_id IS NULL THEN RETURN 'Name a second reader before approving the final.'; END IF;
       UPDATE cap_submissions SET decision = CASE WHEN p_step = 'approve' THEN 'approved' ELSE 'revise' END, note = trim(coalesce(p->>'note', '')), decided_by = p_actor, decided_at = now() WHERE id = s.id;
     ELSIF p_step = 'score' THEN
       v_role := CASE WHEN p_actor = c.supervisor_id THEN 'supervisor' WHEN p_actor = c.second_reader_id THEN 'second_reader' END;
       IF v_role IS NULL THEN RETURN 'Only the supervisor and the second reader score.'; END IF;
       IF c.state <> 'active' OR cap_current(c.id) IS NOT NULL THEN RETURN 'Scoring opens once the final milestone is approved.'; END IF;
       IF EXISTS (SELECT 1 FROM cap_scores WHERE project_id = c.id AND role = v_role) THEN RETURN 'You have already scored this capstone.'; END IF;
       IF EXISTS (SELECT 1 FROM unnest(ARRAY[p->>'question', p->>'method', p->>'evidence', p->>'communication']) x WHERE x IS NULL OR x !~ '^[1-4]$') THEN RETURN 'Score each criterion from 1 to 4.'; END IF;
       IF length(trim(coalesce(p->>'comment', ''))) < 20 THEN RETURN 'Add a comment explaining your scores (20+ characters).'; END IF;
       INSERT INTO cap_scores (project_id, reader_id, role, question, method, evidence, communication, comment)
         VALUES (c.id, p_actor, v_role, (p->>'question')::int, (p->>'method')::int, (p->>'evidence')::int, (p->>'communication')::int, trim(p->>'comment'));
       IF (SELECT count(*) FROM cap_scores WHERE project_id = c.id) = 2 THEN UPDATE cap_projects SET state = 'evaluated' WHERE id = c.id; END IF;
     ELSIF p_step = 'withdraw' THEN
       IF p_actor <> c.student_id THEN RETURN 'Only the student withdraws.'; END IF;
       IF c.state NOT IN ('proposed', 'active') THEN RETURN 'This capstone can no longer be withdrawn.'; END IF;
       UPDATE cap_projects SET state = 'withdrawn' WHERE id = c.id;
     ELSE RETURN 'Unknown step.'; END IF;
     UPDATE cap_projects SET version = version + 1 WHERE id = c.id;
     PERFORM cap_log(p_tenant, c.id, p_actor, p_step, coalesce(p->>'note', p->>'milestone', ''));
     RETURN 'ok:' || c.id;
   END $$`,
];
