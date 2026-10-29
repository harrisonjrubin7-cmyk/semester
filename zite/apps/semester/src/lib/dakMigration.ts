// Migration dak-001: decision acknowledgment (role app "Admitted Student": decision acknowledgment). Requires adm-001.
// The applicant acknowledges a released admissions decision. The acknowledgment records exactly what they were shown: a
// fingerprint of the decision and the message, which must match the released text at that moment, so a stale or altered
// screen cannot be acknowledged. Only the applicant, only once, only after release. Acknowledging accepts nothing and
// pays nothing: enrollment intent and deposit stay separate steps. Acknowledgments are append-only.
export const DAK_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS dak_acks (application_id text PRIMARY KEY, tenant_id text NOT NULL, applicant_id text NOT NULL, decision text NOT NULL,
     seen_hash text NOT NULL CHECK (seen_hash ~ '^[0-9a-f]{32}$'), acknowledged_at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION dak_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS dak_acks_append_only ON dak_acks`,
  `CREATE TRIGGER dak_acks_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON dak_acks FOR EACH STATEMENT EXECUTE FUNCTION dak_refuse_change()`,
  /** Fingerprint of what the applicant is shown for a released decision. */
  `CREATE OR REPLACE FUNCTION dak_fingerprint(p_decision text, p_message text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT md5(coalesce(p_decision, '') || '|' || coalesce(p_message, '')) $$`,
  `CREATE OR REPLACE FUNCTION dak_ack(p_tenant text, p_actor text, p_app text, p_seen text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r adm_reviews%ROWTYPE; BEGIN
     SELECT * INTO r FROM adm_reviews WHERE application_id = p_app AND tenant_id = p_tenant;
     IF NOT FOUND OR r.applicant_id <> p_actor THEN RETURN 'This is not your decision.'; END IF;
     IF r.state <> 'Released' THEN RETURN 'This decision has not been released.'; END IF;
     IF EXISTS (SELECT 1 FROM dak_acks WHERE application_id = p_app) THEN RETURN 'You already acknowledged this decision.'; END IF;
     IF p_seen IS DISTINCT FROM dak_fingerprint(r.decision, r.applicant_message) THEN RETURN 'The decision you are looking at is out of date. Reload and read it again.'; END IF;
     INSERT INTO dak_acks (application_id, tenant_id, applicant_id, decision, seen_hash) VALUES (p_app, p_tenant, p_actor, r.decision, p_seen);
     INSERT INTO adm_events (tenant_id, application_id, actor_id, action, detail) VALUES (p_tenant, p_app, p_actor, 'acknowledged', r.decision);
     RETURN 'ok:' || p_app;
   END $$`,
];
