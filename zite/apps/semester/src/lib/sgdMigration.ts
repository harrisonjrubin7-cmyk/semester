// Migration sgd-001: course study guides (the material every study mode reads; parsing lives in lib/guideRules.ts).
// A guide belongs to its owner and is private. An instructor of the section may publish their guide to that section
// (the endpoint checks the course role and passes it in); enrolled students read a published guide and can copy it into a
// private guide of their own. Only the owner edits a guide, with an expected version. Card reviews (Leitner boxes) and quiz
// attempts belong to the student who made them. Nothing here is sent to a model.
export const SGD_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS sgd_guides (id bigserial PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, section_id text,
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 2 AND 120), source text NOT NULL DEFAULT '' CHECK (length(source) <= 100000),
     published boolean NOT NULL DEFAULT false, copied_from bigint, version int NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(),
     CHECK (NOT published OR section_id IS NOT NULL))`,
  `CREATE TABLE IF NOT EXISTS sgd_reviews (guide_id bigint NOT NULL REFERENCES sgd_guides(id) ON DELETE CASCADE, student_id text NOT NULL, card_key text NOT NULL,
     box int NOT NULL CHECK (box BETWEEN 1 AND 5), due date NOT NULL, PRIMARY KEY (guide_id, student_id, card_key))`,
  `CREATE TABLE IF NOT EXISTS sgd_attempts (id bigserial PRIMARY KEY, guide_id bigint NOT NULL REFERENCES sgd_guides(id) ON DELETE CASCADE, student_id text NOT NULL,
     seed int NOT NULL, score int NOT NULL, total int NOT NULL CHECK (total > 0), at timestamptz NOT NULL DEFAULT now(), CHECK (score BETWEEN 0 AND total))`,
  `CREATE OR REPLACE FUNCTION sgd_save(p_actor text, p_tenant text, p_id bigint, p_title text, p_source text, p_section text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE g sgd_guides; v_id bigint;
   BEGIN
     IF p_id IS NULL THEN
       INSERT INTO sgd_guides (tenant_id, owner_id, section_id, title, source) VALUES (p_tenant, p_actor, p_section, trim(p_title), coalesce(p_source, '')) RETURNING id INTO v_id;
       RETURN 'ok:' || v_id;
     END IF;
     SELECT * INTO g FROM sgd_guides WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF g.id IS NULL OR g.owner_id <> p_actor THEN RETURN 'Guide not found.'; END IF;
     IF g.version <> p_version THEN RETURN 'This guide changed in another window. Reload and try again.'; END IF;
     UPDATE sgd_guides SET title = trim(p_title), source = coalesce(p_source, ''), section_id = CASE WHEN g.published THEN g.section_id ELSE p_section END,
       version = version + 1, updated_at = now() WHERE id = p_id;
     RETURN 'ok:' || p_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION sgd_publish(p_actor text, p_tenant text, p_id bigint, p_is_instructor boolean, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE g sgd_guides;
   BEGIN
     SELECT * INTO g FROM sgd_guides WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF g.id IS NULL OR g.owner_id <> p_actor THEN RETURN 'Guide not found.'; END IF;
     IF p_on AND g.section_id IS NULL THEN RETURN 'Choose the section this guide is for.'; END IF;
     IF p_on AND NOT p_is_instructor THEN RETURN 'Only an instructor of the section publishes a guide to it.'; END IF;
     UPDATE sgd_guides SET published = p_on, version = version + 1 WHERE id = p_id;
     RETURN NULL;
   END $$`,
  // p_can_read: the endpoint has checked the caller is enrolled in (or teaches) the published guide's section.
  `CREATE OR REPLACE FUNCTION sgd_copy(p_actor text, p_tenant text, p_id bigint, p_can_read boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE g sgd_guides; v_id bigint;
   BEGIN
     SELECT * INTO g FROM sgd_guides WHERE id = p_id AND tenant_id = p_tenant;
     IF g.id IS NULL OR NOT (g.owner_id = p_actor OR (g.published AND p_can_read)) THEN RETURN 'Guide not found.'; END IF;
     INSERT INTO sgd_guides (tenant_id, owner_id, section_id, title, source, copied_from) VALUES (p_tenant, p_actor, g.section_id, g.title, g.source, g.id) RETURNING id INTO v_id;
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION sgd_delete(p_actor text, p_tenant text, p_id bigint) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     DELETE FROM sgd_guides WHERE id = p_id AND tenant_id = p_tenant AND owner_id = p_actor;
     IF NOT FOUND THEN RETURN 'Guide not found.'; END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION sgd_review(p_actor text, p_tenant text, p_id bigint, p_can_read boolean, p_card text, p_box int, p_days int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE g sgd_guides;
   BEGIN
     SELECT * INTO g FROM sgd_guides WHERE id = p_id AND tenant_id = p_tenant;
     IF g.id IS NULL OR NOT (g.owner_id = p_actor OR (g.published AND p_can_read)) THEN RETURN 'Guide not found.'; END IF;
     INSERT INTO sgd_reviews (guide_id, student_id, card_key, box, due) VALUES (p_id, p_actor, p_card, p_box, current_date + p_days)
       ON CONFLICT (guide_id, student_id, card_key) DO UPDATE SET box = EXCLUDED.box, due = EXCLUDED.due;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION sgd_attempt(p_actor text, p_tenant text, p_id bigint, p_can_read boolean, p_seed int, p_score int, p_total int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE g sgd_guides;
   BEGIN
     SELECT * INTO g FROM sgd_guides WHERE id = p_id AND tenant_id = p_tenant;
     IF g.id IS NULL OR NOT (g.owner_id = p_actor OR (g.published AND p_can_read)) THEN RETURN 'Guide not found.'; END IF;
     IF p_total <= 0 OR p_score < 0 OR p_score > p_total THEN RETURN 'That score is not possible.'; END IF;
     INSERT INTO sgd_attempts (guide_id, student_id, seed, score, total) VALUES (p_id, p_actor, p_seed, p_score, p_total);
     RETURN NULL;
   END $$`,
];
