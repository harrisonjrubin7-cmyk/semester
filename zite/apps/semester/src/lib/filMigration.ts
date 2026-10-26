// Migration fil-001: private file store (decision D2). Bytes live in Postgres in a separate table, reachable only
// through fil_read, which re-authorizes every call (owner, or a live unrevoked grant in the same tenant) and logs it.
// There are no URLs: the endpoint returns bytes to an authorized caller only. Access log is append-only.
export const FIL_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS fil_files (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id text NOT NULL, owner_id text NOT NULL,
     name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200), mime text NOT NULL, size_bytes int NOT NULL CHECK (size_bytes BETWEEN 1 AND 4194304),
     sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'), purpose text NOT NULL CHECK (purpose IN ('personal','submission','evidence','shared')),
     created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz)`,
  `CREATE INDEX IF NOT EXISTS fil_files_owner ON fil_files (tenant_id, owner_id) WHERE deleted_at IS NULL`,
  `CREATE TABLE IF NOT EXISTS fil_blobs (file_id uuid PRIMARY KEY REFERENCES fil_files(id), bytes bytea NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS fil_grants (id bigserial PRIMARY KEY, tenant_id text NOT NULL, file_id uuid NOT NULL REFERENCES fil_files(id),
     grantee_id text NOT NULL, granted_by text NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (grantee_id <> granted_by), CHECK (expires_at <= created_at + interval '366 days'))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS fil_grants_live ON fil_grants (file_id, grantee_id) WHERE revoked_at IS NULL`,
  `CREATE TABLE IF NOT EXISTS fil_access_log (id bigserial PRIMARY KEY, tenant_id text NOT NULL, file_id uuid, actor_id text NOT NULL,
     action text NOT NULL CHECK (action IN ('upload','download','denied','grant','revoke','delete')), detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION fil_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fil_access_log_append_only') THEN
       CREATE TRIGGER fil_access_log_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON fil_access_log FOR EACH STATEMENT EXECUTE FUNCTION fil_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION fil_can_read(p_tenant text, p_file uuid, p_actor text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM fil_files f WHERE f.id = p_file AND f.tenant_id = p_tenant AND f.deleted_at IS NULL AND (
       f.owner_id = p_actor OR EXISTS (SELECT 1 FROM fil_grants g WHERE g.file_id = f.id AND g.tenant_id = p_tenant AND g.grantee_id = p_actor
         AND g.revoked_at IS NULL AND g.expires_at > now()))) $$`,
  `CREATE OR REPLACE FUNCTION fil_put(p_tenant text, p_owner text, p_name text, p_mime text, p_purpose text, p_bytes bytea) RETURNS uuid LANGUAGE plpgsql AS $$
   DECLARE v uuid;
   BEGIN
     INSERT INTO fil_files (tenant_id, owner_id, name, mime, size_bytes, sha256, purpose)
       VALUES (p_tenant, p_owner, trim(p_name), p_mime, octet_length(p_bytes), encode(sha256(p_bytes), 'hex'), p_purpose) RETURNING id INTO v;
     INSERT INTO fil_blobs (file_id, bytes) VALUES (v, p_bytes);
     INSERT INTO fil_access_log (tenant_id, file_id, actor_id, action, detail) VALUES (p_tenant, v, p_owner, 'upload', octet_length(p_bytes)::text || ' bytes');
     RETURN v;
   END $$`,
  // Returns the file only when authorized; every call, allowed or not, leaves a log row.
  `CREATE OR REPLACE FUNCTION fil_read(p_tenant text, p_file uuid, p_actor text) RETURNS TABLE (name text, mime text, bytes bytea) LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT fil_can_read(p_tenant, p_file, p_actor) THEN
       INSERT INTO fil_access_log (tenant_id, file_id, actor_id, action) VALUES (p_tenant, p_file, p_actor, 'denied');
       RETURN;
     END IF;
     INSERT INTO fil_access_log (tenant_id, file_id, actor_id, action) VALUES (p_tenant, p_file, p_actor, 'download');
     RETURN QUERY SELECT f.name, f.mime, b.bytes FROM fil_files f JOIN fil_blobs b ON b.file_id = f.id WHERE f.id = p_file;
   END $$`,
  `CREATE OR REPLACE FUNCTION fil_grant(p_tenant text, p_file uuid, p_owner text, p_grantee text, p_days int) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM fil_files WHERE id = p_file AND tenant_id = p_tenant AND owner_id = p_owner AND deleted_at IS NULL) THEN RETURN 'Only the owner can share this file.'; END IF;
     IF p_grantee = p_owner THEN RETURN 'You already own this file.'; END IF;
     IF p_days < 1 OR p_days > 365 THEN RETURN 'Share for 1 to 365 days.'; END IF;
     UPDATE fil_grants SET revoked_at = now() WHERE file_id = p_file AND grantee_id = p_grantee AND revoked_at IS NULL;
     INSERT INTO fil_grants (tenant_id, file_id, grantee_id, granted_by, expires_at) VALUES (p_tenant, p_file, p_grantee, p_owner, now() + make_interval(days => p_days));
     INSERT INTO fil_access_log (tenant_id, file_id, actor_id, action, detail) VALUES (p_tenant, p_file, p_owner, 'grant', p_grantee || ' for ' || p_days || ' days');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION fil_revoke(p_tenant text, p_file uuid, p_owner text, p_grantee text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     UPDATE fil_grants g SET revoked_at = now() FROM fil_files f
       WHERE g.file_id = f.id AND f.id = p_file AND f.tenant_id = p_tenant AND f.owner_id = p_owner AND g.grantee_id = p_grantee AND g.revoked_at IS NULL;
     IF NOT FOUND THEN RETURN 'No live share to revoke.'; END IF;
     INSERT INTO fil_access_log (tenant_id, file_id, actor_id, action, detail) VALUES (p_tenant, p_file, p_owner, 'revoke', p_grantee);
     RETURN NULL;
   END $$`,
  // Delete removes the bytes for good and keeps the metadata row (deleted_at) so the log still resolves.
  `CREATE OR REPLACE FUNCTION fil_delete(p_tenant text, p_file uuid, p_owner text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     UPDATE fil_files SET deleted_at = now() WHERE id = p_file AND tenant_id = p_tenant AND owner_id = p_owner AND deleted_at IS NULL;
     IF NOT FOUND THEN RETURN 'Only the owner can delete this file.'; END IF;
     DELETE FROM fil_blobs WHERE file_id = p_file;
     UPDATE fil_grants SET revoked_at = now() WHERE file_id = p_file AND revoked_at IS NULL;
     INSERT INTO fil_access_log (tenant_id, file_id, actor_id, action) VALUES (p_tenant, p_file, p_owner, 'delete');
     RETURN NULL;
   END $$`,
];
