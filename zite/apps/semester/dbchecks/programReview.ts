import { neon } from '@neondatabase/serverless';
import { SREQ_MIGRATION } from '../src/lib/sreqMigration';
import { CAT_MIGRATION } from '../src/lib/catMigration';
import { CUR_MIGRATION } from '../src/lib/curMigration';
import { PRG_MIGRATION } from '../src/lib/prgMigration';
import { TCP_MIGRATION } from '../src/lib/tcpMigration';
import { DEA_MIGRATION } from '../src/lib/deaMigration';
import { PRW_MIGRATION } from '../src/lib/prwMigration';

// Program review (lib/prwMigration.ts). One rolled-back transaction, synthetic ids.
// Run on app jeabiv2536: import { run } from './dbchecks/programReview'; await run();
const S50 = 'This section describes the program in enough detail for an external reviewer to read.';
const REPORT = 'The program has a clear mission and strong advising. Assessment of the writing outcome relies on a single course, and the capstone has outgrown its current staffing. Students report long waits for two required methods courses. The reviewer recommends continuing with conditions.';
export const CHECKS = `DO $$
DECLARE x text; col bigint; dH bigint; dX bigint; dA bigint; pg bigint; r1 bigint; r2 bigint; v int; h text; got boolean;
  secs jsonb := jsonb_build_object('mission_and_outcomes', '${S50}', 'curriculum', '${S50}', 'student_success', '${S50}', 'faculty_and_resources', '${S50}');
  plan_ok jsonb := '[{"action":"Add a second writing assessment point","finding":0,"owner":"Assessment lead","due":"2027-05-01"},{"action":"Fund a capstone coordinator","finding":1,"owner":"Chair","due":"2027-08-15"}]';
  plan_gap jsonb := '[{"action":"Add a second writing assessment point","finding":0,"owner":"Assessment lead","due":"2027-05-01"}]';
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO tcp_units (tenant_id, name, kind) VALUES ('t1', 'College of Arts', 'college') RETURNING id INTO col;
  INSERT INTO inst_departments (tenant_id, name, chair_id) VALUES ('t1', 'History', 'chH') RETURNING id INTO dH;
  INSERT INTO inst_departments (tenant_id, name, chair_id) VALUES ('t1', 'Physics', 'chX') RETURNING id INTO dX;
  INSERT INTO tcp_unit_depts VALUES (dH, col, 't1');
  INSERT INTO dea_deans (tenant_id, unit_id, user_id, granted_by) VALUES ('t1', col, 'dn1', 'adm'), ('t1', col, 'dn2', 'adm');
  INSERT INTO prg_programs (tenant_id, request_key, author_id, department_id, code, version, name, credential, total_credits, term_cap, terms, outcomes, effective_term, rationale, state)
    VALUES ('t1', 'k1', 'chH', dH, 'HIST-BA', 1, 'History BA', 'bachelor', 120, 18, '[]', '[]', 'Fall 2026', 'Initial program version for the history major.', 'published') RETURNING id INTO pg;
  INSERT INTO prg_programs (tenant_id, request_key, author_id, department_id, code, version, name, credential, total_credits, term_cap, terms, outcomes, effective_term, rationale, state)
    VALUES ('t1', 'k2', 'chH', dH, 'HIST-MA', 1, 'History MA', 'master', 30, 12, '[]', '[]', 'Fall 2027', 'Proposed master program awaiting the committee.', 'submitted');

  x := prw_step('t1', 'dn1', 'open', NULL, NULL, '{"code":"HIST-MA","cycle":"2026-27","due":"2099-01-15"}');
  INSERT INTO rr VALUES (x = 'Only a published program is reviewed.', 'R1 only published programs are reviewed');
  x := prw_step('t1', 'chX', 'open', NULL, NULL, '{"code":"HIST-BA","cycle":"2026-27","due":"2099-01-15"}');
  INSERT INTO rr VALUES (x = 'Only a dean over this program''s department opens its review.', 'R2 only a covering dean opens');
  x := prw_step('t1', 'dn1', 'open', NULL, NULL, '{"code":"HIST-BA","cycle":"2026-27","due":"2000-01-15"}');
  INSERT INTO rr VALUES (x = 'Set a self-study due date in the future.', 'R3 due date in the future');
  x := prw_step('t1', 'dn1', 'open', NULL, NULL, '{"code":"HIST-BA","cycle":"2026-27","due":"2099-01-15"}'); r1 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'R4 the dean opens a review');
  x := prw_step('t1', 'dn2', 'open', NULL, NULL, '{"code":"HIST-BA","cycle":"2026-27","due":"2099-01-15"}');
  INSERT INTO rr VALUES (x = 'This program already has a review in progress.', 'R5 one review at a time');

  x := prw_step('t1', 'dn1', 'submit_self_study', r1, 1, jsonb_build_object('sections', secs));
  INSERT INTO rr VALUES (x = 'The department chair writes the self-study.', 'R6 only the chair writes the self-study');
  x := prw_step('t1', 'chH', 'submit_self_study', r1, 1, jsonb_build_object('sections', jsonb_build_object('curriculum', 'too short')));
  INSERT INTO rr VALUES (x LIKE 'Every section needs at least 50 characters%', 'R7 every section is written before submitting');
  x := prw_step('t1', 'chH', 'submit_self_study', r1, 1, jsonb_build_object('sections', secs));
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM prw_reviews WHERE id = r1) = 'external_review', 'R8 self-study submitted');

  x := prw_step('t1', 'dn1', 'record_report', r1, 2, jsonb_build_object('report', '${REPORT}', 'findings', '["Writing outcome assessed in one course only","Capstone has outgrown its staffing"]'::jsonb, 'recommendation', 'continue_with_conditions'));
  INSERT INTO rr VALUES (x = 'Record the reviewer and their conflict declaration first.', 'R9 no report before the reviewer is recorded');
  x := prw_step('t1', 'dn1', 'set_reviewer', r1, 2, '{"name":"Dr. A. Reviewer","affiliation":"Another University","noConflict":false}');
  INSERT INTO rr VALUES (x = 'Record that the reviewer declared no conflict of interest.', 'R10 conflict declaration required');
  x := prw_step('t1', 'dn1', 'set_reviewer', r1, 2, '{"name":"Dr. A. Reviewer","affiliation":"Another University","noConflict":true}');
  x := prw_step('t1', 'dn1', 'record_report', r1, 3, jsonb_build_object('report', '${REPORT}', 'findings', '["Writing outcome assessed in one course only","Capstone has outgrown its staffing"]'::jsonb, 'recommendation', 'continue_with_conditions'));
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM prw_reviews WHERE id = r1) = 'action_plan', 'R11 report recorded with findings');

  x := prw_step('t1', 'chH', 'submit_plan', r1, 4, jsonb_build_object('plan', plan_gap));
  INSERT INTO rr VALUES (x = 'Finding 2 has no action yet.', 'R12 every finding needs an action');
  x := prw_step('t1', 'chH', 'submit_plan', r1, 4, jsonb_build_object('plan', '[{"action":"Add a second writing assessment point","finding":7,"owner":"Assessment lead","due":"2027-05-01"}]'::jsonb));
  INSERT INTO rr VALUES (x = 'Each action answers one of the reviewer''s findings.', 'R13 actions refer to real findings');
  x := prw_step('t1', 'chH', 'submit_plan', r1, 4, jsonb_build_object('plan', plan_ok));
  SELECT plan_hash, rev INTO h, v FROM prw_reviews WHERE id = r1;
  x := prw_step('t1', 'dn1', 'approve_plan', r1, v, jsonb_build_object('seen', 'stale'));
  INSERT INTO rr VALUES (x = 'The plan changed since you opened it. Reload and read it again.', 'R14 approval bound to the plan seen');
  x := prw_step('t1', 'chX', 'approve_plan', r1, v, jsonb_build_object('seen', h));
  INSERT INTO rr VALUES (x = 'Only a dean over this program''s department does this.', 'R15 only a covering dean approves');
  x := prw_step('t1', 'dn1', 'approve_plan', r1, v, jsonb_build_object('seen', h));
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT count(*) FROM prw_actions WHERE review_id = r1) = 2, 'R16 approved; actions become tracked items');
  INSERT INTO rr VALUES ((SELECT state FROM prg_programs WHERE id = pg) = 'published', 'R17 the recommendation does not change the program');

  x := prw_step('t1', 'dn1', 'close', r1, v + 1, '{}');
  INSERT INTO rr VALUES (x = '2 action(s) are still open. Finish them or explain how they carry forward (20+ characters).', 'R18 no silent close with open actions');
  x := prw_step('t1', 'chH', 'action_done', r1, v + 1, '{"idx":0,"note":"Second assessment point added to HIST 3990"}');
  x := prw_step('t1', 'chH', 'action_done', r1, v + 2, '{"idx":0,"note":"Second assessment point added to HIST 3990"}');
  INSERT INTO rr VALUES (x = 'That action is not open.', 'R19 an action is completed once');
  x := prw_step('t1', 'dn1', 'close', r1, v + 2, '{"note":"Capstone coordinator funded in the 2027-28 budget request"}');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM prw_reviews WHERE id = r1) = 'closed', 'R20 closed with a carry-forward note');
  x := prw_step('t1', 'dn2', 'open', NULL, NULL, '{"code":"HIST-BA","cycle":"2031-32","due":"2099-01-15"}');
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'R21 the next cycle can start after closing');

  -- A chair who is also a dean of the college cannot approve their own department's plan.
  INSERT INTO inst_departments (tenant_id, name, chair_id) VALUES ('t1', 'Art History', 'dn2') RETURNING id INTO dA;
  INSERT INTO tcp_unit_depts VALUES (dA, col, 't1');
  INSERT INTO prg_programs (tenant_id, request_key, author_id, department_id, code, version, name, credential, total_credits, term_cap, terms, outcomes, effective_term, rationale, state)
    VALUES ('t1', 'k3', 'dn2', dA, 'ARTH-BA', 1, 'Art History BA', 'bachelor', 120, 18, '[]', '[]', 'Fall 2026', 'Initial program version for art history.', 'published');
  x := prw_step('t1', 'dn1', 'open', NULL, NULL, '{"code":"ARTH-BA","cycle":"2026-27","due":"2099-01-15"}'); r2 := substr(x, 4)::bigint;
  UPDATE prw_reviews SET state = 'action_plan', reviewer_name = 'Dr. B', reviewer_no_conflict = true, report = 'x', findings = '["Archive access is limited for students"]' WHERE id = r2;
  x := prw_step('t1', 'dn2', 'submit_plan', r2, 1, jsonb_build_object('plan', '[{"action":"Negotiate student archive access","finding":0,"owner":"Chair","due":"2027-03-01"}]'::jsonb));
  SELECT plan_hash, rev INTO h, v FROM prw_reviews WHERE id = r2;
  x := prw_step('t1', 'dn2', 'approve_plan', r2, v, jsonb_build_object('seen', h));
  INSERT INTO rr VALUES (x = 'You wrote this plan, so another dean decides it.', 'R25 a chair who is also a dean cannot approve their own plan');
  got := false; BEGIN UPDATE prw_reviews SET plan_decided_by = plan_by WHERE id = r1; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'R22 the table refuses self-approval of a plan');
  got := false; BEGIN UPDATE prw_reviews SET reviewer_no_conflict = false WHERE id = r1; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'R23 a report cannot stand without the conflict declaration');
  got := false; BEGIN DELETE FROM prw_events; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'R24 history is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...SREQ_MIGRATION, ...CAT_MIGRATION, ...CUR_MIGRATION, ...PRG_MIGRATION, ...TCP_MIGRATION, ...DEA_MIGRATION, ...PRW_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 700)); } };
  await go('real:', base);
  const muts: [string, string, string][] = [
    ['finding coverage skipped (R12)', `IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_plan) x WHERE (x->>'finding')::int = i) THEN RETURN`, `IF false THEN RETURN`],
    ['author approves own plan (R14 path)', `IF r.plan_by = p_actor THEN RETURN 'You wrote this plan`, `IF false THEN RETURN 'You wrote this plan`],
    ['silent close (R18)', `IF open_n > 0 AND length(trim(coalesce(p_payload->>'note', ''))) < 20 THEN RETURN`, `IF false THEN RETURN`],
    ['stale plan approved (R14)', `IF p_payload->>'seen' IS DISTINCT FROM r.plan_hash THEN RETURN`, `IF false THEN RETURN`],
    ['unpublished reviewed (R1)', `AND code = p_payload->>'code' AND state = 'published';`, `AND code = p_payload->>'code' ORDER BY state = 'published' LIMIT 1;`],
  ];
  for (const [name, from, to] of muts) { const m = base.map((q) => q.replace(from, () => to)); console.log(`${name} applied:`, m.join('') !== base.join('')); await go(`mutant ${name}:`, m); }
}
