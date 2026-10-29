import { neon } from '@neondatabase/serverless';
import { GAS_MIGRATION } from '../src/lib/gasMigration';

// Graduate assistantships (lib/gasMigration.ts). One rolled-back transaction, synthetic ids: fa1 poster, gs1/gs2 graduate
// students, go1 graduate-office officer, adm administrator. Run on app jeabiv2536: import { run } from './dbchecks/assistantships'; await run();
const P = (title: string, hours: number) => `'{"kind":"teaching","title":"${title}","unit":"Biology","term":"Spring 2027","hours":${hours},"stipendMinor":900000,"tuitionRemission":true,"duties":"Lead two lab sections and hold office hours weekly.","openings":1}'`;
const ST = `'I taught intro labs as an undergraduate and enjoy it.'`;
export const CHECKS = `DO $$
DECLARE x text; p1 bigint; p2 bigint; a1 bigint; a2 bigint; a3 bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  x := gas_set_officer('t1', 'adm', true, 'go1', true); x := gas_set_officer('t1', 'adm', true, 'fa1', true);   -- fa1 is also an officer: separation is what stops it
  x := gas_post('t1', 'gs1', false, ${P('Biology lab TA', 15)});
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'A1 students do not post assistantships');
  x := gas_post('t1', 'fa1', true, ${P('Biology lab TA', 25)});
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'A2 at most 20 hours a week');
  x := gas_post('t1', 'fa1', true, ${P('Biology lab TA', 15)}); p1 := substr(x, 4)::bigint;
  x := gas_post('t1', 'fa1', true, ${P('Genetics grader', 10)}); p2 := substr(x, 4)::bigint;
  x := gas_apply('t1', 'gs1', false, p1, ${ST});
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'A3 only graduate students apply');
  x := gas_apply('t1', 'gs1', true, p1, ${ST}); a1 := substr(x, 4)::bigint;
  x := gas_apply('t1', 'gs2', true, p1, ${ST}); a2 := substr(x, 4)::bigint;
  x := gas_apply('t1', 'gs1', true, p2, ${ST}); a3 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (a1 IS NOT NULL AND a2 IS NOT NULL AND a3 IS NOT NULL, 'A4 applications recorded');

  x := gas_step('t1', 'gs1', 'offer', a1, 1, '');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'O1 only the poster makes offers');
  x := gas_step('t1', 'fa1', 'offer', a1, 1, '');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT offer->>'hours' = '15' AND offer_hash = md5(offer::text) FROM gas_applications WHERE id = a1), 'O2 the offer copies the posting terms');
  x := gas_step('t1', 'fa1', 'offer', a2, 1, '');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'O3 no more offers than openings');
  got := false; BEGIN UPDATE gas_applications SET offer = jsonb_set(offer, '{stipendMinor}', '1') , offer_hash = md5(jsonb_set(offer, '{stipendMinor}', '1')::text) WHERE id = a1; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'O4 an offer cannot be rewritten');
  x := gas_step('t1', 'gs1', 'accept', a1, 2, '');
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'O5 student accepts 15 hours');
  x := gas_step('t1', 'fa1', 'offer', a3, 1, '');
  x := gas_step('t1', 'gs1', 'accept', a3, 2, '');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%' AND gas_hours('t1', 'gs1', 'spring 2027') = 15, 'O6 accepting 10 more hours (25) is refused ' || x);

  x := gas_step('t1', 'fa1', 'confirm', a1, 3, '');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'C1 the hiring person cannot confirm, even as an officer');
  x := gas_step('t1', 'go1', 'confirm', a1, 3, '');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM gas_applications WHERE id = a1) = 'confirmed', 'C2 the graduate office confirms');
  x := gas_step('t1', 'go1', 'end', a1, 4, 'short');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'C3 ending early needs a reason');
  x := gas_step('t1', 'go1', 'end', a1, 4, 'Student left the program mid-term.');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND gas_hours('t1', 'gs1', 'Spring 2027') = 0, 'C4 an ended appointment frees the hours');
  x := gas_close('t1', 'fa1', p1);
  INSERT INTO rr VALUES ((SELECT state FROM gas_applications WHERE id = a2) = 'not_selected', 'C5 closing a posting answers waiting applicants');
  got := false; BEGIN INSERT INTO gas_officers (tenant_id, user_id, granted_by) VALUES ('t1', 'zz', 'zz'); EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'C6 nobody appoints themselves');
  got := false; BEGIN DELETE FROM gas_events; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'C7 history is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run(only?: string) {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...GAS_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 1200)); } };
  const muts: [string, string, string][] = [
    ['hours cap ignored (O6)', `IF p_step = 'accept' AND gas_hours(p_tenant, a.student_id, o.term) + (a.offer->>'hours')::numeric > 20 THEN`, `IF false THEN`],
    ['poster confirms (C1)', `IF p_actor IN (a.student_id, o.poster_id) THEN RETURN`, `IF false THEN RETURN`],
    ['openings ignored (O3)', `>= o.openings THEN RETURN`, `>= 999 THEN RETURN`],
  ];
  if (!only || only === 'real') await go('real:', base);
  for (const [label, from, to] of muts) {
    if (only && only !== 'mutants' && !label.startsWith(only)) continue;
    const m = base.map((q) => q.replace(from, () => to));
    console.log(label, 'applied:', m.join('') !== base.join(''));
    await go('mutant ' + label + ':', m);
  }
}
