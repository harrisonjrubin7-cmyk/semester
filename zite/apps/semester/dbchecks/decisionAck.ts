import { neon } from '@neondatabase/serverless';
import { ADM_MIGRATION } from '../src/lib/admMigration';
import { DAK_MIGRATION } from '../src/lib/dakMigration';

// Decision acknowledgment (lib/dakMigration.ts). One rolled-back transaction, synthetic ids: ap1 applicant, ap2 another
// applicant, rv1 reviewer. Run on app jeabiv2536: import { run } from './dbchecks/decisionAck'; await run();
export const CHECKS = `DO $$
DECLARE x text; h text; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO adm_reviews (application_id, tenant_id, applicant_id, reviewer_id, assigned_by, decision, applicant_message, drafted_by, state, released_by, released_at)
    VALUES ('app1', 'tt1', 'ap1', 'rv1', 'ad1', 'Admitted', 'Welcome. Your offer is conditional on a final transcript.', 'rv1', 'Released', 'ad1', now()),
           ('app2', 'tt1', 'ap2', 'rv1', 'ad1', 'Declined', 'Thank you for applying.', 'rv1', 'Drafted', NULL, NULL);
  h := dak_fingerprint('Admitted', 'Welcome. Your offer is conditional on a final transcript.');
  x := dak_ack('tt1', 'ap2', 'app1', h);
  INSERT INTO rr VALUES (x = 'This is not your decision.', 'K1 only the applicant acknowledges');
  x := dak_ack('tt1', 'ap2', 'app2', dak_fingerprint('Declined', 'Thank you for applying.'));
  INSERT INTO rr VALUES (x = 'This decision has not been released.', 'K2 nothing before release');
  x := dak_ack('ttX', 'ap1', 'app1', h);
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'K3 not from another institution');
  x := dak_ack('tt1', 'ap1', 'app1', dak_fingerprint('Admitted', 'Welcome.'));
  INSERT INTO rr VALUES (x LIKE 'The decision you are looking at is out of date%', 'K4 a stale or altered screen cannot be acknowledged');
  x := dak_ack('tt1', 'ap1', 'app1', h);
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT seen_hash = h AND decision = 'Admitted' FROM dak_acks WHERE application_id = 'app1'), 'K5 the applicant acknowledges what they saw');
  x := dak_ack('tt1', 'ap1', 'app1', h);
  INSERT INTO rr VALUES (x = 'You already acknowledged this decision.', 'K6 once');
  INSERT INTO rr VALUES ((SELECT count(*) FROM adm_events WHERE application_id = 'app1' AND action = 'acknowledged') = 1, 'K7 recorded in the admissions log');
  got := false; BEGIN UPDATE dak_acks SET seen_hash = repeat('0', 32); EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'K8 acknowledgments are append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run(only?: string) {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const pre = [...ADM_MIGRATION];
  const base = [...DAK_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...[...pre, ...mig].map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 1200)); } };
  const muts: [string, string, string][] = [
    ['anyone acknowledges (K1)', `IF NOT FOUND OR r.applicant_id <> p_actor THEN`, `IF NOT FOUND THEN`],
    ['before release (K2)', `IF r.state <> 'Released' THEN RETURN`, `IF false THEN RETURN`],
    ['stale screen (K4)', `IF p_seen IS DISTINCT FROM dak_fingerprint(r.decision, r.applicant_message) THEN`, `IF false THEN`],
  ];
  if (!only || only === 'real') await go('real:', base);
  for (const [label, from, to] of muts) {
    if (only && only !== 'mutants' && !label.startsWith(only)) continue;
    const m = base.map((q) => q.replace(from, () => to));
    console.log(label, 'applied:', m.join('') !== base.join(''));
    await go('mutant ' + label + ':', m);
  }
}
