import { neon } from '@neondatabase/serverless';
import { CAP_MIGRATION } from '../src/lib/capMigration';

// Undergraduate capstone (lib/capMigration.ts). One rolled-back transaction, synthetic ids: st1 student, fa1 supervisor,
// fa2 second reader. Run on app jeabiv2536: import { run } from './dbchecks/capstone'; await run();
const BODY = `'This milestone describes the research question, sources and the method in enough detail to review.'`;
export const CHECKS = `DO $$
DECLARE x text; c bigint; v int; got boolean; m text;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  x := cap_propose('t1', 'st1', true, false, '{"term":"Spring 2027","title":"Water access in rural counties","summary":"How distance to treated water changes school attendance, using county data.","supervisorId":"zz"}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'P1 the supervisor must be active faculty');
  x := cap_propose('t1', 'st1', true, true, '{"term":"Spring 2027","title":"Water access in rural counties","summary":"How distance to treated water changes school attendance, using county data.","supervisorId":"fa1"}');
  c := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'P2 student proposes ' || x);
  x := cap_propose('t1', 'st1', true, true, '{"term":"spring 2027","title":"Another project here","summary":"A second capstone in the same term should not be possible for one student.","supervisorId":"fa1"}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'P3 one capstone per term');
  x := cap_step('t1', 'st1', 'submit', c, 1, false, jsonb_build_object('milestone', 'proposal', 'body', ${BODY}));
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'P4 nothing is submitted before the supervisor accepts');
  x := cap_step('t1', 'fa2', 'accept', c, 1, false, '{}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'P5 only the named supervisor accepts');
  x := cap_step('t1', 'fa1', 'accept', c, 1, false, '{}');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM cap_projects WHERE id = c) = 'active', 'P6 supervisor accepts');

  v := 2;
  x := cap_step('t1', 'st1', 'submit', c, v, false, jsonb_build_object('milestone', 'draft', 'body', ${BODY}));
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'M1 milestones open in order');
  x := cap_step('t1', 'st1', 'submit', c, v, false, jsonb_build_object('milestone', 'proposal', 'body', ${BODY})); v := v + 1;
  x := cap_step('t1', 'st1', 'submit', c, v, false, jsonb_build_object('milestone', 'proposal', 'body', ${BODY}));
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'M2 one waiting submission at a time');
  x := cap_step('t1', 'fa1', 'revise', c, v, false, '{"note":"short"}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'M3 revisions need a real note');
  x := cap_step('t1', 'fa1', 'revise', c, v, false, '{"note":"Narrow the question to one state."}'); v := v + 1;
  x := cap_step('t1', 'st1', 'submit', c, v, false, jsonb_build_object('milestone', 'proposal', 'body', ${BODY})); v := v + 1;
  INSERT INTO rr VALUES ((SELECT max(version) FROM cap_submissions WHERE project_id = c AND milestone = 'proposal') = 2, 'M4 a resubmission is a new version');
  got := false; BEGIN UPDATE cap_submissions SET note = 'rewritten' WHERE project_id = c AND version = 1; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'M5 a decided submission cannot be edited');
  x := cap_step('t1', 'st1', 'approve', c, v, false, '{}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'M6 the student cannot approve their own milestone');
  x := cap_step('t1', 'fa1', 'approve', c, v, false, '{}'); v := v + 1;
  FOREACH m IN ARRAY ARRAY['plan', 'draft'] LOOP
    x := cap_step('t1', 'st1', 'submit', c, v, false, jsonb_build_object('milestone', m, 'body', ${BODY})); v := v + 1;
    x := cap_step('t1', 'fa1', 'approve', c, v, false, '{}'); v := v + 1;
  END LOOP;
  x := cap_step('t1', 'st1', 'submit', c, v, false, jsonb_build_object('milestone', 'final', 'body', ${BODY})); v := v + 1;
  x := cap_step('t1', 'fa1', 'approve', c, v, false, '{}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'M7 the final needs a second reader first');
  x := cap_step('t1', 'fa1', 'reader', c, v, true, '{"readerId":"st1"}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'R1 the student cannot be their own second reader');
  x := cap_step('t1', 'fa1', 'reader', c, v, true, '{"readerId":"fa2"}'); v := v + 1;
  x := cap_step('t1', 'fa2', 'score', c, v, false, '{"question":4,"method":3,"evidence":3,"communication":4,"comment":"Clear question and careful use of county data."}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'S1 scoring waits for the approved final');
  x := cap_step('t1', 'fa1', 'approve', c, v, false, '{}'); v := v + 1;
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND cap_current(c) IS NULL, 'M8 all four milestones approved');
  x := cap_step('t1', 'st1', 'score', c, v, false, '{"question":4,"method":4,"evidence":4,"communication":4,"comment":"I think my own work is excellent overall."}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'S2 the student cannot score');
  x := cap_step('t1', 'fa2', 'score', c, v, false, '{"question":5,"method":3,"evidence":3,"communication":4,"comment":"Clear question and careful use of county data."}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'S3 scores are 1 to 4');
  x := cap_step('t1', 'fa2', 'score', c, v, false, '{"question":4,"method":3,"evidence":3,"communication":4,"comment":"Clear question and careful use of county data."}'); v := v + 1;
  x := cap_step('t1', 'fa2', 'score', c, v, false, '{"question":4,"method":3,"evidence":3,"communication":4,"comment":"Clear question and careful use of county data."}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'S4 each reader scores once');
  x := cap_step('t1', 'fa1', 'reader', c, v, true, '{"readerId":"fa3"}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'S5 the second reader cannot be swapped after scoring');
  x := cap_step('t1', 'fa1', 'score', c, v, false, '{"question":2,"method":3,"evidence":3,"communication":4,"comment":"The question drifted in the final chapter."}');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM cap_projects WHERE id = c) = 'evaluated', 'S6 both scores complete the evaluation');
  got := false; BEGIN UPDATE cap_scores SET question = 4 WHERE project_id = c; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'S7 scores are append-only');
  got := false; BEGIN DELETE FROM cap_events; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'S8 history is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run(only?: string) {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...CAP_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 1200)); } };
  const muts: [string, string, string][] = [
    ['milestones out of order (M1)', `IF p->>'milestone' IS DISTINCT FROM v_m THEN RETURN`, `IF false THEN RETURN`],
    ['student approves (M6)', `IF p_actor <> c.supervisor_id THEN RETURN 'Only the supervisor decides milestones.'; END IF;`, ``],
    ['score before final (S1)', `IF c.state <> 'active' OR cap_current(c.id) IS NOT NULL THEN RETURN`, `IF c.state <> 'active' THEN RETURN`],
  ];
  if (!only || only === 'real') await go('real:', base);
  for (const [label, from, to] of muts) {
    if (only && only !== 'mutants' && !label.startsWith(only)) continue;
    const mm = base.map((q) => q.replace(from, () => to));
    console.log(label, 'applied:', mm.join('') !== base.join(''));
    await go('mutant ' + label + ':', mm);
  }
}
