import { neon } from '@neondatabase/serverless';

// Hiring backend (controlled Postgres). Every command is one function call = one transaction: checks, state change,
// version bump, append-only audit row and outbox row together. The Zite "Opportunities" table becomes a read model
// that the outbox keeps in sync (students' Career page reads it); decisions are only ever made here.
export const pg = () => neon(process.env.ZITE_POSTGRES_URL as string);

export const HIRING_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS emp_postings (id text PRIMARY KEY, zite_id text UNIQUE, owner_id text NOT NULL, title text NOT NULL, kind text NOT NULL CHECK (kind IN ('Internship','Job','Research','Mentorship')),
    employer_name text NOT NULL, description text NOT NULL DEFAULT '', location text NOT NULL DEFAULT '', closes_on date, status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','deleted')),
    version int NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS emp_postings_owner ON emp_postings (owner_id)`,
  `CREATE TABLE IF NOT EXISTS emp_applications (posting_id text NOT NULL REFERENCES emp_postings(id), applicant_id text NOT NULL, stage text NOT NULL DEFAULT 'New' CHECK (stage IN ('New','Shortlisted','Declined')),
    version int NOT NULL DEFAULT 1, applied_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz, decided_by text, PRIMARY KEY (posting_id, applicant_id))`,
  `CREATE TABLE IF NOT EXISTS emp_audit (id bigserial PRIMARY KEY, actor_id text NOT NULL, action text NOT NULL, posting_id text NOT NULL, detail text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS emp_outbox (id bigserial PRIMARY KEY, kind text NOT NULL, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'pending', attempts int NOT NULL DEFAULT 0, last_error text, created_at timestamptz NOT NULL DEFAULT now(), dispatched_at timestamptz)`,
  `CREATE OR REPLACE FUNCTION emp_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'AUDIT_APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS emp_audit_append_only ON emp_audit`,
  `CREATE TRIGGER emp_audit_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON emp_audit FOR EACH STATEMENT EXECUTE FUNCTION emp_refuse_change()`,
  // Create or edit a posting. Edits need the owner and the version the editor last saw.
  `CREATE OR REPLACE FUNCTION emp_save(p_actor text, p_id text, p_title text, p_kind text, p_employer text, p_desc text, p_loc text, p_closes date, p_version int) RETURNS text LANGUAGE plpgsql AS $$
DECLARE p emp_postings%ROWTYPE;
BEGIN
  IF length(trim(p_title)) < 3 THEN RETURN 'Give the opportunity a title.'; END IF;
  SELECT * INTO p FROM emp_postings WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO emp_postings (id, owner_id, title, kind, employer_name, description, location, closes_on) VALUES (p_id, p_actor, trim(p_title), p_kind, trim(p_employer), p_desc, p_loc, p_closes);
    INSERT INTO emp_audit (actor_id, action, posting_id, detail) VALUES (p_actor, 'posting.create', p_id, trim(p_title));
  ELSE
    IF p.owner_id <> p_actor THEN RETURN 'You can only manage opportunities you posted.'; END IF;
    IF p.status = 'deleted' THEN RETURN 'This opportunity was deleted.'; END IF;
    IF p.version <> p_version THEN RETURN 'This opportunity changed since you opened it. Reload and try again.'; END IF;
    UPDATE emp_postings SET title = trim(p_title), kind = p_kind, employer_name = trim(p_employer), description = p_desc, location = p_loc, closes_on = p_closes, version = version + 1, updated_at = now() WHERE id = p_id;
    INSERT INTO emp_audit (actor_id, action, posting_id, detail) VALUES (p_actor, 'posting.edit', p_id, trim(p_title));
  END IF;
  INSERT INTO emp_outbox (kind, payload) VALUES ('posting.sync', jsonb_build_object('postingId', p_id));
  RETURN NULL;
END $$`,
  `CREATE OR REPLACE FUNCTION emp_delete(p_actor text, p_id text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
DECLARE p emp_postings%ROWTYPE;
BEGIN
  SELECT * INTO p FROM emp_postings WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR p.owner_id <> p_actor THEN RETURN 'You can only manage opportunities you posted.'; END IF;
  IF p.status = 'deleted' THEN RETURN 'Already deleted.'; END IF;
  IF p.version <> p_version THEN RETURN 'This opportunity changed since you opened it. Reload and try again.'; END IF;
  UPDATE emp_postings SET status = 'deleted', version = version + 1, updated_at = now() WHERE id = p_id;
  INSERT INTO emp_audit (actor_id, action, posting_id, detail) VALUES (p_actor, 'posting.delete', p_id, p.title);
  INSERT INTO emp_outbox (kind, payload) VALUES ('posting.sync', jsonb_build_object('postingId', p_id));
  RETURN NULL;
END $$`,
  // A student applies. Idempotent; refused when deleted, closed, or their own posting.
  `CREATE OR REPLACE FUNCTION emp_apply(p_actor text, p_id text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE p emp_postings%ROWTYPE;
BEGIN
  SELECT * INTO p FROM emp_postings WHERE id = p_id OR zite_id = p_id FOR UPDATE;
  IF NOT FOUND OR p.status <> 'open' THEN RETURN 'This opportunity is no longer open.'; END IF;
  IF p.closes_on IS NOT NULL AND p.closes_on < current_date THEN RETURN 'Applications for this opportunity have closed.'; END IF;
  IF p.owner_id = p_actor THEN RETURN 'You can’t apply to an opportunity you posted.'; END IF;
  INSERT INTO emp_applications (posting_id, applicant_id) VALUES (p.id, p_actor) ON CONFLICT DO NOTHING;
  IF FOUND THEN
    INSERT INTO emp_audit (actor_id, action, posting_id) VALUES (p_actor, 'application.create', p.id);
    INSERT INTO emp_outbox (kind, payload) VALUES ('posting.sync', jsonb_build_object('postingId', p.id));
  END IF;
  RETURN NULL;
END $$`,
  // Owner decides on one application, bound to the application version they saw. Notification goes out via the outbox.
  `CREATE OR REPLACE FUNCTION emp_decide(p_actor text, p_id text, p_applicant text, p_decision text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
DECLARE p emp_postings%ROWTYPE; a emp_applications%ROWTYPE; v_stage text;
BEGIN
  SELECT * INTO p FROM emp_postings WHERE id = p_id;
  IF NOT FOUND OR p.owner_id <> p_actor THEN RETURN 'You can only manage opportunities you posted.'; END IF;
  SELECT * INTO a FROM emp_applications WHERE posting_id = p_id AND applicant_id = p_applicant FOR UPDATE;
  IF NOT FOUND THEN RETURN 'That person hasn’t applied to this opportunity.'; END IF;
  IF a.version <> p_version THEN RETURN 'This application changed since you opened it. Reload and try again.'; END IF;
  v_stage := CASE p_decision WHEN 'Reset' THEN 'New' ELSE p_decision END;
  IF v_stage NOT IN ('New','Shortlisted','Declined') THEN RETURN 'Unknown decision.'; END IF;
  IF a.stage = v_stage THEN RETURN NULL; END IF;
  UPDATE emp_applications SET stage = v_stage, version = version + 1, decided_at = now(), decided_by = p_actor WHERE posting_id = p_id AND applicant_id = p_applicant;
  INSERT INTO emp_audit (actor_id, action, posting_id, detail) VALUES (p_actor, 'application.' || lower(p_decision), p_id, p_applicant);
  INSERT INTO emp_outbox (kind, payload) VALUES ('posting.sync', jsonb_build_object('postingId', p_id));
  IF v_stage <> 'New' THEN
    INSERT INTO emp_outbox (kind, payload) VALUES ('notify', jsonb_build_object('to', p_applicant, 'from', p_actor, 'body',
      CASE v_stage WHEN 'Shortlisted' THEN p.employer_name || ' shortlisted you for “' || p.title || '”. Expect them to contact you by email.'
      ELSE p.employer_name || ' isn’t moving forward with your application for “' || p.title || '”.' END));
  END IF;
  RETURN NULL;
END $$`,
];
