// Migration ovr-001: registration overrides and advising exceptions (role apps "Registrar": overrides; "Academic Advisor":
// exceptions). One register, three kinds that registration actually honours:
//   prerequisite      — one section in one term, despite a missing prerequisite;
//   credit_overload   — one term, up to an approved credit total above the institution's limit;
//   late_registration — one section in one term after the registration window closed.
// A student asks with a reason. Credit overloads and late registration need an advisor's endorsement first (any active
// advisor at the institution other than the student); prerequisites go straight to the registrar. A registrar (registration
// decision authority) other than the student and the endorser approves or denies with a note. An approval is single use and
// expires after 30 days or when it is used by a submitted registration, whichever comes first. Append-only history.
export const OVR_KINDS = ['prerequisite', 'credit_overload', 'late_registration'] as const;
export const OVR_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS ovr_requests (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('prerequisite', 'credit_overload', 'late_registration')),
     term text NOT NULL CHECK (length(trim(term)) BETWEEN 3 AND 40), section_id text, credits_requested numeric CHECK (credits_requested IS NULL OR credits_requested BETWEEN 1 AND 40),
     reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 10 AND 2000),
     state text NOT NULL DEFAULT 'requested' CHECK (state IN ('requested', 'endorsed', 'not_endorsed', 'approved', 'denied', 'used', 'withdrawn')),
     endorsed_by text, endorse_note text NOT NULL DEFAULT '', decided_by text, decision_note text NOT NULL DEFAULT '', expires_at timestamptz, used_at timestamptz,
     version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK ((kind = 'credit_overload') = (section_id IS NULL)), CHECK ((kind = 'credit_overload') = (credits_requested IS NOT NULL)),
     CHECK (endorsed_by IS NULL OR endorsed_by <> student_id), CHECK (decided_by IS NULL OR (decided_by <> student_id AND decided_by IS DISTINCT FROM endorsed_by)),
     CHECK (state NOT IN ('approved', 'used') OR (decided_by IS NOT NULL AND expires_at IS NOT NULL)),
     CHECK (state NOT IN ('approved', 'used') OR kind = 'prerequisite' OR endorsed_by IS NOT NULL))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS ovr_requests_open ON ovr_requests (tenant_id, student_id, kind, lower(term), coalesce(section_id, '')) WHERE state IN ('requested', 'endorsed', 'approved')`,
  `CREATE TABLE IF NOT EXISTS ovr_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, request_id bigint NOT NULL REFERENCES ovr_requests(id), actor_id text NOT NULL, step text NOT NULL,
     note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION ovr_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS ovr_events_append_only ON ovr_events`,
  `CREATE TRIGGER ovr_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON ovr_events FOR EACH STATEMENT EXECUTE FUNCTION ovr_refuse_change()`,
  /** Approved, unused, unexpired overrides a registration may rely on now. */
  `CREATE OR REPLACE FUNCTION ovr_active(p_tenant text, p_student text, p_term text) RETURNS SETOF ovr_requests LANGUAGE sql STABLE AS $$
     SELECT * FROM ovr_requests WHERE tenant_id = p_tenant AND student_id = p_student AND lower(term) = lower(p_term) AND state = 'approved' AND expires_at > now() $$`,
  `CREATE OR REPLACE FUNCTION ovr_request(p_tenant text, p_student text, p_is_student boolean, p jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint; v_kind text := p->>'kind'; BEGIN
     IF NOT p_is_student THEN RETURN 'Only students request an override for themselves.'; END IF;
     IF coalesce(v_kind, '') NOT IN ('prerequisite', 'credit_overload', 'late_registration') THEN RETURN 'Choose what you need an exception for.'; END IF;
     IF length(trim(coalesce(p->>'term', ''))) NOT BETWEEN 3 AND 40 THEN RETURN 'Choose the term.'; END IF;
     IF length(trim(coalesce(p->>'reason', ''))) NOT BETWEEN 10 AND 2000 THEN RETURN 'Explain why (10 to 2000 characters).'; END IF;
     IF v_kind = 'credit_overload' AND coalesce((p->>'credits')::numeric, 0) NOT BETWEEN 1 AND 40 THEN RETURN 'Say how many credits in total you want to take.'; END IF;
     IF v_kind <> 'credit_overload' AND coalesce(p->>'sectionId', '') = '' THEN RETURN 'Choose the section.'; END IF;
     IF EXISTS (SELECT 1 FROM ovr_requests WHERE tenant_id = p_tenant AND student_id = p_student AND kind = v_kind AND lower(term) = lower(trim(p->>'term'))
       AND coalesce(section_id, '') = CASE WHEN v_kind = 'credit_overload' THEN '' ELSE p->>'sectionId' END AND state IN ('requested', 'endorsed', 'approved')) THEN RETURN 'You already have this request open.'; END IF;
     INSERT INTO ovr_requests (tenant_id, student_id, kind, term, section_id, credits_requested, reason)
       VALUES (p_tenant, p_student, v_kind, trim(p->>'term'), CASE WHEN v_kind = 'credit_overload' THEN NULL ELSE p->>'sectionId' END,
         CASE WHEN v_kind = 'credit_overload' THEN (p->>'credits')::numeric END, trim(p->>'reason')) RETURNING id INTO v_id;
     INSERT INTO ovr_events (tenant_id, request_id, actor_id, step) VALUES (p_tenant, v_id, p_student, 'request');
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION ovr_step(p_tenant text, p_actor text, p_is_advisor boolean, p_is_registrar boolean, p_step text, p_id bigint, p_version int, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r ovr_requests%ROWTYPE; BEGIN
     SELECT * INTO r FROM ovr_requests WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Request not found.'; END IF;
     IF p_version IS DISTINCT FROM r.version THEN RETURN 'This request changed since you opened it. Reload and try again.'; END IF;
     IF p_step = 'withdraw' THEN
       IF p_actor <> r.student_id THEN RETURN 'Only the student withdraws.'; END IF;
       IF r.state NOT IN ('requested', 'endorsed', 'approved') THEN RETURN 'This request is closed.'; END IF;
       UPDATE ovr_requests SET state = 'withdrawn' WHERE id = r.id;
     ELSIF p_step IN ('endorse', 'not_endorse') THEN
       IF NOT p_is_advisor THEN RETURN 'Endorsing needs an advisor.'; END IF;
       IF p_actor = r.student_id THEN RETURN 'You cannot endorse your own request.'; END IF;
       IF r.kind = 'prerequisite' THEN RETURN 'Prerequisite overrides go straight to the registrar.'; END IF;
       IF r.state <> 'requested' THEN RETURN 'This request is not waiting for an advisor.'; END IF;
       IF length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Add a note for the registrar (10+ characters).'; END IF;
       UPDATE ovr_requests SET state = CASE WHEN p_step = 'endorse' THEN 'endorsed' ELSE 'not_endorsed' END, endorsed_by = p_actor, endorse_note = trim(p_note) WHERE id = r.id;
     ELSIF p_step IN ('approve', 'deny') THEN
       IF NOT p_is_registrar THEN RETURN 'Deciding overrides needs registrar authority.'; END IF;
       IF p_actor = r.student_id THEN RETURN 'You cannot decide your own request.'; END IF;
       IF p_actor = r.endorsed_by THEN RETURN 'You endorsed this request, so another registrar decides it.'; END IF;
       IF NOT ((r.kind = 'prerequisite' AND r.state = 'requested') OR (r.kind <> 'prerequisite' AND r.state = 'endorsed')) THEN
         RETURN CASE WHEN r.kind <> 'prerequisite' AND r.state = 'requested' THEN 'An advisor must endorse this first.' ELSE 'This request is not waiting for a decision.' END; END IF;
       IF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Record the reason for the decision.'; END IF;
       UPDATE ovr_requests SET state = CASE WHEN p_step = 'approve' THEN 'approved' ELSE 'denied' END, decided_by = p_actor, decision_note = trim(p_note),
         expires_at = CASE WHEN p_step = 'approve' THEN now() + interval '30 days' END WHERE id = r.id;
     ELSE RETURN 'Unknown step.'; END IF;
     UPDATE ovr_requests SET version = version + 1 WHERE id = r.id;
     INSERT INTO ovr_events (tenant_id, request_id, actor_id, step, note) VALUES (p_tenant, r.id, p_actor, p_step, coalesce(p_note, ''));
     RETURN 'ok:' || r.id;
   END $$`,
  /** Called once a registration that relied on these overrides is submitted. */
  `CREATE OR REPLACE FUNCTION ovr_use(p_tenant text, p_student text, p_ids bigint[]) RETURNS int LANGUAGE plpgsql AS $$
   DECLARE n int; BEGIN
     UPDATE ovr_requests SET state = 'used', used_at = now(), version = version + 1
       WHERE tenant_id = p_tenant AND student_id = p_student AND id = ANY (p_ids) AND state = 'approved' AND expires_at > now();
     GET DIAGNOSTICS n = ROW_COUNT;
     INSERT INTO ovr_events (tenant_id, request_id, actor_id, step) SELECT p_tenant, id, p_student, 'used' FROM ovr_requests WHERE id = ANY (p_ids) AND state = 'used' AND used_at > now() - interval '1 minute';
     RETURN n;
   END $$`,
];
