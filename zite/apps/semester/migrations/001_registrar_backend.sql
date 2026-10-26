-- Migration 001: controlled registrar backend (Neon Postgres).
-- Applied idempotently by apps/semester/src/lib/pg.ts. Review before production use.
-- Invariant: a seat, its command, receipt, audit entry and outbox entry are written in ONE transaction.

CREATE TABLE IF NOT EXISTS reg_commands (
  tenant_id text NOT NULL,
  command_key text NOT NULL,              -- idempotency key: one per request decision
  payload_hash text NOT NULL,             -- same key + different payload = conflict (409)
  kind text NOT NULL,
  actor_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, command_key)
);

CREATE TABLE IF NOT EXISTS reg_seats (
  tenant_id text NOT NULL,
  section_id text NOT NULL,
  student_id text NOT NULL,
  request_id text NOT NULL,
  command_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, section_id, student_id),
  FOREIGN KEY (tenant_id, command_key) REFERENCES reg_commands (tenant_id, command_key)
);

CREATE TABLE IF NOT EXISTS reg_section_locks (
  tenant_id text NOT NULL,
  section_id text NOT NULL,
  capacity int,
  PRIMARY KEY (tenant_id, section_id)
);

CREATE TABLE IF NOT EXISTS reg_receipts (
  tenant_id text NOT NULL,
  command_key text NOT NULL,
  state text NOT NULL,                    -- Committed | Rejected
  result_code text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, command_key),
  FOREIGN KEY (tenant_id, command_key) REFERENCES reg_commands (tenant_id, command_key)
);

CREATE TABLE IF NOT EXISTS reg_audit (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  command_key text NOT NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reg_outbox (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  command_key text NOT NULL,
  topic text NOT NULL,                    -- zite.mirror: update request/enrollment records in Zite
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | dispatched
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  UNIQUE (tenant_id, command_key, topic)
);

-- One call = one transaction. Locks the section row so concurrent commits serialize on capacity.
CREATE OR REPLACE FUNCTION reg_decide(
  p_tenant text, p_key text, p_hash text, p_actor text, p_decision text,
  p_section text, p_student text, p_request text, p_capacity int, p_note text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_existing reg_commands%ROWTYPE;
  v_taken int;
  v_state text; v_code text; v_msg text;
BEGIN
  SELECT * INTO v_existing FROM reg_commands WHERE tenant_id = p_tenant AND command_key = p_key;
  IF FOUND THEN
    IF v_existing.payload_hash <> p_hash THEN
      RETURN jsonb_build_object('conflict', true);
    END IF;
    RETURN (SELECT jsonb_build_object('replay', true, 'state', state, 'resultCode', result_code, 'message', message)
            FROM reg_receipts WHERE tenant_id = p_tenant AND command_key = p_key);
  END IF;

  INSERT INTO reg_commands (tenant_id, command_key, payload_hash, kind, actor_id)
  VALUES (p_tenant, p_key, p_hash, 'registrar.' || p_decision, p_actor);

  INSERT INTO reg_section_locks (tenant_id, section_id, capacity) VALUES (p_tenant, p_section, p_capacity)
  ON CONFLICT (tenant_id, section_id) DO UPDATE SET capacity = EXCLUDED.capacity;
  PERFORM 1 FROM reg_section_locks WHERE tenant_id = p_tenant AND section_id = p_section FOR UPDATE;

  IF p_decision = 'reject' THEN
    v_state := 'Rejected'; v_code := 'REJECTED_BY_REGISTRAR'; v_msg := coalesce(nullif(p_note, ''), 'Request declined by the Registrar.');
  ELSIF EXISTS (SELECT 1 FROM reg_seats WHERE tenant_id = p_tenant AND section_id = p_section AND student_id = p_student) THEN
    v_state := 'Rejected'; v_code := 'ALREADY_ENROLLED'; v_msg := 'Student already holds a seat in this section.';
  ELSE
    SELECT count(*) INTO v_taken FROM reg_seats WHERE tenant_id = p_tenant AND section_id = p_section;
    IF p_capacity IS NOT NULL AND v_taken >= p_capacity THEN
      v_state := 'Rejected'; v_code := 'SECTION_FULL'; v_msg := 'The section is full.';
    ELSE
      INSERT INTO reg_seats (tenant_id, section_id, student_id, request_id, command_key)
      VALUES (p_tenant, p_section, p_student, p_request, p_key);
      v_state := 'Committed'; v_code := 'OK'; v_msg := 'Enrollment confirmed by the Registrar.';
    END IF;
  END IF;

  INSERT INTO reg_receipts (tenant_id, command_key, state, result_code, message) VALUES (p_tenant, p_key, v_state, v_code, v_msg);
  INSERT INTO reg_audit (tenant_id, command_key, actor_id, action, detail)
  VALUES (p_tenant, p_key, p_actor, 'Registration ' || lower(v_state), v_code || coalesce(' · ' || nullif(p_note, ''), ''));
  INSERT INTO reg_outbox (tenant_id, command_key, topic, payload)
  VALUES (p_tenant, p_key, 'zite.mirror', jsonb_build_object('requestId', p_request, 'state', v_state, 'resultCode', v_code, 'message', v_msg));

  RETURN jsonb_build_object('state', v_state, 'resultCode', v_code, 'message', v_msg);
END $$;
