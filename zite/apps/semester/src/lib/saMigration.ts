// Migration sa-001: student-account disputes, adjustment proposals and refund requests (Student Accounts Officer app).
// The official ledger stays read-only. Pack boundary: "publishing actions does not establish payment-detail or transaction
// authority"; launch rule: money movement stays disabled until exact-target approval and activation evidence. So:
// - A student disputes one of their ledger entries. Student-accounts staff (accounts capability, checked by the endpoint)
//   resolve it: explain and close, or propose an adjustment.
// - An adjustment (credit or charge, amount, reason) or a student's refund request needs a second staff member's approval.
//   Approval records the decision as "approved, not posted": posting to the billing system or disbursing money is a
//   separate activated step and the posted state cannot be reached from here (CHECK).
// Nobody decides their own dispute, refund or adjustment, or approves their own proposal. Events append-only.
export const SA_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS sa_disputes (id text PRIMARY KEY, number serial, tenant_id text NOT NULL, student_id text NOT NULL, entry_id text NOT NULL, entry_label text NOT NULL,
     entry_amount numeric NOT NULL, reason text NOT NULL CHECK (length(reason) BETWEEN 20 AND 2000),
     state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'explained', 'adjustment_proposed', 'closed')),
     handled_by text, response text, created_at timestamptz NOT NULL DEFAULT now(), CHECK (handled_by IS NULL OR handled_by <> student_id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sa_one_open_dispute ON sa_disputes (tenant_id, student_id, entry_id) WHERE state IN ('open', 'adjustment_proposed')`,
  `CREATE TABLE IF NOT EXISTS sa_proposals (id text PRIMARY KEY, number serial, tenant_id text NOT NULL, student_id text NOT NULL,
     kind text NOT NULL CHECK (kind IN ('credit_adjustment', 'charge_adjustment', 'refund')), amount numeric NOT NULL CHECK (amount > 0 AND amount <= 100000),
     reason text NOT NULL CHECK (length(reason) BETWEEN 10 AND 2000), dispute_id text REFERENCES sa_disputes(id), proposed_by text NOT NULL,
     state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed', 'approved_not_posted', 'rejected', 'withdrawn')),
     decided_by text, decided_at timestamptz, decision_note text, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (decided_by IS NULL OR (decided_by <> proposed_by AND decided_by <> student_id)), CHECK (kind = 'refund' OR proposed_by <> student_id))`,
  `CREATE TABLE IF NOT EXISTS sa_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, ref text NOT NULL, actor_id text NOT NULL, action text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION sa_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS sa_events_append_only ON sa_events`,
  `CREATE TRIGGER sa_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON sa_events FOR EACH STATEMENT EXECUTE FUNCTION sa_refuse_change()`,
  // The endpoint passes the entry's label and amount after checking the entry belongs to this student and institution.
  `CREATE OR REPLACE FUNCTION sa_dispute(p_student text, p_tenant text, p_id text, p_entry text, p_label text, p_amount numeric, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF EXISTS (SELECT 1 FROM sa_disputes WHERE id = p_id) THEN RETURN NULL; END IF;
     IF length(trim(coalesce(p_reason, ''))) < 20 THEN RETURN 'Explain what looks wrong (20+ characters).'; END IF;
     IF EXISTS (SELECT 1 FROM sa_disputes WHERE tenant_id = p_tenant AND student_id = p_student AND entry_id = p_entry AND state IN ('open','adjustment_proposed')) THEN RETURN 'You already have an open dispute for this item.'; END IF;
     INSERT INTO sa_disputes (id, tenant_id, student_id, entry_id, entry_label, entry_amount, reason) VALUES (p_id, p_tenant, p_student, p_entry, p_label, p_amount, trim(p_reason));
     INSERT INTO sa_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, p_id, p_student, 'disputed');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION sa_explain(p_actor text, p_tenant text, p_id text, p_response text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE d sa_disputes%ROWTYPE;
   BEGIN
     SELECT * INTO d FROM sa_disputes WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR d.tenant_id <> p_tenant THEN RETURN 'Dispute not found.'; END IF;
     IF d.student_id = p_actor THEN RETURN 'Someone else handles your own dispute.'; END IF;
     IF d.state <> 'open' THEN RETURN 'This dispute is no longer open.'; END IF;
     IF length(trim(coalesce(p_response, ''))) < 20 THEN RETURN 'Explain the charge to the student (20+ characters).'; END IF;
     UPDATE sa_disputes SET state = 'explained', handled_by = p_actor, response = trim(p_response) WHERE id = p_id;
     INSERT INTO sa_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, p_id, p_actor, 'explained');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION sa_propose(p_actor text, p_tenant text, p_id text, p_student text, p_kind text, p_amount numeric, p_reason text, p_dispute text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE d sa_disputes%ROWTYPE;
   BEGIN
     IF EXISTS (SELECT 1 FROM sa_proposals WHERE id = p_id) THEN RETURN NULL; END IF;
     IF p_kind <> 'refund' AND p_actor = p_student THEN RETURN 'You cannot propose an adjustment to your own account.'; END IF;
     IF p_kind = 'refund' AND p_actor <> p_student THEN RETURN 'Refunds are requested by the student.'; END IF;
     IF p_amount IS NULL OR p_amount <= 0 THEN RETURN 'Enter a positive amount.'; END IF;
     IF length(trim(coalesce(p_reason, ''))) < 10 THEN RETURN 'Give a reason (10+ characters).'; END IF;
     IF p_kind = 'refund' AND EXISTS (SELECT 1 FROM sa_proposals WHERE tenant_id = p_tenant AND student_id = p_student AND kind = 'refund' AND state = 'proposed') THEN RETURN 'You already have a refund request waiting.'; END IF;
     IF p_dispute IS NOT NULL THEN
       SELECT * INTO d FROM sa_disputes WHERE id = p_dispute FOR UPDATE;
       IF NOT FOUND OR d.tenant_id <> p_tenant OR d.student_id <> p_student OR d.state <> 'open' THEN RETURN 'That dispute is not open for this student.'; END IF;
       UPDATE sa_disputes SET state = 'adjustment_proposed', handled_by = p_actor WHERE id = p_dispute;
     END IF;
     INSERT INTO sa_proposals (id, tenant_id, student_id, kind, amount, reason, dispute_id, proposed_by) VALUES (p_id, p_tenant, p_student, p_kind, round(p_amount, 2), trim(p_reason), p_dispute, p_actor);
     INSERT INTO sa_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, p_id, p_actor, 'proposed_' || p_kind);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION sa_decide(p_actor text, p_tenant text, p_id text, p_approve boolean, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE p sa_proposals%ROWTYPE;
   BEGIN
     SELECT * INTO p FROM sa_proposals WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR p.tenant_id <> p_tenant THEN RETURN 'Proposal not found.'; END IF;
     IF p.state <> 'proposed' THEN RETURN 'Already decided.'; END IF;
     IF p_actor = p.proposed_by OR p_actor = p.student_id THEN RETURN 'A second staff member, not the proposer or the student, must decide.'; END IF;
     IF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Add a note the student will see.'; END IF;
     UPDATE sa_proposals SET state = CASE WHEN p_approve THEN 'approved_not_posted' ELSE 'rejected' END, decided_by = p_actor, decided_at = now(), decision_note = trim(p_note) WHERE id = p_id;
     IF p.dispute_id IS NOT NULL THEN UPDATE sa_disputes SET state = 'closed', response = coalesce(response, '') || CASE WHEN p_approve THEN 'Adjustment approved: ' ELSE 'Adjustment not approved: ' END || trim(p_note) WHERE id = p.dispute_id; END IF;
     INSERT INTO sa_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, p_id, p_actor, CASE WHEN p_approve THEN 'approved_not_posted' ELSE 'rejected' END);
     RETURN NULL;
   END $$`,
];
