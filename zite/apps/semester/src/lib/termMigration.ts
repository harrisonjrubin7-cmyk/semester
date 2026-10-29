// Migration term-001: term completion and archiving (platform plan: term completion -> archive -> retention).
// Lifecycle is separate from the versioned calendar rows: a term with an approved calendar starts 'open';
// completing it closes registration changes for the term; archiving is the retention state — every record
// stays readable and nothing is ever deleted by this workflow. Both steps land in the append-only cal_events.
export const TERM_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS term_lifecycle (tenant_id text NOT NULL, term text NOT NULL,
     state text NOT NULL CHECK (state IN ('completed', 'archived')),
     completed_by text NOT NULL, completed_at timestamptz NOT NULL DEFAULT clock_timestamp(), completion_note text NOT NULL DEFAULT '',
     archived_by text, archived_at timestamptz, archive_note text NOT NULL DEFAULT '',
     PRIMARY KEY (tenant_id, term))`,
  `CREATE OR REPLACE FUNCTION term_state(p_tenant text, p_term text) RETURNS text LANGUAGE sql STABLE AS $$
     SELECT coalesce((SELECT state FROM term_lifecycle WHERE tenant_id = p_tenant AND term = p_term), 'open') $$`,
  `CREATE OR REPLACE FUNCTION term_complete(p_actor text, p_tenant text, p_term text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE c cal_terms%ROWTYPE; s text;
   BEGIN
     PERFORM pg_advisory_xact_lock(hashtext('cal:' || p_tenant || p_term));
     SELECT * INTO c FROM cal_terms WHERE tenant_id = p_tenant AND term = p_term AND state = 'approved' ORDER BY version DESC LIMIT 1;
     IF NOT FOUND THEN RETURN 'There is no approved calendar for this term.'; END IF;
     s := term_state(p_tenant, p_term);
     IF s = 'completed' THEN RETURN 'This term is already completed.'; END IF;
     IF s = 'archived' THEN RETURN 'This term is already archived.'; END IF;
     IF c.classes_end >= current_date THEN RETURN 'Classes have not ended for this term yet.'; END IF;
     INSERT INTO term_lifecycle (tenant_id, term, state, completed_by, completion_note)
       VALUES (p_tenant, p_term, 'completed', p_actor, trim(coalesce(p_note, '')));
     INSERT INTO cal_events (tenant_id, term, actor_id, action, detail) VALUES (p_tenant, p_term, p_actor, 'completed', trim(coalesce(p_note, '')));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION term_archive(p_actor text, p_tenant text, p_term text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE s text;
   BEGIN
     PERFORM pg_advisory_xact_lock(hashtext('cal:' || p_tenant || p_term));
     s := term_state(p_tenant, p_term);
     IF s = 'open' THEN RETURN 'Complete the term before archiving it.'; END IF;
     IF s = 'archived' THEN RETURN 'This term is already archived.'; END IF;
     UPDATE term_lifecycle SET state = 'archived', archived_by = p_actor, archived_at = clock_timestamp(), archive_note = trim(coalesce(p_note, ''))
       WHERE tenant_id = p_tenant AND term = p_term;
     INSERT INTO cal_events (tenant_id, term, actor_id, action, detail) VALUES (p_tenant, p_term, p_actor, 'archived', trim(coalesce(p_note, '')));
     RETURN NULL;
   END $$`,
];
