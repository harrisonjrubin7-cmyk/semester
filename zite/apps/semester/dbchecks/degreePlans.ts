import { neon } from '@neondatabase/serverless';
import { DPL_MIGRATION } from '../src/lib/dplMigration';

// Degree plans (lib/dplMigration.ts). One rolled-back transaction, synthetic ids: st1 student, ad1 advisor the student shared
// with, ad2 advisor without a share. Run on app jeabiv2536: import { run } from './dbchecks/degreePlans'; await run();
export const CHECKS = `DO $$
DECLARE x text; p bigint; v int; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  x := dpl_save('t1', 'st1', '[{"term":"Fall 2027","courseIds":["c1"]}]', 1);
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'S1 the first save must start from version 0');
  x := dpl_save('t1', 'st1', '[{"term":"Fall 2027","courseIds":["c1"]}]', 0); p := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (p IS NOT NULL, 'S2 the student creates a plan');
  x := dpl_save('t1', 'st1', '[]', 0);
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'S3 a stale version is refused');
  x := dpl_step('t1', 'st1', false, 'submit', p, 1, '');
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'A2 the student submits');
  BEGIN x := dpl_step('t1', 'st1', true, 'approve', p, 2, ''); EXCEPTION WHEN check_violation THEN x := 'stopped only by the table'; END;
  INSERT INTO rr VALUES (x = 'You cannot review your own plan.', 'A1 a student cannot approve their own plan, even if flagged as advisor');
  x := dpl_save('t1', 'st1', '[]', 2);
  INSERT INTO rr VALUES (x = 'Your plan is with your advisor. Recall it to edit.', 'A3 a submitted plan is not edited behind the advisor');
  x := dpl_step('t1', 'ad2', false, 'approve', p, 2, '');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'A4 an advisor without a share cannot review');
  x := dpl_step('t1', 'ad1', true, 'changes', p, 2, 'short');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'A5 asking for changes needs a real note');
  x := dpl_step('t1', 'ad1', true, 'changes', p, 2, 'Move ECON 301 to spring; it needs MATH 101 first.');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM dpl_plans WHERE id = p) = 'changes_requested', 'A6 the advisor asks for changes');
  x := dpl_save('t1', 'st1', '[{"term":"Fall 2027","courseIds":["c1"]},{"term":"Spring 2028","courseIds":["c2"]}]', 3);
  x := dpl_step('t1', 'st1', false, 'submit', p, 4, '');
  x := dpl_step('t1', 'ad1', true, 'approve', p, 5, 'Looks right.');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT approved_content = content AND approved_by = 'ad1' FROM dpl_plans WHERE id = p), 'A7 approval freezes the reviewed content');
  SELECT version INTO v FROM dpl_plans WHERE id = p;
  x := dpl_save('t1', 'st1', '[]', v);
  INSERT INTO rr VALUES ((SELECT state = 'draft' AND jsonb_array_length(approved_content) = 2 FROM dpl_plans WHERE id = p), 'E1 editing after approval starts a draft and keeps the approved copy');
  got := false; BEGIN UPDATE dpl_plans SET state = 'approved' WHERE id = p; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'E2 the table refuses approved content that differs from the plan');
  got := false; BEGIN UPDATE dpl_plans SET approved_by = 'st1' WHERE id = p; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'E3 the table refuses a student as their own approver');
  got := false; BEGIN INSERT INTO dpl_plans (tenant_id, student_id) VALUES ('t1', 'st1'); EXCEPTION WHEN unique_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'E4 one plan per student per institution');
  INSERT INTO rr VALUES ((SELECT count(*) FROM dpl_events WHERE plan_id = p AND step = 'approve' AND jsonb_array_length(snapshot) = 2) = 1, 'H1 the approval is recorded with what was approved');
  got := false; BEGIN DELETE FROM dpl_events; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'H2 history is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run(only?: string) {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...DPL_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 1200)); } };
  const muts: [string, string, string][] = [
    ['edit while submitted (A3)', `IF r.state = 'submitted' THEN RETURN`, `IF false THEN RETURN`],
    ['unshared advisor reviews (A4)', `IF NOT p_is_advisor_for THEN RETURN`, `IF false THEN RETURN`],
    ['self approval (A1; table backstop)', `IF p_actor = r.student_id THEN RETURN 'You cannot review`, `IF false THEN RETURN 'You cannot review`],
  ];
  if (!only || only === 'real') await go('real:', base);
  for (const [label, from, to] of muts) {
    if (only && only !== 'mutants' && !label.startsWith(only)) continue;
    const m = base.map((q) => q.replace(from, () => to));
    console.log(label, 'applied:', m.join('') !== base.join(''));
    await go('mutant ' + label + ':', m);
  }
}
