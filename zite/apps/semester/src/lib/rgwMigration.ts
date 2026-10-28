// Roster-import gateway, shadow mode (owner sources S-92 §1–2, S-93 §2–3, S-91 §10). One record per connection, approved by
// a second integration administrator. Every batch is tied to its connection, never to a tenant named in the payload; a
// request key plus the payload hash makes retries safe. People resolve only through an approved link or a single unambiguous
// email match inside the institution (supplied by the server); classes resolve only through an explicit link. Anything else
// is quarantined with a reason. Older updates never overwrite newer ones. Results are staged and compared with Semester's
// own enrollments; nothing here writes an enrollment — Semester is not the system of record for imported rosters yet.
export const RGW_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS rgw_connections (id bigserial PRIMARY KEY, tenant_id text NOT NULL, name text NOT NULL CHECK (length(name) BETWEEN 3 AND 120),
     standard text NOT NULL CHECK (standard IN ('OneRoster-shaped CSV')), source_system text NOT NULL CHECK (length(source_system) BETWEEN 2 AND 120),
     direction text NOT NULL DEFAULT 'inbound' CHECK (direction = 'inbound'), authority text NOT NULL DEFAULT 'source' CHECK (authority = 'source'),
     mode text NOT NULL DEFAULT 'shadow' CHECK (mode = 'shadow'), owner_id text NOT NULL, approved_by text, approved_at timestamptz,
     state text NOT NULL DEFAULT 'Draft' CHECK (state IN ('Draft','Approved','Retired')), created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (approved_by IS NULL OR approved_by <> owner_id), CHECK ((state = 'Approved') <= (approved_by IS NOT NULL)))`,
  `CREATE TABLE IF NOT EXISTS rgw_class_links (connection_id bigint NOT NULL REFERENCES rgw_connections(id), external_class text NOT NULL, section_id text NOT NULL,
     linked_by text NOT NULL, linked_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (connection_id, external_class))`,
  `CREATE TABLE IF NOT EXISTS rgw_person_links (connection_id bigint NOT NULL REFERENCES rgw_connections(id), external_user text NOT NULL, person_id text NOT NULL,
     method text NOT NULL CHECK (method IN ('email','admin')), linked_by text NOT NULL, linked_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (connection_id, external_user), UNIQUE (connection_id, person_id))`,
  `CREATE TABLE IF NOT EXISTS rgw_batches (id bigserial PRIMARY KEY, connection_id bigint NOT NULL REFERENCES rgw_connections(id), idem_key text NOT NULL,
     payload_sha text NOT NULL, received_by text NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), summary jsonb NOT NULL DEFAULT '{}'::jsonb,
     UNIQUE (connection_id, idem_key))`,
  `CREATE TABLE IF NOT EXISTS rgw_staged (connection_id bigint NOT NULL REFERENCES rgw_connections(id), external_enrollment text NOT NULL, person_id text NOT NULL,
     section_id text NOT NULL, role text NOT NULL CHECK (role IN ('student','teacher')), status text NOT NULL CHECK (status IN ('active','tobedeleted')),
     source_modified timestamptz NOT NULL, batch_id bigint NOT NULL REFERENCES rgw_batches(id), PRIMARY KEY (connection_id, external_enrollment))`,
  `CREATE TABLE IF NOT EXISTS rgw_results (id bigserial PRIMARY KEY, batch_id bigint NOT NULL REFERENCES rgw_batches(id), line int NOT NULL, external_enrollment text NOT NULL,
     outcome text NOT NULL CHECK (outcome IN ('staged','updated','unchanged','stale','duplicate','quarantined')), reason text NOT NULL DEFAULT '')`,
  `CREATE OR REPLACE FUNCTION rgw_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Import results are kept as recorded.'; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rgw_results_append_only') THEN
     CREATE TRIGGER rgw_results_append_only BEFORE UPDATE OR DELETE ON rgw_results FOR EACH ROW EXECUTE FUNCTION rgw_refuse_change(); END IF; END $$`,
  `CREATE OR REPLACE FUNCTION rgw_approve(p_actor text, p_tenant text, p_id bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c rgw_connections%ROWTYPE;
   BEGIN
     SELECT * INTO c FROM rgw_connections WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Connection not found.'; END IF;
     IF c.state <> 'Draft' THEN RETURN 'Only a draft connection can be approved.'; END IF;
     IF c.owner_id = p_actor THEN RETURN 'A different integration administrator must approve this connection.'; END IF;
     UPDATE rgw_connections SET state = 'Approved', approved_by = p_actor, approved_at = now() WHERE id = p_id;
     RETURN 'ok';
   END $$`,
  // p_rows: [{line, sourcedId, classSourcedId, userSourcedId, role, status, modified}]; p_matches: {externalUser: [personId, …]}
  // computed by the server from this institution's own members (email match). Returns 'ok:<batch id>' or a refusal.
  `CREATE OR REPLACE FUNCTION rgw_ingest(p_actor text, p_tenant text, p_conn bigint, p_key text, p_sha text, p_rows jsonb, p_matches jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c rgw_connections%ROWTYPE; prior rgw_batches%ROWTYPE; b bigint; r jsonb; pid text; sid text; cand jsonb; cur rgw_staged%ROWTYPE;
     seen text[] := '{}'; new_link boolean; ext text; outc text; why text; m timestamptz; n jsonb := '{"staged":0,"updated":0,"unchanged":0,"stale":0,"duplicate":0,"quarantined":0}'::jsonb;
   BEGIN
     IF length(coalesce(p_key,'')) < 8 THEN RETURN 'Missing request key.'; END IF;
     SELECT * INTO c FROM rgw_connections WHERE id = p_conn AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Connection not found.'; END IF;
     IF c.state <> 'Approved' THEN RETURN 'This connection is not approved for imports.'; END IF;
     SELECT * INTO prior FROM rgw_batches WHERE connection_id = p_conn AND idem_key = p_key;
     IF FOUND THEN
       IF prior.payload_sha = p_sha THEN RETURN 'ok:' || prior.id || ':replay'; END IF;
       RETURN 'This request key was already used for a different file.';
     END IF;
     IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN RETURN 'The file has no enrollments.'; END IF;
     INSERT INTO rgw_batches (connection_id, idem_key, payload_sha, received_by) VALUES (p_conn, p_key, p_sha, p_actor) RETURNING id INTO b;
     FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
       ext := r->>'sourcedId'; outc := NULL; why := ''; pid := NULL; sid := NULL; new_link := false;
       IF ext IS NULL OR ext = '' THEN outc := 'quarantined'; why := 'no enrollment id'; ext := '(line ' || (r->>'line') || ')';
       ELSIF ext = ANY(seen) THEN outc := 'duplicate'; why := 'repeated in this file';
       END IF;
       IF outc IS NULL THEN
         seen := seen || ext;
         SELECT person_id INTO pid FROM rgw_person_links WHERE connection_id = p_conn AND external_user = r->>'userSourcedId';
         IF pid IS NULL THEN
           cand := p_matches -> (r->>'userSourcedId');
           IF cand IS NULL OR jsonb_array_length(cand) = 0 THEN outc := 'quarantined'; why := 'person not found in this institution';
           ELSIF jsonb_array_length(cand) > 1 THEN outc := 'quarantined'; why := 'more than one person matches';
           ELSIF EXISTS (SELECT 1 FROM rgw_person_links WHERE connection_id = p_conn AND person_id = cand->>0) THEN outc := 'quarantined'; why := 'that person is already linked to another source id';
           ELSE pid := cand->>0; new_link := true;  -- linked only once the whole row is valid (below)
           END IF;
         END IF;
       END IF;
       IF outc IS NULL THEN
         SELECT section_id INTO sid FROM rgw_class_links WHERE connection_id = p_conn AND external_class = r->>'classSourcedId';
         IF sid IS NULL THEN outc := 'quarantined'; why := 'class is not linked to a Semester section';
         ELSIF coalesce(r->>'role','') NOT IN ('student','teacher') THEN outc := 'quarantined'; why := 'role is not student or teacher';
         ELSIF coalesce(r->>'status','') NOT IN ('active','tobedeleted') THEN outc := 'quarantined'; why := 'unknown status';
         END IF;
       END IF;
       IF outc IS NULL THEN
         BEGIN m := (r->>'modified')::timestamptz; EXCEPTION WHEN OTHERS THEN outc := 'quarantined'; why := 'dateLastModified is not a date'; END;
       END IF;
       -- One enrollment per person and class: a second source id for the same pair is a duplicate, not a second seat.
       IF outc IS NULL AND EXISTS (SELECT 1 FROM rgw_staged WHERE connection_id = p_conn AND person_id = pid AND section_id = sid AND external_enrollment <> ext AND status = 'active') THEN
         outc := 'quarantined'; why := 'this person already has an enrollment in this class under another id';
       END IF;
       IF outc IS NULL AND new_link THEN
         INSERT INTO rgw_person_links (connection_id, external_user, person_id, method, linked_by) VALUES (p_conn, r->>'userSourcedId', pid, 'email', p_actor);
       END IF;
       IF outc IS NULL THEN
         SELECT * INTO cur FROM rgw_staged WHERE connection_id = p_conn AND external_enrollment = ext FOR UPDATE;
         IF NOT FOUND THEN
           INSERT INTO rgw_staged VALUES (p_conn, ext, pid, sid, r->>'role', r->>'status', m, b); outc := 'staged';
         ELSIF m < cur.source_modified THEN outc := 'stale'; why := 'older than what is already staged';
         ELSIF cur.person_id = pid AND cur.section_id = sid AND cur.role = r->>'role' AND cur.status = r->>'status' THEN outc := 'unchanged';
         ELSE
           UPDATE rgw_staged SET person_id = pid, section_id = sid, role = r->>'role', status = r->>'status', source_modified = m, batch_id = b
             WHERE connection_id = p_conn AND external_enrollment = ext;
           outc := 'updated';
         END IF;
       END IF;
       INSERT INTO rgw_results (batch_id, line, external_enrollment, outcome, reason) VALUES (b, coalesce((r->>'line')::int, 0), ext, outc, why);
       n := jsonb_set(n, ARRAY[outc], to_jsonb((n->>outc)::int + 1));
     END LOOP;
     UPDATE rgw_batches SET summary = n WHERE id = b;
     RETURN 'ok:' || b;
   END $$`,
];
