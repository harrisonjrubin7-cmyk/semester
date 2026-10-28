// Assignment versions (lib/assignmentRules.ts). The instructor of record keeps one draft per assignment (expected-version
// saves); publishing freezes the draft as an append-only numbered version with a content hash; a revision is a new version.
// Student tasks are linked to the assignment, and a submission receipt records the version current when it was submitted,
// so changing the assignment later never changes what a student was given or what they handed in against.
export const ASG_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS asg_assignments (id bigserial PRIMARY KEY, tenant_id text NOT NULL, section_id text NOT NULL, created_by text NOT NULL,
     draft jsonb NOT NULL CHECK (jsonb_typeof(draft) = 'object' AND octet_length(draft::text) <= 40000), draft_version int NOT NULL DEFAULT 1,
     current_version int NOT NULL DEFAULT 0, state text NOT NULL DEFAULT 'Draft' CHECK (state IN ('Draft','Published','Closed')),
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS asg_assignments_section ON asg_assignments (tenant_id, section_id)`,
  `CREATE TABLE IF NOT EXISTS asg_versions (id bigserial PRIMARY KEY, assignment_id bigint NOT NULL REFERENCES asg_assignments(id), version int NOT NULL CHECK (version >= 1),
     content jsonb NOT NULL, content_sha256 text NOT NULL, changes text[] NOT NULL DEFAULT '{}', note text NOT NULL DEFAULT '',
     published_by text NOT NULL, published_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE (assignment_id, version))`,
  `CREATE TABLE IF NOT EXISTS asg_task_links (assignment_id bigint NOT NULL REFERENCES asg_assignments(id), task_id text NOT NULL UNIQUE, student_id text NOT NULL,
     linked_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (assignment_id, student_id))`,
  `CREATE OR REPLACE FUNCTION asg_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Published assignment versions cannot be changed.'; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'asg_versions_append_only') THEN
     CREATE TRIGGER asg_versions_append_only BEFORE UPDATE OR DELETE ON asg_versions FOR EACH ROW EXECUTE FUNCTION asg_refuse_change(); END IF; END $$`,
  `CREATE OR REPLACE FUNCTION asg_save_draft(p_actor text, p_tenant text, p_section text, p_is_instructor boolean, p_id bigint, p_draft jsonb, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a asg_assignments%ROWTYPE; nid bigint;
   BEGIN
     IF NOT coalesce(p_is_instructor, false) THEN RETURN 'Only the instructor of record edits assignments.'; END IF;
     IF p_id IS NULL THEN
       INSERT INTO asg_assignments (tenant_id, section_id, created_by, draft) VALUES (p_tenant, p_section, p_actor, p_draft) RETURNING id INTO nid;
       RETURN 'ok:' || nid || ':1';
     END IF;
     SELECT * INTO a FROM asg_assignments WHERE id = p_id AND tenant_id = p_tenant AND section_id = p_section FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Assignment not found.'; END IF;
     IF a.state = 'Closed' THEN RETURN 'This assignment is closed.'; END IF;
     IF a.draft_version <> coalesce(p_expected, -1) THEN RETURN 'Someone saved this draft since you opened it. Reload to see their changes.'; END IF;
     UPDATE asg_assignments SET draft = p_draft, draft_version = draft_version + 1, updated_at = now() WHERE id = a.id;
     RETURN 'ok:' || a.id || ':' || (a.draft_version + 1);
   END $$`,
  // p_valid and p_changes come from the server's own check of the stored draft (lib/assignmentRules.ts), never the browser.
  `CREATE OR REPLACE FUNCTION asg_publish(p_actor text, p_tenant text, p_id bigint, p_is_instructor boolean, p_expected int, p_valid boolean, p_changes text[], p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a asg_assignments%ROWTYPE; h text; prev text;
   BEGIN
     IF NOT coalesce(p_is_instructor, false) THEN RETURN 'Only the instructor of record publishes assignments.'; END IF;
     SELECT * INTO a FROM asg_assignments WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Assignment not found.'; END IF;
     IF a.state = 'Closed' THEN RETURN 'This assignment is closed.'; END IF;
     IF a.draft_version <> coalesce(p_expected, -1) THEN RETURN 'The draft changed since you previewed it. Preview again before publishing.'; END IF;
     IF NOT coalesce(p_valid, false) THEN RETURN 'The draft has problems; fix them before publishing.'; END IF;
     h := encode(sha256(convert_to(a.draft::text, 'UTF8')), 'hex');
     SELECT content_sha256 INTO prev FROM asg_versions WHERE assignment_id = a.id AND version = a.current_version;
     IF prev = h THEN RETURN 'Nothing changed since version ' || a.current_version || '.'; END IF;
     INSERT INTO asg_versions (assignment_id, version, content, content_sha256, changes, note, published_by)
       VALUES (a.id, a.current_version + 1, a.draft, h, coalesce(p_changes, '{}'), coalesce(p_note, ''), p_actor);
     UPDATE asg_assignments SET current_version = a.current_version + 1, state = 'Published', updated_at = now() WHERE id = a.id;
     RETURN 'ok:' || (a.current_version + 1);
   END $$`,
  `CREATE OR REPLACE FUNCTION asg_link_task(p_tenant text, p_id bigint, p_task text, p_student text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM asg_assignments WHERE id = p_id AND tenant_id = p_tenant AND state = 'Published') THEN RETURN 'Only a published assignment is given to students.'; END IF;
     INSERT INTO asg_task_links (assignment_id, task_id, student_id) VALUES (p_id, p_task, p_student) ON CONFLICT DO NOTHING;
     RETURN 'ok';
   END $$`,
];
