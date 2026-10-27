// Migration rlf-001: residence life community work (Resident Assistant and Residence Life Staff role apps), on top of hsg-001.
// Roles come from hsg_staff (administrator-granted; an RA has a building). Check-ins: an RA logs a short check-in only with a
// resident currently moved in to the RA's own building; referrals name a service, never private detail. Programs: an RA proposes
// a program in their building, housing staff (not the proposer) approve it, residents of that building RSVP up to capacity, and
// the RA marks attendance. Incidents are bounded: category, building and general area, a short description, no resident names;
// an RA sees only reports they filed; housing staff triage them, and a report is closed by staff other than its filer with an
// outcome. Append-only history.
export const RLF_MIGRATION: string[] = [
  `CREATE TABLE IF NOT EXISTS rlf_checkins (id bigserial PRIMARY KEY, tenant_id text NOT NULL, ra_id text NOT NULL, resident_id text NOT NULL, building text NOT NULL,
     outcome text NOT NULL CHECK (outcome IN ('ok','follow_up','referred')), referral text CHECK (referral IN ('advising','counseling','housing','financial_aid','disability_services')),
     note text NOT NULL DEFAULT '' CHECK (length(note) <= 500), at timestamptz NOT NULL DEFAULT clock_timestamp(), CHECK (ra_id <> resident_id),
     CHECK ((outcome = 'referred') = (referral IS NOT NULL)))`,
  `CREATE TABLE IF NOT EXISTS rlf_programs (id bigserial PRIMARY KEY, tenant_id text NOT NULL, building text NOT NULL, title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 120),
     description text NOT NULL DEFAULT '' CHECK (length(description) <= 2000), starts_at timestamptz NOT NULL, capacity int NOT NULL CHECK (capacity BETWEEN 1 AND 1000),
     budget_cents int NOT NULL DEFAULT 0 CHECK (budget_cents >= 0), proposed_by text NOT NULL, state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed','approved','declined','cancelled','held')),
     decided_by text, decision_note text NOT NULL DEFAULT '', version int NOT NULL DEFAULT 1, CHECK (decided_by IS NULL OR decided_by <> proposed_by))`,
  `CREATE TABLE IF NOT EXISTS rlf_rsvps (program_id bigint NOT NULL REFERENCES rlf_programs(id), resident_id text NOT NULL, attended boolean, marked_by text,
     PRIMARY KEY (program_id, resident_id), CHECK (marked_by IS NULL OR marked_by <> resident_id))`,
  `CREATE TABLE IF NOT EXISTS rlf_incidents (id bigserial PRIMARY KEY, tenant_id text NOT NULL, filed_by text NOT NULL, building text NOT NULL, area text NOT NULL CHECK (length(trim(area)) BETWEEN 2 AND 80),
     category text NOT NULL CHECK (category IN ('noise','facilities_safety','policy','roommate','wellbeing_concern','emergency_followup')),
     occurred_at timestamptz NOT NULL, description text NOT NULL CHECK (length(trim(description)) BETWEEN 10 AND 1000),
     state text NOT NULL DEFAULT 'filed' CHECK (state IN ('filed','acknowledged','referred','closed')), handled_by text, outcome text NOT NULL DEFAULT '', version int NOT NULL DEFAULT 1,
     CHECK (state <> 'closed' OR (handled_by IS NOT NULL AND handled_by <> filed_by AND length(trim(outcome)) >= 5)))`,
  `CREATE TABLE IF NOT EXISTS rlf_events (id bigserial PRIMARY KEY, tenant_id text NOT NULL, subject text NOT NULL, ref text, step text NOT NULL, actor_id text NOT NULL, at timestamptz NOT NULL DEFAULT clock_timestamp())`,
  `CREATE OR REPLACE FUNCTION rlf_refuse_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY' USING ERRCODE = '42501'; END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rlf_events_append_only') THEN
       CREATE TRIGGER rlf_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON rlf_events FOR EACH STATEMENT EXECUTE FUNCTION rlf_refuse_change(); END IF;
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'rlf_checkins_append_only') THEN
       CREATE TRIGGER rlf_checkins_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON rlf_checkins FOR EACH STATEMENT EXECUTE FUNCTION rlf_refuse_change(); END IF;
   END $$`,
  `CREATE OR REPLACE FUNCTION rlf_ra_building(p_tenant text, p_user text) RETURNS text LANGUAGE sql STABLE AS $$
     SELECT building FROM hsg_staff WHERE tenant_id = p_tenant AND user_id = p_user AND kind = 'ra' AND revoked_at IS NULL $$`,
  `CREATE OR REPLACE FUNCTION rlf_resident_building(p_tenant text, p_user text) RETURNS text LANGUAGE sql STABLE AS $$
     SELECT r.building FROM hsg_apps a JOIN hsg_rooms r ON r.id = a.room_id WHERE a.tenant_id = p_tenant AND a.student_id = p_user AND a.state = 'moved_in' ORDER BY a.updated_at DESC LIMIT 1 $$`,
  `CREATE OR REPLACE FUNCTION rlf_log(p_tenant text, p_subject text, p_ref text, p_step text, p_actor text) RETURNS void LANGUAGE sql AS $$
     INSERT INTO rlf_events (tenant_id, subject, ref, step, actor_id) VALUES (p_tenant, p_subject, p_ref, p_step, p_actor) $$`,
  `CREATE OR REPLACE FUNCTION rlf_checkin(p_actor text, p_tenant text, p_resident text, p_outcome text, p_referral text, p_note text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE b text := rlf_ra_building(p_tenant, p_actor);
   BEGIN
     IF b IS NULL THEN RETURN 'Only resident assistants log check-ins.'; END IF;
     IF p_actor = p_resident THEN RETURN 'Check-ins are with your residents.'; END IF;
     IF rlf_resident_building(p_tenant, p_resident) IS DISTINCT FROM b THEN RETURN 'That student does not live in your building.'; END IF;
     IF (p_outcome = 'referred') <> (p_referral IS NOT NULL) THEN RETURN 'Choose a service when you refer, and only then.'; END IF;
     INSERT INTO rlf_checkins (tenant_id, ra_id, resident_id, building, outcome, referral, note) VALUES (p_tenant, p_actor, p_resident, b, p_outcome, p_referral, coalesce(p_note, ''));
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rlf_propose(p_actor text, p_tenant text, p_title text, p_desc text, p_starts timestamptz, p_capacity int, p_budget int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE b text := rlf_ra_building(p_tenant, p_actor); v_id bigint;
   BEGIN
     IF b IS NULL THEN RETURN 'Only resident assistants propose building programs.'; END IF;
     IF p_starts <= now() THEN RETURN 'Choose a time in the future.'; END IF;
     INSERT INTO rlf_programs (tenant_id, building, title, description, starts_at, capacity, budget_cents, proposed_by) VALUES (p_tenant, b, trim(p_title), coalesce(p_desc, ''), p_starts, p_capacity, coalesce(p_budget, 0), p_actor) RETURNING id INTO v_id;
     PERFORM rlf_log(p_tenant, 'program', v_id::text, 'propose', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION rlf_program_step(p_actor text, p_tenant text, p_id bigint, p_step text, p_note text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE p rlf_programs; staff boolean := hsg_kind(p_tenant, p_actor) = 'staff';
   BEGIN
     SELECT * INTO p FROM rlf_programs WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF p.id IS NULL THEN RETURN 'Program not found.'; END IF;
     IF p.version <> p_version THEN RETURN 'This program changed since you opened it. Reload and try again.'; END IF;
     IF p_step IN ('approve','decline') THEN
       IF NOT coalesce(staff, false) THEN RETURN 'Only housing staff approve programs.'; END IF;
       IF p_actor = p.proposed_by THEN RETURN 'Someone else approves your program.'; END IF;
       IF p.state <> 'proposed' THEN RETURN 'Only proposed programs are decided.'; END IF;
       IF p_step = 'decline' AND length(trim(coalesce(p_note, ''))) < 5 THEN RETURN 'Give the reason.'; END IF;
       UPDATE rlf_programs SET state = CASE WHEN p_step = 'approve' THEN 'approved' ELSE 'declined' END, decided_by = p_actor, decision_note = coalesce(p_note, ''), version = version + 1 WHERE id = p_id;
     ELSIF p_step IN ('cancel','held') THEN
       IF p_actor <> p.proposed_by AND NOT coalesce(staff, false) THEN RETURN 'Only the proposing RA or housing staff do this.'; END IF;
       IF p.state NOT IN ('proposed','approved') THEN RETURN 'This program is already finished.'; END IF;
       IF p_step = 'held' AND p.state <> 'approved' THEN RETURN 'Only approved programs are held.'; END IF;
       UPDATE rlf_programs SET state = CASE WHEN p_step = 'held' THEN 'held' ELSE 'cancelled' END, version = version + 1 WHERE id = p_id;
     ELSE RETURN 'Unknown step.'; END IF;
     PERFORM rlf_log(p_tenant, 'program', p_id::text, p_step, p_actor);
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rlf_rsvp(p_actor text, p_tenant text, p_id bigint, p_on boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE p rlf_programs;
   BEGIN
     SELECT * INTO p FROM rlf_programs WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF p.id IS NULL OR p.state <> 'approved' THEN RETURN 'This program is not open for RSVPs.'; END IF;
     IF NOT p_on THEN DELETE FROM rlf_rsvps WHERE program_id = p_id AND resident_id = p_actor AND attended IS NULL; RETURN NULL; END IF;
     IF rlf_resident_building(p_tenant, p_actor) IS DISTINCT FROM p.building THEN RETURN 'This program is for residents of ' || p.building || '.'; END IF;
     IF p.starts_at <= now() THEN RETURN 'This program has started.'; END IF;
     IF (SELECT count(*) FROM rlf_rsvps WHERE program_id = p_id) >= p.capacity THEN RETURN 'This program is full.'; END IF;
     INSERT INTO rlf_rsvps (program_id, resident_id) VALUES (p_id, p_actor) ON CONFLICT DO NOTHING;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rlf_attend(p_actor text, p_tenant text, p_id bigint, p_resident text, p_attended boolean) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE p rlf_programs;
   BEGIN
     SELECT * INTO p FROM rlf_programs WHERE id = p_id AND tenant_id = p_tenant;
     IF p.id IS NULL THEN RETURN 'Program not found.'; END IF;
     IF p_actor <> p.proposed_by THEN RETURN 'The RA running the program marks attendance.'; END IF;
     IF p_actor = p_resident THEN RETURN 'Someone else marks your own attendance.'; END IF;
     UPDATE rlf_rsvps SET attended = p_attended, marked_by = p_actor WHERE program_id = p_id AND resident_id = p_resident;
     IF NOT FOUND THEN RETURN 'That resident did not RSVP.'; END IF;
     RETURN NULL;
   END $$`,
  `CREATE OR REPLACE FUNCTION rlf_report(p_actor text, p_tenant text, p_area text, p_category text, p_occurred timestamptz, p_desc text, p_building text) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE k text := hsg_kind(p_tenant, p_actor); b text; v_id bigint;
   BEGIN
     IF k IS NULL THEN RETURN 'Only resident assistants and housing staff file incident reports.'; END IF;
     b := CASE WHEN k = 'ra' THEN rlf_ra_building(p_tenant, p_actor) ELSE trim(coalesce(p_building, '')) END;
     IF length(coalesce(b, '')) = 0 THEN RETURN 'Name the building.'; END IF;
     IF p_occurred > now() THEN RETURN 'The time cannot be in the future.'; END IF;
     INSERT INTO rlf_incidents (tenant_id, filed_by, building, area, category, occurred_at, description) VALUES (p_tenant, p_actor, b, trim(p_area), p_category, p_occurred, trim(p_desc)) RETURNING id INTO v_id;
     PERFORM rlf_log(p_tenant, 'incident', v_id::text, 'file', p_actor);
     RETURN 'ok:' || v_id;
   END $$`,
  `CREATE OR REPLACE FUNCTION rlf_incident_step(p_actor text, p_tenant text, p_id bigint, p_step text, p_text text, p_version int) RETURNS text LANGUAGE plpgsql AS $$
   DECLARE i rlf_incidents;
   BEGIN
     IF hsg_kind(p_tenant, p_actor) IS DISTINCT FROM 'staff' THEN RETURN 'Only housing staff triage incident reports.'; END IF;
     SELECT * INTO i FROM rlf_incidents WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
     IF i.id IS NULL THEN RETURN 'Report not found.'; END IF;
     IF i.version <> p_version THEN RETURN 'This report changed since you opened it. Reload and try again.'; END IF;
     IF i.state = 'closed' THEN RETURN 'This report is closed.'; END IF;
     IF p_actor = i.filed_by THEN RETURN 'Someone other than the filer handles this report.'; END IF;
     IF p_step = 'acknowledge' THEN UPDATE rlf_incidents SET state = 'acknowledged', handled_by = p_actor, version = version + 1 WHERE id = p_id;
     ELSIF p_step = 'refer' THEN
       IF length(trim(coalesce(p_text, ''))) < 5 THEN RETURN 'Name where it was referred.'; END IF;
       UPDATE rlf_incidents SET state = 'referred', handled_by = p_actor, outcome = trim(p_text), version = version + 1 WHERE id = p_id;
     ELSIF p_step = 'close' THEN
       IF length(trim(coalesce(p_text, ''))) < 5 THEN RETURN 'Record the outcome.'; END IF;
       UPDATE rlf_incidents SET state = 'closed', handled_by = p_actor, outcome = trim(p_text), version = version + 1 WHERE id = p_id;
     ELSE RETURN 'Unknown step.'; END IF;
     PERFORM rlf_log(p_tenant, 'incident', p_id::text, p_step, p_actor);
     RETURN NULL;
   END $$`,
];
