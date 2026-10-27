import { neon } from '@neondatabase/serverless';
import { FA_MIGRATION } from '../src/lib/faMigration';
import { FA_OFFICE_MIGRATION } from '../src/lib/faOfficeMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; d1 bigint; d2 bigint; a1 bigint; a2 bigint; a3 bigint; ap bigint; v int; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  PERFORM fa_set_staff('adm','t1','o1',true); PERFORM fa_set_staff('adm','t1','o2',true);
  -- documents by reference
  INSERT INTO rr VALUES (fa_doc_request('stu','t1','stu','F26','tax_return',true) LIKE 'Only aid office staff%', 'F1 only staff request documents');
  PERFORM fa_doc_request('o1','t1','stu','F26','tax_return',true); PERFORM fa_doc_request('o1','t1','stu','F26','verification_worksheet',true);
  SELECT id INTO d1 FROM fa_docs WHERE student_id = 'stu' AND kind = 'tax_return'; SELECT id INTO d2 FROM fa_docs WHERE student_id = 'stu' AND kind = 'verification_worksheet';
  INSERT INTO rr VALUES (fa_doc_step('stu','t1',d1,'received','','') LIKE 'Give the reference the aid system issued%', 'F2 received needs an aid-system reference, never a file');
  PERFORM fa_doc_step('stu','t1',d1,'received','AID-77','');
  INSERT INTO rr VALUES (fa_doc_step('other','t1',d1,'received','AID-1','') = 'Document not found.', 'F3 other students cannot touch the document');
  PERFORM fa_doc_step('o1','t1',d1,'accept','','');
  INSERT INTO rr VALUES (fa_set_eligibility('o1','t1','stu','F26',3000000,500000,'full','ISIR-1',0) LIKE 'Every required document must be accepted%', 'F4 eligibility waits for verification');
  PERFORM fa_doc_step('stu','t1',d2,'received','AID-78',''); PERFORM fa_doc_step('o2','t1',d2,'accept','','');
  INSERT INTO rr VALUES (fa_set_eligibility('o1','t1','stu','F26',3000000,500000,'full','ISIR-1',0) IS NULL, 'F5 eligibility recorded');
  INSERT INTO rr VALUES (fa_need_left('t1','stu','F26') = 2500000, 'F6 need = COA - SAI');
  -- funds and awards
  PERFORM fa_set_fund('adm','t1','INST-GRANT','Institutional grant',true,2000000); PERFORM fa_set_fund('adm','t1','MERIT','Merit scholarship',false,100000);
  INSERT INTO rr VALUES (fa_award_propose('o1','t1','stu','F26','INST-GRANT',2600000,'k1') LIKE 'This exceeds the student''s remaining need%', 'F7 need cap');
  r := fa_award_propose('o1','t1','stu','F26','INST-GRANT',1500000,'k1'); a1 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (fa_award_propose('o1','t1','stu','F26','INST-GRANT',1500000,'k1') = 'replay:' || a1, 'F8 idempotent proposal');
  INSERT INTO rr VALUES (fa_award_step('o1','t1',a1,'approve','','') = 'A different officer approves the award.', 'F9 proposer cannot approve');
  PERFORM fa_award_step('o2','t1',a1,'approve','','');
  r := fa_award_propose('o1','t1','stu','F26','INST-GRANT',900000,'k2'); a2 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (fa_award_step('o2','t1',a2,'approve','','') LIKE 'The INST-GRANT fund does not have enough%', 'F10 fund budget');
  INSERT INTO rr VALUES (fa_award_step('stu','t1',a1,'accept','','') = 'This award is not waiting for your response.', 'F11 no acceptance before offer');
  INSERT INTO rr VALUES (fa_award_step('o2','t1',a1,'offer','','') LIKE 'Record the aid-system reference%', 'F12 offer needs aid-system reference');
  PERFORM fa_award_step('o2','t1',a1,'offer','PKG-1','');
  INSERT INTO rr VALUES (fa_award_step('o1','t1',a1,'accept','','') = 'Only the student responds to their award.', 'F13 only the student accepts');
  PERFORM fa_award_step('stu','t1',a1,'accept','','');
  -- SAP and appeals
  PERFORM fa_sap('o1','t1','stu','F26','ineligible','GPA 1.4 below 2.0 minimum');
  INSERT INTO rr VALUES (fa_award_propose('o2','t1','stu','F26','MERIT',50000,'k3') LIKE 'The student is not meeting academic progress%', 'F14 SAP-ineligible gets no new award');
  r := fa_appeal('stu','t1','F26','sap','Medical leave in spring; documented by my physician and the dean.'); ap := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (fa_appeal_decide('o1','t1',ap,true,'Granted with academic plan') LIKE 'Someone other than whoever made the original decision%', 'F15 original decider cannot decide the appeal');
  x := fa_appeal_decide('o2','t1',ap,true,'Granted with an academic plan reviewed each term');
  INSERT INTO rr VALUES (x IS NULL AND (SELECT sap = 'probation' FROM fa_eligibility WHERE student_id = 'stu'), 'F16 granted appeal restores eligibility on probation');
  r := fa_award_propose('o2','t1','stu','F26','MERIT',50000,'k3'); a3 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'F17 award possible after appeal');
  -- table guards
  got := false; BEGIN UPDATE fa_awards SET state = 'approved', approved_by = proposed_by WHERE id = a3; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F18 table refuses self-approval');
  got := false; BEGIN UPDATE fa_docs SET state = 'accepted', reviewed_by = 'stu' WHERE id = d1; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F19 table refuses self-review of documents');
  got := false; BEGIN UPDATE fa_appeals SET state = 'granted', decided_by = original_by WHERE id = ap; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F20 table refuses the original decider on appeal');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...FA_MIGRATION, ...FA_OFFICE_MIGRATION].map((q) => sql.query(q)).concat([sql.query(CHECKS)])); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('fa_awards') AS t`)));
}
