import { neon } from '@neondatabase/serverless';
import { TRUST_DDL } from '../src/lib/trustRules';

// Trust Officer "trust room": the table-level backstop under the endpoint's rules (tests/trustRules.test.ts covers those).
// One rolled-back transaction. Run on app sbjuykr2qw: import { run } from './dbchecks/trustRoom'; await run();
export const CHECKS = `DO $$
DECLARE got boolean; v_id bigint;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO site_trust_changes (kind, payload, evidence, proposed_by, proposed_name) VALUES ('control', '{"section":"security","control":"zz check","status":"In progress"}', 'dbcheck', 'zz_p1', 'P One') RETURNING id INTO v_id;
  INSERT INTO rr VALUES ((SELECT status FROM site_trust_changes WHERE id = v_id) = 'pending', 'T1 a proposal starts pending');
  got := false; BEGIN UPDATE site_trust_changes SET status = 'approved', decided_by = 'zz_p1' WHERE id = v_id; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'T2 the table refuses a self-decision');
  got := false; BEGIN UPDATE site_trust_changes SET status = 'published' WHERE id = v_id; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'T3 only pending, approved or rejected');
  got := false; BEGIN INSERT INTO site_trust_controls (section, control, status) VALUES ('security', 'zz check', 'SOC 2 certified'); EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'T4 a public control cannot carry a certification claim as its status');
  UPDATE site_trust_changes SET status = 'approved', decided_by = 'zz_d1' WHERE id = v_id;
  INSERT INTO rr VALUES ((SELECT status = 'approved' AND decided_by <> proposed_by FROM site_trust_changes WHERE id = v_id), 'T5 a different person decides');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...TRUST_DDL.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('real: no RESULT raised'); } catch (e) { console.log('real:', String((e as Error).message).slice(0, 600)); }
}
