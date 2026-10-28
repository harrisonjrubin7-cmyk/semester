import { neon } from '@neondatabase/serverless';
import { SPG_MIGRATION } from '../src/lib/spgMigration';

export const CHECKS = `DO $$
DECLARE r text; pid bigint;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO rr VALUES (spg_save('x','t1',false,NULL,'Nursing BSN','A four-year nursing degree.','Fall 2027',true,0) = 'Only catalog managers edit public programs.', 'S1 only catalog managers write listings');
  r := spg_save('cm','t1',true,NULL,'Nursing BSN','short','Fall 2027',true,0); pid := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%' AND (SELECT state FROM spg_programs WHERE spg_programs.id = pid) = 'Draft', 'S2 a new listing is a draft');
  INSERT INTO rr VALUES (spg_save('cm','t1',true,NULL,'Nursing BSN','dup','',true,0) = 'A program with this name already exists.', 'S3 no duplicate names in one institution');
  INSERT INTO rr VALUES (spg_set('cm','t1',true,pid,'Published',1) LIKE 'Write a public summary%', 'S4 a listing needs a real summary to publish');
  r := spg_save('cm','t1',true,pid,'Nursing BSN','A four-year nursing degree with clinical placements.','Fall 2027',true,1);
  INSERT INTO rr VALUES (spg_set('cm','t2',true,pid,'Published',2) = 'Program not found.', 'S5 another institution cannot publish it');
  INSERT INTO rr VALUES (spg_set('cm','t1',true,pid,'Published',9) LIKE 'Someone changed%', 'S6 a stale publish is refused');
  r := spg_set('cm','t1',true,pid,'Published',2);
  INSERT INTO rr VALUES (r = 'ok' AND (SELECT state FROM spg_programs WHERE spg_programs.id = pid) = 'Published', 'S7 publishing makes it public');
  r := spg_save('cm','t1',true,pid,'Nursing BSN','A four-year nursing degree with clinical placements. Updated.','Fall 2027',true,3);
  INSERT INTO rr VALUES ((SELECT state FROM spg_programs WHERE spg_programs.id = pid) = 'Draft', 'S8 editing a published listing takes it back to draft');
  r := spg_set('cm','t1',true,pid,'Published',4); r := spg_set('cm','t1',true,pid,'Withdrawn',5);
  INSERT INTO rr VALUES (r = 'ok' AND (SELECT state FROM spg_programs WHERE spg_programs.id = pid) = 'Withdrawn', 'S9 withdrawing removes it');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', SPG_MIGRATION);
  const m1 = SPG_MIGRATION.map((q) => q.replace(`state = 'Draft', version = version + 1, edited_by = p_actor WHERE id = p_id;`, () => `version = version + 1, edited_by = p_actor WHERE id = p_id;`));
  console.log('edit-stays-public mutant applied:', m1.join('') !== SPG_MIGRATION.join(''));
  await go('mutant edit-stays-published (S8):', m1);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('spg_programs') AS t`)));
}
