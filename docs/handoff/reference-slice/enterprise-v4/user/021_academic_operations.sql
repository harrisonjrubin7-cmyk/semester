-- 021_academic_operations.sql: term planner records (calendar milestones, rooms and bookings, section change requests, department
-- scheduling windows) for the Institution OS term planner. Schema semester, after 020. NOT executed or parsed.
BEGIN;
SET LOCAL search_path = semester, public;
SET LOCAL lock_timeout = '5s';

CREATE TABLE calendar_milestones (tenant_id uuid NOT NULL REFERENCES institutions(id), id uuid NOT NULL DEFAULT gen_random_uuid(), term_id uuid NOT NULL, label text NOT NULL, occurs_on date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('registration_window', 'classes_begin', 'add_deadline', 'drop_deadline', 'withdraw_deadline', 'exam_period', 'break', 'other')),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'published', 'withdrawn')), approved_by uuid, approved_at timestamptz, notice_sent_at timestamptz,
  PRIMARY KEY (tenant_id, id), FOREIGN KEY (tenant_id, term_id) REFERENCES academic_terms(tenant_id, id), CHECK (status <> 'published' OR approved_by IS NOT NULL));

CREATE TABLE rooms (tenant_id uuid NOT NULL REFERENCES institutions(id), id uuid NOT NULL DEFAULT gen_random_uuid(), campus_id uuid NOT NULL, building text NOT NULL, number text NOT NULL, capacity integer NOT NULL CHECK (capacity > 0),
  features text[] NOT NULL DEFAULT '{}', accessible boolean NOT NULL DEFAULT true, status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'offline')),
  PRIMARY KEY (tenant_id, id), UNIQUE (tenant_id, building, number), FOREIGN KEY (tenant_id, campus_id) REFERENCES campuses(tenant_id, id));
-- One booking per room per time: weekly meeting patterns expand to concrete occurrences, and the exclusion stops double-booking.
CREATE TABLE room_bookings (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), room_id uuid NOT NULL, section_id uuid, purpose text NOT NULL, during tstzrange NOT NULL,
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'confirmed', 'released')), PRIMARY KEY (tenant_id, id), FOREIGN KEY (tenant_id, room_id) REFERENCES rooms(tenant_id, id),
  CONSTRAINT no_double_booked_room EXCLUDE USING gist (room_id WITH =, during WITH &&) WHERE (status IN ('held', 'confirmed')));

CREATE TABLE department_scheduling_windows (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), term_id uuid NOT NULL, department_reference text NOT NULL, opens_at timestamptz NOT NULL, closes_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, id), FOREIGN KEY (tenant_id, term_id) REFERENCES academic_terms(tenant_id, id), CHECK (closes_at > opens_at));

-- Department edits are requests; only the registrar applies them to the section of record.
CREATE TABLE section_change_requests (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), section_id uuid NOT NULL, requested_by uuid NOT NULL,
  field text NOT NULL CHECK (field IN ('meeting_pattern', 'instructor', 'room', 'capacity_request', 'cancel')), proposed jsonb NOT NULL, reason text NOT NULL,
  status text NOT NULL DEFAULT 'department_submitted' CHECK (status IN ('draft', 'validation_pending', 'validation_failed', 'department_ready', 'department_submitted', 'chair_review', 'dean_review', 'registrar_review', 'room_coordination', 'academic_affairs_review', 'exception_review', 'approved', 'approved_for_publish', 'published', 'change_requested', 'locked', 'returned', 'rejected', 'denied', 'archived')),   -- names match your RBAC-matrix PDF; 'exception_review' = academic_affairs_review, 'approved' = approved_for_publish (kept for compatibility)
  is_exception boolean NOT NULL DEFAULT false,   -- non-standard meeting time, special room or unusual offering: needs dean + Academic Affairs
  conflict_codes text[] NOT NULL DEFAULT '{}', decided_by uuid, decided_at timestamptz, sis_transaction_id text,
  PRIMARY KEY (tenant_id, id), FOREIGN KEY (tenant_id, section_id) REFERENCES sections(tenant_id, id),
  CHECK (status <> 'published' OR (decided_by IS NOT NULL AND cardinality(conflict_codes) = 0)),   -- conflicts block publishing
  CHECK (decided_by IS NULL OR decided_by <> requested_by));                                         -- the requester can't approve

