// Migration grp-001: course groups (MOD-034 "group setup"). A section has group sets (e.g. "Project teams"); each set
// has groups; a student is in at most one group per set. Instructors create and assign; when a set allows self-signup,
// enrolled students join or leave themselves within the size cap. Size and one-group-per-set are enforced here under a
// lock on the set; the endpoint checks instructor or enrollment (Zite section data) and passes only enrolled students.
export const GRP_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS grp_sets (id bigserial PRIMARY KEY, tenant_id text NOT NULL, section_id text NOT NULL,
     name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120), self_signup boolean NOT NULL DEFAULT false,
     max_size int NOT NULL CHECK (max_size BETWEEN 2 AND 50), created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS grp_groups (id bigserial PRIMARY KEY, set_id bigint NOT NULL REFERENCES grp_sets(id),
     name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120), UNIQUE (set_id, name))`,
  `CREATE TABLE IF NOT EXISTS grp_members (set_id bigint NOT NULL REFERENCES grp_sets(id), group_id bigint NOT NULL REFERENCES grp_groups(id),
     student_id text NOT NULL, added_by text NOT NULL, added_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (set_id, student_id))`,
  // p_by_instructor: instructors may place anyone enrolled (passed in by the endpoint); students only themselves, only in self-signup sets.
  `CREATE OR REPLACE FUNCTION grp_join(p_tenant text, p_group bigint, p_student text, p_actor text, p_by_instructor boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE g grp_groups%ROWTYPE; s grp_sets%ROWTYPE; n int;
   BEGIN
     SELECT * INTO g FROM grp_groups WHERE id = p_group;
     IF NOT FOUND THEN RETURN 'Group not found.'; END IF;
     SELECT * INTO s FROM grp_sets WHERE id = g.set_id AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Group not found.'; END IF;
     IF NOT p_by_instructor AND (NOT s.self_signup OR p_actor <> p_student) THEN RETURN 'Your instructor assigns groups in this set.'; END IF;
     SELECT count(*) INTO n FROM grp_members WHERE group_id = p_group AND student_id <> p_student;
     IF n >= s.max_size THEN RETURN 'That group is full.'; END IF;
     INSERT INTO grp_members (set_id, group_id, student_id, added_by) VALUES (s.id, p_group, p_student, p_actor)
       ON CONFLICT (set_id, student_id) DO UPDATE SET group_id = EXCLUDED.group_id, added_by = EXCLUDED.added_by, added_at = now();
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION grp_leave(p_tenant text, p_set bigint, p_student text, p_actor text, p_by_instructor boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE s grp_sets%ROWTYPE;
   BEGIN
     SELECT * INTO s FROM grp_sets WHERE id = p_set AND tenant_id = p_tenant FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Group set not found.'; END IF;
     IF NOT p_by_instructor AND (NOT s.self_signup OR p_actor <> p_student) THEN RETURN 'Your instructor manages groups in this set.'; END IF;
     DELETE FROM grp_members WHERE set_id = p_set AND student_id = p_student;
     IF NOT FOUND THEN RETURN 'Not in a group in this set.'; END IF;
     RETURN NULL;
   END $$`,
];
