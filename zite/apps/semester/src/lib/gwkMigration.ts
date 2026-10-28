// Group work: a shared part list for one course group (grp_groups). Membership is read from grp_members inside each
// function, never from the client. Members add, edit and reassign parts within the group; only the creator deletes a part;
// every change is written to an append-only log. Instructors of the section read the list and log (p_is_instructor is
// computed by the server from the course role) but do not edit it.
export const GWK_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS gwk_parts (id bigserial PRIMARY KEY, tenant_id text NOT NULL, group_id bigint NOT NULL,
     title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200), owner_id text,
     status text NOT NULL DEFAULT 'To do' CHECK (status IN ('To do','In progress','Needs review','Done')),
     due date, note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000), created_by text NOT NULL,
     version int NOT NULL DEFAULT 1 CHECK (version >= 1), updated_by text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS gwk_parts_group ON gwk_parts (tenant_id, group_id)`,
  `CREATE TABLE IF NOT EXISTS gwk_log (id bigserial PRIMARY KEY, tenant_id text NOT NULL, group_id bigint NOT NULL, part_id bigint,
     actor text NOT NULL, what text NOT NULL, at timestamptz NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS gwk_log_group ON gwk_log (tenant_id, group_id, at DESC)`,
  `CREATE OR REPLACE FUNCTION gwk_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'The group work log is kept as written.'; END $$`,
  `DROP TRIGGER IF EXISTS gwk_log_append_only ON gwk_log`,
  `CREATE TRIGGER gwk_log_append_only BEFORE UPDATE OR DELETE ON gwk_log FOR EACH ROW EXECUTE FUNCTION gwk_refuse_change()`,
  `CREATE OR REPLACE FUNCTION gwk_is_member(p_tenant text, p_group bigint, p_user text) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT EXISTS (SELECT 1 FROM grp_members m JOIN grp_groups g ON g.id = m.group_id JOIN grp_sets s ON s.id = g.set_id
                    WHERE m.group_id = p_group AND m.student_id = p_user AND s.tenant_id = p_tenant) $$`,
  `CREATE OR REPLACE FUNCTION gwk_save(p_actor text, p_tenant text, p_group bigint, p_id bigint, p_title text, p_owner text,
     p_status text, p_due date, p_note text, p_expected int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE d gwk_parts%ROWTYPE; nid bigint; what text;
   BEGIN
     IF NOT gwk_is_member(p_tenant, p_group, p_actor) THEN RETURN 'Only members of this group can change its parts.'; END IF;
     IF p_title IS NULL OR length(trim(p_title)) = 0 OR length(trim(p_title)) > 200 THEN RETURN 'Name the part (up to 200 characters).'; END IF;
     IF p_status NOT IN ('To do','In progress','Needs review','Done') THEN RETURN 'Unknown status.'; END IF;
     IF p_owner IS NOT NULL AND NOT gwk_is_member(p_tenant, p_group, p_owner) THEN RETURN 'A part can only be given to someone in the group.'; END IF;
     IF length(coalesce(p_note,'')) > 2000 THEN RETURN 'Keep the note under 2000 characters.'; END IF;
     IF p_id IS NULL THEN
       INSERT INTO gwk_parts (tenant_id, group_id, title, owner_id, status, due, note, created_by, updated_by)
         VALUES (p_tenant, p_group, trim(p_title), p_owner, p_status, p_due, coalesce(p_note,''), p_actor, p_actor) RETURNING id INTO nid;
       INSERT INTO gwk_log (tenant_id, group_id, part_id, actor, what) VALUES (p_tenant, p_group, nid, p_actor, 'added "' || trim(p_title) || '"' || CASE WHEN p_owner IS NOT NULL THEN ' for ' || p_owner ELSE '' END);
       RETURN 'ok:' || nid || ':1';
     END IF;
     SELECT * INTO d FROM gwk_parts WHERE id = p_id AND tenant_id = p_tenant AND group_id = p_group FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Part not found.'; END IF;
     IF d.version <> p_expected THEN RETURN 'Someone in your group changed this part. Reload and try again.'; END IF;
     what := concat_ws('; ',
       CASE WHEN d.title <> trim(p_title) THEN 'renamed to "' || trim(p_title) || '"' END,
       CASE WHEN d.owner_id IS DISTINCT FROM p_owner THEN 'owner ' || coalesce(d.owner_id,'nobody') || ' → ' || coalesce(p_owner,'nobody') END,
       CASE WHEN d.status <> p_status THEN 'status ' || d.status || ' → ' || p_status END,
       CASE WHEN d.due IS DISTINCT FROM p_due THEN 'due ' || coalesce(d.due::text,'none') || ' → ' || coalesce(p_due::text,'none') END,
       CASE WHEN d.note <> coalesce(p_note,'') THEN 'note edited' END);
     UPDATE gwk_parts SET title = trim(p_title), owner_id = p_owner, status = p_status, due = p_due, note = coalesce(p_note,''), version = version + 1, updated_by = p_actor, updated_at = now() WHERE id = p_id;
     IF what <> '' THEN INSERT INTO gwk_log (tenant_id, group_id, part_id, actor, what) VALUES (p_tenant, p_group, p_id, p_actor, '"' || d.title || '": ' || what); END IF;
     RETURN 'ok:' || p_id || ':' || (d.version + 1);
   END $$`,
  `CREATE OR REPLACE FUNCTION gwk_delete(p_actor text, p_tenant text, p_group bigint, p_id bigint) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE d gwk_parts%ROWTYPE;
   BEGIN
     IF NOT gwk_is_member(p_tenant, p_group, p_actor) THEN RETURN 'Only members of this group can change its parts.'; END IF;
     SELECT * INTO d FROM gwk_parts WHERE id = p_id AND tenant_id = p_tenant AND group_id = p_group FOR UPDATE;
     IF NOT FOUND THEN RETURN 'Part not found.'; END IF;
     IF d.created_by <> p_actor THEN RETURN 'Only the person who added a part can remove it.'; END IF;
     DELETE FROM gwk_parts WHERE id = p_id;
     INSERT INTO gwk_log (tenant_id, group_id, part_id, actor, what) VALUES (p_tenant, p_group, p_id, p_actor, 'removed "' || d.title || '"');
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION gwk_can_read(p_actor text, p_tenant text, p_group bigint, p_is_instructor boolean) RETURNS boolean LANGUAGE sql STABLE AS $$
     SELECT gwk_is_member(p_tenant, p_group, p_actor) OR coalesce(p_is_instructor, false) $$`,
];
