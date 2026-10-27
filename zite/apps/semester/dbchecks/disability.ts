import { neon } from '@neondatabase/serverless';
import { ACC_MIGRATION } from '../src/lib/accMigration';
import { DSA_MIGRATION } from '../src/lib/dsaMigration';

// Requests are seeded directly (submit/decide are covered by dbchecks/accommodations if present; here only dsa-001 rules).
export const CHECKS = `DO $$
DECLARE x text; d bigint; c bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO acc_staff (tenant_id, user_id, granted_by) VALUES ('t1','of1','adm'), ('t1','of2','adm'), ('t1','st9','adm');
  INSERT INTO acc_requests (id, tenant_id, student_id, category, description, state) VALUES
    ('q1','t1','st1','testing','Need extended time for timed exams', 'submitted'),
    ('q2','t1','st2','testing','Need extended time for timed exams', 'declined'),
    ('q3','t1','st9','testing','Need extended time for timed exams', 'submitted');
  UPDATE acc_requests SET decided_by = 'of1' WHERE id = 'q2';
  INSERT INTO rr VALUES (dsa_set_coord('adm','t1','adm',true) IS NOT NULL, 'D1 no self-grant');
  PERFORM dsa_set_coord('adm','t1','co1',true); PERFORM dsa_set_coord('adm','t1','st1',true);
  -- intake
  INSERT INTO rr VALUES (dsa_assign('co1','t1','q1','co1') = 'Only the accessibility office assigns intake.', 'D2 officers assign');
  INSERT INTO rr VALUES (dsa_assign('st9','t1','q3','co1') = 'Someone else handles your own request.', 'D3 officer cannot handle own request');
  INSERT INTO rr VALUES (dsa_assign('of1','t1','q1','st1') = 'A student cannot coordinate their own intake.', 'D4 student not their own coordinator');
  INSERT INTO rr VALUES (dsa_assign('of1','t1','q1','co1') IS NULL, 'D5 assigned');
  INSERT INTO rr VALUES (dsa_intake_step('co2','t1','q1','schedule',now()+interval '1 day') LIKE 'Only the assigned coordinator%', 'D6 assigned coordinator only');
  INSERT INTO rr VALUES (dsa_intake_step('co1','t1','q1','held',NULL) = 'Schedule the meeting first.', 'D7 schedule before held');
  PERFORM dsa_intake_step('co1','t1','q1','schedule',now()+interval '1 day');
  INSERT INTO rr VALUES (dsa_intake_step('co1','t1','q1','held',NULL) IS NULL, 'D8 meeting held');
  -- documents
  PERFORM dsa_doc('co1','t1','q1',NULL,'provider_letter',NULL,''); SELECT id INTO d FROM dsa_docs WHERE request_id = 'q1';
  INSERT INTO rr VALUES (dsa_doc('co1','t1','q1',d,NULL,'verified','') LIKE 'Only an accessibility officer%', 'D9 coordinators cannot verify');
  INSERT INTO rr VALUES (dsa_doc('of1','t1','q1',d,NULL,'verified','') = 'Review a document after it is received.', 'D10 receive before review');
  PERFORM dsa_doc('co1','t1','q1',d,NULL,'received','Arrived by mail');
  INSERT INTO rr VALUES (dsa_doc('of1','t1','q1',d,NULL,'verified','') IS NULL, 'D11 officer verifies');
  INSERT INTO rr VALUES (dsa_doc('x9','t1','q1',NULL,'other',NULL,'') LIKE 'Only the office or the assigned coordinator%', 'D12 outsiders cannot track');
  -- appeals
  INSERT INTO rr VALUES (dsa_appeal('st1','t1','q1','The decision overlooked my testing schedule') = 'Appeal after the office decides.', 'D13 appeal after decision');
  INSERT INTO rr VALUES (dsa_appeal('st1','t1','q2','The decision overlooked my testing schedule') = 'Appeal your own request.', 'D14 own requests only');
  PERFORM dsa_appeal('st2','t1','q2','The decision overlooked my testing schedule');
  INSERT INTO rr VALUES (dsa_appeal('st2','t1','q2','Second appeal on the same grounds here') = 'This request was already appealed.', 'D15 one appeal');
  INSERT INTO rr VALUES (dsa_decide_appeal('of1','t1','q2','overturned',ARRAY['Extended time 1.5x'],'Schedule evidence now supports it',current_date+120) LIKE 'An officer who did not make%', 'D16 original decider excluded');
  INSERT INTO rr VALUES (dsa_decide_appeal('of2','t1','q2','overturned','{}','Schedule evidence now supports it',current_date+120) = 'List the arrangements that now apply.', 'D17 arrangements required');
  INSERT INTO rr VALUES (dsa_decide_appeal('of2','t1','q2','overturned',ARRAY['Extended time 1.5x'],'Schedule evidence now supports it',NULL) LIKE 'Set a future end date%', 'D17b end date required');
  x := dsa_decide_appeal('of2','t1','q2','overturned',ARRAY['Extended time 1.5x'],'Schedule evidence now supports it',current_date+120);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT state = 'approved' AND arrangements = ARRAY['Extended time 1.5x'] FROM acc_requests WHERE id = 'q2'), 'D18 overturned applies arrangements');
  -- implementation
  INSERT INTO acc_letters (request_id, section_id) VALUES ('q2','sec1');
  INSERT INTO rr VALUES (dsa_ack('in1','t1','q2','sec1',false) LIKE 'Only an instructor%', 'D19 instructors acknowledge');
  INSERT INTO rr VALUES (dsa_ack('in1','t1','q2','sec9',true) = 'There is no active letter for that section.', 'D20 active letter required');
  INSERT INTO rr VALUES (dsa_ack('in1','t1','q2','sec1',true) IS NULL, 'D21 acknowledged');
  INSERT INTO rr VALUES (dsa_check('co1','t1','q2','sec1',false,'') = 'Say what was not delivered.', 'D22 not-delivered needs detail');
  PERFORM dsa_check('co1','t1','q2','sec1',false,'Exam 2 given without extra time'); SELECT id INTO c FROM dsa_checks WHERE request_id = 'q2';
  INSERT INTO rr VALUES ((SELECT flagged FROM dsa_checks WHERE id = c), 'D23 flagged');
  INSERT INTO rr VALUES (dsa_clear_flag('co1','t1',c) LIKE 'Only an accessibility officer%', 'D24 officers clear flags');
  INSERT INTO rr VALUES (dsa_clear_flag('of1','t1',c) IS NULL, 'D25 flag cleared');
  -- accommodation core (acc-001): decisions, letters, instructor view
  INSERT INTO rr VALUES (acc_decide('co1','t1','q1',1,'approve',ARRAY['Extended time'],'',current_date+90) LIKE 'Only the accessibility office%', 'A1 office decides');
  INSERT INTO rr VALUES (acc_decide('st9','t1','q3',1,'approve',ARRAY['Extended time'],'',current_date+90) = 'You cannot decide your own request.', 'A2 no self-decision');
  INSERT INTO rr VALUES (acc_decide('of1','t1','q1',1,'approve','{}','',current_date+90) LIKE 'List at least one arrangement%', 'A3 arrangements required');
  INSERT INTO rr VALUES (acc_decide('of1','t1','q1',1,'approve',ARRAY['Extended time'],'',current_date-1) LIKE 'Set a future end date%', 'A4 future end date');
  INSERT INTO rr VALUES (acc_decide('of1','t1','q1',9,'approve',ARRAY['Extended time'],'',current_date+90) LIKE 'This request changed%', 'A5 stale version');
  x := acc_decide('of1','t1','q1',1,'approve',ARRAY['Extended time 1.5x'],'',current_date+90);
  INSERT INTO rr VALUES (x IS NULL, 'A6 approved');
  INSERT INTO rr VALUES (acc_letter('st2','t1','q1','sec2',true) = 'Request not found.', 'A7 only the student sends letters');
  PERFORM acc_letter('st1','t1','q1','sec2',true);
  INSERT INTO rr VALUES ((SELECT count(*) FROM acc_instructor_letters('t1',ARRAY['sec2'])) = 1 AND (SELECT count(*) FROM acc_instructor_letters('t1',ARRAY['sec3'])) = 0, 'A8 instructors see only their sections');
  INSERT INTO rr VALUES ((SELECT count(*) FROM acc_instructor_letters('t1',ARRAY['sec1'])) = 1, 'A9 overturned appeal reaches instructors');
  PERFORM acc_letter('st1','t1','q1','sec2',false);
  INSERT INTO rr VALUES ((SELECT count(*) FROM acc_instructor_letters('t1',ARRAY['sec2'])) = 0, 'A10 withdrawn letter disappears');
  -- table guards
  got := false; BEGIN UPDATE dsa_appeals SET state = 'upheld', decided_by = original_decider WHERE request_id = 'q2'; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'D26 table refuses original decider');
  got := false; BEGIN DELETE FROM dsa_events; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'D27 history append-only');
  SELECT string_agg(lbl, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...ACC_MIGRATION.map((q) => sql.query(q)), ...DSA_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('dsa_intake') AS t`)));
}
