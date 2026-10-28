import { neon } from '@neondatabase/serverless';
import { ADM_MIGRATION } from '../src/lib/admMigration';

export const CHECKS = `DO $$
DECLARE r text; x text;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO rr VALUES (adm_draft('rev1','t1',false,'app1','Admitted','','Welcome to Northgate.',1) = 'Assign a reviewer first.', 'D1 nobody decides an unassigned application');
  INSERT INTO rr VALUES (adm_assign('rev1','t1',false,'app1','appl1','rev1') = 'Only an administrator assigns reviewers.', 'D2 a reviewer cannot assign themselves');
  INSERT INTO rr VALUES (adm_assign('adm1','t1',true,'app1','appl1','appl1') LIKE 'An applicant cannot review%', 'D3 the applicant cannot be the reviewer');
  r := adm_assign('adm1','t1',true,'app1','appl1','rev1');
  INSERT INTO rr VALUES (r = 'ok', 'D4 an administrator assigns a reviewer ' || coalesce(r,''));
  INSERT INTO rr VALUES (adm_draft('rev2','t1',false,'app1','Admitted','','Welcome to Northgate.',1) = 'Only the assigned reviewer can decide this application.', 'D5 another reviewer cannot decide it');
  INSERT INTO rr VALUES (adm_draft('rev1','t2',false,'app1','Admitted','','Welcome to Northgate.',1) = 'Assign a reviewer first.', 'D6 another institution cannot see it');
  INSERT INTO rr VALUES (adm_draft('rev1','t1',false,'app1','Admitted','','short',1) LIKE 'Write the message%', 'D7 the applicant message is required');
  INSERT INTO rr VALUES (adm_release('rev1','t1',false,'app1',1) = 'Draft a decision before releasing it.', 'D8 nothing to release before a draft');
  r := adm_draft('rev1','t1',false,'app1','Admitted','strong essay; test score borderline','Welcome to Northgate.',1);
  INSERT INTO rr VALUES (r = 'ok:2', 'D9 the reviewer drafts a decision ' || coalesce(r,''));
  INSERT INTO rr VALUES ((SELECT state = 'Drafted' AND released_at IS NULL FROM adm_reviews WHERE application_id = 'app1'), 'D10 a draft is not released');
  INSERT INTO rr VALUES (adm_release('rev1','t1',false,'app1',1) LIKE 'The draft changed%', 'D11 releasing a version other than the reviewed draft is refused');
  INSERT INTO rr VALUES (adm_release('appl1','t1',true,'app1',2) LIKE 'You can%t release your own%', 'D12 the applicant cannot release their own decision');
  r := adm_release('rev1','t1',false,'app1',2);
  INSERT INTO rr VALUES (r = 'ok:Admitted', 'D13 the reviewer releases it ' || coalesce(r,''));
  x := adm_release('rev1','t1',false,'app1',3);
  INSERT INTO rr VALUES (x = 'The decision is already released.', 'D14 release happens once ' || coalesce(x,''));
  INSERT INTO rr VALUES (adm_draft('rev1','t1',false,'app1','Declined','','Changed our mind here.',3) = 'The decision is already released.', 'D15 a released decision cannot be redrafted');
  INSERT INTO rr VALUES (adm_assign('adm1','t1',true,'app1','appl1','rev2') = 'The decision is already released.', 'D16 a released decision cannot be reassigned');
  INSERT INTO rr VALUES ((SELECT count(*) FROM adm_events WHERE application_id = 'app1') = 3, 'D17 assigned, drafted, released are logged');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', ADM_MIGRATION);
  const m1 = ADM_MIGRATION.map((q) => q.replace(`IF r.reviewer_id <> p_actor AND NOT p_is_admin THEN RETURN 'Only the assigned reviewer can decide this application.'; END IF;`, () => ''));
  console.log('any-reviewer mutant applied:', m1.join('') !== ADM_MIGRATION.join(''));
  await go('mutant any-reviewer-decides (D5):', m1);
  const m2 = ADM_MIGRATION.map((q) => q.replace(`IF r.state <> 'Drafted' THEN RETURN 'Draft a decision before releasing it.'; END IF;`, () => ''));
  console.log('release-undrafted mutant applied:', m2.join('') !== ADM_MIGRATION.join(''));
  await go('mutant release-without-draft (D8):', m2);
  const m3 = ADM_MIGRATION.map((q) => q.replace(`IF r.version <> p_expected THEN RETURN 'The draft changed since you reviewed it. Reload and check it again.'; END IF;`, () => ''));
  console.log('stale-release mutant applied:', m3.join('') !== ADM_MIGRATION.join(''));
  await go('mutant release-unreviewed-version (D11):', m3);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('adm_reviews') AS t`)));
}
