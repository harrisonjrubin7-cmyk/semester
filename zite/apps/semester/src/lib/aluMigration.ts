// Migration alu-001: alumni network (role app "Alumni": networking, opportunities, mentors).
// - Directory: an alumnus is listed only after opting in, chooses who sees the profile (alumni only, or alumni and students)
//   and whether they accept connection requests or mentoring. No contact details are stored or shown.
// - Connections: a request to a listed, open profile; at most 20 pending at once; the recipient accepts, declines or blocks.
//   A block hides both people from each other and stops new requests. Only accepted connections see each other as connected.
// - Opportunities: alumni post jobs, internships, projects, volunteering or events with an https link and an expiry within 90
//   days. Career center staff other than the poster approve before anyone sees them. Interest is recorded; the poster sees a
//   count and only the names of people who chose to share theirs.
// - Mentoring: the directory shows which mentors take students; booking their slots stays in help.ts, whose apt-001 claim
//   table already guarantees one booking per slot (a second claim table here would let two paths double-book).
// Roles: alumni and students come from the server-resolved membership and are passed as booleans; career center staff is
// car_has(..., 'center') from car-001. Nothing here reads a student record. History is append-only.
export const ALU_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS alu_profiles (tenant_id text NOT NULL, user_id text NOT NULL, headline text NOT NULL CHECK (length(trim(headline)) BETWEEN 3 AND 120),
     field text NOT NULL DEFAULT '' CHECK (length(field) <= 80), grad_year int CHECK (grad_year BETWEEN 1950 AND 2100),
     listed boolean NOT NULL DEFAULT false, audience text NOT NULL DEFAULT 'alumni' CHECK (audience IN ('alumni', 'alumni_and_students')),
     open_to_connect boolean NOT NULL DEFAULT true, open_to_mentor boolean NOT NULL DEFAULT false, version int NOT NULL DEFAULT 1,
     updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, user_id))`,
  `CREATE TABLE IF NOT EXISTS alu_connections (id bigserial PRIMARY KEY, tenant_id text NOT NULL, from_id text NOT NULL, to_id text NOT NULL,
     note text NOT NULL DEFAULT '' CHECK (length(note) <= 300), state text NOT NULL DEFAULT 'requested' CHECK (state IN ('requested', 'accepted', 'declined', 'withdrawn', 'blocked')),
     created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz, CHECK (from_id <> to_id))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS alu_connections_open ON alu_connections (tenant_id, least(from_id, to_id), greatest(from_id, to_id)) WHERE state IN ('requested', 'accepted')`,
  `CREATE TABLE IF NOT EXISTS alu_blocks (tenant_id text NOT NULL, blocker_id text NOT NULL, blocked_id text NOT NULL, at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (tenant_id, blocker_id, blocked_id), CHECK (blocker_id <> blocked_id))`,
  `CREATE TABLE IF NOT EXISTS alu_opportunities (id bigserial PRIMARY KEY, tenant_id text NOT NULL, poster_id text NOT NULL,
     kind text NOT NULL CHECK (kind IN ('job', 'internship', 'project', 'volunteer', 'event')), title text NOT NULL CHECK (length(trim(title)) BETWEEN 4 AND 140),
     org text NOT NULL CHECK (length(trim(org)) BETWEEN 2 AND 120), body text NOT NULL CHECK (length(trim(body)) BETWEEN 20 AND 4000),
     url text CHECK (url IS NULL OR url ~ '^https://[^[:space:]]{4,}$'), audience text NOT NULL CHECK (audience IN ('students', 'alumni', 'both')),
     state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'live', 'rejected', 'closed')), reviewed_by text, review_note text NOT NULL DEFAULT '',
     expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (reviewed_by IS NULL OR reviewed_by <> poster_id), CHECK (state <> 'live' OR reviewed_by IS NOT NULL), CHECK (expires_at <= created_at + interval '90 days'))`,
  `CREATE TABLE IF NOT EXISTS alu_interest (opportunity_id bigint NOT NULL REFERENCES alu_opportunities(id), user_id text NOT NULL, share_name boolean NOT NULL DEFAULT false,
     at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (opportunity_id, user_id))`,
  `CREATE TABLE IF NOT EXISTS alu_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, actor_id text NOT NULL, subject text NOT NULL, ref text NOT NULL,
     step text NOT NULL, note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION alu_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS alu_events_append_only ON alu_events`,
  `CREATE TRIGGER alu_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON alu_events FOR EACH STATEMENT EXECUTE FUNCTION alu_refuse_change()`,
  `CREATE OR REPLACE FUNCTION alu_log(p_tenant text, p_actor text, p_subject text, p_ref text, p_step text, p_note text) RETURNS void LANGUAGE sql AS $$
     INSERT INTO alu_events (tenant_id, actor_id, subject, ref, step, note) VALUES (p_tenant, p_actor, p_subject, p_ref, p_step, coalesce(p_note, '')) $$`,
  `CREATE OR REPLACE FUNCTION alu_blocked(p_tenant text, p_a text, p_b text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM alu_blocks WHERE tenant_id = p_tenant AND ((blocker_id = p_a AND blocked_id = p_b) OR (blocker_id = p_b AND blocked_id = p_a))) $$`,
  `CREATE OR REPLACE FUNCTION alu_visible(p_tenant text, p_viewer text, p_alumni boolean, p_student boolean, p_target text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM alu_profiles f WHERE f.tenant_id = p_tenant AND f.user_id = p_target AND f.listed
       AND (p_viewer = p_target OR p_alumni OR (p_student AND f.audience = 'alumni_and_students'))) AND (p_viewer = p_target OR NOT alu_blocked(p_tenant, p_viewer, p_target)) $$`,
  `CREATE OR REPLACE FUNCTION alu_opp_live(o alu_opportunities) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT o.state = 'live' AND o.expires_at > now() $$`,
  `CREATE OR REPLACE FUNCTION alu_profile(p_tenant text, p_actor text, p_alumni boolean, p jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE f alu_profiles%ROWTYPE; BEGIN
     IF NOT p_alumni THEN RETURN 'Only alumni have a directory profile.'; END IF;
     IF length(trim(coalesce(p->>'headline', ''))) NOT BETWEEN 3 AND 120 THEN RETURN 'Write a headline (3 to 120 characters).'; END IF;
     IF coalesce(p->>'audience', 'alumni') NOT IN ('alumni', 'alumni_and_students') THEN RETURN 'Choose who can see your profile.'; END IF;
     IF (p->>'gradYear') IS NOT NULL AND (p->>'gradYear')::int NOT BETWEEN 1950 AND 2100 THEN RETURN 'Enter a graduation year between 1950 and 2100.'; END IF;
     SELECT * INTO f FROM alu_profiles WHERE tenant_id = p_tenant AND user_id = p_actor FOR UPDATE;
     IF FOUND AND (p->>'version')::int IS DISTINCT FROM f.version THEN RETURN 'Your profile changed in another window. Reload and try again.'; END IF;
     INSERT INTO alu_profiles (tenant_id, user_id, headline, field, grad_year, listed, audience, open_to_connect, open_to_mentor)
       VALUES (p_tenant, p_actor, trim(p->>'headline'), left(trim(coalesce(p->>'field', '')), 80), (p->>'gradYear')::int, coalesce((p->>'listed')::boolean, false),
         coalesce(p->>'audience', 'alumni'), coalesce((p->>'openToConnect')::boolean, true), coalesce((p->>'openToMentor')::boolean, false))
     ON CONFLICT (tenant_id, user_id) DO UPDATE SET headline = EXCLUDED.headline, field = EXCLUDED.field, grad_year = EXCLUDED.grad_year, listed = EXCLUDED.listed,
       audience = EXCLUDED.audience, open_to_connect = EXCLUDED.open_to_connect, open_to_mentor = EXCLUDED.open_to_mentor, version = alu_profiles.version + 1, updated_at = now();
     PERFORM alu_log(p_tenant, p_actor, 'profile', p_actor, CASE WHEN coalesce((p->>'listed')::boolean, false) THEN 'listed' ELSE 'unlisted' END, coalesce(p->>'audience', 'alumni'));
     RETURN 'ok:' || p_actor;
   END $$`,
  `CREATE OR REPLACE FUNCTION alu_connect(p_tenant text, p_actor text, p_alumni boolean, p_student boolean, p_target text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint; BEGIN
     IF NOT (p_alumni OR p_student) THEN RETURN 'Only alumni and students use the alumni network.'; END IF;
     IF p_actor = p_target THEN RETURN 'You cannot connect with yourself.'; END IF;
     IF NOT alu_visible(p_tenant, p_actor, p_alumni, p_student, p_target) THEN RETURN 'That profile is not available to you.'; END IF;
     IF NOT (SELECT open_to_connect FROM alu_profiles WHERE tenant_id = p_tenant AND user_id = p_target) THEN RETURN 'This person is not accepting connection requests.'; END IF;
     IF EXISTS (SELECT 1 FROM alu_connections WHERE tenant_id = p_tenant AND state IN ('requested', 'accepted') AND least(from_id, to_id) = least(p_actor, p_target) AND greatest(from_id, to_id) = greatest(p_actor, p_target))
       THEN RETURN 'You are already connected or a request is waiting.'; END IF;
     IF (SELECT count(*) FROM alu_connections WHERE tenant_id = p_tenant AND from_id = p_actor AND state = 'requested') >= 20 THEN RETURN 'You have 20 requests waiting. Wait for replies or withdraw some first.'; END IF;
     IF length(coalesce(p_note, '')) > 300 THEN RETURN 'Keep the note under 300 characters.'; END IF;
     INSERT INTO alu_connections (tenant_id, from_id, to_id, note) VALUES (p_tenant, p_actor, p_target, trim(coalesce(p_note, ''))) RETURNING id INTO v_id;
     PERFORM alu_log(p_tenant, p_actor, 'connection', v_id::text, 'request', '');
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION alu_respond(p_tenant text, p_actor text, p_id bigint, p_step text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c alu_connections%ROWTYPE; BEGIN
     SELECT * INTO c FROM alu_connections WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Request not found.'; END IF;
     IF p_step = 'withdraw' THEN
       IF c.from_id <> p_actor THEN RETURN 'Only the person who asked can withdraw a request.'; END IF;
       IF c.state <> 'requested' THEN RETURN 'This request was already answered.'; END IF;
       UPDATE alu_connections SET state = 'withdrawn', decided_at = now() WHERE id = c.id;
     ELSIF p_step IN ('accept', 'decline', 'block') THEN
       IF c.to_id <> p_actor THEN RETURN 'Only the person asked can answer.'; END IF;
       IF c.state <> 'requested' AND NOT (p_step = 'block' AND c.state = 'accepted') THEN RETURN 'This request was already answered.'; END IF;
       UPDATE alu_connections SET state = CASE p_step WHEN 'accept' THEN 'accepted' WHEN 'decline' THEN 'declined' ELSE 'blocked' END, decided_at = now() WHERE id = c.id;
       IF p_step = 'block' THEN INSERT INTO alu_blocks (tenant_id, blocker_id, blocked_id) VALUES (p_tenant, p_actor, c.from_id) ON CONFLICT DO NOTHING; END IF;
     ELSE RETURN 'Unknown step.'; END IF;
     PERFORM alu_log(p_tenant, p_actor, 'connection', c.id::text, p_step, '');
     RETURN 'ok:' || c.id;
   END $$`,
  `CREATE OR REPLACE FUNCTION alu_post(p_tenant text, p_actor text, p_alumni boolean, p jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v_id bigint; v_exp timestamptz; BEGIN
     IF NOT p_alumni THEN RETURN 'Only alumni post opportunities here.'; END IF;
     IF coalesce(p->>'kind', '') NOT IN ('job', 'internship', 'project', 'volunteer', 'event') THEN RETURN 'Choose what kind of opportunity this is.'; END IF;
     IF length(trim(coalesce(p->>'title', ''))) NOT BETWEEN 4 AND 140 THEN RETURN 'Give it a title (4 to 140 characters).'; END IF;
     IF length(trim(coalesce(p->>'org', ''))) NOT BETWEEN 2 AND 120 THEN RETURN 'Name the organization.'; END IF;
     IF length(trim(coalesce(p->>'body', ''))) NOT BETWEEN 20 AND 4000 THEN RETURN 'Describe it (20 to 4000 characters).'; END IF;
     IF nullif(trim(coalesce(p->>'url', '')), '') IS NOT NULL AND trim(p->>'url') !~ '^https://[^[:space:]]{4,}$' THEN RETURN 'Links must start with https://.'; END IF;
     IF coalesce(p->>'audience', '') NOT IN ('students', 'alumni', 'both') THEN RETURN 'Choose who can see it.'; END IF;
     v_exp := (p->>'expiresAt')::timestamptz;
     IF v_exp IS NULL OR v_exp <= now() OR v_exp > now() + interval '90 days' THEN RETURN 'Choose an end date within the next 90 days.'; END IF;
     INSERT INTO alu_opportunities (tenant_id, poster_id, kind, title, org, body, url, audience, expires_at)
       VALUES (p_tenant, p_actor, p->>'kind', trim(p->>'title'), trim(p->>'org'), trim(p->>'body'), nullif(trim(coalesce(p->>'url', '')), ''), p->>'audience', v_exp) RETURNING id INTO v_id;
     PERFORM alu_log(p_tenant, p_actor, 'opportunity', v_id::text, 'post', trim(p->>'title'));
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION alu_review(p_tenant text, p_actor text, p_id bigint, p_step text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE o alu_opportunities%ROWTYPE; BEGIN
     SELECT * INTO o FROM alu_opportunities WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Opportunity not found.'; END IF;
     IF p_step = 'close' THEN
       IF NOT (o.poster_id = p_actor OR car_has(p_tenant, p_actor, 'center')) THEN RETURN 'Only the poster or career center staff close an opportunity.'; END IF;
       IF o.state IN ('closed', 'rejected') THEN RETURN 'Already closed.'; END IF;
       UPDATE alu_opportunities SET state = 'closed' WHERE id = o.id;
     ELSIF p_step IN ('approve', 'reject') THEN
       IF NOT car_has(p_tenant, p_actor, 'center') THEN RETURN 'Reviewing opportunities needs the career center staff role.'; END IF;
       IF o.poster_id = p_actor THEN RETURN 'You posted this, so someone else must review it.'; END IF;
       IF o.state <> 'pending' THEN RETURN 'This opportunity is not waiting for review.'; END IF;
       IF p_step = 'reject' AND length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say why it is rejected.'; END IF;
       UPDATE alu_opportunities SET state = CASE WHEN p_step = 'approve' THEN 'live' ELSE 'rejected' END, reviewed_by = p_actor, review_note = trim(coalesce(p_note, '')) WHERE id = o.id;
     ELSE RETURN 'Unknown step.'; END IF;
     PERFORM alu_log(p_tenant, p_actor, 'opportunity', o.id::text, p_step, coalesce(p_note, ''));
     RETURN 'ok:' || o.id;
   END $$`,
  `CREATE OR REPLACE FUNCTION alu_interest_set(p_tenant text, p_actor text, p_alumni boolean, p_student boolean, p_id bigint, p_on boolean, p_share boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE o alu_opportunities%ROWTYPE; BEGIN
     SELECT * INTO o FROM alu_opportunities WHERE id = p_id AND tenant_id = p_tenant;
     IF NOT FOUND OR NOT alu_opp_live(o) THEN RETURN 'This opportunity is not open.'; END IF;
     IF NOT ((p_student AND o.audience IN ('students', 'both')) OR (p_alumni AND o.audience IN ('alumni', 'both'))) THEN RETURN 'This opportunity is not open to you.'; END IF;
     IF o.poster_id = p_actor THEN RETURN 'You posted this one.'; END IF;
     IF alu_blocked(p_tenant, p_actor, o.poster_id) THEN RETURN 'This opportunity is not open to you.'; END IF;
     IF p_on THEN
       INSERT INTO alu_interest (opportunity_id, user_id, share_name) VALUES (o.id, p_actor, coalesce(p_share, false))
         ON CONFLICT (opportunity_id, user_id) DO UPDATE SET share_name = EXCLUDED.share_name;
     ELSE DELETE FROM alu_interest WHERE opportunity_id = o.id AND user_id = p_actor; END IF;
     PERFORM alu_log(p_tenant, p_actor, 'opportunity', o.id::text, CASE WHEN p_on THEN 'interest' ELSE 'uninterest' END, '');
     RETURN 'ok:' || o.id;
   END $$`,
];
