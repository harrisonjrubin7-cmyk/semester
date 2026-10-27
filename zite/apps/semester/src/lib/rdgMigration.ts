// Sources (readings). Private to the owner unless an instructor of the section publishes it to the course reading list,
// where enrolled students can see it and copy it into their own list. Capability flags (p_can_link, p_is_instructor,
// p_can_read) are computed by the server from memberships and enrollments, never taken from the client.
export const RDG_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS rdg_sources (id bigserial PRIMARY KEY, tenant_id text NOT NULL, owner_id text NOT NULL, section_id text,
     data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object' AND octet_length(data::text) <= 20000 AND length(trim(coalesce(data->>'title',''))) BETWEEN 1 AND 300),
     published boolean NOT NULL DEFAULT false, copied_from bigint, version int NOT NULL DEFAULT 1 CHECK (version >= 1),
     updated_at timestamptz NOT NULL DEFAULT now(), CHECK (NOT published OR section_id IS NOT NULL))`,
  `CREATE INDEX IF NOT EXISTS rdg_sources_owner ON rdg_sources (tenant_id, owner_id)`,
  `CREATE INDEX IF NOT EXISTS rdg_sources_section ON rdg_sources (tenant_id, section_id) WHERE published`,
  `CREATE OR REPLACE FUNCTION rdg_check(p_data jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
   BEGIN
     IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN RETURN 'This source is not in the right shape.'; END IF;
     IF length(trim(coalesce(p_data->>'title',''))) = 0 THEN RETURN 'Add a title.'; END IF;
     IF length(p_data->>'title') > 300 THEN RETURN 'Keep the title under 300 characters.'; END IF;
     IF octet_length(p_data::text) > 20000 THEN RETURN 'This source is too large to save.'; END IF;
     IF coalesce(p_data->>'url','') <> '' AND p_data->>'url' !~* '^https?://' THEN RETURN 'Link should start with http:// or https://.'; END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rdg_save(p_owner text, p_tenant text, p_id bigint, p_section text, p_can_link boolean, p_data jsonb, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE d rdg_sources%ROWTYPE; e text; nid bigint;
   BEGIN
     e := rdg_check(p_data); IF e IS NOT NULL THEN RETURN e; END IF;
     IF p_section IS NOT NULL AND NOT coalesce(p_can_link, false) THEN RETURN 'Choose one of your own courses.'; END IF;
     IF p_id IS NULL THEN
       INSERT INTO rdg_sources (tenant_id, owner_id, section_id, data) VALUES (p_tenant, p_owner, p_section, p_data) RETURNING id INTO nid;
       RETURN 'ok:' || nid || ':1';
     END IF;
     SELECT * INTO d FROM rdg_sources WHERE id = p_id AND tenant_id = p_tenant AND owner_id = p_owner FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Source not found.'; END IF;
     IF d.version <> p_expected THEN RETURN 'This source changed in another window. Reload and try again.'; END IF;
     IF d.published AND p_section IS DISTINCT FROM d.section_id THEN RETURN 'Take it off the course reading list before moving it.'; END IF;
     UPDATE rdg_sources SET section_id = p_section, data = p_data, version = version + 1, updated_at = now() WHERE id = p_id;
     RETURN 'ok:' || p_id || ':' || (d.version + 1);
   END $$`,
  `CREATE OR REPLACE FUNCTION rdg_import(p_owner text, p_tenant text, p_list jsonb) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE x jsonb; n int := 0; e text;
   BEGIN
     IF jsonb_typeof(p_list) <> 'array' OR jsonb_array_length(p_list) = 0 THEN RETURN 'Nothing to import.'; END IF;
     IF jsonb_array_length(p_list) > 500 THEN RETURN 'Import up to 500 sources at a time.'; END IF;
     FOR x IN SELECT * FROM jsonb_array_elements(p_list) LOOP
       e := rdg_check(x); IF e IS NOT NULL THEN RETURN 'Source ' || (n + 1) || ': ' || e; END IF;
       n := n + 1;
     END LOOP;
     INSERT INTO rdg_sources (tenant_id, owner_id, data) SELECT p_tenant, p_owner, v FROM jsonb_array_elements(p_list) v;
     RETURN 'ok:' || n;
   END $$`,
  `CREATE OR REPLACE FUNCTION rdg_publish(p_owner text, p_tenant text, p_id bigint, p_is_instructor boolean, p_publish boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE d rdg_sources%ROWTYPE;
   BEGIN
     SELECT * INTO d FROM rdg_sources WHERE id = p_id AND tenant_id = p_tenant AND owner_id = p_owner FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Source not found.'; END IF;
     IF d.section_id IS NULL THEN RETURN 'Choose the course this reading is for.'; END IF;
     IF NOT coalesce(p_is_instructor, false) THEN RETURN 'Only an instructor of this course can add to its reading list.'; END IF;
     UPDATE rdg_sources SET published = p_publish, version = version + 1, updated_at = now() WHERE id = p_id;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rdg_copy(p_owner text, p_tenant text, p_id bigint, p_can_read boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE d rdg_sources%ROWTYPE; nid bigint;
   BEGIN
     SELECT * INTO d FROM rdg_sources WHERE id = p_id AND tenant_id = p_tenant;
     IF NOT FOUND OR NOT (d.owner_id = p_owner OR (d.published AND coalesce(p_can_read, false))) THEN RETURN 'Source not found.'; END IF;
     INSERT INTO rdg_sources (tenant_id, owner_id, section_id, data, copied_from) VALUES (p_tenant, p_owner, d.section_id, d.data - 'purpose', d.id) RETURNING id INTO nid;
     RETURN 'ok:' || nid;
   END $$`,
  `CREATE OR REPLACE FUNCTION rdg_delete(p_owner text, p_tenant text, p_id bigint) RETURNS text LANGUAGE plpgsql AS $$
   BEGIN
     DELETE FROM rdg_sources WHERE id = p_id AND tenant_id = p_tenant AND owner_id = p_owner;
     IF NOT FOUND THEN RETURN 'Source not found.'; END IF;
     RETURN NULL;
   END $$`,
];
