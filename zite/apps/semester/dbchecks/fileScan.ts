import { neon } from '@neondatabase/serverless';
import { FIL_MIGRATION } from '../src/lib/filMigration';

export const CHECKS = `DO $$
DECLARE x text; a uuid; b uuid; n int;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  a := fil_put('t1','own','essay.pdf','application/pdf','submission','\\\\x255044462d'::bytea);
  b := fil_put('t1','own','other.pdf','application/pdf','submission','\\\\x255044462d'::bytea);
  INSERT INTO rr VALUES ((SELECT scan_status FROM fil_files WHERE id = a) = 'pending', 'Q1 a new file starts unscreened');
  INSERT INTO rr VALUES ((SELECT count(*) FROM fil_read('t1',a,'own')) = 1, 'Q2 the owner can still open their own unscreened file');
  PERFORM fil_grant('t1',a,'own','reader',7); PERFORM fil_grant('t1',b,'own','reader',7);
  INSERT INTO rr VALUES ((SELECT count(*) FROM fil_read('t1',a,'reader')) = 0, 'Q3 a shared but unscreened file is quarantined');
  INSERT INTO rr VALUES (fil_record_scan('t1',a,'clean','','semester-screen-1') = 'ok' AND (SELECT count(*) FROM fil_read('t1',a,'reader')) = 1, 'Q4 once clean, the grantee can open it');
  INSERT INTO rr VALUES (fil_record_scan('t1',b,'blocked','The PDF contains JavaScript.','semester-screen-1') = 'ok' AND (SELECT count(*) FROM fil_read('t1',b,'reader')) = 0, 'Q5 a blocked file stays quarantined');
  INSERT INTO rr VALUES (fil_record_scan('t1',b,'clean','','semester-screen-1') LIKE 'This file was blocked by this screen%', 'Q6 the same screen cannot clear what it blocked');
  INSERT INTO rr VALUES (fil_record_scan('t1',b,'maybe','','semester-screen-1') = 'Unknown scan result.', 'Q7 only clean or blocked can be recorded');
  INSERT INTO rr VALUES (fil_record_scan('t2',a,'clean','','semester-screen-1') = 'File not found.', 'Q8 another institution cannot record a scan');
  PERFORM fil_attach('t1','own',b,'submission','sub1');
  INSERT INTO rr VALUES ((SELECT count(*) FROM fil_read_attached('t1',b,'instructor','submission','sub1')) = 0, 'Q9 an instructor cannot open a blocked attachment');
  PERFORM fil_attach('t1','own',a,'submission','sub1');
  INSERT INTO rr VALUES ((SELECT count(*) FROM fil_read_attached('t1',a,'instructor','submission','sub1')) = 1, 'Q10 control: a clean attachment opens for the instructor');
  SELECT count(*) INTO n FROM fil_scans WHERE file_id IN (a, b);
  INSERT INTO rr VALUES (n = 2, 'Q11 each recorded scan is logged');
  INSERT INTO rr VALUES ((SELECT count(*) FROM fil_access_log WHERE action = 'denied' AND actor_id IN ('reader','instructor')) >= 3, 'Q12 quarantine refusals are logged');
  BEGIN DELETE FROM fil_scans; INSERT INTO rr VALUES (false, 'Q13 the scan log is append-only'); EXCEPTION WHEN others THEN INSERT INTO rr VALUES (true, 'Q13 the scan log is append-only'); END;
  SELECT string_agg(lbl, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 400)); } };
  await go('real:', FIL_MIGRATION);
  const noQuarantine = FIL_MIGRATION.map((q) => q.replace(`\n        OR NOT EXISTS (SELECT 1 FROM fil_files f WHERE f.id = p_file AND (f.scan_status = 'clean' OR f.owner_id = p_actor))`, () => '')
    .replace(`\n                      AND (f.scan_status = 'clean' OR f.owner_id = p_actor)`, () => ''));
  console.log('mutant applied:', noQuarantine.join('') !== FIL_MIGRATION.join(''));
  await go('mutant no-quarantine (Q3, Q5, Q9):', noQuarantine);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'fil_files' AND column_name = 'scan_status'`)));
}
