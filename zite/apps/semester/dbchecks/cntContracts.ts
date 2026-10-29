import { neon } from '@neondatabase/serverless';
import { PTA_MIGRATION } from '../src/lib/ptaMigration';
import { CNT_MIGRATION } from '../src/lib/cntMigration';

// E12 Contracts: manager-gated drafting, hash-pinned proposals, org-admin-only acceptance of the
// exact hash, amendment voiding acceptance (lib/cntMigration.ts). Rolled back; sequential statements.
const CHECKS = `DO $$
DECLARE x text; org1 bigint; org2 bigint; out text; cid bigint; h1 text; h2 text; v int; st text;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  INSERT INTO pta_orgs (name, name_key, kind, website, created_by) VALUES ('Contract Parts Co', 'contractpartsco', 'service', '', 'oadmin') RETURNING id INTO org1;
  INSERT INTO pta_orgs (name, name_key, kind, website, created_by) VALUES ('Unrelated Org', 'unrelatedorg', 'service', '', 'oadmin') RETURNING id INTO org2;
  INSERT INTO pta_members (org_id, user_id, role, added_by) VALUES (org1, 'oadmin', 'admin', 'oadmin'), (org1, 'omem', 'member', 'oadmin');
  INSERT INTO pta_relationships (tenant_id, org_id, state) VALUES ('tc', org1, 'applied');
  PERFORM cnt_set_staff('root', 'tc', 'mgr1', true);

  out := cnt_create('omem', 'tc', org1, 'Lab benches supply', 'supplier', 500000, DATE '2027-01-01', DATE '2027-12-31');
  INSERT INTO rr VALUES (out LIKE 'Only a contract manager%', 'K1 only a contract manager creates contracts');
  out := cnt_create('mgr1', 'tc', org2, 'Paper supply', 'supplier', 1000, NULL, NULL);
  INSERT INTO rr VALUES (out LIKE '%no live relationship%', 'K2 a contract needs a relationship with the organization');
  out := cnt_create('mgr1', 'tc', org1, 'Lab benches supply', 'supplier', 500000, DATE '2027-01-01', DATE '2027-12-31');
  INSERT INTO rr VALUES (out LIKE 'ok:%', 'K3 a manager creates the draft');
  cid := split_part(out, ':', 2)::bigint;

  out := cnt_propose('mgr1', 'tc', cid, 'The supplier delivers lab benches to the science wing and invoices monthly.', 500000, DATE '2027-01-01', DATE '2027-12-31');
  INSERT INTO rr VALUES (out IS NULL, 'K4 terms proposed');
  SELECT terms_hash, version, state INTO h1, v, st FROM cnt_contracts WHERE id = cid;
  INSERT INTO rr VALUES (st = 'proposed' AND h1 IS NOT NULL, 'K5 proposal pins a hash');
  out := cnt_accept('omem', cid, v, h1);
  INSERT INTO rr VALUES (out LIKE 'Only an administrator%', 'K6 only an org administrator accepts');
  out := cnt_accept('oadmin', cid, v, 'deadbeefdeadbeef');
  INSERT INTO rr VALUES (out LIKE 'The terms changed%', 'K7 a different hash cannot be accepted');
  out := cnt_accept('oadmin', cid, v + 5, h1);
  INSERT INTO rr VALUES (out LIKE 'The contract changed%', 'K8 a stale version cannot be accepted');
  out := cnt_accept('oadmin', cid, v, h1);
  INSERT INTO rr VALUES (out IS NULL, 'K9 the exact hash accepts');
  SELECT state INTO st FROM cnt_contracts WHERE id = cid;
  INSERT INTO rr VALUES (st = 'active' AND (SELECT accepted_hash = terms_hash FROM cnt_contracts WHERE id = cid), 'K10 active means the acceptance matches the pinned hash');

  out := cnt_propose('mgr1', 'tc', cid, 'Amended: the supplier delivers lab benches and stools, invoiced monthly.', 600000, DATE '2027-01-01', DATE '2027-12-31');
  INSERT INTO rr VALUES (out IS NULL, 'K11 a manager amends the terms');
  SELECT terms_hash, version, state INTO h2, v, st FROM cnt_contracts WHERE id = cid;
  INSERT INTO rr VALUES (st = 'proposed' AND (SELECT accepted_hash IS NULL FROM cnt_contracts WHERE id = cid) AND h2 <> h1, 'K12 amending voids the acceptance and repins the hash');
  out := cnt_accept('oadmin', cid, v, h2);
  INSERT INTO rr VALUES (out IS NULL, 'K13 the amended terms accept afresh');
  out := cnt_close('mgr1', 'tc', cid, 'terminated');
  INSERT INTO rr VALUES (out IS NULL, 'K14 a manager terminates an active contract');
  out := cnt_close('mgr1', 'tc', cid, 'ended');
  INSERT INTO rr VALUES (out LIKE 'Only an active contract%', 'K15 a closed contract cannot be closed again');
  out := cnt_propose('mgr1', 'tc', cid, 'Trying to revive a terminated contract with new terms here.', 1, NULL, NULL);
  INSERT INTO rr VALUES (out LIKE 'That contract is closed%', 'K16 a closed contract cannot be amended');
  INSERT INTO rr VALUES ((SELECT count(*) FROM cnt_events WHERE contract_id = cid) >= 6, 'K17 the lifecycle is in the event log');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x, '');
END $$`;

const MIG = [...PTA_MIGRATION, ...CNT_MIGRATION];

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', MIG);
  const m1 = CNT_MIGRATION.map((q) => q.replace('IF p_hash IS DISTINCT FROM c.terms_hash THEN', () => 'IF false THEN'));
  console.log('hash mutant applied:', m1.join('') !== CNT_MIGRATION.join(''));
  await go('mutant accept-any-hash (K7):', [...PTA_MIGRATION, ...m1]);
  const m2 = CNT_MIGRATION.map((q) => q.replace('accepted_hash = NULL', () => 'accepted_hash = c.terms_hash'));
  console.log('amend mutant applied:', m2.join('') !== CNT_MIGRATION.join(''));
  await go('mutant amend-keeps-acceptance (K12):', [...PTA_MIGRATION, ...m2]);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT (SELECT count(*) FROM pta_orgs WHERE name_key IN ('contractpartsco','unrelatedorg')) AS orgs`)));
}
