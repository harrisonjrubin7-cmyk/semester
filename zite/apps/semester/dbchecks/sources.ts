import { neon } from '@neondatabase/serverless';
import { RDG_MIGRATION } from '../src/lib/rdgMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; a bigint; p bigint; c bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  r := rdg_save('s1','t1',NULL,NULL,false,'{"title":"Lemons","purpose":"lit review"}'::jsonb,0); a := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%:1', 'R1 student saves a private source');
  INSERT INTO rr VALUES (rdg_save('s2','t1',a,NULL,false,'{"title":"x"}'::jsonb,1) = 'Source not found.', 'R2 only the owner edits');
  INSERT INTO rr VALUES (rdg_save('s1','t2',a,NULL,false,'{"title":"x"}'::jsonb,1) = 'Source not found.', 'R3 other tenant cannot edit');
  INSERT INTO rr VALUES (rdg_save('s1','t1',a,NULL,false,'{"title":"x"}'::jsonb,5) LIKE 'This source changed%', 'R4 stale version refused');
  INSERT INTO rr VALUES (rdg_save('s1','t1',a,'sec9',false,'{"title":"x"}'::jsonb,1) = 'Choose one of your own courses.', 'R5 cannot attach to a course you are not in');
  INSERT INTO rr VALUES (rdg_save('s1','t1',NULL,NULL,false,'{"title":" "}'::jsonb,0) = 'Add a title.', 'R6 blank title refused');
  INSERT INTO rr VALUES (rdg_save('s1','t1',NULL,NULL,false,'{"title":"x","url":"javascript:alert(1)"}'::jsonb,0) LIKE 'Link should start%', 'R7 non-http link refused');
  INSERT INTO rr VALUES (rdg_publish('s1','t1',a,false,true) = 'Choose the course this reading is for.', 'R8 publish needs a course');
  PERFORM rdg_save('s1','t1',a,'sec1',true,'{"title":"Lemons","purpose":"lit review"}'::jsonb,1);
  INSERT INTO rr VALUES (rdg_publish('s1','t1',a,false,true) LIKE 'Only an instructor%', 'R9 student cannot publish to the course list');
  r := rdg_save('in1','t1',NULL,'sec1',true,'{"title":"Course reading","purpose":"instructor note"}'::jsonb,0); p := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (rdg_publish('in1','t1',p,true,true) IS NULL, 'R10 instructor publishes');
  INSERT INTO rr VALUES (rdg_save('in1','t1',p,NULL,true,'{"title":"moved"}'::jsonb,2) LIKE 'Take it off%', 'R11 a published reading cannot be moved out of its course');
  INSERT INTO rr VALUES (rdg_copy('s3','t1',p,false) = 'Source not found.', 'R12 not enrolled cannot copy');
  INSERT INTO rr VALUES (rdg_copy('s1','t1',p,true) LIKE 'ok:%', 'R13 enrolled student copies');
  SELECT id INTO c FROM rdg_sources WHERE copied_from = p AND owner_id = 's1';
  INSERT INTO rr VALUES ((SELECT NOT published AND data->>'purpose' IS NULL FROM rdg_sources WHERE id = c), 'R14 copy is private and drops the instructor note');
  INSERT INTO rr VALUES (rdg_copy('s1','t2',p,true) = 'Source not found.', 'R15 other tenant cannot copy');
  INSERT INTO rr VALUES (rdg_copy('s3','t1',a,true) = 'Source not found.', 'R16 an unpublished student source cannot be copied by others');
  r := rdg_import('s4','t1','[{"title":"A"},{"title":"B"}]'::jsonb);
  INSERT INTO rr VALUES (r = 'ok:2' AND (SELECT count(*) = 2 FROM rdg_sources WHERE owner_id = 's4'), 'R17 import saves all');
  r := rdg_import('s5','t1','[{"title":"A"},{"title":""}]'::jsonb);
  INSERT INTO rr VALUES (r LIKE 'Source 2:%' AND NOT EXISTS (SELECT 1 FROM rdg_sources WHERE owner_id = 's5'), 'R18 import is all or nothing');
  INSERT INTO rr VALUES (rdg_delete('s2','t1',a) = 'Source not found.', 'R19 only the owner deletes');
  got := false; BEGIN UPDATE rdg_sources SET published = true, section_id = NULL WHERE id = c; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'R20 table refuses published without a course');
  SELECT string_agg(lbl, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => {
    try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); }
    catch (e) { const x = e as any; console.log(label, String(x.message).slice(0, 700), x.where ?? ''); }
  };
  await go('real:', RDG_MIGRATION);
  // Mutants: each must turn its guard red.
  await go('mutant no-instructor-check (R9):', RDG_MIGRATION.map((q) => q.replace(`IF NOT coalesce(p_is_instructor, false) THEN RETURN 'Only an instructor of this course can add to its reading list.'; END IF;`, () => '')));
  await go('mutant copy-ignores-enrolment (R12):', RDG_MIGRATION.map((q) => q.replace('(d.published AND coalesce(p_can_read, false))', () => 'd.published')));
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('rdg_sources') AS t`)));
}
