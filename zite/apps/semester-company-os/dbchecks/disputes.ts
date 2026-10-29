import { neon } from '@neondatabase/serverless';
import { FIN_MIGRATION } from '../src/lib/finMigration';
import { DSP_MIGRATION } from '../src/lib/dspMigration';

// Billing Contact "disputes" (lib/dspMigration.ts). One rolled-back transaction with a synthetic tenant and invoices.
// Run on app sbjuykr2qw: import { run } from './dbchecks/disputes'; await run();
export const CHECKS = `DO $$
DECLARE r jsonb; d1 text; h text; v int; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO fin_roles (tenant_id, user_id, role, granted_by) VALUES ('zz-t', 'zz_prep', 'preparer', 'dbcheck'), ('zz-t', 'zz_appr', 'approver', 'dbcheck'), ('zz-t', 'zz_both', 'preparer', 'dbcheck'), ('zz-t', 'zz_both', 'approver', 'dbcheck');
  INSERT INTO fin_invoices (tenant_id, id, customer, amount_minor, currency, status, created_by) VALUES ('zz-t', 'zz-inv1', 'Northgate (synthetic)', 120000, 'USD', 'Approved', 'zz_prep'),
    ('zz-t', 'zz-inv2', 'Northgate (synthetic)', 5000, 'USD', 'Draft', 'zz_prep'), ('zz-u', 'zz-inv3', 'Other (synthetic)', 5000, 'USD', 'Approved', 'zz_x');
  r := dsp_cmd('zz-t', 'zz_appr', 'd0', 'x0', 'raise', NULL, '{"invoiceId":"zz-inv1","category":"amount","contactName":"Pat Lee","detail":"We were billed for 600 seats; our contract says 500.","disputedMinor":20000}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'NOT_AUTHORIZED', 'D1 recording needs the preparer role');
  r := dsp_cmd('zz-t', 'zz_prep', 'd1', 'x1', 'raise', NULL, '{"invoiceId":"zz-inv2","category":"amount","contactName":"Pat Lee","detail":"We were billed for 600 seats; our contract says 500.","disputedMinor":1000}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_STATE', 'D2 a draft invoice cannot be disputed');
  r := dsp_cmd('zz-t', 'zz_prep', 'd2', 'x2', 'raise', NULL, '{"invoiceId":"zz-inv3","category":"amount","contactName":"Pat Lee","detail":"We were billed for 600 seats; our contract says 500.","disputedMinor":1000}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'NOT_FOUND', 'D3 another workspace''s invoice is not visible');
  r := dsp_cmd('zz-t', 'zz_prep', 'd3', 'x3', 'raise', NULL, '{"invoiceId":"zz-inv1","category":"amount","contactName":"Pat Lee","detail":"We were billed for 600 seats; our contract says 500.","disputedMinor":999999}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_INPUT', 'D4 cannot dispute more than the invoice');
  r := dsp_cmd('zz-t', 'zz_prep', 'd4', 'x4', 'raise', NULL, '{"invoiceId":"zz-inv1","category":"amount","contactName":"Pat Lee","detail":"We were billed for 600 seats; our contract says 500.","disputedMinor":20000}'); d1 := r->>'id';
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK' AND (SELECT state FROM dsp_disputes WHERE id = d1) = 'open', 'D5 preparer records a dispute');
  r := dsp_cmd('zz-t', 'zz_prep', 'd4', 'x4', 'raise', NULL, '{}');
  INSERT INTO rr VALUES ((r->>'replay')::boolean AND (SELECT count(*) FROM dsp_disputes WHERE tenant_id = 'zz-t') = 1, 'D6 a retry replays');
  r := dsp_cmd('zz-t', 'zz_both', 'd5', 'x5', 'raise', NULL, '{"invoiceId":"zz-inv1","category":"service","contactName":"Pat Lee","detail":"Second complaint about the same invoice text here.","disputedMinor":100}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'ALREADY_OPEN', 'D7 one open dispute per invoice');

  SELECT dsp_hash(x), x.version INTO h, v FROM dsp_disputes x WHERE id = d1;
  r := dsp_cmd('zz-t', 'zz_prep', 'd6', 'x6', 'uphold', d1, jsonb_build_object('version', v, 'seenHash', h, 'note', 'Contract confirms 500 seats', 'creditMinor', 20000));
  INSERT INTO rr VALUES (r->>'resultCode' = 'NOT_AUTHORIZED', 'D8 deciding needs the approver role');
  r := dsp_cmd('zz-t', 'zz_appr', 'd7', 'x7', 'uphold', d1, jsonb_build_object('version', v, 'seenHash', 'stale', 'note', 'Contract confirms 500 seats', 'creditMinor', 20000));
  INSERT INTO rr VALUES (r->>'resultCode' = 'CONTENT_CHANGED', 'D9 decision is bound to the dispute the approver saw');
  r := dsp_cmd('zz-t', 'zz_appr', 'd8', 'x8', 'uphold', d1, jsonb_build_object('version', v, 'seenHash', h, 'note', 'Contract confirms 500 seats', 'creditMinor', 30000));
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_INPUT', 'D10 credit cannot exceed the disputed amount');
  r := dsp_cmd('zz-t', 'zz_appr', 'd9', 'x9', 'uphold', d1, jsonb_build_object('version', v, 'seenHash', h, 'note', 'ok', 'creditMinor', 20000));
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_INPUT', 'D11 a decision needs a reason');
  r := dsp_cmd('zz-t', 'zz_appr', 'd10', 'x10', 'uphold', d1, jsonb_build_object('version', v, 'seenHash', h, 'note', 'Contract confirms 500 seats; 100 seats credited', 'creditMinor', 12000));
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK' AND (SELECT state = 'partially_upheld' AND credit_minor = 12000 AND credit_state = 'not_posted' AND decided_by = 'zz_appr' FROM dsp_disputes WHERE id = d1), 'D12 partly upheld; credit proposed, not posted');
  r := dsp_cmd('zz-t', 'zz_appr', 'd11', 'x11', 'reject', d1, jsonb_build_object('version', v + 1, 'seenHash', h, 'note', 'Changing my mind now'));
  INSERT INTO rr VALUES (r->>'resultCode' = 'CLOSED', 'D13 a decision is final');
  INSERT INTO rr VALUES ((SELECT amount_minor FROM fin_invoices WHERE tenant_id = 'zz-t' AND id = 'zz-inv1') = 120000 AND NOT EXISTS (SELECT 1 FROM fin_payments WHERE tenant_id = 'zz-t'), 'D14 the invoice and payments are untouched');

  r := dsp_cmd('zz-t', 'zz_both', 'd12', 'x12', 'raise', NULL, '{"invoiceId":"zz-inv1","category":"duplicate","contactName":"Pat Lee","detail":"We think this invoice was sent twice to our office.","disputedMinor":500}');
  SELECT dsp_hash(x), x.version INTO h, v FROM dsp_disputes x WHERE id = r->>'id';
  r := dsp_cmd('zz-t', 'zz_both', 'd13', 'x13', 'reject', r->>'id', jsonb_build_object('version', v, 'seenHash', h, 'note', 'Only one invoice exists'));
  INSERT INTO rr VALUES (r->>'resultCode' = 'SEPARATION_OF_DUTIES', 'D15 holding both roles still cannot decide your own');
  got := false; BEGIN UPDATE dsp_disputes SET credit_state = 'posted' WHERE id = d1; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'D16 nothing can post a credit');
  got := false; BEGIN UPDATE dsp_disputes SET decided_by = raised_by WHERE id = d1; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'D17 the table refuses self-decision');
  got := false; BEGIN DELETE FROM dsp_events WHERE dispute_id = d1; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'D18 history is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...FIN_MIGRATION, ...DSP_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 700)); } };
  await go('real:', base);
  const muts: [string, string, string][] = [
    ['self-decision (D15; constraint must still stop it)', `ELSIF d.raised_by = p_actor THEN v_code := 'SEPARATION_OF_DUTIES'`, `ELSIF false THEN v_code := 'SEPARATION_OF_DUTIES'`],
    ['unseen dispute (D9)', `ELSIF p->>'seenHash' IS DISTINCT FROM dsp_hash(d) THEN`, `ELSIF false THEN`],
    ['workspace isolation (D3)', `SELECT * INTO inv FROM fin_invoices WHERE tenant_id = p_tenant AND id = p->>'invoiceId';`, `SELECT * INTO inv FROM fin_invoices WHERE id = p->>'invoiceId';`],
  ];
  for (const [name, from, to] of muts) { const m = base.map((q) => q.replace(from, () => to)); console.log(`${name} applied:`, m.join('') !== base.join('')); await go(`mutant ${name}:`, m); }
}
