// Toolkit documents: private to their owner, one call = one statement, expected version on every save. Nothing goes to a model.
export const TLK_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS tlk_docs (id bigserial PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL,
     kind text NOT NULL CHECK (kind IN ('case','research','data','assignment','rubric','sheet','deck')),
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
     data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object' AND octet_length(data::text) <= 200000),
     version int NOT NULL DEFAULT 1 CHECK (version >= 1), updated_at timestamptz NOT NULL DEFAULT now())`,
  // 27 Oct: spreadsheets and decks join the toolkit. Widen the kind check on tables created before then (no-op once widened).
  `DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tlk_docs_kind_check' AND pg_get_constraintdef(oid) NOT LIKE '%deck%') THEN
       ALTER TABLE tlk_docs DROP CONSTRAINT tlk_docs_kind_check;
       ALTER TABLE tlk_docs ADD CONSTRAINT tlk_docs_kind_check CHECK (kind IN ('case','research','data','assignment','rubric','sheet','deck'));
     END IF;
   END $$`,
  `CREATE INDEX IF NOT EXISTS tlk_docs_owner ON tlk_docs (tenant_id, owner_id, kind)`,
  `CREATE OR REPLACE FUNCTION tlk_save(p_owner text, p_tenant text, p_id bigint, p_kind text, p_title text, p_data jsonb, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE d tlk_docs%ROWTYPE; nid bigint;
   BEGIN
     IF p_kind NOT IN ('case','research','data','assignment','rubric','sheet','deck') THEN RETURN 'Unknown tool.'; END IF;
     IF p_title IS NULL OR length(trim(p_title)) = 0 OR length(trim(p_title)) > 120 THEN RETURN 'Give it a title of up to 120 characters.'; END IF;
     IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN RETURN 'This document is not in the right shape.'; END IF;
     IF octet_length(p_data::text) > 200000 THEN RETURN 'This document is too large to save.'; END IF;
     IF p_id IS NULL THEN
       INSERT INTO tlk_docs (tenant_id, owner_id, kind, title, data) VALUES (p_tenant, p_owner, p_kind, trim(p_title), p_data) RETURNING id INTO nid;
       RETURN 'ok:' || nid || ':1';
     END IF;
     SELECT * INTO d FROM tlk_docs WHERE id = p_id AND tenant_id = p_tenant AND owner_id = p_owner FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Document not found.'; END IF;
     IF d.kind <> p_kind THEN RETURN 'Document not found.'; END IF;
     IF d.version <> p_expected THEN RETURN 'This document changed in another window. Reload and try again.'; END IF;
     UPDATE tlk_docs SET title = trim(p_title), data = p_data, version = version + 1, updated_at = now() WHERE id = p_id;
     RETURN 'ok:' || p_id || ':' || (d.version + 1);
   END $$`,
  `CREATE OR REPLACE FUNCTION tlk_delete(p_owner text, p_tenant text, p_id bigint) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     DELETE FROM tlk_docs WHERE id = p_id AND tenant_id = p_tenant AND owner_id = p_owner;
     IF NOT FOUND THEN RETURN 'Document not found.'; END IF;
     RETURN NULL;
   END $$`,
];
