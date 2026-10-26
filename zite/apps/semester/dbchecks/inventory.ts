import { neon } from '@neondatabase/serverless';
import { AST_MIGRATION } from '../src/lib/astMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; loc bigint; loc2 bigint; a1 bigint; it bigint; r1 bigint; r2 bigint; r3 bigint; j bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  INSERT INTO rr VALUES (ast_set_staff('adm','t1','adm','controller') IS NOT NULL, 'F1 self-grant refused');
  PERFORM ast_set_staff('adm','t1','clk','clerk'); PERFORM ast_set_staff('adm','t1','ctl','controller'); PERFORM ast_set_staff('adm','t1','ctl2','controller');
  INSERT INTO rr VALUES (ast_location('t1','clk','Store A') NOT LIKE 'ok:%', 'F2 clerks do not add locations');
  r := ast_location('t1','ctl','Store A'); loc := split_part(r,':',2)::bigint; r := ast_location('t1','ctl','Lab 3'); loc2 := split_part(r,':',2)::bigint;
  -- tracked asset
  r := ast_receive_asset('t1','clk','as-0001','lap-0042','Laptop 14in','IT',loc); a1 := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%' AND (SELECT tag FROM ast_assets WHERE id = a1) = 'LAP-0042', 'F3 receive, tag normalised');
  INSERT INTO rr VALUES (ast_receive_asset('t1','clk','as-0001','lap-0042','Laptop 14in','IT',loc) = 'replay:' || a1, 'F4 replay');
  INSERT INTO rr VALUES (ast_receive_asset('t1','clk','as-0002',' lap-0042 ','Other','IT',loc) = 'That tag is already in use.', 'F5 unique tag');
  INSERT INTO rr VALUES (ast_receive_asset('t1','stu','as-0003','LAP-9','x laptop','IT',loc) NOT LIKE 'ok:%', 'F6 members cannot receive');
  INSERT INTO rr VALUES (ast_transfer('t1','clk',a1,1,'prof',loc2,'Issued to Prof') IS NULL, 'F7a custody assigned');
  INSERT INTO rr VALUES (ast_transfer('t1','clk',a1,1,'prof2',loc2,'stale') LIKE '%changed since%', 'F7b stale version');
  PERFORM ast_transfer('t1','clk',a1,2,'prof2',loc2,'Handed over');
  INSERT INTO rr VALUES ((SELECT count(*) FROM ast_custody WHERE asset_id = a1) = 3 AND (SELECT from_user FROM ast_custody WHERE asset_id = a1 ORDER BY id DESC LIMIT 1) = 'prof', 'F8 custody history kept');
  INSERT INTO rr VALUES (ast_inspect('t1','clk',a1,3,'needs_repair','x') IS NOT NULL, 'F9a repair needs a note');
  INSERT INTO rr VALUES (ast_inspect('t1','clk',a1,3,'needs_repair','Cracked hinge') IS NULL AND true, 'F9b inspection');
  INSERT INTO rr VALUES ((SELECT state FROM ast_assets WHERE id = a1) = 'in_repair', 'F9c failed inspection moves to repair');
  INSERT INTO rr VALUES (ast_astep('t1','ctl',a1,'request_disposal',4,'Beyond economic repair') IS NULL, 'F10 request disposal');
  INSERT INTO rr VALUES (ast_astep('t1','ctl',a1,'approve_disposal',5,'') LIKE 'Another controller%', 'F11 requester cannot approve');
  INSERT INTO rr VALUES (ast_astep('t1','clk',a1,'approve_disposal',5,'') LIKE 'Only an inventory controller%', 'F12 clerks cannot approve');
  INSERT INTO rr VALUES (ast_astep('t1','ctl2',a1,'approve_disposal',5,'') IS NULL AND true, 'F13a second controller approves');
  INSERT INTO rr VALUES ((SELECT state = 'disposed' AND custodian_id IS NULL FROM ast_assets WHERE id = a1), 'F13b disposed, custody ended');
  INSERT INTO rr VALUES (ast_transfer('t1','clk',a1,6,'prof',loc,'') = 'A disposed asset cannot change hands.', 'F14 nothing after disposal');
  -- stock
  r := ast_item('t1','ctl','toner-k','Black toner','cartridge'); it := split_part(r,':',2)::bigint;
  r := ast_receive_stock('t1','clk','st-0001',it,loc,3);
  INSERT INTO rr VALUES (ast_receive_stock('t1','clk','st-0001',it,loc,3) LIKE 'replay:%' AND (SELECT on_hand FROM ast_stock WHERE item_id = it) = 3, 'F15 receipt replay does not double stock');
  r := ast_reserve('t1','rs-0001','s1',it,loc,2,'Dept printer'); r1 := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (ast_reserve('t1','rs-0002','s2',it,loc,2,'') = 'Only 1 available.', 'F16 cannot over-reserve the last item');
  r := ast_reserve('t1','rs-0003','s2',it,loc,1,''); r2 := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (ast_rstep('t1','s1',r1,'issue',1,NULL) LIKE 'Inventory staff%', 'F17 requester cannot issue to themselves');
  INSERT INTO rr VALUES (ast_rstep('t1','clk',r1,'issue',1,NULL) IS NULL AND true, 'F18a issue');
  INSERT INTO rr VALUES ((SELECT on_hand = 1 AND reserved = 1 FROM ast_stock WHERE item_id = it), 'F18b issue consumes the reservation');
  INSERT INTO rr VALUES (ast_rstep('t1','clk',r1,'return',2,3) LIKE 'Only 2 can%', 'F19 returns cannot exceed what was issued');
  x := ast_rstep('t1','clk',r1,'return',2,1);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT on_hand FROM ast_stock WHERE item_id = it) = 2, 'F20 partial return ' || coalesce(x,''));
  INSERT INTO rr VALUES (ast_rstep('t1','s3',r2,'cancel',1,NULL) = 'Request not found.', 'F21 others cannot see or cancel my request');
  -- count and adjustment
  r := ast_count('t1','ctl',it,loc,0,'Shelf empty'); j := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%' AND (SELECT delta FROM ast_adjustments WHERE id = j) = -2, 'F22 differing count creates an adjustment');
  INSERT INTO rr VALUES (ast_adjust('t1','ctl',j,true,'') LIKE 'Someone other than%', 'F23 counter cannot approve');
  INSERT INTO rr VALUES (ast_adjust('t1','ctl2',j,true,'') LIKE 'This would leave less than%', 'F24 adjustment cannot strand a reservation');
  PERFORM ast_rstep('t1','s2',r2,'cancel',1,NULL);
  x := ast_adjust('t1','ctl2',j,true,'Confirmed missing');
  INSERT INTO rr VALUES (x IS NULL AND (SELECT on_hand FROM ast_stock WHERE item_id = it) = 0, 'F25 approved adjustment applied ' || coalesce(x,''));
  INSERT INTO rr VALUES (ast_count('t1','clk',it,loc,0,'') = 'match', 'F26 matching count makes no adjustment');
  got := false; BEGIN UPDATE ast_stock SET on_hand = -1 WHERE item_id = it; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F27 stock never negative (table)');
  got := false; BEGIN UPDATE ast_stock SET reserved = 5 WHERE item_id = it; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F28 reservations never exceed stock (table)');
  got := false; BEGIN DELETE FROM ast_custody; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F29 custody history append-only');
  got := false; BEGIN UPDATE ast_moves SET delta = 99; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F30 movements append-only');
  INSERT INTO rr VALUES (ast_transfer('t2','clk',a1,6,'x',NULL,'') LIKE 'Only inventory staff%' OR ast_transfer('t2','clk',a1,6,'x',NULL,'') = 'Asset not found.', 'F31 other tenant');
  PERFORM ast_set_staff('adm','t1','clk',NULL);
  INSERT INTO rr VALUES (ast_receive_stock('t1','clk','st-0009',it,loc,1) NOT LIKE 'ok:%', 'F32 revoked clerk loses access');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...AST_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('ast_assets') AS t`)));
}
