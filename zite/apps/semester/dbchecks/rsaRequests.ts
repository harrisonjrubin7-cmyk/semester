import { neon } from '@neondatabase/serverless';
import { PTA_MIGRATION } from '../src/lib/ptaMigration';
import { RSA_MIGRATION } from '../src/lib/rsaMigration';

// E23 Research Administration: member intake, administrator decisions with project-code
// registration, and partner submissions gated on the live submit_research_requests scope
// (lib/rsaMigration.ts). One transaction, RESULT raised, everything rolls back.
const CHECKS = `DO $$
DECLARE x text; out text; org1 bigint; rid bigint; rid2 bigint; rid3 bigint; st text;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  out := rsa_set_staff('radmin', 'tr', 'radmin', true);
  INSERT INTO rr VALUES (out LIKE 'Ask another administrator%', 'R1 nobody grants their own research admin access');
  PERFORM rsa_set_staff('root', 'tr', 'radmin', true);
  INSERT INTO pta_orgs (name, name_key, kind, website, created_by) VALUES ('River Labs', 'riverlabs', 'research', '', 'omem') RETURNING id INTO org1;
  INSERT INTO pta_members (org_id, user_id, role, added_by) VALUES (org1, 'omem', 'member', 'omem');
  INSERT INTO pta_relationships (tenant_id, org_id, state) VALUES ('tr', org1, 'applied');

  out := rsa_submit('prof1', 'tr', 'River water study', 'A study of river water quality across the county over two seasons.', 'internal', 250000);
  INSERT INTO rr VALUES (out LIKE 'ok:%', 'R2 a member submits a request');
  rid := split_part(out, ':', 2)::bigint;
  out := rsa_submit_partner('stranger', 'tr', org1, 'Joint sensors', 'We propose joint water sensors across both campuses for a year.', 100000);
  INSERT INTO rr VALUES (out LIKE 'You are not a member%', 'R3 only org members submit for the organization');
  out := rsa_submit_partner('omem', 'tr', org1, 'Joint sensors', 'We propose joint water sensors across both campuses for a year.', 100000);
  INSERT INTO rr VALUES (out LIKE '%does not include research requests%', 'R4 without a live scope the partner cannot submit');
  UPDATE pta_relationships SET state = 'active', scopes = ARRAY['submit_research_requests'], agreement_hash = 'h1', accepted_hash = 'h1', valid_to = DATE '2030-01-01' WHERE tenant_id = 'tr' AND org_id = org1;
  out := rsa_submit_partner('omem', 'tr', org1, 'Joint sensors', 'We propose joint water sensors across both campuses for a year.', 100000);
  INSERT INTO rr VALUES (out LIKE 'ok:%', 'R5 a live scope lets the partner submit');
  rid2 := split_part(out, ':', 2)::bigint;
  INSERT INTO rr VALUES ((SELECT org_id FROM rsa_requests WHERE id = rid2) = org1 AND (SELECT kind FROM rsa_requests WHERE id = rid2) = 'collaboration', 'R6 partner requests are collaborations from that org');

  out := rsa_review('prof1', 'tr', rid);
  INSERT INTO rr VALUES (out LIKE 'Only a research administrator%', 'R7 only research administrators review');
  out := rsa_review('radmin', 'tr', rid);
  INSERT INTO rr VALUES (out IS NULL, 'R8 an administrator starts review');
  out := rsa_decide('radmin', 'tr', rid, true, '', '');
  INSERT INTO rr VALUES (out LIKE '%project code%', 'R9 approval requires a project code');
  out := rsa_decide('radmin', 'tr', rid, true, '', 'RIV-27');
  INSERT INTO rr VALUES (out IS NULL AND (SELECT state FROM rsa_requests WHERE id = rid) = 'approved', 'R10 approval registers the project');
  out := rsa_decide('radmin', 'tr', rid2, true, '', 'riv-27');
  INSERT INTO rr VALUES (out LIKE '%already in use%', 'R11 project codes are unique per institution');
  out := rsa_decide('radmin', 'tr', rid2, false, '', '');
  INSERT INTO rr VALUES (out LIKE 'Say why%', 'R12 declining needs a reason');
  out := rsa_decide('radmin', 'tr', rid2, false, 'Outside this year''s themes.', '');
  INSERT INTO rr VALUES (out IS NULL AND (SELECT state FROM rsa_requests WHERE id = rid2) = 'declined', 'R13 an administrator declines with a reason');
  out := rsa_close('radmin', 'tr', rid2);
  INSERT INTO rr VALUES (out LIKE 'Only an approved project%', 'R14 only approved projects close');
  out := rsa_close('radmin', 'tr', rid);
  SELECT state INTO st FROM rsa_requests WHERE id = rid;
  INSERT INTO rr VALUES (out IS NULL AND st = 'closed', 'R15 an approved project closes');
  INSERT INTO rr VALUES ((SELECT count(*) FROM rsa_events WHERE request_id IN (rid, rid2)) >= 6, 'R16 intake and decisions are in the event log');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x, '');
END $$`;

const MIG = [...PTA_MIGRATION, ...RSA_MIGRATION];

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', MIG);
  const m1 = RSA_MIGRATION.map((q) => q.replace("IF NOT pta_live(p_tenant, p_org, 'submit_research_requests') THEN", () => 'IF false THEN'));
  console.log('scope mutant applied:', m1.join('') !== RSA_MIGRATION.join(''));
  await go('mutant scope-not-live (R4):', [...PTA_MIGRATION, ...m1]);
  const m2 = RSA_MIGRATION.map((q) => q.replace('IF EXISTS (SELECT 1 FROM rsa_requests WHERE tenant_id = p_tenant AND project_code = upper(trim(p_code))) THEN', () => 'IF false THEN'));
  console.log('code mutant applied:', m2.join('') !== RSA_MIGRATION.join(''));
  await go('mutant duplicate-code (R11):', [...PTA_MIGRATION, ...m2]);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT (SELECT count(*) FROM pta_orgs WHERE name_key = 'riverlabs') AS orgs`)));
}
