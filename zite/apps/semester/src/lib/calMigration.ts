// Migration cal-001: academic calendar and registration windows (Registrar app: "terms, windows").
// A registrar proposes a term's dates; a different registrar approves them (two-person rule, also a CHECK). The effective
// calendar is the latest approved version; earlier versions stay for the record. Once a term has an approved calendar,
// registration submissions for it are accepted only inside the window; terms without one behave as before.
export const CAL_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS cal_terms (id bigserial PRIMARY KEY, tenant_id text NOT NULL, term text NOT NULL, version int NOT NULL,
     reg_opens timestamptz NOT NULL, reg_closes timestamptz NOT NULL, add_drop_ends date NOT NULL, classes_start date NOT NULL, classes_end date NOT NULL,
     note text NOT NULL DEFAULT '', state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed', 'approved', 'rejected', 'superseded')),
     proposed_by text NOT NULL, decided_by text, decided_at timestamptz, decision_note text, created_at timestamptz NOT NULL DEFAULT now(),
     UNIQUE (tenant_id, term, version), CHECK (decided_by IS NULL OR decided_by <> proposed_by),
     CHECK (reg_opens < reg_closes), CHECK (classes_start < classes_end), CHECK (add_drop_ends >= classes_start AND add_drop_ends <= classes_end))`,
  `CREATE TABLE IF NOT EXISTS cal_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, term text NOT NULL, actor_id text NOT NULL, action text NOT NULL, detail text NOT NULL DEFAULT '', at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION cal_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS cal_events_append_only ON cal_events`,
  `CREATE TRIGGER cal_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON cal_events FOR EACH STATEMENT EXECUTE FUNCTION cal_refuse_change()`,
  `CREATE OR REPLACE FUNCTION cal_propose(p_actor text, p_tenant text, p_term text, p_opens timestamptz, p_closes timestamptz, p_add_drop date, p_start date, p_end date, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v int;
   BEGIN
     IF length(trim(coalesce(p_term, ''))) < 3 THEN RETURN 'Name the term.'; END IF;
     IF p_opens >= p_closes THEN RETURN 'Registration must open before it closes.'; END IF;
     IF p_start >= p_end THEN RETURN 'Classes must start before they end.'; END IF;
     IF p_add_drop < p_start OR p_add_drop > p_end THEN RETURN 'The add/drop deadline must fall within the term.'; END IF;
     IF EXISTS (SELECT 1 FROM cal_terms WHERE tenant_id = p_tenant AND term = p_term AND state = 'proposed') THEN RETURN 'A proposal for this term is already waiting for approval.'; END IF;
     PERFORM pg_advisory_xact_lock(hashtext('cal:' || p_tenant || p_term));
     SELECT coalesce(max(version), 0) + 1 INTO v FROM cal_terms WHERE tenant_id = p_tenant AND term = p_term;
     INSERT INTO cal_terms (tenant_id, term, version, reg_opens, reg_closes, add_drop_ends, classes_start, classes_end, note, proposed_by)
       VALUES (p_tenant, trim(p_term), v, p_opens, p_closes, p_add_drop, p_start, p_end, trim(coalesce(p_note, '')), p_actor);
     INSERT INTO cal_events (tenant_id, term, actor_id, action, detail) VALUES (p_tenant, p_term, p_actor, 'proposed', 'v' || v);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION cal_decide(p_actor text, p_tenant text, p_id bigint, p_approve boolean, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c cal_terms%ROWTYPE;
   BEGIN
     SELECT * INTO c FROM cal_terms WHERE id = p_id FOR UPDATE;
     IF NOT FOUND OR c.tenant_id <> p_tenant THEN RETURN 'Proposal not found.'; END IF;
     IF c.state <> 'proposed' THEN RETURN 'This proposal was already decided.'; END IF;
     IF c.proposed_by = p_actor THEN RETURN 'A different registrar must approve your proposal.'; END IF;
     IF NOT p_approve AND length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Say why it is rejected.'; END IF;
     IF p_approve THEN UPDATE cal_terms SET state = 'superseded' WHERE tenant_id = p_tenant AND term = c.term AND state = 'approved'; END IF;
     UPDATE cal_terms SET state = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, decided_by = p_actor, decided_at = now(), decision_note = trim(coalesce(p_note, '')) WHERE id = p_id;
     INSERT INTO cal_events (tenant_id, term, actor_id, action, detail) VALUES (p_tenant, c.term, p_actor, CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END, 'v' || c.version);
     RETURN NULL;
   END $$`,
  // 'none' = no approved calendar (old behaviour), otherwise 'not_yet' | 'open' | 'closed'.
  `CREATE OR REPLACE FUNCTION cal_window(p_tenant text, p_term text) RETURNS text LANGUAGE sql STABLE AS $$
     SELECT coalesce((SELECT CASE WHEN now() < reg_opens THEN 'not_yet' WHEN now() > reg_closes THEN 'closed' ELSE 'open' END
       FROM cal_terms WHERE tenant_id = p_tenant AND term = p_term AND state = 'approved' ORDER BY version DESC LIMIT 1), 'none') $$`,
];
