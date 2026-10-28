import { neon } from '@neondatabase/serverless';
import { FIL_MIGRATION } from '../src/lib/filMigration';
import { SBM_MIGRATION } from '../src/lib/sbmMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; f1 uuid; f2 uuid; f3 uuid; code text; got boolean; ex bigint;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  f1 := fil_put('t1','stu1','essay.pdf','application/pdf','submission','\\x255044462d'::bytea);
  f2 := fil_put('t1','stu1','data.csv','text/csv','submission','\\x612c620a'::bytea);
  INSERT INTO rr VALUES (sbm_submit('stu1','t1','sub1','task1','sec1',true,now() + interval '1 day','key-00001') = 'Attach your work before submitting.', 'S1 an empty draft cannot be submitted');
  PERFORM fil_attach('t1','stu1',f1,'submission','sub1'); PERFORM fil_attach('t1','stu1',f2,'submission','sub1');
  -- 28 Oct: files must pass the safety screen before they can be submitted.
  INSERT INTO rr VALUES (sbm_submit('stu1','t1','sub1','task1','sec1',true,now() + interval '1 day','key-00001') LIKE 'The file "%" has not passed the safety check%', 'S0 an unscreened file blocks submission');
  PERFORM fil_record_scan('t1',f1,'clean','','semester-screen-1'); PERFORM fil_record_scan('t1',f2,'clean','','semester-screen-1');
  INSERT INTO rr VALUES (sbm_submit('stu2','t1','sub1','task1','sec1',false,NULL,'key-00002') LIKE 'You can only submit your own%', 'S2 only the owner submits');
  r := sbm_submit('stu1','t1','sub1','task1','sec1',true,now() + interval '1 day','key-00001'); code := split_part(r,':',2);
  INSERT INTO rr VALUES (r LIKE 'ok:%' AND length(code) = 10, 'S3 submit issues a receipt code');
  INSERT INTO rr VALUES ((SELECT jsonb_array_length(files) = 2 AND NOT late AND files::text LIKE '%essay.pdf%' AND files::text LIKE '%sha256%' FROM sbm_receipts WHERE receipt_code = code), 'S4 receipt lists each file with its SHA-256; on time');
  INSERT INTO rr VALUES ((SELECT bool_and(locked) FROM fil_attachments WHERE ref_id = 'sub1'), 'S5 files are locked in the same transaction');
  INSERT INTO rr VALUES (fil_detach('t1','stu1',f1,'submission','sub1') IS NOT NULL AND fil_delete('t1',f1,'stu1') LIKE 'This file is part of submitted work%', 'S6 submitted files cannot be removed or deleted');
  INSERT INTO rr VALUES (sbm_submit('stu1','t1','sub1','task1','sec1',true,NULL,'key-00001') = 'ok:' || code || ':replay', 'S7 a retried submit replays the same receipt');
  INSERT INTO rr VALUES (sbm_submit('stu1','t1','sub1','task1','sec1',true,NULL,'key-00003') = 'This work was already submitted.', 'S8 a second submit with a new key is refused');
  PERFORM fil_attach('t1','stu1',f1,'submission','sub2');
  INSERT INTO rr VALUES (sbm_submit('stu1','t1','sub2','task2','sec1',true,NULL,'key-00001') LIKE 'This request key was already used%', 'S9 a reused key for different work is refused');
  r := sbm_submit('stu1','t1','sub2','task2','sec1',true,now() - interval '2 hours','key-00004');
  INSERT INTO rr VALUES ((SELECT late AND late_seconds BETWEEN 7190 AND 7300 FROM sbm_receipts WHERE submission_id = 'sub2'), 'S10 a late submission is stamped with how late');
  INSERT INTO rr VALUES ((SELECT count(*) = 1 FROM sbm_receipts WHERE submission_id = 'sub1'), 'S11 exactly one receipt per submission');
  got := false; BEGIN UPDATE sbm_receipts SET submitted_at = now() - interval '3 days' WHERE receipt_code = code; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'S12 the submission time cannot be back-dated');
  got := false; BEGIN DELETE FROM sbm_receipts WHERE receipt_code = code; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'S13 receipts cannot be deleted');
  INSERT INTO rr VALUES (sbm_submit('stu1','t2','sub3','task3','sec9',true,NULL,'key-00005') = 'Attach your work before submitting.', 'S14 files from another tenant never appear in a manifest');
  -- deadline extensions
  INSERT INTO rr VALUES (dln_grant('ta1','t1','task4','sec1','stu1',false,true,now() + interval '2 days',now() - interval '1 hour','instructor',NULL,false,'') LIKE 'Only the instructor of record%', 'E1 only the instructor of record grants');
  INSERT INTO rr VALUES (dln_grant('in1','t1','task4','sec1','stuX',true,false,now() + interval '2 days',now() - interval '1 hour','instructor',NULL,false,'') LIKE 'That student is not enrolled%', 'E2 only for enrolled students');
  INSERT INTO rr VALUES (dln_grant('in1','t1','task4','sec1','stu1',true,true,now() + interval '2 days',now() - interval '1 hour','accommodation',NULL,false,'') LIKE 'An accommodation extension needs%', 'E3 accommodation kind needs an active letter');
  INSERT INTO rr VALUES (dln_grant('in1','t1','task4','sec1','stu1',true,true,now() - interval '2 hours',now() - interval '1 hour','instructor',NULL,false,'') LIKE 'The new due date must be after%', 'E4 the new date must be later than the assignment date');
  r := dln_grant('in1','t1','task4','sec1','stu1',true,true,now() + interval '2 days',now() - interval '1 hour','accommodation','acc-req-7',true,'per letter'); ex := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'E5 accommodation extension granted against a letter');
  f3 := fil_put('t1','stu1','late.pdf','application/pdf','submission','\\x2550'::bytea); PERFORM fil_record_scan('t1',f3,'clean','','semester-screen-1'); PERFORM fil_attach('t1','stu1',f3,'submission','sub4');
  r := sbm_submit('stu1','t1','sub4','task4','sec1',true,now() - interval '1 hour','key-00006');
  INSERT INTO rr VALUES ((SELECT NOT late AND due_source = 'extension:accommodation' AND due_at > now() FROM sbm_receipts WHERE submission_id = 'sub4'), 'E6 work after the assignment date but before the extension is on time');
  INSERT INTO rr VALUES (dln_revoke('in1','t1',ex,true) LIKE 'This work is already submitted%', 'E7 an extension cannot be revoked after submitting against it');
  INSERT INTO rr VALUES (dln_grant('in1','t1','task4','sec1','stu1',true,true,now() + interval '5 days',now() - interval '1 hour','instructor',NULL,false,'') LIKE 'This work is already submitted%', 'E8 no new extension once submitted');
  r := dln_grant('in1','t1','task5','sec1','stu2',true,true,now() + interval '1 day',now() - interval '1 day','instructor',NULL,false,'');
  r := dln_grant('in1','t1','task5','sec1','stu2',true,true,now() + interval '3 days',now() - interval '1 day','instructor',NULL,false,'');
  INSERT INTO rr VALUES ((SELECT count(*) = 1 FROM dln_extensions WHERE task_id = 'task5' AND student_id = 'stu2' AND revoked_at IS NULL) AND (SELECT count(*) = 2 FROM dln_extensions WHERE task_id = 'task5'), 'E9 a new grant replaces the old one, which is kept');
  got := false; BEGIN UPDATE dln_events SET what = 'x'; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'E10 the extension log cannot be rewritten');
  got := false; BEGIN INSERT INTO dln_extensions (tenant_id, task_id, section_id, student_id, new_due, kind, granted_by) VALUES ('t1','task6','sec1','stu3',now(),'accommodation','in1'); EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'E11 the table refuses an accommodation extension without a letter');
  r := sbm_submit('stu2','t1','sub9','task9','sec1',true,now() - interval '30 minutes','key-00007');
  INSERT INTO rr VALUES (r = 'Attach your work before submitting.', 'E12 control: unrelated work still follows its own rules');
  SELECT string_agg(lbl, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => {
    try { await sql.transaction([...FIL_MIGRATION.map((q) => sql.query(q)), ...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); }
    catch (e) { const x = e as any; console.log(label, String(x.message).slice(0, 500), x.where ?? ''); }
  };
  await go('real:', SBM_MIGRATION);
  await go('mutant no-lock (S6):', SBM_MIGRATION.map((q) => q.replace(`UPDATE fil_attachments SET locked = true WHERE tenant_id = p_tenant AND kind = 'submission' AND ref_id = p_submission AND NOT locked;`, () => '')));
  await go('mutant extension-ignored (E6):', SBM_MIGRATION.map((q) => q.replace(`IF v_due IS NULL THEN v_due := p_due; v_src := 'assignment'; END IF;`, () => `v_due := p_due; v_src := 'assignment';`)));
  await go('mutant replay-ignores-manifest (S9):', SBM_MIGRATION.map((q) => q.replace(`IF prior.submission_id = p_submission AND prior.manifest_sha256 = h THEN`, () => `IF true THEN`)));
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('sbm_receipts') AS t`)));
}
