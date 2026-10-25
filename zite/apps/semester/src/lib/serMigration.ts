// Migration ser-001 (REG-023): per-student serialization of registrar commits.
// Every seat change for a student bumps that student's version under a row lock (trigger, same transaction as the change).
// A commit reads the version before its credit/clash/prereq checks and passes it in; reg_decide_serial locks the student
// row, refuses if anything changed since, then runs reg_decide. Lock order: student row, then section row.
export const SER_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS reg_student_versions (tenant_id text NOT NULL, student_id text NOT NULL, version bigint NOT NULL DEFAULT 0, PRIMARY KEY (tenant_id, student_id))`,
  `CREATE OR REPLACE FUNCTION reg_bump_student() RETURNS trigger LANGUAGE plpgsql AS $$
   DECLARE r reg_seats%ROWTYPE;
   BEGIN
     r := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
     INSERT INTO reg_student_versions (tenant_id, student_id, version) VALUES (r.tenant_id, r.student_id, 1)
       ON CONFLICT (tenant_id, student_id) DO UPDATE SET version = reg_student_versions.version + 1;
     RETURN NULL;
   END $$`,
  `DROP TRIGGER IF EXISTS reg_seats_bump_student ON reg_seats`,
  `CREATE TRIGGER reg_seats_bump_student AFTER INSERT OR UPDATE OR DELETE ON reg_seats FOR EACH ROW EXECUTE FUNCTION reg_bump_student()`,
  `CREATE OR REPLACE FUNCTION reg_student_version(p_tenant text, p_student text) RETURNS bigint LANGUAGE sql AS $$
     SELECT coalesce((SELECT version FROM reg_student_versions WHERE tenant_id = p_tenant AND student_id = p_student), 0) $$`,
  `CREATE OR REPLACE FUNCTION reg_decide_serial(p_expected bigint,
     p_tenant text, p_key text, p_hash text, p_actor text, p_decision text, p_section text, p_student text, p_request text, p_capacity int, p_note text)
   RETURNS jsonb LANGUAGE plpgsql AS $$
   DECLARE v bigint;
   BEGIN
     INSERT INTO reg_student_versions (tenant_id, student_id) VALUES (p_tenant, p_student) ON CONFLICT DO NOTHING;
     SELECT version INTO v FROM reg_student_versions WHERE tenant_id = p_tenant AND student_id = p_student FOR UPDATE;
     IF p_decision = 'commit' AND v <> p_expected
        AND NOT EXISTS (SELECT 1 FROM reg_commands WHERE tenant_id = p_tenant AND command_key = p_key) THEN
       RETURN jsonb_build_object('studentChanged', true);
     END IF;
     RETURN reg_decide(p_tenant, p_key, p_hash, p_actor, p_decision, p_section, p_student, p_request, p_capacity, p_note);
   END $$`,
];
