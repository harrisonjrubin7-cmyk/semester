import { neon } from '@neondatabase/serverless';
import { VET_MIGRATION } from '../src/lib/vetMigration';

// Veterans certification (lib/vetMigration.ts). One rolled-back transaction, synthetic ids: st1 student, vo1/vo2 officials,
// adm administrator. Run on app jeabiv2536: import { run } from './dbchecks/veterans'; await run();
const LINES = `'{"lines":[{"sectionId":"s1","course":"MATH 101","credits":4},{"sectionId":"s2","course":"HIST 210","credits":3},{"sectionId":"s3","course":"PE 100","credits":2},{"sectionId":"s4","course":"CHEM 110","credits":4}]}'`;
export const CHECKS = `DO $$
DECLARE x text; r bigint; v int; l1 bigint; got boolean; c1 bigint; c2 bigint;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  x := vet_set_official('t1', 'vo1', false, 'vo1', true);
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'V1 nobody appoints themselves');
  x := vet_set_official('t1', 'adm', true, 'vo1', true); x := vet_set_official('t1', 'adm', true, 'vo2', true);
  INSERT INTO rr VALUES (vet_is_official('t1', 'vo1') AND NOT vet_is_official('t2', 'vo1'), 'V2 an administrator appoints officials for one institution');

  x := vet_intake('t1', 'vo1', false, '{"term":"Spring 2027","chapter":"33","level":"undergraduate","program":"BS Biology","coeOnFile":true}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'I1 only students request certification');
  x := vet_intake('t1', 'st1', true, '{"term":"Spring 2027","chapter":"99","level":"undergraduate","program":"BS Biology"}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'I2 unknown benefit chapter refused');
  x := vet_intake('t1', 'st1', true, '{"term":"Spring 2027","chapter":"33","level":"undergraduate","program":"BS Biology","coeOnFile":true}');
  r := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'I3 student submits intake ' || x);
  x := vet_intake('t1', 'st1', true, '{"term":"spring 2027","chapter":"33","level":"undergraduate","program":"BS Biology"}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'I4 one open request per term');

  x := vet_review('t1', 'zz', 'start', r, 1, ${LINES}::jsonb);
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'R1 review needs a certifying official');
  x := vet_review('t1', 'vo1', 'start', r, 7, ${LINES}::jsonb);
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'R2 stale version refused');
  x := vet_review('t1', 'vo1', 'start', r, 1, ${LINES}::jsonb);
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT count(*) FROM vet_lines WHERE request_id = r) = 4, 'R3 start copies the term''s courses into lines');
  x := vet_review('t1', 'vo1', 'certify', r, 2, '{}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'R4 every course must be decided first');
  v := 2;
  FOR l1 IN SELECT id FROM vet_lines WHERE request_id = r AND section_id IN ('s1', 's2', 's4') ORDER BY id LOOP
    x := vet_review('t1', 'vo1', 'decide', r, v, jsonb_build_object('lineId', l1, 'applicable', true)); v := v + 1;
  END LOOP;
  SELECT id INTO l1 FROM vet_lines WHERE request_id = r AND section_id = 's3';
  x := vet_review('t1', 'vo1', 'decide', r, v, jsonb_build_object('lineId', l1, 'applicable', false));
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'R5 "does not apply" needs a reason');
  x := vet_review('t1', 'vo1', 'decide', r, v, jsonb_build_object('lineId', l1, 'applicable', false, 'reason', 'Not required by the BS Biology degree plan'));
  v := v + 1;
  x := vet_review('t1', 'vo1', 'certify', r, v, '{}');
  SELECT id INTO c1 FROM vet_certifications WHERE request_id = r;
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT credits = 11 AND training_time = 'three-quarter time' FROM vet_certifications WHERE id = c1),
    'R6 the database sums applicable credits (11) and derives three-quarter time ' || x);
  got := false; BEGIN UPDATE vet_certifications SET credits = 12 WHERE id = c1; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'R7 certified facts cannot change');
  got := false; BEGIN INSERT INTO vet_certifications (request_id, student_id, certified_by, credits, training_time, facts, facts_hash) VALUES (r, 'st1', 'st1', 12, 'full time', '{}', md5('{}')); EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'R8 a student can never be their own certifier');
  x := vet_review('t1', 'vo1', 'record_ref', r, v + 1, '{"reference":"VAONCE-2027-0411"}');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT external_ref FROM vet_certifications WHERE id = c1) = 'VAONCE-2027-0411', 'R9 the VA reference is recorded after the official submits elsewhere');
  got := false; BEGIN UPDATE vet_certifications SET external_ref = 'changed' WHERE id = c1; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'R10 a recorded reference cannot be rewritten');

  -- Enrolment changed: amend
  x := vet_review('t1', 'vo2', 'amend', r, v + 1, '{"lines":[{"sectionId":"s1","course":"MATH 101","credits":4},{"sectionId":"s2","course":"HIST 210","credits":3}]}'::jsonb);
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT superseded_by IS NULL FROM vet_certifications WHERE id = c1), 'A1 an amendment starts while the earlier certification still stands');
  v := v + 2;
  FOR l1 IN SELECT id FROM vet_lines WHERE request_id = r ORDER BY id LOOP
    x := vet_review('t1', 'vo2', 'decide', r, v, jsonb_build_object('lineId', l1, 'applicable', true)); v := v + 1;
  END LOOP;
  x := vet_review('t1', 'vo2', 'certify', r, v, '{}');
  SELECT id INTO c2 FROM vet_certifications WHERE request_id = r AND superseded_by IS NULL;
  INSERT INTO rr VALUES (c2 <> c1 AND (SELECT amends = c1 AND credits = 7 AND training_time = 'half time' FROM vet_certifications WHERE id = c2)
    AND (SELECT superseded_by = c2 FROM vet_certifications WHERE id = c1), 'A2 the amendment supersedes the first (7 credits, half time)');

  -- Thresholds
  x := vet_set_policy('t1', 'st1', 'undergraduate', 12, 9, 6);
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'P1 only officials confirm thresholds');
  x := vet_set_policy('t1', 'vo1', 'undergraduate', 9, 9, 6);
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'P2 thresholds must be ordered');
  x := vet_set_policy('t1', 'vo1', 'undergraduate', 12, 10, 6);
  INSERT INTO rr VALUES (vet_training_time('t1', 'undergraduate', 9) = 'half time' AND vet_training_time('t2', 'undergraduate', 9) = 'three-quarter time', 'P3 confirmed thresholds apply to this institution only');
  x := vet_review('t1', 'st1', 'withdraw', r, 0, '{}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'W1 a certified request cannot be withdrawn by the student');
  x := vet_intake('t1', 'vo1', true, '{"term":"Fall 2027","chapter":"33","level":"graduate","program":"MS Statistics","coeOnFile":true}');
  x := vet_review('t1', 'vo1', 'start', substr(x, 4)::bigint, 1, ${LINES}::jsonb);
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'W3 an official who is also a student cannot review their own request');
  got := false; BEGIN DELETE FROM vet_events; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'W2 history is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run(only?: string) {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...VET_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 1200)); } };
  const muts: [string, string, string][] = [
    ['undecided lines certified (R4)', `IF EXISTS (SELECT 1 FROM vet_lines WHERE request_id = r.id AND applicable IS NULL) THEN RETURN`, `IF false THEN RETURN`],
    ['non-applicable credits counted (R6)', `coalesce(sum(credits) FILTER (WHERE applicable), 0)`, `coalesce(sum(credits), 0)`],
    ['own request reviewed (W3; table backstop)', `IF r.student_id = p_actor THEN RETURN 'You cannot review your own request.'; END IF;`, ``],
  ];
  if (!only || only === 'real') await go('real:', base);
  for (const [label, from, to] of muts) {
    if (only && only !== 'mutants' && !label.startsWith(only)) continue;
    const m = base.map((q) => q.replace(from, () => to));
    console.log(label, 'applied:', m.join('') !== base.join(''));
    await go('mutant ' + label + ':', m);
  }
}
