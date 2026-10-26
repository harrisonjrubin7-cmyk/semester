// Migration dec-001 (SEC-039): append-only authorization decision log. Actor, tenant, action, decision, failed rule and a
// correlation id only — never record contents or credentials.
export const DEC_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS authz_decisions (id bigserial PRIMARY KEY, correlation_id text NOT NULL, actor_id text NOT NULL, tenant_id text NOT NULL DEFAULT '',
     action text NOT NULL, decision text NOT NULL CHECK (decision IN ('allow','deny')), failed_rule text, resource_ref text NOT NULL DEFAULT '',
     at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE INDEX IF NOT EXISTS authz_decisions_tenant_at ON authz_decisions (tenant_id, at DESC)`,
  `CREATE INDEX IF NOT EXISTS authz_decisions_cid ON authz_decisions (correlation_id)`,
  `CREATE OR REPLACE FUNCTION authz_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS authz_decisions_append_only ON authz_decisions`,
  `CREATE TRIGGER authz_decisions_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON authz_decisions FOR EACH STATEMENT EXECUTE FUNCTION authz_refuse_change()`,
];
