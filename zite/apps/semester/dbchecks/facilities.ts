import { neon } from '@neondatabase/serverless';
import { FAC_MIGRATION } from '../src/lib/facMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; l1 bigint; l2 bigint; q1 bigint; q2 bigint; o1 bigint; o2 bigint; pl bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  INSERT INTO rr VALUES (fac_set_staff('adm','t1','adm','coordinator',NULL) IS NOT NULL, 'F1 self-grant refused');
  INSERT INTO rr VALUES (fac_set_staff('adm','t1','con','contractor',NULL) LIKE 'Contractor access needs%', 'F2 contractors need an end date');
  PERFORM fac_set_staff('adm','t1','co','coordinator',NULL); PERFORM fac_set_staff('adm','t1','co2','coordinator',NULL);
  PERFORM fac_set_staff('adm','t1','tech','technician',NULL); PERFORM fac_set_staff('adm','t1','con','contractor', now() + interval '30 days');
  INSERT INTO rr VALUES (fac_location('t1','tech','Science Hall','Room 101',false) NOT LIKE 'ok:%', 'F3 technicians cannot add locations');
  r := fac_location('t1','co','Science Hall','Room 101',false); l1 := split_part(r,':',2)::bigint;
  r := fac_location('t1','co','Science Hall','Server room',true); l2 := split_part(r,':',2)::bigint;
  r := fac_report('t1','fr-0001','s1',l1,'plumbing','Sink leaking under the counter'); q1 := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (fac_report('t1','fr-0001','s1',l1,'plumbing','Sink leaking under the counter') = 'replay:' || q1, 'F4 replay');
  r := fac_report('t1','fr-0002','s2',l1,'plumbing','Water on the floor near the sink'); q2 := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (fac_triage('t1','tech',q1,1,'convert',NULL,'Fix sink','p2','') LIKE 'Only facilities coordinators%', 'F5 only coordinators triage');
  r := fac_triage('t1','co',q1,1,'convert',NULL,'Fix sink leak','p2',''); o1 := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (r LIKE 'order:%', 'F6 report becomes a work order');
  INSERT INTO rr VALUES (fac_triage('t1','co',q2,1,'duplicate',q2,NULL,NULL,'') LIKE 'Point to an earlier%', 'F7a not a duplicate of itself');
  x := fac_triage('t1','co',q2,1,'duplicate',q1,NULL,NULL,'');
  INSERT INTO rr VALUES (x IS NULL AND (SELECT order_id FROM fac_requests WHERE id = q2) = o1, 'F7b duplicate follows the same order ' || coalesce(x,''));
  INSERT INTO rr VALUES (fac_ostep('t1','co',o1,'assign',1,'','tech') = 'Authorize the work before assigning it.', 'F8 no assignment before authorization');
  PERFORM fac_ostep('t1','co',o1,'authorize',1,'',NULL);
  INSERT INTO rr VALUES (fac_ostep('t1','co',o1,'assign',2,'','co2') LIKE 'Assign work to a technician%', 'F9 coordinators are not assignees');
  INSERT INTO rr VALUES (fac_ostep('t1','co',o1,'assign',2,'','tech') IS NULL, 'F10 assign');
  INSERT INTO rr VALUES (fac_ostep('t1','con',o1,'start',3,'',NULL) = 'Work order not found.', 'F11 others cannot see or start it');
  PERFORM fac_ostep('t1','tech',o1,'start',3,'',NULL);
  INSERT INTO rr VALUES (fac_ostep('t1','tech',o1,'complete',4,'done',NULL) LIKE 'Describe the completed%', 'F12 completion needs evidence');
  INSERT INTO rr VALUES (fac_ostep('t1','tech',o1,'complete',4,'Replaced trap seal, ran water 10 minutes, dry',NULL) IS NULL, 'F13 complete with evidence');
  INSERT INTO rr VALUES (fac_ostep('t1','tech',o1,'close',5,'',NULL) IS NOT NULL, 'F14 technician cannot close');
  INSERT INTO rr VALUES (fac_ostep('t1','co',o1,'reopen',5,'Still dripping',NULL) IS NULL AND true, 'F15a reopen');
  INSERT INTO rr VALUES ((SELECT evidence FROM fac_orders WHERE id = o1) = '', 'F15b reopen clears old evidence');
  PERFORM fac_ostep('t1','tech',o1,'start',6,'',NULL); PERFORM fac_ostep('t1','tech',o1,'complete',7,'Replaced washer as well, checked after 1 hour',NULL);
  INSERT INTO rr VALUES (fac_ostep('t1','co',o1,'close',8,'',NULL) IS NULL, 'F16 coordinator closes');
  -- restricted locations and contractor expiry
  r := fac_create_order('t1','co',l2,'Replace rack fan','','p1'); o2 := split_part(r,':',2)::bigint;
  PERFORM fac_ostep('t1','co',o2,'authorize',1,'',NULL);
  INSERT INTO rr VALUES (fac_ostep('t1','co',o2,'assign',2,'','con') LIKE 'Contractors are not assigned to restricted%', 'F17 restricted location');
  UPDATE fac_staff SET expires_at = now() - interval '1 minute' WHERE user_id = 'con';
  INSERT INTO rr VALUES (fac_kind('t1','con') IS NULL, 'F18a expired contractor has no access');
  r := fac_create_order('t1','co',l1,'Paint wall','','p4');
  PERFORM fac_ostep('t1','co',split_part(r,':',2)::bigint,'authorize',1,'',NULL);
  INSERT INTO rr VALUES (fac_ostep('t1','co',split_part(r,':',2)::bigint,'assign',2,'','con') LIKE '%access has ended%', 'F18b expired contractor cannot be assigned');
  -- coordinator who did the work cannot inspect it: simulate via table guard
  got := false; BEGIN UPDATE fac_orders SET closed_by = assignee_id WHERE id = o1; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F19 closer is never the assignee (table)');
  got := false; BEGIN UPDATE fac_orders SET state = 'closed', evidence = '' WHERE id = o1; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F20 no closing without evidence (table)');
  -- plans
  r := fac_plan('t1','co',l1,'Quarterly HVAC filter',90,current_date - 1); pl := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (fac_generate('t1','co') = 'made:1', 'F21a due plan generates work');
  INSERT INTO rr VALUES (fac_generate('t1','co') = 'made:0' AND (SELECT next_due FROM fac_plans WHERE id = pl) = current_date + 89, 'F21b generated once, rolled forward');
  INSERT INTO rr VALUES (fac_triage('t2','co',q1,2,'triage',NULL,NULL,NULL,'') LIKE 'Only facilities%' OR fac_triage('t2','co',q1,2,'triage',NULL,NULL,NULL,'') = 'Report not found.', 'F22 other tenant');
  got := false; BEGIN DELETE FROM fac_events; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F23 history append-only');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...FAC_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('fac_orders') AS t`)));
}
