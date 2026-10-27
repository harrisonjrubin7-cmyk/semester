import { neon } from '@neondatabase/serverless';
import { TUT_MIGRATION } from '../src/lib/tutMigration';
import { SUP_MIGRATION } from '../src/lib/supMigration';

// Tutoring requests are seeded directly as completed (the tutoring flow itself is covered by its own check).
export const CHECKS = `DO $$
DECLARE r text; x text; m bigint; g bigint; e bigint; q bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  -- peer mentoring
  INSERT INTO rr VALUES (pmn_set_sup('adm','t1','adm',true) IS NOT NULL, 'S1 no self-grant');
  PERFORM pmn_set_sup('adm','t1','sv1',true); PERFORM pmn_set_sup('adm','t1','sv2',true);
  PERFORM pmn_join('mt1','t1','mentor','STEM',true); PERFORM pmn_join('sv2','t1','mentor','',true);
  INSERT INTO rr VALUES (pmn_match('sv1','t1','mt1','me1') = 'Choose an approved mentor.', 'S2 mentors must be approved');
  INSERT INTO rr VALUES (pmn_approve('sv2','t1','sv2') = 'Another supervisor approves you.', 'S3 no self-approval');
  PERFORM pmn_approve('sv1','t1','mt1');
  INSERT INTO rr VALUES (pmn_match('sv1','t1','mt1','me1') = 'The mentee has not opted in.', 'S4 mentee opt-in required');
  PERFORM pmn_join('me1','t1','mentee','First-gen, CS',true); PERFORM pmn_join('me2','t1','mentee','',true);
  PERFORM pmn_approve('sv1','t1','sv2');
  INSERT INTO rr VALUES (pmn_match('sv2','t1','sv2','me2') LIKE 'Another supervisor makes a match%', 'S5 supervisor cannot match themselves');
  r := pmn_match('sv1','t1','mt1','me1'); m := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (pmn_match('sv2','t1','mt1','me1') = 'That mentee already has an active mentor.', 'S6 one active mentor');
  INSERT INTO rr VALUES (pmn_checkin('me1','t1',m,'good','') = 'Log check-ins on your own active matches.', 'S7 mentor logs check-ins');
  INSERT INTO rr VALUES (pmn_checkin('mt1','t1',m,'struggling','Midterm stress') IS NULL, 'S8 check-in logged');
  INSERT INTO rr VALUES (pmn_goal('mt1','t1',m,NULL,'Join a study group',NULL,NULL) = 'Goals belong to the mentee.', 'S9 mentee owns goals');
  PERFORM pmn_goal('me1','t1',m,NULL,'Join a study group',NULL,NULL); SELECT id INTO g FROM pmn_goals WHERE match_id = m;
  INSERT INTO rr VALUES (pmn_goal('mt1','t1',m,g,NULL,'met',NULL) = 'The mentee closes their own goals.', 'S10 mentee closes goals');
  INSERT INTO rr VALUES (pmn_goal('mt1','t1',m,g,NULL,NULL,'Found two groups to try') IS NULL, 'S11 mentor records progress');
  r := pmn_escalate('mt1','t1',m,'wellbeing','Mentee mentioned feeling isolated; suggested counseling'); e := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (pmn_resolve('mt1','t1',e,'Handled it myself') = 'Only mentoring supervisors resolve escalations.', 'S12 supervisors resolve');
  INSERT INTO rr VALUES (pmn_resolve('sv1','t1',e,'Met with mentee; referred to counseling') IS NULL, 'S13 resolved');
  INSERT INTO rr VALUES (pmn_end('x9','t1',m) LIKE 'Only the pair%', 'S14 outsiders cannot end a match');
  INSERT INTO rr VALUES (pmn_end('me1','t1',m) IS NULL, 'S15 mentee ends match');
  -- TA escalation
  INSERT INTO rr VALUES (tae_ask('st1','t1','sec1',false,'grading','Is partial credit allowed on Q3?') LIKE 'Only a teaching assistant%', 'S16 delegates only');
  r := tae_ask('ta1','t1','sec1',true,'grading','Is partial credit allowed on Q3?'); q := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (tae_answer('ta1','t1',q,false,'Yes') = 'Only an instructor of the section answers.', 'S17 instructors answer');
  INSERT INTO rr VALUES (tae_answer('in1','t1',q,true,'Yes, half credit for setup') IS NULL, 'S18 answered');
  -- tutoring quality
  INSERT INTO tut_staff (tenant_id, user_id, granted_by) VALUES ('t1','lc1','adm'), ('t1','tu9','adm');
  INSERT INTO tut_requests (id, tenant_id, student_id, subject, goal, state, tutor_id) VALUES
    ('rq1','t1','s1','Calc','Understand related rates problems','completed','tu1'), ('rq2','t1','s2','Calc','Understand related rates problems','completed','tu1'),
    ('rq3','t1','s3','Calc','Understand related rates problems','completed','tu1'), ('rq4','t1','s4','Calc','Understand related rates problems','scheduled','tu1');
  INSERT INTO rr VALUES (tqr_rate('s2','t1','rq1',5,'') = 'Rate your own tutoring sessions.', 'S19 own sessions only');
  INSERT INTO rr VALUES (tqr_rate('s4','t1','rq4',5,'') = 'Rate a session after it is completed.', 'S20 completed only');
  PERFORM tqr_rate('s1','t1','rq1',5,'Clear'); PERFORM tqr_rate('s2','t1','rq2',4,'');
  INSERT INTO rr VALUES (tqr_rate('s1','t1','rq1',1,'') = 'You already rated this session.', 'S21 one rating per session');
  INSERT INTO rr VALUES ((SELECT avg_score IS NULL FROM tqr_summary('t1') WHERE tutor_id = 'tu1'), 'S22 no average under three');
  PERFORM tqr_rate('s3','t1','rq3',3,'');
  INSERT INTO rr VALUES ((SELECT avg_score = 4.00 FROM tqr_summary('t1') WHERE tutor_id = 'tu1'), 'S23 average at three');
  INSERT INTO rr VALUES (tqr_review('tu9','t1','tu9','Self review of my own sessions','no_action') = 'Someone else reviews your own tutoring.', 'S24 no self-review');
  INSERT INTO rr VALUES (tqr_review('lc1','t1','tu1','Strong ratings; observe one session for coaching','observe') IS NULL, 'S25 review recorded');
  -- table guards
  got := false; BEGIN UPDATE pmn_people SET approved_by = user_id WHERE user_id = 'mt1'; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'S26 table refuses self-approval');
  got := false; BEGIN DELETE FROM pmn_checkins; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'S27 check-ins append-only');
  SELECT string_agg(lbl, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...TUT_MIGRATION.map((q) => sql.query(q)), ...SUP_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('pmn_matches') AS t`)));
}
