import { neon } from '@neondatabase/serverless';
import { ADV_MIGRATION } from '../src/lib/advMigration';

// Admissions visits: staff-published slots, capacity-counted bookings, one live booking per
// person (lib/advMigration.ts). One transaction, RESULT raised, everything rolls back.
const CHECKS = `DO $$
DECLARE x text; out text; sid bigint; bid bigint;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  out := adv_set_staff('adm1', 'ta', 'adm1', true);
  INSERT INTO rr VALUES (out LIKE 'Ask another administrator%', 'V1 nobody grants their own admissions access');
  PERFORM adv_set_staff('root', 'ta', 'adm1', true);
  out := adv_create_slot('prof', 'ta', now() + interval '7 days', 'tour', 3, 'Welcome center', '');
  INSERT INTO rr VALUES (out LIKE 'Only admissions staff%', 'V2 only admissions staff publish slots');
  out := adv_create_slot('adm1', 'ta', now() - interval '1 day', 'tour', 3, 'Welcome center', '');
  INSERT INTO rr VALUES (out LIKE '%in the future%', 'V3 slots are published in the future');
  out := adv_create_slot('adm1', 'ta', now() + interval '7 days', 'tour', 3, 'Welcome center', 'Meet at the desk.');
  INSERT INTO rr VALUES (out LIKE 'ok:%', 'V4 admissions publishes a slot');
  sid := split_part(out, ':', 2)::bigint;
  out := adv_book('app1', sid, 2);
  INSERT INTO rr VALUES (out IS NULL, 'V5 an applicant books two seats');
  SELECT id INTO bid FROM adv_bookings WHERE slot_id = sid AND user_id = 'app1' AND state = 'booked';
  out := adv_book('app1', sid, 1);
  INSERT INTO rr VALUES (out LIKE '%already have a booking%', 'V6 one live booking per person per slot');
  out := adv_book('app2', sid, 2);
  INSERT INTO rr VALUES (out LIKE '%full%', 'V7 capacity counts guests across bookings');
  out := adv_book('app2', sid, 1);
  INSERT INTO rr VALUES (out IS NULL, 'V8 the last seat books');
  out := adv_cancel('app2', bid);
  INSERT INTO rr VALUES (out LIKE '%not yours%', 'V9 nobody cancels another person''s booking');
  out := adv_cancel('app1', bid);
  INSERT INTO rr VALUES (out IS NULL, 'V10 the owner cancels');
  out := adv_book('app3', sid, 2);
  INSERT INTO rr VALUES (out IS NULL, 'V11 freed seats can be rebooked');
  out := adv_book('app4', sid, 1);
  INSERT INTO rr VALUES (out LIKE '%full%', 'V12 no seats remain');
  out := adv_close_slot('adm1', 'ta', sid);
  INSERT INTO rr VALUES (out IS NULL, 'V13 admissions closes the slot');
  out := adv_book('app3', sid, 1);
  INSERT INTO rr VALUES (out LIKE '%closed to bookings%', 'V14 a closed slot takes no bookings');
  INSERT INTO rr VALUES ((SELECT count(*) FROM adv_bookings WHERE slot_id = sid AND state = 'booked') = 2, 'V15 two live bookings remain (app2 and app3); the cancelled one does not count');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x, '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', ADV_MIGRATION);
  const m1 = ADV_MIGRATION.map((q) => q.replace("IF s.state <> 'open' THEN", () => 'IF false THEN'));
  console.log('closed mutant applied:', m1.join('') !== ADV_MIGRATION.join(''));
  await go('mutant book-closed-slot (V14):', m1);
  const m2 = ADV_MIGRATION.map((q) => q.replace('IF taken + p_guests > s.capacity THEN', () => 'IF false THEN'));
  console.log('capacity mutant applied:', m2.join('') !== ADV_MIGRATION.join(''));
  await go('mutant no-capacity (V7):', m2);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('adv_slots') AS t`)));
}
