import { neon } from '@neondatabase/serverless';
import { APK_MIGRATION } from '../src/lib/apkMigration';

const P = `'{"program":"Nursing BSN","statement":"x"}'::jsonb`;
export const CHECKS = `DO $$
DECLARE r text; x text; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO rr VALUES (apk_submit('other','appl','t1','app1',${P},'h1','h1',true,'key-apk-0001',true) = 'That application isn’t yours.', 'K1 only the applicant submits');
  INSERT INTO rr VALUES (apk_submit('appl','appl','t1','app1',${P},'h1','h1',true,'key-apk-0001',false) LIKE 'This institution is not accepting applications through Semester%', 'K2 a planning-mode institution cannot receive a submission');
  INSERT INTO rr VALUES (apk_submit('appl','appl','t1','app1',${P},'h1','h1',false,'key-apk-0001',true) LIKE 'Confirm that the application%', 'K3 the attestation is required');
  INSERT INTO rr VALUES (apk_submit('appl','appl','t1','app1',${P},'h2','h1',true,'key-apk-0001',true) LIKE 'The application changed since you previewed%', 'K4 a package that differs from the preview is refused');
  r := apk_submit('appl','appl','t1','app1',${P},'h1','h1',true,'key-apk-0001',true);
  INSERT INTO rr VALUES (r LIKE 'ok:%:1', 'K5 the previewed package is accepted as version 1 ' || coalesce(r,''));
  INSERT INTO rr VALUES ((SELECT received_at IS NOT NULL AND mode = 'native' FROM apk_packages WHERE application_id = 'app1'), 'K6 receipt is recorded in the same transaction (native mode)');
  x := apk_submit('appl','appl','t1','app1',${P},'h1','h1',true,'key-apk-0001',true);
  INSERT INTO rr VALUES (x = r || ':replay', 'K7 a retry replays the same receipt ' || coalesce(x,''));
  INSERT INTO rr VALUES (apk_submit('appl','appl','t1','app1',${P},'h1','h1',true,'key-apk-0002',true) = 'This application was already submitted.', 'K8 a second submission is refused');
  INSERT INTO rr VALUES (apk_submit('appl','appl','t1','app2',${P},'h9','h9',true,'key-apk-0001',true) = 'This request key was already used for a different submission.', 'K9 a reused key for other work is refused');
  INSERT INTO rr VALUES ((SELECT count(*) FROM apk_packages WHERE application_id = 'app1') = 1, 'K10 exactly one package');
  got := false; BEGIN UPDATE apk_packages SET package = '{}'::jsonb WHERE application_id = 'app1'; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'K11 a submitted package cannot be rewritten');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', APK_MIGRATION);
  const m1 = APK_MIGRATION.map((q) => q.replace(`IF p_sha IS DISTINCT FROM p_preview_sha THEN RETURN`, () => `IF false THEN RETURN`));
  console.log('preview mutant applied:', m1.join('') !== APK_MIGRATION.join(''));
  await go('mutant submit-unpreviewed (K4):', m1);
  const m2 = APK_MIGRATION.map((q) => q.replace(`IF NOT p_accepting THEN RETURN`, () => `IF false THEN RETURN`));
  console.log('planning mutant applied:', m2.join('') !== APK_MIGRATION.join(''));
  await go('mutant planning-receives (K2):', m2);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('apk_packages') AS t`)));
}
