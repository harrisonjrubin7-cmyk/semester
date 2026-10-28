import { neon } from '@neondatabase/serverless';
import { FIL_MIGRATION } from '../src/lib/filMigration';
import { SBM_MIGRATION } from '../src/lib/sbmMigration';

// Group submissions (28 Oct). A group assignment names a course group set in its published version. One member submits
// for the group; attempts are counted per group under a group lock; the receipt freezes who was in the group.
const V = (gs: string) => `('{"title":"Team project","instructions":"Build it.","dueAt":"2026-12-01T23:00:00Z","points":50,"rubric":"","attemptsAllowed":1,"aiPolicy":"Course policy","groupSetId":' || ${gs} || '}')::jsonb`;
const file = (who: string, sub: string) => `f := fil_put('t1','${who}','${sub}.pdf','application/pdf','submission','\\\\\\\\x255044462d'::bytea); PERFORM fil_record_scan('t1',f,'clean','','semester-screen-1'); PERFORM fil_attach('t1','${who}',f,'submission','${sub}');`;
const PAST = `'2026-01-01T00:00:00Z'`;
export const CHECKS = `DO $$
DECLARE r text; x text; a bigint; f uuid; u int; al int; gs bigint; g1 bigint; g2 bigint; got boolean; m text[];
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO grp_sets (tenant_id, section_id, name, max_size, created_by) VALUES ('t1','sec1','Project teams',4,'ins') RETURNING id INTO gs;
  INSERT INTO grp_groups (set_id, name) VALUES (gs,'Team A') RETURNING id INTO g1;
  INSERT INTO grp_groups (set_id, name) VALUES (gs,'Team B') RETURNING id INTO g2;
  PERFORM grp_join('t1',g1,'stu1','ins',true); PERFORM grp_join('t1',g1,'stu2','ins',true); PERFORM grp_join('t1',g2,'stu4','ins',true);
  r := asg_save_draft('ins','t1','sec1',true,NULL,${V('gs')},0); a := split_part(r,':',2)::bigint;
  r := asg_publish('ins','t1',a,true,1,true,ARRAY['First published'],'');
  PERFORM asg_link_task('t1',a,'tk1','stu1'); PERFORM asg_link_task('t1',a,'tk2','stu2'); PERFORM asg_link_task('t1',a,'tk3','stu3'); PERFORM asg_link_task('t1',a,'tk4','stu4');
  ${file('stu3', 's3')}
  INSERT INTO rr VALUES (sbm_submit('stu3','t1','s3','tk3','sec1',true,${PAST},'key-grp-0003') = 'This is group work. Join a group in its group set before submitting.', 'G1 a student in no group cannot submit group work');
  r := dln_grant('ins','t1','tk1','sec1','stu1',true,true,'2027-06-01T00:00:00Z'::timestamptz,${PAST}::timestamptz,'instructor',NULL,false,'');
  ${file('stu1', 's1')}
  r := sbm_submit('stu1','t1','s1','tk1','sec1',true,${PAST},'key-grp-0001');
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'G2 a member submits for the group ' || coalesce(r,''));
  SELECT members INTO m FROM sbm_group_receipts gr JOIN sbm_receipts s ON s.id = gr.receipt_id WHERE s.submission_id = 's1';
  INSERT INTO rr VALUES (m = ARRAY['stu1','stu2'], 'G3 the receipt freezes the members ' || coalesce(m::text,'none'));
  INSERT INTO rr VALUES ((SELECT late AND due_source = 'assignment' FROM sbm_receipts WHERE submission_id = 's1'), 'G4 one member''s extension does not move the group deadline');
  SELECT used, allowed INTO u, al FROM sbm_attempts('t1','tk2','stu2');
  INSERT INTO rr VALUES (u = 1 AND al = 1, 'G5 the other member sees the group attempt as used ' || u || '/' || al);
  ${file('stu2', 's2')}
  INSERT INTO rr VALUES (sbm_submit('stu2','t1','s2','tk2','sec1',true,${PAST},'key-grp-0002') = 'You have used all 1 attempt for this assignment.', 'G6 a second member cannot submit again');
  ${file('stu4', 's4')}
  INSERT INTO rr VALUES (sbm_submit('stu4','t1','s4','tk4','sec1',true,${PAST},'key-grp-0004') LIKE 'ok:%', 'G7 another group is not affected');
  PERFORM grp_leave('t1',gs,'stu2','ins',true);
  INSERT INTO rr VALUES ((SELECT members FROM sbm_group_receipts gr JOIN sbm_receipts s ON s.id = gr.receipt_id WHERE s.submission_id = 's1') = ARRAY['stu1','stu2'], 'G8 leaving the group later does not change who the work belongs to');
  got := false; BEGIN UPDATE sbm_group_receipts SET members = ARRAY['stu1'] WHERE group_id = g1; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'G9 group receipts cannot be rewritten');
  INSERT INTO rr VALUES (sbm_submit('stu1','t1','s1','tk1','sec1',true,${PAST},'key-grp-0001') LIKE 'ok:%:replay', 'G10 a retry replays the group receipt');
  INSERT INTO rr VALUES ((SELECT count(*) FROM sbm_group_receipts WHERE asg_id = a) = 2, 'G11 one receipt per group attempt');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  const base = [...FIL_MIGRATION, ...SBM_MIGRATION];
  await go('real:', base);
  const m1 = base.map((q) => q.replace(`IF v_grp IS NOT NULL THEN\n       -- Group work: attempts belong to the group, whoever submitted them.`, () => `IF false THEN`));
  console.log('per-student-attempts mutant applied:', m1.join('') !== base.join(''));
  await go('mutant per-student attempts (G5, G6):', m1);
  const m2 = base.map((q) => q.replace(`IF v_grp IS NULL THEN RETURN 'This is group work.`, () => `IF false THEN RETURN 'This is group work.`));
  console.log('no-membership mutant applied:', m2.join('') !== base.join(''));
  await go('mutant no membership check (G1):', m2);
  const m3 = base.map((q) => q.replace(`IF v_grp IS NOT NULL THEN v_due := NULL; END IF;`, () => ''));
  console.log('extension mutant applied:', m3.join('') !== base.join(''));
  await go('mutant member extension moves group deadline (G4):', m3);
}
