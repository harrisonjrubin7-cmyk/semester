import { neon } from '@neondatabase/serverless';
import { SREQ_MIGRATION } from '../src/lib/sreqMigration';
import { DFM_MIGRATION } from '../src/lib/dfmMigration';
import { DST_MIGRATION } from '../src/lib/dstMigration';

// Department Admin "staffing coordination" (lib/dstMigration.ts). One rolled-back transaction with synthetic people.
// Run on app jeabiv2536: import { run } from './dbchecks/departmentStaffing'; await run();
export const CHECKS = `DO $$
DECLARE x text; d1 bigint; dX bigint; n1 bigint; o1 bigint; o2 bigint; o3 bigint; v int; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO inst_departments (tenant_id, name, chair_id) VALUES ('t1', 'zz History', 'chair1') RETURNING id INTO d1;
  INSERT INTO inst_departments (tenant_id, name, chair_id) VALUES ('t2', 'zz Biology', 'chairB') RETURNING id INTO dX;
  PERFORM dfm_set_admin('adm', true, 't1', d1, 'da1', true); PERFORM dfm_set_admin('adm', true, 't1', d1, 'chair1', true);

  x := dst_need('t1', 'stu', 'post', NULL, NULL, d1, 'Fall 2026', 'hist 300', 'teaching_assistant', 10, 2, '');
  INSERT INTO rr VALUES (x = 'Only that department''s admins post staffing needs.', 'S1 only department admins post needs');
  x := dst_need('t1', 'da1', 'post', NULL, NULL, dX, 'Fall 2026', 'BIO 100', 'grader', 5, 1, '');
  INSERT INTO rr VALUES (x = 'Department not found.', 'S2 another institution''s department is invisible');
  x := dst_need('t1', 'da1', 'post', NULL, NULL, d1, 'Fall 2026', 'hist 300', 'teaching_assistant', 60, 2, '');
  INSERT INTO rr VALUES (x = 'Hours must be 1–40 a week and positions 1–20.', 'S3 hours and positions are bounded');
  x := dst_need('t1', 'da1', 'post', NULL, NULL, d1, 'Fall 2026', 'hist 300', 'teaching_assistant', 10, 2, 'Discussion sections'); n1 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT course_code FROM dst_needs WHERE id = n1) = 'HIST 300', 'S4 admin posts a need (course code normalized)');

  x := dst_offer('t1', 'da1', 'offer', NULL, NULL, n1, 'da1', '');
  INSERT INTO rr VALUES (x = 'Offer it to someone other than yourself.', 'S5 nobody offers a position to themselves');
  x := dst_offer('t1', 'chairB', 'offer', NULL, NULL, n1, 'gs1', '');
  INSERT INTO rr VALUES (x = 'Staffing need not found.', 'S6 another institution cannot offer');
  x := dst_offer('t1', 'da1', 'offer', NULL, NULL, n1, 'gs1', 'Strong in modern history'); o1 := substr(x, 4)::bigint;
  x := dst_offer('t1', 'da1', 'offer', NULL, NULL, n1, 'gs1', '');
  INSERT INTO rr VALUES (x = 'That person already has an offer for this need.', 'S7 one live offer per person and need');
  x := dst_offer('t1', 'da1', 'offer', NULL, NULL, n1, 'gs2', ''); o2 := substr(x, 4)::bigint;
  x := dst_offer('t1', 'chair1', 'offer', NULL, NULL, n1, 'gs3', ''); o3 := substr(x, 4)::bigint;

  x := dst_offer('t1', 'gs1', 'accept', o1, 1, NULL, NULL, '');
  INSERT INTO rr VALUES (x = 'This offer is not ready to answer yet.', 'S8 cannot accept before the chair approves');
  x := dst_offer('t1', 'da1', 'approve', o1, 1, NULL, NULL, '');
  INSERT INTO rr VALUES (x = 'Only the department chair approves staffing offers.', 'S9 only the chair approves');
  x := dst_offer('t1', 'chair1', 'approve', o3, 1, NULL, NULL, '');
  INSERT INTO rr VALUES (x = 'You made this offer, so it needs another person''s approval.', 'S10 the chair cannot approve their own offer');
  x := dst_offer('t1', 'chair1', 'approve', o1, 1, NULL, NULL, '');
  INSERT INTO rr VALUES (x IS NULL AND (SELECT state = 'approved' AND approved_by = 'chair1' FROM dst_offers WHERE id = o1), 'S11 the chair approves an offer');
  x := dst_offer('t1', 'chair1', 'approve', o2, 1, NULL, NULL, '');
  PERFORM dfm_set_admin('adm', true, 't1', d1, 'da2', true);
  x := dst_offer('t1', 'da2', 'offer', NULL, NULL, n1, 'gs4', ''); 
  UPDATE inst_departments SET chair_id = 'chair2' WHERE id = d1;
  x := dst_offer('t1', 'chair2', 'approve', substr(x, 4)::bigint, 1, NULL, NULL, '');
  INSERT INTO rr VALUES (x = 'All positions on this need are already approved or filled.', 'S12 approvals never exceed the positions');
  UPDATE inst_departments SET chair_id = 'chair1' WHERE id = d1;
  x := dst_offer('t1', 'gs2', 'accept', o1, 2, NULL, NULL, '');
  INSERT INTO rr VALUES (x = 'Offer not found.', 'S13a someone else cannot even see the offer');
  x := dst_offer('t1', 'da2', 'accept', o1, 2, NULL, NULL, '');
  INSERT INTO rr VALUES (x = 'Only the person offered the position answers it.', 'S13 an admin cannot accept on the person''s behalf');
  x := dst_offer('t1', 'gs1', 'accept', o1, 2, NULL, NULL, '');
  INSERT INTO rr VALUES (x IS NULL AND (SELECT state FROM dst_needs WHERE id = n1) = 'open', 'S14 first acceptance; need still open');
  SELECT version INTO v FROM dst_offers WHERE id = o2;
  x := dst_offer('t1', 'gs2', 'accept', o2, v, NULL, NULL, '');
  INSERT INTO rr VALUES (x IS NULL AND (SELECT state FROM dst_needs WHERE id = n1) = 'filled', 'S15 second acceptance fills the need');
  x := dst_offer('t1', 'da1', 'offer', NULL, NULL, n1, 'gs9', '');
  INSERT INTO rr VALUES (x = 'This need is closed.', 'S16 a filled need takes no more offers');
  SELECT version INTO v FROM dst_needs WHERE id = n1;
  x := dst_need('t1', 'da1', 'edit', n1, v, NULL, NULL, NULL, NULL, 20, 2, NULL);
  INSERT INTO rr VALUES (x = 'This need is closed.', 'S17 a filled need cannot be edited');

  x := dst_need('t1', 'da1', 'post', NULL, NULL, d1, 'Fall 2026', 'HIST 210', 'grader', 5, 1, ''); n1 := substr(x, 4)::bigint;
  x := dst_offer('t1', 'da1', 'offer', NULL, NULL, n1, 'gs5', ''); o1 := substr(x, 4)::bigint;
  x := dst_need('t1', 'da1', 'edit', n1, 1, NULL, NULL, NULL, NULL, 8, 1, NULL);
  INSERT INTO rr VALUES (x = 'Offers are out on this need. Withdraw them before changing it.', 'S18 a need with live offers cannot change under them');
  x := dst_need('t1', 'da1', 'cancel', n1, 1, NULL, NULL, NULL, NULL, NULL, NULL, 'short');
  INSERT INTO rr VALUES (x = 'Say why it is cancelled (10+ characters). People with offers see this.', 'S19 cancelling needs a reason');
  x := dst_need('t1', 'da1', 'cancel', n1, 1, NULL, NULL, NULL, NULL, NULL, NULL, 'Course merged with HIST 211');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM dst_offers WHERE id = o1) = 'withdrawn', 'S20 cancelling withdraws open offers');
  PERFORM dfm_set_admin('adm', true, 't1', d1, 'da1', false);
  x := dst_need('t1', 'da1', 'post', NULL, NULL, d1, 'Fall 2026', 'HIST 220', 'grader', 5, 1, '');
  INSERT INTO rr VALUES (x = 'Only that department''s admins post staffing needs.', 'S21 a revoked admin loses access at once');
  got := false; BEGIN UPDATE dst_offers SET approved_by = offered_by WHERE id = o1; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'S22 the table refuses self-approval');
  got := false; BEGIN DELETE FROM dst_events WHERE subject_id = o1; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'S23 history is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...SREQ_MIGRATION, ...DFM_MIGRATION, ...DST_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 700)); } };
  await go('real:', base);
  const muts: [string, string, string][] = [
    ['overfill (S12)', `IF p_step = 'approve' AND taken >= n.slots THEN`, `IF false THEN`],
    ['chair self-approval (S10; constraint must still stop it)', `IF o.offered_by = p_actor THEN RETURN 'You made this offer`, `IF false THEN RETURN 'You made this offer`],
    ['answer by others (S13)', `IF o.person_id <> p_actor THEN RETURN 'Only the person offered`, `IF false THEN RETURN 'Only the person offered`],
    ['accept before approval (S8)', `IF o.state <> 'approved' THEN RETURN 'This offer is not ready to answer yet.'; END IF;`, ``],
  ];
  for (const [name, from, to] of muts) { const m = base.map((q) => q.replace(from, () => to)); console.log(`${name} applied:`, m.join('') !== base.join('')); await go(`mutant ${name}:`, m); }
}
