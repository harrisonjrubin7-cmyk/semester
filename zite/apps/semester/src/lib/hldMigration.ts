// Hold releases and student responses (register C05). One release per hold, whoever asks and however often: the first claim wins, the same
// person retrying resumes it, anyone else is told it is already lifted. The release row also records whether the
// student's notice went out, so a failed notice never undoes or hides a release that happened.
export const HLD_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS hld_releases (hold_id text PRIMARY KEY, tenant_id text NOT NULL, student_id text NOT NULL,
     actor_id text NOT NULL, office text NOT NULL, reason text NOT NULL CHECK (length(trim(reason)) >= 5),
     released_at timestamptz NOT NULL DEFAULT now(), applied boolean NOT NULL DEFAULT false,
     notified boolean NOT NULL DEFAULT false, notice_error text NOT NULL DEFAULT '', CHECK (actor_id <> student_id))`,
  `CREATE TABLE IF NOT EXISTS hld_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, hold_id text NOT NULL,
     actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT now())`,
  `CREATE OR REPLACE FUNCTION hld_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'The hold log cannot be changed.'; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'hld_events_append_only') THEN
     CREATE TRIGGER hld_events_append_only BEFORE UPDATE OR DELETE ON hld_events FOR EACH ROW EXECUTE FUNCTION hld_refuse_change(); END IF; END $$`,
  // Returns 'ok:new', 'ok:resume' (same person, not finished) or 'ok:done' (same person, already finished), else a refusal.
  `CREATE OR REPLACE FUNCTION hld_claim(p_actor text, p_tenant text, p_hold text, p_student text, p_office text, p_reason text)
     RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r hld_releases%ROWTYPE; n int;
   BEGIN
     IF p_actor = p_student THEN RETURN 'This hold is on your own record, so someone else has to lift it.'; END IF;
     IF length(trim(coalesce(p_reason,''))) < 5 THEN RETURN 'Give a reason of at least 5 characters.'; END IF;
     INSERT INTO hld_releases (hold_id, tenant_id, student_id, actor_id, office, reason)
       VALUES (p_hold, p_tenant, p_student, p_actor, p_office, p_reason) ON CONFLICT (hold_id) DO NOTHING;
     GET DIAGNOSTICS n = ROW_COUNT;
     IF n = 1 THEN
       INSERT INTO hld_events (tenant_id, hold_id, actor_id, action, detail) VALUES (p_tenant, p_hold, p_actor, 'release claimed', p_office);
       RETURN 'ok:new';
     END IF;
     SELECT * INTO r FROM hld_releases WHERE hold_id = p_hold;
     IF r.tenant_id <> p_tenant THEN RETURN 'Hold not found.'; END IF;
     IF r.actor_id <> p_actor THEN RETURN 'This hold has already been lifted.'; END IF;
     RETURN CASE WHEN r.applied THEN 'ok:done' ELSE 'ok:resume' END;
   END $$`,
  `CREATE OR REPLACE FUNCTION hld_applied(p_tenant text, p_hold text, p_actor text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     UPDATE hld_releases SET applied = true WHERE hold_id = p_hold AND tenant_id = p_tenant AND actor_id = p_actor AND NOT applied;
     IF FOUND THEN INSERT INTO hld_events (tenant_id, hold_id, actor_id, action) VALUES (p_tenant, p_hold, p_actor, 'release applied'); END IF;
     RETURN 'ok';
   END $$`,
  `CREATE OR REPLACE FUNCTION hld_noticed(p_tenant text, p_hold text, p_ok boolean, p_error text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     UPDATE hld_releases SET notified = p_ok, notice_error = CASE WHEN p_ok THEN '' ELSE left(coalesce(p_error,''), 300) END
       WHERE hold_id = p_hold AND tenant_id = p_tenant;
     INSERT INTO hld_events (tenant_id, hold_id, actor_id, action, detail)
       SELECT p_tenant, p_hold, actor_id, CASE WHEN p_ok THEN 'notice sent' ELSE 'notice failed' END, left(coalesce(p_error,''), 300)
       FROM hld_releases WHERE hold_id = p_hold AND tenant_id = p_tenant;
     RETURN 'ok';
   END $$`,
  `CREATE TABLE IF NOT EXISTS hld_responses (id bigserial PRIMARY KEY, tenant_id text NOT NULL, hold_id text NOT NULL,
     student_id text NOT NULL, body text NOT NULL CHECK (length(trim(body)) BETWEEN 10 AND 2000),
     at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS hld_responses_hold ON hld_responses (tenant_id, hold_id, at)`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'hld_responses_append_only') THEN
     CREATE TRIGGER hld_responses_append_only BEFORE UPDATE OR DELETE ON hld_responses FOR EACH ROW EXECUTE FUNCTION hld_refuse_change(); END IF; END $$`,
  // The student's side of the journey (place -> respond -> authorized release). Ownership (this student, this
  // institution) is checked by the endpoint against the Student Holds record; the status it read is passed in.
  `CREATE OR REPLACE FUNCTION hld_respond(p_tenant text, p_hold text, p_student text, p_status text, p_body text)
     RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF p_status <> 'Active' THEN RETURN 'This hold is no longer active.'; END IF;
     IF length(trim(coalesce(p_body,''))) < 10 THEN RETURN 'Say a little more (at least 10 characters) so the office can act on it.'; END IF;
     IF length(p_body) > 2000 THEN RETURN 'Keep your response under 2,000 characters.'; END IF;
     INSERT INTO hld_responses (tenant_id, hold_id, student_id, body) VALUES (p_tenant, p_hold, p_student, trim(p_body));
     INSERT INTO hld_events (tenant_id, hold_id, actor_id, action) VALUES (p_tenant, p_hold, p_student, 'student responded');
     RETURN 'ok';
   END $$`,
];
