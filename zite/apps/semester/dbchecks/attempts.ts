import { neon } from '@neondatabase/serverless';
import { FIL_MIGRATION } from '../src/lib/filMigration';
import { SBM_MIGRATION } from '../src/lib/sbmMigration';

const V = (n: number) => `'{"title":"Lab report","instructions":"Report the experiment.","dueAt":"2026-12-01T23:00:00Z","points":20,"rubric":"Method","attemptsAllowed":${n},"aiPolicy":"Course policy"}'::jsonb`;
const file = (sub: string) => `f := fil_put('t1','stu1','${sub}.pdf','application/pdf','submission','\\\\\\\\x255044462d'::bytea); PERFORM fil_record_scan('t1',f,'clean','','semester-screen-1'); PERFORM fil_attach('t1','stu1',f,'submission','${sub}');`;
export const CHECKS = `DO $$
DECLARE r text; x text; a bigint; f uuid; u int; al int;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  -- No linked assignment: one attempt, as before.
  ${file('legacy-1')}
  r := sbm_submit('stu1','t1','legacy-1','task-legacy','sec1',true,'2026-12-01T23:00:00Z','key-att-legacy-1');
  ${file('legacy-2')}
  x := sbm_submit('stu1','t1','legacy-2','task-legacy','sec1',true,'2026-12-01T23:00:00Z','key-att-legacy-2');
  INSERT INTO rr VALUES (r LIKE 'ok:%' AND x = 'You have used all 1 attempt for this assignment.', 'T1 an unlinked task keeps one attempt ' || coalesce(x,''));
  -- An assignment published with 2 attempts.
  r := asg_save_draft('ins','t1','sec1',true,NULL,${V(2)},0); a := split_part(r,':',2)::bigint;
  r := asg_publish('ins','t1',a,true,1,true,ARRAY['First published'],''); r := asg_link_task('t1',a,'task-2','stu1');
  SELECT used, allowed INTO u, al FROM sbm_attempts('t1','task-2','stu1');
  INSERT INTO rr VALUES (u = 0 AND al = 2, 'T2 the published version allows 2 attempts');
  ${file('att-1')}
  r := sbm_submit('stu1','t1','att-1','task-2','sec1',true,'2026-12-01T23:00:00Z','key-att-00001');
  ${file('att-2')}
  x := sbm_submit('stu1','t1','att-2','task-2','sec1',true,'2026-12-01T23:00:00Z','key-att-00002');
  INSERT INTO rr VALUES (r LIKE 'ok:%' AND x LIKE 'ok:%', 'T3 two attempts are accepted ' || coalesce(x,''));
  INSERT INTO rr VALUES ((SELECT array_agg(attempt ORDER BY attempt) FROM sbm_receipts WHERE task_id = 'task-2') = ARRAY[1,2], 'T4 the receipts are numbered 1 and 2');
  INSERT INTO rr VALUES (sbm_submit('stu1','t1','att-2','task-2','sec1',true,'2026-12-01T23:00:00Z','key-att-00002') LIKE 'ok:%:replay', 'T5 retrying the second attempt replays it, not a third');
  ${file('att-3')}
  INSERT INTO rr VALUES (sbm_submit('stu1','t1','att-3','task-2','sec1',true,'2026-12-01T23:00:00Z','key-att-00003') = 'You have used all 2 attempts for this assignment.', 'T6 a third attempt is refused');
  INSERT INTO rr VALUES ((SELECT count(*) FROM sbm_receipts WHERE task_id = 'task-2') = 2, 'T7 still exactly two receipts');
  INSERT INTO rr VALUES ((SELECT bool_and(asg_version = 1) FROM sbm_receipts WHERE task_id = 'task-2'), 'T8 each attempt records the assignment version');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  const base = [...FIL_MIGRATION, ...SBM_MIGRATION];
  await go('real:', base);
  const m1 = base.map((q) => q.replace(`IF v_used >= v_allowed THEN RETURN`, () => `IF false THEN RETURN`));
  console.log('unlimited mutant applied:', m1.join('') !== base.join(''));
  await go('mutant unlimited-attempts (T1, T6, T7):', m1);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('sbm_receipts') AS t`)));
}
