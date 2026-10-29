// Migration vet-001: veterans benefits certification (role app "Veterans Certifying Official": benefits intake, certification review).
// - A student asks for certification of one term: benefit chapter, level, program, and whether their Certificate of
//   Eligibility is on file. One open request per student per term. No document is uploaded or stored here.
// - Certifying officials are appointed by an institution administrator (never self). An official starts a review, which
//   copies the student's enrolled courses for that term (computed by the server from enrolments and course credits) into
//   lines. Each line is marked applicable to the program or not; "not applicable" needs a reason.
// - Certifying needs every line decided. The database sums the applicable credits itself and derives training time from
//   the institution's thresholds for the level (vet_policies; defaults 12/9/6 undergraduate, 9/7/5 graduate until the
//   institution confirms its own). The certifier is never the student. The facts certified are frozen with a hash.
// - Submitting to the VA is not done here (agency hand-off stays disabled). After the official submits in the VA's own
//   system they record its reference. If enrolment later changes, the server flags the certification for adjustment and
//   an official certifies an amendment that supersedes it.
// Only the student and the institution's certifying officials see a request. Append-only history.
export const VET_CHAPTERS = ['30', '31', '33', '35', '1606', '1607', 'other'] as const;
export const VET_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS vet_officials (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
     PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS vet_policies (tenant_id text NOT NULL, level text NOT NULL CHECK (level IN ('undergraduate', 'graduate')),
     full_time numeric NOT NULL, three_quarter numeric NOT NULL, half_time numeric NOT NULL, confirmed_by text, confirmed_at timestamptz,
     PRIMARY KEY (tenant_id, level), CHECK (full_time > three_quarter AND three_quarter > half_time AND half_time > 0))`,
  `CREATE TABLE IF NOT EXISTS vet_requests (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, term text NOT NULL CHECK (length(trim(term)) BETWEEN 3 AND 40),
     chapter text NOT NULL CHECK (chapter IN ('30', '31', '33', '35', '1606', '1607', 'other')), level text NOT NULL CHECK (level IN ('undergraduate', 'graduate')),
     program text NOT NULL CHECK (length(trim(program)) BETWEEN 2 AND 120), coe_on_file boolean NOT NULL,
     state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted', 'in_review', 'certified', 'returned', 'withdrawn')), return_reason text NOT NULL DEFAULT '',
     reviewer_id text, version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), CHECK (reviewer_id IS NULL OR reviewer_id <> student_id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS vet_requests_open ON vet_requests (tenant_id, student_id, lower(term)) WHERE state IN ('submitted', 'in_review', 'certified')`,
  `CREATE TABLE IF NOT EXISTS vet_lines (id bigserial PRIMARY KEY, request_id bigint NOT NULL REFERENCES vet_requests(id), section_id text NOT NULL, course text NOT NULL,
     credits numeric NOT NULL CHECK (credits >= 0), applicable boolean, reason text NOT NULL DEFAULT '', decided_by text,
     UNIQUE (request_id, section_id), CHECK (applicable IS NOT FALSE OR length(trim(reason)) >= 5))`,
  `CREATE TABLE IF NOT EXISTS vet_certifications (id bigserial PRIMARY KEY, request_id bigint NOT NULL REFERENCES vet_requests(id), student_id text NOT NULL, certified_by text NOT NULL,
     credits numeric NOT NULL, training_time text NOT NULL CHECK (training_time IN ('full time', 'three-quarter time', 'half time', 'less than half time')),
     facts jsonb NOT NULL, facts_hash text NOT NULL, amends bigint REFERENCES vet_certifications(id), superseded_by bigint, external_ref text, external_recorded_by text,
     certified_at timestamptz NOT NULL DEFAULT now(), CHECK (certified_by <> student_id), CHECK (facts_hash = md5(facts::text)),
     CHECK (external_ref IS NULL OR (length(trim(external_ref)) BETWEEN 4 AND 80 AND external_recorded_by IS NOT NULL)))`,
  `CREATE TABLE IF NOT EXISTS vet_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_id bigint, actor_id text NOT NULL, step text NOT NULL, note text NOT NULL DEFAULT '',
     at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION vet_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS vet_events_append_only ON vet_events`,
  `CREATE TRIGGER vet_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON vet_events FOR EACH STATEMENT EXECUTE FUNCTION vet_refuse_change()`,
  // A certification's facts never change; only the VA reference (once) and the superseding link may be filled in.
  `CREATE OR REPLACE FUNCTION vet_cert_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
     IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END IF;
     IF (NEW.credits, NEW.training_time, NEW.facts, NEW.facts_hash, NEW.certified_by, NEW.request_id, NEW.student_id) IS DISTINCT FROM
        (OLD.credits, OLD.training_time, OLD.facts, OLD.facts_hash, OLD.certified_by, OLD.request_id, OLD.student_id)
       OR (OLD.external_ref IS NOT NULL AND NEW.external_ref IS DISTINCT FROM OLD.external_ref)
       OR (OLD.superseded_by IS NOT NULL AND NEW.superseded_by IS DISTINCT FROM OLD.superseded_by) THEN
       RAISE EXCEPTION 'CERTIFICATION_FIXED' USING ERRCODE = 'check_violation'; END IF;
     RETURN NEW; END $$`,
  `DROP TRIGGER IF EXISTS vet_certifications_fixed ON vet_certifications`,
  `CREATE TRIGGER vet_certifications_fixed BEFORE UPDATE OR DELETE ON vet_certifications FOR EACH ROW EXECUTE FUNCTION vet_cert_guard()`,
  `CREATE OR REPLACE FUNCTION vet_log(p_tenant text, p_request bigint, p_actor text, p_step text, p_note text) RETURNS void LANGUAGE sql AS $$
     INSERT INTO vet_events (tenant_id, request_id, actor_id, step, note) VALUES (p_tenant, p_request, p_actor, p_step, coalesce(p_note, '')) $$`,
  `CREATE OR REPLACE FUNCTION vet_is_official(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM vet_officials WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION vet_threshold(p_tenant text, p_level text) RETURNS vet_policies LANGUAGE sql STABLE AS $$
     SELECT coalesce((SELECT p FROM vet_policies p WHERE p.tenant_id = p_tenant AND p.level = p_level),
       ROW(p_tenant, p_level, CASE WHEN p_level = 'graduate' THEN 9 ELSE 12 END, CASE WHEN p_level = 'graduate' THEN 7 ELSE 9 END,
         CASE WHEN p_level = 'graduate' THEN 5 ELSE 6 END, NULL, NULL)::vet_policies) $$`,
  `CREATE OR REPLACE FUNCTION vet_training_time(p_tenant text, p_level text, p_credits numeric) RETURNS text LANGUAGE sql STABLE AS $$
     SELECT CASE WHEN p_credits >= t.full_time THEN 'full time' WHEN p_credits >= t.three_quarter THEN 'three-quarter time'
       WHEN p_credits >= t.half_time THEN 'half time' ELSE 'less than half time' END FROM vet_threshold(p_tenant, p_level) t $$`,
  `CREATE OR REPLACE FUNCTION vet_set_official(p_tenant text, p_actor text, p_is_admin boolean, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$ BEGIN
     IF NOT p_is_admin THEN RETURN 'Only an institution administrator appoints certifying officials.'; END IF;
     IF p_user = p_actor THEN RETURN 'Another administrator appoints you.'; END IF;
     IF p_on THEN INSERT INTO vet_officials (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_actor)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = EXCLUDED.granted_by, granted_at = now();
     ELSE UPDATE vet_officials SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     PERFORM vet_log(p_tenant, NULL, p_actor, CASE WHEN p_on THEN 'appoint' ELSE 'remove' END, p_user);
     RETURN 'ok:' || p_user;
   END $$`,
  `CREATE OR REPLACE FUNCTION vet_set_policy(p_tenant text, p_actor text, p_level text, p_full numeric, p_tq numeric, p_half numeric) RETURNS text LANGUAGE plpgsql AS $$ BEGIN
     IF NOT vet_is_official(p_tenant, p_actor) THEN RETURN 'Only a certifying official confirms the thresholds.'; END IF;
     IF p_level NOT IN ('undergraduate', 'graduate') THEN RETURN 'Choose undergraduate or graduate.'; END IF;
     IF NOT (p_full > p_tq AND p_tq > p_half AND p_half > 0 AND p_full <= 30) THEN RETURN 'Full time must exceed three-quarter time, which must exceed half time.'; END IF;
     INSERT INTO vet_policies (tenant_id, level, full_time, three_quarter, half_time, confirmed_by, confirmed_at) VALUES (p_tenant, p_level, p_full, p_tq, p_half, p_actor, now())
       ON CONFLICT (tenant_id, level) DO UPDATE SET full_time = EXCLUDED.full_time, three_quarter = EXCLUDED.three_quarter, half_time = EXCLUDED.half_time, confirmed_by = p_actor, confirmed_at = now();
     PERFORM vet_log(p_tenant, NULL, p_actor, 'policy', p_level || ' ' || p_full || '/' || p_tq || '/' || p_half);
     RETURN 'ok:' || p_level;
   END $$`,
  `CREATE OR REPLACE FUNCTION vet_intake(p_tenant text, p_student text, p_is_student boolean, p jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint; BEGIN
     IF NOT p_is_student THEN RETURN 'Only students request certification.'; END IF;
     IF length(trim(coalesce(p->>'term', ''))) NOT BETWEEN 3 AND 40 THEN RETURN 'Choose the term.'; END IF;
     IF coalesce(p->>'chapter', '') NOT IN ('30', '31', '33', '35', '1606', '1607', 'other') THEN RETURN 'Choose your benefit chapter.'; END IF;
     IF coalesce(p->>'level', '') NOT IN ('undergraduate', 'graduate') THEN RETURN 'Choose undergraduate or graduate.'; END IF;
     IF length(trim(coalesce(p->>'program', ''))) NOT BETWEEN 2 AND 120 THEN RETURN 'Name your program.'; END IF;
     IF EXISTS (SELECT 1 FROM vet_requests WHERE tenant_id = p_tenant AND student_id = p_student AND lower(term) = lower(trim(p->>'term')) AND state IN ('submitted', 'in_review', 'certified'))
       THEN RETURN 'You already have a request for this term.'; END IF;
     INSERT INTO vet_requests (tenant_id, student_id, term, chapter, level, program, coe_on_file)
       VALUES (p_tenant, p_student, trim(p->>'term'), p->>'chapter', p->>'level', trim(p->>'program'), coalesce((p->>'coeOnFile')::boolean, false)) RETURNING id INTO v_id;
     PERFORM vet_log(p_tenant, v_id, p_student, 'intake', p->>'chapter');
     RETURN 'ok:' || v_id;
   END $$`,
  // p_lines come from the server: the student's enrolled sections for the request's term with course credits.
  `CREATE OR REPLACE FUNCTION vet_review(p_tenant text, p_actor text, p_step text, p_id bigint, p_version int, p jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r vet_requests%ROWTYPE; l jsonb; v_credits numeric; v_facts jsonb; v_cert bigint; v_prev bigint; BEGIN
     SELECT * INTO r FROM vet_requests WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Request not found.'; END IF;
     IF p_step = 'withdraw' THEN
       IF r.student_id <> p_actor THEN RETURN 'Only the student withdraws a request.'; END IF;
       IF r.state NOT IN ('submitted', 'returned') THEN RETURN 'An official is working on this request; ask them to return it.'; END IF;
       UPDATE vet_requests SET state = 'withdrawn', version = version + 1 WHERE id = r.id;
       PERFORM vet_log(p_tenant, r.id, p_actor, 'withdraw', ''); RETURN 'ok:' || r.id;
     END IF;
     IF NOT vet_is_official(p_tenant, p_actor) THEN RETURN 'Certification review needs a certifying official.'; END IF;
     IF r.student_id = p_actor THEN RETURN 'You cannot review your own request.'; END IF;
     IF p_version IS DISTINCT FROM r.version THEN RETURN 'This request changed since you opened it. Reload and try again.'; END IF;
     IF p_step IN ('start', 'amend') THEN
       IF p_step = 'start' AND r.state <> 'submitted' THEN RETURN 'Only a new request can be started.'; END IF;
       IF p_step = 'amend' AND r.state <> 'certified' THEN RETURN 'Only a certified request can be amended.'; END IF;
       DELETE FROM vet_lines WHERE request_id = r.id;
       FOR l IN SELECT * FROM jsonb_array_elements(coalesce(p->'lines', '[]')) LOOP
         INSERT INTO vet_lines (request_id, section_id, course, credits) VALUES (r.id, l->>'sectionId', l->>'course', (l->>'credits')::numeric);
       END LOOP;
       UPDATE vet_requests SET state = 'in_review', reviewer_id = p_actor, version = version + 1 WHERE id = r.id;
     ELSIF p_step = 'decide' THEN
       IF r.state <> 'in_review' THEN RETURN 'Start the review first.'; END IF;
       IF (p->>'applicable') IS NULL THEN RETURN 'Say whether the course applies.'; END IF;
       IF NOT (p->>'applicable')::boolean AND length(trim(coalesce(p->>'reason', ''))) < 5 THEN RETURN 'Say why this course does not apply to the program.'; END IF;
       UPDATE vet_lines SET applicable = (p->>'applicable')::boolean, reason = trim(coalesce(p->>'reason', '')), decided_by = p_actor WHERE id = (p->>'lineId')::bigint AND request_id = r.id;
       IF NOT FOUND THEN RETURN 'Course line not found.'; END IF;
       UPDATE vet_requests SET version = version + 1 WHERE id = r.id;
     ELSIF p_step = 'return' THEN
       IF r.state NOT IN ('submitted', 'in_review') THEN RETURN 'This request cannot be returned now.'; END IF;
       IF length(trim(coalesce(p->>'reason', ''))) < 10 THEN RETURN 'Tell the student what to fix (10+ characters).'; END IF;
       UPDATE vet_requests SET state = 'returned', return_reason = trim(p->>'reason'), version = version + 1 WHERE id = r.id;
     ELSIF p_step = 'certify' THEN
       IF r.state <> 'in_review' THEN RETURN 'Start the review first.'; END IF;
       IF NOT EXISTS (SELECT 1 FROM vet_lines WHERE request_id = r.id) THEN RETURN 'No enrolled courses for this term, so there is nothing to certify.'; END IF;
       IF EXISTS (SELECT 1 FROM vet_lines WHERE request_id = r.id AND applicable IS NULL) THEN RETURN 'Decide every course before certifying.'; END IF;
       SELECT coalesce(sum(credits) FILTER (WHERE applicable), 0) INTO v_credits FROM vet_lines WHERE request_id = r.id;
       SELECT jsonb_build_object('term', r.term, 'chapter', r.chapter, 'level', r.level, 'program', r.program,
         'thresholds', (SELECT jsonb_build_object('full', t.full_time, 'threeQuarter', t.three_quarter, 'half', t.half_time, 'confirmed', t.confirmed_by IS NOT NULL) FROM vet_threshold(p_tenant, r.level) t),
         'lines', (SELECT jsonb_agg(jsonb_build_object('sectionId', section_id, 'course', course, 'credits', credits, 'applicable', applicable, 'reason', reason) ORDER BY section_id) FROM vet_lines WHERE request_id = r.id))
         INTO v_facts;
       SELECT id INTO v_prev FROM vet_certifications WHERE request_id = r.id AND superseded_by IS NULL ORDER BY id DESC LIMIT 1;
       INSERT INTO vet_certifications (request_id, student_id, certified_by, credits, training_time, facts, facts_hash, amends)
         VALUES (r.id, r.student_id, p_actor, v_credits, vet_training_time(p_tenant, r.level, v_credits), v_facts, md5(v_facts::text), v_prev) RETURNING id INTO v_cert;
       IF v_prev IS NOT NULL THEN UPDATE vet_certifications SET superseded_by = v_cert WHERE id = v_prev; END IF;
       UPDATE vet_requests SET state = 'certified', version = version + 1 WHERE id = r.id;
     ELSIF p_step = 'record_ref' THEN
       UPDATE vet_certifications SET external_ref = trim(p->>'reference'), external_recorded_by = p_actor
         WHERE request_id = r.id AND superseded_by IS NULL AND external_ref IS NULL AND length(trim(coalesce(p->>'reference', ''))) BETWEEN 4 AND 80;
       IF NOT FOUND THEN RETURN 'Enter the VA reference (4 to 80 characters) for a certification that has none yet.'; END IF;
     ELSE RETURN 'Unknown step.'; END IF;
     PERFORM vet_log(p_tenant, r.id, p_actor, p_step, coalesce(p->>'reason', p->>'reference', ''));
     RETURN 'ok:' || r.id;
   END $$`,
];
