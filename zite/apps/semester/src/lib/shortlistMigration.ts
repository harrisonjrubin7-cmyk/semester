// Applicant shortlists (Applicants discovery: fit-and-cost comparison). A shortlist belongs to the signed-in
// person, spans institutions, and can only hold programs that are Published right now; the cap keeps the
// comparison readable. Removing is always allowed; a withdrawn program stays on the list but stops displaying
// until it is published again (the read side joins on Published).
export const SHORTLIST_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS app_shortlist (user_id text NOT NULL, program_id bigint NOT NULL REFERENCES spg_programs(id),
     added_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY (user_id, program_id))`,
  `CREATE OR REPLACE FUNCTION app_shortlist_add(p_user text, p_program bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE st text; n int;
   BEGIN
     SELECT state INTO st FROM spg_programs WHERE id = p_program;
     IF NOT FOUND THEN RETURN 'Program not found.'; END IF;
     IF st <> 'Published' THEN RETURN 'Only published programs can be shortlisted.'; END IF;
     IF EXISTS (SELECT 1 FROM app_shortlist WHERE user_id = p_user AND program_id = p_program) THEN RETURN 'ok'; END IF;
     SELECT count(*) INTO n FROM app_shortlist WHERE user_id = p_user;
     IF n >= 12 THEN RETURN 'Your shortlist is full (12). Remove one to add another.'; END IF;
     INSERT INTO app_shortlist (user_id, program_id) VALUES (p_user, p_program);
     RETURN 'ok';
   END $$`,
  `CREATE OR REPLACE FUNCTION app_shortlist_remove(p_user text, p_program bigint) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     DELETE FROM app_shortlist WHERE user_id = p_user AND program_id = p_program;
     RETURN 'ok';
   END $$`,
];
