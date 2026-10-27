import { neon } from '@neondatabase/serverless';
import { CNE_MIGRATION } from '../src/lib/cneMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; o1 bigint; o2 bigint; o3 bigint; s1 bigint; s2 bigint; s3 bigint; e1 bigint; e2 bigint; e3 bigint; e4 bigint; e5 bigint; v int; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  -- roles
  INSERT INTO rr VALUES (cne_set_staff('adm','t1','adm','coordinator',true) IS NOT NULL, 'F1 no self-grant');
  PERFORM cne_set_staff('adm','t1','co','coordinator',true); PERFORM cne_set_staff('adm','t1','au','authority',true); PERFORM cne_set_staff('adm','t1','fi','finance',true);
  PERFORM cne_set_staff('adm','t1','fi2','finance',true);
  INSERT INTO rr VALUES (cne_offering_save('au','t1',NULL,'PM-101','Project management basics','',25000,2,'{}',75,false,0) LIKE 'Only a continuing-education coordinator%', 'F2 only coordinators create offerings');
  r := cne_offering_save('co','t1',NULL,'pm-101','Project management basics','Six evenings',25000,2,'{}',75,true,0); o1 := split_part(r,':',2)::bigint;
  r := cne_offering_save('co','t1',NULL,'PM-201','Advanced project management','',0,10,ARRAY['PM-101'],0,true,0); o2 := split_part(r,':',2)::bigint;
  r := cne_offering_save('co','t1',NULL,'XL-100','Spreadsheets','',10000,10,'{}',0,false,0); o3 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (cne_publish('co','t1',o1,1) = 'Schedule at least one session first.', 'F3 no publish without a session');
  r := cne_session_add('co','t1',o1,now()-interval '3 hours',now()-interval '1 hour','Room 2'); s1 := split_part(r,':',2)::bigint;
  r := cne_session_add('co','t1',o1,now()-interval '2 days',now()-interval '2 days'+interval '2 hours','Room 2'); s2 := split_part(r,':',2)::bigint;
  PERFORM cne_publish('co','t1',o1,1);
  PERFORM cne_session_add('co','t1',o2,now()+interval '10 days',now()+interval '10 days 2 hours','Room 3'); PERFORM cne_publish('co','t1',o2,1);
  r := cne_session_add('co','t1',o3,now()+interval '5 days',now()+interval '5 days 2 hours','Lab'); s3 := split_part(r,':',2)::bigint; PERFORM cne_publish('co','t1',o3,1);
  -- enrollment
  INSERT INTO rr VALUES (cne_enroll('l1',o3,false) = 'This offering is not open for enrollment.', 'F4 members-only offering refuses outsiders');
  r := cne_enroll('l1',o1,false); e1 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%' AND cne_enroll('l1',o1,false) = 'replay:' || e1, 'F5 public offering enrolls independent learner; repeat replays');
  r := cne_enroll('l2',o1,false); e2 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (cne_enroll('l3',o1,false) = 'This offering is full.', 'F6 capacity');
  INSERT INTO rr VALUES (cne_enroll('l1',o2,false) = 'Complete first: PM-101.', 'F7 prerequisite enforced');
  -- payment
  INSERT INTO rr VALUES (cne_pay('co','t1',e1,'paid','INV-1001','',1) LIKE 'Only finance%', 'F8 only finance records payment');
  INSERT INTO rr VALUES (cne_pay('fi','t1',e1,'waived','','',1) LIKE 'Only the continuing-education authority waives%', 'F9 waivers need the authority');
  PERFORM cne_pay('fi','t1',e1,'paid','INV-1001','',1);
  PERFORM cne_pay('fi','t1',e2,'sponsored','','Acme Corp',1);
  -- attendance
  INSERT INTO rr VALUES (cne_attend('co','t1',e1,s3,true) LIKE 'That session is not part%', 'F10 attendance only for the offering''s sessions');
  PERFORM cne_attend('co','t1',e1,s1,true); PERFORM cne_attend('co','t1',e1,s2,true);
  PERFORM cne_attend('co','t1',e2,s1,true); PERFORM cne_attend('co','t1',e2,s2,false);
  -- completion
  INSERT INTO rr VALUES (cne_complete('co','t1',e1,true,'',3) LIKE 'Only the continuing-education authority%', 'F11 only the authority completes');
  SELECT version INTO v FROM cne_enrollments WHERE id = e2;
  x := cne_complete('au','t1',e2,true,'',v);
  INSERT INTO rr VALUES (x = 'Attendance is 50%; this offering requires 75%.', 'F12 attendance rule: ' || coalesce(x,''));
  SELECT version INTO v FROM cne_enrollments WHERE id = e1;
  INSERT INTO rr VALUES (cne_complete('au','t1',e1,true,'Passed final project',v) IS NULL, 'F13 authority completes');
  INSERT INTO rr VALUES ((SELECT count(*) = 1 FROM cne_credentials WHERE enrollment_id = e1 AND learner_id = 'l1' AND offering_code = 'PM-101'), 'F14 credential issued once');
  r := cne_enroll('l1',o2,false); e3 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%' AND (SELECT payment_state = 'not_required' FROM cne_enrollments WHERE id = e3), 'F15 prerequisite met by credential; free offering needs no payment');
  -- refund distinct from completion
  INSERT INTO rr VALUES (cne_refund_request('l1',e1,'Changed my mind after finishing') = 'A completed enrollment with a credential is not refunded.', 'F16 no refund after credential');
  got := false; BEGIN UPDATE cne_enrollments SET refund_state = 'approved', refund_cents = 100, refund_by = 'fi' WHERE id = e1; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F17 table refuses refund on a completed enrollment');
  -- withdrawal before start => refund requested; finance decides; learner cannot
  r := cne_enroll('l4',o3,true); e4 := split_part(r,':',2)::bigint;
  PERFORM cne_pay('fi','t1',e4,'paid','INV-2001','',1);
  PERFORM cne_withdraw('l4',e4);
  INSERT INTO rr VALUES ((SELECT state = 'withdrawn' AND refund_state = 'requested' AND refund_cents = 10000 AND completion_state = 'in_progress' FROM cne_enrollments WHERE id = e4), 'F18 withdraw before start requests full refund, completion untouched');
  SELECT version INTO v FROM cne_enrollments WHERE id = e4;
  INSERT INTO rr VALUES (cne_refund_decide('fi','t1',e4,'approve',20000,'',v) = 'A refund is between zero and the amount paid.', 'F19 refund capped at amount paid');
  INSERT INTO rr VALUES (cne_refund_decide('fi','t1',e4,'issued',NULL,'RF-1',v) = 'Approve the refund first.', 'F20 issue only after approval');
  PERFORM cne_refund_decide('fi','t1',e4,'approve',10000,'',v);
  x := cne_refund_decide('fi2','t1',e4,'issued',NULL,'RF-1',v+1);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT refund_state = 'issued' AND refund_ref = 'RF-1' FROM cne_enrollments WHERE id = e4), 'F21 refund issued with reference');
  -- institution cancellation: enrollments cancelled, paid ones get refund requests, no credentials
  r := cne_enroll('l5',o3,true); e5 := split_part(r,':',2)::bigint;
  PERFORM cne_pay('fi','t1',e5,'paid','INV-3001','',1);
  SELECT version INTO v FROM cne_offerings WHERE id = o3;
  INSERT INTO rr VALUES (cne_cancel_offering('co','t1',o3,'Instructor unavailable',v) IS NULL, 'F22 coordinator cancels');
  INSERT INTO rr VALUES ((SELECT state = 'cancelled_by_institution' AND refund_state = 'requested' AND refund_requested_by = 'institution-cancellation' FROM cne_enrollments WHERE id = e5), 'F23 cancellation requests refunds');
  INSERT INTO rr VALUES ((SELECT state = 'withdrawn' AND refund_state = 'issued' FROM cne_enrollments WHERE id = e4), 'F24 earlier withdrawal and refund unchanged by cancellation');
  SELECT version INTO v FROM cne_enrollments WHERE id = e5;
  INSERT INTO rr VALUES (cne_complete('au','t1',e5,true,'',v) = 'This enrollment is not active.', 'F25 no completion after cancellation');
  SELECT version INTO v FROM cne_offerings WHERE id = o1;
  INSERT INTO rr VALUES (cne_cancel_offering('co','t1',o1,'Low demand',v) LIKE 'Learners have already completed%', 'F26 cannot cancel an offering someone completed');
  -- sessions with attendance are fixed
  SELECT version INTO v FROM cne_sessions WHERE id = s1;
  INSERT INTO rr VALUES (cne_session_change('co','t1',s1,false,now(),now()+interval '1 hour','Room 9',v) LIKE 'Attendance is recorded%', 'F27 attended sessions cannot be rescheduled');
  -- self-decisions refused
  PERFORM cne_set_staff('adm','t1','l2','authority',true);
  SELECT version INTO v FROM cne_enrollments WHERE id = e2;
  INSERT INTO rr VALUES (cne_complete('l2','t1',e2,false,'Did not attend enough',v) = 'You cannot decide your own completion.', 'F28 no self-completion');
  -- credential guard and revocation
  got := false; BEGIN DELETE FROM cne_credentials WHERE enrollment_id = e1; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F29 credentials cannot be deleted');
  PERFORM cne_revoke('au','t1',(SELECT id FROM cne_credentials WHERE enrollment_id = e1),'Issued in error');
  r := cne_enroll('l1',o2,false);
  INSERT INTO rr VALUES (r = 'replay:' || e3, 'F30 existing enrollment unaffected');
  INSERT INTO rr VALUES (cne_enroll('l2',o2,false) = 'Complete first: PM-101.', 'F31 prerequisite still enforced for others');
  got := false; BEGIN DELETE FROM cne_events; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F32 history append-only');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...CNE_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('cne_offerings') AS t`)));
}
