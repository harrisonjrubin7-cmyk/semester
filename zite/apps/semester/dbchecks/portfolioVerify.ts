import { neon } from '@neondatabase/serverless';
import { VFY_MIGRATION } from '../src/lib/vfyMigration';

export const CHECKS = `DO $$
DECLARE r text; c bigint;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO rr VALUES (vfy_request('stu','t1','item1',false,'sec1','ins',true) = 'You can only ask about your own portfolio items.', 'V1 only your own item');
  INSERT INTO rr VALUES (vfy_request('stu','t1','item1',true,'sec1','ins',false) = 'Ask an instructor of a section you took.', 'V2 only an instructor of a section you took');
  r := vfy_request('stu','t1','item1',true,'sec1','ins',true); c := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'V3 a valid request is recorded ' || coalesce(r,''));
  INSERT INTO rr VALUES (vfy_request('stu','t1','item1',true,'sec1','ins',true) = 'You already asked this instructor about this item.', 'V4 no duplicate open requests');
  INSERT INTO rr VALUES (vfy_decide('other','t1',c,true,'Completed the capstone with distinction.') = 'Only the instructor asked can answer this.', 'V5 another instructor cannot answer');
  INSERT INTO rr VALUES (vfy_decide('ins','t2',c,true,'Completed the capstone with distinction.') = 'Request not found.', 'V6 another institution cannot see it');
  INSERT INTO rr VALUES (vfy_decide('ins','t1',c,true,'ok') LIKE 'Write what you can verify%', 'V7 a verification needs a real statement');
  r := vfy_decide('ins','t1',c,true,'Completed the capstone with distinction.');
  INSERT INTO rr VALUES (r = 'ok' AND (SELECT state = 'Verified' FROM vfy_claims WHERE id = c), 'V8 the instructor verifies it');
  INSERT INTO rr VALUES (vfy_decide('ins','t1',c,false,'') = 'This request was already answered or withdrawn.', 'V9 an answer is final');
  INSERT INTO rr VALUES (vfy_withdraw('other','t1',c) = 'Request not found.', 'V10 only the student can withdraw it');
  r := vfy_withdraw('stu','t1',c);
  INSERT INTO rr VALUES (r = 'ok' AND (SELECT state = 'Withdrawn' FROM vfy_claims WHERE id = c), 'V11 the student withdraws the claim');
  INSERT INTO rr VALUES (vfy_request('stu','t1','item1',true,'sec1','ins',true) LIKE 'ok:%', 'V12 after withdrawal the student may ask again');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', VFY_MIGRATION);
  const m1 = VFY_MIGRATION.map((q) => q.replace(`IF r.instructor_id <> p_actor THEN RETURN 'Only the instructor asked can answer this.'; END IF;`, () => ''));
  console.log('any-instructor mutant applied:', m1.join('') !== VFY_MIGRATION.join(''));
  await go('mutant any-instructor-verifies (V5):', m1);
  const m2 = VFY_MIGRATION.map((q) => q.replace(`IF NOT p_taught THEN RETURN 'Ask an instructor of a section you took.'; END IF;`, () => ''));
  console.log('untaught mutant applied:', m2.join('') !== VFY_MIGRATION.join(''));
  await go('mutant any-instructor-asked (V2):', m2);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('vfy_claims') AS t`)));
}
