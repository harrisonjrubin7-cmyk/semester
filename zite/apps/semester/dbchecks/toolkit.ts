import { neon } from '@neondatabase/serverless';
import { TLK_MIGRATION } from '../src/lib/tlkMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; d bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  r := tlk_save('s1','t1',NULL,'case','My case','{"facts":"x"}'::jsonb,0); d := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%:1', 'K1 new document saved at version 1');
  INSERT INTO rr VALUES (tlk_save('s2','t1',d,'case','Hijack','{}'::jsonb,1) = 'Document not found.', 'K2 only the owner edits');
  INSERT INTO rr VALUES (tlk_save('s1','t2',d,'case','Other tenant','{}'::jsonb,1) = 'Document not found.', 'K3 other tenant cannot edit');
  INSERT INTO rr VALUES (tlk_save('s1','t1',d,'case','Stale','{}'::jsonb,7) LIKE 'This document changed%', 'K4 stale version refused');
  r := tlk_save('s1','t1',d,'case','My case v2','{"facts":"y"}'::jsonb,1);
  INSERT INTO rr VALUES (r = 'ok:' || d || ':2' AND (SELECT data->>'facts' = 'y' AND version = 2 FROM tlk_docs WHERE id = d), 'K5 owner saves with the right version');
  INSERT INTO rr VALUES (tlk_save('s1','t1',d,'data','Kind swap','{}'::jsonb,2) = 'Document not found.', 'K6 kind cannot be swapped');
  INSERT INTO rr VALUES (tlk_save('s1','t1',NULL,'grade','X','{}'::jsonb,0) = 'Unknown tool.', 'K7 unknown tool refused');
  INSERT INTO rr VALUES (tlk_save('s1','t1',NULL,'case','  ','{}'::jsonb,0) LIKE 'Give it a title%', 'K8 blank title refused');
  INSERT INTO rr VALUES (tlk_save('s1','t1',NULL,'case','A','[1]'::jsonb,0) LIKE 'This document is not%', 'K9 non-object data refused');
  INSERT INTO rr VALUES (tlk_save('s1','t1',NULL,'case','Big',jsonb_build_object('a', repeat('z', 200001)),0) LIKE 'This document is too large%', 'K10 oversize refused');
  INSERT INTO rr VALUES (tlk_delete('s2','t1',d) = 'Document not found.', 'K11 only the owner deletes');
  r := tlk_delete('s1','t1',d);
  INSERT INTO rr VALUES (r IS NULL AND NOT EXISTS (SELECT 1 FROM tlk_docs WHERE id = d), 'K12 owner deletes');
  got := false; BEGIN INSERT INTO tlk_docs (tenant_id, owner_id, kind, title) VALUES ('t1','s1','grade','x'); EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'K13 table refuses an unknown kind');
  r := tlk_save('s1','t1',NULL,'sheet','Budget','{"grid":[["Item","Cost"],["Books","120"],["Total","=SUM(B2:B2)"]]}'::jsonb,0);
  INSERT INTO rr VALUES (r LIKE 'ok:%:1', 'K14 a spreadsheet saves as a toolkit document');
  SELECT string_agg(lbl, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...TLK_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  // Mutation: remove the owner check from tlk_save; K2 must then fail.
  const mutated = TLK_MIGRATION.map((q) => q.replace('AND owner_id = p_owner FOR UPDATE', () => 'FOR UPDATE'));
  try { await sql.transaction([...mutated.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('mutant: no RESULT raised'); }
  catch (e) { console.log('mutant:', String((e as any).message).slice(0, 300)); }
  // Upgrade path: a table created before 27 Oct (no 'sheet' in its check) must be widened by the migration.
  const old = [TLK_MIGRATION[0].replace("'rubric','sheet')", () => "'rubric')"), ...TLK_MIGRATION.slice(1)];
  try { await sql.transaction([...old.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('upgrade: no RESULT raised'); }
  catch (e) { console.log('upgrade:', String((e as any).message).slice(0, 300)); }
  const noWiden = old.filter((q) => !q.includes('tlk_docs_kind_check'));
  try { await sql.transaction([...noWiden.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('upgrade-without-widen: no RESULT raised'); }
  catch (e) { console.log('upgrade-without-widen (control, K14 must fail):', String((e as any).message).slice(0, 300)); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('tlk_docs') AS t`)));
}
