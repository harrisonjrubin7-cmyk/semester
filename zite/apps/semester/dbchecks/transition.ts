import { neon } from '@neondatabase/serverless';
import { TRN_MIGRATION } from '../src/lib/trnMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; c bigint; it bigint; it2 bigint; b bigint; s bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  INSERT INTO rr VALUES (trn_set_staff('adm','t1','adm','first_year',true) IS NOT NULL, 'F1 no self-grant');
  PERFORM trn_set_staff('adm','t1','fy','first_year',true); PERFORM trn_set_staff('adm','t1','fy2','first_year',true);
  PERFORM trn_set_staff('adm','t1','ol','leader',true); PERFORM trn_set_staff('adm','t1','ol2','leader',true); PERFORM trn_set_staff('adm','t1','adx','admissions',true);
  INSERT INTO rr VALUES (trn_cohort('ol','t1','First-gen scholars','F26',ARRAY['s1']) LIKE 'Only first-year staff%', 'F2 leaders do not build cohorts');
  r := trn_cohort('fy','t1','First-gen scholars','F26',ARRAY['s1','s2','fy']); c := split_part(r,':',2)::bigint;
  PERFORM trn_item('fy','t1',c,'Meet your advisor',current_date+14,true); PERFORM trn_item('fy','t1',c,'Read the handbook',NULL,false);
  SELECT id INTO it FROM trn_items WHERE cohort_id = c AND needs_verification; SELECT id INTO it2 FROM trn_items WHERE cohort_id = c AND NOT needs_verification;
  INSERT INTO rr VALUES (trn_mark('fy','t1',it,'s1','done') = 'Students mark their own items.', 'F3 only the student marks done');
  INSERT INTO rr VALUES (trn_mark('fy','t1',it,'s1','verify') LIKE 'The student has not marked%', 'F4 no verification before the student marks it');
  PERFORM trn_mark('s1','t1',it,'s1','done');
  INSERT INTO rr VALUES (trn_mark('s1','t1',it,'s1','verify') = 'Only first-year staff verify.', 'F5 students cannot verify');
  PERFORM trn_mark('fy','t1',it,'fy','done');
  INSERT INTO rr VALUES (trn_mark('fy','t1',it,'fy','verify') = 'Someone else verifies your own item.', 'F6 no self-verification');
  INSERT INTO rr VALUES (trn_mark('fy','t1',it,'s1','verify') IS NULL, 'F7 staff verify');
  INSERT INTO rr VALUES (trn_mark('out','t1',it,'out','done') = 'Checklist item not found.', 'F8 only cohort members');
  -- outreach and blockers
  INSERT INTO rr VALUES (trn_outreach_log('fy','t1','s2','call','Left voicemail about advising','no_response') IS NULL, 'F9 outreach logged');
  INSERT INTO rr VALUES (trn_outreach_log('s1','t1','s2','call','Hello there','reached') LIKE 'Only first-year staff%', 'F10 students cannot log outreach');
  INSERT INTO rr VALUES (trn_blocker('s1','t1','s2','housing','Room not assigned') LIKE 'Raise blockers for yourself%', 'F11 no blockers for other students');
  r := trn_blocker('s2','t1','s2','registration','Cannot register: hold on account'); b := split_part(r,':',2)::bigint;
  PERFORM trn_blocker_step('ol','t1',b,'escalate','');
  INSERT INTO rr VALUES (trn_blocker_step('ol','t1',b,'resolve','Fixed it') = 'First-year staff resolve blockers.', 'F12 leaders escalate, not resolve');
  x := trn_blocker_step('fy','t1',b,'resolve','Hold released by bursar');
  INSERT INTO rr VALUES (x IS NULL AND (SELECT escalated AND state = 'resolved' FROM trn_blockers WHERE id = b), 'F13 staff resolve');
  -- orientation sessions
  INSERT INTO rr VALUES (trn_session('fy','t1','Orientation A',now()+interval '3 days','Hall',1,ARRAY['s1']) LIKE 'Assign people who hold the orientation-leader role%', 'F14 only leaders assigned');
  r := trn_session('fy','t1','Orientation A',now()+interval '3 days','Hall',1,ARRAY['ol']); s := split_part(r,':',2)::bigint;
  PERFORM trn_register('s1','t1',s,true);
  INSERT INTO rr VALUES (trn_register('s2','t1',s,true) = 'This session is full.', 'F15 capacity');
  INSERT INTO rr VALUES (trn_attend('ol2','t1',s,'s1',true) LIKE 'Only a leader assigned%', 'F16 unassigned leader cannot mark attendance');
  INSERT INTO rr VALUES (trn_attend('ol','t1',s,'s1',true) IS NULL, 'F17 assigned leader marks attendance');
  -- admitted student
  INSERT INTO rr VALUES (trn_deposit('adx','t1','s3','F26','DEP-1') LIKE 'The student has not confirmed%', 'F18 deposit after intent to enroll');
  PERFORM trn_intent('s3','t1','F26','enroll');
  INSERT INTO rr VALUES (trn_deposit('adx','t1','s3','F26','') LIKE 'Record the payment-system reference%', 'F19 deposit needs external reference');
  INSERT INTO rr VALUES (trn_deposit('adx','t1','s3','F26','DEP-1') IS NULL AND trn_deposit('adx','t1','s3','F26','DEP-2') = 'The deposit is already recorded.', 'F20 deposit recorded once');
  INSERT INTO rr VALUES (trn_placement('s3','t1','s3','Math','Calc I','ALEKS 82') LIKE 'Only admissions or first-year%', 'F21 no self-placement');
  INSERT INTO rr VALUES (trn_placement('adx','t1','s3','Math','Calc I','ALEKS 82') IS NULL, 'F22 placement recorded');
  -- belonging aggregate needs five students
  PERFORM trn_checkin('s1','t1','F26',4,'',false); PERFORM trn_checkin('s2','t1','F26',2,'',true); PERFORM trn_checkin('fy','t1','F26',5,'',false);
  INSERT INTO rr VALUES (trn_belonging(c) IS NULL, 'F25 no aggregate under five students');
  PERFORM trn_cohort('fy','t1','First-gen scholars','F26',ARRAY['s4','s5']); PERFORM trn_checkin('s4','t1','F26',3,'',false); PERFORM trn_checkin('s5','t1','F26',1,'',false);
  INSERT INTO rr VALUES (trn_belonging(c) = 3.00, 'F26 aggregate at five students');
  INSERT INTO rr VALUES (trn_checkin('s1','t1','F26',9,'',false) = 'Choose 1 to 5.', 'F27 score range');
  -- table guards
  got := false; BEGIN UPDATE trn_done SET verified_by = student_id WHERE item_id = it; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F23 table refuses self-verification');
  got := false; BEGIN DELETE FROM trn_outreach; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F24 outreach log append-only');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...TRN_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('trn_cohorts') AS t`)));
}
