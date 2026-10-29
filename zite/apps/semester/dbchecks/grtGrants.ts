import { neon } from '@neondatabase/serverless';
import { RSA_MIGRATION } from '../src/lib/rsaMigration';
import { GRT_MIGRATION } from '../src/lib/grtMigration';

// E24 Grants: two-person sponsor verification before activation, monotone capped spend reports
// (lib/grtMigration.ts on lib/rsaMigration.ts projects). Rolled back; sequential statements.
const CHECKS = `DO $$
DECLARE x text; out text; gid bigint; st text;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  out := grt_set_staff('off1', 'tg', 'off1', true);
  INSERT INTO rr VALUES (out LIKE 'Ask another administrator%', 'G1 nobody grants their own grants access');
  PERFORM grt_set_staff('root', 'tg', 'off1', true);
  PERFORM grt_set_staff('root', 'tg', 'off2', true);
  INSERT INTO rsa_requests (tenant_id, requester_id, title, summary, kind, state, project_code)
    VALUES ('tg', 'prof1', 'River water study', 'A study of river water quality across the county.', 'internal', 'approved', 'RIV-27');

  out := grt_create('prof1', 'tg', 'RIV-27', NULL, 'River Trust', 'River sampling grant', 100000, 'prof1', NULL, NULL);
  INSERT INTO rr VALUES (out LIKE 'Only a grants officer%', 'G2 only officers record grants');
  out := grt_create('off1', 'tg', 'NOPE-99', NULL, 'River Trust', 'River sampling grant', 100000, 'prof1', NULL, NULL);
  INSERT INTO rr VALUES (out LIKE '%not a registered project%', 'G3 grants attach to registered projects only');
  out := grt_create('off1', 'tg', 'riv-27', NULL, 'River Trust', 'River sampling grant', 100000, 'prof1', DATE '2027-01-01', DATE '2027-12-31');
  INSERT INTO rr VALUES (out LIKE 'ok:%', 'G4 an officer records the grant');
  gid := split_part(out, ':', 2)::bigint;
  out := grt_activate('off1', 'tg', gid);
  INSERT INTO rr VALUES (out LIKE '%verified grant%', 'G5 an unverified grant cannot activate');
  out := grt_verify('off1', 'tg', gid, 'Checked the trust registry and prior awards.');
  INSERT INTO rr VALUES (out LIKE '%cannot verify its sponsor%', 'G6 the recorder cannot verify their own grant');
  out := grt_verify('off2', 'tg', gid, 'Checked the trust registry and prior awards.');
  INSERT INTO rr VALUES (out IS NULL AND (SELECT state FROM grt_grants WHERE id = gid) = 'verified', 'G7 a second officer verifies the sponsor');
  out := grt_activate('off2', 'tg', gid);
  INSERT INTO rr VALUES (out IS NULL AND (SELECT state FROM grt_grants WHERE id = gid) = 'active', 'G8 a verified grant activates');
  out := grt_report('stranger', 'tg', gid, '2027 Q1', 50000, '');
  INSERT INTO rr VALUES (out LIKE '%principal investigator%', 'G9 only the PI or an officer reports');
  out := grt_report('prof1', 'tg', gid, '2027 Q1', 50000, '');
  INSERT INTO rr VALUES (out IS NULL, 'G10 the PI files a spend report');
  out := grt_report('prof1', 'tg', gid, '2027 Q2', 40000, '');
  INSERT INTO rr VALUES (out LIKE '%cannot go down%', 'G11 cumulative spend cannot decrease');
  out := grt_report('prof1', 'tg', gid, '2027 Q2', 150000, '');
  INSERT INTO rr VALUES (out LIKE '%cannot exceed the awarded amount%', 'G12 reported spend cannot exceed the award');
  out := grt_report('off1', 'tg', gid, '2027 Q2', 90000, '');
  INSERT INTO rr VALUES (out IS NULL, 'G13 an officer can file on the PI behalf');
  out := grt_close('off1', 'tg', gid);
  SELECT state INTO st FROM grt_grants WHERE id = gid;
  INSERT INTO rr VALUES (out IS NULL AND st = 'closed', 'G14 an officer closes the grant');
  out := grt_report('prof1', 'tg', gid, '2027 Q3', 95000, '');
  INSERT INTO rr VALUES (out LIKE '%active grants%', 'G15 closed grants take no reports');
  INSERT INTO rr VALUES ((SELECT count(*) FROM grt_events WHERE grant_id = gid) >= 6, 'G16 the lifecycle is in the event log');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x, '');
END $$`;

const MIG = [...RSA_MIGRATION, ...GRT_MIGRATION];

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', MIG);
  const m1 = GRT_MIGRATION.map((q) => q.replace('IF g.created_by = p_actor THEN', () => 'IF false THEN'));
  console.log('verify mutant applied:', m1.join('') !== GRT_MIGRATION.join(''));
  await go('mutant recorder-verifies-own (G6):', [...RSA_MIGRATION, ...m1]);
  const m2 = GRT_MIGRATION.map((q) => q.replace('IF EXISTS (SELECT 1 FROM grt_reports WHERE grant_id = p_id AND spent_cents > p_spent) THEN', () => 'IF false THEN'));
  console.log('monotone mutant applied:', m2.join('') !== GRT_MIGRATION.join(''));
  await go('mutant spend-goes-down (G11):', [...RSA_MIGRATION, ...m2]);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT (SELECT count(*) FROM rsa_requests WHERE tenant_id = 'tg') AS reqs`)));
}
