-- 026_double_entry_ledger.sql: double-entry journal with a posting state machine (double-entry ledger PDF, 6 Oct). Schema semester,
-- after 025. NOT executed or parsed. Native ledger only for domains the institution delegates (domain_authority = native);
-- otherwise Banner Finance (or the school's GL) stays the ledger of record and these tables mirror posted totals.
BEGIN;
SET LOCAL search_path = semester, public;
CREATE TABLE gl_accounts (tenant_id uuid NOT NULL REFERENCES institutions(id), code text NOT NULL, name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('asset', 'liability', 'equity', 'revenue', 'expense')), org_reference text, active boolean NOT NULL DEFAULT true, PRIMARY KEY (tenant_id, code));
CREATE TABLE gl_periods (tenant_id uuid NOT NULL, period text NOT NULL CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])$'), status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closing', 'closed')), PRIMARY KEY (tenant_id, period));
CREATE TABLE journal_entries (tenant_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), period text NOT NULL, memo text NOT NULL, source_type text NOT NULL, source_id uuid,
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'pending_approval', 'posted', 'reversed', 'voided')),
  idempotency_key text NOT NULL, created_by uuid NOT NULL, approved_by uuid, posted_at timestamptz, reverses_entry_id uuid,
  PRIMARY KEY (tenant_id, id), UNIQUE (tenant_id, idempotency_key), FOREIGN KEY (tenant_id, period) REFERENCES gl_periods(tenant_id, period),
  CHECK (state <> 'posted' OR (approved_by IS NOT NULL AND approved_by <> created_by AND posted_at IS NOT NULL)));
CREATE TABLE journal_lines (tenant_id uuid NOT NULL, entry_id uuid NOT NULL, line_no smallint NOT NULL, account_code text NOT NULL,
  debit_minor bigint NOT NULL DEFAULT 0 CHECK (debit_minor >= 0), credit_minor bigint NOT NULL DEFAULT 0 CHECK (credit_minor >= 0), currency text NOT NULL DEFAULT 'USD',
  PRIMARY KEY (tenant_id, entry_id, line_no), FOREIGN KEY (tenant_id, entry_id) REFERENCES journal_entries(tenant_id, id), FOREIGN KEY (tenant_id, account_code) REFERENCES gl_accounts(tenant_id, code),
  CHECK ((debit_minor = 0) <> (credit_minor = 0)));     -- each line is exactly one side

-- Posting rules: balanced (sum debits = sum credits, ≥ 2 lines, one currency), open period, separate approver. Posted entries and their
-- lines are immutable; a correction is a reversing entry that mirrors every line, posted once.
CREATE FUNCTION semester.post_journal_entry(p_tenant uuid, p_entry uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e record; d bigint; c bigint; n int; cur int; me uuid := semester.actor_person(p_tenant);
BEGIN
  IF NOT semester.has_permission(p_tenant, 'gl.post') THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN'; END IF;
  SELECT * INTO e FROM semester.journal_entries WHERE tenant_id = p_tenant AND id = p_entry FOR UPDATE;
  IF NOT FOUND OR e.state <> 'pending_approval' THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NOT_PENDING'; END IF;
  IF e.created_by = me THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'SELF_APPROVAL_FORBIDDEN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM semester.gl_periods WHERE tenant_id = p_tenant AND period = e.period AND status = 'open') THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PERIOD_CLOSED'; END IF;
  SELECT coalesce(sum(debit_minor), 0), coalesce(sum(credit_minor), 0), count(*), count(DISTINCT currency) INTO d, c, n, cur FROM semester.journal_lines WHERE tenant_id = p_tenant AND entry_id = p_entry;
  IF n < 2 OR d <> c OR d = 0 OR cur <> 1 THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ENTRY_NOT_BALANCED'; END IF;
  UPDATE semester.journal_entries SET state = 'posted', approved_by = me, posted_at = now() WHERE tenant_id = p_tenant AND id = p_entry;
  PERFORM semester.write_audit(p_tenant, 'approve', 'finance', 'journal_entry', p_entry, 'allow', 'POSTED');
END $$;
CREATE FUNCTION semester.reverse_journal_entry(p_tenant uuid, p_entry uuid, p_period text, p_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e record; r uuid;
BEGIN
  IF NOT semester.has_permission(p_tenant, 'gl.post') THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN'; END IF;
  SELECT * INTO e FROM semester.journal_entries WHERE tenant_id = p_tenant AND id = p_entry FOR UPDATE;
  IF NOT FOUND OR e.state <> 'posted' THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NOT_POSTED'; END IF;
  INSERT INTO semester.journal_entries(tenant_id, period, memo, source_type, source_id, state, idempotency_key, created_by, reverses_entry_id)
  VALUES (p_tenant, p_period, 'Reversal: ' || p_reason, 'reversal', p_entry, 'pending_approval', 'rev:' || p_entry, semester.actor_person(p_tenant), p_entry) RETURNING id INTO r;
  INSERT INTO semester.journal_lines(tenant_id, entry_id, line_no, account_code, debit_minor, credit_minor, currency)
  SELECT tenant_id, r, line_no, account_code, credit_minor, debit_minor, currency FROM semester.journal_lines WHERE tenant_id = p_tenant AND entry_id = p_entry;
  UPDATE semester.journal_entries SET state = 'reversed' WHERE tenant_id = p_tenant AND id = p_entry;   -- the reversal itself still needs a second approver to post
  RETURN r;
END $$;
CREATE FUNCTION semester.guard_posted_lines() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM semester.journal_entries WHERE tenant_id = coalesce(OLD.tenant_id, NEW.tenant_id) AND id = coalesce(OLD.entry_id, NEW.entry_id) AND state IN ('posted', 'reversed')) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'POSTED_LINES_IMMUTABLE'; END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER journal_lines_guard BEFORE INSERT OR UPDATE OR DELETE ON journal_lines FOR EACH ROW EXECUTE FUNCTION semester.guard_posted_lines();
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['gl_accounts', 'gl_periods', 'journal_entries', 'journal_lines'] LOOP
    EXECUTE format('ALTER TABLE semester.%I ENABLE ROW LEVEL SECURITY', t); EXECUTE format('ALTER TABLE semester.%I FORCE ROW LEVEL SECURITY', t); EXECUTE format('REVOKE ALL ON semester.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;
COMMIT;
