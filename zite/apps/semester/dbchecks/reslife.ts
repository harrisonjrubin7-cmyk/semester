import { neon } from '@neondatabase/serverless';
import { HSG_MIGRATION } from '../src/lib/hsgMigration';
import { RLF_MIGRATION } from '../src/lib/rlfMigration';

// Residents are seeded directly into hsg_apps as moved_in (the housing flow itself is covered by dbchecks/housing).
export const CHECKS = `DO $$
DECLARE r text; x text; ra bigint; rb bigint; p bigint; i bigint; v int; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  PERFORM hsg_set_staff('adm','t1','hs1','staff',''); PERFORM hsg_set_staff('adm','t1','hs2','staff','');
  PERFORM hsg_set_staff('adm','t1','ra1','ra','North'); PERFORM hsg_set_staff('adm','t1','ra2','ra','South');
  INSERT INTO hsg_rooms (tenant_id, building, room, capacity) VALUES ('t1','North','101',2) RETURNING id INTO ra;
  INSERT INTO hsg_rooms (tenant_id, building, room, capacity) VALUES ('t1','South','201',2) RETURNING id INTO rb;
  INSERT INTO hsg_apps (tenant_id, request_key, student_id, term, state, room_id, contract_hash) VALUES
    ('t1','k1','n1','F26','moved_in',ra,'h'), ('t1','k2','n2','F26','moved_in',ra,'h'), ('t1','k3','s1','F26','moved_in',rb,'h'), ('t1','k4','n3','F26','accepted',ra,'h');
  -- check-ins
  INSERT INTO rr VALUES (rlf_checkin('hs1','t1','n1','ok',NULL,'') = 'Only resident assistants log check-ins.', 'R1 RAs only');
  INSERT INTO rr VALUES (rlf_checkin('ra1','t1','s1','ok',NULL,'') = 'That student does not live in your building.', 'R2 own building only');
  INSERT INTO rr VALUES (rlf_checkin('ra1','t1','n3','ok',NULL,'') = 'That student does not live in your building.', 'R3 only moved-in residents');
  INSERT INTO rr VALUES (rlf_checkin('ra1','t1','n1','referred',NULL,'') LIKE 'Choose a service%', 'R4 referral needs a service');
  INSERT INTO rr VALUES (rlf_checkin('ra1','t1','n1','referred','counseling','Asked about support') IS NULL, 'R5 check-in with referral');
  -- programs
  INSERT INTO rr VALUES (rlf_propose('n1','t1','Study night','',now()+interval '2 days',1,0) LIKE 'Only resident assistants%', 'R6 RAs propose');
  r := rlf_propose('ra1','t1','Study night','Snacks and quiet floors',now()+interval '2 days',1,2500); p := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (rlf_rsvp('n1','t1',p,true) = 'This program is not open for RSVPs.', 'R7 no RSVP before approval');
  SELECT version INTO v FROM rlf_programs WHERE id = p;
  INSERT INTO rr VALUES (rlf_program_step('ra2','t1',p,'approve','',v) = 'Only housing staff approve programs.', 'R8 staff approve');
  x := rlf_program_step('hs1','t1',p,'approve','',v);
  INSERT INTO rr VALUES (x IS NULL, 'R9 approved');
  INSERT INTO rr VALUES (rlf_rsvp('s1','t1',p,true) = 'This program is for residents of North.', 'R10 building residents only');
  PERFORM rlf_rsvp('n1','t1',p,true);
  INSERT INTO rr VALUES (rlf_rsvp('n2','t1',p,true) = 'This program is full.', 'R11 capacity');
  INSERT INTO rr VALUES (rlf_attend('ra2','t1',p,'n1',true) = 'The RA running the program marks attendance.', 'R12 running RA marks attendance');
  INSERT INTO rr VALUES (rlf_attend('ra1','t1',p,'n1',true) IS NULL, 'R13 attendance marked');
  -- incidents
  INSERT INTO rr VALUES (rlf_report('n1','t1','Floor 1 lounge','noise',now()-interval '1 hour','Loud music after quiet hours','') LIKE 'Only resident assistants%', 'R14 residents cannot file');
  INSERT INTO rr VALUES (rlf_report('ra1','t1','Lounge','noise',now()+interval '1 hour','Loud music after quiet hours','') = 'The time cannot be in the future.', 'R15 no future time');
  r := rlf_report('ra1','t1','Floor 1 lounge','noise',now()-interval '1 hour','Loud music after quiet hours','South'); i := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES ((SELECT building = 'North' FROM rlf_incidents WHERE id = i), 'R16 RA reports pinned to their building');
  SELECT version INTO v FROM rlf_incidents WHERE id = i;
  INSERT INTO rr VALUES (rlf_incident_step('ra2','t1',i,'acknowledge','',v) = 'Only housing staff triage incident reports.', 'R17 staff triage');
  INSERT INTO rr VALUES (rlf_incident_step('hs1','t1',i,'close','',v) = 'Record the outcome.', 'R18 close needs an outcome');
  x := rlf_incident_step('hs1','t1',i,'close','Spoke with residents; resolved',v);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT state = 'closed' FROM rlf_incidents WHERE id = i), 'R19 closed by staff');
  r := rlf_report('hs1','t1','Stairwell B','facilities_safety',now()-interval '2 hours','Propped fire door on floor 2','North'); i := split_part(r,':',2)::bigint;
  SELECT version INTO v FROM rlf_incidents WHERE id = i;
  INSERT INTO rr VALUES (rlf_incident_step('hs1','t1',i,'close','Door closed and alarm reset',v) = 'Someone other than the filer handles this report.', 'R20 filer cannot close own report');
  -- table guards
  got := false; BEGIN UPDATE rlf_programs SET decided_by = proposed_by WHERE id = p; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'R21 table refuses self-approval');
  got := false; BEGIN DELETE FROM rlf_checkins; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'R22 check-ins append-only');
  got := false; BEGIN UPDATE rlf_incidents SET state = 'closed', handled_by = filed_by, outcome = 'self closed' WHERE id = i; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'R23 table refuses self-close');
  SELECT string_agg(lbl, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...HSG_MIGRATION.map((q) => sql.query(q)), ...RLF_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('rlf_incidents') AS t`)));
}
