import { neon } from '@neondatabase/serverless';
import { PPR_MIGRATION } from '../src/lib/pprMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; a bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  r := ppr_record('s1','t1',10,true,7,20,900,8,10,4,6,false); a := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'P1 a readable paper attempt is recorded');
  INSERT INTO rr VALUES (ppr_record('s2','t1',10,false,7,20,900,8,10,4,6,false) = 'Guide not found.', 'P2 no record for a guide you cannot read');
  INSERT INTO rr VALUES (ppr_record('s1','t1',10,true,7,20,900,11,10,4,6,false) = 'That score is not possible.', 'P3 objective above the maximum refused');
  INSERT INTO rr VALUES (ppr_record('s1','t1',10,true,7,20,900,8,10,7,6,false) = 'That score is not possible.', 'P4 written above the maximum refused');
  INSERT INTO rr VALUES (ppr_record('s1','t1',10,true,7,20,5000,8,10,4,6,false) LIKE 'That time%', 'P5 more time than the paper allows refused');
  INSERT INTO rr VALUES (ppr_record('s1','t1',10,true,7,0,0,0,10,NULL,6,false) LIKE 'A paper runs%', 'P6 zero-minute paper refused');
  r := ppr_record('s1','t1',10,true,8,20,1260,3,10,NULL,6,true);
  INSERT INTO rr VALUES (r LIKE 'ok:%' AND (SELECT timed_out AND written IS NULL FROM ppr_attempts WHERE id = split_part(r,':',2)::bigint), 'P7 timed-out attempt with written part unmarked is kept');
  got := false; BEGIN UPDATE ppr_attempts SET objective = 10 WHERE id = a; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'P8 attempts cannot be edited afterwards');
  got := false; BEGIN INSERT INTO ppr_attempts (tenant_id, student_id, guide_id, seed, minutes, used_seconds, objective, objective_max, written_max) VALUES ('t1','s1',10,1,10,60,12,10,0); EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'P9 table refuses an impossible score');
  SELECT string_agg(lbl, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => {
    try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); }
    catch (e) { console.log(label, String((e as any).message).slice(0, 400)); }
  };
  await go('real:', PPR_MIGRATION);
  await go('mutant no-read-check (P2):', PPR_MIGRATION.map((q) => q.replace(`IF NOT coalesce(p_can_read, false) THEN RETURN 'Guide not found.'; END IF;`, () => '')));
  await go('mutant no-append-only (P8):', PPR_MIGRATION.filter((q) => !q.startsWith('CREATE TRIGGER')));
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('ppr_attempts') AS t`)));
}
