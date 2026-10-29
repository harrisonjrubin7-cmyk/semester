import { neon } from '@neondatabase/serverless';
import { EMP_PROFILE_MIGRATION } from '../src/lib/empProfileMigration';

// Rolled-back checks for employer discovery profiles and candidate search (lib/empProfileMigration.ts),
// house pattern: one transaction, RESULT raised, everything rolls back. Sequential statements throughout —
// function calls and count subqueries never share an expression (evaluation order is not guaranteed).
export const CHECKS = `DO $$
DECLARE x text;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  INSERT INTO rr VALUES (emp_profile_save('s1','ta','','Economics',2027,'python, excel','Data analyst',true) = 'Add a headline before employers can discover you.', 'P1 discoverable without a headline is refused');
  INSERT INTO rr VALUES (emp_profile_save('s1','ta','Data-minded economist','Economics',1999,'python','Data analyst',false) = 'Check the graduation year.', 'P2 an implausible graduation year is refused');
  INSERT INTO rr VALUES (emp_profile_save('s1','ta','Data-minded economist','Economics',2027,'python, excel','Data analyst',true) = 'ok', 'P3 a complete profile saves as discoverable');
  INSERT INTO rr VALUES (emp_profile_save('s2','ta','Quiet builder','Computer Science',2028,'rust','Systems engineer',false) = 'ok', 'P4 a non-discoverable profile saves');
  INSERT INTO rr VALUES (emp_profile_save('s3','tb','Data-minded economist','Economics',2027,'python','Data analyst',true) = 'ok', 'P5 a discoverable profile at another institution saves');
  INSERT INTO rr VALUES ((SELECT count(*) FROM emp_search_candidates(ARRAY['ta'], '', NULL)) = 1, 'C1 search sees only discoverable profiles at approved institutions');
  INSERT INTO rr VALUES ((SELECT student_id FROM emp_search_candidates(ARRAY['ta'], '', NULL)) = 's1', 'C2 the visible candidate is the opted-in one');
  INSERT INTO rr VALUES ((SELECT count(*) FROM emp_search_candidates(ARRAY['ta'], 'python', NULL)) = 1
    AND (SELECT count(*) FROM emp_search_candidates(ARRAY['ta'], 'rust', NULL)) = 0, 'C3 keyword search matches profile text — the hidden profile never matches');
  INSERT INTO rr VALUES ((SELECT count(*) FROM emp_search_candidates(ARRAY['ta'], '', 2028)) = 0
    AND (SELECT count(*) FROM emp_search_candidates(ARRAY['ta'], '', 2027)) = 1, 'C4 the graduation-year filter applies');
  INSERT INTO rr VALUES ((SELECT count(*) FROM emp_search_candidates(ARRAY['tb'], '', NULL)) = 1
    AND (SELECT count(*) FROM emp_search_candidates(ARRAY[]::text[], '', NULL)) = 0, 'C5 an employer approved nowhere sees nobody');
  PERFORM emp_profile_save('s1','ta','Data-minded economist','Economics',2027,'python, excel','Data analyst',false);
  INSERT INTO rr VALUES ((SELECT count(*) FROM emp_search_candidates(ARRAY['ta'], '', NULL)) = 0, 'C6 turning discovery off hides the profile immediately');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x, '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', EMP_PROFILE_MIGRATION);
  const m1 = EMP_PROFILE_MIGRATION.map((q) => q.replace('WHERE discoverable AND tenant_id = ANY (p_tenants)', () => 'WHERE tenant_id = ANY (p_tenants)'));
  console.log('undiscoverable mutant applied:', m1.join('') !== EMP_PROFILE_MIGRATION.join(''));
  await go('mutant hidden-profiles-searchable (C1/C3/C6):', m1);
  const m2 = EMP_PROFILE_MIGRATION.map((q) => q.replace('WHERE discoverable AND tenant_id = ANY (p_tenants)', () => 'WHERE discoverable'));
  console.log('tenant mutant applied:', m2.join('') !== EMP_PROFILE_MIGRATION.join(''));
  await go('mutant any-institution-searchable (C1/C5):', m2);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('emp_profiles') AS t`)));
}
