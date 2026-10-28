// Practice paper attempts: private to the student, append-only, readable only by them. p_can_read is computed by the
// server from guide ownership or enrolment in the guide's section, never taken from the client.
export const PPR_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS ppr_attempts (id bigserial PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL, guide_id bigint NOT NULL,
     seed int NOT NULL, minutes int NOT NULL CHECK (minutes BETWEEN 1 AND 300), used_seconds int NOT NULL CHECK (used_seconds >= 0),
     objective int NOT NULL CHECK (objective >= 0), objective_max int NOT NULL CHECK (objective >= 0 AND objective <= objective_max),
     written int CHECK (written IS NULL OR written >= 0), written_max int NOT NULL CHECK (written_max >= 0 AND (written IS NULL OR written <= written_max)),
     timed_out boolean NOT NULL DEFAULT false, at timestamptz NOT NULL DEFAULT now(),
     CHECK (used_seconds <= minutes * 60 + 60))`,
  `CREATE INDEX IF NOT EXISTS ppr_attempts_student ON ppr_attempts (tenant_id, student_id, guide_id, at DESC)`,
  `CREATE OR REPLACE FUNCTION ppr_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Practice attempts are kept as recorded.'; END $$`,
  `DROP TRIGGER IF EXISTS ppr_attempts_append_only ON ppr_attempts`,
  `CREATE TRIGGER ppr_attempts_append_only BEFORE UPDATE ON ppr_attempts FOR EACH ROW EXECUTE FUNCTION ppr_refuse_change()`,
  `CREATE OR REPLACE FUNCTION ppr_record(p_student text, p_tenant text, p_guide bigint, p_can_read boolean, p_seed int, p_minutes int, p_used int,
     p_objective int, p_objective_max int, p_written int, p_written_max int, p_timed_out boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE nid bigint;
   BEGIN
     IF NOT coalesce(p_can_read, false) THEN RETURN 'Guide not found.'; END IF;
     IF p_minutes IS NULL OR p_minutes < 1 OR p_minutes > 300 THEN RETURN 'A paper runs between 1 and 300 minutes.'; END IF;
     IF p_used IS NULL OR p_used < 0 OR p_used > p_minutes * 60 + 60 THEN RETURN 'That time is not possible for this paper.'; END IF;
     IF p_objective < 0 OR p_objective > p_objective_max OR (p_written IS NOT NULL AND (p_written < 0 OR p_written > p_written_max)) THEN RETURN 'That score is not possible.'; END IF;
     INSERT INTO ppr_attempts (tenant_id, student_id, guide_id, seed, minutes, used_seconds, objective, objective_max, written, written_max, timed_out)
       VALUES (p_tenant, p_student, p_guide, p_seed, p_minutes, p_used, p_objective, p_objective_max, p_written, p_written_max, coalesce(p_timed_out, false)) RETURNING id INTO nid;
     RETURN 'ok:' || nid;
   END $$`,
];
