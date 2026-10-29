import { neon } from '@neondatabase/serverless';
import { DGV_MIGRATION } from '../src/lib/dgvMigration';
import { RSD_MIGRATION } from '../src/lib/rsdMigration';

// Institutional Researcher: cohorts, datasets, reproducible snapshots (lib/rsdMigration.ts). One rolled-back transaction.
// Run on app jeabiv2536: import { run } from './dbchecks/researchData'; await run();
export const CHECKS = `DO $$
DECLARE x text; c1 bigint; d1 bigint; d2 bigint; h text; v int; s1 bigint; s2 bigint; got boolean;
  ok_out jsonb := '{"tables":[{"key":"members_by_role","cells":[{"label":"Student","value":120,"suppressed":false},{"label":"Faculty","value":null,"suppressed":true}],"total":null}]}';
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO dgv_stewards (tenant_id, user_id, granted_by) VALUES ('t1', 'st1', 'adm'), ('t1', 'ir1', 'adm');
  INSERT INTO rr VALUES (rsd_set_analyst('ir1', false, 't1', 'ir1', true) = 'Only administrators appoint institutional researchers.', 'R1 only administrators appoint researchers');
  INSERT INTO rr VALUES (rsd_set_analyst('adm', true, 't1', 'adm', true) = 'Ask another administrator to change your own access.', 'R2 no self-appointment');
  PERFORM rsd_set_analyst('adm', true, 't1', 'ir1', true); PERFORM rsd_set_analyst('adm', true, 't1', 'ir2', true);

  x := rsd_def('t1', 'stu', 'draft', NULL, NULL, 'cohort', 'First-year students', 'Size of the first-year cohort for retention work', '{"roles":["Student"]}', NULL, NULL);
  INSERT INTO rr VALUES (x = 'Only institutional researchers draft cohorts and datasets.', 'R3 only researchers draft');
  x := rsd_def('t1', 'ir1', 'draft', NULL, NULL, 'cohort', 'First-year students', 'Size of the first-year cohort for retention work', '{"roles":["Student"],"gpa":"<2"}', NULL, NULL);
  INSERT INTO rr VALUES (x = 'Cohorts filter by roles and term only.', 'R4 cohort criteria are limited (no person-level filters)');
  x := rsd_def('t1', 'ir1', 'draft', NULL, NULL, 'cohort', 'Fall students', 'Students enrolled in a fall term section', '{"roles":["Student"],"term":"Fall 2026"}', NULL, NULL); c1 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'R5 a researcher drafts a cohort');
  x := rsd_def('t1', 'ir1', 'draft', NULL, NULL, 'dataset', 'Enrollment overview', 'Aggregate enrollment and request counts for the board', jsonb_build_object('metrics', '["enrollments_by_status"]'::jsonb, 'cohorts', jsonb_build_array(c1::text)), NULL, NULL);
  INSERT INTO rr VALUES (x = 'A dataset can only use approved cohorts.', 'R6 datasets use approved cohorts only');
  x := rsd_def('t1', 'ir1', 'draft', NULL, NULL, 'dataset', 'Enrollment overview', 'Aggregate enrollment and request counts for the board', '{"metrics":["student_names"]}', NULL, NULL);
  INSERT INTO rr VALUES (x = 'Only defined metrics can be used.', 'R7 datasets use defined metrics only');
  PERFORM rsd_def('t1', 'ir1', 'submit', c1, 1, NULL, NULL, NULL, NULL, NULL, NULL);
  SELECT spec_hash, rev INTO h, v FROM rsd_defs WHERE id = c1;
  x := rsd_def('t1', 'ir1', 'approve', c1, v, NULL, NULL, NULL, NULL, h, NULL);
  INSERT INTO rr VALUES (x = 'You wrote this definition, so another steward approves it.', 'R8 a researcher who is also a steward cannot approve their own');
  x := rsd_def('t1', 'ir2', 'approve', c1, v, NULL, NULL, NULL, NULL, h, NULL);
  INSERT INTO rr VALUES (x = 'Only a data steward approves research definitions.', 'R9 only stewards approve');
  x := rsd_def('t1', 'st1', 'approve', c1, v, NULL, NULL, NULL, NULL, 'stale', NULL);
  INSERT INTO rr VALUES (x = 'The definition changed since you opened it. Reload and review again.', 'R10 approval is bound to the definition seen');
  x := rsd_def('t1', 'st1', 'approve', c1, v, NULL, NULL, NULL, NULL, h, NULL);
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM rsd_defs WHERE id = c1) = 'approved', 'R11 a steward approves the cohort');
  x := rsd_def('t1', 'ir1', 'draft', NULL, NULL, 'dataset', 'Enrollment overview', 'Aggregate enrollment and request counts for the board', jsonb_build_object('metrics', '["enrollments_by_status","members_by_role"]'::jsonb, 'cohorts', jsonb_build_array(c1::text)), NULL, NULL); d1 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'R12 a dataset uses metrics and an approved cohort');

  SELECT spec_hash INTO h FROM rsd_defs WHERE id = d1;
  x := rsd_snapshot('t1', 'ir1', d1, h, 'analytics-v1', 10, ok_out);
  INSERT INTO rr VALUES (x = 'Only an approved dataset version is run.', 'R13 drafts cannot be run');
  PERFORM rsd_def('t1', 'ir1', 'submit', d1, 1, NULL, NULL, NULL, NULL, NULL, NULL);
  SELECT spec_hash, rev INTO h, v FROM rsd_defs WHERE id = d1;
  PERFORM rsd_def('t1', 'st1', 'approve', d1, v, NULL, NULL, NULL, NULL, h, 'Aggregates only');
  x := rsd_snapshot('t1', 'stu', d1, h, 'analytics-v1', 10, ok_out);
  INSERT INTO rr VALUES (x = 'Only institutional researchers run snapshots.', 'R14 only researchers run snapshots');
  x := rsd_snapshot('t1', 'ir1', d1, h, 'analytics-v1', 5, ok_out);
  INSERT INTO rr VALUES (x = 'The disclosure minimum is at least 10.', 'R15 the minimum cannot be lowered');
  x := rsd_snapshot('t1', 'ir1', d1, h, 'analytics-v1', 10, '{"tables":[{"key":"m","cells":[{"label":"Faculty","value":3,"suppressed":false}],"total":null}]}');
  INSERT INTO rr VALUES (x = 'The output shows a count under the disclosure minimum. Nothing was stored.', 'R16 an unsuppressed small cell is refused');
  x := rsd_snapshot('t1', 'ir1', d1, h, 'analytics-v1', 10, '{"tables":[{"key":"m","cells":[],"total":4}]}');
  INSERT INTO rr VALUES (x = 'The output shows a total under the disclosure minimum. Nothing was stored.', 'R17 a small total is refused');
  x := rsd_snapshot('t2', 'ir1', d1, h, 'analytics-v1', 10, ok_out);
  INSERT INTO rr VALUES (x = 'Only institutional researchers run snapshots.', 'R18 another institution cannot run it');
  x := rsd_snapshot('t1', 'ir1', d1, h, 'analytics-v1', 10, ok_out); s1 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT matches_previous IS NULL FROM rsd_snapshots WHERE id = s1), 'R19 first snapshot stored (nothing to compare)');
  x := rsd_snapshot('t1', 'ir2', d1, h, 'analytics-v1', 10, ok_out); s2 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES ((SELECT matches_previous FROM rsd_snapshots WHERE id = s2), 'R20 re-run with the same data reproduces the output');
  x := rsd_snapshot('t1', 'ir2', d1, h, 'analytics-v1', 10, '{"tables":[{"key":"members_by_role","cells":[{"label":"Student","value":121,"suppressed":false}],"total":121}]}'); s2 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES ((SELECT matches_previous = false FROM rsd_snapshots WHERE id = s2), 'R21 a re-run on moved data is flagged as different');

  SELECT rev INTO v FROM rsd_defs WHERE id = d1;
  x := rsd_def('t1', 'ir1', 'edit', d1, v, NULL, 'Changed title', 'A different purpose that is long enough', '{"metrics":["payment_plans"]}', NULL, NULL);
  INSERT INTO rr VALUES (x = 'Only drafts are edited. Start a new version instead.', 'R22 an approved dataset is never edited');
  x := rsd_def('t1', 'ir2', 'new_version', d1, v, NULL, NULL, NULL, NULL, NULL, NULL); d2 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES ((SELECT version = 2 AND state = 'draft' FROM rsd_defs WHERE id = d2) AND (SELECT state FROM rsd_defs WHERE id = d1) = 'approved', 'R23 a new version is a draft; v1 stays live');
  PERFORM rsd_def('t1', 'ir2', 'edit', d2, 1, NULL, 'Enrollment overview', 'Aggregate enrollment, request and plan counts', '{"metrics":["enrollments_by_status","payment_plans"]}', NULL, NULL);
  PERFORM rsd_def('t1', 'ir2', 'submit', d2, 2, NULL, NULL, NULL, NULL, NULL, NULL);
  SELECT spec_hash, rev INTO h, v FROM rsd_defs WHERE id = d2;
  x := rsd_def('t1', 'ir1', 'approve', d2, v, NULL, NULL, NULL, NULL, h, NULL);
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM rsd_defs WHERE id = d1) = 'retired', 'R24 approving v2 (by another steward) retires v1 ' || coalesce(x, ''));
  PERFORM rsd_set_analyst('adm', true, 't1', 'ir2', false);
  x := rsd_snapshot('t1', 'ir2', d2, h, 'analytics-v1', 10, ok_out);
  INSERT INTO rr VALUES (x = 'Only institutional researchers run snapshots.', 'R25 a revoked researcher loses access at once');
  got := false; BEGIN UPDATE rsd_snapshots SET output = '{}' WHERE id = s1; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'R26 snapshots are append-only');
  got := false; BEGIN UPDATE rsd_defs SET approver_id = author_id WHERE id = d2; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'R27 the table refuses self-approval');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...DGV_MIGRATION, ...RSD_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 700)); } };
  await go('real:', base);
  const muts: [string, string, string][] = [
    ['small cells stored (R16)', `WHERE jsonb_typeof(c->'value') = 'number' AND (c->>'value')::numeric > 0 AND (c->>'value')::numeric < p_min;`, `WHERE false;`],
    ['self-approval (R8; constraint must still stop it)', `IF d.author_id = p_actor THEN RETURN 'You wrote this definition`, `IF false THEN RETURN 'You wrote this definition`],
    ['unapproved cohorts (R6)', `AND d.kind = 'cohort' AND d.state = 'approved');`, `AND d.kind = 'cohort');`],
    ['edit approved (R22)', `IF d.state <> 'draft' THEN RETURN 'Only drafts are edited.`, `IF false THEN RETURN 'Only drafts are edited.`],
  ];
  for (const [name, from, to] of muts) { const m = base.map((q) => q.replace(from, () => to)); console.log(`${name} applied:`, m.join('') !== base.join('')); await go(`mutant ${name}:`, m); }
}
