// Migration dst-001: department staffing coordination (role app "Department Admin": staffing coordination). Builds on sreq-001
// (inst_departments, chair_id) and dfm-001 (dfm_admins, dfm_is_admin, dfm_is_chair).
// - A department admin posts a staffing need for a term and course: role, hours per week, how many people.
// - A department admin offers the need to a person in the institution; the department chair (not the admin who made the offer)
//   approves it; then only the person offered can accept or decline. Nobody offers a position to themselves.
// - Approved plus accepted offers never exceed the need's count (checked under a row lock); when accepted offers reach the count
//   the need is filled. One live offer per need and person.
// - Accepting records the staffing decision only. It grants no course access: the instructor adds the person through Course team.
// - Every step names the version it expects; history is append-only.
export const DST_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS dst_needs (id bigserial PRIMARY KEY, tenant_id text NOT NULL, department_id bigint NOT NULL REFERENCES inst_departments(id),
     term_code text NOT NULL CHECK (length(trim(term_code)) BETWEEN 2 AND 40), course_code text NOT NULL CHECK (length(trim(course_code)) BETWEEN 2 AND 40),
     role text NOT NULL CHECK (role IN ('teaching_assistant', 'grader', 'lab_instructor', 'instructor')), hours_per_week int NOT NULL CHECK (hours_per_week BETWEEN 1 AND 40),
     slots int NOT NULL CHECK (slots BETWEEN 1 AND 20), note text NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
     state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'filled', 'cancelled')), created_by text NOT NULL, version int NOT NULL DEFAULT 1,
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS dst_offers (id bigserial PRIMARY KEY, tenant_id text NOT NULL, need_id bigint NOT NULL REFERENCES dst_needs(id), person_id text NOT NULL,
     offered_by text NOT NULL, approved_by text, state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed', 'approved', 'accepted', 'declined', 'rejected', 'withdrawn')),
     note text NOT NULL DEFAULT '', version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     CHECK (person_id <> offered_by), CHECK (approved_by IS NULL OR approved_by <> offered_by), CHECK (state NOT IN ('approved', 'accepted') OR approved_by IS NOT NULL))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS dst_one_live ON dst_offers (need_id, person_id) WHERE state IN ('proposed', 'approved', 'accepted')`,
  `CREATE TABLE IF NOT EXISTS dst_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL CHECK (subject IN ('need', 'offer')),
     subject_id bigint NOT NULL, step text NOT NULL, to_state text NOT NULL, actor_id text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION dst_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'dst_events_append_only') THEN
       CREATE TRIGGER dst_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON dst_events FOR EACH STATEMENT EXECUTE FUNCTION dst_refuse_change();
     END IF;
   END $$`,

  // Needs: post (admin), edit (admin, open and no live offers), cancel (admin or chair). Returns 'ok:id' or a refusal.
  `CREATE OR REPLACE FUNCTION dst_need(p_tenant text, p_actor text, p_step text, p_id bigint, p_expected int, p_dept bigint, p_term text, p_course text, p_role text, p_hours int, p_slots int, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE n dst_needs; v_id bigint; v_to text;
   BEGIN
     IF p_step = 'post' THEN
       IF NOT EXISTS (SELECT 1 FROM inst_departments WHERE id = p_dept AND tenant_id = p_tenant) THEN RETURN 'Department not found.'; END IF;
       IF NOT dfm_is_admin(p_tenant, p_dept, p_actor) THEN RETURN 'Only that department''s admins post staffing needs.'; END IF;
       IF length(trim(coalesce(p_term, ''))) < 2 OR length(trim(coalesce(p_course, ''))) < 2 THEN RETURN 'Give the term and course.'; END IF;
       IF coalesce(p_role, '') NOT IN ('teaching_assistant', 'grader', 'lab_instructor', 'instructor') THEN RETURN 'Choose a role.'; END IF;
       IF coalesce(p_hours, 0) NOT BETWEEN 1 AND 40 OR coalesce(p_slots, 0) NOT BETWEEN 1 AND 20 THEN RETURN 'Hours must be 1–40 a week and positions 1–20.'; END IF;
       INSERT INTO dst_needs (tenant_id, department_id, term_code, course_code, role, hours_per_week, slots, note, created_by)
         VALUES (p_tenant, p_dept, trim(p_term), upper(trim(p_course)), p_role, p_hours, p_slots, coalesce(p_note, ''), p_actor) RETURNING id INTO v_id;
       INSERT INTO dst_events (tenant_id, subject, subject_id, step, to_state, actor_id) VALUES (p_tenant, 'need', v_id, 'post', 'open', p_actor);
       RETURN 'ok:' || v_id;
     END IF;
     SELECT * INTO n FROM dst_needs WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR n.tenant_id <> p_tenant OR NOT (dfm_is_admin(p_tenant, n.department_id, p_actor) OR dfm_is_chair(p_tenant, n.department_id, p_actor)) THEN RETURN 'Staffing need not found.'; END IF;
     IF p_expected IS DISTINCT FROM n.version THEN RETURN 'This need changed since you opened it. Refresh and try again.'; END IF;
     IF n.state <> 'open' THEN RETURN 'This need is closed.'; END IF;
     IF p_step = 'edit' THEN
       IF NOT dfm_is_admin(p_tenant, n.department_id, p_actor) THEN RETURN 'Only department admins edit a need.'; END IF;
       IF EXISTS (SELECT 1 FROM dst_offers WHERE need_id = n.id AND state IN ('proposed', 'approved', 'accepted')) THEN RETURN 'Offers are out on this need. Withdraw them before changing it.'; END IF;
       IF coalesce(p_hours, 0) NOT BETWEEN 1 AND 40 OR coalesce(p_slots, 0) NOT BETWEEN 1 AND 20 THEN RETURN 'Hours must be 1–40 a week and positions 1–20.'; END IF;
       UPDATE dst_needs SET hours_per_week = p_hours, slots = p_slots, note = coalesce(p_note, note) WHERE id = n.id; v_to := 'open';
     ELSIF p_step = 'cancel' THEN
       IF length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Say why it is cancelled (10+ characters). People with offers see this.'; END IF;
       UPDATE dst_offers SET state = 'withdrawn', note = trim(p_note), version = version + 1, updated_at = now() WHERE need_id = n.id AND state IN ('proposed', 'approved');
       UPDATE dst_needs SET state = 'cancelled', note = trim(p_note) WHERE id = n.id; v_to := 'cancelled';
     ELSE RETURN 'Unknown step.';
     END IF;
     UPDATE dst_needs SET version = version + 1, updated_at = now() WHERE id = n.id;
     INSERT INTO dst_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'need', n.id, p_step, v_to, p_actor, left(coalesce(p_note, ''), 600));
     RETURN 'ok:' || n.id;
   END $$`,

  // Offers. p_person must already be resolved by the server to a member of the institution.
  `CREATE OR REPLACE FUNCTION dst_offer(p_tenant text, p_actor text, p_step text, p_id bigint, p_expected int, p_need bigint, p_person text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE o dst_offers; n dst_needs; v_id bigint; v_to text; taken int; t text := trim(coalesce(p_note, ''));
   BEGIN
     IF p_step = 'offer' THEN
       SELECT * INTO n FROM dst_needs WHERE id = p_need FOR UPDATE;
       IF NOT FOUND OR n.tenant_id <> p_tenant OR NOT dfm_is_admin(p_tenant, n.department_id, p_actor) THEN RETURN 'Staffing need not found.'; END IF;
       IF n.state <> 'open' THEN RETURN 'This need is closed.'; END IF;
       IF p_person IS NULL OR p_person = p_actor THEN RETURN 'Offer it to someone other than yourself.'; END IF;
       IF EXISTS (SELECT 1 FROM dst_offers WHERE need_id = n.id AND person_id = p_person AND state IN ('proposed', 'approved', 'accepted')) THEN RETURN 'That person already has an offer for this need.'; END IF;
       INSERT INTO dst_offers (tenant_id, need_id, person_id, offered_by, note) VALUES (p_tenant, n.id, p_person, p_actor, t) RETURNING id INTO v_id;
       INSERT INTO dst_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'offer', v_id, 'offer', 'proposed', p_actor, p_person);
       RETURN 'ok:' || v_id;
     END IF;
     SELECT * INTO o FROM dst_offers WHERE id = p_id;
     IF NOT FOUND OR o.tenant_id <> p_tenant THEN RETURN 'Offer not found.'; END IF;
     SELECT * INTO n FROM dst_needs WHERE id = o.need_id FOR UPDATE;
     SELECT * INTO o FROM dst_offers WHERE id = p_id FOR UPDATE;
     IF NOT (o.person_id = p_actor OR dfm_is_admin(p_tenant, n.department_id, p_actor) OR dfm_is_chair(p_tenant, n.department_id, p_actor)) THEN RETURN 'Offer not found.'; END IF;
     IF p_expected IS DISTINCT FROM o.version THEN RETURN 'This offer changed since you opened it. Refresh and try again.'; END IF;
     IF n.state <> 'open' AND p_step <> 'withdraw' THEN RETURN 'This need is closed.'; END IF;
     SELECT count(*) INTO taken FROM dst_offers WHERE need_id = n.id AND state IN ('approved', 'accepted') AND id <> o.id;
     IF p_step IN ('approve', 'reject') THEN
       IF NOT dfm_is_chair(p_tenant, n.department_id, p_actor) THEN RETURN 'Only the department chair approves staffing offers.'; END IF;
       IF o.offered_by = p_actor THEN RETURN 'You made this offer, so it needs another person''s approval.'; END IF;
       IF o.state <> 'proposed' THEN RETURN 'This offer is not waiting for approval.'; END IF;
       IF p_step = 'approve' AND taken >= n.slots THEN RETURN 'All positions on this need are already approved or filled.'; END IF;
       IF p_step = 'reject' AND length(t) < 10 THEN RETURN 'Say why (10+ characters).'; END IF;
       v_to := CASE WHEN p_step = 'approve' THEN 'approved' ELSE 'rejected' END;
       UPDATE dst_offers SET state = v_to, approved_by = CASE WHEN p_step = 'approve' THEN p_actor ELSE approved_by END, note = CASE WHEN t = '' THEN note ELSE t END WHERE id = o.id;
     ELSIF p_step IN ('accept', 'decline') THEN
       IF o.person_id <> p_actor THEN RETURN 'Only the person offered the position answers it.'; END IF;
       IF o.state <> 'approved' THEN RETURN 'This offer is not ready to answer yet.'; END IF;
       v_to := CASE WHEN p_step = 'accept' THEN 'accepted' ELSE 'declined' END;
       UPDATE dst_offers SET state = v_to WHERE id = o.id;
       IF p_step = 'accept' AND taken + 1 >= n.slots AND (SELECT count(*) FROM dst_offers WHERE need_id = n.id AND state = 'accepted') >= n.slots THEN
         UPDATE dst_needs SET state = 'filled', version = version + 1, updated_at = now() WHERE id = n.id;
         INSERT INTO dst_events (tenant_id, subject, subject_id, step, to_state, actor_id) VALUES (p_tenant, 'need', n.id, 'filled', 'filled', p_actor);
       END IF;
     ELSIF p_step = 'withdraw' THEN
       IF NOT dfm_is_admin(p_tenant, n.department_id, p_actor) THEN RETURN 'Only department admins withdraw an offer.'; END IF;
       IF o.state NOT IN ('proposed', 'approved') THEN RETURN 'Only an unanswered offer can be withdrawn.'; END IF;
       IF length(t) < 10 THEN RETURN 'Say why (10+ characters). The person sees this.'; END IF;
       UPDATE dst_offers SET state = 'withdrawn', note = t WHERE id = o.id; v_to := 'withdrawn';
     ELSE RETURN 'Unknown step.';
     END IF;
     UPDATE dst_offers SET version = version + 1, updated_at = now() WHERE id = o.id;
     INSERT INTO dst_events (tenant_id, subject, subject_id, step, to_state, actor_id, note) VALUES (p_tenant, 'offer', o.id, p_step, v_to, p_actor, left(t, 600));
     RETURN NULL;
   END $$`,
];
