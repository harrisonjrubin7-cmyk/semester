// Migration hrm-001: human resources (S-76 E05; mirrors lib/hrRules.ts).
// HR owns employment facts; identity (an administrator) owns access execution; pay is out of scope (payroll, E07, is blocked).
// An appointment is proposed by an HR officer and approved by a different HR approver; neither may be the employee. Approval
// raises an access request that an administrator executes (the endpoint then adds the position's role to the membership);
// ending employment raises a removal request executed the same way, removing only that role and never the learner's own
// access. Leave is requested by the employee and decided by an approver who is not the employee; whether someone is on leave
// on a date is projected from approved leave, not stored. Personnel documents are references, visible only to HR staff and the
// employee, and every view is logged. Roles are granted by an administrator, never self. Expected-version; append-only history.
export const HRM_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS hrm_staff (tenant_id text NOT NULL, user_id text NOT NULL, role text NOT NULL CHECK (role IN ('officer','approver')),
     granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id, role), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS hrm_positions (id bigserial PRIMARY KEY, tenant_id text NOT NULL, code text NOT NULL CHECK (code ~ '^[A-Z0-9-]{2,20}$'),
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200), department text NOT NULL DEFAULT '' CHECK (length(department) <= 120),
     grants_role text NOT NULL CHECK (grants_role IN ('Staff','Faculty','Tutor','Advisor')), fte numeric NOT NULL DEFAULT 1 CHECK (fte > 0 AND fte <= 1),
     state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','filled','closed')), created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, code))`,
  `CREATE TABLE IF NOT EXISTS hrm_employments (id bigserial PRIMARY KEY, tenant_id text NOT NULL, position_id bigint NOT NULL REFERENCES hrm_positions(id), person_id text NOT NULL,
     state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed','approved','active','ended','withdrawn')),
     start_date date NOT NULL, end_date date, end_reason text NOT NULL DEFAULT '', proposed_by text NOT NULL, approved_by text,
     access_state text NOT NULL DEFAULT 'none' CHECK (access_state IN ('none','requested','provisioned','removal_requested','removed')),
     access_by text, ended_by text, version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (proposed_by <> person_id), CHECK (approved_by IS NULL OR (approved_by <> proposed_by AND approved_by <> person_id)),
     CHECK (state IN ('proposed','withdrawn') OR approved_by IS NOT NULL),
     CHECK (state <> 'active' OR access_state = 'provisioned'),
     CHECK (access_by IS NULL OR access_by <> person_id),
     CHECK (state <> 'ended' OR (end_date IS NOT NULL AND length(trim(end_reason)) >= 5 AND access_state IN ('removal_requested','removed','none'))),
     CHECK (end_date IS NULL OR end_date >= start_date))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS hrm_one_live_per_position ON hrm_employments (position_id) WHERE state IN ('proposed','approved','active')`,
  `CREATE TABLE IF NOT EXISTS hrm_tasks (id bigserial PRIMARY KEY, employment_id bigint NOT NULL REFERENCES hrm_employments(id), kind text NOT NULL CHECK (kind IN ('onboarding','offboarding')),
     item text NOT NULL, done_by text, done_at timestamptz, UNIQUE (employment_id, kind, item))`,
  `CREATE TABLE IF NOT EXISTS hrm_leave (id bigserial PRIMARY KEY, employment_id bigint NOT NULL REFERENCES hrm_employments(id), kind text NOT NULL CHECK (kind IN ('vacation','sick','parental','unpaid','other')),
     from_date date NOT NULL, to_date date NOT NULL, reason text NOT NULL DEFAULT '' CHECK (length(reason) <= 1000), requested_by text NOT NULL,
     state text NOT NULL DEFAULT 'requested' CHECK (state IN ('requested','approved','denied','cancelled')), decided_by text, decision_note text NOT NULL DEFAULT '',
     created_at timestamptz NOT NULL DEFAULT now(), CHECK (to_date >= from_date), CHECK (decided_by IS NULL OR decided_by <> requested_by))`,
  `CREATE TABLE IF NOT EXISTS hrm_docs (id bigserial PRIMARY KEY, employment_id bigint NOT NULL REFERENCES hrm_employments(id), title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 200),
     ref text NOT NULL CHECK (length(trim(ref)) BETWEEN 3 AND 500), added_by text NOT NULL, added_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS hrm_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL, ref bigint, step text NOT NULL, actor_id text NOT NULL,
     note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION hrm_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'hrm_events_append_only') THEN
       CREATE TRIGGER hrm_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON hrm_events FOR EACH STATEMENT EXECUTE FUNCTION hrm_refuse_change(); END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'hrm_docs_append_only') THEN
       CREATE TRIGGER hrm_docs_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON hrm_docs FOR EACH STATEMENT EXECUTE FUNCTION hrm_refuse_change(); END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION hrm_has(p_tenant text, p_user text, p_role text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM hrm_staff WHERE tenant_id = p_tenant AND user_id = p_user AND role = p_role AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION hrm_on_leave(p_employment bigint, p_day date) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM hrm_leave WHERE employment_id = p_employment AND state = 'approved' AND p_day BETWEEN from_date AND to_date) $$`,
  `CREATE OR REPLACE FUNCTION hrm_set_staff(p_admin text, p_tenant text, p_user text, p_role text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own HR access.'; END IF;
     IF p_role NOT IN ('officer','approver') THEN RETURN 'Unknown role.'; END IF;
     IF p_on THEN INSERT INTO hrm_staff (tenant_id, user_id, role, granted_by) VALUES (p_tenant, p_user, p_role, p_admin)
       ON CONFLICT (tenant_id, user_id, role) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE hrm_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND role = p_role AND revoked_at IS NULL; END IF;
     INSERT INTO hrm_events (tenant_id, subject, step, actor_id, note) VALUES (p_tenant, 'staff', CASE WHEN p_on THEN 'grant' ELSE 'revoke' END, p_admin, p_user || ' ' || p_role);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION hrm_position(p_actor text, p_tenant text, p_code text, p_title text, p_dept text, p_role text, p_fte numeric) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT hrm_has(p_tenant, p_actor, 'officer') THEN RETURN 'Only an HR officer manages positions.'; END IF;
     IF EXISTS (SELECT 1 FROM hrm_positions WHERE tenant_id = p_tenant AND code = upper(trim(p_code))) THEN RETURN 'That position code is already used.'; END IF;
     INSERT INTO hrm_positions (tenant_id, code, title, department, grants_role, fte, created_by) VALUES (p_tenant, upper(trim(p_code)), trim(p_title), coalesce(p_dept, ''), p_role, p_fte, p_actor)
       RETURNING id INTO v_id;
     INSERT INTO hrm_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'position', v_id, 'create', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION hrm_propose(p_actor text, p_tenant text, p_position bigint, p_person text, p_start date) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE p hrm_positions; v_id bigint;
   BEGIN
     IF NOT hrm_has(p_tenant, p_actor, 'officer') THEN RETURN 'Only an HR officer proposes an appointment.'; END IF;
     IF p_actor = p_person THEN RETURN 'Someone else proposes your own appointment.'; END IF;
     SELECT * INTO p FROM hrm_positions WHERE id = p_position AND tenant_id = p_tenant FOR UPDATE;
     IF p.id IS NULL OR p.state <> 'open' THEN RETURN 'That position is not open.'; END IF;
     IF EXISTS (SELECT 1 FROM hrm_employments WHERE position_id = p_position AND state IN ('proposed','approved','active')) THEN RETURN 'That position already has an appointment in progress.'; END IF;
     INSERT INTO hrm_employments (tenant_id, position_id, person_id, start_date, proposed_by) VALUES (p_tenant, p_position, p_person, p_start, p_actor) RETURNING id INTO v_id;
     INSERT INTO hrm_tasks (employment_id, kind, item) SELECT v_id, 'onboarding', x FROM unnest(ARRAY['Signed offer on file','Policy acknowledgements','Access provisioned']) x;
     INSERT INTO hrm_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'employment', v_id, 'propose', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION hrm_decide(p_actor text, p_tenant text, p_emp bigint, p_approve boolean, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e hrm_employments;
   BEGIN
     IF NOT hrm_has(p_tenant, p_actor, 'approver') THEN RETURN 'Only an HR approver approves an appointment.'; END IF;
     SELECT * INTO e FROM hrm_employments WHERE id = p_emp AND tenant_id = p_tenant FOR UPDATE;
     IF e.id IS NULL THEN RETURN 'Appointment not found.'; END IF;
     IF e.version <> p_version THEN RETURN 'This appointment changed since you opened it. Reload and try again.'; END IF;
     IF e.state <> 'proposed' THEN RETURN 'Only proposed appointments are decided.'; END IF;
     IF p_actor IN (e.proposed_by, e.person_id) THEN RETURN 'A different approver decides: not the proposer and not the employee.'; END IF;
     IF p_approve THEN
       UPDATE hrm_employments SET state = 'approved', approved_by = p_actor, access_state = 'requested', version = version + 1 WHERE id = p_emp;
       UPDATE hrm_positions SET state = 'filled' WHERE id = e.position_id;
     ELSE UPDATE hrm_employments SET state = 'withdrawn', version = version + 1 WHERE id = p_emp; END IF;
     INSERT INTO hrm_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'employment', p_emp, CASE WHEN p_approve THEN 'approve' ELSE 'withdraw' END, p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION hrm_access(p_actor text, p_tenant text, p_emp bigint, p_step text, p_is_admin boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e hrm_employments;
   BEGIN
     IF NOT p_is_admin THEN RETURN 'Access changes are executed by an administrator (identity), not by HR.'; END IF;
     SELECT * INTO e FROM hrm_employments WHERE id = p_emp AND tenant_id = p_tenant FOR UPDATE;
     IF e.id IS NULL THEN RETURN 'Appointment not found.'; END IF;
     IF p_actor = e.person_id THEN RETURN 'Someone else changes your own access.'; END IF;
     IF p_step = 'provisioned' THEN
       IF e.access_state <> 'requested' OR e.state <> 'approved' THEN RETURN 'No access request is waiting for this appointment.'; END IF;
       UPDATE hrm_employments SET access_state = 'provisioned', state = 'active', access_by = p_actor, version = version + 1 WHERE id = p_emp;
       UPDATE hrm_tasks SET done_by = p_actor, done_at = now() WHERE employment_id = p_emp AND kind = 'onboarding' AND item = 'Access provisioned';
     ELSIF p_step = 'removed' THEN
       IF e.access_state <> 'removal_requested' THEN RETURN 'No access removal is waiting for this appointment.'; END IF;
       UPDATE hrm_employments SET access_state = 'removed', access_by = p_actor, version = version + 1 WHERE id = p_emp;
       UPDATE hrm_tasks SET done_by = p_actor, done_at = now() WHERE employment_id = p_emp AND kind = 'offboarding' AND item = 'Access removed';
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO hrm_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'access', p_emp, p_step, p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION hrm_end(p_actor text, p_tenant text, p_emp bigint, p_end date, p_reason text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e hrm_employments;
   BEGIN
     IF NOT hrm_has(p_tenant, p_actor, 'officer') THEN RETURN 'Only an HR officer ends employment.'; END IF;
     SELECT * INTO e FROM hrm_employments WHERE id = p_emp AND tenant_id = p_tenant FOR UPDATE;
     IF e.id IS NULL THEN RETURN 'Appointment not found.'; END IF;
     IF p_actor = e.person_id THEN RETURN 'Someone else ends your own employment.'; END IF;
     IF e.version <> p_version THEN RETURN 'This appointment changed since you opened it. Reload and try again.'; END IF;
     IF e.state NOT IN ('approved','active') THEN RETURN 'Only current employment can end.'; END IF;
     IF length(trim(coalesce(p_reason, ''))) < 5 THEN RETURN 'Record the reason.'; END IF;
     IF p_end < e.start_date THEN RETURN 'The end date is before the start date.'; END IF;
     UPDATE hrm_employments SET state = 'ended', end_date = p_end, end_reason = trim(p_reason), ended_by = p_actor, version = version + 1,
       access_state = CASE WHEN access_state IN ('provisioned') THEN 'removal_requested' WHEN access_state = 'requested' THEN 'none' ELSE access_state END WHERE id = p_emp;
     UPDATE hrm_positions SET state = 'open' WHERE id = e.position_id AND state = 'filled';
     INSERT INTO hrm_tasks (employment_id, kind, item) SELECT p_emp, 'offboarding', x FROM unnest(ARRAY['Equipment returned','Final documents on file','Access removed']) x ON CONFLICT DO NOTHING;
     INSERT INTO hrm_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'employment', p_emp, 'end', p_actor, trim(p_reason));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION hrm_task(p_actor text, p_tenant text, p_task bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE t hrm_tasks; e hrm_employments;
   BEGIN
     IF NOT hrm_has(p_tenant, p_actor, 'officer') THEN RETURN 'Only an HR officer completes checklist items.'; END IF;
     SELECT * INTO t FROM hrm_tasks WHERE id = p_task FOR UPDATE;
     SELECT * INTO e FROM hrm_employments WHERE id = t.employment_id AND tenant_id = p_tenant;
     IF t.id IS NULL OR e.id IS NULL THEN RETURN 'Item not found.'; END IF;
     IF t.item IN ('Access provisioned','Access removed') THEN RETURN 'Access items are completed when an administrator executes the change.'; END IF;
     IF t.done_at IS NOT NULL THEN RETURN NULL; END IF;
     UPDATE hrm_tasks SET done_by = p_actor, done_at = now() WHERE id = p_task;
     INSERT INTO hrm_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'task', e.id, t.kind, p_actor, t.item);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION hrm_leave_request(p_person text, p_tenant text, p_emp bigint, p_kind text, p_from date, p_to date, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e hrm_employments; v_id bigint;
   BEGIN
     SELECT * INTO e FROM hrm_employments WHERE id = p_emp AND tenant_id = p_tenant AND person_id = p_person;
     IF e.id IS NULL OR e.state <> 'active' THEN RETURN 'Leave is requested on your own current employment.'; END IF;
     IF p_to < p_from THEN RETURN 'Leave ends after it starts.'; END IF;
     IF e.end_date IS NOT NULL AND p_to > e.end_date THEN RETURN 'Leave cannot run past the end of employment.'; END IF;
     IF EXISTS (SELECT 1 FROM hrm_leave WHERE employment_id = p_emp AND state IN ('requested','approved') AND from_date <= p_to AND p_from <= to_date) THEN RETURN 'This overlaps leave you already requested.'; END IF;
     INSERT INTO hrm_leave (employment_id, kind, from_date, to_date, reason, requested_by) VALUES (p_emp, p_kind, p_from, p_to, coalesce(p_reason, ''), p_person) RETURNING id INTO v_id;
     INSERT INTO hrm_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'leave', v_id, 'request', p_person);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION hrm_leave_decide(p_actor text, p_tenant text, p_leave bigint, p_approve boolean, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE l hrm_leave; e hrm_employments;
   BEGIN
     IF NOT hrm_has(p_tenant, p_actor, 'approver') THEN RETURN 'Only an HR approver decides leave.'; END IF;
     SELECT * INTO l FROM hrm_leave WHERE id = p_leave FOR UPDATE;
     SELECT * INTO e FROM hrm_employments WHERE id = l.employment_id AND tenant_id = p_tenant;
     IF l.id IS NULL OR e.id IS NULL THEN RETURN 'Leave request not found.'; END IF;
     IF p_actor = l.requested_by THEN RETURN 'Someone else decides your own leave.'; END IF;
     IF l.state <> 'requested' THEN RETURN 'Already decided.'; END IF;
     IF NOT p_approve AND length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say why leave is declined.'; END IF;
     UPDATE hrm_leave SET state = CASE WHEN p_approve THEN 'approved' ELSE 'denied' END, decided_by = p_actor, decision_note = coalesce(trim(p_note), '') WHERE id = p_leave;
     INSERT INTO hrm_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'leave', p_leave, CASE WHEN p_approve THEN 'approve' ELSE 'deny' END, p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION hrm_doc_add(p_actor text, p_tenant text, p_emp bigint, p_title text, p_ref text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT hrm_has(p_tenant, p_actor, 'officer') THEN RETURN 'Only an HR officer files personnel documents.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM hrm_employments WHERE id = p_emp AND tenant_id = p_tenant) THEN RETURN 'Appointment not found.'; END IF;
     INSERT INTO hrm_docs (employment_id, title, ref, added_by) VALUES (p_emp, trim(p_title), trim(p_ref), p_actor) RETURNING id INTO v_id;
     INSERT INTO hrm_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'document', p_emp, 'file', p_actor, trim(p_title));
     RETURN 'ok:' || v_id;
   END $$`,
];
