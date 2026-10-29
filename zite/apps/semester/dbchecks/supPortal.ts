import { neon } from '@neondatabase/serverless';
import { PTA_MIGRATION } from '../src/lib/ptaMigration';
import { PRC_MIGRATION } from '../src/lib/prcMigration';
import { SUP_MIGRATION } from '../src/lib/supMigration';

// E09 Supplier Portal: a buyer links a free-text supplier name to a partner organization; the org's
// members see only that name's purchase orders, and only while view_orders is live (sup_orders /
// sup_ack in lib/supMigration.ts). One transaction, RESULT raised, everything rolls back.
const CHECKS = `DO $$
DECLARE x text; org1 bigint; org2 bigint; req1 bigint; req2 bigint; po1 bigint; po2 bigint; un text;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  INSERT INTO pta_orgs (name, name_key, kind, website, created_by) VALUES ('Portal Parts Co', 'portalpartsco', 'service', '', 'sup1') RETURNING id INTO org1;
  INSERT INTO pta_orgs (name, name_key, kind, website, created_by) VALUES ('Rival Goods', 'rivalgoods', 'service', '', 'sup2') RETURNING id INTO org2;
  INSERT INTO pta_members (org_id, user_id, role, added_by) VALUES (org1, 'sup1', 'member', 'sup1'), (org2, 'sup2', 'member', 'sup2');
  INSERT INTO pta_relationships (tenant_id, org_id, state, scopes, agreement_hash, accepted_hash, valid_to) VALUES
    ('ts', org1, 'active', ARRAY['view_orders'], 'h1', 'h1', current_date + 30),
    ('ts', org2, 'active', ARRAY['view_orders'], 'h2', 'h2', current_date + 30);
  INSERT INTO prc_staff (tenant_id, user_id, role, granted_by) VALUES ('ts', 'buyer1', 'buyer', 'admin1');
  INSERT INTO prc_requisitions (tenant_id, requester_id, budget_code, supplier, supplier_key, description, amount, state, approver1, request_key) VALUES
    ('ts', 'req1', 'OPS', 'Portal Parts Co', prc_key('Portal Parts Co'), 'Lab benches for the science wing', 500000, 'ordered', 'appr1', 'rk-0001') RETURNING id INTO req1;
  INSERT INTO prc_requisitions (tenant_id, requester_id, budget_code, supplier, supplier_key, description, amount, state, approver1, request_key) VALUES
    ('ts', 'req1', 'OPS', 'Rival Goods', prc_key('Rival Goods'), 'Printer paper for the front office', 40000, 'ordered', 'appr1', 'rk-0002') RETURNING id INTO req2;
  INSERT INTO prc_pos (tenant_id, req_id, supplier, amount, issued_by, state) VALUES ('ts', req1, 'Portal Parts Co', 500000, 'buyer1', 'issued') RETURNING id INTO po1;
  INSERT INTO prc_pos (tenant_id, req_id, supplier, amount, issued_by, state) VALUES ('ts', req2, 'Rival Goods', 40000, 'buyer1', 'issued') RETURNING id INTO po2;
  INSERT INTO prc_receipts (po_id, amount, note, received_by) VALUES (po1, 200000, '', 'recv1');

  INSERT INTO rr VALUES (sup_link('sup1', 'ts', prc_key('Portal Parts Co'), org1) LIKE 'Only a buyer%', 'S1 only a buyer can link a supplier');
  INSERT INTO rr VALUES (sup_link('buyer1', 'ts', prc_key('Portal Parts Co'), org1) IS NULL, 'S2 a buyer links the supplier name to the org');
  INSERT INTO rr VALUES ((SELECT count(*) FROM sup_orders('ts', org1)) = 1 AND (SELECT po_id FROM sup_orders('ts', org1)) = po1 AND (SELECT received FROM sup_orders('ts', org1)) = 200000, 'S3 the org sees its order with the received total');
  INSERT INTO rr VALUES ((SELECT count(*) FROM sup_orders('ts', org2)) = 0, 'S4 a live org without the link sees nothing');
  INSERT INTO rr VALUES (sup_ack('outsider', 'ts', org1, po1, 'acknowledged', '') LIKE 'Only a member%', 'S5 only org members can act for it');
  INSERT INTO rr VALUES (sup_ack('sup1', 'ts', org1, po1, 'acknowledged', 'Got it') IS NULL, 'S6 a member acknowledges the order');
  INSERT INTO rr VALUES (EXISTS (SELECT 1 FROM prc_po_acks WHERE po_id = po1 AND kind = 'acknowledged') AND EXISTS (SELECT 1 FROM prc_events WHERE subject = 'po' AND ref = po1 AND step = 'supplier.acknowledged'), 'S7 the ack is stored and lands in the buyer event trail');
  INSERT INTO rr VALUES (sup_ack('sup1', 'ts', org1, po2, 'acknowledged', '') = 'That order is not addressed to your organization.', 'S8 an order for another supplier name is refused');
  UPDATE pta_relationships SET state = 'suspended' WHERE tenant_id = 'ts' AND org_id = org1;
  INSERT INTO rr VALUES ((SELECT count(*) FROM sup_orders('ts', org1)) = 0 AND sup_ack('sup1', 'ts', org1, po1, 'shipped', '') LIKE 'This institution has not given%', 'S9 suspension ends order access at once');
  UPDATE pta_relationships SET state = 'active' WHERE tenant_id = 'ts' AND org_id = org1;
  un := sup_unlink('buyer1', 'ts', prc_key('Portal Parts Co'));
  INSERT INTO rr VALUES (un IS NULL, 'S10a the buyer can unlink');
  INSERT INTO rr VALUES ((SELECT count(*) FROM sup_orders('ts', org1)) = 0, 'S10 unlinking hides the orders again');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x, '');
END $$`;

const MIG = [...PTA_MIGRATION, ...PRC_MIGRATION, ...SUP_MIGRATION];

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', MIG);
  const m1 = SUP_MIGRATION.map((q) => q.replace("IF NOT pta_live(p_tenant, p_org, 'view_orders') THEN", () => 'IF false THEN'));
  console.log('live-gate mutant applied:', m1.join('') !== SUP_MIGRATION.join(''));
  await go('mutant ack-without-live-scope (S9):', [...PTA_MIGRATION, ...PRC_MIGRATION, ...m1]);
  const m2 = SUP_MIGRATION.map((q) => q.replace('AND l.org_id = p_org', () => ''));
  console.log('link-join mutant applied:', m2.join('') !== SUP_MIGRATION.join(''));
  await go('mutant orders-ignore-link (S4):', [...PTA_MIGRATION, ...PRC_MIGRATION, ...m2]);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT (SELECT count(*) FROM pta_orgs WHERE name_key IN ('portalpartsco','rivalgoods')) AS orgs`)));
}
