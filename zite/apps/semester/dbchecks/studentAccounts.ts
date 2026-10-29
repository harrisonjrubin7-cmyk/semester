import { neon } from '@neondatabase/serverless';
import { SA_MIGRATION } from '../src/lib/saMigration';

// Student Accounts Officer: charge and credit adjustments (role-app capabilities "charges", "credits"). Proves the two-person
// rule, no self-dealing, tenant isolation, and that approval stops at "approved, not posted" — nothing here moves money.
export const CHECKS = `DO $$
DECLARE e text; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO rr VALUES (sa_propose('stu','t1','pX','stu','credit_adjustment',50,'Late fee charged in error',NULL) = 'You cannot propose an adjustment to your own account.', 'A1 a student cannot adjust their own account');
  INSERT INTO rr VALUES (sa_propose('off1','t1','pX','stu','credit_adjustment',0,'Late fee charged in error',NULL) = 'Enter a positive amount.', 'A2 a zero or negative amount is refused');
  INSERT INTO rr VALUES (sa_propose('off1','t1','pX','stu','credit_adjustment',50,'short',NULL) = 'Give a reason (10+ characters).', 'A3 a reason is required');
  INSERT INTO rr VALUES (sa_propose('off1','t1','p1','stu','credit_adjustment',50.004,'Late fee charged in error',NULL) IS NULL, 'A4 an officer proposes a credit');
  INSERT INTO rr VALUES ((SELECT amount = 50.00 AND state = 'proposed' FROM sa_proposals WHERE id = 'p1'), 'A5 amounts are rounded to cents and start as proposed');
  INSERT INTO rr VALUES (sa_propose('off1','t1','p1','stu','credit_adjustment',999,'A different reason entirely',NULL) IS NULL AND (SELECT amount FROM sa_proposals WHERE id = 'p1') = 50.00, 'A6 a retried proposal id changes nothing');
  INSERT INTO rr VALUES (sa_propose('off1','t1','p2','stu','charge_adjustment',20,'Lab materials not billed',NULL) IS NULL, 'A7 an officer proposes a charge');
  INSERT INTO rr VALUES (sa_decide('off1','t1','p1',true,'Approved per policy') = 'A second staff member, not the proposer or the student, must decide.', 'A8 the proposer cannot approve their own proposal');
  INSERT INTO rr VALUES (sa_decide('stu','t1','p1',true,'Approved per policy') = 'A second staff member, not the proposer or the student, must decide.', 'A9 the student cannot approve it');
  INSERT INTO rr VALUES (sa_decide('off2','t2','p1',true,'Approved per policy') = 'Proposal not found.', 'A10 another institution cannot decide it');
  INSERT INTO rr VALUES (sa_decide('off2','t1','p1',true,'ok') = 'Add a note the student will see.', 'A11 a decision needs a note');
  e := sa_decide('off2','t1','p1',true,'Approved per policy');
  INSERT INTO rr VALUES (e IS NULL AND (SELECT state FROM sa_proposals WHERE id = 'p1') = 'approved_not_posted', 'A12 a second officer approves: approved, not posted');
  INSERT INTO rr VALUES (sa_decide('off3','t1','p1',false,'Changed my mind') = 'Already decided.', 'A13 a decision is final');
  e := sa_decide('off2','t1','p2',false,'Already billed through the lab');
  INSERT INTO rr VALUES (e IS NULL AND (SELECT state FROM sa_proposals WHERE id = 'p2') = 'rejected', 'A14 a charge can be rejected');
  got := false; BEGIN UPDATE sa_proposals SET state = 'posted' WHERE id = 'p1'; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'A15 nothing can mark an adjustment posted (money movement stays off)');
  got := false; BEGIN UPDATE sa_proposals SET decided_by = proposed_by WHERE id = 'p1'; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'A16 the table refuses a self-approval (constraint)');
  INSERT INTO rr VALUES ((SELECT string_agg(action, ',' ORDER BY id) FROM sa_events WHERE ref = 'p1') = 'proposed_credit_adjustment,approved_not_posted', 'A17 each step is logged');
  got := false; BEGIN DELETE FROM sa_events WHERE ref = 'p1'; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'A18 the log is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', SA_MIGRATION);
  const m1 = SA_MIGRATION.map((q) => q.replace(`IF p_actor = p.proposed_by OR p_actor = p.student_id THEN RETURN`, () => `IF false THEN RETURN`));
  console.log('self-approval mutant applied:', m1.join('') !== SA_MIGRATION.join(''));
  await go('mutant self-approval (A8, A9; constraint must still stop it):', m1);
  const m2 = SA_MIGRATION.map((q) => q.replace(`IF NOT FOUND OR p.tenant_id <> p_tenant THEN RETURN 'Proposal not found.'`, () => `IF NOT FOUND THEN RETURN 'Proposal not found.'`));
  console.log('tenant mutant applied:', m2.join('') !== SA_MIGRATION.join(''));
  await go('mutant cross-tenant decide (A10):', m2);
}