-- Submit (department scheduler): only inside the department's open window, only for sections in that department.
CREATE FUNCTION semester.submit_section_change(p_tenant uuid, p_section uuid, p_field text, p_proposed jsonb, p_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE me uuid := semester.actor_person(p_tenant); dept text; r uuid; codes text[] := '{}';
BEGIN
  SELECT c.subject_code INTO dept FROM semester.sections s JOIN semester.course_versions cv ON cv.tenant_id = s.tenant_id AND cv.id = s.course_version_id JOIN semester.courses c ON c.tenant_id = cv.tenant_id AND c.id = cv.course_id WHERE s.tenant_id = p_tenant AND s.id = p_section;
  IF dept IS NULL OR NOT semester.has_permission(p_tenant, 'schedule.department.edit', 'department', dept) THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN'; END IF;
  IF p_field IN ('room') THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ROOM_IS_REGISTRAR_ONLY'; END IF;
  IF NOT EXISTS (SELECT 1 FROM semester.department_scheduling_windows w JOIN semester.sections s ON s.tenant_id = w.tenant_id AND s.term_id = w.term_id WHERE w.tenant_id = p_tenant AND s.id = p_section AND w.department_reference = dept AND now() BETWEEN w.opens_at AND w.closes_at) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SCHEDULING_WINDOW_CLOSED'; END IF;
  IF p_field = 'instructor' AND NOT (p_proposed ? 'person_id') THEN codes := codes || 'INSTRUCTOR_MISSING'; END IF;
  INSERT INTO semester.section_change_requests(tenant_id, section_id, requested_by, field, proposed, reason, conflict_codes) VALUES (p_tenant, p_section, me, p_field, p_proposed, p_reason, codes) RETURNING id INTO r;
  PERFORM semester.write_audit(p_tenant, 'create', 'registrar', 'section_change_request', r, 'allow', 'SUBMITTED');
  RETURN r;
END $$;
-- Publish (registrar): conflicts must be empty; the SIS transaction id is recorded once YES confirms (via the outbox worker).
CREATE FUNCTION semester.approve_section_change(p_tenant uuid, p_request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE me uuid := semester.actor_person(p_tenant); r record;
BEGIN
  IF NOT semester.has_permission(p_tenant, 'schedule.registrar.publish') THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN'; END IF;
  SELECT * INTO r FROM semester.section_change_requests WHERE tenant_id = p_tenant AND id = p_request FOR UPDATE;
  IF NOT FOUND OR r.status NOT IN ('registrar_review', 'exception_review') THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NOT_PENDING'; END IF;
  IF cardinality(r.conflict_codes) > 0 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONFLICTS_UNRESOLVED'; END IF;
  IF r.requested_by = me THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'SELF_APPROVAL_FORBIDDEN'; END IF;
  IF r.is_exception AND r.status <> 'exception_review' THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'EXCEPTION_NEEDS_ACADEMIC_AFFAIRS'; END IF;
  UPDATE semester.section_change_requests SET status = 'approved', decided_by = me, decided_at = now() WHERE tenant_id = p_tenant AND id = p_request;
  INSERT INTO semester.outbox_events(tenant_id, event_type, payload) VALUES (p_tenant, 'registrar.section_change_approved', jsonb_build_object('request', p_request));
  PERFORM semester.write_audit(p_tenant, 'approve', 'registrar', 'section_change_request', p_request, 'allow', 'APPROVED_FOR_SIS');
END $$;

-- Approval chain (registrar state machine PDF): draft → validating → validation_failed | department_submitted → chair_review → dean_review →
-- registrar_review → [exception_review when is_exception] → approved → published. Chair and dean steps use permissions
-- 'schedule.chair.approve' (department scope) and 'schedule.dean.approve' (college scope); exceptions need 'schedule.exception.approve'.
-- Conflict engine: instructor double-booked, room double-booked or over capacity, non-standard meeting pattern. Returns codes; callers
-- store them in conflict_codes, which blocks approval and publishing.
CREATE FUNCTION semester.detect_schedule_conflicts(p_tenant uuid, p_section uuid, p_room uuid, p_instructor uuid, p_during tstzrange[], p_expected_enrollment integer, p_standard_patterns jsonb, p_pattern text)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $
DECLARE codes text[] := '{}'; cap integer;
BEGIN
  IF p_room IS NOT NULL AND EXISTS (SELECT 1 FROM semester.room_bookings b, unnest(p_during) d WHERE b.tenant_id = p_tenant AND b.room_id = p_room AND b.status IN ('held', 'confirmed') AND b.during && d AND b.section_id IS DISTINCT FROM p_section) THEN codes := codes || 'ROOM_OVERLAP'; END IF;
  IF p_room IS NOT NULL THEN SELECT capacity INTO cap FROM semester.rooms WHERE tenant_id = p_tenant AND id = p_room; IF cap < p_expected_enrollment THEN codes := codes || 'ROOM_OVER_CAPACITY'; END IF; END IF;
  IF p_instructor IS NOT NULL AND EXISTS (SELECT 1 FROM semester.section_instructors si JOIN semester.room_bookings b ON b.tenant_id = si.tenant_id AND b.section_id = si.section_id, unnest(p_during) d
                                          WHERE si.tenant_id = p_tenant AND si.person_id = p_instructor AND si.section_id <> p_section AND b.status IN ('held', 'confirmed') AND b.during && d) THEN codes := codes || 'INSTRUCTOR_OVERLAP'; END IF;
  IF p_pattern IS NOT NULL AND NOT (p_standard_patterns ? p_pattern) THEN codes := codes || 'NON_STANDARD_PATTERN'; END IF;
  RETURN codes;
END $;

-- Term schedule lifecycle (term-scheduling PDF): one row per term; transitions only through set_term_stage, which enforces the order
-- and the gate rules (a term can't open for department build until time patterns, milestones and publication targets exist).
CREATE TABLE term_schedule_cycles (tenant_id uuid NOT NULL, term_id uuid NOT NULL,
  stage text NOT NULL DEFAULT 'draft' CHECK (stage IN ('draft', 'in_review', 'open_for_department_build', 'validation_failed', 'registrar_review', 'room_coordination', 'published', 'refine', 'locked', 'archived')),
  time_patterns jsonb, publish_target_at timestamptz, changed_by uuid, changed_at timestamptz NOT NULL DEFAULT now(), version bigint NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, term_id), FOREIGN KEY (tenant_id, term_id) REFERENCES academic_terms(tenant_id, id));
CREATE FUNCTION semester.set_term_stage(p_tenant uuid, p_term uuid, p_to text, p_expected_version bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $
DECLARE c record; allowed jsonb := '{"draft":["in_review"],"in_review":["draft","open_for_department_build"],"open_for_department_build":["validation_failed","registrar_review"],"validation_failed":["open_for_department_build","registrar_review"],"registrar_review":["open_for_department_build","room_coordination"],"room_coordination":["registrar_review","published"],"published":["refine","locked"],"refine":["locked"],"locked":["archived"],"archived":[]}';
BEGIN
  IF NOT semester.has_permission(p_tenant, 'schedule.registrar.publish') THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN'; END IF;
  SELECT * INTO c FROM semester.term_schedule_cycles WHERE tenant_id = p_tenant AND term_id = p_term FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'NOT_FOUND'; END IF;
  IF c.version <> p_expected_version THEN RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'VERSION_CONFLICT'; END IF;
  IF NOT (allowed -> c.stage) ? p_to THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ILLEGAL_STAGE_TRANSITION'; END IF;
  IF p_to = 'open_for_department_build' AND (c.time_patterns IS NULL OR c.publish_target_at IS NULL OR NOT EXISTS (SELECT 1 FROM semester.calendar_milestones m WHERE m.tenant_id = p_tenant AND m.term_id = p_term AND m.status = 'published')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TERM_NOT_READY_FOR_BUILD'; END IF;
  IF p_to = 'published' AND EXISTS (SELECT 1 FROM semester.section_change_requests r JOIN semester.sections s ON s.tenant_id = r.tenant_id AND s.id = r.section_id WHERE r.tenant_id = p_tenant AND s.term_id = p_term AND cardinality(r.conflict_codes) > 0 AND r.status NOT IN ('rejected', 'returned')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CONFLICTS_UNRESOLVED'; END IF;
  UPDATE semester.term_schedule_cycles SET stage = p_to, changed_by = semester.actor_person(p_tenant), changed_at = now(), version = version + 1 WHERE tenant_id = p_tenant AND term_id = p_term;
  PERFORM semester.write_audit(p_tenant, 'update', 'registrar', 'term_schedule_cycle', p_term, 'allow', 'STAGE_' || upper(p_to));
END $;
-- In refine mode, department changes are limited to scoped rights and go to a special review queue; locked terms accept only registrar corrections.

DO $ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['term_schedule_cycles', 'calendar_milestones', 'rooms', 'room_bookings', 'department_scheduling_windows', 'section_change_requests'] LOOP
    EXECUTE format('ALTER TABLE semester.%I ENABLE ROW LEVEL SECURITY', t); EXECUTE format('ALTER TABLE semester.%I FORCE ROW LEVEL SECURITY', t); EXECUTE format('REVOKE ALL ON semester.%I FROM PUBLIC, anon', t);
  END LOOP;
END $$;
GRANT SELECT ON semester.calendar_milestones, semester.rooms TO authenticated;
CREATE POLICY published ON semester.calendar_milestones FOR SELECT TO authenticated USING (semester.is_member(tenant_id) AND status = 'published');
CREATE POLICY directory ON semester.rooms FOR SELECT TO authenticated USING (semester.is_member(tenant_id) AND status = 'active');
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['submit_section_change(uuid, uuid, text, jsonb, text)', 'approve_section_change(uuid, uuid)', 'set_term_stage(uuid, uuid, text, bigint)', 'detect_schedule_conflicts(uuid, uuid, uuid, uuid, tstzrange[], integer, jsonb, text)'] LOOP
    EXECUTE 'ALTER FUNCTION semester.' || f || ' OWNER TO semester_rls_helper'; EXECUTE 'REVOKE ALL ON FUNCTION semester.' || f || ' FROM PUBLIC, anon'; EXECUTE 'GRANT EXECUTE ON FUNCTION semester.' || f || ' TO authenticated';
  END LOOP;
END $$;
GRANT SELECT ON semester.room_bookings, semester.rooms, semester.section_instructors TO semester_rls_helper;
GRANT SELECT, INSERT, UPDATE ON semester.term_schedule_cycles, semester.calendar_milestones, semester.section_change_requests, semester.department_scheduling_windows, semester.sections, semester.course_versions, semester.courses TO semester_rls_helper;
-- PERMISSION CODES (from your approval-matrix PDF). Stage authority is separate from data-edit authority, and view, edit, approve,
-- export and override are separate rights. Seed per tenant through the role-grant workflow, never automatically:
--   schedule.department.edit    department scheduler · edit own-department sections in draft, validation_failed, change_requested
--   schedule.chair.approve      chair/program director · chair_review transitions, department scope
--   schedule.dean.approve       dean/associate dean · dean_review transitions; sponsor exceptions, college scope
--   schedule.exception.approve  Academic Affairs · academic_affairs_review transitions
--   schedule.registrar.review   registrar scheduler · registrar_review, room_coordination; validation reruns
--   schedule.room.assign        registrar or room manager · central room bookings
--   schedule.registrar.publish  registrar admin · approved_for_publish → published; term stages
--   schedule.export             separate from view; logged with recipient and purpose
--   schedule.override           registrar admin, emergency only · needs a reason and a second approver, written to audit_events
-- Viewing a section never implies editing it; approving a stage never implies editing the section's data.
COMMIT;
