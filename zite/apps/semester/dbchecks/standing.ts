import { neon } from '@neondatabase/serverless';
import { STN_MIGRATION } from '../src/lib/stnMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; d1 bigint; d2 bigint; a1 bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO rr VALUES (stn_record('stu','t1',false,'s1','Fall 2026','Academic probation','Academic probation','Below 2.0 cumulative','You are on academic probation.',0) LIKE 'Only a registrar%', 'A1 only a registrar records');
  INSERT INTO rr VALUES (stn_record('s1','t1',true,'s1','Fall 2026','Academic probation','Good standing','Self service attempt','You are fine, honestly.',0) LIKE 'You cannot record standing on your own%', 'A2 no decisions on your own record');
  INSERT INTO rr VALUES (stn_record('reg1','t1',true,'s1','Fall 2026','Good standing','Academic suspension','Testing a harsh call','You are suspended for a term.',0) LIKE 'Suspension needs%', 'A3 no suspension when the calculation shows good standing');
  INSERT INTO rr VALUES (stn_record('reg1','t1',true,'s1','Fall 2026','Academic probation','Academic probation','short','You are on academic probation.',0) LIKE 'Give the reason%', 'A4 a rationale is required');
  r := stn_record('reg1','t1',true,'s1','Fall 2026','Refer to standing committee','Academic suspension','Second term below 2.0; committee met 3 Jan','You are suspended for Spring 2027. You may appeal within 14 days.',0);
  d1 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%:1', 'A5 suspension recorded as version 1');
  INSERT INTO rr VALUES (stn_record('reg2','t1',true,'s1','Fall 2026','Refer to standing committee','Academic probation','Changing it again now','You are on academic probation.',0) LIKE 'Someone recorded a decision%', 'A6 stale version refused');
  INSERT INTO rr VALUES (stn_link_hold('t1',d1,'hold-1') = 'ok' AND stn_link_hold('t1',d1,'hold-2') = 'No suspension to link.', 'A7 one hold per suspension');
  INSERT INTO rr VALUES (stn_appeal('s2','t1',d1,'This is not my decision to appeal at all') = 'Decision not found.', 'A8 only the student appeals');
  INSERT INTO rr VALUES (stn_appeal('s1','t1',d1,'too short') LIKE 'Explain your appeal%', 'A9 an appeal explains itself');
  r := stn_appeal('s1','t1',d1,'I was in hospital for six weeks; documentation attached to my advisor.'); a1 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'A10 student appeals within the window');
  INSERT INTO rr VALUES (stn_appeal('s1','t1',d1,'A second appeal for the same decision again') LIKE 'You have already appealed%', 'A11 one appeal per decision');
  INSERT INTO rr VALUES (stn_record('reg2','t1',true,'s1','Fall 2026','Refer to standing committee','Academic probation','Changing while appeal open','You are on academic probation.',1) LIKE 'An appeal of the current decision is open%', 'A12 no new decision while an appeal is open');
  INSERT INTO rr VALUES (stn_decide_appeal('reg1','t1',true,a1,true,'Medical evidence accepted') LIKE 'You made the decision under appeal%', 'A13 the original decider cannot decide the appeal');
  INSERT INTO rr VALUES (stn_decide_appeal('reg2','t1',true,a1,true,'ok') LIKE 'Give the reason%', 'A14 the outcome gives a reason');
  r := stn_decide_appeal('reg2','t1',true,a1,true,'Medical evidence accepted; continue on probation');
  INSERT INTO rr VALUES (r LIKE 'ok:granted:%:hold-1', 'A15 a granted appeal returns the hold to release');
  INSERT INTO rr VALUES ((SELECT decision FROM stn_decisions WHERE tenant_id = 't1' AND student_id = 's1' AND status = 'Recorded') = 'Academic probation'
    AND (SELECT status FROM stn_decisions WHERE id = d1) = 'Superseded' AND (SELECT count(*) FROM stn_decisions WHERE student_id = 's1') = 2, 'A16 granting supersedes the suspension with probation; both kept');
  INSERT INTO rr VALUES (stn_decide_appeal('reg3','t1',true,a1,false,'Deciding it a second time') LIKE 'This appeal was already decided%', 'A17 an appeal is decided once');
  r := stn_record('reg1','t1',true,'s3','Fall 2026','Academic probation','Academic probation','Below 2.0 cumulative','You are on academic probation.',0); d2 := split_part(r,':',2)::bigint;
  UPDATE stn_decisions SET decided_at = now() - interval '15 days' WHERE id = d2;
  INSERT INTO rr VALUES (stn_appeal('s3','t1',d2,'Appealing after the deadline has passed') LIKE 'The 14-day appeal window%', 'A18 the appeal window closes');
  INSERT INTO rr VALUES (stn_appeal('s3','t2',d2,'Appealing from another institution entirely') = 'Decision not found.', 'A19 another institution cannot see it');
  got := false; BEGIN INSERT INTO stn_decisions (tenant_id, student_id, term, version, calculated, decision, rationale, notice, decided_by) VALUES ('t1','s9','Fall 2026',1,'x','Expelled','xxxxxxxxxxxx','xxxxxxxxxxxx','r'); EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'A20 the table refuses an unknown decision');
  got := false; BEGIN DELETE FROM stn_events; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got AND (SELECT count(*) FROM stn_events WHERE tenant_id = 't1') = 4, 'A21 the log is append-only and has every step');
  SELECT string_agg(lbl, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 400)); } };
  await go('real:', STN_MIGRATION);
  await go('mutant decider-may-decide-appeal (A13):', STN_MIGRATION.map((q) => q.replace(`IF d.decided_by = p_actor THEN RETURN 'You made the decision under appeal; another registrar must decide the appeal.'; END IF;`, () => '')));
  // A mutant that does not change the code proves nothing: confirm each one actually applied.
  const applied = (m: string[]) => m.join('') !== STN_MIGRATION.join('');
  console.log('window mutant applied:', applied(STN_MIGRATION.map((q) => q.replace(/IF now\(\) > d\.decided_at[^;]*; END IF;/, () => ''))));
  await go('mutant no-appeal-window (A18):', STN_MIGRATION.map((q) => q.replace(/IF now\(\) > d\.decided_at[^;]*; END IF;/, () => '')));
  await go('mutant suspend-anyone (A3):', STN_MIGRATION.map((q) => q.replace(`IF p_decision = 'Academic suspension' AND p_calculated NOT IN ('Academic probation','Refer to standing committee') THEN`, () => `IF false THEN`)));
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('stn_decisions') AS t`)));
}
