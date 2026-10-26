// Migration gtr-001: private grade-tracker and GPA-scenario plans (S-72). Planning data only: no column here is, or feeds, an
// official grade. Enforced here: a plan belongs to one student in one tenant; updates and deletes need the owner and the
// expected version; size and kind are bounded; deletes are kept in history for undo-by-restore.
export const GTR_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS gtr_plans (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('course','gpa')),
     name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120), doc jsonb NOT NULL CHECK (pg_column_size(doc) <= 200000), version int NOT NULL DEFAULT 1,
     deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS gtr_plans_owner ON gtr_plans (tenant_id, student_id) WHERE deleted_at IS NULL`,
  `CREATE OR REPLACE FUNCTION gtr_save(p_tenant text, p_student text, p_id bigint, p_kind text, p_name text, p_doc jsonb, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE g gtr_plans; nid bigint;
   BEGIN
     IF p_id IS NULL THEN
       IF (SELECT count(*) FROM gtr_plans WHERE tenant_id = p_tenant AND student_id = p_student AND deleted_at IS NULL) >= 60 THEN RETURN 'You have 60 plans; delete one first.'; END IF;
       INSERT INTO gtr_plans (tenant_id, student_id, kind, name, doc) VALUES (p_tenant, p_student, p_kind, trim(p_name), p_doc) RETURNING id INTO nid;
       RETURN 'ok:' || nid;
     END IF;
     SELECT * INTO g FROM gtr_plans WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR g.tenant_id <> p_tenant OR g.student_id <> p_student THEN RETURN 'Plan not found.'; END IF;
     IF g.version <> p_expected THEN RETURN 'This plan changed in another window. Reload to keep both edits safe.'; END IF;
     IF g.kind <> p_kind THEN RETURN 'A plan cannot change kind.'; END IF;
     UPDATE gtr_plans SET name = trim(p_name), doc = p_doc, version = version + 1, updated_at = now(), deleted_at = NULL WHERE id = p_id;
     RETURN 'ok:' || p_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION gtr_delete(p_tenant text, p_student text, p_id bigint, p_expected int, p_restore boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE g gtr_plans;
   BEGIN
     SELECT * INTO g FROM gtr_plans WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR g.tenant_id <> p_tenant OR g.student_id <> p_student THEN RETURN 'Plan not found.'; END IF;
     IF g.version <> p_expected THEN RETURN 'This plan changed in another window. Reload first.'; END IF;
     UPDATE gtr_plans SET deleted_at = CASE WHEN p_restore THEN NULL ELSE now() END, version = version + 1, updated_at = now() WHERE id = p_id;
     RETURN NULL;
   END $$`,
];
