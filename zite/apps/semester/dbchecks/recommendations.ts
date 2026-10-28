import { neon } from '@neondatabase/serverless';
import { RCM_MIGRATION } from '../src/lib/rcmMigration';

const F = `'00000000-0000-0000-0000-0000000000a1'::uuid`;
export const CHECKS = `DO $$
DECLARE r text; rid bigint; r2 bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO rr VALUES (rcm_request('other','appl','app1','t1','rec@x.edu','Dr Rec',true,'appl@x.edu') = 'That application isn’t yours.', 'R1 only the applicant asks');
  INSERT INTO rr VALUES (rcm_request('appl','appl','app1','t1','APPL@x.edu','Me',true,'appl@x.edu') = 'You cannot recommend yourself.', 'R2 no self-recommendation by email');
  INSERT INTO rr VALUES (rcm_request('appl','appl','app1','t1','not-an-email','Dr Rec',true,'appl@x.edu') = 'Enter a valid email address.', 'R3 invalid email refused');
  r := rcm_request('appl','appl','app1','t1',' Rec@X.edu ','Dr Rec',true,'appl@x.edu');
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'R4 request created ' || coalesce(r,''));
  IF r NOT LIKE 'ok:%' THEN RAISE EXCEPTION 'RESULT pass=0 fails=1 [R4 got %]', r; END IF;
  rid := split_part(r, ':', 2)::bigint;
  INSERT INTO rr VALUES ((SELECT recommender_email FROM rcm_requests WHERE id = rid) = 'rec@x.edu', 'R5 email stored normalised');
  INSERT INTO rr VALUES (rcm_request('appl','appl','app1','t1','rec@x.edu','Dr Rec',true,'appl@x.edu') = 'You already asked this person.', 'R6 duplicate open request refused');
  INSERT INTO rr VALUES (rcm_respond('stranger','stranger@x.edu',rid,true) = 'Request not found.', 'R7 another account cannot accept');
  INSERT INTO rr VALUES (rcm_submit('rec',rid,${F},'rec') = 'Request not found.', 'R8 no letter before the recommender is bound');
  INSERT INTO rr VALUES (rcm_respond('rec','rec@x.edu',rid,true) = 'ok', 'R9 the verified recommender accepts');
  INSERT INTO rr VALUES ((SELECT recommender_id FROM rcm_requests WHERE id = rid) = 'rec', 'R10 acceptance binds the account');
  INSERT INTO rr VALUES (rcm_respond('rec','rec@x.edu',rid,false) LIKE 'This request was already answered%', 'R11 cannot answer twice');
  INSERT INTO rr VALUES (rcm_submit('other',rid,${F},'other') = 'Request not found.', 'R12 only the bound recommender submits');
  INSERT INTO rr VALUES (rcm_submit('rec',rid,${F},'appl') = 'Upload the letter yourself.', 'R13 a file owned by someone else is refused');
  INSERT INTO rr VALUES (rcm_submit('rec',rid,${F},'rec') = 'ok', 'R14 the recommender submits a letter');
  INSERT INTO rr VALUES (rcm_submit('rec',rid,${F},'rec') = 'This letter was already submitted.', 'R15 one letter per request');
  INSERT INTO rr VALUES (rcm_withdraw('appl',rid) LIKE 'Only an unanswered%', 'R16 a submitted letter cannot be withdrawn');
  got := false; BEGIN UPDATE rcm_requests SET state = 'Submitted', letter_file = NULL WHERE id = rid; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'R17 Submitted requires a letter (constraint)');
  r2 := split_part(rcm_request('appl','appl','app1','t1','b@x.edu','Bo',false,'appl@x.edu'), ':', 2)::bigint;
  INSERT INTO rr VALUES (rcm_withdraw('other',r2) = 'Request not found.' AND rcm_withdraw('appl',r2) = 'ok', 'R18 only the applicant withdraws');
  INSERT INTO rr VALUES (rcm_respond('b','b@x.edu',r2,true) LIKE 'This request was already answered%', 'R19 a withdrawn request cannot be accepted');
  PERFORM rcm_request('appl','appl','app1','t1','c'||g||'@x.edu','Cy',true,'appl@x.edu') FROM generate_series(1,5) g;
  INSERT INTO rr VALUES ((SELECT count(*) FROM rcm_requests WHERE application_id='app1' AND state IN ('Requested','Accepted','Submitted')) = 5, 'R20 at most five open recommenders');
  INSERT INTO rr VALUES ((SELECT string_agg(action, ',' ORDER BY id) FROM rcm_events WHERE request_id = rid) = 'requested,accepted,submitted', 'R21 every step logged');
  got := false; BEGIN DELETE FROM rcm_events WHERE request_id = rid; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'R22 the log is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', RCM_MIGRATION);
  const m1 = RCM_MIGRATION.map((q) => q.replace(`IF NOT FOUND OR r.recommender_email <> lower(coalesce(p_actor_email,'')) THEN RETURN`, () => `IF NOT FOUND THEN RETURN`));
  console.log('email mutant applied:', m1.join('') !== RCM_MIGRATION.join(''));
  await go('mutant anyone-accepts (R7):', m1);
  const m2 = RCM_MIGRATION.map((q) => q.replace(`IF p_file_owner IS DISTINCT FROM p_actor THEN RETURN`, () => `IF false THEN RETURN`));
  console.log('owner mutant applied:', m2.join('') !== RCM_MIGRATION.join(''));
  await go('mutant foreign-file (R13):', m2);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('rcm_requests') AS t`)));
}
