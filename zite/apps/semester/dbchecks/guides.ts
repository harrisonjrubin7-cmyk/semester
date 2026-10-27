import { neon } from '@neondatabase/serverless';
import { SGD_MIGRATION } from '../src/lib/sgdMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; g bigint; p bigint; c bigint; v int; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  r := sgd_save('s1','t1',NULL,'My notes','# U\nA :: B','sec1',0); g := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (sgd_save('s2','t1',g,'Hijack','x','sec1',1) = 'Guide not found.', 'G1 only the owner edits');
  INSERT INTO rr VALUES (sgd_save('s1','t1',g,'My notes','x','sec1',9) LIKE 'This guide changed%', 'G2 stale version');
  INSERT INTO rr VALUES (sgd_publish('s1','t1',g,false,true) LIKE 'Only an instructor%', 'G3 students cannot publish');
  r := sgd_save('in1','t1',NULL,'Official guide','# U\nQ1 :: A1\nQ2 :: A2',NULL,0); p := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (sgd_publish('in1','t1',p,true,true) = 'Choose the section this guide is for.', 'G4 publish needs a section');
  SELECT version INTO v FROM sgd_guides WHERE id = p;
  PERFORM sgd_save('in1','t1',p,'Official guide','# U\nQ1 :: A1\nQ2 :: A2','sec1',v);
  INSERT INTO rr VALUES (sgd_publish('in1','t1',p,true,true) IS NULL, 'G5 instructor publishes');
  INSERT INTO rr VALUES (sgd_copy('s3','t1',p,false) = 'Guide not found.', 'G6 not enrolled cannot copy');
  INSERT INTO rr VALUES (sgd_copy('s1','t1',g,false) LIKE 'ok:%', 'G7 owner copies own guide');
  r := sgd_copy('s1','t1',p,true); c := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES ((SELECT owner_id = 's1' AND NOT published AND copied_from = p FROM sgd_guides WHERE id = c), 'G8 enrolled copy is private and theirs');
  INSERT INTO rr VALUES (sgd_copy('s1','t2',p,true) = 'Guide not found.', 'G9 other tenant cannot copy');
  INSERT INTO rr VALUES (sgd_review('s3','t1',g,true,'U:0',2,2) = 'Guide not found.', 'G10 private guide not reviewable by others');
  INSERT INTO rr VALUES (sgd_review('s1','t1',p,true,'U:0',2,2) IS NULL, 'G11 enrolled student reviews published guide');
  PERFORM sgd_review('s1','t1',p,true,'U:0',1,1);
  INSERT INTO rr VALUES ((SELECT box = 1 FROM sgd_reviews WHERE guide_id = p AND student_id = 's1'), 'G12 review updates the box');
  INSERT INTO rr VALUES (sgd_attempt('s1','t1',p,true,7,3,2) = 'That score is not possible.', 'G13 impossible score refused');
  INSERT INTO rr VALUES (sgd_attempt('s1','t1',p,true,7,2,2) IS NULL, 'G14 attempt recorded');
  INSERT INTO rr VALUES (sgd_delete('s2','t1',g) = 'Guide not found.', 'G15 only owner deletes');
  got := false; BEGIN UPDATE sgd_guides SET published = true, section_id = NULL WHERE id = g; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'G16 table refuses published without section');
  SELECT string_agg(lbl, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...SGD_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('sgd_guides') AS t`)));
}
