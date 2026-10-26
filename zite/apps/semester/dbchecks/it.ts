import { neon } from '@neondatabase/serverless';
import { ITS_MIGRATION } from '../src/lib/itsMigration';

export const CHECKS = `DO $$
DECLARE r text; t1 bigint; t2 bigint; t3 bigint; t4 bigint; sv bigint; c bigint; e bigint; c3 bigint; v int; x text; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  -- staff
  INSERT INTO rr VALUES (its_set_staff('adm','t1','adm',true,false) IS NOT NULL, 'F1 self-grant refused');
  PERFORM its_set_staff('adm','t1','ag',true,false); PERFORM its_set_staff('adm','t1','ag2',true,false); PERFORM its_set_staff('adm','t1','sec',false,true);
  INSERT INTO rr VALUES (its_service('t1','ag',false,NULL,'Email','','own',true) NOT LIKE 'ok:%', 'F2 non-admin cannot set a service');
  r := its_service('t1','adm',true,NULL,'Email','Campus email','own',true); sv := split_part(r,':',2)::bigint;
  -- request path
  r := its_open('t1','key-0001','stu',sv,'request','Cannot log in','My password reset link never arrives.'); t1 := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'F3 open');
  INSERT INTO rr VALUES (its_open('t1','key-0001','stu',sv,'request','Cannot log in','My password reset link never arrives.') = 'replay:' || t1, 'F4 replay returns same ticket');
  INSERT INTO rr VALUES (its_open('t1','key-0001','stu',sv,'request','Different title','My password reset link never arrives.') NOT LIKE '%:%', 'F5 same key, different content refused');
  INSERT INTO rr VALUES (its_tstep('t1',t1,'stu','assign',1,'',NULL,NULL) LIKE 'Someone else%', 'F6 requester cannot assign');
  INSERT INTO rr VALUES (its_tstep('t1',t1,'ag','assign',1,'','stu',NULL) IS NOT NULL, 'F7 cannot assign to a non-agent');
  INSERT INTO rr VALUES (its_tstep('t1',t1,'ag','assign',1,'',NULL,NULL) IS NULL, 'F8a assign');
  INSERT INTO rr VALUES (its_tstep('t1',t1,'ag','fulfill',1,'Reset sent manually',NULL,NULL) LIKE '%changed since%', 'F8b stale version refused');
  INSERT INTO rr VALUES (its_tstep('t1',t1,'ag','fulfill',2,'done',NULL,NULL) IS NOT NULL, 'F9a short fulfil note refused');
  INSERT INTO rr VALUES (its_tstep('t1',t1,'ag','fulfill',2,'Reset sent manually from admin console',NULL,NULL) IS NULL, 'F9b fulfil');
  INSERT INTO rr VALUES (its_tstep('t1',t1,'ag','confirm',3,'',NULL,NULL) IS NOT NULL, 'F10a agent cannot confirm');
  x := its_tstep('t1',t1,'stu','confirm',3,'',NULL,NULL);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT confirmed AND state='closed' FROM its_tickets WHERE id=t1), 'F10b requester confirms ' || coalesce(x,''));
  -- security incident
  r := its_open('t1','key-0002','stu',NULL,'security_incident','Phishing email','Got an email asking for my password, I clicked it.'); t2 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (its_tstep('t1',t2,'ag','assign',1,'',NULL,NULL) = 'Ticket not found.', 'F11 ordinary agent cannot see a security incident');
  INSERT INTO rr VALUES (its_tstep('t1',t2,'sec','assign',1,'','ag',NULL) LIKE 'Security incidents%', 'F12a cannot hand to non-security');
  INSERT INTO rr VALUES (its_tstep('t1',t2,'sec','assign',1,'',NULL,NULL) IS NULL, 'F12b security assigns self');
  -- incident needs problem review before confirm
  r := its_open('t1','key-0003','stu',sv,'incident','Email is down','Nobody in my dorm can send email since 9am.'); t3 := split_part(r,':',2)::bigint;
  PERFORM its_tstep('t1',t3,'ag','assign',1,'',NULL,NULL); PERFORM its_tstep('t1',t3,'ag','fulfill',2,'Restarted the mail relay',NULL,NULL);
  INSERT INTO rr VALUES (its_tstep('t1',t3,'stu','confirm',3,'',NULL,NULL) IS NOT NULL, 'F13 incident cannot be confirmed before review');
  INSERT INTO rr VALUES (its_tstep('t1',t3,'ag','review',3,'disk',NULL,NULL) IS NOT NULL, 'F14a short review refused');
  INSERT INTO rr VALUES (its_tstep('t1',t3,'ag','review',3,'Relay queue filled the disk; alert added at 80%',NULL,NULL) IS NULL, 'F14b review');
  INSERT INTO rr VALUES (its_tstep('t1',t3,'stu','confirm',4,'',NULL,NULL) IS NULL, 'F14c confirm after review');
  INSERT INTO rr VALUES (its_tstep('t2',t3,'ag','assign',5,'',NULL,NULL) = 'Ticket not found.', 'F15 other tenant cannot touch it');
  -- changes
  INSERT INTO rr VALUES (its_change_open('t1','chg-0001','stu',sv,'Raise quota','Increase mailbox quota for all students to 5GB','Set quota back to 2GB','low',false) NOT LIKE 'ok:%', 'F16 non-agent cannot raise a change');
  r := its_change_open('t1','chg-0001','ag',sv,'Raise quota','Increase mailbox quota for all students to 5GB','Set quota back to 2GB','low',false); c := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (its_cstep('t1',c,'ag','approve',1,'',NULL,NULL) LIKE 'The service owner%', 'F17 raiser cannot approve');
  INSERT INTO rr VALUES (its_cstep('t1',c,'ag','implement',1,'',NULL,NULL) LIKE 'A change is made only after%', 'F18 normal change not made before approval');
  INSERT INTO rr VALUES (its_cstep('t1',c,'ag2','approve',1,'',NULL,NULL) IS NOT NULL, 'F19a another agent (not owner) cannot approve');
  x := its_cstep('t1',c,'own','approve',1,'',NULL,NULL);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT approved_hash = plan_hash FROM its_changes WHERE id=c), 'F19b owner approves exact plan ' || coalesce(x,''));
  x := its_cstep('t1',c,'ag','edit',2,'','Increase mailbox quota for all students to 10GB','Set quota back to 2GB');
  INSERT INTO rr VALUES (x IS NULL
    AND (SELECT state='submitted' AND approved_hash IS NULL FROM its_changes WHERE id=c), 'F20 editing the plan withdraws approval ' || coalesce(x,''));
  PERFORM its_cstep('t1',c,'own','approve',3,'',NULL,NULL);
  INSERT INTO rr VALUES (its_cstep('t1',c,'ag','implement',4,'',NULL,NULL) IS NULL, 'F21a implement after approval');
  r := its_open('t1','key-0004','stu',sv,'request','Bigger mailbox','Please raise my mailbox size, it is full.'); t4 := split_part(r,':',2)::bigint;
  PERFORM its_tstep('t1',t4,'ag','assign',1,'',NULL,NULL); PERFORM its_tstep('t1',t4,'ag','link',2,'',NULL,c);
  PERFORM its_tstep('t1',t4,'ag','fulfill',3,'Quota change has been made',NULL,NULL);
  INSERT INTO rr VALUES (its_tstep('t1',t4,'ag','close',4,'No reply in 5 days',NULL,NULL) IS NULL AND NOT (SELECT confirmed FROM its_tickets WHERE id=t4), 'F21b agent close records no confirmation');
  INSERT INTO rr VALUES ((SELECT state FROM its_changes WHERE id=c) = 'implemented', 'F22 closing the ticket did not mark the change verified');
  INSERT INTO rr VALUES (its_cstep('t1',c,'ag','verify',5,'Checked 3 mailboxes show 10GB',NULL,NULL) IS NULL, 'F22b verify');
  -- emergency
  r := its_change_open('t1','chg-0002','ag',sv,'Block spam sender','Block the sending domain at the gateway right now','Remove the block rule','high',true); e := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (its_cstep('t1',e,'ag','implement',1,'',NULL,NULL) IS NULL, 'F23a emergency change made before approval');
  PERFORM its_cstep('t1',e,'ag','verify',2,'No new messages from domain',NULL,NULL);
  INSERT INTO rr VALUES (its_cstep('t1',e,'ag','review',3,'Looks fine to me, nothing else needed',NULL,NULL) IS NOT NULL, 'F23b raiser cannot review own emergency');
  INSERT INTO rr VALUES (its_cstep('t1',e,'own','review',3,'ok',NULL,NULL) IS NOT NULL, 'F23c short review refused');
  INSERT INTO rr VALUES (its_cstep('t1',e,'own','review',3,'Justified: active phishing campaign; rule kept 30 days',NULL,NULL) IS NULL, 'F24 owner reviews emergency');
  -- table-level guards
  got := false; BEGIN UPDATE its_events SET note = 'x'; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F25 history append-only');
  r := its_change_open('t1','chg-0003','ag',sv,'Rename lists','Rename every mailing list to the new pattern','Rename them back','low',false); c3 := split_part(r,':',2)::bigint;
  got := false; BEGIN UPDATE its_changes SET state = 'implemented' WHERE id = c3; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F26 direct write cannot implement an unapproved change');
  got := false; BEGIN UPDATE its_changes SET approved_by = 'ag', approved_hash = plan_hash, state = 'approved' WHERE id = c3; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F27 direct write cannot make the raiser the approver');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...ITS_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  const left = await sql.query(`SELECT to_regclass('its_tickets') AS t`);
  console.log('left behind:', JSON.stringify(left));
}
