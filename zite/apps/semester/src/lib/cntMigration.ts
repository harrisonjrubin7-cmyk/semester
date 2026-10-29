// E12 Contracts: an institution keeps its contracts with partner organizations here. A contract
// manager drafts a contract and proposes exact terms; the hash pins the terms text, the value and
// the end date together (cnt_hash), and only an administrator of the organization can accept —
// accepting anything else is impossible because the stored acceptance must equal the current hash
// (the table CHECK enforces it for 'active'). Amending an active contract returns it to 'proposed'
// and clears the acceptance, so changed terms are always accepted again. Mirrors E30 (pta_*).
export const CNT_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS cnt_staff (tenant_id text NOT NULL, user_id text NOT NULL, granted_by text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
     PRIMARY KEY (tenant_id, user_id), CHECK (granted_by <> user_id))`,
  `CREATE TABLE IF NOT EXISTS cnt_contracts (id bigserial PRIMARY KEY, tenant_id text NOT NULL, org_id bigint NOT NULL REFERENCES pta_orgs(id),
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 160), kind text NOT NULL CHECK (kind IN ('supplier','service','partner','other')),
     value_cents bigint NOT NULL DEFAULT 0 CHECK (value_cents >= 0), starts_on date, ends_on date,
     terms_text text NOT NULL DEFAULT '', terms_hash text, state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','proposed','active','ended','terminated')),
     accepted_hash text, accepted_by text, accepted_at timestamptz, proposed_by text, version int NOT NULL DEFAULT 1,
     created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on),
     CHECK (state <> 'active' OR (accepted_hash IS NOT NULL AND accepted_hash = terms_hash)))`,
  `CREATE TABLE IF NOT EXISTS cnt_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, contract_id bigint NOT NULL, actor_id text NOT NULL,
     step text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION cnt_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'cnt_events_append_only') THEN
       CREATE TRIGGER cnt_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON cnt_events FOR EACH STATEMENT EXECUTE FUNCTION cnt_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION cnt_hash(p_terms text, p_value bigint, p_ends date) RETURNS text LANGUAGE sql IMMUTABLE AS $$
     SELECT encode(sha256(convert_to(trim(p_terms) || '|' || p_value::text || '|' || coalesce(p_ends::text, ''), 'UTF8')), 'hex') $$`,
  `CREATE OR REPLACE FUNCTION cnt_is_manager(p_tenant text, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM cnt_staff WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL) $$`,
  `CREATE OR REPLACE FUNCTION cnt_set_staff(p_admin text, p_tenant text, p_user text, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_admin = p_user THEN RETURN 'Ask another administrator to change your own contract-manager access.'; END IF;
     IF p_on THEN INSERT INTO cnt_staff (tenant_id, user_id, granted_by) VALUES (p_tenant, p_user, p_admin)
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET revoked_at = NULL, granted_by = p_admin, granted_at = now();
     ELSE UPDATE cnt_staff SET revoked_at = now() WHERE tenant_id = p_tenant AND user_id = p_user AND revoked_at IS NULL; END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION cnt_create(p_actor text, p_tenant text, p_org bigint, p_title text, p_kind text, p_value bigint, p_starts date, p_ends date) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint;
   BEGIN
     IF NOT cnt_is_manager(p_tenant, p_actor) THEN RETURN 'Only a contract manager can create a contract.'; END IF;
     IF NOT EXISTS (SELECT 1 FROM pta_relationships WHERE tenant_id = p_tenant AND org_id = p_org AND state NOT IN ('offboarded','rejected')) THEN RETURN 'That organization has no live relationship with this institution. Set one up under Partner organizations first.'; END IF;
     IF p_ends IS NOT NULL AND p_starts IS NOT NULL AND p_ends < p_starts THEN RETURN 'The end date is before the start date.'; END IF;
     INSERT INTO cnt_contracts (tenant_id, org_id, title, kind, value_cents, starts_on, ends_on, created_by)
       VALUES (p_tenant, p_org, trim(p_title), p_kind, coalesce(p_value, 0), p_starts, p_ends, p_actor) RETURNING id INTO v_id;
     INSERT INTO cnt_events (tenant_id, contract_id, actor_id, step, note) VALUES (p_tenant, v_id, p_actor, 'create', trim(p_title));
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION cnt_propose(p_actor text, p_tenant text, p_id bigint, p_terms text, p_value bigint, p_starts date, p_ends date) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c cnt_contracts;
   BEGIN
     IF NOT cnt_is_manager(p_tenant, p_actor) THEN RETURN 'Only a contract manager can propose terms.'; END IF;
     SELECT * INTO c FROM cnt_contracts WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Contract not found.'; END IF;
     IF c.state IN ('ended','terminated') THEN RETURN 'That contract is closed; it cannot be amended.'; END IF;
     IF length(trim(p_terms)) < 20 THEN RETURN 'Write the terms in full — at least a short paragraph.'; END IF;
     IF p_ends IS NOT NULL AND p_starts IS NOT NULL AND p_ends < p_starts THEN RETURN 'The end date is before the start date.'; END IF;
     UPDATE cnt_contracts SET terms_text = trim(p_terms), value_cents = coalesce(p_value, c.value_cents), starts_on = p_starts, ends_on = p_ends,
       terms_hash = cnt_hash(p_terms, coalesce(p_value, c.value_cents), p_ends), state = 'proposed', proposed_by = p_actor,
       accepted_hash = NULL, accepted_by = NULL, accepted_at = NULL, version = version + 1, updated_at = now() WHERE id = p_id;
     INSERT INTO cnt_events (tenant_id, contract_id, actor_id, step) VALUES (p_tenant, p_id, p_actor, CASE WHEN c.state = 'active' THEN 'amend' ELSE 'propose' END);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION cnt_accept(p_actor text, p_id bigint, p_expected int, p_hash text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c cnt_contracts;
   BEGIN
     SELECT * INTO c FROM cnt_contracts WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR pta_role(c.org_id, p_actor) IS DISTINCT FROM 'admin' THEN RETURN 'Only an administrator of the organization accepts its contracts.'; END IF;
     IF c.version <> p_expected THEN RETURN 'The contract changed since you opened it. Read it again.'; END IF;
     IF c.state <> 'proposed' THEN RETURN 'There are no terms waiting for acceptance.'; END IF;
     IF p_hash IS DISTINCT FROM c.terms_hash THEN RETURN 'The terms changed since you read them. Read them again.'; END IF;
     UPDATE cnt_contracts SET state = 'active', accepted_hash = c.terms_hash, accepted_by = p_actor, accepted_at = now(), version = version + 1, updated_at = now() WHERE id = p_id;
     INSERT INTO cnt_events (tenant_id, contract_id, actor_id, step) VALUES (c.tenant_id, p_id, p_actor, 'accept');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION cnt_close(p_actor text, p_tenant text, p_id bigint, p_step text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c cnt_contracts;
   BEGIN
     IF NOT cnt_is_manager(p_tenant, p_actor) THEN RETURN 'Only a contract manager can close a contract.'; END IF;
     IF p_step NOT IN ('ended','terminated') THEN RETURN 'Unknown close step.'; END IF;
     SELECT * INTO c FROM cnt_contracts WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Contract not found.'; END IF;
     IF c.state <> 'active' THEN RETURN 'Only an active contract can be closed.'; END IF;
     UPDATE cnt_contracts SET state = p_step, version = version + 1, updated_at = now() WHERE id = p_id;
     INSERT INTO cnt_events (tenant_id, contract_id, actor_id, step) VALUES (p_tenant, p_id, p_actor, p_step);
     RETURN NULL;
   END $$`,
];
