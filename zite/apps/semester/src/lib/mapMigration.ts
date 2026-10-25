// Migration map-001: integration field-mapping versions and drift reports. Shape validation is in lib/mappingRules.ts (TS,
// before calling); this layer enforces the two-person rule (CHECK), one waiting proposal per connector, and append-only reports.
export const MAP_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS map_versions (id bigserial PRIMARY KEY, tenant_id text NOT NULL, connector text NOT NULL CHECK (connector IN ('SIS','LMS','SSO','Calendar')),
     version int NOT NULL, rows jsonb NOT NULL, note text NOT NULL DEFAULT '', state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed','approved','rejected','superseded')),
     proposed_by text NOT NULL, decided_by text, decided_at timestamptz, decision_note text, created_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, connector, version), CHECK (decided_by IS NULL OR decided_by <> proposed_by))`,
  `CREATE TABLE IF NOT EXISTS map_drift (id bigserial PRIMARY KEY, tenant_id text NOT NULL, connector text NOT NULL, mapping_version int, sent_fields text[] NOT NULL,
     report jsonb NOT NULL, ok boolean NOT NULL, checked_by text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION map_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS map_drift_append_only ON map_drift`,
  `CREATE TRIGGER map_drift_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON map_drift FOR EACH STATEMENT EXECUTE FUNCTION map_refuse_change()`,
  `CREATE OR REPLACE FUNCTION map_propose(p_actor text, p_tenant text, p_connector text, p_rows jsonb, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v int;
   BEGIN
     IF EXISTS (SELECT 1 FROM map_versions WHERE tenant_id = p_tenant AND connector = p_connector AND state = 'proposed') THEN RETURN 'A mapping change for this connector is already waiting.'; END IF;
     PERFORM pg_advisory_xact_lock(hashtext('map:' || p_tenant || p_connector));
     SELECT coalesce(max(version), 0) + 1 INTO v FROM map_versions WHERE tenant_id = p_tenant AND connector = p_connector;
     INSERT INTO map_versions (tenant_id, connector, version, rows, note, proposed_by) VALUES (p_tenant, p_connector, v, p_rows, trim(coalesce(p_note, '')), p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION map_decide(p_actor text, p_tenant text, p_id bigint, p_approve boolean, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE m map_versions%ROWTYPE;
   BEGIN
     SELECT * INTO m FROM map_versions WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Mapping not found.'; END IF;
     IF m.state <> 'proposed' THEN RETURN 'Already decided.'; END IF;
     IF m.proposed_by = p_actor THEN RETURN 'A different administrator must approve this mapping.'; END IF;
     IF NOT p_approve AND length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say why it is rejected.'; END IF;
     IF p_approve THEN UPDATE map_versions SET state = 'superseded' WHERE tenant_id = p_tenant AND connector = m.connector AND state = 'approved'; END IF;
     UPDATE map_versions SET state = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, decided_by = p_actor, decided_at = now(), decision_note = trim(coalesce(p_note, '')) WHERE id = p_id;
     RETURN NULL;
   END $$`,
];
