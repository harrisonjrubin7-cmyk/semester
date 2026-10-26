// Migration grd-001: graduate milestones (Graduate Student app; committee members use it from the Faculty side).
// Blueprint flow: establish plan → confirm committee → track milestones → submit versions → obtain reviews → schedule defense.
// Rules: the student invites; a faculty member joins only by accepting; committee members see only the milestones of students
// whose committee they accepted. A version is approved when the chair approves it and no accepted member asked for revisions
// on that same version; a new submission starts a new version and voids earlier reviews. The defense can only be submitted once
// a full draft is approved. Nobody reviews their own work. Funding entries are the student's own notes, never official aid.
// One function call = one transaction; events append-only; tenant always from the caller's membership.
export const GRD_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS grd_committee (tenant_id text NOT NULL, student_id text NOT NULL, member_id text NOT NULL,
     role text NOT NULL CHECK (role IN ('chair', 'member')), state text NOT NULL DEFAULT 'invited' CHECK (state IN ('invited', 'accepted', 'declined', 'removed')),
     invited_at timestamptz NOT NULL DEFAULT now(), responded_at timestamptz, PRIMARY KEY (tenant_id, student_id, member_id), CHECK (member_id <> student_id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS grd_one_chair ON grd_committee (tenant_id, student_id) WHERE role = 'chair' AND state IN ('invited', 'accepted')`,
  `CREATE TABLE IF NOT EXISTS grd_milestones (id text PRIMARY KEY, number serial, tenant_id text NOT NULL, student_id text NOT NULL,
     kind text NOT NULL CHECK (kind IN ('program_plan', 'proposal', 'qualifying_exam', 'prospectus', 'full_draft', 'defense', 'final_submission')),
     title text NOT NULL CHECK (length(title) BETWEEN 3 AND 200), due_on date,
     state text NOT NULL DEFAULT 'planned' CHECK (state IN ('planned', 'under_review', 'revisions', 'approved')),
     version int NOT NULL DEFAULT 0, summary text, link text, scheduled_at timestamptz, approved_at timestamptz,
     created_at timestamptz NOT NULL DEFAULT now(), CHECK (link IS NULL OR link LIKE 'https://%'))`,
  `CREATE TABLE IF NOT EXISTS grd_reviews (milestone_id text NOT NULL REFERENCES grd_milestones(id), version int NOT NULL, member_id text NOT NULL,
     decision text NOT NULL CHECK (decision IN ('approve', 'revise')), note text NOT NULL, at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (milestone_id, version, member_id))`,
  `CREATE TABLE IF NOT EXISTS grd_funding (id text PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL,
     kind text NOT NULL CHECK (kind IN ('assistantship', 'fellowship', 'grant', 'other')), source text NOT NULL, term text NOT NULL, hours_per_week numeric,
     note text NOT NULL DEFAULT '', removed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS grd_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION grd_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS grd_events_append_only ON grd_events`,
  `CREATE TRIGGER grd_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON grd_events FOR EACH STATEMENT EXECUTE FUNCTION grd_refuse_change()`,
  `DROP TRIGGER IF EXISTS grd_reviews_append_only ON grd_reviews`,
  `CREATE TRIGGER grd_reviews_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON grd_reviews FOR EACH STATEMENT EXECUTE FUNCTION grd_refuse_change()`,
  `CREATE OR REPLACE FUNCTION grd_is_member(p_tenant text, p_student text, p_member text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM grd_committee WHERE tenant_id = p_tenant AND student_id = p_student AND member_id = p_member AND state = 'accepted') $$`,
  // The endpoint checks that p_member is Faculty in this institution before calling.
  `CREATE OR REPLACE FUNCTION grd_invite(p_student text, p_tenant text, p_member text, p_role text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_member = p_student THEN RETURN 'You cannot serve on your own committee.'; END IF;
     IF p_role = 'chair' AND EXISTS (SELECT 1 FROM grd_committee WHERE tenant_id = p_tenant AND student_id = p_student AND role = 'chair' AND state IN ('invited','accepted') AND member_id <> p_member) THEN
       RETURN 'You already have a chair or a pending chair invitation.'; END IF;
     INSERT INTO grd_committee (tenant_id, student_id, member_id, role) VALUES (p_tenant, p_student, p_member, p_role)
       ON CONFLICT (tenant_id, student_id, member_id) DO UPDATE SET role = p_role, state = 'invited', invited_at = now(), responded_at = NULL;
     INSERT INTO grd_events (tenant_id, student_id, actor_id, action, detail) VALUES (p_tenant, p_student, p_student, 'invited', p_member || ':' || p_role);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION grd_respond(p_member text, p_tenant text, p_student text, p_accept boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     UPDATE grd_committee SET state = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END, responded_at = now()
       WHERE tenant_id = p_tenant AND student_id = p_student AND member_id = p_member AND state = 'invited';
     IF NOT FOUND THEN RETURN 'No pending invitation.'; END IF;
     INSERT INTO grd_events (tenant_id, student_id, actor_id, action) VALUES (p_tenant, p_student, p_member, CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION grd_remove(p_student text, p_tenant text, p_member text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     UPDATE grd_committee SET state = 'removed', responded_at = now() WHERE tenant_id = p_tenant AND student_id = p_student AND member_id = p_member AND state IN ('invited','accepted');
     IF NOT FOUND THEN RETURN 'Not on your committee.'; END IF;
     INSERT INTO grd_events (tenant_id, student_id, actor_id, action, detail) VALUES (p_tenant, p_student, p_student, 'removed', p_member);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION grd_plan(p_student text, p_tenant text, p_id text, p_kind text, p_title text, p_due date) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF EXISTS (SELECT 1 FROM grd_milestones WHERE id = p_id) THEN RETURN NULL; END IF;
     IF length(trim(coalesce(p_title, ''))) < 3 THEN RETURN 'Give the milestone a title.'; END IF;
     INSERT INTO grd_milestones (id, tenant_id, student_id, kind, title, due_on) VALUES (p_id, p_tenant, p_student, p_kind, trim(p_title), p_due);
     INSERT INTO grd_events (tenant_id, student_id, actor_id, action, detail) VALUES (p_tenant, p_student, p_student, 'planned', p_kind);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION grd_submit(p_student text, p_tenant text, p_id text, p_summary text, p_link text, p_scheduled timestamptz) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE m grd_milestones%ROWTYPE;
   BEGIN
     SELECT * INTO m FROM grd_milestones WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR m.tenant_id <> p_tenant OR m.student_id <> p_student THEN RETURN 'Milestone not found.'; END IF;
     IF m.state = 'approved' THEN RETURN 'This milestone is already approved.'; END IF;
     IF m.state = 'under_review' THEN RETURN 'This version is still under review.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM grd_committee WHERE tenant_id = p_tenant AND student_id = p_student AND role = 'chair' AND state = 'accepted') THEN
       RETURN 'Your committee chair must accept before you submit for review.'; END IF;
     IF length(trim(coalesce(p_summary, ''))) < 10 THEN RETURN 'Summarize what you are submitting (10+ characters).'; END IF;
     IF p_link IS NOT NULL AND p_link NOT LIKE 'https://%' THEN RETURN 'Share the document as an https link.'; END IF;
     IF m.kind = 'defense' THEN
       IF NOT EXISTS (SELECT 1 FROM grd_milestones WHERE tenant_id = p_tenant AND student_id = p_student AND kind = 'full_draft' AND state = 'approved') THEN
         RETURN 'Your full draft must be approved before you schedule the defense.'; END IF;
       IF p_scheduled IS NULL OR p_scheduled < now() THEN RETURN 'Propose a future defense date.'; END IF;
     END IF;
     UPDATE grd_milestones SET state = 'under_review', version = version + 1, summary = trim(p_summary), link = p_link, scheduled_at = coalesce(p_scheduled, scheduled_at) WHERE id = p_id;
     INSERT INTO grd_events (tenant_id, student_id, actor_id, action, detail) VALUES (p_tenant, p_student, p_student, 'submitted', p_id || ' v' || (m.version + 1));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION grd_review(p_member text, p_tenant text, p_id text, p_version int, p_decision text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE m grd_milestones%ROWTYPE; v_chair text; v_chair_ok boolean; v_revise boolean;
   BEGIN
     SELECT * INTO m FROM grd_milestones WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR m.tenant_id <> p_tenant THEN RETURN 'Milestone not found.'; END IF;
     IF m.student_id = p_member THEN RETURN 'You cannot review your own milestone.'; END IF;
     IF NOT grd_is_member(p_tenant, m.student_id, p_member) THEN RETURN 'Only accepted committee members review this milestone.'; END IF;
     IF m.state <> 'under_review' OR m.version <> p_version THEN RETURN 'This version is not open for review. Reload.'; END IF;
     IF length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Explain your decision to the student (10+ characters).'; END IF;
     IF EXISTS (SELECT 1 FROM grd_reviews WHERE milestone_id = p_id AND version = p_version AND member_id = p_member) THEN RETURN 'You already reviewed this version.'; END IF;
     INSERT INTO grd_reviews (milestone_id, version, member_id, decision, note) VALUES (p_id, p_version, p_member, p_decision, trim(p_note));
     SELECT member_id INTO v_chair FROM grd_committee WHERE tenant_id = p_tenant AND student_id = m.student_id AND role = 'chair' AND state = 'accepted';
     SELECT EXISTS (SELECT 1 FROM grd_reviews WHERE milestone_id = p_id AND version = p_version AND member_id = v_chair AND decision = 'approve') INTO v_chair_ok;
     SELECT EXISTS (SELECT 1 FROM grd_reviews r JOIN grd_committee c ON c.member_id = r.member_id AND c.student_id = m.student_id AND c.tenant_id = p_tenant AND c.state = 'accepted'
       WHERE r.milestone_id = p_id AND r.version = p_version AND r.decision = 'revise') INTO v_revise;
     IF v_revise THEN UPDATE grd_milestones SET state = 'revisions' WHERE id = p_id;
     ELSIF v_chair_ok THEN UPDATE grd_milestones SET state = 'approved', approved_at = now() WHERE id = p_id; END IF;
     INSERT INTO grd_events (tenant_id, student_id, actor_id, action, detail) VALUES (p_tenant, m.student_id, p_member, 'review_' || p_decision, p_id || ' v' || p_version);
     RETURN NULL;
   END $$`,
];
