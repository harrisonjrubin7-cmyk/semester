import { neon } from '@neondatabase/serverless';
import { CRR_MIGRATION } from '../src/lib/crrMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; v int; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO rr VALUES (crr_share('t1','opp1','emp1','stu1','{}',false) = 'This employer is not approved by your institution.', 'P1 a student cannot apply to an employer that was never approved');
  r := crr_request('emp1','t1','Acme Labs');
  INSERT INTO rr VALUES (r = 'ok' AND (SELECT status FROM crr_partners WHERE employer_id = 'emp1') = 'Pending', 'P2 a request starts pending ' || coalesce(r,''));
  INSERT INTO rr VALUES (crr_request('emp1','t1','Acme Labs') = 'ok:pending', 'P3 asking twice does not duplicate');
  INSERT INTO rr VALUES (crr_decide('stu1','t1',false,'emp1','Approved',1,'') = 'Only institution staff decide employer partnerships.', 'P4 a non-staff member cannot approve');
  INSERT INTO rr VALUES (crr_decide('emp1','t1',true,'emp1','Approved',1,'') = 'You cannot approve your own organization.', 'P5 an employer cannot approve itself');
  INSERT INTO rr VALUES (crr_decide('st1','t1',true,'emp1','Approved',7,'') LIKE 'This request changed%', 'P6 a stale decision is refused');
  INSERT INTO rr VALUES (crr_decide('st1','t2',true,'emp1','Approved',1,'') = 'No request from this employer.', 'P7 another institution cannot approve this one''s request');
  r := crr_decide('st1','t1',true,'emp1','Approved',1,'checked registration');
  INSERT INTO rr VALUES (r = 'ok:2' AND crr_approved('t1','emp1'), 'P8 staff approve it ' || coalesce(r,''));
  INSERT INTO rr VALUES (NOT crr_approved('t2','emp1'), 'P9 approval at one institution grants nothing at another');
  INSERT INTO rr VALUES (crr_share('t2','opp1','emp1','stu2','{}',false) = 'This employer is not approved by your institution.', 'P10 a student elsewhere still cannot apply');
  INSERT INTO rr VALUES (crr_share('t1','opp1','emp1','emp1','{}',false) LIKE 'You can%t apply%', 'P11 an employer cannot apply to its own posting');
  INSERT INTO rr VALUES (crr_share('t1','opp1','emp1','stu1','{"a","b","c","d","e","f","g","h","i","j","k"}',false) = 'Share at most 10 items.', 'P12 at most 10 shared items');
  x := crr_share('t1','opp1','emp1','stu1','{"item1"}',false);
  INSERT INTO rr VALUES (x = 'ok' AND (SELECT item_ids = '{item1}' AND NOT share_contact FROM crr_shares WHERE applicant_id = 'stu1'), 'P13 the share records only the chosen item and no contact');
  INSERT INTO rr VALUES (crr_decide('st1','t1',true,'emp1','Approved',2,'') = 'Only a pending request can be approved or declined.', 'P14 an approved partnership cannot be re-approved');
  r := crr_decide('st1','t1',true,'emp1','Revoked',2,'complaint');
  INSERT INTO rr VALUES (r = 'ok:3' AND NOT crr_approved('t1','emp1'), 'P15 revoking removes access ' || coalesce(r,''));
  INSERT INTO rr VALUES (crr_share('t1','opp2','emp1','stu1','{}',false) = 'This employer is not approved by your institution.', 'P16 after revocation no new application is accepted');
  r := crr_request('emp1','t1','Acme Labs');
  INSERT INTO rr VALUES (r = 'ok' AND (SELECT status = 'Pending' AND version = 4 FROM crr_partners WHERE employer_id = 'emp1'), 'P17 a revoked employer may ask again, as a new version ' || coalesce(r,''));
  -- requested, approved, shared, revoked, requested again (asking while pending logs nothing)
  INSERT INTO rr VALUES ((SELECT count(*) FROM crr_events WHERE employer_id = 'emp1') = 5, 'P18 every step is logged');
  got := false; BEGIN UPDATE crr_events SET detail = 'x'; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'P19 the career log cannot be edited');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', CRR_MIGRATION);
  const m1 = CRR_MIGRATION.map((q) => q.replace(`IF NOT crr_approved(p_tenant, p_employer) THEN RETURN 'This employer is not approved by your institution.'; END IF;`, () => ''));
  console.log('unapproved-share mutant applied:', m1.join('') !== CRR_MIGRATION.join(''));
  await go('mutant share-without-approval (P1, P10, P16):', m1);
  const m2 = CRR_MIGRATION.map((q) => q.replace(`WHERE tenant_id = p_tenant AND employer_id = p_employer AND status = 'Approved'`, () => `WHERE employer_id = p_employer AND status = 'Approved'`));
  console.log('global-approval mutant applied:', m2.join('') !== CRR_MIGRATION.join(''));
  await go('mutant approval-is-global (P9, P10):', m2);
  const m3 = CRR_MIGRATION.map((q) => q.replace(`IF r.version <> p_expected THEN RETURN 'This request changed since you opened it. Reload and decide again.'; END IF;`, () => ''));
  console.log('stale mutant applied:', m3.join('') !== CRR_MIGRATION.join(''));
  await go('mutant stale-decision (P6):', m3);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('crr_partners') AS t`)));
}
