import { neon } from '@neondatabase/serverless';
import { OVR_MIGRATION } from '../src/lib/ovrMigration';

// Registration overrides and advising exceptions (lib/ovrMigration.ts). One rolled-back transaction, synthetic ids: st1 student,
// ad1 advisor, rg1/rg2 registrars. Run on app jeabiv2536: import { run } from './dbchecks/overrides'; await run();
export const CHECKS = `DO $$
DECLARE x text; p bigint; c bigint; l bigint; got boolean; n int;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  x := ovr_request('t1', 'ad1', false, '{"kind":"prerequisite","term":"Spring 2027","sectionId":"s1","reason":"I took the course elsewhere."}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'R1 only students request for themselves');
  x := ovr_request('t1', 'st1', true, '{"kind":"prerequisite","term":"Spring 2027","sectionId":"s1","reason":"I took the prerequisite at my previous college."}'); p := substr(x, 4)::bigint;
  x := ovr_request('t1', 'st1', true, '{"kind":"prerequisite","term":"spring 2027","sectionId":"s1","reason":"Asking again for the same section."}');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'R2 one open request per kind and section');
  x := ovr_request('t1', 'st1', true, '{"kind":"credit_overload","term":"Spring 2027","credits":21,"reason":"I need 21 credits to graduate on time."}'); c := substr(x, 4)::bigint;
  x := ovr_request('t1', 'st1', true, '{"kind":"late_registration","term":"Spring 2027","sectionId":"s2","reason":"My visa arrived after registration closed."}'); l := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (p IS NOT NULL AND c IS NOT NULL AND l IS NOT NULL, 'R3 three requests recorded');

  x := ovr_step('t1', 'ad1', true, false, 'endorse', p, 1, 'Fine with me, took it before.');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'E1 prerequisites go straight to the registrar');
  x := ovr_step('t1', 'rg1', false, true, 'approve', c, 1, 'Approved');
  INSERT INTO rr VALUES (x = 'An advisor must endorse this first.', 'E2 an overload needs an advisor first');
  x := ovr_step('t1', 'ad1', true, false, 'endorse', c, 1, 'short');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'E3 endorsing needs a real note');
  x := ovr_step('t1', 'ad1', true, true, 'endorse', c, 1, 'Strong record; 21 credits is manageable.');
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'E4 advisor endorses the overload');
  x := ovr_step('t1', 'ad1', true, true, 'approve', c, 2, 'Approved as endorsed.');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'D1 the endorser cannot also approve');
  x := ovr_step('t1', 'st1', false, true, 'approve', p, 1, 'Approve my own');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'D2 a student cannot decide their own request');
  x := ovr_step('t1', 'rg1', false, true, 'approve', p, 1, 'Transcript from previous college checked.');
  x := ovr_step('t1', 'rg1', false, true, 'approve', c, 2, 'Approved as endorsed.');
  INSERT INTO rr VALUES ((SELECT count(*) FROM ovr_active('t1', 'st1', 'Spring 2027')) = 2, 'D3 two approvals are active for the term');
  INSERT INTO rr VALUES ((SELECT expires_at BETWEEN now() + interval '29 days' AND now() + interval '31 days' FROM ovr_requests WHERE id = p), 'D4 an approval expires in 30 days');
  got := false; BEGIN UPDATE ovr_requests SET decided_by = endorsed_by WHERE id = c; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'D5 the table refuses an endorser deciding');
  got := false; BEGIN UPDATE ovr_requests SET state = 'approved', decided_by = 'rg2', expires_at = now() + interval '1 day' WHERE id = l; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'D6 the table refuses approving late registration without an endorsement');

  n := ovr_use('t1', 'st1', ARRAY[p]);   -- separate statement: a same-statement read would see the old snapshot
  INSERT INTO rr VALUES (n = 1 AND (SELECT count(*) FROM ovr_active('t1', 'st1', 'Spring 2027')) = 1, 'U1 a used override is no longer active');
  INSERT INTO rr VALUES (ovr_use('t1', 'st1', ARRAY[p]) = 0, 'U2 an override is single use');
  INSERT INTO rr VALUES (ovr_use('t1', 'zz', ARRAY[c]) = 0, 'U3 nobody else can use it');
  UPDATE ovr_requests SET expires_at = now() - interval '1 minute' WHERE id = c;
  n := ovr_use('t1', 'st1', ARRAY[c]);
  INSERT INTO rr VALUES ((SELECT count(*) FROM ovr_active('t1', 'st1', 'Spring 2027')) = 0 AND n = 0, 'U4 an expired approval cannot be used');
  x := ovr_step('t1', 'st1', false, false, 'withdraw', l, 1, '');
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'U5 the student withdraws a pending request');
  got := false; BEGIN DELETE FROM ovr_events; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'U6 history is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run(only?: string) {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...OVR_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 1200)); } };
  const muts: [string, string, string][] = [
    ['endorser approves (D1; table backstop)', `IF p_actor = r.endorsed_by THEN RETURN`, `IF false THEN RETURN`],
    ['overload skips advisor (E2)', `(r.kind <> 'prerequisite' AND r.state = 'endorsed')`, `(r.kind <> 'prerequisite' AND r.state IN ('endorsed', 'requested'))`],
    ['used twice (U2)', `AND state = 'approved' AND expires_at > now();`, `AND state IN ('approved', 'used');`],
  ];
  if (!only || only === 'real') await go('real:', base);
  for (const [label, from, to] of muts) {
    if (only && only !== 'mutants' && !label.startsWith(only)) continue;
    const m = base.map((q) => q.replace(from, () => to));
    console.log(label, 'applied:', m.join('') !== base.join(''));
    await go('mutant ' + label + ':', m);
  }
}
