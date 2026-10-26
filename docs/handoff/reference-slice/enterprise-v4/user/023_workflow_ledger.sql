-- 023_workflow_ledger.sql: tamper-evident, append-only ledger for registrar workflow transitions (immutable-audit PDF, 6 Oct).
-- Schema semester, after 022. NOT executed or parsed. Each row stores sha256(prev_hash || canonical row); one chain per tenant.
-- Appends are serialized per tenant, so the chain can't fork. verify_workflow_ledger() recomputes the chain and reports the first break.
BEGIN;
SET LOCAL search_path = semester, public;
CREATE TABLE workflow_ledger (
  tenant_id uuid NOT NULL REFERENCES institutions(id),
  seq bigint NOT NULL,
  machine text NOT NULL, machine_version integer NOT NULL,
  subject_type text NOT NULL, subject_id uuid NOT NULL,
  from_state text NOT NULL, event text NOT NULL, to_state text NOT NULL,
  actor_person_id uuid, actor_role text NOT NULL, reason text,
  payload jsonb NOT NULL DEFAULT '{}',          -- schema-validated by the engine before append (see registrar-workflow.json)
  occurred_at timestamptz NOT NULL DEFAULT now(),
  prev_hash bytea NOT NULL, row_hash bytea NOT NULL,
  PRIMARY KEY (tenant_id, seq)
);
CREATE TRIGGER workflow_ledger_append_only BEFORE UPDATE OR DELETE ON workflow_ledger FOR EACH ROW EXECUTE FUNCTION sx_private.append_only();
REVOKE TRUNCATE ON workflow_ledger FROM PUBLIC, anon, authenticated;

CREATE FUNCTION semester.ledger_row_digest(p_prev bytea, r semester.workflow_ledger) RETURNS bytea LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT extensions.digest(p_prev || convert_to(jsonb_build_object('tenant', r.tenant_id, 'seq', r.seq, 'machine', r.machine, 'v', r.machine_version, 'type', r.subject_type, 'id', r.subject_id,
    'from', r.from_state, 'event', r.event, 'to', r.to_state, 'actor', r.actor_person_id, 'role', r.actor_role, 'reason', r.reason, 'payload', r.payload, 'at', r.occurred_at)::text, 'UTF8'), 'sha256') $$;

-- Append (called inside the same transaction as the business change, by the transition commands).
CREATE FUNCTION semester.append_workflow_ledger(p_tenant uuid, p_machine text, p_version integer, p_type text, p_id uuid, p_from text, p_event text, p_to text, p_role text, p_reason text, p_payload jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE last record; r semester.workflow_ledger; genesis bytea := extensions.digest(convert_to('semester-ledger-genesis:' || p_tenant, 'UTF8'), 'sha256');
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('ledger:' || p_tenant, 0));
  SELECT seq, row_hash INTO last FROM semester.workflow_ledger WHERE tenant_id = p_tenant ORDER BY seq DESC LIMIT 1;
  r.tenant_id := p_tenant; r.seq := coalesce(last.seq, 0) + 1; r.machine := p_machine; r.machine_version := p_version; r.subject_type := p_type; r.subject_id := p_id;
  r.from_state := p_from; r.event := p_event; r.to_state := p_to; r.actor_person_id := semester.actor_person(p_tenant); r.actor_role := p_role; r.reason := p_reason; r.payload := coalesce(p_payload, '{}'); r.occurred_at := now();
  r.prev_hash := coalesce(last.row_hash, genesis); r.row_hash := semester.ledger_row_digest(r.prev_hash, r);
  INSERT INTO semester.workflow_ledger VALUES (r.*);
  RETURN r.seq;
END $$;

-- Verify: walks the chain; returns the first seq whose hash doesn't recompute (NULL = intact). Run nightly and before audits.
CREATE FUNCTION semester.verify_workflow_ledger(p_tenant uuid) RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r semester.workflow_ledger; prev bytea := extensions.digest(convert_to('semester-ledger-genesis:' || p_tenant, 'UTF8'), 'sha256'); expect bigint := 1;
BEGIN
  FOR r IN SELECT * FROM semester.workflow_ledger WHERE tenant_id = p_tenant ORDER BY seq LOOP
    IF r.seq <> expect OR r.prev_hash <> prev OR r.row_hash <> semester.ledger_row_digest(prev, r) THEN RETURN r.seq; END IF;
    prev := r.row_hash; expect := expect + 1;
  END LOOP;
  RETURN NULL;
END $$;

ALTER TABLE workflow_ledger ENABLE ROW LEVEL SECURITY; ALTER TABLE workflow_ledger FORCE ROW LEVEL SECURITY; REVOKE ALL ON workflow_ledger FROM PUBLIC, anon, authenticated;
ALTER FUNCTION semester.append_workflow_ledger(uuid, text, integer, text, uuid, text, text, text, text, text, jsonb) OWNER TO semester_rls_helper;
ALTER FUNCTION semester.verify_workflow_ledger(uuid) OWNER TO semester_rls_helper;
REVOKE ALL ON FUNCTION semester.append_workflow_ledger(uuid, text, integer, text, uuid, text, text, text, text, text, jsonb), semester.verify_workflow_ledger(uuid) FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON workflow_ledger TO semester_rls_helper;
-- Also export the chain head (latest seq + row_hash) daily to a separately protected store, so a database-level rewrite of the whole
-- chain is still detectable. Append-only triggers don't stop a database administrator; the external head does.
COMMIT;
