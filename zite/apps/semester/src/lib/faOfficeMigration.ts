// Migration fa-002: financial aid office work (Financial Aid Officer app), extending fa-001. Requires FA_MIGRATION (fa_staff).
// Design decision (27 Oct, owner-delegated; recorded in docs/execution/decisions-2026-10-27.md): protected aid documents are
// tracked BY REFERENCE ONLY — the document lives in the institution's aid system; Semester holds its kind, the aid-system
// reference and the review outcome, never the file or its contents, and only the student and aid staff see the rows. The aid
// system stays the system of record: an eligibility determination and an award are recorded with the aid-system reference,
// and nothing is disbursed from Semester.
// Enforced here: documents reviewed by staff who are not the student; eligibility recorded only when every required document is
// accepted, by staff who are not the student, with need = cost of attendance − student aid index; satisfactory academic progress
// (SAP) set on review with a note; an award is proposed by one officer and approved by a different one, need-based awards never
// exceed remaining need, fund commitments never exceed the fund budget, and a student who is SAP-ineligible gets no new award;
// the student accepts or declines an offered award; appeals are decided by staff other than whoever made the decision appealed;
// reconciliation lists over-committed funds and accepted awards for students no longer eligible. Append-only history in fa_events.
export const FA_OFFICE_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS fa_docs (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, term text NOT NULL,
     kind text NOT NULL CHECK (kind IN ('tax_return','verification_worksheet','identity','dependency','other')), required boolean NOT NULL DEFAULT true,
     aid_ref text NOT NULL DEFAULT '' CHECK (length(aid_ref) <= 120), state text NOT NULL DEFAULT 'requested' CHECK (state IN ('requested','received','accepted','rejected')),
     reviewed_by text, note text NOT NULL DEFAULT '', requested_by text NOT NULL, UNIQUE (tenant_id, student_id, term, kind),
     CHECK (reviewed_by IS NULL OR reviewed_by <> student_id), CHECK (state NOT IN ('accepted','rejected') OR (reviewed_by IS NOT NULL AND length(trim(aid_ref)) > 0)))`,
  `CREATE TABLE IF NOT EXISTS fa_eligibility (tenant_id text NOT NULL, student_id text NOT NULL, term text NOT NULL, coa int NOT NULL CHECK (coa >= 0), sai int NOT NULL CHECK (sai >= -150000),
     enrollment text NOT NULL CHECK (enrollment IN ('full','three_quarter','half','less_than_half')), sap text NOT NULL DEFAULT 'good' CHECK (sap IN ('good','warning','probation','ineligible')),
     sap_note text NOT NULL DEFAULT '', aid_ref text NOT NULL CHECK (length(trim(aid_ref)) > 0), determined_by text NOT NULL, version int NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (tenant_id, student_id, term), CHECK (determined_by <> student_id))`,
  `CREATE TABLE IF NOT EXISTS fa_funds (tenant_id text NOT NULL, code text NOT NULL CHECK (code ~ '^[A-Z0-9-]{2,20}$'), name text NOT NULL, need_based boolean NOT NULL DEFAULT true,
     budget int NOT NULL CHECK (budget >= 0), set_by text NOT NULL, PRIMARY KEY (tenant_id, code))`,
  `CREATE TABLE IF NOT EXISTS fa_awards (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, term text NOT NULL, fund text NOT NULL, amount int NOT NULL CHECK (amount > 0),
     state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed','approved','offered','accepted','declined','cancelled')),
     proposed_by text NOT NULL, approved_by text, aid_ref text NOT NULL DEFAULT '', note text NOT NULL DEFAULT '', request_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, request_key),
     CHECK (proposed_by <> student_id), CHECK (approved_by IS NULL OR (approved_by <> proposed_by AND approved_by <> student_id)),
     CHECK (state IN ('proposed','cancelled') OR approved_by IS NOT NULL), CHECK (state NOT IN ('offered','accepted','declined') OR length(trim(aid_ref)) > 0))`,
  `CREATE TABLE IF NOT EXISTS fa_appeals (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, term text NOT NULL, kind text NOT NULL CHECK (kind IN ('sap','award','cost_of_attendance')),
     reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 20 AND 4000), original_by text, state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted','granted','denied')),
     decided_by text, decision text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (decided_by IS NULL OR (decided_by <> student_id AND decided_by IS DISTINCT FROM original_by)))`,
  `CREATE OR REPLACE FUNCTION fa_need_left(p_tenant text, p_student text, p_term text) RETURNS bigint LANGUAGE sql STABLE AS $$
     SELECT greatest(0, e.coa - greatest(e.sai, 0))::bigint - coalesce((SELECT sum(a.amount) FROM fa_awards a JOIN fa_funds f ON f.tenant_id = a.tenant_id AND f.code = a.fund
       WHERE a.tenant_id = p_tenant AND a.student_id = p_student AND a.term = p_term AND f.need_based AND a.state IN ('proposed','approved','offered','accepted')), 0)
     FROM fa_eligibility e WHERE e.tenant_id = p_tenant AND e.student_id = p_student AND e.term = p_term $$`,
  `CREATE OR REPLACE FUNCTION fa_fund_used(p_tenant text, p_fund text) RETURNS bigint LANGUAGE sql STABLE AS $$
     SELECT coalesce(sum(amount), 0)::bigint FROM fa_awards WHERE tenant_id = p_tenant AND fund = p_fund AND state IN ('approved','offered','accepted') $$`,
  `CREATE OR REPLACE FUNCTION fa_doc_request(p_actor text, p_tenant text, p_student text, p_term text, p_kind text, p_required boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT fa_is_staff(p_tenant, p_actor) THEN RETURN 'Only aid office staff request documents.'; END IF;
     INSERT INTO fa_docs (tenant_id, student_id, term, kind, required, requested_by) VALUES (p_tenant, p_student, trim(p_term), p_kind, p_required, p_actor) ON CONFLICT DO NOTHING;
     INSERT INTO fa_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, 'doc ' || p_student || ' ' || p_kind, p_actor, 'doc_request');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION fa_doc_step(p_actor text, p_tenant text, p_doc bigint, p_step text, p_ref text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE d fa_docs;
   BEGIN
     SELECT * INTO d FROM fa_docs WHERE id = p_doc AND tenant_id = p_tenant FOR UPDATE;
     IF d.id IS NULL THEN RETURN 'Document not found.'; END IF;
     IF p_step = 'received' THEN
       IF p_actor <> d.student_id AND NOT fa_is_staff(p_tenant, p_actor) THEN RETURN 'Document not found.'; END IF;
       IF d.state NOT IN ('requested','rejected') THEN RETURN 'Already received.'; END IF;
       IF length(trim(coalesce(p_ref, ''))) < 3 THEN RETURN 'Give the reference the aid system issued when you submitted it (never upload the document here).'; END IF;
       UPDATE fa_docs SET state = 'received', aid_ref = trim(p_ref) WHERE id = p_doc;
     ELSIF p_step IN ('accept','reject') THEN
       IF NOT fa_is_staff(p_tenant, p_actor) THEN RETURN 'Only aid office staff review documents.'; END IF;
       IF p_actor = d.student_id THEN RETURN 'Someone else reviews your own documents.'; END IF;
       IF d.state <> 'received' THEN RETURN 'Nothing is waiting for review.'; END IF;
       IF p_step = 'reject' AND length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Tell the student what is wrong.'; END IF;
       UPDATE fa_docs SET state = CASE WHEN p_step = 'accept' THEN 'accepted' ELSE 'rejected' END, reviewed_by = p_actor, note = coalesce(trim(p_note), '') WHERE id = p_doc;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO fa_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, 'doc ' || p_doc, p_actor, 'doc_' || p_step);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION fa_set_eligibility(p_actor text, p_tenant text, p_student text, p_term text, p_coa int, p_sai int, p_enroll text, p_ref text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e fa_eligibility;
   BEGIN
     IF NOT fa_is_staff(p_tenant, p_actor) THEN RETURN 'Only aid office staff record eligibility.'; END IF;
     IF p_actor = p_student THEN RETURN 'Someone else records your own eligibility.'; END IF;
     IF EXISTS (SELECT 1 FROM fa_docs WHERE tenant_id = p_tenant AND student_id = p_student AND term = trim(p_term) AND required AND state <> 'accepted') THEN
       RETURN 'Every required document must be accepted first (verification).'; END IF;
     IF length(trim(coalesce(p_ref, ''))) < 3 THEN RETURN 'Record the aid-system reference for this determination.'; END IF;
     SELECT * INTO e FROM fa_eligibility WHERE tenant_id = p_tenant AND student_id = p_student AND term = trim(p_term) FOR UPDATE;
     IF e.student_id IS NULL THEN
       INSERT INTO fa_eligibility (tenant_id, student_id, term, coa, sai, enrollment, aid_ref, determined_by) VALUES (p_tenant, p_student, trim(p_term), p_coa, p_sai, p_enroll, trim(p_ref), p_actor);
     ELSE
       IF e.version <> p_version THEN RETURN 'This record changed since you opened it. Reload and try again.'; END IF;
       UPDATE fa_eligibility SET coa = p_coa, sai = p_sai, enrollment = p_enroll, aid_ref = trim(p_ref), determined_by = p_actor, version = version + 1, updated_at = now()
         WHERE tenant_id = p_tenant AND student_id = p_student AND term = trim(p_term);
       IF fa_need_left(p_tenant, p_student, trim(p_term)) < 0 THEN RAISE EXCEPTION 'NEED_BELOW_AWARDS' USING HINT = 'Revised need is below awards already made; cancel or reduce awards first.'; END IF;
     END IF;
     INSERT INTO fa_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, 'eligibility ' || p_student || ' ' || trim(p_term), p_actor, 'eligibility');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION fa_sap(p_actor text, p_tenant text, p_student text, p_term text, p_sap text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT fa_is_staff(p_tenant, p_actor) THEN RETURN 'Only aid office staff review academic progress.'; END IF;
     IF p_actor = p_student THEN RETURN 'Someone else reviews your own progress.'; END IF;
     IF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Record the basis for the progress status (GPA, pace, maximum timeframe).'; END IF;
     UPDATE fa_eligibility SET sap = p_sap, sap_note = trim(p_note), determined_by = p_actor, version = version + 1, updated_at = now() WHERE tenant_id = p_tenant AND student_id = p_student AND term = trim(p_term);
     IF NOT FOUND THEN RETURN 'Record eligibility for this term first.'; END IF;
     INSERT INTO fa_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, 'sap ' || p_student || ' ' || trim(p_term), p_actor, 'sap_' || p_sap);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION fa_set_fund(p_admin text, p_tenant text, p_code text, p_name text, p_need boolean, p_budget int) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_budget < fa_fund_used(p_tenant, upper(trim(p_code))) THEN RETURN 'That is below what is already committed.'; END IF;
     INSERT INTO fa_funds (tenant_id, code, name, need_based, budget, set_by) VALUES (p_tenant, upper(trim(p_code)), trim(p_name), p_need, p_budget, p_admin)
       ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name, need_based = EXCLUDED.need_based, budget = EXCLUDED.budget, set_by = p_admin;
     INSERT INTO fa_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, 'fund ' || upper(trim(p_code)), p_admin, 'fund_set');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION fa_award_propose(p_actor text, p_tenant text, p_student text, p_term text, p_fund text, p_amount int, p_key text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e fa_eligibility; f fa_funds; a fa_awards; v_id bigint;
   BEGIN
     IF NOT fa_is_staff(p_tenant, p_actor) THEN RETURN 'Only aid office staff propose awards.'; END IF;
     SELECT * INTO a FROM fa_awards WHERE tenant_id = p_tenant AND request_key = p_key;
     IF a.id IS NOT NULL THEN
       IF a.student_id = p_student AND a.amount = p_amount AND a.fund = upper(trim(p_fund)) THEN RETURN 'replay:' || a.id; END IF;
       RETURN 'That request was already used for a different award.';
     END IF;
     IF p_actor = p_student THEN RETURN 'Someone else proposes your own award.'; END IF;
     SELECT * INTO e FROM fa_eligibility WHERE tenant_id = p_tenant AND student_id = p_student AND term = trim(p_term);
     IF e.student_id IS NULL THEN RETURN 'Record eligibility for this term first.'; END IF;
     IF e.sap = 'ineligible' THEN RETURN 'The student is not meeting academic progress; no new awards unless an appeal is granted.'; END IF;
     SELECT * INTO f FROM fa_funds WHERE tenant_id = p_tenant AND code = upper(trim(p_fund));
     IF f.code IS NULL THEN RETURN 'Unknown fund.'; END IF;
     IF f.need_based AND p_amount > fa_need_left(p_tenant, p_student, trim(p_term)) THEN RETURN 'This exceeds the student''s remaining need of ' || fa_need_left(p_tenant, p_student, trim(p_term)) || ' cents.'; END IF;
     INSERT INTO fa_awards (tenant_id, student_id, term, fund, amount, proposed_by, request_key) VALUES (p_tenant, p_student, trim(p_term), f.code, p_amount, p_actor, p_key) RETURNING id INTO v_id;
     INSERT INTO fa_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, 'award ' || v_id, p_actor, 'award_propose');
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION fa_award_step(p_actor text, p_tenant text, p_award bigint, p_step text, p_ref text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE a fa_awards; f fa_funds; e fa_eligibility;
   BEGIN
     SELECT * INTO a FROM fa_awards WHERE id = p_award AND tenant_id = p_tenant FOR UPDATE;
     IF a.id IS NULL THEN RETURN 'Award not found.'; END IF;
     IF p_step IN ('accept','decline') THEN
       IF p_actor <> a.student_id THEN RETURN 'Only the student responds to their award.'; END IF;
       IF a.state <> 'offered' THEN RETURN 'This award is not waiting for your response.'; END IF;
       UPDATE fa_awards SET state = CASE WHEN p_step = 'accept' THEN 'accepted' ELSE 'declined' END WHERE id = p_award;
     ELSE
       IF NOT fa_is_staff(p_tenant, p_actor) THEN RETURN 'Only aid office staff manage awards.'; END IF;
       IF p_actor = a.student_id THEN RETURN 'Someone else manages your own award.'; END IF;
       IF p_step = 'approve' THEN
         IF a.state <> 'proposed' THEN RETURN 'Only proposed awards are approved.'; END IF;
         IF p_actor = a.proposed_by THEN RETURN 'A different officer approves the award.'; END IF;
         SELECT * INTO f FROM fa_funds WHERE tenant_id = p_tenant AND code = a.fund FOR UPDATE;
         IF fa_fund_used(p_tenant, a.fund) + a.amount > f.budget THEN RETURN 'The ' || a.fund || ' fund does not have enough left.'; END IF;
         SELECT * INTO e FROM fa_eligibility WHERE tenant_id = p_tenant AND student_id = a.student_id AND term = a.term;
         IF e.sap = 'ineligible' THEN RETURN 'The student is not meeting academic progress.'; END IF;
         UPDATE fa_awards SET state = 'approved', approved_by = p_actor WHERE id = p_award;
       ELSIF p_step = 'offer' THEN
         IF a.state <> 'approved' THEN RETURN 'Approve the award first.'; END IF;
         IF length(trim(coalesce(p_ref, ''))) < 3 THEN RETURN 'Record the aid-system reference for the packaged award.'; END IF;
         UPDATE fa_awards SET state = 'offered', aid_ref = trim(p_ref) WHERE id = p_award;
       ELSIF p_step = 'cancel' THEN
         IF a.state IN ('declined','cancelled') THEN RETURN 'Already closed.'; END IF;
         IF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Record why the award is cancelled.'; END IF;
         UPDATE fa_awards SET state = 'cancelled', note = trim(p_note) WHERE id = p_award;
       ELSE RETURN 'Unknown step.';
       END IF;
     END IF;
     INSERT INTO fa_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, 'award ' || p_award, p_actor, 'award_' || p_step);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION fa_appeal(p_student text, p_tenant text, p_term text, p_kind text, p_reason text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_orig text; v_id bigint;
   BEGIN
     IF EXISTS (SELECT 1 FROM fa_appeals WHERE tenant_id = p_tenant AND student_id = p_student AND term = trim(p_term) AND kind = p_kind AND state = 'submitted') THEN RETURN 'You already have this appeal waiting.'; END IF;
     SELECT determined_by INTO v_orig FROM fa_eligibility WHERE tenant_id = p_tenant AND student_id = p_student AND term = trim(p_term);
     IF v_orig IS NULL THEN RETURN 'There is no decision for this term to appeal yet.'; END IF;
     INSERT INTO fa_appeals (tenant_id, student_id, term, kind, reason, original_by) VALUES (p_tenant, p_student, trim(p_term), p_kind, trim(p_reason), v_orig) RETURNING id INTO v_id;
     INSERT INTO fa_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, 'appeal ' || v_id, p_student, 'appeal_' || p_kind);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION fa_appeal_decide(p_actor text, p_tenant text, p_appeal bigint, p_grant boolean, p_decision text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE ap fa_appeals;
   BEGIN
     IF NOT fa_is_staff(p_tenant, p_actor) THEN RETURN 'Only aid office staff decide appeals.'; END IF;
     SELECT * INTO ap FROM fa_appeals WHERE id = p_appeal AND tenant_id = p_tenant FOR UPDATE;
     IF ap.id IS NULL THEN RETURN 'Appeal not found.'; END IF;
     IF ap.state <> 'submitted' THEN RETURN 'Already decided.'; END IF;
     IF p_actor = ap.student_id THEN RETURN 'Someone else decides your own appeal.'; END IF;
     IF p_actor = ap.original_by THEN RETURN 'Someone other than whoever made the original decision decides the appeal.'; END IF;
     IF length(trim(coalesce(p_decision, ''))) < 10 THEN RETURN 'Explain the decision (conditions, plan, or reason).'; END IF;
     UPDATE fa_appeals SET state = CASE WHEN p_grant THEN 'granted' ELSE 'denied' END, decided_by = p_actor, decision = trim(p_decision) WHERE id = p_appeal;
     -- A granted progress appeal places the student on probation (eligible with an academic plan).
     IF p_grant AND ap.kind = 'sap' THEN UPDATE fa_eligibility SET sap = 'probation', sap_note = 'Appeal granted: ' || trim(p_decision), version = version + 1 WHERE tenant_id = p_tenant AND student_id = ap.student_id AND term = ap.term; END IF;
     INSERT INTO fa_events (tenant_id, ref, actor_id, action) VALUES (p_tenant, 'appeal ' || p_appeal, p_actor, CASE WHEN p_grant THEN 'appeal_grant' ELSE 'appeal_deny' END);
     RETURN NULL;
   END $$`,
];
