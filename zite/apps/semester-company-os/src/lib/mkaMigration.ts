// Migration mka-001: marketing consent, attribution, experiments and approved exports (role apps "Marketing Analyst": funnels,
// attribution, experiments, cohorts, aggregate reporting, approved exports; "Marketing Admin": consent, attribution). Builds on
// mkt-001 (mkt_campaigns) and the site's system of record site_inbound_requests (apps/semester-site/src/lib/pg.ts), which now
// carries the utm_* tags the visitor arrived with. Roles are resolved on the server (co_roles) and passed in as booleans.
// - Consent ledger: append-only events per contact, keyed by md5(lower(email)) so the ledger never stores an address. A
//   withdrawal by a marketer or privacy officer stops the contact being counted at once; consent recorded by hand needs a source.
// - Audience (mka_audience): distinct consented site contacts whose latest ledger event is not a withdrawal. Never students.
// - Experiments compare two approved campaigns on attributed leads (requests tagged utm_campaign = 'c' || campaign number after
//   the start). A winner is declared only when both arms reached the minimum and the winner has more leads; otherwise "no clear
//   difference". The analyst who set it up does not decide it.
// - Exports: an analyst requests a snapshot of an aggregate report; a marketing approver who is not the requester approves the
//   exact snapshot (hash); it can then be downloaded for 7 days. A snapshot containing an address-like string is refused (CHECK).
// Nothing here sends or spends. History is append-only.
export const MKA_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS mka_consent_events (id bigserial PRIMARY KEY, contact_key text NOT NULL CHECK (contact_key ~ '^[0-9a-f]{32}$'), kind text NOT NULL CHECK (kind IN ('given', 'withdrawn')),
     source text NOT NULL CHECK (source IN ('contact_request', 'event_signup', 'other')), note text NOT NULL DEFAULT '', recorded_by text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE INDEX IF NOT EXISTS mka_consent_events_key ON mka_consent_events (contact_key, at DESC)`,
  `CREATE TABLE IF NOT EXISTS mka_experiments (id bigserial PRIMARY KEY, name text NOT NULL CHECK (length(trim(name)) BETWEEN 4 AND 120), hypothesis text NOT NULL CHECK (length(trim(hypothesis)) >= 20),
     arm_a text NOT NULL REFERENCES mkt_campaigns(id), arm_b text NOT NULL REFERENCES mkt_campaigns(id), min_per_arm int NOT NULL CHECK (min_per_arm BETWEEN 5 AND 100000),
     state text NOT NULL DEFAULT 'running' CHECK (state IN ('running', 'decided', 'abandoned')), started_at timestamptz NOT NULL DEFAULT now(), created_by text NOT NULL,
     decided_by text, decision text CHECK (decision IN ('a', 'b', 'no_clear_difference')), leads_a int, leads_b int, decision_note text NOT NULL DEFAULT '', decided_at timestamptz,
     CHECK (arm_a <> arm_b), CHECK (decided_by IS NULL OR decided_by <> created_by),
     CHECK (decision IS NULL OR decision = 'no_clear_difference' OR (leads_a >= min_per_arm AND leads_b >= min_per_arm AND ((decision = 'a' AND leads_a > leads_b) OR (decision = 'b' AND leads_b > leads_a)))))`,
  `CREATE TABLE IF NOT EXISTS mka_exports (id bigserial PRIMARY KEY, report text NOT NULL CHECK (report IN ('funnel', 'attribution', 'cohorts')), snapshot jsonb NOT NULL, snapshot_hash text NOT NULL,
     purpose text NOT NULL CHECK (length(trim(purpose)) >= 15), state text NOT NULL DEFAULT 'requested' CHECK (state IN ('requested', 'approved', 'rejected')),
     requested_by text NOT NULL, decided_by text, decision_note text NOT NULL DEFAULT '', decided_at timestamptz, downloads int NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
     CHECK (decided_by IS NULL OR decided_by <> requested_by), CHECK (snapshot::text !~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}'))`,
  `CREATE TABLE IF NOT EXISTS mka_events (id bigserial PRIMARY KEY, actor_id text NOT NULL, area text NOT NULL, action text NOT NULL, target text NOT NULL DEFAULT '', detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION mka_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'mka_events_append_only') THEN
       CREATE TRIGGER mka_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON mka_events FOR EACH STATEMENT EXECUTE FUNCTION mka_refuse_change();
     END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'mka_consent_append_only') THEN
       CREATE TRIGGER mka_consent_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON mka_consent_events FOR EACH STATEMENT EXECUTE FUNCTION mka_refuse_change();
     END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION mka_key(p_email text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT md5(lower(trim(p_email))) $$`,
  `CREATE OR REPLACE FUNCTION mka_withdrawn(p_key text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT coalesce((SELECT kind = 'withdrawn' FROM mka_consent_events WHERE contact_key = p_key ORDER BY at DESC, id DESC LIMIT 1), false) $$`,
  `CREATE OR REPLACE FUNCTION mka_audience() RETURNS int LANGUAGE sql STABLE AS $$
     SELECT count(DISTINCT lower(trim(email)))::int FROM site_inbound_requests WHERE consent_to_contact AND NOT mka_withdrawn(mka_key(email)) $$`,
  `CREATE OR REPLACE FUNCTION mka_consent(p_actor text, p_allowed boolean, p_email text, p_kind text, p_source text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     IF NOT p_allowed THEN RETURN 'Only a marketer, marketing approver or privacy officer records consent.'; END IF;
     IF coalesce(p_email, '') !~ '^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$' THEN RETURN 'Enter the contact''s email address.'; END IF;
     IF p_kind NOT IN ('given', 'withdrawn') THEN RETURN 'Choose given or withdrawn.'; END IF;
     IF p_kind = 'given' AND length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Record where the consent came from (10+ characters).'; END IF;
     INSERT INTO mka_consent_events (contact_key, kind, source, note, recorded_by) VALUES (mka_key(p_email), p_kind, coalesce(p_source, 'other'), trim(coalesce(p_note, '')), p_actor);
     INSERT INTO mka_events (actor_id, area, action, detail) VALUES (p_actor, 'consent', p_kind, coalesce(p_source, 'other'));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION mka_leads(p_campaign text, p_since timestamptz) RETURNS int LANGUAGE sql STABLE AS $$
     SELECT count(DISTINCT lower(trim(s.email)))::int FROM site_inbound_requests s JOIN mkt_campaigns c ON c.id = p_campaign
      WHERE s.utm_campaign = 'c' || c.number AND s.created_at >= p_since $$`,
  `CREATE OR REPLACE FUNCTION mka_experiment(p_actor text, p_is_analyst boolean, p_step text, p_id bigint, p_name text, p_hypothesis text, p_a text, p_b text, p_min int, p_decision text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE e mka_experiments; v_id bigint; la int; lb int;
   BEGIN
     IF NOT p_is_analyst THEN RETURN 'Only a marketing analyst runs experiments.'; END IF;
     IF p_step = 'start' THEN
       IF p_a IS NULL OR p_b IS NULL OR p_a = p_b THEN RETURN 'Choose two different campaigns.'; END IF;
       IF (SELECT count(*) FROM mkt_campaigns WHERE id IN (p_a, p_b) AND state = 'approved') <> 2 THEN RETURN 'Both arms must be approved campaigns.'; END IF;
       IF length(trim(coalesce(p_name, ''))) < 4 OR length(trim(coalesce(p_hypothesis, ''))) < 20 THEN RETURN 'Give a name and the hypothesis (20+ characters).'; END IF;
       IF coalesce(p_min, 0) NOT BETWEEN 5 AND 100000 THEN RETURN 'Set a minimum of at least 5 leads per arm.'; END IF;
       INSERT INTO mka_experiments (name, hypothesis, arm_a, arm_b, min_per_arm, created_by) VALUES (trim(p_name), trim(p_hypothesis), p_a, p_b, p_min, p_actor) RETURNING id INTO v_id;
       INSERT INTO mka_events (actor_id, area, action, target) VALUES (p_actor, 'experiment', 'start', 'experiment:' || v_id);
       RETURN 'ok:' || v_id;
     END IF;
     SELECT * INTO e FROM mka_experiments WHERE id = p_id FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Experiment not found.'; END IF;
     IF e.state <> 'running' THEN RETURN 'This experiment is finished.'; END IF;
     IF p_step = 'abandon' THEN
       IF length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Say why (10+ characters).'; END IF;
       UPDATE mka_experiments SET state = 'abandoned', decision_note = trim(p_note), decided_at = now() WHERE id = e.id;
     ELSIF p_step = 'decide' THEN
       IF e.created_by = p_actor THEN RETURN 'You set up this experiment, so another analyst decides it.'; END IF;
       la := mka_leads(e.arm_a, e.started_at); lb := mka_leads(e.arm_b, e.started_at);
       IF p_decision IN ('a', 'b') THEN
         IF la < e.min_per_arm OR lb < e.min_per_arm THEN RETURN 'Not enough data yet: ' || la || ' and ' || lb || ' leads, ' || e.min_per_arm || ' needed in each arm.'; END IF;
         IF (p_decision = 'a' AND la <= lb) OR (p_decision = 'b' AND lb <= la) THEN RETURN 'The data does not support that winner (' || la || ' vs ' || lb || ' leads).'; END IF;
       ELSIF p_decision IS DISTINCT FROM 'no_clear_difference' THEN RETURN 'Choose A, B or no clear difference.';
       END IF;
       IF length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Record the reasoning (10+ characters).'; END IF;
       UPDATE mka_experiments SET state = 'decided', decision = p_decision, leads_a = la, leads_b = lb, decided_by = p_actor, decision_note = trim(p_note), decided_at = now() WHERE id = e.id;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO mka_events (actor_id, area, action, target, detail) VALUES (p_actor, 'experiment', p_step, 'experiment:' || e.id, coalesce(p_decision, ''));
     RETURN 'ok:' || e.id;
   END $$`,
  `CREATE OR REPLACE FUNCTION mka_export(p_actor text, p_is_analyst boolean, p_is_approver boolean, p_step text, p_id bigint, p_report text, p_snapshot jsonb, p_purpose text, p_seen text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE x mka_exports; v_id bigint;
   BEGIN
     IF p_step = 'request' THEN
       IF NOT p_is_analyst THEN RETURN 'Only a marketing analyst requests exports.'; END IF;
       IF p_report NOT IN ('funnel', 'attribution', 'cohorts') THEN RETURN 'Unknown report.'; END IF;
       IF length(trim(coalesce(p_purpose, ''))) < 15 THEN RETURN 'Say what the export is for (15+ characters).'; END IF;
       IF p_snapshot::text ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}' THEN RETURN 'Exports carry aggregates only; this one contains an address.'; END IF;
       INSERT INTO mka_exports (report, snapshot, snapshot_hash, purpose, requested_by) VALUES (p_report, p_snapshot, md5(p_snapshot::text), trim(p_purpose), p_actor) RETURNING id INTO v_id;
       INSERT INTO mka_events (actor_id, area, action, target) VALUES (p_actor, 'export', 'request', 'export:' || v_id);
       RETURN 'ok:' || v_id;
     END IF;
     SELECT * INTO x FROM mka_exports WHERE id = p_id FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Export not found.'; END IF;
     IF p_step IN ('approve', 'reject') THEN
       IF NOT p_is_approver THEN RETURN 'Only a marketing approver decides exports.'; END IF;
       IF x.requested_by = p_actor THEN RETURN 'You requested this export, so another approver decides it.'; END IF;
       IF x.state <> 'requested' THEN RETURN 'This export is already decided.'; END IF;
       IF p_seen IS DISTINCT FROM x.snapshot_hash THEN RETURN 'The snapshot changed since you opened it. Reload and check it again.'; END IF;
       IF p_step = 'reject' AND length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Say why (10+ characters).'; END IF;
       UPDATE mka_exports SET state = CASE WHEN p_step = 'approve' THEN 'approved' ELSE 'rejected' END, decided_by = p_actor, decision_note = trim(coalesce(p_note, '')), decided_at = now() WHERE id = x.id;
     ELSIF p_step = 'download' THEN
       IF x.requested_by <> p_actor THEN RETURN 'Only the person who requested an export downloads it.'; END IF;
       IF x.state <> 'approved' THEN RETURN 'This export is not approved.'; END IF;
       IF x.decided_at < now() - interval '7 days' THEN RETURN 'This export expired. Request a fresh one.'; END IF;
       UPDATE mka_exports SET downloads = downloads + 1 WHERE id = x.id;
     ELSE RETURN 'Unknown step.';
     END IF;
     INSERT INTO mka_events (actor_id, area, action, target) VALUES (p_actor, 'export', p_step, 'export:' || x.id);
     RETURN 'ok:' || x.id;
   END $$`,
];
