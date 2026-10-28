// Academic standing decisions (spec §3.7 follow-up). The transcript calculates standing; a registrar records the decision
// with a rationale and a student-facing notice; a suspension carries a registration hold; the student may appeal within
// the window; an appeal is decided by a different registrar than the one who made the decision. Decisions are versioned
// per student and term (a new one supersedes, nothing is overwritten) and every step is logged append-only.
export const STN_DECISIONS = ['Good standing', 'Academic warning', 'Academic probation', 'Academic suspension'] as const;
export const STN_APPEAL_DAYS = 14;
export const STN_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS stn_decisions (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, term text NOT NULL,
     version int NOT NULL CHECK (version >= 1), calculated text NOT NULL, decision text NOT NULL CHECK (decision IN ('Good standing','Academic warning','Academic probation','Academic suspension')),
     rationale text NOT NULL CHECK (length(trim(rationale)) >= 10), notice text NOT NULL CHECK (length(trim(notice)) >= 10),
     decided_by text NOT NULL, decided_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL DEFAULT 'Recorded' CHECK (status IN ('Recorded','Superseded')),
     hold_ref text, via_appeal bigint, CHECK (decided_by <> student_id), UNIQUE (tenant_id, student_id, term, version))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS stn_one_current ON stn_decisions (tenant_id, student_id, term) WHERE status = 'Recorded'`,
  `CREATE TABLE IF NOT EXISTS stn_appeals (id bigserial PRIMARY KEY, tenant_id text NOT NULL, decision_id bigint NOT NULL REFERENCES stn_decisions(id),
     student_id text NOT NULL, statement text NOT NULL CHECK (length(trim(statement)) >= 20), submitted_at timestamptz NOT NULL DEFAULT now(),
     status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Granted','Denied')), decided_by text, decided_at timestamptz, outcome_note text NOT NULL DEFAULT '',
     CHECK (decided_by IS NULL OR decided_by <> student_id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS stn_one_open_appeal ON stn_appeals (decision_id) WHERE status = 'Open'`,
  `CREATE TABLE IF NOT EXISTS stn_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION stn_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'The standing log cannot be changed.'; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'stn_events_append_only') THEN
     CREATE TRIGGER stn_events_append_only BEFORE UPDATE OR DELETE ON stn_events FOR EACH ROW EXECUTE FUNCTION stn_refuse_change(); END IF; END $$`,
  // p_calculated comes from the server's own transcript calculation, never from the browser.
  `CREATE OR REPLACE FUNCTION stn_record(p_actor text, p_tenant text, p_is_registrar boolean, p_student text, p_term text, p_calculated text,
     p_decision text, p_rationale text, p_notice text, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE cur stn_decisions%ROWTYPE; nv int; nid bigint;
   BEGIN
     IF NOT coalesce(p_is_registrar, false) THEN RETURN 'Only a registrar records academic standing.'; END IF;
     IF p_actor = p_student THEN RETURN 'You cannot record standing on your own record.'; END IF;
     IF p_calculated IS NULL THEN RETURN 'There is no calculated standing for that term.'; END IF;
     IF p_decision = 'Academic suspension' AND p_calculated NOT IN ('Academic probation','Refer to standing committee') THEN
       RETURN 'Suspension needs a calculated standing of probation or a committee referral.'; END IF;
     IF length(trim(coalesce(p_rationale,''))) < 10 THEN RETURN 'Give the reason for the decision (at least 10 characters).'; END IF;
     IF length(trim(coalesce(p_notice,''))) < 10 THEN RETURN 'Write the notice the student will read (at least 10 characters).'; END IF;
     PERFORM pg_advisory_xact_lock(hashtext('stn:' || p_tenant || ':' || p_student || ':' || p_term));
     SELECT * INTO cur FROM stn_decisions WHERE tenant_id = p_tenant AND student_id = p_student AND term = p_term AND status = 'Recorded';
     IF coalesce(cur.version, 0) <> coalesce(p_expected, -1) THEN RETURN 'Someone recorded a decision for this term since you opened it. Reload.'; END IF;
     IF cur.id IS NOT NULL AND EXISTS (SELECT 1 FROM stn_appeals WHERE decision_id = cur.id AND status = 'Open') THEN RETURN 'An appeal of the current decision is open; decide the appeal first.'; END IF;
     UPDATE stn_decisions SET status = 'Superseded' WHERE id = cur.id;
     nv := coalesce(cur.version, 0) + 1;
     INSERT INTO stn_decisions (tenant_id, student_id, term, version, calculated, decision, rationale, notice, decided_by)
       VALUES (p_tenant, p_student, p_term, nv, p_calculated, p_decision, trim(p_rationale), trim(p_notice), p_actor) RETURNING id INTO nid;
     INSERT INTO stn_events (tenant_id, student_id, actor_id, action, detail) VALUES (p_tenant, p_student, p_actor, 'decision recorded', p_term || ': ' || p_decision || ' (v' || nv || ')');
     RETURN 'ok:' || nid || ':' || nv;
   END $$`,
  `CREATE OR REPLACE FUNCTION stn_link_hold(p_tenant text, p_id bigint, p_hold text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN UPDATE stn_decisions SET hold_ref = p_hold WHERE id = p_id AND tenant_id = p_tenant AND decision = 'Academic suspension' AND hold_ref IS NULL;
     IF NOT FOUND THEN RETURN 'No suspension to link.'; END IF; RETURN 'ok'; END $$`,
  `CREATE OR REPLACE FUNCTION stn_appeal(p_actor text, p_tenant text, p_decision bigint, p_statement text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE d stn_decisions%ROWTYPE; nid bigint;
   BEGIN
     SELECT * INTO d FROM stn_decisions WHERE id = p_decision AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND OR d.student_id <> p_actor THEN RETURN 'Decision not found.'; END IF;
     IF d.status <> 'Recorded' THEN RETURN 'This decision has been replaced; appeal the current one.'; END IF;
     IF d.decision NOT IN ('Academic probation','Academic suspension') THEN RETURN 'Only probation and suspension can be appealed.'; END IF;
     IF now() > d.decided_at + make_interval(days => ${STN_APPEAL_DAYS}) THEN RETURN 'The ${STN_APPEAL_DAYS}-day appeal window has closed.'; END IF;
     IF length(trim(coalesce(p_statement,''))) < 20 THEN RETURN 'Explain your appeal (at least 20 characters).'; END IF;
     IF EXISTS (SELECT 1 FROM stn_appeals WHERE decision_id = d.id) THEN RETURN 'You have already appealed this decision.'; END IF;
     INSERT INTO stn_appeals (tenant_id, decision_id, student_id, statement) VALUES (p_tenant, d.id, p_actor, trim(p_statement)) RETURNING id INTO nid;
     INSERT INTO stn_events (tenant_id, student_id, actor_id, action, detail) VALUES (p_tenant, p_actor, p_actor, 'appeal submitted', d.term);
     RETURN 'ok:' || nid;
   END $$`,
  // Granting reduces the decision to probation as a new version (with via_appeal); denying leaves it. The deciding
  // registrar must not be the one who made the decision under appeal.
  `CREATE OR REPLACE FUNCTION stn_decide_appeal(p_actor text, p_tenant text, p_is_registrar boolean, p_appeal bigint, p_grant boolean, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE ap stn_appeals%ROWTYPE; d stn_decisions%ROWTYPE; nid bigint;
   BEGIN
     IF NOT coalesce(p_is_registrar, false) THEN RETURN 'Only a registrar decides appeals.'; END IF;
     SELECT * INTO ap FROM stn_appeals WHERE id = p_appeal AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Appeal not found.'; END IF;
     IF ap.status <> 'Open' THEN RETURN 'This appeal was already decided.'; END IF;
     SELECT * INTO d FROM stn_decisions WHERE id = ap.decision_id FOR UPDATE;
     IF d.decided_by = p_actor THEN RETURN 'You made the decision under appeal; another registrar must decide the appeal.'; END IF;
     IF p_actor = ap.student_id THEN RETURN 'You cannot decide your own appeal.'; END IF;
     IF length(trim(coalesce(p_note,''))) < 10 THEN RETURN 'Give the reason for the outcome (at least 10 characters).'; END IF;
     UPDATE stn_appeals SET status = CASE WHEN p_grant THEN 'Granted' ELSE 'Denied' END, decided_by = p_actor, decided_at = now(), outcome_note = trim(p_note) WHERE id = ap.id;
     INSERT INTO stn_events (tenant_id, student_id, actor_id, action, detail) VALUES (p_tenant, ap.student_id, p_actor, CASE WHEN p_grant THEN 'appeal granted' ELSE 'appeal denied' END, d.term);
     IF NOT p_grant THEN RETURN 'ok:denied'; END IF;
     UPDATE stn_decisions SET status = 'Superseded' WHERE id = d.id;
     INSERT INTO stn_decisions (tenant_id, student_id, term, version, calculated, decision, rationale, notice, decided_by, via_appeal)
       VALUES (p_tenant, d.student_id, d.term, d.version + 1, d.calculated, CASE WHEN d.decision = 'Academic suspension' THEN 'Academic probation' ELSE 'Academic warning' END,
               'Appeal granted: ' || trim(p_note), 'Your appeal was granted. ' || trim(p_note), p_actor, ap.id) RETURNING id INTO nid;
     RETURN 'ok:granted:' || nid || ':' || coalesce(d.hold_ref, '');
   END $$`,
];
