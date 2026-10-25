// Migration sub-001: registration submit idempotency. The key row is inserted before any Zite write, so a
// retried or concurrent submit with the same key sees one reservation (PRIMARY KEY), never two submits.
export const SUB_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS reg_submit_keys (tenant_id text NOT NULL, request_key text NOT NULL, student_id text NOT NULL, term text NOT NULL,
     sections text[] NOT NULL, state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','done')),
     created_at timestamptz NOT NULL DEFAULT now(), done_at timestamptz, PRIMARY KEY (tenant_id, request_key), CHECK ((state = 'done') = (done_at IS NOT NULL)))`,
  // Returns the reservation as it stands after the call (new or existing). Another student's key returns {forbidden:true}.
  `CREATE OR REPLACE FUNCTION reg_submit_reserve(p_tenant text, p_key text, p_student text, p_term text, p_sections text[]) RETURNS jsonb LANGUAGE plpgsql AS $$
   DECLARE k reg_submit_keys%ROWTYPE; created boolean;
   BEGIN
     INSERT INTO reg_submit_keys (tenant_id, request_key, student_id, term, sections) VALUES (p_tenant, p_key, p_student, p_term, p_sections) ON CONFLICT DO NOTHING;
     created := FOUND;
     SELECT * INTO k FROM reg_submit_keys WHERE tenant_id = p_tenant AND request_key = p_key FOR UPDATE;
     IF k.student_id <> p_student THEN RETURN jsonb_build_object('forbidden', true); END IF;
     RETURN jsonb_build_object('created', created, 'sections', to_jsonb(k.sections), 'state', k.state, 'term', k.term);
   END $$`,
  `CREATE OR REPLACE FUNCTION reg_submit_done(p_tenant text, p_key text) RETURNS void LANGUAGE sql AS $$
     UPDATE reg_submit_keys SET state = 'done', done_at = now() WHERE tenant_id = p_tenant AND request_key = p_key AND state = 'reserved' $$`,
];
