import { neon } from '@neondatabase/serverless';
import { PRC_MIGRATION } from '../src/lib/prcMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; q1 bigint; q2 bigint; q3 bigint; q4 bigint; po bigint; po2 bigint; b1 bigint; b2 bigint; i1 bigint; i2 bigint; i3 bigint; v int; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  INSERT INTO rr VALUES (prc_set_staff('adm','t1','adm','buyer',true) IS NOT NULL, 'F1 no self-grant');
  PERFORM prc_set_staff('adm','t1','buy','buyer',true); PERFORM prc_set_staff('adm','t1','ap1','approver',true); PERFORM prc_set_staff('adm','t1','ap2','approver',true);
  PERFORM prc_set_staff('adm','t1','rcv','receiver',true); PERFORM prc_set_staff('adm','t1','fin','finance',true); PERFORM prc_set_staff('adm','t1','buy','receiver',true);
  INSERT INTO rr VALUES (prc_submit('req','t1','LAB','Acme','Pipettes for chem lab',100000,'k0') = 'Purchasing rules are not set up yet.', 'F2 no purchasing before rules');
  PERFORM prc_set_rules('adm','t1',500000,1000000,30,5);
  PERFORM prc_set_budget('adm','t1','LAB','Chemistry lab',2000000);
  -- split detection
  r := prc_submit('req','t1','LAB','Acme Supply Co.','Pipettes batch one',300000,'k1'); q1 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES ((SELECT NOT split_flag AND NOT needs_two FROM prc_requisitions WHERE id = q1), 'F3 single small request needs one approver');
  r := prc_submit('req','t1','LAB','ACME supply co','Pipettes batch two',250000,'k2'); q2 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES ((SELECT split_flag AND needs_two FROM prc_requisitions WHERE id = q2), 'F4 threshold split detected (same supplier, normalised name)');
  INSERT INTO rr VALUES (prc_submit('req','t1','LAB','Acme Supply Co.','Pipettes batch one',999,'k1') LIKE 'That request was already used%', 'F5 key reuse with changed input conflicts');
  INSERT INTO rr VALUES (prc_submit('req','t1','LAB','Acme Supply Co.','Pipettes batch one',300000,'k1') = 'replay:' || q1, 'F6 same request replays');
  -- approvals
  INSERT INTO rr VALUES (prc_decide('req','t1',q1,true,'',1) LIKE 'Only a purchasing approver%', 'F7 requester cannot approve');
  PERFORM prc_decide('ap1','t1',q1,true,'',1);
  INSERT INTO rr VALUES ((SELECT state = 'approved' FROM prc_requisitions WHERE id = q1), 'F8 one approval below threshold');
  PERFORM prc_decide('ap1','t1',q2,true,'',1);
  INSERT INTO rr VALUES ((SELECT state = 'submitted' FROM prc_requisitions WHERE id = q2) AND prc_decide('ap1','t1',q2,true,'',2) = 'A second, different approver is needed.', 'F9 split needs two independent approvals');
  PERFORM prc_decide('ap2','t1',q2,true,'',2);
  INSERT INTO rr VALUES ((SELECT state = 'approved' FROM prc_requisitions WHERE id = q2), 'F10 second approver completes');
  -- budget
  r := prc_submit('req2','t1','LAB','Bigco','Fume hood',1500000,'k3'); q3 := split_part(r,':',2)::bigint;
  PERFORM prc_decide('ap1','t1',q3,true,'',1);
  INSERT INTO rr VALUES (prc_decide('ap2','t1',q3,true,'',2) LIKE 'Not enough budget remains%', 'F11 budget check at final approval');
  PERFORM prc_set_budget('adm','t1','LAB','Chemistry lab',3000000);
  PERFORM prc_decide('ap2','t1',q3,true,'',2);
  INSERT INTO rr VALUES (prc_set_budget('adm','t1','LAB','Chemistry lab',100) LIKE 'That is below what is already committed%', 'F12 budget cannot drop below commitments');
  -- sourcing
  INSERT INTO rr VALUES (prc_issue_po('buy','t1',q3,NULL,3) LIKE 'At this amount, record bids from at least two%', 'F13 competitive bids above threshold');
  r := prc_bid('buy','t1',q3,'Bigco',1400000,'Q-1'); b1 := split_part(r,':',2)::bigint;
  r := prc_bid('buy','t1',q3,'Hoods Inc',1450000,'Q-2'); b2 := split_part(r,':',2)::bigint;
  r := prc_issue_po('buy','t1',q3,b1,3); po2 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%' AND (SELECT amount = 1400000 FROM prc_pos WHERE id = po2), 'F14 PO at the winning bid');
  r := prc_issue_po('buy','t1',q1,NULL,2); po := split_part(r,':',2)::bigint;
  -- receipt and match
  INSERT INTO rr VALUES (prc_receive('buy','t1',po,300000,'') = 'Someone other than the buyer confirms receipt.', 'F15 buyer cannot receive own order');
  PERFORM prc_receive('rcv','t1',po,200000,'Partial');
  r := prc_invoice('buy','t1',po,'INV-9',200000); i1 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES ((SELECT state = 'matched' FROM prc_invoices WHERE id = i1), 'F16 invoice matching receipt is matched');
  INSERT INTO rr VALUES (prc_invoice('fin','t1',po,'inv-9',200000) LIKE 'That invoice number is already recorded%', 'F17 duplicate invoice refused');
  r := prc_invoice('buy','t1',po,'INV-10',100000); i2 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES ((SELECT state = 'exception' AND exception_reason LIKE '%received%' FROM prc_invoices WHERE id = i2), 'F18 invoice beyond receipts is an exception');
  INSERT INTO rr VALUES (prc_invoice_step('buy','t1',i2,'handoff','') = 'Only matched or accepted invoices go to finance.', 'F19 exception cannot reach payment');
  INSERT INTO rr VALUES (prc_invoice_step('ap1','t1',i2,'accept','') = 'Record the reason.' AND prc_invoice_step('buy','t1',i2,'accept','Approved anyway') LIKE 'Only a purchasing approver%', 'F20 only an independent approver resolves');
  PERFORM prc_invoice_step('ap1','t1',i2,'dispute','Goods not received yet');
  PERFORM prc_receive('rcv','t1',po,-50000,'Two boxes damaged');
  INSERT INTO rr VALUES ((SELECT sum(amount) = 150000 FROM prc_receipts WHERE po_id = po), 'F21 returns reduce receipts');
  INSERT INTO rr VALUES (prc_invoice_step('fin','t1',i1,'posted','GL-1') = 'Only invoices handed to finance are posted.', 'F22 no posting without handoff');
  PERFORM prc_invoice_step('buy','t1',i1,'handoff','');
  INSERT INTO rr VALUES (prc_invoice_step('buy','t1',i1,'posted','GL-1') = 'Finance records the posting.', 'F23 procurement does not post');
  INSERT INTO rr VALUES (prc_invoice_step('fin','t1',i1,'posted','GL-1') IS NULL, 'F24 finance posts with reference');
  -- close releases commitment
  x := prc_used('t1','LAB')::text;
  PERFORM prc_close_po('buy','t1',po);
  INSERT INTO rr VALUES (prc_used('t1','LAB') < x::bigint, 'F25 closing releases uninvoiced commitment');
  -- table guards
  r := prc_submit('req3','t1','LAB','Paperco','Paper',1000,'k9'); q4 := split_part(r,':',2)::bigint;
  got := false; BEGIN UPDATE prc_requisitions SET state = 'approved' WHERE id = q4; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F26 table refuses approval without an approver');
  got := false; BEGIN UPDATE prc_invoices SET state = 'handed_off' WHERE id = i2; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F27 table refuses handoff without an authorizer');
  got := false; BEGIN DELETE FROM prc_receipts; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F28 receipts append-only');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...PRC_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('prc_requisitions') AS t`)));
}
