import { neon } from '@neondatabase/serverless';
import { CAR_MIGRATION } from '../src/lib/carMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; rs bigint; iv bigint; ac bigint; f bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO rr VALUES (car_set_staff('adm','t1','adm','coach',true) IS NOT NULL, 'C1 no self-grant');
  PERFORM car_set_staff('adm','t1','co1','coach',true); PERFORM car_set_staff('adm','t1','co2','coach',true); PERFORM car_set_staff('adm','t1','cc1','center',true);
  -- sharing gates coach access
  r := car_resume('s1','t1','Software','Experienced with Python, SQL and data pipelines; led a team project shipping a scheduling tool.'); rs := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (car_comment('co1','t1',rs,'Summary','Lead with impact numbers') LIKE 'The student has not shared%', 'C2 no feedback without a share');
  INSERT INTO rr VALUES (car_share('s1','t1','s2',current_date+30,true) = 'Choose a career coach.', 'C3 share only with coaches');
  INSERT INTO rr VALUES (car_share('s1','t1','co1',current_date+400,true) LIKE 'Choose an end date%', 'C4 share expires within a year');
  PERFORM car_share('s1','t1','co1',current_date+30,true);
  INSERT INTO rr VALUES (car_comment('co1','t1',rs,'Summary','Lead with impact numbers') IS NULL, 'C5 feedback with a share');
  INSERT INTO rr VALUES (car_comment('co2','t1',rs,'Summary','Lead with impact numbers') LIKE 'The student has not shared%', 'C6 share is per coach');
  PERFORM car_share('s1','t1','co1',NULL,false);
  INSERT INTO rr VALUES (car_comment('co1','t1',rs,'Skills','Group by category') LIKE 'The student has not shared%', 'C7 stopping a share ends access');
  UPDATE car_shares SET revoked_at = NULL, expires_on = current_date - 1 WHERE student_id = 's1' AND coach_id = 'co1';
  INSERT INTO rr VALUES (car_comment('co1','t1',rs,'Skills','Group by category') LIKE 'The student has not shared%', 'C8 expired share ends access');
  PERFORM car_share('s1','t1','co1',current_date+30,true);
  r := car_resume('s1','t1','Software','Version two: experienced with Python, SQL, dbt and data pipelines; led a scheduling tool project.');
  INSERT INTO rr VALUES ((SELECT max(version) FROM car_resumes WHERE student_id = 's1') = 2, 'C9 resumes are versioned');
  -- interviews
  INSERT INTO rr VALUES (car_book('s1','t1','s2',now()+interval '1 day','Behavioral') = 'Choose a career coach.', 'C10 book with coaches');
  r := car_book('s1','t1','co1',now()+interval '1 day','Behavioral'); iv := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (car_book('s2','t1','co1',now()+interval '1 day','Case') = 'That coach is already booked at that time.', 'C11 no double booking');
  INSERT INTO rr VALUES (car_interview_step('co1','t1',iv,'score',4,4,4,'Strong STAR answers overall') = 'Record the result after the interview starts.', 'C12 no scoring before start');
  UPDATE car_interviews SET starts_at = now() - interval '1 hour' WHERE id = iv;
  INSERT INTO rr VALUES (car_interview_step('s1','t1',iv,'score',5,5,5,'I did great on this') = 'The coach records the result.', 'C13 coach scores');
  INSERT INTO rr VALUES (car_interview_step('co1','t1',iv,'score',4,NULL,4,'Strong STAR answers overall') LIKE 'Score all three%', 'C14 full rubric');
  INSERT INTO rr VALUES (car_interview_step('co1','t1',iv,'score',4,3,4,'Strong STAR answers overall') IS NULL, 'C15 scored');
  -- follow-up actions
  INSERT INTO rr VALUES (car_assign('co2','t1','s1','Apply to three internships',current_date+7) LIKE 'The student has not shared%', 'C16 actions need a share');
  PERFORM car_assign('co1','t1','s1','Apply to three internships',current_date+7); SELECT id INTO ac FROM car_actions WHERE student_id = 's1';
  INSERT INTO rr VALUES (car_action_step('co1','t1',ac,'confirm','') = 'The student has not marked it done.', 'C17 confirm after done');
  INSERT INTO rr VALUES (car_action_step('co1','t1',ac,'done','') = 'The student marks their own action done.', 'C18 student marks done');
  PERFORM car_action_step('s1','t1',ac,'done','Applied to Acme, Beta, Gamma');
  x := car_action_step('co1','t1',ac,'confirm','');
  INSERT INTO rr VALUES (x IS NULL AND (SELECT state = 'confirmed' FROM car_actions WHERE id = ac), 'C19 coach confirms');
  -- fairs
  INSERT INTO rr VALUES (car_fair('co1','t1','Fall fair',now()+interval '3 days','Gym','Acme, Beta',1) LIKE 'Only career center staff%', 'C20 center runs fairs');
  r := car_fair('cc1','t1','Fall fair',now()+interval '3 days','Gym','Acme, Beta',1); f := split_part(r,':',2)::bigint;
  PERFORM car_fair_reg('s1','t1',f,true);
  INSERT INTO rr VALUES (car_fair_reg('s2','t1',f,true) = 'This fair is full.', 'C21 fair capacity');
  INSERT INTO rr VALUES (car_checkin('cc1','t1',f,'s2') = 'That student is not registered.', 'C22 check-in needs registration');
  INSERT INTO rr VALUES (car_checkin('cc1','t1',f,'s1') IS NULL, 'C23 checked in');
  -- outcomes
  PERFORM car_outcome('s1','t1','2026','employed','Acme');
  INSERT INTO rr VALUES (car_verify('co1','t1','s1','2026') LIKE 'Only career center staff%', 'C24 center verifies');
  INSERT INTO rr VALUES (car_verify('cc1','t1','s1','2026') IS NULL, 'C25 verified');
  PERFORM car_outcome('s1','t1','2026','grad_school','');
  INSERT INTO rr VALUES ((SELECT verified_by IS NULL FROM car_outcomes WHERE student_id = 's1'), 'C26 changing an outcome clears verification');
  PERFORM car_outcome('a1','t1','2026','employed',''); PERFORM car_outcome('a2','t1','2026','employed',''); PERFORM car_outcome('a3','t1','2026','employed','');
  PERFORM car_outcome('a4','t1','2026','employed',''); PERFORM car_outcome('a5','t1','2026','employed','');
  INSERT INTO rr VALUES ((SELECT n FROM car_outcome_report('t1','2026') WHERE kind = 'employed') = 5 AND (SELECT n FROM car_outcome_report('t1','2026') WHERE kind = 'grad_school') IS NULL, 'C27 small groups suppressed');
  -- table guards
  got := false; BEGIN UPDATE car_resumes SET body = body || ' edited' WHERE id = rs; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'C28 resume versions immutable');
  got := false; BEGIN UPDATE car_fair_regs SET checked_in_by = student_id WHERE fair_id = f; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'C29 table refuses self check-in');
  SELECT string_agg(lbl, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...CAR_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('car_plans') AS t`)));
}
