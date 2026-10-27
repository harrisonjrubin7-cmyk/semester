import { neon } from '@neondatabase/serverless';
import { HRM_MIGRATION } from '../src/lib/hrmMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; p bigint; p2 bigint; e bigint; e2 bigint; lv bigint; v int; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  INSERT INTO rr VALUES (hrm_set_staff('adm','t1','adm','officer',true) IS NOT NULL, 'F1 no self-grant');
  PERFORM hrm_set_staff('adm','t1','off','officer',true); PERFORM hrm_set_staff('adm','t1','app','approver',true); PERFORM hrm_set_staff('adm','t1','off','approver',true);
  INSERT INTO rr VALUES (hrm_position('app','t1','LIB-ASST','Library assistant','Library','Staff',0.5) LIKE 'Only an HR officer%', 'F2 only officers create positions');
  r := hrm_position('off','t1','lib-asst','Library assistant','Library','Staff',0.5); p := split_part(r,':',2)::bigint;
  r := hrm_position('off','t1','TUT-1','Peer tutor','Learning center','Tutor',0.25); p2 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (hrm_propose('off','t1',p,'off',current_date) LIKE 'Someone else proposes%', 'F3 no self-appointment');
  r := hrm_propose('off','t1',p,'stu',current_date); e := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (hrm_propose('off','t1',p,'stu2',current_date) LIKE 'That position already has%', 'F4 one live appointment per position');
  INSERT INTO rr VALUES (hrm_decide('off','t1',e,true,1) LIKE 'A different approver%', 'F5 proposer cannot approve');
  INSERT INTO rr VALUES (hrm_decide('app','t1',e,true,1) IS NULL, 'F6 approver approves');
  INSERT INTO rr VALUES ((SELECT state = 'approved' AND access_state = 'requested' FROM hrm_employments WHERE id = e), 'F7 approval raises an access request, grants nothing');
  INSERT INTO rr VALUES (hrm_access('off','t1',e,'provisioned',false) LIKE 'Access changes are executed by an administrator%', 'F8 HR cannot execute access');
  INSERT INTO rr VALUES (hrm_access('stu','t1',e,'provisioned',true) LIKE 'Someone else changes your own access%', 'F9 no self-provisioning even as admin');
  INSERT INTO rr VALUES (hrm_access('adm','t1',e,'provisioned',true) IS NULL, 'F10 admin provisions');
  INSERT INTO rr VALUES ((SELECT state = 'active' FROM hrm_employments WHERE id = e) AND (SELECT done_at IS NOT NULL FROM hrm_tasks WHERE employment_id = e AND item = 'Access provisioned'), 'F11 active once provisioned; checklist ticked');
  -- leave
  INSERT INTO rr VALUES (hrm_leave_request('other','t1',e,'vacation',current_date+10,current_date+12,'') LIKE 'Leave is requested on your own%', 'F12 only the employee requests their leave');
  r := hrm_leave_request('stu','t1',e,'vacation',current_date+10,current_date+12,'Family visit'); lv := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (hrm_leave_request('stu','t1',e,'sick',current_date+11,current_date+11,'') LIKE 'This overlaps%', 'F13 no overlapping leave');
  INSERT INTO rr VALUES (NOT hrm_on_leave(e,current_date+11), 'F14 requested leave is not leave yet');
  PERFORM hrm_leave_decide('app','t1',lv,true,'');
  INSERT INTO rr VALUES (hrm_on_leave(e,current_date+11) AND NOT hrm_on_leave(e,current_date+13), 'F15 leave projected by effective date');
  -- tasks
  INSERT INTO rr VALUES (hrm_task('off','t1',(SELECT id FROM hrm_tasks WHERE employment_id = e AND item = 'Access provisioned')) LIKE 'Access items are completed when an administrator%', 'F16 access checklist only via identity');
  -- offboarding
  SELECT version INTO v FROM hrm_employments WHERE id = e;
  INSERT INTO rr VALUES (hrm_end('stu','t1',e,current_date,'Quitting the job',v) LIKE 'Only an HR officer%', 'F17 employee cannot end their own record');
  INSERT INTO rr VALUES (hrm_end('off','t1',e,current_date,'End of semester contract',v) IS NULL, 'F18 officer ends employment');
  INSERT INTO rr VALUES ((SELECT state = 'ended' AND access_state = 'removal_requested' FROM hrm_employments WHERE id = e) AND (SELECT state = 'open' FROM hrm_positions WHERE id = p), 'F19 ending requests access removal and reopens the position');
  INSERT INTO rr VALUES (hrm_access('adm','t1',e,'provisioned',true) LIKE 'No access request is waiting%', 'F20 ended employment cannot be re-provisioned');
  PERFORM hrm_access('adm','t1',e,'removed',true);
  INSERT INTO rr VALUES ((SELECT access_state = 'removed' FROM hrm_employments WHERE id = e), 'F21 removal executed and recorded');
  INSERT INTO rr VALUES (hrm_leave_request('stu','t1',e,'vacation',current_date+20,current_date+21,'') LIKE 'Leave is requested on your own current%', 'F22 no leave after employment ends');
  -- table guards
  r := hrm_propose('off','t1',p2,'stu',current_date); e2 := split_part(r,':',2)::bigint;
  got := false; BEGIN UPDATE hrm_employments SET state = 'active', approved_by = 'off2', access_state = 'none' WHERE id = e2; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F23 table refuses active without provisioned access');
  got := false; BEGIN UPDATE hrm_employments SET approved_by = 'off' WHERE id = e2; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F24 table refuses proposer as approver');
  got := false; BEGIN DELETE FROM hrm_events; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F25 history append-only');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...HRM_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('hrm_employments') AS t`)));
}
