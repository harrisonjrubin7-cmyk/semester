import { neon } from '@neondatabase/serverless';
import { CAR_MIGRATION } from '../src/lib/carMigration';
import { ALU_MIGRATION } from '../src/lib/aluMigration';

// Alumni network (lib/aluMigration.ts). One rolled-back transaction, synthetic ids: al1/al2/al3 alumni, st1/st2 students,
// cc1 career center staff (who is also an alumnus, to test review separation).
// Run on app jeabiv2536: import { run } from './dbchecks/alumni'; await run();
export const CHECKS = `DO $$
DECLARE x text; c1 bigint; c2 bigint; o1 bigint; o2 bigint; got boolean; i int;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO car_staff (tenant_id, user_id, role, granted_by) VALUES ('t1', 'cc1', 'center', 'adm');

  -- Directory
  x := alu_profile('t1', 'st1', false, '{"headline":"Second-year student","listed":true}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'L1 only alumni have a directory profile');
  x := alu_profile('t1', 'al1', true, '{"headline":"Data analyst at a hospital","field":"Health data","gradYear":2019,"listed":true,"audience":"alumni_and_students","openToMentor":true}');
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'L2 alumnus lists a profile ' || x);
  x := alu_profile('t1', 'al2', true, '{"headline":"Policy researcher","listed":true,"audience":"alumni"}');
  x := alu_profile('t1', 'al3', true, '{"headline":"Not listed yet","listed":false}');
  INSERT INTO rr VALUES (alu_visible('t1', 'st1', false, true, 'al1') AND NOT alu_visible('t1', 'st1', false, true, 'al2'), 'L3 students see only profiles shown to students');
  INSERT INTO rr VALUES (alu_visible('t1', 'al1', true, false, 'al2') AND NOT alu_visible('t1', 'al1', true, false, 'al3'), 'L4 unlisted profiles are hidden even from alumni');
  INSERT INTO rr VALUES (NOT alu_visible('t2', 'zz', true, false, 'al1'), 'L5 another institution cannot see the profile');
  x := alu_profile('t1', 'al1', true, '{"headline":"Data analyst at a hospital","listed":true,"audience":"alumni_and_students","version":7}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'L6 a stale profile edit is refused');

  -- Connections
  x := alu_connect('t1', 'st1', false, true, 'al2', 'Hello');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'N1 a student cannot request an alumni-only profile');
  x := alu_connect('t1', 'st1', false, true, 'al1', 'I would like advice on health data careers.');
  c1 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'N2 student requests a connection ' || x);
  x := alu_connect('t1', 'al1', true, false, 'st1', 'Reverse');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'N3 no duplicate request in either direction');
  x := alu_respond('t1', 'st1', c1, 'accept');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'N4 the requester cannot accept their own request');
  x := alu_respond('t1', 'al1', c1, 'accept');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM alu_connections WHERE id = c1) = 'accepted', 'N5 the recipient accepts');
  x := alu_connect('t1', 'st2', false, true, 'al1', 'Hi');
  c2 := substr(x, 4)::bigint;
  x := alu_respond('t1', 'al1', c2, 'block');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND NOT alu_visible('t1', 'st2', false, true, 'al1'), 'N6 a block hides the profile from the blocked person');
  x := alu_connect('t1', 'st2', false, true, 'al1', 'Again');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'N7 a blocked person cannot request again');
  FOR i IN 1..20 LOOP
    PERFORM alu_profile('t1', 'zz_a' || i, true, '{"headline":"Listed alumnus","listed":true}');
    PERFORM alu_connect('t1', 'al2', true, false, 'zz_a' || i, '');
  END LOOP;
  x := alu_profile('t1', 'zz_a21', true, '{"headline":"Listed alumnus","listed":true}');
  x := alu_connect('t1', 'al2', true, false, 'zz_a21', '');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'N8 at most 20 requests waiting at once');
  got := false; BEGIN INSERT INTO alu_connections (tenant_id, from_id, to_id) VALUES ('t1', 'al1', 'st1'); EXCEPTION WHEN unique_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'N9 the table refuses a second open connection for a pair');

  -- Opportunities
  x := alu_post('t1', 'st1', false, '{"kind":"job","title":"Analyst role","org":"Hospital","body":"An entry-level analyst role on the data team.","audience":"students"}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'O1 only alumni post opportunities');
  x := alu_post('t1', 'al1', true, jsonb_build_object('kind', 'internship', 'title', 'Summer data internship', 'org', 'City Hospital', 'body', 'Ten-week paid internship on the analytics team.',
    'url', 'http://example.test/apply', 'audience', 'students', 'expiresAt', (now() + interval '30 days')::text));
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'O2 links must be https');
  x := alu_post('t1', 'al1', true, jsonb_build_object('kind', 'internship', 'title', 'Summer data internship', 'org', 'City Hospital', 'body', 'Ten-week paid internship on the analytics team.',
    'url', 'https://example.test/apply', 'audience', 'students', 'expiresAt', (now() + interval '200 days')::text));
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'O3 an opportunity ends within 90 days');
  x := alu_post('t1', 'al1', true, jsonb_build_object('kind', 'internship', 'title', 'Summer data internship', 'org', 'City Hospital', 'body', 'Ten-week paid internship on the analytics team.',
    'url', 'https://example.test/apply', 'audience', 'students', 'expiresAt', (now() + interval '30 days')::text));
  o1 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM alu_opportunities WHERE id = o1) = 'pending', 'O4 posted opportunities wait for review');
  x := alu_interest_set('t1', 'st1', false, true, o1, true, true);
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'O5 nobody can show interest before approval');
  x := alu_review('t1', 'al2', o1, 'approve', '');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'O6 review needs career center staff');
  x := alu_post('t1', 'cc1', true, jsonb_build_object('kind', 'event', 'title', 'Alumni panel night', 'org', 'Career Center', 'body', 'Panel of alumni talking about first jobs.',
    'audience', 'both', 'expiresAt', (now() + interval '10 days')::text));
  o2 := substr(x, 4)::bigint;
  x := alu_review('t1', 'cc1', o2, 'approve', '');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'O7 staff cannot approve their own posting');
  got := false; BEGIN UPDATE alu_opportunities SET state = 'live', reviewed_by = poster_id WHERE id = o2; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'O8 the table refuses self-review');
  x := alu_review('t1', 'cc1', o1, 'reject', 'no');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'O9 a rejection needs a reason');
  x := alu_review('t1', 'cc1', o1, 'approve', '');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM alu_opportunities WHERE id = o1) = 'live', 'O10 other staff approve');
  x := alu_interest_set('t1', 'al2', true, false, o1, true, true);
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'O11 a students-only posting is not open to alumni');
  x := alu_interest_set('t1', 'st1', false, true, o1, true, true);
  x := alu_interest_set('t1', 'st2', false, true, o1, true, false);
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'O12a someone the poster blocked cannot show interest');
  x := alu_interest_set('t1', 'st3', false, true, o1, true, false);
  INSERT INTO rr VALUES ((SELECT count(*) FROM alu_interest WHERE opportunity_id = o1) = 2 AND (SELECT count(*) FROM alu_interest WHERE opportunity_id = o1 AND share_name) = 1,
    'O12 interest is counted; only one person chose to share their name');
  UPDATE alu_opportunities SET expires_at = now() - interval '1 minute' WHERE id = o1;
  x := alu_interest_set('t1', 'st1', false, true, o1, true, true);
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'O13 an expired posting takes no interest');

  got := false; BEGIN DELETE FROM alu_events; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'M7 history is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run(only?: string) {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...CAR_MIGRATION, ...ALU_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 1200)); } };
  const muts: [string, string, string][] = [
    ['students see alumni-only profiles (L3)', `OR (p_student AND f.audience = 'alumni_and_students')`, `OR p_student`],
    ['blocks ignored (N6, N7)', `AND (p_viewer = p_target OR NOT alu_blocked(p_tenant, p_viewer, p_target))`, ``],
    ['interest before approval (O5)', `SELECT o.state = 'live' AND o.expires_at > now()`, `SELECT o.state IN ('live', 'pending') AND o.expires_at > now()`],
    ['self-review (O7; table backstop O8)', `IF o.poster_id = p_actor THEN RETURN 'You posted this`, `IF false THEN RETURN 'You posted this`],
  ];
  if (!only || only === 'real') await go('real:', base);
  for (const [label, from, to] of muts) {
    if (only && only !== 'mutants' && !label.startsWith(only)) continue;
    const m = base.map((q) => q.replace(from, () => to));
    console.log(label, 'applied:', m.join('') !== base.join(''));
    await go('mutant ' + label + ':', m);
  }
}
