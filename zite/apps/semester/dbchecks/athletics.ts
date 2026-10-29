import { neon } from '@neondatabase/serverless';
import { ATH_MIGRATION } from '../src/lib/athMigration';

// Athletics compliance (lib/athMigration.ts). One rolled-back transaction, synthetic ids and facts.
// Run on app jeabiv2536: import { run } from './dbchecks/athletics'; await run();
const RULES = `'[{"kind":"min_term_credits","value":12},{"kind":"min_cumulative_gpa","value":2.0}]'::jsonb`;
const FACTS = `'{"s1":{"term_credits":15,"cumulative_gpa":3.1,"completed_credits":45},"s2":{"term_credits":9,"cumulative_gpa":2.8,"completed_credits":30},"s3":{"term_credits":12,"cumulative_gpa":null,"completed_credits":0}}'::jsonb`;
export const CHECKS = `DO $$
DECLARE x text; rs bigint; rs2 bigint; h text; tm bigint; rv bigint; v int; got boolean; res jsonb;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO rr VALUES (ath_set_officer('t1', 'o1', true, 'o1', true) = 'Another administrator appoints you.', 'T1 no self-appointment');
  x := ath_set_officer('t1', 'adm', true, 'o1', true); x := ath_set_officer('t1', 'adm', true, 'o2', true);

  x := ath_rule_set('t1', 'stu', 'draft', NULL, NULL, ${RULES}, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Only an athletics compliance officer manages eligibility rules.', 'T2 only officers write rules');
  x := ath_rule_set('t1', 'o1', 'draft', NULL, NULL, '[{"kind":"min_term_credits","value":12},{"kind":"min_term_credits","value":9}]'::jsonb, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Each kind of rule appears once.', 'T3 one rule per kind');
  x := ath_rule_set('t1', 'o1', 'draft', NULL, NULL, '[{"kind":"min_cumulative_gpa","value":5}]'::jsonb, NULL, NULL);
  INSERT INTO rr VALUES (x = 'A GPA minimum is between 0 and 4.', 'T4 GPA bounded');
  x := ath_rule_set('t1', 'o1', 'draft', NULL, NULL, ${RULES}, 'Institution policy 2026', NULL); rs := substr(x, 4)::bigint;
  SELECT rules_hash INTO h FROM ath_rule_sets WHERE id = rs;
  x := ath_rule_set('t1', 'o1', 'approve', rs, 1, NULL, NULL, h);
  INSERT INTO rr VALUES (x = 'You wrote these rules, so another officer approves them.', 'T5 no self-approval of rules');
  x := ath_rule_set('t1', 'o2', 'approve', rs, 1, NULL, NULL, 'stale');
  INSERT INTO rr VALUES (x = 'The rules changed since you opened them. Reload and read them again.', 'T6 approval bound to the rules seen');

  x := ath_team('t1', 'o1', 'create', NULL, 'Women''s Soccer', 'Soccer', NULL); tm := substr(x, 4)::bigint;
  x := ath_team('t1', 'o1', 'add', tm, NULL, NULL, 's1'); x := ath_team('t1', 'o1', 'add', tm, NULL, NULL, 's2'); x := ath_team('t1', 'o1', 'add', tm, NULL, NULL, 's3');
  x := ath_open_review('t1', 'o1', tm, 'Fall 2026', ${FACTS});
  INSERT INTO rr VALUES (x = 'Approve an eligibility rule set first.', 'T7 no review without approved rules');
  x := ath_rule_set('t1', 'o2', 'approve', rs, 1, NULL, NULL, h);
  x := ath_open_review('t1', 'o1', tm, 'Fall 2026', '{"s1":{"term_credits":15,"cumulative_gpa":3.1,"completed_credits":45}}'::jsonb);
  INSERT INTO rr VALUES (x = 'Academic facts are missing for 2 athlete(s).', 'T8 every athlete needs facts');
  x := ath_open_review('t1', 'o1', tm, 'Fall 2026', ${FACTS}); rv := substr(x, 4)::bigint;
  INSERT INTO rr VALUES ((SELECT passes FROM ath_review_lines WHERE review_id = rv AND student_id = 's1') AND NOT (SELECT passes FROM ath_review_lines WHERE review_id = rv AND student_id = 's2'), 'T9 rules evaluated per athlete');
  INSERT INTO rr VALUES (NOT (SELECT passes FROM ath_review_lines WHERE review_id = rv AND student_id = 's3'), 'T10 no graded work means the GPA rule is not met');
  x := ath_open_review('t1', 'o2', tm, 'Fall 2026', ${FACTS});
  INSERT INTO rr VALUES (x = 'This team already has a review for that term.', 'T11 one review per team and term');

  x := ath_line('t1', 'o1', 'eligible', rv, 's2', NULL, NULL);
  INSERT INTO rr VALUES (x = 'This athlete does not meet every rule. Mark ineligible or request an exception.', 'T12 failing athletes cannot be marked eligible');
  x := ath_line('t1', 'o1', 'eligible', rv, 's1', NULL, NULL);
  x := ath_line('t1', 'o1', 'request_exception', rv, 's2', 'Medical reasons', 'Waiver W-2026-03');
  INSERT INTO rr VALUES (x = 'Give the reason (30+ characters) and the waiver or document reference.', 'T13 exceptions need a full reason');
  x := ath_line('t1', 'o1', 'request_exception', rv, 's2', 'Medical withdrawal from one course after week six, documented by the health office', 'Waiver W-2026-03');
  x := ath_line('t1', 'o1', 'approve_exception', rv, 's2', NULL, NULL);
  INSERT INTO rr VALUES (x = 'You requested this exception, so another officer approves it.', 'T14 a second officer approves exceptions');
  x := ath_line('t1', 'o2', 'approve_exception', rv, 's2', NULL, NULL);
  SELECT rev INTO v FROM ath_reviews WHERE id = rv;
  x := ath_certify('t1', 'o2', false, rv, v, 'Fall roster');
  INSERT INTO rr VALUES (x = '1 athlete(s) still need a decision.', 'T15 every line decided before certifying');
  x := ath_line('t1', 'o1', 'ineligible', rv, 's3', NULL, NULL);
  SELECT rev INTO v FROM ath_reviews WHERE id = rv;
  x := ath_certify('t1', 'o1', false, rv, v, 'Fall roster');
  INSERT INTO rr VALUES (x = 'You opened this review, so someone else certifies it.', 'T16 the opener does not certify');
  x := ath_certify('t1', 'o2', false, rv, v, 'Fall roster');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM ath_reviews WHERE id = rv) = 'certified', 'T17 certified by another officer');
  got := false; BEGIN UPDATE ath_review_lines SET outcome = 'ineligible' WHERE review_id = rv AND student_id = 's1'; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'T18 certified lines never change');
  x := ath_line('t1', 'o1', 'eligible', rv, 's1', NULL, NULL);
  INSERT INTO rr VALUES (x = 'This review is closed.', 'T19 no decisions after certification');

  x := ath_rule_set('t1', 'o1', 'draft', NULL, NULL, '[{"kind":"min_term_credits","value":12}]'::jsonb, 'Relaxed GPA rule', NULL); rs2 := substr(x, 4)::bigint;
  SELECT rules_hash INTO h FROM ath_rule_sets WHERE id = rs2;
  x := ath_rule_set('t1', 'o2', 'approve', rs2, 1, NULL, NULL, h);
  INSERT INTO rr VALUES ((SELECT state FROM ath_rule_sets WHERE id = rs) = 'retired' AND (SELECT rule_set_id FROM ath_reviews WHERE id = rv) = rs, 'T20 new version retires the old; certified reviews keep the version they used');
  res := ath_eval(${RULES}, '{"term_credits":12,"cumulative_gpa":2.0}'::jsonb);
  INSERT INTO rr VALUES (NOT EXISTS (SELECT 1 FROM jsonb_array_elements(res) e WHERE NOT (e->>'pass')::boolean), 'T21 meeting the minimum exactly passes');

  got := false; BEGIN UPDATE ath_rule_sets SET approver_id = author_id WHERE id = rs2; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'T22 the table refuses self-approved rules');
  got := false; BEGIN DELETE FROM ath_events; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'T23 history is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...ATH_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 700)); } };
  await go('real:', base);
  const muts: [string, string, string][] = [
    ['failing athlete eligible (T12)', `IF NOT l.passes THEN RETURN 'This athlete does not meet`, `IF false THEN RETURN 'This athlete does not meet`],
    ['exception self-approved (T14)', `IF l.exception_by = p_actor THEN RETURN`, `IF false THEN RETURN`],
    ['opener certifies (T16)', `IF rv.opened_by = p_actor THEN RETURN`, `IF false THEN RETURN`],
    ['undecided lines certified (T15)', `IF undecided > 0 THEN RETURN`, `IF false THEN RETURN`],
    ['missing GPA passes (T10)', `'pass', a.actual IS NOT NULL AND a.actual >= (r->>'value')::numeric)`, `'pass', coalesce(a.actual >= (r->>'value')::numeric, true))`],
    ['certified lines editable (T18)', `IF EXISTS (SELECT 1 FROM ath_reviews WHERE id = OLD.review_id AND state = 'certified') THEN RAISE`, `IF false THEN RAISE`],
  ];
  for (const [name, from, to] of muts) { const m = base.map((q) => q.replace(from, () => to)); console.log(`${name} applied:`, m.join('') !== base.join('')); await go(`mutant ${name}:`, m); }
}
