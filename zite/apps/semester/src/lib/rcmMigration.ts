// Application recommendations (owner source S-90 §5F). The applicant asks a named person; only the account with that
// verified email can accept (binding the request to that account) and then submit one letter, stored in the private
// file store under the recommender's ownership. The applicant sees verified status events only — never the letter.
// Admissions staff read it through admissions (assigned reviewer or administrator). Every step logged append-only.
export const RCM_STATES = ['Requested', 'Accepted', 'Declined', 'Submitted', 'Withdrawn'] as const;
export const RCM_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS rcm_requests (id bigserial PRIMARY KEY, application_id text NOT NULL, tenant_id text NOT NULL, applicant_id text NOT NULL,
     recommender_email text NOT NULL CHECK (recommender_email = lower(recommender_email) AND recommender_email LIKE '%_@_%'), recommender_name text NOT NULL,
     recommender_id text, waived boolean NOT NULL, state text NOT NULL DEFAULT 'Requested' CHECK (state IN ('Requested','Accepted','Declined','Submitted','Withdrawn')),
     letter_file uuid, requested_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz, submitted_at timestamptz,
     CHECK (recommender_id IS NULL OR recommender_id <> applicant_id), CHECK ((state = 'Submitted') = (letter_file IS NOT NULL)))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS rcm_one_open ON rcm_requests (application_id, recommender_email) WHERE state IN ('Requested','Accepted','Submitted')`,
  `CREATE TABLE IF NOT EXISTS rcm_events (id bigserial PRIMARY KEY, request_id bigint NOT NULL, actor_id text NOT NULL, action text NOT NULL, at timestamptz NOT NULL DEFAULT now())`,
  `CREATE OR REPLACE FUNCTION rcm_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'The recommendation log cannot be changed.'; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rcm_events_append_only') THEN
     CREATE TRIGGER rcm_events_append_only BEFORE UPDATE OR DELETE ON rcm_events FOR EACH ROW EXECUTE FUNCTION rcm_refuse_change(); END IF; END $$`,
  `CREATE OR REPLACE FUNCTION rcm_request(p_actor text, p_owner text, p_app text, p_tenant text, p_email text, p_name text, p_waived boolean, p_actor_email text)
     RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v bigint; e text := lower(trim(coalesce(p_email,'')));
   BEGIN
     IF p_actor <> p_owner THEN RETURN 'That application isn’t yours.'; END IF;
     IF e = lower(coalesce(p_actor_email,'')) THEN RETURN 'You cannot recommend yourself.'; END IF;
     IF length(trim(coalesce(p_name,''))) < 2 THEN RETURN 'Give the recommender’s name.'; END IF;
     IF (SELECT count(*) FROM rcm_requests WHERE application_id = p_app AND state IN ('Requested','Accepted','Submitted')) >= 5 THEN RETURN 'At most 5 recommenders per application.'; END IF;
     BEGIN
       INSERT INTO rcm_requests (application_id, tenant_id, applicant_id, recommender_email, recommender_name, waived) VALUES (p_app, p_tenant, p_actor, e, trim(p_name), p_waived) RETURNING id INTO v;
     EXCEPTION WHEN unique_violation THEN RETURN 'You already asked this person.'; WHEN check_violation THEN RETURN 'Enter a valid email address.'; END;
     INSERT INTO rcm_events (request_id, actor_id, action) VALUES (v, p_actor, 'requested');
     RETURN 'ok:' || v;
   END $$`,
  // p_actor_email is the authenticated account's email, read by the server.
  `CREATE OR REPLACE FUNCTION rcm_respond(p_actor text, p_actor_email text, p_id bigint, p_accept boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r rcm_requests%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM rcm_requests WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.recommender_email <> lower(coalesce(p_actor_email,'')) THEN RETURN 'Request not found.'; END IF;
     IF r.applicant_id = p_actor THEN RETURN 'You cannot recommend yourself.'; END IF;
     IF r.state <> 'Requested' THEN RETURN 'This request was already answered or withdrawn.'; END IF;
     UPDATE rcm_requests SET state = CASE WHEN p_accept THEN 'Accepted' ELSE 'Declined' END, recommender_id = p_actor, decided_at = now() WHERE id = p_id;
     INSERT INTO rcm_events (request_id, actor_id, action) VALUES (p_id, p_actor, CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END);
     RETURN 'ok';
   END $$`,
  `CREATE OR REPLACE FUNCTION rcm_submit(p_actor text, p_id bigint, p_file uuid, p_file_owner text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r rcm_requests%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM rcm_requests WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.recommender_id IS DISTINCT FROM p_actor THEN RETURN 'Request not found.'; END IF;
     IF r.state = 'Submitted' THEN RETURN 'This letter was already submitted.'; END IF;
     IF r.state <> 'Accepted' THEN RETURN 'Accept the request before submitting a letter.'; END IF;
     IF p_file_owner IS DISTINCT FROM p_actor THEN RETURN 'Upload the letter yourself.'; END IF;
     UPDATE rcm_requests SET state = 'Submitted', letter_file = p_file, submitted_at = now() WHERE id = p_id;
     INSERT INTO rcm_events (request_id, actor_id, action) VALUES (p_id, p_actor, 'submitted');
     RETURN 'ok';
   END $$`,
  `CREATE OR REPLACE FUNCTION rcm_withdraw(p_actor text, p_id bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r rcm_requests%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM rcm_requests WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.applicant_id <> p_actor THEN RETURN 'Request not found.'; END IF;
     IF r.state NOT IN ('Requested','Accepted') THEN RETURN 'Only an unanswered or accepted request can be withdrawn.'; END IF;
     UPDATE rcm_requests SET state = 'Withdrawn' WHERE id = p_id;
     INSERT INTO rcm_events (request_id, actor_id, action) VALUES (p_id, p_actor, 'withdrawn');
     RETURN 'ok';
   END $$`,
];
