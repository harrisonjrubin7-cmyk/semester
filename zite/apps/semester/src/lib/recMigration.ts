// Migration rec-001: connector scope grants (versioned, append-only history) and reconciliation runs (append-only).
export const REC_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS int_scope_grants (id bigserial PRIMARY KEY, tenant_id text NOT NULL, connector text NOT NULL CHECK (connector IN ('SIS','LMS','SSO','Calendar')),
     scopes text[] NOT NULL, reason text NOT NULL DEFAULT '', granted_by text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE TABLE IF NOT EXISTS rec_runs (id bigserial PRIMARY KEY, tenant_id text NOT NULL, run_by text NOT NULL, outbox_dispatched int NOT NULL, outbox_failed int NOT NULL,
     seats int NOT NULL, findings jsonb NOT NULL, repaired int NOT NULL, flagged int NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION rec_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS int_scope_grants_append_only ON int_scope_grants`,
  `CREATE TRIGGER int_scope_grants_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON int_scope_grants FOR EACH STATEMENT EXECUTE FUNCTION rec_refuse_change()`,
  `DROP TRIGGER IF EXISTS rec_runs_append_only ON rec_runs`,
  `CREATE TRIGGER rec_runs_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON rec_runs FOR EACH STATEMENT EXECUTE FUNCTION rec_refuse_change()`,
];
