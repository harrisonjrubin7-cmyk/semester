// Migration prc-001: procurement (S-76 E08; mirrors lib/procureRules.ts). Procurement owns purchase authorization; finance owns
// posting and payment, which never happens here (finance records a posting reference after an authorized handoff).
// Enforced here: tenant rules (approval threshold, competitive-bid threshold, split window, match tolerance) are set by an
// administrator; a requisition is approved by someone other than the requester, and by two different approvers when it reaches
// the approval threshold or looks like a split (same requester and supplier inside the window, together reaching the threshold);
// final approval checks the budget and commits it; a purchase order is issued by a buyer who did not request it, with two bids
// at or above the bid threshold, never above the approved amount; goods are received by someone other than the buyer (returns
// reduce receipts); invoices are unique per PO and matched against receipts and PO within tolerance, otherwise they become
// exceptions that an approver other than the buyer accepts or disputes; only matched or accepted invoices are handed to
// finance. Closing a PO releases what was not invoiced. Roles are granted by an administrator, never self. Append-only history.
export const PRC_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS prc_staff (tenant_id text NOT NULL, user_id text NOT NULL, role text NOT NULL CHECK (role IN ('buyer','approver','receiver','finance')),
     granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id, role), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS prc_rules (tenant_id text PRIMARY KEY, approval_threshold int NOT NULL CHECK (approval_threshold > 0), bid_threshold int NOT NULL CHECK (bid_threshold > 0),
     split_days int NOT NULL CHECK (split_days BETWEEN 1 AND 365), tolerance_pct int NOT NULL CHECK (tolerance_pct BETWEEN 0 AND 20), set_by text NOT NULL, set_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS prc_budgets (tenant_id text NOT NULL, code text NOT NULL CHECK (code ~ '^[A-Z0-9-]{2,20}$'), name text NOT NULL, amount int NOT NULL CHECK (amount >= 0),
     set_by text NOT NULL, PRIMARY KEY (tenant_id, code))`,
  `CREATE TABLE IF NOT EXISTS prc_requisitions (id bigserial PRIMARY KEY, tenant_id text NOT NULL, requester_id text NOT NULL, budget_code text NOT NULL, supplier text NOT NULL,
     supplier_key text NOT NULL, description text NOT NULL CHECK (length(trim(description)) BETWEEN 5 AND 2000), amount int NOT NULL CHECK (amount > 0),
     needs_two boolean NOT NULL DEFAULT false, split_flag boolean NOT NULL DEFAULT false, split_note text NOT NULL DEFAULT '',
     approver1 text, approver2 text, state text NOT NULL DEFAULT 'submitted' CHECK (state IN ('submitted','approved','rejected','ordered','closed','cancelled')),
     decision_note text NOT NULL DEFAULT '', request_key text NOT NULL, version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, request_key),
     CHECK (approver1 IS NULL OR approver1 <> requester_id), CHECK (approver2 IS NULL OR (approver2 <> requester_id AND approver2 <> approver1)),
     CHECK (state NOT IN ('approved','ordered','closed') OR (approver1 IS NOT NULL AND (NOT needs_two OR approver2 IS NOT NULL))))`,
  `CREATE TABLE IF NOT EXISTS prc_bids (id bigserial PRIMARY KEY, req_id bigint NOT NULL REFERENCES prc_requisitions(id), supplier text NOT NULL, amount int NOT NULL CHECK (amount > 0),
     reference text NOT NULL DEFAULT '', recorded_by text NOT NULL, at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS prc_pos (id bigserial PRIMARY KEY, tenant_id text NOT NULL, req_id bigint NOT NULL UNIQUE REFERENCES prc_requisitions(id), supplier text NOT NULL, amount int NOT NULL CHECK (amount > 0),
     bid_id bigint REFERENCES prc_bids(id), issued_by text NOT NULL, state text NOT NULL DEFAULT 'issued' CHECK (state IN ('issued','closed','cancelled')), closed_by text,
     created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS prc_receipts (id bigserial PRIMARY KEY, po_id bigint NOT NULL REFERENCES prc_pos(id), amount int NOT NULL CHECK (amount <> 0), note text NOT NULL DEFAULT '',
     received_by text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE TABLE IF NOT EXISTS prc_invoices (id bigserial PRIMARY KEY, po_id bigint NOT NULL REFERENCES prc_pos(id), invoice_no text NOT NULL, amount int NOT NULL CHECK (amount > 0),
     state text NOT NULL CHECK (state IN ('matched','exception','accepted','disputed','handed_off','posted')), exception_reason text NOT NULL DEFAULT '',
     decided_by text, decision_note text NOT NULL DEFAULT '', handed_by text, posted_by text, posting_ref text NOT NULL DEFAULT '', entered_by text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (po_id, invoice_no),
     CHECK (state <> 'exception' OR length(exception_reason) > 0),
     CHECK (state NOT IN ('accepted','disputed') OR decided_by IS NOT NULL),
     CHECK (state NOT IN ('handed_off','posted') OR handed_by IS NOT NULL),
     CHECK (state <> 'posted' OR (posted_by IS NOT NULL AND length(trim(posting_ref)) > 0)))`,
  `CREATE TABLE IF NOT EXISTS prc_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL, ref bigint, step text NOT NULL, actor_id text NOT NULL, note text NOT NULL DEFAULT '',
     at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION prc_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'prc_events_append_only') THEN
       CREATE TRIGGER prc_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON prc_events FOR EACH STATEMENT EXECUTE FUNCTION prc_refuse_change(); END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'prc_receipts_append_only') THEN
       CREATE TRIGGER prc_receipts_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON prc_receipts FOR EACH STATEMENT EXECUTE FUNCTION prc_refuse_change(); END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'prc_bids_append_only') THEN
       CREATE TRIGGER prc_bids_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON prc_bids FOR EACH STATEMENT EXECUTE FUNCTION prc_refuse_change(); END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION prc_has(p_tenant text, p_user text, p_role text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM prc_staff WHERE tenant_id = p_tenant AND user_id = p_user AND role = p_role AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION prc_key(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lower(regexp_replace(trim(coalesce(p, '')), '[^a-zA-Z0-9]+', '', 'g')) $$`,
  // Open commitments plus spend on closed orders, per budget.
  `CREATE OR REPLACE FUNCTION prc_used(p_tenant text, p_budget text) RETURNS bigint LANGUAGE sql STABLE AS $$
     SELECT coalesce(sum(CASE WHEN r.state IN ('approved','ordered') THEN coalesce(p.amount, r.amount)
                         WHEN r.state = 'closed' THEN (SELECT coalesce(sum(i.amount), 0) FROM prc_invoices i WHERE i.po_id = p.id AND i.state IN ('matched','accepted','handed_off','posted'))
                         ELSE 0 END), 0)
     FROM prc_requisitions r LEFT JOIN prc_pos p ON p.req_id = r.id WHERE r.tenant_id = p_tenant AND r.budget_code = p_budget $$`,
  `CREATE OR REPLACE FUNCTION prc_set_staff(p_admin text, p_tenant text, p_user text, p_role text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own procurement access.'; END IF;
     IF p_role NOT IN ('buyer','approver','receiver','finance') THEN RETURN 'Unknown role.'; END IF;
     IF p_on THEN INSERT INTO prc_staff (tenant_id, user_id, role, granted_by) VALUES (p_tenant, p_user, p_role, p_admin)
       ON CONFLICT (tenant_id, user_id, role) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE prc_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND role = p_role AND revoked_at IS NULL; END IF;
     INSERT INTO prc_events (tenant_id, subject, step, actor_id, note) VALUES (p_tenant, 'staff', CASE WHEN p_on THEN 'grant' ELSE 'revoke' END, p_admin, p_user || ' ' || p_role);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION prc_set_rules(p_admin text, p_tenant text, p_approval int, p_bid int, p_days int, p_tol int) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_bid < p_approval THEN RETURN 'The bid threshold is at or above the approval threshold.'; END IF;
     INSERT INTO prc_rules (tenant_id, approval_threshold, bid_threshold, split_days, tolerance_pct, set_by) VALUES (p_tenant, p_approval, p_bid, p_days, p_tol, p_admin)
       ON CONFLICT (tenant_id) DO UPDATE SET approval_threshold = EXCLUDED.approval_threshold, bid_threshold = EXCLUDED.bid_threshold, split_days = EXCLUDED.split_days,
       tolerance_pct = EXCLUDED.tolerance_pct, set_by = p_admin, set_at = now();
     INSERT INTO prc_events (tenant_id, subject, step, actor_id, note) VALUES (p_tenant, 'rules', 'set', p_admin, p_approval || '/' || p_bid || '/' || p_days || 'd/' || p_tol || '%');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION prc_set_budget(p_admin text, p_tenant text, p_code text, p_name text, p_amount int) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_amount < prc_used(p_tenant, upper(trim(p_code))) THEN RETURN 'That is below what is already committed or spent.'; END IF;
     INSERT INTO prc_budgets (tenant_id, code, name, amount, set_by) VALUES (p_tenant, upper(trim(p_code)), trim(p_name), p_amount, p_admin)
       ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name, amount = EXCLUDED.amount, set_by = p_admin;
     INSERT INTO prc_events (tenant_id, subject, step, actor_id, note) VALUES (p_tenant, 'budget', 'set', p_admin, upper(trim(p_code)) || ' ' || p_amount);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION prc_submit(p_actor text, p_tenant text, p_budget text, p_supplier text, p_desc text, p_amount int, p_key text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE ru prc_rules; r prc_requisitions; v_id bigint; v_sk text := prc_key(p_supplier); v_recent bigint; v_n int;
   BEGIN
     SELECT * INTO ru FROM prc_rules WHERE tenant_id = p_tenant;
     IF ru.tenant_id IS NULL THEN RETURN 'Purchasing rules are not set up yet.'; END IF;
     SELECT * INTO r FROM prc_requisitions WHERE tenant_id = p_tenant AND request_key = p_key;
     IF r.id IS NOT NULL THEN
       IF r.amount = p_amount AND r.supplier_key = v_sk AND r.requester_id = p_actor THEN RETURN 'replay:' || r.id; END IF;
       RETURN 'That request was already used for a different requisition.';
     END IF;
     IF NOT EXISTS (SELECT 1 FROM prc_budgets WHERE tenant_id = p_tenant AND code = upper(trim(p_budget))) THEN RETURN 'Unknown budget.'; END IF;
     IF length(v_sk) < 2 THEN RETURN 'Name the supplier.'; END IF;
     -- Split detection: this requester's other live requests to the same supplier inside the window.
     SELECT coalesce(sum(amount), 0), count(*) INTO v_recent, v_n FROM prc_requisitions
       WHERE tenant_id = p_tenant AND requester_id = p_actor AND supplier_key = v_sk AND state NOT IN ('rejected','cancelled')
         AND created_at > now() - make_interval(days => ru.split_days) AND amount < ru.approval_threshold;
     INSERT INTO prc_requisitions (tenant_id, requester_id, budget_code, supplier, supplier_key, description, amount, needs_two, split_flag, split_note, request_key)
       VALUES (p_tenant, p_actor, upper(trim(p_budget)), trim(p_supplier), v_sk, trim(p_desc), p_amount,
               p_amount >= ru.approval_threshold OR (p_amount < ru.approval_threshold AND v_n > 0 AND v_recent + p_amount >= ru.approval_threshold),
               p_amount < ru.approval_threshold AND v_n > 0 AND v_recent + p_amount >= ru.approval_threshold,
               CASE WHEN p_amount < ru.approval_threshold AND v_n > 0 AND v_recent + p_amount >= ru.approval_threshold
                    THEN v_n || ' other request(s) to this supplier in ' || ru.split_days || ' days total ' || (v_recent + p_amount) || ', at or above the approval threshold' ELSE '' END, p_key)
       RETURNING id INTO v_id;
     INSERT INTO prc_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'requisition', v_id, 'submit', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION prc_decide(p_actor text, p_tenant text, p_req bigint, p_approve boolean, p_note text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r prc_requisitions; b prc_budgets; v_final boolean;
   BEGIN
     IF NOT prc_has(p_tenant, p_actor, 'approver') THEN RETURN 'Only a purchasing approver decides requisitions.'; END IF;
     SELECT * INTO r FROM prc_requisitions WHERE id = p_req AND tenant_id = p_tenant FOR UPDATE;
     IF r.id IS NULL THEN RETURN 'Requisition not found.'; END IF;
     IF r.version <> p_version THEN RETURN 'This requisition changed since you opened it. Reload and try again.'; END IF;
     IF r.state <> 'submitted' THEN RETURN 'Already decided.'; END IF;
     IF p_actor = r.requester_id THEN RETURN 'Someone other than the requester approves.'; END IF;
     IF p_actor = r.approver1 THEN RETURN 'A second, different approver is needed.'; END IF;
     IF NOT p_approve THEN
       IF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say why it is rejected.'; END IF;
       UPDATE prc_requisitions SET state = 'rejected', decision_note = trim(p_note), version = version + 1 WHERE id = p_req;
     ELSE
       v_final := NOT r.needs_two OR r.approver1 IS NOT NULL;
       IF v_final THEN
         SELECT * INTO b FROM prc_budgets WHERE tenant_id = p_tenant AND code = r.budget_code FOR UPDATE;
         IF prc_used(p_tenant, r.budget_code) + r.amount > b.amount THEN RETURN 'Not enough budget remains in ' || r.budget_code || '.'; END IF;
       END IF;
       IF r.approver1 IS NULL THEN UPDATE prc_requisitions SET approver1 = p_actor, state = CASE WHEN v_final THEN 'approved' ELSE state END, decision_note = coalesce(trim(p_note), ''), version = version + 1 WHERE id = p_req;
       ELSE UPDATE prc_requisitions SET approver2 = p_actor, state = 'approved', version = version + 1 WHERE id = p_req; END IF;
     END IF;
     INSERT INTO prc_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'requisition', p_req, CASE WHEN NOT p_approve THEN 'reject' WHEN r.approver1 IS NULL AND r.needs_two THEN 'approve_first' ELSE 'approve' END, p_actor, coalesce(p_note, ''));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION prc_bid(p_actor text, p_tenant text, p_req bigint, p_supplier text, p_amount int, p_ref text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r prc_requisitions; v_id bigint;
   BEGIN
     IF NOT prc_has(p_tenant, p_actor, 'buyer') THEN RETURN 'Only a buyer records bids.'; END IF;
     SELECT * INTO r FROM prc_requisitions WHERE id = p_req AND tenant_id = p_tenant;
     IF r.id IS NULL OR r.state <> 'approved' THEN RETURN 'Bids are collected for approved requisitions.'; END IF;
     INSERT INTO prc_bids (req_id, supplier, amount, reference, recorded_by) VALUES (p_req, trim(p_supplier), p_amount, coalesce(p_ref, ''), p_actor) RETURNING id INTO v_id;
     INSERT INTO prc_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'requisition', p_req, 'bid', p_actor, trim(p_supplier) || ' ' || p_amount);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION prc_issue_po(p_actor text, p_tenant text, p_req bigint, p_bid bigint, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r prc_requisitions; ru prc_rules; bd prc_bids; v_amount int; v_supplier text; v_id bigint;
   BEGIN
     IF NOT prc_has(p_tenant, p_actor, 'buyer') THEN RETURN 'Only a buyer issues purchase orders.'; END IF;
     SELECT * INTO r FROM prc_requisitions WHERE id = p_req AND tenant_id = p_tenant FOR UPDATE;
     SELECT * INTO ru FROM prc_rules WHERE tenant_id = p_tenant;
     IF r.id IS NULL THEN RETURN 'Requisition not found.'; END IF;
     IF r.version <> p_version THEN RETURN 'This requisition changed since you opened it. Reload and try again.'; END IF;
     IF r.state <> 'approved' THEN RETURN 'Only approved requisitions become orders.'; END IF;
     IF p_actor = r.requester_id THEN RETURN 'A buyer other than the requester issues the order.'; END IF;
     IF r.amount >= ru.bid_threshold THEN
       IF (SELECT count(DISTINCT prc_key(supplier)) FROM prc_bids WHERE req_id = p_req) < 2 THEN RETURN 'At this amount, record bids from at least two suppliers first.'; END IF;
       IF p_bid IS NULL THEN RETURN 'Choose the winning bid.'; END IF;
     END IF;
     IF p_bid IS NOT NULL THEN
       SELECT * INTO bd FROM prc_bids WHERE id = p_bid AND req_id = p_req;
       IF bd.id IS NULL THEN RETURN 'That bid is not for this requisition.'; END IF;
       v_amount := bd.amount; v_supplier := bd.supplier;
     ELSE v_amount := r.amount; v_supplier := r.supplier; END IF;
     IF v_amount > r.amount THEN RETURN 'The order exceeds the approved amount; submit a new requisition for the difference.'; END IF;
     INSERT INTO prc_pos (tenant_id, req_id, supplier, amount, bid_id, issued_by) VALUES (p_tenant, p_req, v_supplier, v_amount, p_bid, p_actor) RETURNING id INTO v_id;
     UPDATE prc_requisitions SET state = 'ordered', version = version + 1 WHERE id = p_req;
     INSERT INTO prc_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'po', v_id, 'issue', p_actor, v_supplier || ' ' || v_amount);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION prc_receive(p_actor text, p_tenant text, p_po bigint, p_amount int, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE p prc_pos; v_have bigint;
   BEGIN
     IF NOT prc_has(p_tenant, p_actor, 'receiver') THEN RETURN 'Only a receiver records receipts and returns.'; END IF;
     SELECT * INTO p FROM prc_pos WHERE id = p_po AND tenant_id = p_tenant FOR UPDATE;
     IF p.id IS NULL OR p.state <> 'issued' THEN RETURN 'This order is not open for receipts.'; END IF;
     IF p_actor = p.issued_by THEN RETURN 'Someone other than the buyer confirms receipt.'; END IF;
     SELECT coalesce(sum(amount), 0) INTO v_have FROM prc_receipts WHERE po_id = p_po;
     IF v_have + p_amount < 0 THEN RETURN 'You cannot return more than was received.'; END IF;
     IF v_have + p_amount > p.amount THEN RETURN 'That is more than was ordered.'; END IF;
     IF p_amount < 0 AND length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Record why goods are returned.'; END IF;
     INSERT INTO prc_receipts (po_id, amount, note, received_by) VALUES (p_po, p_amount, coalesce(p_note, ''), p_actor);
     INSERT INTO prc_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'po', p_po, CASE WHEN p_amount > 0 THEN 'receive' ELSE 'return' END, p_actor, p_amount::text);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION prc_invoice(p_actor text, p_tenant text, p_po bigint, p_no text, p_amount int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE p prc_pos; ru prc_rules; v_recv bigint; v_inv bigint; v_reason text := ''; v_id bigint;
   BEGIN
     IF NOT (prc_has(p_tenant, p_actor, 'buyer') OR prc_has(p_tenant, p_actor, 'finance')) THEN RETURN 'Only procurement or finance staff enter invoices.'; END IF;
     SELECT * INTO p FROM prc_pos WHERE id = p_po AND tenant_id = p_tenant FOR UPDATE;
     SELECT * INTO ru FROM prc_rules WHERE tenant_id = p_tenant;
     IF p.id IS NULL OR p.state <> 'issued' THEN RETURN 'This order is not open for invoices.'; END IF;
     IF EXISTS (SELECT 1 FROM prc_invoices WHERE po_id = p_po AND upper(trim(invoice_no)) = upper(trim(p_no))) THEN RETURN 'That invoice number is already recorded for this order (possible duplicate).'; END IF;
     SELECT coalesce(sum(amount), 0) INTO v_recv FROM prc_receipts WHERE po_id = p_po;
     SELECT coalesce(sum(amount), 0) INTO v_inv FROM prc_invoices WHERE po_id = p_po AND state NOT IN ('disputed');
     IF v_inv + p_amount > (p.amount * (100 + ru.tolerance_pct)) / 100 THEN v_reason := 'Invoiced total exceeds the order beyond tolerance';
     ELSIF v_inv + p_amount > (v_recv * (100 + ru.tolerance_pct)) / 100 THEN v_reason := 'Invoiced total exceeds what was received beyond tolerance';
     END IF;
     INSERT INTO prc_invoices (po_id, invoice_no, amount, state, exception_reason, entered_by) VALUES (p_po, upper(trim(p_no)), p_amount, CASE WHEN v_reason = '' THEN 'matched' ELSE 'exception' END, v_reason, p_actor)
       RETURNING id INTO v_id;
     INSERT INTO prc_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'invoice', v_id, CASE WHEN v_reason = '' THEN 'matched' ELSE 'exception' END, p_actor, v_reason);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION prc_invoice_step(p_actor text, p_tenant text, p_invoice bigint, p_step text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE i prc_invoices; p prc_pos;
   BEGIN
     SELECT * INTO i FROM prc_invoices WHERE id = p_invoice FOR UPDATE;
     SELECT * INTO p FROM prc_pos WHERE id = i.po_id AND tenant_id = p_tenant;
     IF i.id IS NULL OR p.id IS NULL THEN RETURN 'Invoice not found.'; END IF;
     IF p_step IN ('accept','dispute') THEN
       IF NOT prc_has(p_tenant, p_actor, 'approver') THEN RETURN 'Only a purchasing approver resolves exceptions.'; END IF;
       IF p_actor IN (p.issued_by, i.entered_by) THEN RETURN 'Someone other than the buyer or whoever entered the invoice resolves the exception.'; END IF;
       IF i.state <> 'exception' THEN RETURN 'This invoice is not an exception.'; END IF;
       IF length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Record the reason.'; END IF;
       UPDATE prc_invoices SET state = CASE WHEN p_step = 'accept' THEN 'accepted' ELSE 'disputed' END, decided_by = p_actor, decision_note = trim(p_note) WHERE id = p_invoice;
     ELSIF p_step = 'handoff' THEN
       IF NOT prc_has(p_tenant, p_actor, 'buyer') THEN RETURN 'A buyer authorizes the payment handoff.'; END IF;
       IF i.state NOT IN ('matched','accepted') THEN RETURN 'Only matched or accepted invoices go to finance.'; END IF;
       UPDATE prc_invoices SET state = 'handed_off', handed_by = p_actor WHERE id = p_invoice;
     ELSIF p_step = 'posted' THEN
       IF NOT prc_has(p_tenant, p_actor, 'finance') THEN RETURN 'Finance records the posting.'; END IF;
       IF i.state <> 'handed_off' THEN RETURN 'Only invoices handed to finance are posted.'; END IF;
       IF length(trim(coalesce(p_note, ''))) < 4 THEN RETURN 'Record the finance system reference.'; END IF;
       UPDATE prc_invoices SET state = 'posted', posted_by = p_actor, posting_ref = trim(p_note) WHERE id = p_invoice;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO prc_events (tenant_id, subject, ref, step, actor_id, note) VALUES (p_tenant, 'invoice', p_invoice, p_step, p_actor, coalesce(p_note, ''));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION prc_close_po(p_actor text, p_tenant text, p_po bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE p prc_pos;
   BEGIN
     IF NOT prc_has(p_tenant, p_actor, 'buyer') THEN RETURN 'Only a buyer closes orders.'; END IF;
     SELECT * INTO p FROM prc_pos WHERE id = p_po AND tenant_id = p_tenant FOR UPDATE;
     IF p.id IS NULL OR p.state <> 'issued' THEN RETURN 'This order is not open.'; END IF;
     IF EXISTS (SELECT 1 FROM prc_invoices WHERE po_id = p_po AND state = 'exception') THEN RETURN 'Resolve invoice exceptions first.'; END IF;
     UPDATE prc_pos SET state = 'closed', closed_by = p_actor WHERE id = p_po;
     UPDATE prc_requisitions SET state = 'closed', version = version + 1 WHERE id = p.req_id;
     INSERT INTO prc_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, 'po', p_po, 'close', p_actor);
     RETURN NULL;
   END $$`,
];
