import { neon } from '@neondatabase/serverless';
import { BDG_MIGRATION } from '../src/lib/bdgMigration';

// E11 Budget and Planning: planner/approver separation, one open plan and one approved plan per
// fiscal year (lib/bdgMigration.ts). One transaction, RESULT raised, everything rolls back.
const CHECKS = `DO $$
DECLARE x text; out text; pid1 bigint; pid2 bigint; st text;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  out := bdg_set_staff('plan1', 'tb', 'plan1', 'planner', true);
  INSERT INTO rr VALUES (out LIKE 'Ask another administrator%', 'D1 nobody grants their own planning role');
  PERFORM bdg_set_staff('root', 'tb', 'plan1', 'planner', true);
  PERFORM bdg_set_staff('root', 'tb', 'plan1', 'approver', true);
  PERFORM bdg_set_staff('root', 'tb', 'appr1', 'approver', true);

  out := bdg_create('rando', 'tb', 2030, 'FY30 operating plan');
  INSERT INTO rr VALUES (out LIKE 'Only a budget planner%', 'D2 only a planner starts a plan');
  out := bdg_create('plan1', 'tb', 2030, 'FY30 operating plan');
  INSERT INTO rr VALUES (out LIKE 'ok:%', 'D3 a planner starts the draft');
  pid1 := split_part(out, ':', 2)::bigint;
  out := bdg_create('plan1', 'tb', 2030, 'Second open plan');
  INSERT INTO rr VALUES (out LIKE '%already open%', 'D4 one open plan per year');
  out := bdg_propose('plan1', 'tb', pid1);
  INSERT INTO rr VALUES (out LIKE 'Add at least one budget line%', 'D5 an empty plan cannot be proposed');
  out := bdg_set_line('appr1', 'tb', pid1, 'OPS', 'Operations', 10000, 20000, 30000, 40000);
  INSERT INTO rr VALUES (out LIKE 'Only a budget planner%', 'D6 approvers do not edit lines');
  out := bdg_set_line('plan1', 'tb', pid1, 'ops', 'Operations', 10000, 20000, 30000, 40000);
  INSERT INTO rr VALUES (out IS NULL AND (SELECT q1 + q2 + q3 + q4 FROM bdg_lines WHERE plan_id = pid1 AND code = 'OPS') = 100000, 'D7 a planner sets a quarterly line (code normalized)');
  out := bdg_propose('plan1', 'tb', pid1);
  INSERT INTO rr VALUES (out IS NULL, 'D8 the plan proposes');
  out := bdg_set_line('plan1', 'tb', pid1, 'OPS', 'Operations', 1, 1, 1, 1);
  INSERT INTO rr VALUES (out LIKE 'Only a draft plan%', 'D9 a proposed plan is frozen');
  out := bdg_decide('plan1', 'tb', pid1, true, '');
  INSERT INTO rr VALUES (out LIKE 'The planner who wrote this plan%', 'D10 the author cannot approve their own plan');
  out := bdg_decide('appr1', 'tb', pid1, false, '');
  INSERT INTO rr VALUES (out LIKE 'Say why%', 'D11 sending back needs a reason');
  out := bdg_decide('appr1', 'tb', pid1, false, 'Quarters look light in Q1.');
  SELECT state INTO st FROM bdg_plans WHERE id = pid1;
  INSERT INTO rr VALUES (out IS NULL AND st = 'draft', 'D12 an approver sends the plan back to draft');
  PERFORM bdg_propose('plan1', 'tb', pid1);
  out := bdg_decide('appr1', 'tb', pid1, true, 'Adopted.');
  SELECT state INTO st FROM bdg_plans WHERE id = pid1;
  INSERT INTO rr VALUES (out IS NULL AND st = 'approved', 'D13 another approver adopts the plan');

  out := bdg_create('plan1', 'tb', 2030, 'FY30 operating plan, revised');
  INSERT INTO rr VALUES (out LIKE 'ok:%', 'D14 a new version can start once none is open');
  pid2 := split_part(out, ':', 2)::bigint;
  PERFORM bdg_set_line('plan1', 'tb', pid2, 'OPS', 'Operations', 50000, 50000, 50000, 50000);
  PERFORM bdg_propose('plan1', 'tb', pid2);
  out := bdg_decide('appr1', 'tb', pid2, true, 'Adopted.');
  SELECT state INTO st FROM bdg_plans WHERE id = pid1;
  INSERT INTO rr VALUES (out IS NULL AND st = 'superseded' AND (SELECT count(*) FROM bdg_plans WHERE tenant_id = 'tb' AND fiscal_year = 2030 AND state = 'approved') = 1, 'D15 approving v2 supersedes v1 — exactly one approved plan per year');
  INSERT INTO rr VALUES ((SELECT count(*) FROM bdg_events WHERE plan_id IN (pid1, pid2)) >= 8, 'D16 the lifecycle is in the event log');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x, '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', BDG_MIGRATION);
  const m1 = BDG_MIGRATION.map((q) => q.replace('IF pl.created_by = p_actor THEN', () => 'IF false THEN'));
  console.log('two-person mutant applied:', m1.join('') !== BDG_MIGRATION.join(''));
  await go('mutant author-approves-own (D10):', m1);
  const m2 = BDG_MIGRATION.map((q) => q.replace("AND state = 'approved' AND id <> p_plan RETURNING id", () => "AND state = 'approved' AND id = -1 RETURNING id"));
  console.log('supersede mutant applied:', m2.join('') !== BDG_MIGRATION.join(''));
  await go('mutant no-supersede (D15):', m2);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('bdg_plans') AS t`)));
}
