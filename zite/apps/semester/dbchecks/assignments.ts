import { neon } from '@neondatabase/serverless';
import { FIL_MIGRATION } from '../src/lib/filMigration';
import { SBM_MIGRATION } from '../src/lib/sbmMigration';

const V1 = `'{"title":"Argumentative essay","instructions":"Take a position.","dueAt":"2026-12-01T23:00:00Z","points":100,"rubric":"Thesis","attemptsAllowed":1,"aiPolicy":"Course policy"}'::jsonb`;
const V2 = `'{"title":"Argumentative essay","instructions":"Take a position. Use two sources.","dueAt":"2026-12-03T23:00:00Z","points":100,"rubric":"Thesis","attemptsAllowed":1,"aiPolicy":"Course policy"}'::jsonb`;
export const CHECKS = `DO $$
DECLARE r text; x text; a bigint; f uuid; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO rr VALUES (asg_save_draft('stu','t1','sec1',false,NULL,${V1},0) LIKE 'Only the instructor of record%', 'A1 only the instructor of record drafts');
  r := asg_save_draft('ins','t1','sec1',true,NULL,${V1},0); a := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%:1', 'A2 a new draft is version 1 of the draft');
  INSERT INTO rr VALUES (asg_link_task('t1',a,'task-1','stu1') LIKE 'Only a published assignment%', 'A3 a draft is never given to students');
  INSERT INTO rr VALUES (asg_save_draft('ins','t1','sec1',true,a,${V1},7) LIKE 'Someone saved this draft%', 'A4 a stale draft save is refused');
  INSERT INTO rr VALUES (asg_publish('ins','t1',a,true,1,false,'{}','') LIKE 'The draft has problems%', 'A5 a draft with problems cannot be published');
  INSERT INTO rr VALUES (asg_publish('ins','t1',a,true,9,true,'{}','') LIKE 'The draft changed since you previewed%', 'A6 publishing needs the previewed draft version');
  INSERT INTO rr VALUES (asg_publish('ins','t2',a,true,1,true,'{}','') = 'Assignment not found.', 'A7 another institution cannot publish it');
  r := asg_publish('ins','t1',a,true,1,true,ARRAY['First published'],'');
  INSERT INTO rr VALUES (r = 'ok:1' AND (SELECT state FROM asg_assignments WHERE id = a) = 'Published', 'A8 publishing freezes version 1');
  r := asg_link_task('t1',a,'task-1','stu1'); x := asg_link_task('t1',a,'task-1','stu1');
  INSERT INTO rr VALUES (r = 'ok' AND x = 'ok' AND (SELECT count(*) FROM asg_task_links WHERE assignment_id = a) = 1, 'A9 the published version is given to the student once');
  x := NULL;
  f := fil_put('t1','stu1','essay.pdf','application/pdf','submission','\\\\x255044462d'::bytea); PERFORM fil_record_scan('t1',f,'clean','','semester-screen-1');
  PERFORM fil_attach('t1','stu1',f,'submission','sub-1');
  r := sbm_submit('stu1','t1','sub-1','task-1','sec1',true,'2026-12-01T23:00:00Z','key-asg-0001');
  INSERT INTO rr VALUES (r LIKE 'ok:%' AND (SELECT asg_version FROM sbm_receipts WHERE submission_id = 'sub-1') = 1 AND (SELECT asg_sha256 FROM sbm_receipts WHERE submission_id = 'sub-1') = (SELECT content_sha256 FROM asg_versions WHERE assignment_id = a AND version = 1), 'A10 the receipt records the version and its hash');
  r := asg_save_draft('ins','t1','sec1',true,a,${V1},1);
  INSERT INTO rr VALUES (asg_publish('ins','t1',a,true,2,true,'{}','') LIKE 'Nothing changed since version 1%', 'A11 republishing an unchanged draft creates no new version');
  r := asg_save_draft('ins','t1','sec1',true,a,${V2},2);
  r := asg_publish('ins','t1',a,true,3,true,ARRAY['Instructions changed','Due date changed'],'Added a sources requirement');
  INSERT INTO rr VALUES (r = 'ok:2', 'A12 a revision is published as version 2');
  INSERT INTO rr VALUES ((SELECT content->>'instructions' FROM asg_versions WHERE assignment_id = a AND version = 1) = 'Take a position.'
    AND (SELECT asg_version FROM sbm_receipts WHERE submission_id = 'sub-1') = 1, 'A13 version 1 and the receipt against it are unchanged by the revision');
  got := false; BEGIN UPDATE asg_versions SET note = 'x' WHERE assignment_id = a; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'A14 published versions cannot be edited');
  got := false; BEGIN DELETE FROM asg_versions WHERE assignment_id = a; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'A15 published versions cannot be deleted');
  INSERT INTO rr VALUES ((SELECT changes FROM asg_versions WHERE assignment_id = a AND version = 2) = ARRAY['Instructions changed','Due date changed'], 'A16 the version records what changed');
  SELECT string_agg(lbl, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 400)); } };
  const base = [...FIL_MIGRATION, ...SBM_MIGRATION];
  await go('real:', base);
  const m1 = base.map((q) => q.replace('VALUES (p_tenant, p_submission, p_task, p_section, p_actor, f, h, v_due, late_s > 0, late_s, code, p_idem, v_src, v_asg, v_ver, v_sha)', () => 'VALUES (p_tenant, p_submission, p_task, p_section, p_actor, f, h, v_due, late_s > 0, late_s, code, p_idem, v_src, v_asg, NULL, NULL)'));
  console.log('receipt mutant applied:', m1.join('') !== base.join(''));
  await go('mutant receipt-forgets-version (A10, A13):', m1);
  const m2 = base.map((q) => q.replace(`IF prev = h THEN RETURN 'Nothing changed since version ' || a.current_version || '.'; END IF;`, () => ''));
  console.log('no-change mutant applied:', m2.join('') !== base.join(''));
  await go('mutant republish-anything (A11):', m2);
  const m3 = base.map((q) => q.replace(`IF NOT EXISTS (SELECT 1 FROM asg_assignments WHERE id = p_id AND tenant_id = p_tenant AND state = 'Published') THEN RETURN 'Only a published assignment is given to students.'; END IF;`, () => ''));
  console.log('draft-leak mutant applied:', m3.join('') !== base.join(''));
  await go('mutant draft-given-to-students (A3):', m3);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('asg_assignments') AS t`)));
}
