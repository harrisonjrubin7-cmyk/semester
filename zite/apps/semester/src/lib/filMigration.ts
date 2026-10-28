// Migration fil-001: private file store (decision D2). Bytes live in Postgres in a separate table, reachable only
// through fil_read, which re-authorizes every call (owner, or a live unrevoked grant in the same tenant) and logs it.
// There are no URLs: the endpoint returns bytes to an authorized caller only. Access log is append-only.
export const FIL_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS fil_files (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id text NOT NULL, owner_id text NOT NULL,
     name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200), mime text NOT NULL, size_bytes int NOT NULL CHECK (size_bytes BETWEEN 1 AND 4194304),
     sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'), purpose text NOT NULL CHECK (purpose IN ('personal','submission','evidence','shared')),
     created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz)`,
  `CREATE INDEX IF NOT EXISTS fil_files_owner ON fil_files (tenant_id, owner_id) WHERE deleted_at IS NULL`,
  // 28 Oct: file safety screening (lib/fileScan.ts). Files stored before then start 'pending' and are screened on next use.
  `ALTER TABLE fil_files ADD COLUMN IF NOT EXISTS scan_status text NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending','clean','blocked'))`,
  `ALTER TABLE fil_files ADD COLUMN IF NOT EXISTS scan_reason text NOT NULL DEFAULT ''`,
  `ALTER TABLE fil_files ADD COLUMN IF NOT EXISTS scan_engine text`,
  `ALTER TABLE fil_files ADD COLUMN IF NOT EXISTS scanned_at timestamptz`,
  `CREATE TABLE IF NOT EXISTS fil_scans (id bigserial PRIMARY KEY, tenant_id text NOT NULL, file_id uuid NOT NULL REFERENCES fil_files(id),
     status text NOT NULL CHECK (status IN ('clean','blocked')), reason text NOT NULL DEFAULT '', engine text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE TABLE IF NOT EXISTS fil_blobs (file_id uuid PRIMARY KEY REFERENCES fil_files(id), bytes bytea NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS fil_grants (id bigserial PRIMARY KEY, tenant_id text NOT NULL, file_id uuid NOT NULL REFERENCES fil_files(id),
     grantee_id text NOT NULL, granted_by text NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (grantee_id <> granted_by), CHECK (expires_at <= created_at + interval '366 days'))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS fil_grants_live ON fil_grants (file_id, grantee_id) WHERE revoked_at IS NULL`,
  `CREATE TABLE IF NOT EXISTS fil_access_log (id bigserial PRIMARY KEY, tenant_id text NOT NULL, file_id uuid, actor_id text NOT NULL,
     action text NOT NULL CHECK (action IN ('upload','download','denied','grant','revoke','delete','attach','detach')), detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION fil_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fil_access_log_append_only') THEN
       CREATE TRIGGER fil_access_log_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON fil_access_log FOR EACH STATEMENT EXECUTE FUNCTION fil_refuse_change();
     END IF;
   END $$`,
  // fil-002: files attached to a submission or an achievement. Attaching is the owner's act; once the work is
  // submitted (or the evidence verified) the attachment is locked and the file can no longer be detached or deleted.
  `CREATE TABLE IF NOT EXISTS fil_attachments (tenant_id text NOT NULL, file_id uuid NOT NULL REFERENCES fil_files(id),
     kind text NOT NULL CHECK (kind IN ('submission','achievement')), ref_id text NOT NULL, attached_by text NOT NULL,
     locked boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (kind, ref_id, file_id))`,
  `DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fil_access_log_action_check' AND pg_get_constraintdef(oid) NOT LIKE '%attach%') THEN
       ALTER TABLE fil_access_log DROP CONSTRAINT fil_access_log_action_check;
       ALTER TABLE fil_access_log ADD CONSTRAINT fil_access_log_action_check CHECK (action IN ('upload','download','denied','grant','revoke','delete','attach','detach'));
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION fil_attach(p_tenant text, p_owner text, p_file uuid, p_kind text, p_ref text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM fil_files WHERE id = p_file AND tenant_id = p_tenant AND owner_id = p_owner AND deleted_at IS NULL) THEN RETURN 'Attach one of your own files.'; END IF;
     IF EXISTS (SELECT 1 FROM fil_attachments WHERE kind = p_kind AND ref_id = p_ref AND locked) THEN RETURN 'This work was already submitted.'; END IF;
     IF (SELECT count(*) FROM fil_attachments WHERE kind = p_kind AND ref_id = p_ref) >= 5 THEN RETURN 'Attach up to 5 files.'; END IF;
     INSERT INTO fil_attachments (tenant_id, file_id, kind, ref_id, attached_by) VALUES (p_tenant, p_file, p_kind, p_ref, p_owner) ON CONFLICT DO NOTHING;
     INSERT INTO fil_access_log (tenant_id, file_id, actor_id, action, detail) VALUES (p_tenant, p_file, p_owner, 'attach', p_kind || ':' || p_ref);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION fil_detach(p_tenant text, p_owner text, p_file uuid, p_kind text, p_ref text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     DELETE FROM fil_attachments WHERE tenant_id = p_tenant AND file_id = p_file AND kind = p_kind AND ref_id = p_ref AND attached_by = p_owner AND NOT locked;
     IF NOT FOUND THEN RETURN 'That file cannot be removed from this work.'; END IF;
     INSERT INTO fil_access_log (tenant_id, file_id, actor_id, action, detail) VALUES (p_tenant, p_file, p_owner, 'detach', p_kind || ':' || p_ref);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION fil_lock(p_tenant text, p_kind text, p_ref text) RETURNS void LANGUAGE sql AS $$
     UPDATE fil_attachments SET locked = true WHERE tenant_id = p_tenant AND kind = p_kind AND ref_id = p_ref AND NOT locked $$`,
  // Reads a file through the work it is attached to. The endpoint has already decided that the caller may see that
  // work (owner, instructor of the section, verifying staff); the database guarantees the file really is attached to it.
  `CREATE OR REPLACE FUNCTION fil_read_attached(p_tenant text, p_file uuid, p_actor text, p_kind text, p_ref text) RETURNS TABLE (name text, mime text, bytes bytea) LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM fil_attachments a JOIN fil_files f ON f.id = a.file_id
                    WHERE a.tenant_id = p_tenant AND a.file_id = p_file AND a.kind = p_kind AND a.ref_id = p_ref AND f.deleted_at IS NULL
                      AND (f.scan_status = 'clean' OR f.owner_id = p_actor)) THEN
       INSERT INTO fil_access_log (tenant_id, file_id, actor_id, action, detail) VALUES (p_tenant, p_file, p_actor, 'denied', p_kind || ':' || p_ref);
       RETURN;
     END IF;
     INSERT INTO fil_access_log (tenant_id, file_id, actor_id, action, detail) VALUES (p_tenant, p_file, p_actor, 'download', p_kind || ':' || p_ref);
     RETURN QUERY SELECT f.name, f.mime, b.bytes FROM fil_files f JOIN fil_blobs b ON b.file_id = f.id WHERE f.id = p_file;
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
     IF NOT fil_can_read(p_tenant, p_file, p_actor)
        OR NOT EXISTS (SELECT 1 FROM fil_files f WHERE f.id = p_file AND (f.scan_status = 'clean' OR f.owner_id = p_actor)) THEN
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
     IF EXISTS (SELECT 1 FROM fil_attachments WHERE file_id = p_file AND locked) THEN RETURN 'This file is part of submitted work or verified evidence and is kept as submitted.'; END IF;
     UPDATE fil_files SET deleted_at = now() WHERE id = p_file AND tenant_id = p_tenant AND owner_id = p_owner AND deleted_at IS NULL;
     IF NOT FOUND THEN RETURN 'Only the owner can delete this file.'; END IF;
     DELETE FROM fil_blobs WHERE file_id = p_file;
     UPDATE fil_grants SET revoked_at = now() WHERE file_id = p_file AND revoked_at IS NULL;
     INSERT INTO fil_access_log (tenant_id, file_id, actor_id, action) VALUES (p_tenant, p_file, p_owner, 'delete');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION fil_record_scan(p_tenant text, p_file uuid, p_status text, p_reason text, p_engine text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE f fil_files%ROWTYPE;
   BEGIN
     IF p_status NOT IN ('clean','blocked') THEN RETURN 'Unknown scan result.'; END IF;
     SELECT * INTO f FROM fil_files WHERE id = p_file AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'File not found.'; END IF;
     IF f.scan_status = 'blocked' AND p_status = 'clean' AND f.scan_engine = p_engine THEN RETURN 'This file was blocked by this screen; it cannot be cleared by it.'; END IF;
     UPDATE fil_files SET scan_status = p_status, scan_reason = coalesce(p_reason, ''), scan_engine = p_engine, scanned_at = now() WHERE id = p_file;
     INSERT INTO fil_scans (tenant_id, file_id, status, reason, engine) VALUES (p_tenant, p_file, p_status, coalesce(p_reason, ''), p_engine);
     RETURN 'ok';
   END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fil_scans_append_only') THEN
     CREATE TRIGGER fil_scans_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON fil_scans FOR EACH STATEMENT EXECUTE FUNCTION fil_refuse_change(); END IF; END $$`,
];
