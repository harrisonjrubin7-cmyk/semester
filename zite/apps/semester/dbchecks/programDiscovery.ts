import { neon } from '@neondatabase/serverless';
import { SPG_MIGRATION } from '../src/lib/spgMigration';
import { SHORTLIST_MIGRATION } from '../src/lib/shortlistMigration';

// Rolled-back checks for program fit-and-cost details (spg_save_details) and applicant shortlists
// (app_shortlist_add/remove), house pattern: one transaction, RESULT raised, everything rolls back.
export const CHECKS = `DO $$
DECLARE pid bigint; did bigint; r text; x text; i int;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  r := spg_save('mgr','ta',true,NULL,'Biology BS','Study life sciences in depth.','Fall 2027',true,0);
  pid := split_part(r, ':', 2)::bigint;
  PERFORM spg_set('mgr','ta',true,pid,'Published',1);
  r := spg_save('mgr','ta',true,NULL,'History BA','Study the human past in depth.','Fall 2027',true,0);
  did := split_part(r, ':', 2)::bigint;

  INSERT INTO rr VALUES (spg_save_details('mgr','ta',true,pid,1850000,'4 years','On campus','High-school diploma; biology recommended.',2) LIKE 'ok:%', 'D1 a catalog manager saves fit-and-cost details');
  INSERT INTO rr VALUES (EXISTS (SELECT 1 FROM spg_programs WHERE id = pid AND annual_cost_cents = 1850000 AND duration_text = '4 years' AND format = 'On campus' AND requirements LIKE 'High-school%' AND state = 'Draft' AND version = 3), 'D2 details land, the listing returns to Draft, the version moves');
  INSERT INTO rr VALUES (spg_save_details('mgr','ta',true,pid,100,'','','',2) = 'Someone changed this program since you opened it. Reload and try again.', 'D3 a stale version is refused');
  INSERT INTO rr VALUES (spg_save_details('mgr','ta',false,pid,100,'','','',3) = 'Only catalog managers edit public programs.', 'D4 a non-manager is refused');
  INSERT INTO rr VALUES (spg_save_details('mgr','ta',true,pid,-5,'','','',3) = 'The published annual cost cannot be negative.', 'D5 a negative cost is refused');
  INSERT INTO rr VALUES (spg_save_details('mgr','ta',true,pid,NULL,'','Carrier pigeon','',3) = 'Pick a format the listing offers.', 'D6 an unknown format is refused');
  INSERT INTO rr VALUES (spg_save_details('mgr','tb',true,pid,NULL,'','','',3) = 'Program not found.', 'D7 another institution cannot edit the details');

  INSERT INTO rr VALUES (app_shortlist_add('u1', pid) = 'Only published programs can be shortlisted.', 'S1 a draft (just edited) cannot be shortlisted');
  PERFORM spg_set('mgr','ta',true,pid,'Published',3);
  r := app_shortlist_add('u1', pid);
  INSERT INTO rr VALUES (r = 'ok', 'S2a a published program shortlists');
  r := app_shortlist_add('u1', pid);
  INSERT INTO rr VALUES (r = 'ok' AND (SELECT count(*) FROM app_shortlist WHERE user_id = 'u1') = 1, 'S2b adding again is a no-op, still one row');
  INSERT INTO rr VALUES (app_shortlist_add('u1', did) = 'Only published programs can be shortlisted.', 'S3 an unpublished program cannot be shortlisted');
  INSERT INTO rr VALUES (app_shortlist_add('u1', 999999) = 'Program not found.', 'S4 a missing program cannot be shortlisted');
  FOR i IN 1..11 LOOP
    r := spg_save('mgr','ta',true,NULL,'Program ' || i,'A published program listing.','Fall 2027',true,0);
    PERFORM spg_set('mgr','ta',true,split_part(r, ':', 2)::bigint,'Published',1);
    PERFORM app_shortlist_add('u1', split_part(r, ':', 2)::bigint);
  END LOOP;
  INSERT INTO rr VALUES ((SELECT count(*) FROM app_shortlist WHERE user_id = 'u1') = 12, 'S5 the shortlist fills to its cap of 12');
  r := spg_save('mgr','ta',true,NULL,'One Too Many','A published program listing.','Fall 2027',true,0);
  PERFORM spg_set('mgr','ta',true,split_part(r, ':', 2)::bigint,'Published',1);
  INSERT INTO rr VALUES (app_shortlist_add('u1', split_part(r, ':', 2)::bigint) = 'Your shortlist is full (12). Remove one to add another.', 'S6 the thirteenth program is refused');
  r := app_shortlist_add('u2', pid);
  INSERT INTO rr VALUES (r = 'ok' AND (SELECT count(*) FROM app_shortlist WHERE user_id = 'u2') = 1, 'S7a a second person keeps their own list');
  r := app_shortlist_remove('u2', pid);
  INSERT INTO rr VALUES (r = 'ok' AND (SELECT count(*) FROM app_shortlist WHERE user_id = 'u2') = 0
    AND (SELECT count(*) FROM app_shortlist WHERE user_id = 'u1' AND program_id = pid) = 1, 'S7b removing theirs leaves the other list untouched');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x, '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const MIG = [...SPG_MIGRATION, ...SHORTLIST_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', MIG);
  const m1 = SHORTLIST_MIGRATION.map((q) => q.replace(`IF n >= 12 THEN RETURN 'Your shortlist is full (12). Remove one to add another.'; END IF;`, () => ''));
  console.log('cap mutant applied:', m1.join('') !== SHORTLIST_MIGRATION.join(''));
  await go('mutant no-shortlist-cap (S6):', [...SPG_MIGRATION, ...m1]);
  const m2 = SHORTLIST_MIGRATION.map((q) => q.replace(`IF st <> 'Published' THEN RETURN 'Only published programs can be shortlisted.'; END IF;`, () => ''));
  console.log('unpublished mutant applied:', m2.join('') !== SHORTLIST_MIGRATION.join(''));
  await go('mutant shortlist-unpublished (S1/S3):', [...SPG_MIGRATION, ...m2]);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('app_shortlist') AS t`)));
}
