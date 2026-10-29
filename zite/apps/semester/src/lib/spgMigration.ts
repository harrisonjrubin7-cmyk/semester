// Institution → public site (C23) and public site → Applicants (C06), owner register S-85. An institution's catalog
// managers write a public program listing; nothing appears on the public site until it is explicitly published, and only
// the listing's own fields are shown there. Withdrawing removes it. Versioned; every step logged append-only.
export const SPG_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS spg_programs (id bigserial PRIMARY KEY, tenant_id text NOT NULL, name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
     summary text NOT NULL DEFAULT '' CHECK (length(summary) <= 1000), entry_terms text NOT NULL DEFAULT '' CHECK (length(entry_terms) <= 200),
     accepting boolean NOT NULL DEFAULT true, state text NOT NULL DEFAULT 'Draft' CHECK (state IN ('Draft','Published','Withdrawn')),
     version int NOT NULL DEFAULT 1, edited_by text NOT NULL, published_by text, published_at timestamptz, UNIQUE (tenant_id, name))`,
  `CREATE TABLE IF NOT EXISTS spg_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, program_id bigint NOT NULL, actor_id text NOT NULL,
     action text NOT NULL, at timestamptz NOT NULL DEFAULT now())`,
  `CREATE OR REPLACE FUNCTION spg_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'The publication log cannot be changed.'; END $$`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'spg_events_append_only') THEN
     CREATE TRIGGER spg_events_append_only BEFORE UPDATE OR DELETE ON spg_events FOR EACH ROW EXECUTE FUNCTION spg_refuse_change(); END IF; END $$`,
  // Saving a published listing takes it back to Draft: an edit is never public until published again.
  `CREATE OR REPLACE FUNCTION spg_save(p_actor text, p_tenant text, p_ok boolean, p_id bigint, p_name text, p_summary text, p_terms text, p_accepting boolean, p_expected int)
     RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r spg_programs%ROWTYPE; v_id bigint;
   BEGIN
     IF NOT p_ok THEN RETURN 'Only catalog managers edit public programs.'; END IF;
     IF length(trim(coalesce(p_name,''))) < 2 THEN RETURN 'Give the program a name.'; END IF;
     IF p_id IS NULL THEN
       BEGIN
         INSERT INTO spg_programs (tenant_id, name, summary, entry_terms, accepting, edited_by) VALUES (p_tenant, trim(p_name), left(coalesce(p_summary,''),1000), left(coalesce(p_terms,''),200), p_accepting, p_actor) RETURNING id INTO v_id;
       EXCEPTION WHEN unique_violation THEN RETURN 'A program with this name already exists.'; END;
     ELSE
       SELECT * INTO r FROM spg_programs WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
       IF NOT FOUND THEN RETURN 'Program not found.'; END IF;
       IF r.version <> p_expected THEN RETURN 'Someone changed this program since you opened it. Reload and try again.'; END IF;
       UPDATE spg_programs SET name = trim(p_name), summary = left(coalesce(p_summary,''),1000), entry_terms = left(coalesce(p_terms,''),200), accepting = p_accepting,
         state = 'Draft', version = version + 1, edited_by = p_actor WHERE id = p_id;
       v_id := p_id;
     END IF;
     INSERT INTO spg_events (tenant_id, program_id, actor_id, action) VALUES (p_tenant, v_id, p_actor, 'saved');
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION spg_set(p_actor text, p_tenant text, p_ok boolean, p_id bigint, p_state text, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r spg_programs%ROWTYPE;
   BEGIN
     IF NOT p_ok THEN RETURN 'Only catalog managers publish programs.'; END IF;
     IF p_state NOT IN ('Published','Withdrawn') THEN RETURN 'Unknown action.'; END IF;
     SELECT * INTO r FROM spg_programs WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Program not found.'; END IF;
     IF r.version <> p_expected THEN RETURN 'Someone changed this program since you opened it. Reload and try again.'; END IF;
     IF r.state = p_state THEN RETURN 'It is already ' || lower(p_state) || '.'; END IF;
     IF p_state = 'Published' AND length(trim(r.summary)) < 20 THEN RETURN 'Write a public summary of at least 20 characters first.'; END IF;
     UPDATE spg_programs SET state = p_state, version = version + 1,
       published_by = CASE WHEN p_state = 'Published' THEN p_actor ELSE published_by END,
       published_at = CASE WHEN p_state = 'Published' THEN now() ELSE published_at END WHERE id = p_id;
     INSERT INTO spg_events (tenant_id, program_id, actor_id, action) VALUES (p_tenant, p_id, p_actor, lower(p_state));
     RETURN 'ok';
   END $$`,
  // Fit-and-cost details (Applicants discovery): published by the institution itself, shown labelled as such.
  `ALTER TABLE spg_programs ADD COLUMN IF NOT EXISTS annual_cost_cents int CHECK (annual_cost_cents IS NULL OR annual_cost_cents >= 0)`,
  `ALTER TABLE spg_programs ADD COLUMN IF NOT EXISTS duration_text text NOT NULL DEFAULT ''`,
  `ALTER TABLE spg_programs ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT ''`,
  `ALTER TABLE spg_programs ADD COLUMN IF NOT EXISTS requirements text NOT NULL DEFAULT ''`,
  `CREATE OR REPLACE FUNCTION spg_save_details(p_actor text, p_tenant text, p_ok boolean, p_id bigint, p_cost int, p_duration text, p_format text, p_requirements text, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE r spg_programs%ROWTYPE;
   BEGIN
     IF NOT p_ok THEN RETURN 'Only catalog managers edit public programs.'; END IF;
     SELECT * INTO r FROM spg_programs WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Program not found.'; END IF;
     IF r.version <> p_expected THEN RETURN 'Someone changed this program since you opened it. Reload and try again.'; END IF;
     IF p_cost IS NOT NULL AND p_cost < 0 THEN RETURN 'The published annual cost cannot be negative.'; END IF;
     IF coalesce(p_format, '') NOT IN ('', 'On campus', 'Online', 'Hybrid') THEN RETURN 'Pick a format the listing offers.'; END IF;
     UPDATE spg_programs SET annual_cost_cents = p_cost, duration_text = left(coalesce(p_duration, ''), 120), format = coalesce(p_format, ''),
       requirements = left(coalesce(p_requirements, ''), 1000), state = 'Draft', version = version + 1, edited_by = p_actor WHERE id = p_id;
     INSERT INTO spg_events (tenant_id, program_id, actor_id, action) VALUES (p_tenant, p_id, p_actor, 'details saved');
     RETURN 'ok:' || p_id;
   END $$`,
];
