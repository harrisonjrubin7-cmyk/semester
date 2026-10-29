import { neon } from '@neondatabase/serverless';
import { CAL_MIGRATION } from '../src/lib/calMigration';
import { TERM_MIGRATION } from '../src/lib/termMigration';

// Rolled-back checks for term completion -> archive -> retention (lib/termMigration.ts), in the house pattern:
// one transaction, fixtures inserted directly (calendar propose/decide is covered by the calendar checks), the
// DO block raises RESULT and the transaction rolls back. Two mutants must turn it red.
export const CHECKS = `DO $$
DECLARE x text;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  INSERT INTO cal_terms (tenant_id, term, version, reg_opens, reg_closes, add_drop_ends, classes_start, classes_end, state, proposed_by, decided_by)
    VALUES ('ta','Fall 2025',1,'2025-08-01T00:00Z','2025-09-01T00:00Z','2025-09-10','2025-08-20','2025-12-15','approved','reg-1','reg-2'),
           ('ta','Spring 2027',1,'2027-01-05T00:00Z','2027-02-01T00:00Z','2027-01-25','2027-01-15','2027-05-15','approved','reg-1','reg-2');
  INSERT INTO rr VALUES (term_complete('reg-1','ta','Fall 2029','') = 'There is no approved calendar for this term.', 'T1 an unapproved term cannot complete');
  INSERT INTO rr VALUES (term_complete('reg-1','ta','Spring 2027','') = 'Classes have not ended for this term yet.', 'T2 a term whose classes have not ended cannot complete');
  INSERT INTO rr VALUES (term_complete('reg-1','ta','Fall 2025','grades certified') IS NULL, 'T3a an ended term completes');
  INSERT INTO rr VALUES (term_state('ta','Fall 2025') = 'completed', 'T3b and reports completed');
  INSERT INTO rr VALUES (term_complete('reg-2','ta','Fall 2025','') = 'This term is already completed.', 'T4 completing twice is refused');
  INSERT INTO rr VALUES (term_archive('reg-1','ta','Spring 2027','') = 'Complete the term before archiving it.', 'T5 archiving an open term is refused');
  INSERT INTO rr VALUES (term_archive('reg-1','ta','Fall 2025','retention') IS NULL, 'T6a a completed term archives');
  INSERT INTO rr VALUES (term_state('ta','Fall 2025') = 'archived', 'T6b and reports archived');
  INSERT INTO rr VALUES (term_complete('reg-1','ta','Fall 2025','') = 'This term is already archived.', 'T6c completing an archived term is refused');
  INSERT INTO rr VALUES (term_archive('reg-1','ta','Fall 2025','') = 'This term is already archived.', 'T7 archiving twice is refused');
  INSERT INTO rr VALUES (term_state('tb','Fall 2025') = 'open', 'T8a another tenant sees the same term name as open');
  INSERT INTO rr VALUES (term_complete('reg-9','tb','Fall 2025','') = 'There is no approved calendar for this term.', 'T8b and cannot complete it');
  INSERT INTO rr VALUES ((SELECT count(*) FROM cal_events WHERE tenant_id = 'ta' AND action IN ('completed','archived')) = 2, 'T9 completion and archiving are on the append-only event trail');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x, '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', [...CAL_MIGRATION, ...TERM_MIGRATION]);
  const m1 = TERM_MIGRATION.map((q) => q.replace(`IF c.classes_end >= current_date THEN RETURN 'Classes have not ended for this term yet.'; END IF;`, () => ''));
  console.log('classes-not-ended mutant applied:', m1.join('') !== TERM_MIGRATION.join(''));
  await go('mutant complete-before-classes-end (T2):', [...CAL_MIGRATION, ...m1]);
  const m2 = TERM_MIGRATION.map((q) => q.replace(`IF s = 'open' THEN RETURN 'Complete the term before archiving it.'; END IF;`, () => ''));
  console.log('archive-open mutant applied:', m2.join('') !== TERM_MIGRATION.join(''));
  await go('mutant archive-before-complete (T5):', [...CAL_MIGRATION, ...m2]);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('term_lifecycle') AS t`)));
}
