// Migration fin-001: company invoice / approval / reconciliation (controlled Postgres backend).
// SYNTHETIC DATA ONLY. No money moves: payments are recorded events, outbound notices are disabled.
// Every command writes command + state change + receipt + audit + outbox inside one fin_cmd() call = one transaction.
export const FIN_MIGRATION: string[] = [
  // Finance grants. No app code writes here: a grant is a permission change made with the owner's approval.
  `CREATE TABLE IF NOT EXISTS fin_roles (tenant_id text NOT NULL, user_id text NOT NULL, role text NOT NULL CHECK (role IN ('preparer', 'approver')), granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz, PRIMARY KEY (tenant_id, user_id, role))`,
  `CREATE TABLE IF NOT EXISTS fin_commands (tenant_id text NOT NULL, command_key text NOT NULL, payload_hash text NOT NULL, action text NOT NULL, actor_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, command_key))`,
  `CREATE TABLE IF NOT EXISTS fin_invoices (tenant_id text NOT NULL, id text NOT NULL, number serial, customer text NOT NULL, amount_minor bigint NOT NULL CHECK (amount_minor > 0), currency text NOT NULL, memo text NOT NULL DEFAULT '', status text NOT NULL, synthetic boolean NOT NULL DEFAULT true CHECK (synthetic), created_by text NOT NULL, approved_by text, approved_hash text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, id))`,
  `CREATE TABLE IF NOT EXISTS fin_payments (tenant_id text NOT NULL, id bigserial, invoice_id text NOT NULL, amount_minor bigint NOT NULL CHECK (amount_minor > 0), reference text NOT NULL, command_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, id), UNIQUE (tenant_id, reference), FOREIGN KEY (tenant_id, invoice_id) REFERENCES fin_invoices (tenant_id, id))`,
  `CREATE TABLE IF NOT EXISTS fin_receipts (tenant_id text NOT NULL, command_key text NOT NULL, invoice_id text, result_code text NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, command_key), FOREIGN KEY (tenant_id, command_key) REFERENCES fin_commands (tenant_id, command_key))`,
  `CREATE TABLE IF NOT EXISTS fin_audit (id bigserial PRIMARY KEY, tenant_id text NOT NULL, invoice_id text, command_key text NOT NULL, actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS fin_outbox (id bigserial PRIMARY KEY, tenant_id text NOT NULL, command_key text NOT NULL, topic text NOT NULL, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'disabled', created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, command_key, topic))`,
  `ALTER TABLE fin_invoices ADD COLUMN IF NOT EXISTS contract_id text`,
  `ALTER TABLE fin_invoices ADD COLUMN IF NOT EXISTS account_id text`,
  `CREATE OR REPLACE FUNCTION fin_snapshot(i fin_invoices) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT md5(i.id || '|' || i.customer || '|' || i.amount_minor || '|' || i.currency || '|' || i.memo) $$`,
  `CREATE OR REPLACE FUNCTION fin_cmd(p_tenant text, p_key text, p_hash text, p_actor text, p_action text, p_invoice text, p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE c fin_commands%ROWTYPE; inv fin_invoices%ROWTYPE; v_code text := 'OK'; v_msg text; v_id text := p_invoice; v_paid bigint;
BEGIN
  -- Authorization is decided here from the stored grant, reloaded on every command; the client sends no role.
  IF NOT EXISTS (SELECT 1 FROM fin_roles r WHERE r.tenant_id = p_tenant AND r.user_id = p_actor AND r.revoked_at IS NULL
                 AND r.role = CASE WHEN p_action IN ('approve', 'reject') THEN 'approver' ELSE 'preparer' END) THEN
    RETURN jsonb_build_object('resultCode', 'NOT_AUTHORIZED', 'message', 'You do not have the finance role this action needs.');
  END IF;
  SELECT * INTO c FROM fin_commands WHERE tenant_id = p_tenant AND command_key = p_key;
  IF FOUND THEN
    IF c.payload_hash <> p_hash THEN RETURN jsonb_build_object('resultCode', 'IDEMPOTENCY_CONFLICT', 'message', 'This command key was already used with different details.'); END IF;
    RETURN (SELECT jsonb_build_object('replay', true, 'invoiceId', invoice_id, 'resultCode', result_code, 'message', message) FROM fin_receipts WHERE tenant_id = p_tenant AND command_key = p_key);
  END IF;
  INSERT INTO fin_commands VALUES (p_tenant, p_key, p_hash, p_action, p_actor);

  IF p_action = 'create' THEN
    v_id := 'inv_' || substr(md5(p_tenant || p_key), 1, 12);
    INSERT INTO fin_invoices (tenant_id, id, customer, amount_minor, currency, memo, status, created_by, contract_id, account_id)
    VALUES (p_tenant, v_id, p->>'customer', (p->>'amountMinor')::bigint, upper(p->>'currency'), coalesce(p->>'memo', ''), 'Draft', p_actor, p->>'contractId', p->>'accountId');
    v_msg := 'Draft invoice created.';
  ELSE
    SELECT * INTO inv FROM fin_invoices WHERE tenant_id = p_tenant AND id = p_invoice FOR UPDATE;
    IF NOT FOUND THEN v_code := 'NOT_FOUND'; v_msg := 'Invoice not found in this workspace.';
    ELSIF p_action = 'submit' THEN
      IF inv.status NOT IN ('Draft', 'Rejected') THEN v_code := 'BAD_STATE'; v_msg := 'Only drafts can be submitted.';
      ELSE UPDATE fin_invoices SET status = 'Pending approval', updated_at = now() WHERE tenant_id = p_tenant AND id = p_invoice; v_msg := 'Submitted for approval.'; END IF;
    ELSIF p_action IN ('approve', 'reject') THEN
      IF inv.status <> 'Pending approval' THEN v_code := 'BAD_STATE'; v_msg := 'Invoice is not awaiting approval.';
      ELSIF inv.created_by = p_actor THEN v_code := 'SELF_APPROVAL'; v_msg := 'You created this invoice — another person must approve it.';
      ELSIF p->>'snapshot' IS DISTINCT FROM fin_snapshot(inv) THEN v_code := 'PAYLOAD_CHANGED'; v_msg := 'The invoice changed since you reviewed it. Reload and review again.';
      ELSIF p_action = 'approve' THEN
        UPDATE fin_invoices SET status = 'Approved', approved_by = p_actor, approved_hash = fin_snapshot(inv), updated_at = now() WHERE tenant_id = p_tenant AND id = p_invoice; v_msg := 'Approved. Issuing stays disabled (synthetic).';
      ELSE UPDATE fin_invoices SET status = 'Rejected', updated_at = now() WHERE tenant_id = p_tenant AND id = p_invoice; v_msg := 'Rejected and returned to the author.'; END IF;
    ELSIF p_action = 'payment' THEN
      IF inv.status NOT IN ('Approved', 'Mismatch') THEN v_code := 'BAD_STATE'; v_msg := 'Payments can only be recorded against approved invoices.';
      ELSIF EXISTS (SELECT 1 FROM fin_payments WHERE tenant_id = p_tenant AND reference = p->>'reference') THEN v_code := 'DUPLICATE_PAYMENT'; v_msg := 'That payment reference is already recorded.';
      ELSE INSERT INTO fin_payments (tenant_id, invoice_id, amount_minor, reference, command_key) VALUES (p_tenant, p_invoice, (p->>'amountMinor')::bigint, p->>'reference', p_key); v_msg := 'Synthetic payment event recorded. Reconcile to settle.'; END IF;
    ELSIF p_action = 'reconcile' THEN
      IF inv.status NOT IN ('Approved', 'Mismatch', 'Paid') THEN v_code := 'BAD_STATE'; v_msg := 'Only approved invoices can be reconciled.';
      ELSE
        SELECT coalesce(sum(amount_minor), 0) INTO v_paid FROM fin_payments WHERE tenant_id = p_tenant AND invoice_id = p_invoice;
        IF v_paid = inv.amount_minor THEN UPDATE fin_invoices SET status = 'Paid', updated_at = now() WHERE tenant_id = p_tenant AND id = p_invoice; v_msg := 'Reconciled: payments match the invoice.';
        ELSE UPDATE fin_invoices SET status = 'Mismatch', updated_at = now() WHERE tenant_id = p_tenant AND id = p_invoice; v_code := 'MISMATCH'; v_msg := 'Payments total ' || v_paid || ' vs invoice ' || inv.amount_minor || ' (minor units).'; END IF;
      END IF;
    ELSE v_code := 'UNKNOWN_ACTION'; v_msg := 'Unknown action.'; END IF;
  END IF;

  INSERT INTO fin_receipts VALUES (p_tenant, p_key, v_id, v_code, v_msg);
  INSERT INTO fin_audit (tenant_id, invoice_id, command_key, actor_id, action, detail) VALUES (p_tenant, v_id, p_key, p_actor, p_action, v_code || ' · ' || v_msg);
  IF v_code = 'OK' THEN INSERT INTO fin_outbox (tenant_id, command_key, topic, payload) VALUES (p_tenant, p_key, 'customer.notice', jsonb_build_object('invoiceId', v_id, 'action', p_action)); END IF;
  RETURN jsonb_build_object('invoiceId', v_id, 'resultCode', v_code, 'message', v_msg);
END $$`,
  // Audit and receipts are append-only for every role subject to triggers, including the table owner.
  `CREATE OR REPLACE FUNCTION fin_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'AUDIT_APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS fin_audit_append_only ON fin_audit`,
  `CREATE TRIGGER fin_audit_append_only BEFORE UPDATE OR DELETE ON fin_audit FOR EACH ROW EXECUTE FUNCTION fin_refuse_change()`,
  `DROP TRIGGER IF EXISTS fin_audit_no_truncate ON fin_audit`,
  `CREATE TRIGGER fin_audit_no_truncate BEFORE TRUNCATE ON fin_audit FOR EACH STATEMENT EXECUTE FUNCTION fin_refuse_change()`,
  `DROP TRIGGER IF EXISTS fin_receipts_append_only ON fin_receipts`,
  `CREATE TRIGGER fin_receipts_append_only BEFORE UPDATE OR DELETE ON fin_receipts FOR EACH ROW EXECUTE FUNCTION fin_refuse_change()`,
];
