import { neon } from '@neondatabase/serverless';
import { CO_ROLE_STATEMENTS } from '../src/lib/coRoles';
import { MIG_MIGRATION } from '../src/lib/migMigration';

// Implementation Manager: inventories and rollback (role-app capabilities "Migration inventories", "Rollback"). One
// rolled-back transaction: the role rows below exist only inside it. Run with the one-off runner on app sbjuykr2qw:
// import { run } from './dbchecks/migrations'; await run();
export const CHECKS = `DO $$
DECLARE r jsonb; v_id text; got boolean; v int;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO co_roles (tenant_id, user_id, role, granted_by) VALUES ('semester-company', 'zz_imp1', 'impl_lead', 'dbcheck');
  INSERT INTO co_roles (tenant_id, user_id, role, granted_by, revoked_at) VALUES ('semester-company', 'zz_imp2', 'impl_lead', 'dbcheck', now());

  r := mig_cmd('zz_out', 'k0', 'h0', 'create', NULL, '{"tenantId":"t1","title":"Registrar move","domain":"registrar"}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'NOT_AUTHORIZED', 'M1 no impl_lead role: refused ' || coalesce(r->>'resultCode',''));
  r := mig_cmd('zz_imp2', 'k0', 'h0', 'create', NULL, '{"tenantId":"t1","title":"Registrar move","domain":"registrar"}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'NOT_AUTHORIZED', 'M2 a revoked role is refused ' || coalesce(r->>'resultCode',''));
  r := mig_cmd('zz_imp1', 'k1', 'h1', 'create', NULL, '{"tenantId":"t1","title":"Registrar move","domain":"registrar"}');
  v_id := r->>'id';
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK' AND (SELECT stage FROM mig_projects WHERE id = v_id) = 'inventory', 'M3 lead creates at inventory ' || coalesce(r->>'message',''));
  r := mig_cmd('zz_imp1', 'k1', 'h1', 'create', NULL, '{"tenantId":"t1","title":"Registrar move","domain":"registrar"}');
  INSERT INTO rr VALUES ((r->>'replay')::boolean AND r->>'id' = v_id AND (SELECT count(*) FROM mig_projects WHERE lead_id = 'zz_imp1') = 1, 'M4 same key + same payload replays, no second project');
  r := mig_cmd('zz_imp1', 'k1', 'h1-changed', 'create', NULL, '{"tenantId":"t1","title":"Other","domain":"courses"}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'IDEMPOTENCY_CONFLICT', 'M5 same key + changed payload is a conflict');

  r := mig_cmd('zz_imp1', 'k2', 'h2', 'advance', v_id, '{"version":1}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'BLOCKED', 'M6 cannot leave inventory with no items ' || coalesce(r->>'message',''));
  r := mig_cmd('zz_imp1', 'k3', 'h3', 'inventory', v_id, '{"version":1,"item":"ab","sourceSystem":"SIS","owner":"Registrar","recordCount":10}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_INPUT', 'M7 item name under 3 characters refused');
  r := mig_cmd('zz_imp1', 'k4', 'h4', 'inventory', v_id, '{"version":1,"item":"Transcripts","sourceSystem":"SIS","owner":"","recordCount":10}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_INPUT', 'M8 owner required');
  r := mig_cmd('zz_imp1', 'k5', 'h5', 'inventory', v_id, '{"version":1,"item":"Transcripts","sourceSystem":"SIS","owner":"Registrar","recordCount":-1}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_INPUT', 'M9 negative record count refused');
  r := mig_cmd('zz_imp1', 'k6', 'h6', 'inventory', v_id, '{"version":1,"item":"Transcripts","sourceSystem":"SIS","owner":"Registrar","recordCount":1200}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK', 'M10 complete item added ' || coalesce(r->>'message',''));
  INSERT INTO rr VALUES ((SELECT count(*) FROM mig_inventory WHERE project_id = v_id) = 1 AND (SELECT version FROM mig_projects WHERE id = v_id) = 2, 'M11 one item stored, version bumped');
  r := mig_cmd('zz_imp1', 'k7', 'h7', 'inventory', v_id, '{"version":1,"item":"Holds","sourceSystem":"SIS","owner":"Registrar","recordCount":5}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'STALE', 'M12 old version is refused as stale');
  r := mig_cmd('zz_imp1', 'k8', 'h8', 'advance', v_id, '{"version":2}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK' AND (SELECT stage FROM mig_projects WHERE id = v_id) = 'mapping', 'M13 advance to mapping with an item');

  r := mig_cmd('zz_imp1', 'k9', 'h9', 'rollback', v_id, '{"version":3,"reason":"Data mismatch in transcripts"}');
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_STATE', 'M14 rollback refused outside the rollback window');
  -- Put the project in its rollback window directly (the cutover path is tested by its approval gate separately).
  UPDATE mig_projects SET stage = 'rollback_window', cutover_at = now(), window_ends_at = now() + interval '72 hours' WHERE id = v_id;
  SELECT version INTO v FROM mig_projects WHERE id = v_id;
  r := mig_cmd('zz_imp1', 'k10', 'h10', 'inventory', v_id, jsonb_build_object('version', v, 'item', 'Late item', 'sourceSystem', 'SIS', 'owner', 'Registrar', 'recordCount', 1));
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_STATE', 'M15 inventory is frozen after cutover');
  r := mig_cmd('zz_imp1', 'k11', 'h11', 'rollback', v_id, jsonb_build_object('version', v, 'reason', 'short'));
  INSERT INTO rr VALUES (r->>'resultCode' = 'BAD_INPUT', 'M16 rollback needs a 10+ character reason');
  r := mig_cmd('zz_out', 'k12', 'h12', 'rollback', v_id, jsonb_build_object('version', v, 'reason', 'Data mismatch in transcripts'));
  INSERT INTO rr VALUES (r->>'resultCode' = 'NOT_AUTHORIZED', 'M17 rollback needs the role');
  r := mig_cmd('zz_imp1', 'k13', 'h13', 'complete', v_id, jsonb_build_object('version', v));
  INSERT INTO rr VALUES (r->>'resultCode' = 'BLOCKED', 'M18 completion refused while the window is open ' || coalesce(r->>'message',''));
  r := mig_cmd('zz_imp1', 'k14', 'h14', 'rollback', v_id, jsonb_build_object('version', v, 'reason', 'Data mismatch in transcripts'));
  INSERT INTO rr VALUES (r->>'resultCode' = 'OK', 'M19 rollback inside the window ' || coalesce(r->>'message',''));
  INSERT INTO rr VALUES ((SELECT stage = 'rolled_back' AND ended_reason = 'Data mismatch in transcripts' FROM mig_projects WHERE id = v_id), 'M20 project rolled back with its reason');
  r := mig_cmd('zz_imp1', 'k15', 'h15', 'rollback', v_id, jsonb_build_object('version', v + 1, 'reason', 'Data mismatch in transcripts'));
  INSERT INTO rr VALUES (r->>'resultCode' = 'CLOSED', 'M21 a rolled-back project is closed');
  INSERT INTO rr VALUES ((SELECT string_agg(action, ',' ORDER BY id) FROM mig_timeline WHERE project_id = v_id) = 'create,inventory,advance,rollback', 'M22 timeline holds only successful steps');
  INSERT INTO rr VALUES ((SELECT count(*) FROM mig_receipts WHERE actor_id IN ('zz_imp1','zz_imp2','zz_out')) = 17, 'M23 every non-replayed command (17) has a receipt, got ' || (SELECT count(*) FROM mig_receipts WHERE actor_id IN ('zz_imp1','zz_imp2','zz_out')));
  got := false; BEGIN DELETE FROM mig_timeline WHERE project_id = v_id; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'M24 timeline is append-only');
  got := false; BEGIN UPDATE mig_receipts SET result_code = 'OK' WHERE actor_id = 'zz_out'; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'M25 receipts are append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...CO_ROLE_STATEMENTS, ...MIG_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 900)); } };
  await go('real:', base);
  const m1 = base.map((q) => q.replace(`IF m.stage <> 'rollback_window' THEN v_code := 'BAD_STATE'; v_msg := 'Rollback is only available`, () => `IF false THEN v_code := 'BAD_STATE'; v_msg := 'Rollback is only available`));
  console.log('rollback-window mutant applied:', m1.join('') !== base.join(''));
  await go('mutant rollback anytime (M14):', m1);
  const m2 = base.map((q) => q.replace(`IF m.stage NOT IN ('inventory', 'mapping') THEN v_code := 'BAD_STATE'; v_msg := 'Inventory is edited`, () => `IF false THEN v_code := 'BAD_STATE'; v_msg := 'Inventory is edited`));
  console.log('inventory-freeze mutant applied:', m2.join('') !== base.join(''));
  await go('mutant inventory after cutover (M15):', m2);
  const m3 = base.map((q) => q.replace(`AND revoked_at IS NULL`, () => ``));
  console.log('revocation mutant applied:', m3.join('') !== base.join(''));
  await go('mutant revoked role still works (M2):', m3);
}
