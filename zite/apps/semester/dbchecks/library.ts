import { neon } from '@neondatabase/serverless';
import { LBY_MIGRATION } from '../src/lib/lbyMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; i1 bigint; i2 bigint; l1 bigint; l2 bigint; l3 bigint; l5 bigint; h2 bigint; h3 bigint; q bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  INSERT INTO rr VALUES (lby_set_staff('adm','t1','adm',true) IS NOT NULL, 'F1 self-grant refused');
  PERFORM lby_set_staff('adm','t1','lib',true); PERFORM lby_set_staff('adm','t1','lib2',true);
  INSERT INTO rr VALUES (lby_item('t1','p1',NULL,'Wealth of Nations','Smith','print',1,true,'') NOT LIKE 'ok:%', 'F2 non-staff cannot add items');
  r := lby_item('t1','lib',NULL,'Wealth of Nations','Smith','print',1,true,''); i1 := split_part(r,':',2)::bigint;
  r := lby_item('t1','lib',NULL,'Game Theory (e-book)','Osborne','ebook',1,true,''); i2 := split_part(r,':',2)::bigint;
  r := lby_borrow('t1','k-0001','p1',i1); l1 := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'F3 borrow');
  INSERT INTO rr VALUES (lby_borrow('t1','k-0001','p1',i1) = 'replay:' || l1, 'F4 replay');
  INSERT INTO rr VALUES (lby_borrow('t1','k-0002','p2',i1) LIKE 'No copy is free%', 'F5 last copy not lent twice');
  r := lby_hold('t1','p2',i1); h2 := NULLIF(split_part(r,':',2),'')::bigint; INSERT INTO rr VALUES (r LIKE 'ok:%', 'F6a hold');
  r := lby_hold('t1','p3',i1); h3 := NULLIF(split_part(r,':',2),'')::bigint; INSERT INTO rr VALUES (r LIKE 'ok:%', 'F6b second hold');
  INSERT INTO rr VALUES (lby_renew('t1','p1',l1,1) LIKE 'Someone else is waiting%', 'F7 no renewal while others wait');
  INSERT INTO rr VALUES (lby_return('t1','p1',l1,1) LIKE 'Bring printed%', 'F8 print returns go through the desk');
  x := lby_return('t1','lib',l1,1);
  INSERT INTO rr VALUES (x IS NULL, 'F9a staff records return ' || coalesce(x,''));
  INSERT INTO rr VALUES ((SELECT patron_id IS NULL AND state = 'returned' FROM lby_loans WHERE id = l1), 'F9b returned loan forgets the borrower');
  INSERT INTO rr VALUES ((SELECT state FROM lby_holds WHERE id = h2) = 'ready', 'F10a first hold becomes ready');
  INSERT INTO rr VALUES (lby_borrow('t1','k-0003','p3',i1) LIKE 'No copy is free%', 'F10b copy kept for the first in line');
  r := lby_borrow('t1','k-0004','p2',i1); l2 := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'F11a ready holder borrows');
  INSERT INTO rr VALUES ((SELECT state = 'fulfilled' AND patron_id IS NULL FROM lby_holds WHERE id = h2), 'F11b fulfilled hold forgets the patron');
  r := lby_borrow('t1','k-0005','p1',i2); l3 := NULLIF(split_part(r,':',2),'')::bigint;
  x := lby_return('t1','p1',l3,1);
  INSERT INTO rr VALUES (x IS NULL, 'F13 patron returns an e-book ' || coalesce(x,''));
  INSERT INTO rr VALUES (lby_renew('t1','p2',l2,1) LIKE 'Someone else%', 'F14a p3 still waiting');
  PERFORM lby_cancel_hold('t1','p3',h3);
  INSERT INTO rr VALUES (lby_renew('t1','p2',l2,1) IS NULL AND lby_renew('t1','p2',l2,2) IS NULL, 'F14b two renewals');
  INSERT INTO rr VALUES (lby_renew('t1','p2',l2,3) LIKE 'Already renewed%', 'F15 third renewal refused');
  INSERT INTO rr VALUES (lby_item('t1','lib',i1,'Wealth of Nations','Smith','print',0,true,'') LIKE '%out on loan%', 'F16 copies cannot drop below loans');
  r := lby_hold('t1','p3',i1); h3 := NULLIF(split_part(r,':',2),'')::bigint;
  PERFORM lby_return('t1','lib',l2,3);
  UPDATE lby_holds SET ready_until = now() - interval '1 hour' WHERE id = h3;
  r := lby_borrow('t1','k-0006','p5',i1); l5 := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%' AND (SELECT state = 'expired' AND patron_id IS NULL FROM lby_holds WHERE id = h3), 'F17 an expired ready hold releases the copy');
  INSERT INTO rr VALUES ((SELECT count(*) FROM lby_events WHERE subject IN ('loan','hold') AND actor_id IN ('p1','p2','p3','p5')) = 0, 'F12 history never names a borrower');
  INSERT INTO rr VALUES (lby_return('t2','lib',l5,1) = 'Loan not found.', 'F23 another tenant cannot touch it');
  -- requests
  r := lby_request('t1','rq-0001','p4','Journal of Finance','Needed for my econ thesis this term'); q := NULLIF(split_part(r,':',2),'')::bigint;
  r := lby_request('t1','rq-0002','lib','Own pick','Staff member asking for a book'); 
  INSERT INTO rr VALUES (lby_rstep('t1',split_part(r,':',2)::bigint,'lib','review',1,'',NULL,NULL,NULL,NULL) LIKE 'Another member%', 'F18 staff cannot decide their own request');
  INSERT INTO rr VALUES (lby_rstep('t1',q,'p4','approve',1,'',NULL,NULL,NULL,NULL) IS NOT NULL, 'F18b requester cannot approve');
  INSERT INTO rr VALUES (lby_rstep('t1',q,'lib','approve',1,'Campus licence, 3 seats',true,NULL,NULL,NULL) IS NOT NULL, 'F18c approve needs review first');
  PERFORM lby_rstep('t1',q,'lib','review',1,'',NULL,NULL,NULL,NULL);
  INSERT INTO rr VALUES (lby_rstep('t1',q,'lib','approve',2,'Campus licence, 3 seats',NULL,NULL,NULL,NULL) LIKE '%accessibility%', 'F19 approval needs an accessibility answer');
  INSERT INTO rr VALUES (lby_rstep('t1',q,'lib','approve',2,'Campus licence, 3 seats',true,NULL,NULL,NULL) IS NULL, 'F19b approve');
  x := lby_rstep('t1',q,'lib2','publish',3,'',NULL,'ebook',3,'AFA');
  INSERT INTO rr VALUES (x IS NULL AND (SELECT item_id IS NOT NULL FROM lby_requests WHERE id = q), 'F20 publish adds the item ' || coalesce(x,''));
  got := false; BEGIN UPDATE lby_requests SET decided_by = requester_id WHERE id = q; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F21 a requester can never be the decider');
  got := false; BEGIN DELETE FROM lby_events; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F22 history append-only');
  got := false; BEGIN UPDATE lby_loans SET state = 'returned' WHERE id = l5; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F25 a returned loan cannot keep a borrower');
  PERFORM lby_set_staff('adm','t1','lib',false);
  INSERT INTO rr VALUES (lby_item('t1','lib',NULL,'After revoke','','print',1,true,'') NOT LIKE 'ok:%', 'F24 revoked staff lose access');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...LBY_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('lby_items') AS t`)));
}
