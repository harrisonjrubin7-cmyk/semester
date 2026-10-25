// Migration crs-001: syllabus version history (Faculty app: "configure syllabus"). Each publish appends a version; nothing is
// ever edited or deleted, so students and reviewers can see what the syllabus said on any date. The endpoint checks that the
// caller teaches the section before writing; the current text is also kept on the section record students already read.
export const CRS_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS crs_syllabus_versions (id bigserial PRIMARY KEY, tenant_id text NOT NULL, section_id text NOT NULL, version int NOT NULL,
     body text NOT NULL CHECK (length(body) BETWEEN 20 AND 40000), change_note text NOT NULL DEFAULT '', author_id text NOT NULL,
     published_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE (section_id, version))`,
  `CREATE OR REPLACE FUNCTION crs_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DROP TRIGGER IF EXISTS crs_syllabus_append_only ON crs_syllabus_versions`,
  `CREATE TRIGGER crs_syllabus_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON crs_syllabus_versions FOR EACH STATEMENT EXECUTE FUNCTION crs_refuse_change()`,
  `CREATE OR REPLACE FUNCTION crs_publish_syllabus(p_tenant text, p_section text, p_author text, p_body text, p_note text, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE v int;
   BEGIN
     PERFORM pg_advisory_xact_lock(hashtext('crs:' || p_section));
     SELECT coalesce(max(version), 0) INTO v FROM crs_syllabus_versions WHERE section_id = p_section;
     IF v <> p_expected THEN RETURN 'Someone published a newer syllabus since you opened it. Reload.'; END IF;
     IF length(trim(coalesce(p_body, ''))) < 20 THEN RETURN 'The syllabus needs at least a few lines.'; END IF;
     INSERT INTO crs_syllabus_versions (tenant_id, section_id, version, body, change_note, author_id) VALUES (p_tenant, p_section, v + 1, trim(p_body), trim(coalesce(p_note, '')), p_author);
     RETURN NULL;
   END $$`,
];
