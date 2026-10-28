// Institution grading policy (D-2026-10-28-grading follow-up). One registrar proposes, a different registrar approves;
// only then do transcripts use it. Versions are kept; the log is append-only. Until a policy is approved the sample
// policy applies and the transcript says so. Functions return NULL/'ok:…' on success or a sentence explaining the refusal.
export const GPL_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS gpl_policies (id bigserial PRIMARY KEY, tenant_id text NOT NULL, version int NOT NULL CHECK (version >= 1),
     policy jsonb NOT NULL CHECK (jsonb_typeof(policy) = 'object' AND jsonb_typeof(policy->'scale') = 'object' AND policy->>'repeat' IN ('latest','highest','all')),
     note text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'Proposed' CHECK (status IN ('Proposed','Approved','Superseded','Rejected')),
     proposed_by text NOT NULL, proposed_at timestamptz NOT NULL DEFAULT now(), decided_by text, decided_at timestamptz, decision_note text NOT NULL DEFAULT '',
     CHECK (decided_by IS NULL OR decided_by <> proposed_by), UNIQUE (tenant_id, version))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS gpl_one_approved ON gpl_policies (tenant_id) WHERE status = 'Approved'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS gpl_one_pending ON gpl_policies (tenant_id) WHERE status = 'Proposed'`,
  `CREATE TABLE IF NOT EXISTS gpl_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, policy_id bigint, actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION gpl_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'The grading policy log cannot be changed.'; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'gpl_events_append_only') THEN
     CREATE TRIGGER gpl_events_append_only BEFORE UPDATE OR DELETE ON gpl_events FOR EACH ROW EXECUTE FUNCTION gpl_refuse_change(); END IF; END $$`,
  `CREATE OR REPLACE FUNCTION gpl_propose(p_actor text, p_tenant text, p_is_registrar boolean, p_policy jsonb, p_valid boolean, p_note text, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE cur int; nid bigint; nv int;
   BEGIN
     IF NOT coalesce(p_is_registrar, false) THEN RETURN 'Only a registrar proposes the grading policy.'; END IF;
     IF NOT coalesce(p_valid, false) THEN RETURN 'The policy has problems; fix them before proposing.'; END IF;
     IF length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Say what the policy is based on (at least 10 characters), for example the catalog section.'; END IF;
     PERFORM pg_advisory_xact_lock(hashtext('gpl:' || p_tenant));
     SELECT coalesce(max(version), 0) INTO cur FROM gpl_policies WHERE tenant_id = p_tenant AND status = 'Approved';
     IF cur <> coalesce(p_expected, -1) THEN RETURN 'The approved policy changed since you opened it. Reload and try again.'; END IF;
     IF EXISTS (SELECT 1 FROM gpl_policies WHERE tenant_id = p_tenant AND status = 'Proposed') THEN RETURN 'A proposed policy is already waiting for approval.'; END IF;
     SELECT coalesce(max(version), 0) + 1 INTO nv FROM gpl_policies WHERE tenant_id = p_tenant;
     INSERT INTO gpl_policies (tenant_id, version, policy, note, proposed_by) VALUES (p_tenant, nv, p_policy, trim(p_note), p_actor) RETURNING id INTO nid;
     INSERT INTO gpl_events (tenant_id, policy_id, actor_id, action, detail) VALUES (p_tenant, nid, p_actor, 'proposed', 'version ' || nv);
     RETURN 'ok:' || nid || ':' || nv;
   END $$`,
  `CREATE OR REPLACE FUNCTION gpl_decide(p_actor text, p_tenant text, p_id bigint, p_is_registrar boolean, p_approve boolean, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE p gpl_policies%ROWTYPE;
   BEGIN
     IF NOT coalesce(p_is_registrar, false) THEN RETURN 'Only a registrar approves the grading policy.'; END IF;
     PERFORM pg_advisory_xact_lock(hashtext('gpl:' || p_tenant));
     SELECT * INTO p FROM gpl_policies WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Policy not found.'; END IF;
     IF p.status <> 'Proposed' THEN RETURN 'This policy was already decided.'; END IF;
     IF p.proposed_by = p_actor THEN RETURN 'You proposed this policy; another registrar must decide it.'; END IF;
     IF p_approve THEN
       UPDATE gpl_policies SET status = 'Superseded' WHERE tenant_id = p_tenant AND status = 'Approved';
       UPDATE gpl_policies SET status = 'Approved', decided_by = p_actor, decided_at = now(), decision_note = coalesce(p_note, '') WHERE id = p_id;
     ELSE
       IF length(trim(coalesce(p_note, ''))) < 10 THEN RETURN 'Say why the policy is rejected (at least 10 characters).'; END IF;
       UPDATE gpl_policies SET status = 'Rejected', decided_by = p_actor, decided_at = now(), decision_note = p_note WHERE id = p_id;
     END IF;
     INSERT INTO gpl_events (tenant_id, policy_id, actor_id, action, detail) VALUES (p_tenant, p_id, p_actor, CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, coalesce(p_note, ''));
     RETURN 'ok';
   END $$`,
];
