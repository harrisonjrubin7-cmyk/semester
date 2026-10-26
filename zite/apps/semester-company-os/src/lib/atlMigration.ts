// Migration atl-001: Atlas gap register and claims registry (mirrors lib/atlasRules.ts). Requires CO_ROLE_STATEMENTS (co_has).
// Enforced here: gaps are idempotent per request key and carry a severity and an owner; only the owner starts or resolves (with
// a note); a critical gap can never be accepted as a risk, a high one only by a privacy officer, and never by its owner; any
// non-owner can reopen. A claim needs its exact text, kind, audience, scope, evidence references and a review date within a
// year; it is approved only by a holder of the role its kind needs (privacy_officer for security, accessibility and AI;
// marketing_approver otherwise) who is not its owner; past its review date it is not publishable until re-verified; the
// publication gate refuses any cited claim that is not approved and current. Expected-version on every step; append-only.
export const ATL_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS atl_gaps (id bigserial PRIMARY KEY, request_key text NOT NULL, created_by text NOT NULL, subject text NOT NULL CHECK (length(trim(subject)) BETWEEN 3 AND 160),
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 5 AND 200), detail text NOT NULL DEFAULT '' CHECK (length(detail) <= 4000),
     severity text NOT NULL CHECK (severity IN ('critical','high','medium','low','informational')), owner_id text NOT NULL,
     state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','in_progress','resolved','risk_accepted','reopened')), version int NOT NULL DEFAULT 1,
     resolution text NOT NULL DEFAULT '', decided_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (created_by, request_key), CHECK (NOT (state = 'risk_accepted' AND (severity = 'critical' OR decided_by = owner_id))))`,
  `CREATE TABLE IF NOT EXISTS atl_claims (id bigserial PRIMARY KEY, request_key text NOT NULL, owner_id text NOT NULL, claim text NOT NULL CHECK (length(trim(claim)) BETWEEN 10 AND 1000),
     kind text NOT NULL CHECK (kind IN ('partnership','security','accessibility','feature_availability','production_usage','performance','replacement','ai_capability','customer_outcome','price')),
     audience text NOT NULL CHECK (length(trim(audience)) >= 3), scope text NOT NULL CHECK (length(trim(scope)) >= 3), evidence text NOT NULL CHECK (length(trim(evidence)) >= 20),
     review_by date NOT NULL, state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed','approved','rejected','withdrawn')), version int NOT NULL DEFAULT 1,
     approver_id text, note text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (owner_id, request_key), CHECK (approver_id IS NULL OR approver_id <> owner_id))`,
  `CREATE TABLE IF NOT EXISTS atl_events (id bigserial PRIMARY KEY, subject text NOT NULL, subject_id bigint NOT NULL, step text NOT NULL, to_state text NOT NULL, actor_id text NOT NULL,
     note text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION atl_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'atl_events_append_only') THEN
       CREATE TRIGGER atl_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON atl_events FOR EACH STATEMENT EXECUTE FUNCTION atl_refuse_change();
     END IF;
   END $$`,
  // Returns 'ok:<id>', 'replay:<id>' or a refusal.
  `CREATE OR REPLACE FUNCTION atl_gap_open(p_actor text, p_key text, p_subject text, p_title text, p_detail text, p_severity text, p_owner text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE g atl_gaps; nid bigint;
   BEGIN
     SELECT * INTO g FROM atl_gaps WHERE created_by = p_actor AND request_key = p_key;
     IF FOUND THEN IF g.subject = trim(p_subject) AND g.title = trim(p_title) THEN RETURN 'replay:' || g.id; END IF; RETURN 'This gap was already recorded with different details.'; END IF;
     IF p_severity NOT IN ('critical','high','medium','low','informational') THEN RETURN 'Choose a severity.'; END IF;
     IF length(trim(coalesce(p_owner, ''))) = 0 THEN RETURN 'Assign an owner.'; END IF;
     IF length(trim(coalesce(p_title, ''))) < 5 THEN RETURN 'Name the gap (5+ characters).'; END IF;
     INSERT INTO atl_gaps (request_key, created_by, subject, title, detail, severity, owner_id) VALUES (p_key, p_actor, trim(p_subject), trim(p_title), coalesce(p_detail, ''), p_severity, p_owner) RETURNING id INTO nid;
     INSERT INTO atl_events (subject, subject_id, step, to_state, actor_id, note) VALUES ('gap', nid, 'open', 'open', p_actor, p_severity);
     RETURN 'ok:' || nid;
   END $$`,
  `CREATE OR REPLACE FUNCTION atl_gap_step(p_id bigint, p_actor text, p_step text, p_expected int, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE g atl_gaps; owner boolean; nxt text; t text := trim(coalesce(p_note, ''));
   BEGIN
     SELECT * INTO g FROM atl_gaps WHERE id = p_id FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Gap not found.'; END IF;
     IF g.version <> p_expected THEN RETURN 'This gap changed since you opened it. Reload.'; END IF;
     owner := p_actor = g.owner_id;
     IF p_step = 'accept_risk' THEN
       IF g.severity = 'critical' THEN RETURN 'A critical gap cannot be accepted as a risk; it has to be fixed.'; END IF;
       IF owner THEN RETURN 'The owner cannot accept their own gap as a risk.'; END IF;
       IF g.severity = 'high' AND NOT co_has(p_actor, 'privacy_officer') THEN RETURN 'Only a privacy officer can accept a high-severity risk.'; END IF;
     END IF;
     nxt := CASE
       WHEN p_step = 'start' AND owner AND g.state IN ('open','reopened') THEN 'in_progress'
       WHEN p_step = 'resolve' AND owner AND g.state IN ('open','in_progress','reopened') THEN 'resolved'
       WHEN p_step = 'accept_risk' AND g.state IN ('open','in_progress','reopened') THEN 'risk_accepted'
       WHEN p_step = 'reopen' AND NOT owner AND g.state IN ('resolved','risk_accepted') THEN 'reopened'
       ELSE NULL END;
     IF nxt IS NULL THEN RETURN 'That step is not open to you now.'; END IF;
     IF p_step IN ('resolve','accept_risk','reopen') AND length(t) < 10 THEN RETURN 'Record the evidence or reason (10+ characters).'; END IF;
     UPDATE atl_gaps SET state = nxt, version = version + 1, updated_at = now(), resolution = CASE WHEN t <> '' THEN t ELSE resolution END,
       decided_by = CASE WHEN p_step IN ('accept_risk','resolve') THEN p_actor ELSE decided_by END WHERE id = g.id;
     INSERT INTO atl_events (subject, subject_id, step, to_state, actor_id, note) VALUES ('gap', g.id, p_step, nxt, p_actor, t);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION atl_claim_role(p_kind text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
     SELECT CASE WHEN p_kind IN ('security','accessibility','ai_capability') THEN 'privacy_officer' ELSE 'marketing_approver' END $$`,
  `CREATE OR REPLACE FUNCTION atl_claim_propose(p_actor text, p_key text, p_claim text, p_kind text, p_audience text, p_scope text, p_evidence text, p_review date, p_today date) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c atl_claims; nid bigint;
   BEGIN
     SELECT * INTO c FROM atl_claims WHERE owner_id = p_actor AND request_key = p_key;
     IF FOUND THEN IF c.claim = trim(p_claim) AND c.evidence = trim(p_evidence) THEN RETURN 'replay:' || c.id; END IF; RETURN 'This claim was already proposed with different details.'; END IF;
     IF length(trim(coalesce(p_evidence, ''))) < 20 THEN RETURN 'Cite the evidence: document, test run, contract or approval references (20+ characters).'; END IF;
     IF p_review <= p_today OR p_review > p_today + 366 THEN RETURN 'Set a review date within the next year.'; END IF;
     INSERT INTO atl_claims (request_key, owner_id, claim, kind, audience, scope, evidence, review_by) VALUES (p_key, p_actor, trim(p_claim), p_kind, trim(p_audience), trim(p_scope), trim(p_evidence), p_review) RETURNING id INTO nid;
     INSERT INTO atl_events (subject, subject_id, step, to_state, actor_id, note) VALUES ('claim', nid, 'propose', 'proposed', p_actor, p_kind);
     RETURN 'ok:' || nid;
   END $$`,
  // p_review: new review date for 'reverify'.
  `CREATE OR REPLACE FUNCTION atl_claim_step(p_id bigint, p_actor text, p_step text, p_expected int, p_note text, p_today date, p_review date) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c atl_claims; approver boolean; nxt text; t text := trim(coalesce(p_note, ''));
   BEGIN
     SELECT * INTO c FROM atl_claims WHERE id = p_id FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Claim not found.'; END IF;
     IF c.version <> p_expected THEN RETURN 'This claim changed since you opened it. Reload.'; END IF;
     approver := co_has(p_actor, atl_claim_role(c.kind)) AND p_actor <> c.owner_id;
     IF p_step IN ('approve','reject','reverify') AND p_actor = c.owner_id THEN RETURN 'Someone other than the owner has to decide this claim.'; END IF;
     IF p_step IN ('approve','reject','reverify') AND NOT approver THEN RETURN 'This kind of claim needs a ' || replace(atl_claim_role(c.kind), '_', ' ') || '.'; END IF;
     nxt := CASE
       WHEN p_step = 'approve' AND c.state = 'proposed' THEN 'approved'
       WHEN p_step = 'reject' AND c.state = 'proposed' THEN 'rejected'
       WHEN p_step = 'reverify' AND c.state = 'approved' THEN 'approved'
       WHEN p_step = 'withdraw' AND c.state IN ('proposed','approved') AND (p_actor = c.owner_id OR approver) THEN 'withdrawn'
       ELSE NULL END;
     IF nxt IS NULL THEN RETURN 'That step is not open to you now.'; END IF;
     IF p_step = 'approve' AND c.review_by <= p_today THEN RETURN 'The review date has passed; propose it again with current evidence.'; END IF;
     IF p_step IN ('reject','reverify','withdraw') AND length(t) < 10 THEN RETURN 'Record what you checked or why (10+ characters).'; END IF;
     IF p_step = 'reverify' AND (p_review IS NULL OR p_review <= p_today OR p_review > p_today + 366) THEN RETURN 'Set a new review date within the next year.'; END IF;
     UPDATE atl_claims SET state = nxt, version = version + 1, updated_at = now(), note = CASE WHEN t <> '' THEN t ELSE note END,
       approver_id = CASE WHEN p_step IN ('approve','reverify') THEN p_actor ELSE approver_id END,
       review_by = CASE WHEN p_step = 'reverify' THEN p_review ELSE review_by END WHERE id = c.id;
     INSERT INTO atl_events (subject, subject_id, step, to_state, actor_id, note) VALUES ('claim', c.id, p_step, nxt, p_actor, t);
     RETURN NULL;
   END $$`,
  // The publication gate: NULL when every cited claim is approved and current.
  `CREATE OR REPLACE FUNCTION atl_claims_check(p_ids bigint[], p_today date) RETURNS text LANGUAGE plpgsql STABLE AS $$
   DECLARE i bigint; c atl_claims;
   BEGIN
     IF coalesce(array_length(p_ids, 1), 0) = 0 THEN RETURN 'Cite an approved claim from the Atlas claims registry (CLM-<number>).'; END IF;
     FOREACH i IN ARRAY p_ids LOOP
       SELECT * INTO c FROM atl_claims WHERE id = i;
       IF NOT FOUND THEN RETURN 'CLM-' || i || ' does not exist.'; END IF;
       IF c.state <> 'approved' THEN RETURN 'CLM-' || i || ' is not approved.'; END IF;
       IF c.review_by < p_today THEN RETURN 'CLM-' || i || ' is past its review date; re-verify it first.'; END IF;
     END LOOP;
     RETURN NULL;
   END $$`,
];
