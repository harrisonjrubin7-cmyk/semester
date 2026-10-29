// Migration dsp-001: invoice disputes (role app "Billing Contact": disputes). Builds on fin-001 (fin_invoices, fin_roles).
// - A finance preparer records the billing contact's dispute against an approved or paid invoice; one open dispute per invoice.
// - A finance approver who did not record it decides, bound to the dispute they saw (hash): reject, uphold or partly uphold.
// - Upholding proposes a credit no larger than the disputed amount. The credit is never posted: credit_state is CHECK-constrained
//   to 'not_posted' (money movement stays off until the owner approves it). The billing contact's own words are kept verbatim.
// - One dsp_cmd() call = one transaction (change, version, history, receipt). History and receipts are append-only.
export const DSP_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS dsp_disputes (id text PRIMARY KEY, number serial, tenant_id text NOT NULL, invoice_id text NOT NULL,
     contact_name text NOT NULL CHECK (length(trim(contact_name)) BETWEEN 2 AND 120), category text NOT NULL CHECK (category IN ('amount', 'service', 'duplicate', 'not_received', 'other')),
     detail text NOT NULL CHECK (length(trim(detail)) BETWEEN 20 AND 4000), disputed_minor bigint NOT NULL CHECK (disputed_minor > 0), invoice_hash text NOT NULL,
     state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'rejected', 'upheld', 'partially_upheld', 'withdrawn')),
     raised_by text NOT NULL, decided_by text, decision_note text NOT NULL DEFAULT '', credit_minor bigint NOT NULL DEFAULT 0 CHECK (credit_minor >= 0),
     credit_state text NOT NULL DEFAULT 'not_posted' CHECK (credit_state = 'not_posted'), version int NOT NULL DEFAULT 1,
     created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
     CHECK (decided_by IS NULL OR decided_by <> raised_by), CHECK (credit_minor <= disputed_minor),
     CHECK (state NOT IN ('upheld', 'partially_upheld') OR credit_minor > 0), CHECK (state IN ('upheld', 'partially_upheld') OR credit_minor = 0))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS dsp_one_open ON dsp_disputes (tenant_id, invoice_id) WHERE state = 'open'`,
  `CREATE TABLE IF NOT EXISTS dsp_commands (tenant_id text NOT NULL, actor_id text NOT NULL, command_key text NOT NULL, payload_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, actor_id, command_key))`,
  `CREATE TABLE IF NOT EXISTS dsp_receipts (tenant_id text NOT NULL, actor_id text NOT NULL, command_key text NOT NULL, dispute_id text, result_code text NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (tenant_id, actor_id, command_key), FOREIGN KEY (tenant_id, actor_id, command_key) REFERENCES dsp_commands (tenant_id, actor_id, command_key))`,
  `CREATE TABLE IF NOT EXISTS dsp_events (id bigserial PRIMARY KEY, dispute_id text NOT NULL REFERENCES dsp_disputes(id), actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION dsp_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS dsp_events_append_only ON dsp_events`,
  `CREATE TRIGGER dsp_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON dsp_events FOR EACH STATEMENT EXECUTE FUNCTION dsp_refuse_change()`,
  `DROP TRIGGER IF EXISTS dsp_receipts_append_only ON dsp_receipts`,
  `CREATE TRIGGER dsp_receipts_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON dsp_receipts FOR EACH STATEMENT EXECUTE FUNCTION dsp_refuse_change()`,
  `CREATE OR REPLACE FUNCTION dsp_hash(d dsp_disputes) RETURNS text LANGUAGE sql IMMUTABLE AS $$
     SELECT md5(concat_ws('|', d.id, d.invoice_id, d.category, d.detail, d.disputed_minor, d.invoice_hash, d.version)) $$`,
  `CREATE OR REPLACE FUNCTION dsp_has(p_tenant text, p_user text, p_role text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM fin_roles WHERE tenant_id = p_tenant AND user_id = p_user AND role = p_role AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION dsp_cmd(p_tenant text, p_actor text, p_key text, p_hash text, p_step text, p_id text, p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE c dsp_commands%ROWTYPE; d dsp_disputes%ROWTYPE; inv fin_invoices%ROWTYPE; v_code text := 'OK'; v_msg text; v_id text := p_id; v_detail text := ''; v_credit bigint; n text := trim(coalesce(p->>'note', ''));
BEGIN
  SELECT * INTO c FROM dsp_commands WHERE tenant_id = p_tenant AND actor_id = p_actor AND command_key = p_key;
  IF FOUND THEN
    IF c.payload_hash <> p_hash THEN RETURN jsonb_build_object('resultCode', 'IDEMPOTENCY_CONFLICT', 'message', 'This request key was already used with different details.'); END IF;
    RETURN (SELECT jsonb_build_object('replay', true, 'id', dispute_id, 'resultCode', result_code, 'message', message) FROM dsp_receipts WHERE tenant_id = p_tenant AND actor_id = p_actor AND command_key = p_key);
  END IF;
  INSERT INTO dsp_commands (tenant_id, actor_id, command_key, payload_hash) VALUES (p_tenant, p_actor, p_key, p_hash);

  IF p_step = 'raise' THEN
    SELECT * INTO inv FROM fin_invoices WHERE tenant_id = p_tenant AND id = p->>'invoiceId';
    IF NOT dsp_has(p_tenant, p_actor, 'preparer') THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Recording a dispute needs the finance preparer role.';
    ELSIF inv.id IS NULL THEN v_code := 'NOT_FOUND'; v_msg := 'Invoice not found in this workspace.';
    ELSIF inv.status NOT IN ('Approved', 'Paid', 'Mismatch') THEN v_code := 'BAD_STATE'; v_msg := 'Only an issued invoice (approved or paid) can be disputed.';
    ELSIF EXISTS (SELECT 1 FROM dsp_disputes WHERE tenant_id = p_tenant AND invoice_id = inv.id AND state = 'open') THEN v_code := 'ALREADY_OPEN'; v_msg := 'This invoice already has an open dispute.';
    ELSIF coalesce(p->>'category', '') NOT IN ('amount', 'service', 'duplicate', 'not_received', 'other') THEN v_code := 'BAD_INPUT'; v_msg := 'Choose what the dispute is about.';
    ELSIF length(trim(coalesce(p->>'contactName', ''))) < 2 OR length(trim(coalesce(p->>'detail', ''))) < 20 THEN v_code := 'BAD_INPUT'; v_msg := 'Record who raised it and what they said (20+ characters).';
    ELSIF coalesce((p->>'disputedMinor')::bigint, 0) <= 0 OR (p->>'disputedMinor')::bigint > inv.amount_minor THEN v_code := 'BAD_INPUT'; v_msg := 'The disputed amount must be more than zero and no more than the invoice.';
    ELSE v_id := 'dsp_' || substr(md5(p_tenant || '|' || p_actor || '|' || p_key), 1, 12);
      INSERT INTO dsp_disputes (id, tenant_id, invoice_id, contact_name, category, detail, disputed_minor, invoice_hash, raised_by)
        VALUES (v_id, p_tenant, inv.id, trim(p->>'contactName'), p->>'category', trim(p->>'detail'), (p->>'disputedMinor')::bigint, fin_snapshot(inv), p_actor);
      v_msg := 'Dispute recorded for review.'; v_detail := p->>'category' || ' ' || (p->>'disputedMinor');
    END IF;
  ELSE
    SELECT * INTO d FROM dsp_disputes WHERE id = p_id FOR UPDATE;
    IF NOT FOUND OR d.tenant_id <> p_tenant THEN v_code := 'NOT_FOUND'; v_msg := 'Dispute not found.';
    ELSIF (p->>'version')::int IS DISTINCT FROM d.version THEN v_code := 'STALE'; v_msg := 'This dispute changed since you opened it. Reload and try again.';
    ELSIF d.state <> 'open' THEN v_code := 'CLOSED'; v_msg := 'This dispute is already decided.';
    ELSIF p_step = 'withdraw' THEN
      IF d.raised_by <> p_actor THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Only the person who recorded it withdraws it.';
      ELSIF length(n) < 10 THEN v_code := 'BAD_INPUT'; v_msg := 'Say why (for example, the contact withdrew it).';
      ELSE UPDATE dsp_disputes SET state = 'withdrawn', decision_note = n, decided_at = now() WHERE id = d.id; v_msg := 'Withdrawn.'; v_detail := n; END IF;
    ELSIF p_step IN ('reject', 'uphold') THEN
      v_credit := coalesce((p->>'creditMinor')::bigint, 0);
      IF NOT dsp_has(p_tenant, p_actor, 'approver') THEN v_code := 'NOT_AUTHORIZED'; v_msg := 'Deciding a dispute needs the finance approver role.';
      ELSIF d.raised_by = p_actor THEN v_code := 'SEPARATION_OF_DUTIES'; v_msg := 'You recorded this dispute, so another approver decides it.';
      ELSIF p->>'seenHash' IS DISTINCT FROM dsp_hash(d) THEN v_code := 'CONTENT_CHANGED'; v_msg := 'The dispute changed since you opened it. Reload and review again.';
      ELSIF length(n) < 10 THEN v_code := 'BAD_INPUT'; v_msg := 'Write the reason the billing contact will be given (10+ characters).';
      ELSIF p_step = 'reject' THEN UPDATE dsp_disputes SET state = 'rejected', decided_by = p_actor, decision_note = n, decided_at = now() WHERE id = d.id; v_msg := 'Rejected.'; v_detail := n;
      ELSIF v_credit <= 0 OR v_credit > d.disputed_minor THEN v_code := 'BAD_INPUT'; v_msg := 'A credit must be more than zero and no more than the disputed amount.';
      ELSE UPDATE dsp_disputes SET state = CASE WHEN v_credit = d.disputed_minor THEN 'upheld' ELSE 'partially_upheld' END, credit_minor = v_credit, decided_by = p_actor, decision_note = n, decided_at = now() WHERE id = d.id;
        v_msg := 'Decided. A credit of ' || v_credit || ' (minor units) is proposed and not posted: no money moves.'; v_detail := 'credit ' || v_credit;
      END IF;
    ELSE v_code := 'UNKNOWN_ACTION'; v_msg := 'Unknown step.';
    END IF;
  END IF;

  IF v_code = 'OK' THEN
    IF p_step <> 'raise' THEN UPDATE dsp_disputes SET version = version + 1 WHERE id = v_id; END IF;
    INSERT INTO dsp_events (dispute_id, actor_id, action, detail) VALUES (v_id, p_actor, p_step, left(v_detail, 600));
  END IF;
  INSERT INTO dsp_receipts (tenant_id, actor_id, command_key, dispute_id, result_code, message) VALUES (p_tenant, p_actor, p_key, v_id, v_code, v_msg);
  RETURN jsonb_build_object('id', v_id, 'resultCode', v_code, 'message', v_msg);
END $$`,
];
