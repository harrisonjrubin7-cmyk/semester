import { neon } from '@neondatabase/serverless';
import { DEV_MIGRATION } from '../src/lib/devMigration';

// Developer key lifecycle: rotation replaces a token in place (dev_rotate_token), gated to the
// install's own institution and to active installs of live apps. Runs rolled back.
const CHECKS = `DO $$
DECLARE x text; e1 text; before_exp timestamptz; after_exp timestamptz;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  INSERT INTO dev_apps (id, name, developer_id, developer_tenant, requested_scopes) VALUES ('appk', 'Keycheck', 'devk', 'tk', ARRAY['catalog:read']);
  INSERT INTO rr VALUES (dev_install('adm', 'tk', 'appk', ARRAY['catalog:read'], 'hash-old', 30, 'insk') IS NULL, 'setup install mints');
  SELECT expires_at INTO before_exp FROM dev_installs WHERE id = 'insk';
  e1 := dev_rotate_token('adm', 'tk', 'insk', 'hash-new', 45);
  INSERT INTO rr VALUES (e1 IS NULL, 'C1 the owning institution can rotate');
  SELECT expires_at INTO after_exp FROM dev_installs WHERE id = 'insk';
  INSERT INTO rr VALUES ((SELECT token_hash FROM dev_installs WHERE id = 'insk') = 'hash-new' AND after_exp > before_exp, 'C2 hash replaced and expiry extended');
  INSERT INTO rr VALUES ((SELECT count(*) FROM dev_installs WHERE token_hash = 'hash-old') = 0, 'C3 the old token matches no install from now on');
  INSERT INTO rr VALUES (EXISTS (SELECT 1 FROM dev_audit WHERE action = 'rotate' AND target = 'insk' AND tenant_id = 'tk'), 'C4 rotation is audited');
  INSERT INTO rr VALUES (dev_rotate_token('adm', 'tk', 'insk', 'hash-x', 200) = 'Tokens last between 1 and 90 days.', 'C5 lifetime is capped at 90 days');
  INSERT INTO rr VALUES (dev_rotate_token('adm', 'other', 'insk', 'hash-x', 30) = 'Install not found.', 'C6 another institution cannot rotate this install');
  UPDATE dev_installs SET status = 'revoked', revoked_at = now() WHERE id = 'insk';
  INSERT INTO rr VALUES (dev_rotate_token('adm', 'tk', 'insk', 'hash-x', 30) LIKE 'Only an active install%', 'C7 a revoked install cannot be rotated');
  INSERT INTO dev_apps (id, name, developer_id, developer_tenant, requested_scopes, status) VALUES ('appk2', 'Keycheck Two', 'devk', 'tk', ARRAY['catalog:read'], 'suspended');
  INSERT INTO dev_installs (id, tenant_id, app_id, scopes, token_hash, installed_by, expires_at) VALUES ('insk2', 'tk', 'appk2', ARRAY['catalog:read'], 'hash-s', 'adm', now() + interval '10 days');
  INSERT INTO rr VALUES (dev_rotate_token('adm', 'tk', 'insk2', 'hash-y', 30) LIKE 'The app is suspended%', 'C8 a suspended app tokens cannot be rotated');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x, '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', DEV_MIGRATION);
  const m1 = DEV_MIGRATION.map((q) => q.replace('WHERE id = p_install AND tenant_id = p_tenant', () => 'WHERE id = p_install'));
  console.log('tenant mutant applied:', m1.join('') !== DEV_MIGRATION.join(''));
  await go('mutant any-institution-rotates (C6):', m1);
  const m2 = DEV_MIGRATION.map((q) => q.replace("IF i.status <> 'active' THEN", () => 'IF false THEN'));
  console.log('status mutant applied:', m2.join('') !== DEV_MIGRATION.join(''));
  await go('mutant revoked-rotates (C7):', m2);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT (SELECT count(*) FROM dev_apps WHERE id IN ('appk','appk2')) AS apps, (SELECT count(*) FROM dev_installs WHERE id IN ('insk','insk2')) AS installs`)));
}
