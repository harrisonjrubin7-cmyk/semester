// Migration ctx-001: active app context (connected-role-apps pack: "context switching"). One active role app per person per
// institution. The endpoint decides which apps are allowed from server-resolved membership; this only records the choice and
// an append-only trail of switches. Switching never grants anything: every screen keeps its own checks.
export const CTX_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS ctx_active (tenant_id text NOT NULL, user_id text NOT NULL, app_key text NOT NULL, switched_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, user_id))`,
  `CREATE TABLE IF NOT EXISTS ctx_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, user_id text NOT NULL, from_key text, to_key text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION ctx_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS ctx_events_append_only ON ctx_events`,
  `CREATE TRIGGER ctx_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON ctx_events FOR EACH STATEMENT EXECUTE FUNCTION ctx_refuse_change()`,
  `CREATE OR REPLACE FUNCTION ctx_switch(p_tenant text, p_user text, p_key text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_from text;
   BEGIN
     SELECT app_key INTO v_from FROM ctx_active WHERE tenant_id = p_tenant AND user_id = p_user FOR UPDATE;
     IF v_from = p_key THEN RETURN NULL; END IF;
     INSERT INTO ctx_active (tenant_id, user_id, app_key) VALUES (p_tenant, p_user, p_key)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET app_key = p_key, switched_at = now();
     INSERT INTO ctx_events (tenant_id, user_id, from_key, to_key) VALUES (p_tenant, p_user, v_from, p_key);
     RETURN NULL;
   END $$`,
];
