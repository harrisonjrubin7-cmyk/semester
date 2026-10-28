import { neon } from '@neondatabase/serverless';
import { OGR_MIGRATION } from '../src/lib/ogrMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; got boolean; e1 bigint;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  -- course grade proposal and release
  INSERT INTO rr VALUES (ogr_propose('s9','t1','enr1','sec1','stu1',false,'A','{}'::jsonb,0) LIKE 'Only an instructor%', 'O1 a non-instructor cannot propose');
  INSERT INTO rr VALUES (ogr_propose('in1','t1','enr1','sec1','stu1',true,'A+','{}'::jsonb,0) = 'Unknown grade.', 'O2 unknown grade refused');
  INSERT INTO rr VALUES (ogr_propose('in1','t1','enr1','sec1','stu1',true,'B+','{"items":2}'::jsonb,0) = 'ok:1', 'O3 instructor proposes from a gradebook snapshot');
  INSERT INTO rr VALUES (ogr_propose('in1','t1','enr1','sec1','stuX',true,'B+','{}'::jsonb,1) LIKE 'This enrollment belongs%', 'O4 a proposal cannot be moved to another student');
  r := ogr_release('in1','t1','enr1',true,1);
  INSERT INTO rr VALUES (r IS NULL AND (SELECT released FROM ogr_proposals WHERE enrollment_id = 'enr1'), 'O5 course grade released to the student');
  INSERT INTO rr VALUES (NOT EXISTS (SELECT 1 FROM ogr_entries WHERE enrollment_id = 'enr1'), 'O6 release does not create an official grade');
  -- certification bound to the exact version
  INSERT INTO rr VALUES (ogr_certify('in2','t1','enr1',false,1) LIKE 'Only the instructor of record%', 'O7 only the instructor of record certifies');
  INSERT INTO rr VALUES (ogr_certify('in1','t1','enr1',true,0) LIKE 'This grade changed%', 'O8 certifying a stale version refused');
  r := ogr_certify('in1','t1','enr1',true,1);
  INSERT INTO rr VALUES (r IS NULL AND (SELECT state = 'Certified' AND certified_version = 1 FROM ogr_proposals WHERE enrollment_id = 'enr1'), 'O9 instructor of record certifies version 1');
  r := ogr_propose('in1','t1','enr1','sec1','stu1',true,'A-','{}'::jsonb,1);
  INSERT INTO rr VALUES (r = 'ok:2' AND (SELECT state = 'Draft' AND certified_by IS NULL FROM ogr_proposals WHERE enrollment_id = 'enr1'), 'O10 editing after certification withdraws it');
  INSERT INTO rr VALUES (ogr_post('reg1','t1','enr1',true,'key-0001',2) LIKE 'The instructor of record has not certified%', 'O11 cannot post an uncertified version');
  PERFORM ogr_certify('in1','t1','enr1',true,2);
  -- posting: registrar only, separation of duties, idempotent
  INSERT INTO rr VALUES (ogr_post('in9','t1','enr1',false,'key-0001',2) LIKE 'Only registrar staff%', 'O12 non-registrar cannot post');
  INSERT INTO rr VALUES (ogr_post('in1','t1','enr1',true,'key-0001',2) LIKE 'The person who certified%', 'O13 certifier cannot also post');
  r := ogr_post('reg1','t1','enr1',true,'key-0001',2); e1 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%:1' AND (SELECT grade = 'A-' AND kind = 'Original' AND authority = 'design' AND certified_by = 'in1' FROM ogr_entries WHERE id = e1), 'O14 registrar posts revision 1 (design mode by default)');
  INSERT INTO rr VALUES (ogr_post('reg1','t1','enr1',true,'key-0001',2) = 'ok:' || e1 || ':1:replay', 'O15 the same request replays the same receipt');
  INSERT INTO rr VALUES ((SELECT count(*) = 1 FROM ogr_entries WHERE enrollment_id = 'enr1'), 'O16 a replay never creates a second official grade');
  INSERT INTO rr VALUES (ogr_post('reg1','t1','enr1',true,'key-0002',2) LIKE 'Already posted%', 'O17 a second post with a new key is refused');
  INSERT INTO rr VALUES (ogr_propose('in1','t1','enr1','sec1','stu1',true,'A','{}'::jsonb,2) LIKE 'The official grade is already posted%', 'O18 a posted grade cannot be changed from the gradebook');
  -- corrections append; history is never rewritten
  INSERT INTO rr VALUES (ogr_correct('reg1','t1','enr1',true,'A','typo','key-0003') LIKE 'Give the reason%', 'O19 correction needs a reason');
  r := ogr_correct('reg1','t1','enr1',true,'A','Arithmetic error in the final exam total','key-0003');
  INSERT INTO rr VALUES (r LIKE 'ok:%:2' AND (SELECT previous_grade = 'A-' AND grade = 'A' AND kind = 'Correction' FROM ogr_entries WHERE enrollment_id = 'enr1' AND revision = 2), 'O20 correction appends revision 2 with the previous grade');
  INSERT INTO rr VALUES (ogr_correct('reg1','t1','enr1',true,'B','Arithmetic error in the final exam total','key-0003') LIKE 'This request key was already used%', 'O21 reused key with a different payload is refused');
  INSERT INTO rr VALUES (ogr_correct('reg1','t2','enr1',true,'B','Arithmetic error in the final exam total','key-0009') LIKE 'There is no official grade%', 'O22 another tenant cannot correct this grade');
  got := false; BEGIN UPDATE ogr_entries SET grade = 'F' WHERE id = e1; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'O23 official entries cannot be edited');
  got := false; BEGIN DELETE FROM ogr_entries WHERE id = e1; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'O24 official entries cannot be deleted');
  got := false; BEGIN INSERT INTO ogr_entries (tenant_id, enrollment_id, section_id, student_id, revision, grade, kind, posted_by, certified_by, authority, idem_key, payload_hash) VALUES ('t1','enr2','sec1','stu2',1,'A','Original','reg1','reg1','design','key-x0001','h'); EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'O25 the table itself refuses certifier = poster');
  -- authority modes
  INSERT INTO rr VALUES (aum_mode('t1','records') = 'design', 'O26 records default to design mode');
  INSERT INTO rr VALUES (aum_set('ad1','t1','records','authoritative',true,'ad1',true,'test-run-42','go') LIKE 'A second administrator%', 'O27 one administrator cannot turn on authority alone');
  INSERT INTO rr VALUES (aum_set('ad1','t1','records','authoritative',true,'ad2',true,'','go') LIKE 'Link the activation evidence%', 'O28 authority needs evidence');
  INSERT INTO rr VALUES (aum_set('st1','t1','records','shadow',false,NULL,false,'','x') LIKE 'Only an institution administrator%', 'O29 non-administrator cannot change mode');
  r := aum_set('ad1','t1','records','pilot',true,'ad2',true,'pilot-signoff-1','Spring pilot');
  INSERT INTO rr VALUES (r IS NULL AND aum_mode('t1','records') = 'pilot' AND aum_mode('t2','records') = 'design', 'O30 two administrators with evidence turn on a pilot for one tenant only');
  got := false; BEGIN UPDATE aum_modes SET mode = 'authoritative' WHERE tenant_id = 't1'; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'O31 authority history cannot be rewritten');
  got := false; BEGIN UPDATE ogr_events SET what = 'x'; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'O32 the grade event log cannot be rewritten');
  SELECT string_agg(lbl, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => {
    try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); }
    catch (e) { const x = e as any; console.log(label, String(x.message).slice(0, 600), x.where ?? ''); }
  };
  await go('real:', OGR_MIGRATION);
  await go('mutant no-separation-of-duties (O13):', OGR_MIGRATION.map((q) => q.replace(`IF d.certified_by = p_actor THEN RETURN 'The person who certified a grade cannot also post it.'; END IF;`, () => '')));
  await go('mutant post-ignores-certified-version (O11):', OGR_MIGRATION.map((q) => q.replace(`IF d.state <> 'Certified' OR d.certified_version <> d.version THEN`, () => `IF false THEN`)));
  await go('mutant replay-ignores-payload (O21):', OGR_MIGRATION.map((q) => q.replace(`IF FOUND THEN IF prior.payload_hash = h THEN`, () => `IF FOUND THEN IF true THEN`)));
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('ogr_entries') AS e, to_regclass('aum_modes') AS m`)));
}
