// Family delegation (owner sources S-89 Family, S-86 C10). A student invites an email to see chosen categories until a
// date. Nothing is visible until the account holding that email accepts; acceptance binds the invitation to that account.
// The student can revoke at any time; the family member can stop seeing it. Expiry is checked on every read. Each step is
// written to an append-only log. Every view the family member actually makes is written to fam_access_events, tied to the
// invitation that allowed it, so the student can see who looked at what, and when. p_actor_email is the signed-in
// account's email, read by the server.
export const FAM_CATEGORIES = ['Grades', 'Holds', 'Calendar', 'Billing'] as const;
export const FAM_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS fam_invites (id bigserial PRIMARY KEY, student_id text NOT NULL, recipient_email text NOT NULL
     CHECK (recipient_email = lower(recipient_email) AND recipient_email LIKE '%_@_%'), recipient_id text, categories text[] NOT NULL
     CHECK (cardinality(categories) >= 1 AND categories <@ ARRAY['Grades','Holds','Calendar','Billing']), expires_on date NOT NULL,
     state text NOT NULL DEFAULT 'Pending' CHECK (state IN ('Pending','Accepted','Declined','Revoked','Left')), consent_id text,
     invited_at timestamptz NOT NULL DEFAULT now(), answered_at timestamptz, ended_at timestamptz,
     CHECK (recipient_id IS NULL OR recipient_id <> student_id), CHECK ((state IN ('Accepted','Left')) <= (recipient_id IS NOT NULL)))`,
  `CREATE INDEX IF NOT EXISTS fam_invites_email ON fam_invites (recipient_email) WHERE state = 'Pending'`,
  `CREATE INDEX IF NOT EXISTS fam_invites_recipient ON fam_invites (recipient_id) WHERE state = 'Accepted'`,
  `CREATE TABLE IF NOT EXISTS fam_events (id bigserial PRIMARY KEY, invite_id bigint NOT NULL, actor_id text NOT NULL, action text NOT NULL, at timestamptz NOT NULL DEFAULT now())`,
  `CREATE OR REPLACE FUNCTION fam_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'The family sharing log cannot be changed.'; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fam_events_append_only') THEN
     CREATE TRIGGER fam_events_append_only BEFORE UPDATE OR DELETE ON fam_events FOR EACH ROW EXECUTE FUNCTION fam_refuse_change(); END IF; END $$`,
  `CREATE OR REPLACE FUNCTION fam_invite(p_actor text, p_actor_email text, p_email text, p_categories text[], p_expires date, p_today date, p_consent text)
     RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e text := lower(trim(coalesce(p_email,''))); v bigint;
   BEGIN
     IF e = lower(coalesce(p_actor_email,'')) THEN RETURN 'You can’t share with yourself.'; END IF;
     IF p_expires IS NULL OR p_expires <= p_today THEN RETURN 'Choose an end date in the future.'; END IF;
     IF p_expires > p_today + 366 THEN RETURN 'Sharing can last at most a year; you can share again when it ends.'; END IF;
     -- One active invitation per person: to change what they see, revoke and share again.
     PERFORM pg_advisory_xact_lock(hashtext('fam|' || p_actor || '|' || e));
     IF EXISTS (SELECT 1 FROM fam_invites WHERE student_id = p_actor AND recipient_email = e AND state IN ('Pending','Accepted') AND expires_on >= p_today) THEN
       RETURN 'You already share with this person. Revoke it first to change what they see.'; END IF;
     BEGIN
       INSERT INTO fam_invites (student_id, recipient_email, categories, expires_on, consent_id)
         VALUES (p_actor, e, (SELECT array_agg(DISTINCT c ORDER BY c) FROM unnest(p_categories) c), p_expires, p_consent) RETURNING id INTO v;
     EXCEPTION WHEN check_violation THEN RETURN 'Choose at least one thing to share, and enter a valid email.'; END;
     INSERT INTO fam_events (invite_id, actor_id, action) VALUES (v, p_actor, 'invited');
     RETURN 'ok:' || v;
   END $$`,
  `CREATE OR REPLACE FUNCTION fam_respond(p_actor text, p_actor_email text, p_id bigint, p_accept boolean, p_today date) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r fam_invites%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM fam_invites WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR r.recipient_email <> lower(coalesce(p_actor_email,'')) OR r.student_id = p_actor THEN RETURN 'Invitation not found.'; END IF;
     IF r.state <> 'Pending' THEN RETURN 'This invitation was already answered or withdrawn.'; END IF;
     IF r.expires_on < p_today THEN RETURN 'This invitation has expired. Ask the student to share again.'; END IF;
     UPDATE fam_invites SET state = CASE WHEN p_accept THEN 'Accepted' ELSE 'Declined' END, recipient_id = p_actor, answered_at = now() WHERE id = p_id;
     INSERT INTO fam_events (invite_id, actor_id, action) VALUES (p_id, p_actor, CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END);
     RETURN 'ok';
   END $$`,
  `CREATE OR REPLACE FUNCTION fam_end(p_actor text, p_id bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r fam_invites%ROWTYPE;
   BEGIN
     SELECT * INTO r FROM fam_invites WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR (p_actor <> r.student_id AND p_actor IS DISTINCT FROM r.recipient_id) THEN RETURN 'Sharing not found.'; END IF;
     IF p_actor = r.student_id THEN
       IF r.state NOT IN ('Pending','Accepted') THEN RETURN 'This sharing has already ended.'; END IF;
       UPDATE fam_invites SET state = 'Revoked', ended_at = now() WHERE id = p_id;
       INSERT INTO fam_events (invite_id, actor_id, action) VALUES (p_id, p_actor, 'revoked');
     ELSE
       IF r.state <> 'Accepted' THEN RETURN 'This sharing has already ended.'; END IF;
       UPDATE fam_invites SET state = 'Left', ended_at = now() WHERE id = p_id;
       INSERT INTO fam_events (invite_id, actor_id, action) VALUES (p_id, p_actor, 'left');
     END IF;
     RETURN 'ok';
   END $$`,
  // What a family member may see today: accepted, bound to them, not ended, not expired.
  `CREATE OR REPLACE FUNCTION fam_live(p_recipient text, p_today date) RETURNS TABLE (invite_id bigint, student_id text, categories text[], expires_on date)
     LANGUAGE sql STABLE AS $$
     SELECT id, student_id, categories, expires_on FROM fam_invites WHERE recipient_id = p_recipient AND state = 'Accepted' AND expires_on >= p_today
   $$`,
  // Delegation access events (S-75 mapping): one row per view, naming the grant (invite), the student, the viewer and
  // the categories that were visible. Append-only, like the lifecycle log.
  `CREATE TABLE IF NOT EXISTS fam_access_events (id bigserial PRIMARY KEY, invite_id bigint NOT NULL, student_id text NOT NULL,
     recipient_id text NOT NULL, categories text[] NOT NULL, at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS fam_access_invite ON fam_access_events (invite_id, at)`,
  `CREATE INDEX IF NOT EXISTS fam_access_student ON fam_access_events (student_id, at)`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fam_access_append_only') THEN
     CREATE TRIGGER fam_access_append_only BEFORE UPDATE OR DELETE ON fam_access_events FOR EACH ROW EXECUTE FUNCTION fam_refuse_change(); END IF; END $$`,
  // Logging is not access: an event is written only against an invitation that is accepted, bound to exactly this
  // student and recipient, and unexpired today. Anything else returns 'not live' and writes nothing.
  `CREATE OR REPLACE FUNCTION fam_log_access(p_invite bigint, p_student text, p_recipient text, p_categories text[])
     RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     INSERT INTO fam_access_events (invite_id, student_id, recipient_id, categories)
       SELECT p_invite, p_student, p_recipient, (SELECT array_agg(DISTINCT c ORDER BY c) FROM unnest(p_categories) c)
       FROM fam_invites WHERE id = p_invite AND student_id = p_student AND recipient_id = p_recipient
         AND state = 'Accepted' AND expires_on >= current_date;
     IF NOT FOUND THEN RETURN 'not live'; END IF;
     RETURN 'ok';
   END $$`,
];
