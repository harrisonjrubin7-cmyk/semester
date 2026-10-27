import { neon } from '@neondatabase/serverless';
import { PRV_MIGRATION } from '../src/lib/prvMigration';

// Records-rights requests (APP-013) with the S-76 E31 extension. Runs in a transaction that always raises RESULT.
export const CHECKS = `DO $$
DECLARE r text; x text; v int; i1 bigint; i2 bigint; h bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  PERFORM prv_set_staff('adm','t1','o1',true); PERFORM prv_set_staff('adm','t1','o2',true);
  -- existing behaviour (control)
  INSERT INTO rr VALUES (prv_submit('s1','t1','rq-insp-1','inspect','Please let me see my advising file') IS NULL, 'F1 submit inspect');
  INSERT INTO rr VALUES (prv_handle('s1','t1','rq-insp-1',1,'acknowledge','') IS NOT NULL, 'F2 students cannot handle requests');
  -- inspect: cannot fulfil without an approved response
  INSERT INTO rr VALUES (prv_handle('o1','t1','rq-insp-1',1,'fulfill','Here is your advising file') LIKE 'An inspect request is fulfilled with a response another%', 'F3 no fulfilment without an approved response');
  r := prv_route('o1','t1','rq-insp-1','Advising','Advising notes 2025-26','adv'); i1 := NULLIF(split_part(r,':',2),'')::bigint;
  r := prv_route('o1','t1','rq-insp-1','Registrar','Enrollment history','reg'); i2 := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (prv_route('o1','t1','rq-insp-1','Self','Own','s1') LIKE 'Route to the record owner%', 'F4 never route to the student');
  INSERT INTO rr VALUES (prv_prepare('o1','t1','rq-insp-1') LIKE 'Some records have not been collected%', 'F5 prepare needs collection');
  INSERT INTO rr VALUES (prv_collect('stranger','t1',i1,'Found it',false) = 'Record not found.', 'F6 only the owner collects');
  PERFORM prv_collect('adv','t1',i1,'Two notes in advising system',true); PERFORM prv_collect('reg','t1',i2,'Exported from SIS',false);
  INSERT INTO rr VALUES (prv_decide_item('o1','t1',i1,'release','','') LIKE 'This record mentions another person%', 'F7 mixed-person record not released plainly');
  INSERT INTO rr VALUES (prv_decide_item('o1','t1',i1,'withhold','no','') LIKE 'Give the reason%', 'F8 withholding needs a reason');
  PERFORM prv_decide_item('o1','t1',i1,'redact','','Your advising notes; roommate name removed');
  PERFORM prv_decide_item('o1','t1',i2,'release','','');
  INSERT INTO rr VALUES (prv_prepare('o1','t1','rq-insp-1') IS NULL, 'F9 prepare');
  INSERT INTO rr VALUES (prv_approve('o1','t1','rq-insp-1') = 'Another office member approves a response you prepared.', 'F10 preparer cannot approve');
  INSERT INTO rr VALUES (prv_approve('o2','t1','rq-insp-1') IS NULL, 'F11 second member approves');
  PERFORM prv_decide_item('o1','t1',i2,'withhold','Exam scripts are excluded by testing policy','');
  INSERT INTO rr VALUES (NOT EXISTS (SELECT 1 FROM prv_responses WHERE request_id = 'rq-insp-1'), 'F12 a changed decision withdraws the approval');
  SELECT version INTO v FROM prv_requests WHERE id = 'rq-insp-1';
  INSERT INTO rr VALUES (prv_handle('o1','t1','rq-insp-1',v,'fulfill','Here is your file') LIKE 'An inspect request is fulfilled%', 'F13 still cannot fulfil');
  PERFORM prv_prepare('o1','t1','rq-insp-1'); PERFORM prv_approve('o2','t1','rq-insp-1');
  SELECT version INTO v FROM prv_requests WHERE id = 'rq-insp-1';
  x := prv_handle('o1','t1','rq-insp-1',v,'fulfill','Your response is ready to open');
  INSERT INTO rr VALUES (x IS NULL, 'F14 fulfil with approved response ' || coalesce(x,''));
  INSERT INTO rr VALUES (prv_view('s2','t1','rq-insp-1') = 'There is no response to open yet.', 'F15a others cannot open it');
  INSERT INTO rr VALUES (prv_view('s1','t1','rq-insp-1') IS NULL, 'F15b student opens it');
  UPDATE prv_responses SET delivered_at = now() - interval '15 days' WHERE request_id = 'rq-insp-1';
  INSERT INTO rr VALUES (prv_view('s1','t1','rq-insp-1') LIKE '%has expired%', 'F15c it expires after 14 days');
  -- amendment, hold, hearing
  PERFORM prv_submit('s3','t1','rq-amd-1','amend','My 2025 grade in ECON 101 is recorded wrongly');
  r := prv_hold('o1','t1','s3','Records preserved for a pending grievance'); h := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (prv_handle('o2','t1','rq-amd-1',1,'fulfill','Grade corrected per instructor') LIKE 'A records hold applies%', 'F16 no amendment under hold');
  INSERT INTO rr VALUES (prv_release('o1','t1',h,'Grievance resolved, preservation ended') LIKE 'Another office member%', 'F17a placer cannot release');
  x := prv_handle('o2','t1','rq-amd-1',1,'deny','The instructor confirmed the recorded grade');
  INSERT INTO rr VALUES (x IS NULL AND (SELECT outcome_note LIKE '%request a hearing%' FROM prv_requests WHERE id = 'rq-amd-1'), 'F18 denial tells the student about hearings ' || coalesce(x,''));
  INSERT INTO rr VALUES (prv_hearing_request('s3','t1','rq-amd-1','short') LIKE 'Explain why%', 'F19a hearing needs a reason');
  INSERT INTO rr VALUES (prv_hearing_request('s3','t1','rq-amd-1','The grade sheet shows 88, not 78 as recorded') IS NULL, 'F19b hearing requested');
  INSERT INTO rr VALUES (prv_hearing_decide('o2','t1','rq-amd-1','upheld','Checked the grade sheet again') LIKE 'Someone other than the person who denied%', 'F20 the denier cannot decide the hearing');
  INSERT INTO rr VALUES (prv_hearing_decide('o1','t1','rq-amd-1','amended','Grade sheet shows 88; amend record') LIKE 'A records hold applies%', 'F21 hearing cannot amend under hold');
  PERFORM prv_release('o2','t1',h,'Grievance resolved, preservation ended');
  INSERT INTO rr VALUES (prv_hearing_decide('o1','t1','rq-amd-1','amended','Grade sheet shows 88; amend record') IS NULL, 'F22 hearing decided after release');
  UPDATE prv_requests SET handled_at = now() - interval '31 days' WHERE id = 'rq-amd-1';
  -- table guards
  got := false; BEGIN UPDATE prv_items SET decision = 'release' WHERE id = i1; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F23 third-party release refused (table)');
  got := false; BEGIN UPDATE prv_responses SET approved_by = prepared_by WHERE request_id = 'rq-insp-1'; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F24 preparer never approver (table)');
  got := false; BEGIN UPDATE prv_hearings SET decided_by = denied_by WHERE request_id = 'rq-amd-1'; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F25 denier never decides hearing (table)');
  INSERT INTO rr VALUES (prv_route('o1','t2','rq-insp-1','X','Other tenant','z') = 'Only the records-privacy office routes records.' OR prv_route('o1','t2','rq-insp-1','X','Other tenant','z') = 'Request not found.', 'F26 other tenant');
  got := false; BEGIN DELETE FROM prv_events; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F27 history append-only');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const before = await sql.query(`SELECT to_regclass('prv_requests') AS t`);
  try { await sql.transaction([...PRV_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('prv_requests before:', JSON.stringify(before), 'prv_items after:', JSON.stringify(await sql.query(`SELECT to_regclass('prv_items') AS t`)));
}
