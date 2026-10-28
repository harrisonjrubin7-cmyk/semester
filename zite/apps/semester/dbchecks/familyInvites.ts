import { neon } from '@neondatabase/serverless';
import { FAM_MIGRATION } from '../src/lib/famMigration';

const TODAY = `'2026-10-28'::date`;
export const CHECKS = `DO $$
DECLARE r text; v bigint; v2 bigint; got boolean; n int;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO rr VALUES (fam_invite('stu','stu@x.edu','STU@x.edu',ARRAY['Grades'],'2027-01-01',${TODAY},NULL) = 'You can’t share with yourself.', 'F1 no sharing with yourself');
  INSERT INTO rr VALUES (fam_invite('stu','stu@x.edu','mom@x.edu',ARRAY['Grades'],'2026-10-28',${TODAY},NULL) = 'Choose an end date in the future.', 'F2 the end date must be in the future');
  INSERT INTO rr VALUES (fam_invite('stu','stu@x.edu','mom@x.edu',ARRAY['Grades'],'2028-01-01',${TODAY},NULL) LIKE 'Sharing can last at most a year%', 'F3 at most a year');
  INSERT INTO rr VALUES (fam_invite('stu','stu@x.edu','mom@x.edu',ARRAY['Transcript'],'2027-01-01',${TODAY},NULL) LIKE 'Choose at least one thing%', 'F4 only the four categories');
  r := fam_invite('stu','stu@x.edu',' Mom@X.edu ',ARRAY['Holds','Grades','Grades'],'2027-01-01',${TODAY},'c1');
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'F5 invitation created ' || coalesce(r,'')); v := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES ((SELECT recipient_email = 'mom@x.edu' AND categories = ARRAY['Grades','Holds'] FROM fam_invites WHERE id = v), 'F6 email normalised, categories deduplicated');
  INSERT INTO rr VALUES (NOT EXISTS (SELECT 1 FROM fam_live('mom',${TODAY})), 'F7 nothing is visible before acceptance');
  INSERT INTO rr VALUES (fam_invite('stu','stu@x.edu','mom@x.edu',ARRAY['Billing'],'2027-01-01',${TODAY},NULL) LIKE 'You already share with this person%', 'F8 one active invitation per person');
  INSERT INTO rr VALUES (fam_respond('stranger','stranger@x.edu',v,true,${TODAY}) = 'Invitation not found.', 'F9 another account cannot accept');
  INSERT INTO rr VALUES (fam_respond('stu','mom@x.edu',v,true,${TODAY}) = 'Invitation not found.', 'F10 the student cannot accept their own invitation');
  INSERT INTO rr VALUES (fam_respond('mom','mom@x.edu',v,true,'2027-02-01') LIKE 'This invitation has expired%', 'F11 an expired invitation cannot be accepted');
  INSERT INTO rr VALUES (fam_respond('mom','MOM@x.edu',v,true,${TODAY}) = 'ok', 'F12 the invited account accepts');
  INSERT INTO rr VALUES ((SELECT count(*) FROM fam_live('mom',${TODAY}) WHERE student_id = 'stu' AND categories = ARRAY['Grades','Holds']) = 1, 'F13 accepted sharing is visible with exactly the chosen categories');
  INSERT INTO rr VALUES (NOT EXISTS (SELECT 1 FROM fam_live('mom','2027-01-02')), 'F14 nothing is visible after the end date');
  INSERT INTO rr VALUES (fam_respond('mom','mom@x.edu',v,false,${TODAY}) LIKE 'This invitation was already answered%', 'F15 cannot answer twice');
  INSERT INTO rr VALUES (fam_end('stranger',v) = 'Sharing not found.', 'F16 a stranger cannot end it');
  r := fam_end('stu',v);
  INSERT INTO rr VALUES (r = 'ok' AND NOT EXISTS (SELECT 1 FROM fam_live('mom',${TODAY})), 'F17 the student revokes and access stops');
  INSERT INTO rr VALUES ((SELECT count(*) FROM fam_invites WHERE id = v) = 1, 'F18 revocation keeps the record');
  v2 := split_part(fam_invite('stu','stu@x.edu','mom@x.edu',ARRAY['Calendar'],'2027-01-01',${TODAY},NULL),':',2)::bigint;
  INSERT INTO rr VALUES (v2 IS NOT NULL AND v2 <> v, 'F19 after revoking, the student can share again');
  PERFORM fam_respond('mom','mom@x.edu',v2,true,${TODAY});
  r := fam_end('mom',v2);
  INSERT INTO rr VALUES (r = 'ok' AND (SELECT state FROM fam_invites WHERE id = v2) = 'Left', 'F20 the family member can stop seeing it');
  INSERT INTO rr VALUES ((SELECT string_agg(action, ',' ORDER BY id) FROM fam_events WHERE invite_id = v) = 'invited,accepted,revoked', 'F21 every step logged');
  got := false; BEGIN DELETE FROM fam_events WHERE invite_id = v; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F22 the log is append-only');
  got := false; BEGIN UPDATE fam_invites SET recipient_id = NULL WHERE id = v2; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F23 an accepted or left share always names its account (constraint)');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', FAM_MIGRATION);
  const m1 = FAM_MIGRATION.map((q) => q.replace(`IF NOT FOUND OR r.recipient_email <> lower(coalesce(p_actor_email,'')) OR r.student_id = p_actor THEN`, () => `IF NOT FOUND THEN`));
  console.log('email mutant applied:', m1.join('') !== FAM_MIGRATION.join(''));
  await go('mutant anyone-accepts (F9, F10):', m1);
  const m2 = FAM_MIGRATION.map((q) => q.replace(`WHERE recipient_id = p_recipient AND state = 'Accepted' AND expires_on >= p_today`, () => `WHERE recipient_id = p_recipient AND state = 'Accepted'`));
  console.log('expiry mutant applied:', m2.join('') !== FAM_MIGRATION.join(''));
  await go('mutant expiry-ignored (F14):', m2);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('fam_invites') AS t`)));
}
