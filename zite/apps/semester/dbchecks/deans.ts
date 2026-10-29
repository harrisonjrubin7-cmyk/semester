import { neon } from '@neondatabase/serverless';
import { SREQ_MIGRATION } from '../src/lib/sreqMigration';
import { TCP_MIGRATION } from '../src/lib/tcpMigration';
import { DEA_MIGRATION } from '../src/lib/deaMigration';

// Deans and college roll-ups (lib/deaMigration.ts). One rolled-back transaction, synthetic ids.
// Run on app jeabiv2536: import { run } from './dbchecks/deans'; await run();
const GOALS = `'[{"goal":"Grow first-year seminar seats","measure":"seats offered"},{"goal":"Hire a digital history lecturer","measure":"position filled"}]'::jsonb`;
export const CHECKS = `DO $$
DECLARE x text; col bigint; sch bigint; other bigint; dH bigint; dM bigint; dP bigint; dX bigint; p1 bigint; c1 bigint; r1 bigint; r2 bigint; e1 bigint; m1 bigint; h text; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO tcp_units (tenant_id, name, kind) VALUES ('t1', 'College of Arts', 'college') RETURNING id INTO col;
  INSERT INTO tcp_units (tenant_id, name, kind, parent_id) VALUES ('t1', 'School of Music', 'school', col) RETURNING id INTO sch;
  INSERT INTO tcp_units (tenant_id, name, kind) VALUES ('t1', 'College of Science', 'college') RETURNING id INTO other;
  INSERT INTO inst_departments (tenant_id, name, chair_id) VALUES ('t1', 'History', 'chH') RETURNING id INTO dH;
  INSERT INTO inst_departments (tenant_id, name, chair_id) VALUES ('t1', 'Music Theory', 'chM') RETURNING id INTO dM;
  INSERT INTO inst_departments (tenant_id, name, chair_id) VALUES ('t1', 'Philosophy', 'chP') RETURNING id INTO dP;
  INSERT INTO inst_departments (tenant_id, name, chair_id) VALUES ('t1', 'Physics', 'chX') RETURNING id INTO dX;
  INSERT INTO tcp_unit_depts VALUES (dH, col, 't1'), (dM, sch, 't1'), (dP, col, 't1'), (dX, other, 't1');

  INSERT INTO rr VALUES (dea_set_dean('t1', 'dn1', true, col, 'dn1', true) = 'Another administrator appoints you.', 'D1 no self-appointment');
  INSERT INTO rr VALUES (dea_set_dean('t1', 'chH', false, col, 'dn1', true) = 'Only an institution administrator appoints deans.', 'D2 only administrators appoint');
  x := dea_set_dean('t1', 'adm', true, col, 'dn1', true);
  x := dea_set_dean('t1', 'adm', true, other, 'dn2', true);
  INSERT INTO rr VALUES (dea_covers('t1', 'dn1', dH) AND dea_covers('t1', 'dn1', dM) AND NOT dea_covers('t1', 'dn1', dX) AND NOT dea_covers('t1', 'dn2', dH), 'D3 a dean covers nested units and nothing else');

  -- Department planning
  x := dea_plan('t1', 'chM', false, 'draft', NULL, NULL, 'department', dH, NULL, '2026-27', 'History plan 2026-27', ${GOALS}, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Only the department chair writes the department plan.', 'D4 only the chair writes the department plan');
  x := dea_plan('t1', 'chH', false, 'draft', NULL, NULL, 'department', dH, NULL, '2026-27', 'History plan 2026-27', '[{"goal":"x"}]'::jsonb, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Each goal needs a description and how it will be measured.', 'D5 goals need measures');
  x := dea_plan('t1', 'chH', false, 'draft', NULL, NULL, 'department', dH, NULL, '2026-27', 'History plan 2026-27', ${GOALS}, NULL, NULL); p1 := substr(x, 4)::bigint;
  x := dea_plan('t1', 'chH', false, 'submit', p1, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  SELECT plan_hash INTO h FROM dea_plans WHERE id = p1;
  x := dea_plan('t1', 'dn2', false, 'approve', p1, 2, NULL, NULL, NULL, NULL, NULL, NULL, h, NULL);
  INSERT INTO rr VALUES (x = 'Only a dean over this department decides its plan.', 'D6 another college''s dean cannot decide');
  x := dea_plan('t1', 'dn1', false, 'approve', p1, 2, NULL, NULL, NULL, NULL, NULL, NULL, 'stale', NULL);
  INSERT INTO rr VALUES (x = 'The plan changed since you opened it. Reload and read it again.', 'D7 decision bound to the plan seen');
  x := dea_plan('t1', 'dn1', false, 'return', p1, 2, NULL, NULL, NULL, NULL, NULL, NULL, h, 'short');
  INSERT INTO rr VALUES (x = 'Say what needs to change (10+ characters).', 'D8 returning needs a reason');
  x := dea_plan('t1', 'dn1', false, 'approve', p1, 2, NULL, NULL, NULL, NULL, NULL, NULL, h, NULL);
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM dea_plans WHERE id = p1) = 'approved', 'D9 the covering dean approves');

  -- College plan
  x := dea_plan('t1', 'dn1', false, 'draft', NULL, NULL, 'college', NULL, col, '2026-27', 'Arts college plan', ${GOALS}, NULL, NULL); c1 := substr(x, 4)::bigint;
  x := dea_plan('t1', 'dn1', true, 'submit', c1, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  SELECT plan_hash INTO h FROM dea_plans WHERE id = c1;
  x := dea_plan('t1', 'dn1', true, 'approve', c1, 2, NULL, NULL, NULL, NULL, NULL, NULL, h, NULL);
  INSERT INTO rr VALUES (x = 'You wrote this plan, so someone else decides it.', 'D10 a dean who is also an administrator cannot approve their own plan');
  x := dea_plan('t1', 'adm', true, 'approve', c1, 2, NULL, NULL, NULL, NULL, NULL, NULL, h, NULL);
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'D11 an administrator approves the college plan');

  -- Resources
  x := dea_request('t1', 'chH', 'submit', NULL, NULL, dH, '2026-27', 'position', 9000000, 'A lecturer in digital history to cover the new first-year seminars.'); r1 := substr(x, 4)::bigint;
  x := dea_request('t1', 'chM', 'submit', NULL, NULL, dM, '2026-27', 'equipment', 2000000, 'Replace six practice-room pianos that fail tuning within a week.'); r2 := substr(x, 4)::bigint;
  x := dea_request('t1', 'dn1', 'approve', r1, 1, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Your college has no allocation for that year yet. An administrator sets it.', 'D12 no approval without an allocation');
  x := dea_allocate('t1', 'dn1', false, col, '2026-27', 10000000, 'Provost budget letter 2026');
  INSERT INTO rr VALUES (x = 'Only an institution administrator sets allocations.', 'D13 deans do not set their own allocation');
  x := dea_allocate('t1', 'adm', true, col, '2026-27', 10000000, 'Provost budget letter 2026');
  x := dea_request('t1', 'dn1', 'approve', r1, 1, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'D14 approved within the allocation');
  x := dea_request('t1', 'dn1', 'approve', r2, 1, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Approving this would go over the year''s allocation (1000000 left).', 'D15 never over the allocation');
  x := dea_allocate('t1', 'adm', true, col, '2026-27', 5000000, 'Mid-year budget cut');
  INSERT INTO rr VALUES (x = 'That is less than has already been approved this year.', 'D16 allocation not cut below what is approved');
  x := dea_request('t1', 'dn1', 'decline', r2, 1, NULL, NULL, NULL, NULL, 'Funded from the music endowment instead');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM dea_requests WHERE id = r2) = 'declined', 'D17 decline with a reason');

  -- Escalations
  x := dea_escalate('t1', 'chX', 'raise', NULL, dH, 'staffing', 'Two sections have no instructor two weeks before term.');
  INSERT INTO rr VALUES (x = 'Only the department chair escalates to the dean.', 'D18 only the chair escalates');
  x := dea_escalate('t1', 'chH', 'raise', NULL, dH, 'staffing', 'Two sections have no instructor two weeks before term.'); e1 := substr(x, 4)::bigint;
  x := dea_escalate('t1', 'dn2', 'acknowledge', e1, NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Only a dean over this department handles it.', 'D19 only a covering dean handles it');
  x := dea_escalate('t1', 'dn1', 'resolve', e1, NULL, NULL, 'Adjuncts');
  INSERT INTO rr VALUES (x = 'Record how it was resolved (10+ characters).', 'D20 resolution needs a note');
  x := dea_escalate('t1', 'dn1', 'resolve', e1, NULL, NULL, 'Two adjuncts confirmed for the sections');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT acknowledged_at IS NOT NULL AND resolved_at IS NOT NULL FROM dea_escalations WHERE id = e1), 'D21 resolved and timed');

  -- Governance (electorate: chH, chM, chP)
  x := dea_motion('t1', 'dn2', 'open', NULL, col, 'Adopt a common syllabus template', 'The college adopts the shared syllabus template from fall 2027.', 7, NULL);
  INSERT INTO rr VALUES (x = 'Only the dean opens a motion for this unit.', 'D22 only the unit''s dean opens motions');
  x := dea_motion('t1', 'dn1', 'open', NULL, col, 'Adopt a common syllabus template', 'The college adopts the shared syllabus template from fall 2027.', 7, NULL); m1 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES ((SELECT cardinality(electorate) FROM dea_motions WHERE id = m1) = 3, 'D23 the electorate is the chairs in the unit, nested included');
  x := dea_motion('t1', 'chX', 'vote', m1, NULL, NULL, NULL, NULL, 'yes');
  INSERT INTO rr VALUES (x = 'Only the chairs in this unit vote on this motion.', 'D24 outsiders cannot vote');
  x := dea_motion('t1', 'chH', 'vote', m1, NULL, NULL, NULL, NULL, 'yes');
  x := dea_motion('t1', 'dn1', 'close', m1, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Voting is still open and not everyone has voted.', 'D25 no early close');
  UPDATE dea_motions SET closes_at = now() - interval '1 minute' WHERE id = m1;
  x := dea_motion('t1', 'dn1', 'close', m1, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO rr VALUES ((SELECT state = 'failed' AND outcome LIKE '%no quorum%' FROM dea_motions WHERE id = m1), 'D26 one vote of three is no quorum');
  x := dea_motion('t1', 'dn1', 'open', NULL, col, 'Adopt a common syllabus template', 'The college adopts the shared syllabus template from fall 2027.', 7, NULL); m1 := substr(x, 4)::bigint;
  x := dea_motion('t1', 'chH', 'vote', m1, NULL, NULL, NULL, NULL, 'yes');
  x := dea_motion('t1', 'chM', 'vote', m1, NULL, NULL, NULL, NULL, 'no');
  x := dea_motion('t1', 'chM', 'vote', m1, NULL, NULL, NULL, NULL, 'yes');
  x := dea_motion('t1', 'chP', 'vote', m1, NULL, NULL, NULL, NULL, 'abstain');
  x := dea_motion('t1', 'dn1', 'close', m1, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO rr VALUES ((SELECT state = 'carried' AND outcome LIKE '2 yes, 0 no, 1 abstain of 3%' FROM dea_motions WHERE id = m1), 'D27 everyone voted: closes early and carries; a changed vote counts once');

  got := false; BEGIN UPDATE dea_requests SET decider_id = requester_id WHERE id = r1; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'D28 the table refuses self-decision');
  got := false; BEGIN DELETE FROM dea_events; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'D29 history is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...SREQ_MIGRATION, ...TCP_MIGRATION, ...DEA_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 700)); } };
  await go('real:', base);
  const muts: [string, string, string][] = [
    ['dean covers only direct unit (D3)', `UNION ALL SELECT t.id, t.parent_id, up.depth + 1 FROM tcp_units t JOIN up ON t.id = up.parent_id WHERE up.depth < 20)`, `UNION ALL SELECT t.id, t.parent_id, up.depth + 1 FROM tcp_units t JOIN up ON t.id = up.parent_id WHERE false)`],
    ['over allocation (D15)', `IF used + r.amount_minor > cap THEN RETURN`, `IF false THEN RETURN`],
    ['no quorum carries (D26)', `cast_n >= quorum AND n_yes > n_no THEN`, `n_yes > n_no THEN`],
    ['early close (D25)', `IF now() < m.closes_at AND cast_n < cardinality(m.electorate) THEN RETURN`, `IF false THEN RETURN`],
    ['any dean decides (D6)', `IF p.level = 'department' AND NOT dea_covers(p_tenant, p_actor, p.dept_id) THEN RETURN`, `IF false THEN RETURN`],
    ['stale plan approved (D7)', `IF p_seen IS DISTINCT FROM p.plan_hash THEN RETURN`, `IF false THEN RETURN`],
  ];
  for (const [name, from, to] of muts) { const m = base.map((q) => q.replace(from, () => to)); console.log(`${name} applied:`, m.join('') !== base.join('')); await go(`mutant ${name}:`, m); }
}
