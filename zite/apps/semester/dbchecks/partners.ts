import { neon } from '@neondatabase/serverless';
import { PTA_MIGRATION } from '../src/lib/ptaMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; o1 bigint; o2 bigint; rel bigint; rel2 bigint; v int; h text; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  r := pta_register('pa','Acme Learning','marketplace','acme.example'); o1 := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'F1 register');
  INSERT INTO rr VALUES (pta_register('evil',' acme   LEARNING ','marketplace','') LIKE 'An organization with that name%', 'F2 no name squatting');
  r := pta_register('pb','Beta Research','research',''); o2 := split_part(r,':',2)::bigint;
  -- delegated admin limits
  INSERT INTO rr VALUES (pta_member('pb',o1,'pb2','admin') LIKE 'Only an administrator of this organization%', 'F3 cannot add members to another org');
  INSERT INTO rr VALUES (pta_member('pa',o1,'pa','member') LIKE 'Another administrator%', 'F4 cannot change own role');
  PERFORM pta_member('pa',o1,'pa2','member');
  INSERT INTO rr VALUES (pta_member('pa2',o1,'pa3','admin') LIKE 'Only an administrator%', 'F5 members cannot promote');
  PERFORM pta_member('pa',o1,'pa2','admin');
  INSERT INTO rr VALUES (pta_member('pa2',o1,'pa',NULL) IS NULL, 'F6 admin removes another admin');
  INSERT INTO rr VALUES (pta_member('pa',o1,'pa2',NULL) LIKE 'Only an administrator%', 'F7 removed admin has no power');
  -- institution side
  INSERT INTO rr VALUES (pta_set_staff('adm','t1','adm',true) IS NOT NULL, 'F8 self-grant refused');
  PERFORM pta_set_staff('adm','t1','m1',true); PERFORM pta_set_staff('adm','t1','m2',true); PERFORM pta_set_staff('adm','t1','pa2',true);
  INSERT INTO rr VALUES (pta_apply('pa2','t1',o1,ARRAY['admin_all'],'') LIKE 'Choose what you are asking%', 'F9 no unpublished scopes');
  r := pta_apply('pa2','t1',o1,ARRAY['publish_listings','view_orders'],'We run the campus bookstore marketplace'); rel := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'F10 apply');
  INSERT INTO rr VALUES (pta_manage('pa2','t1',rel,'verify',1,'Checked business registry','',NULL,NULL) LIKE 'You belong to this organization%', 'F11 a manager inside the org cannot act on it');
  INSERT INTO rr VALUES (pta_manage('m1','t1',rel,'propose',1,'','Terms text long enough to be a real agreement for the campus',current_date+365,ARRAY['publish_listings']) LIKE 'Verify the organization first.', 'F12 no terms before verification');
  PERFORM pta_manage('m1','t1',rel,'verify',1,'Checked state business registry','',NULL,NULL);
  INSERT INTO rr VALUES (pta_manage('m1','t1',rel,'propose',2,'','Terms text long enough to be a real agreement for the campus',current_date+365,ARRAY['publish_listings']) LIKE 'A different manager%', 'F13 verifier does not also propose');
  INSERT INTO rr VALUES (pta_manage('m2','t1',rel,'propose',2,'','Terms text long enough to be a real agreement for the campus',current_date+365,ARRAY['publish_listings']) IS NULL, 'F14 second manager proposes');
  SELECT agreement_hash, version INTO h, v FROM pta_relationships WHERE id = rel;
  INSERT INTO rr VALUES (pta_accept('pa3',rel,v,h) LIKE 'Only an administrator%', 'F15 non-admins cannot accept');
  INSERT INTO rr VALUES (pta_accept('pa2',rel,v,'stale') LIKE 'The agreement changed%', 'F16 accept pins the exact text');
  INSERT INTO rr VALUES (pta_accept('pa2',rel,v,h) IS NULL, 'F17 accept');
  INSERT INTO rr VALUES (pta_live('t1',o1,'publish_listings') AND NOT pta_live('t1',o1,'view_orders'), 'F18 only granted scopes, not requested ones');
  INSERT INTO rr VALUES (NOT pta_live('t2',o1,'publish_listings'), 'F19 another institution is separate');
  UPDATE pta_relationships SET valid_to = current_date - 1 WHERE id = rel;
  INSERT INTO rr VALUES (NOT pta_live('t1',o1,'publish_listings'), 'F20 expired agreement gives no access');
  UPDATE pta_relationships SET valid_to = current_date + 30 WHERE id = rel;
  SELECT version INTO v FROM pta_relationships WHERE id = rel;
  PERFORM pta_manage('m1','t1',rel,'suspend',v,'Unresolved complaints','',NULL,NULL);
  INSERT INTO rr VALUES (NOT pta_live('t1',o1,'publish_listings'), 'F21 suspension stops access');
  SELECT version INTO v FROM pta_relationships WHERE id = rel;
  PERFORM pta_manage('m1','t1',rel,'offboard',v,'Contract ended','',NULL,NULL);
  INSERT INTO rr VALUES ((SELECT state = 'offboarded' AND agreement_text <> '' FROM pta_relationships WHERE id = rel) AND NOT pta_live('t1',o1,'publish_listings'), 'F22 offboarded, records kept');
  -- table guards
  r := pta_apply('pb','t1',o2,ARRAY['submit_research_requests'],''); rel2 := split_part(r,':',2)::bigint;
  got := false; BEGIN UPDATE pta_relationships SET state = 'active', scopes = ARRAY['submit_research_requests'], valid_to = current_date + 10 WHERE id = rel2; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F23 no active access without an accepted agreement (table)');
  got := false; BEGIN UPDATE pta_relationships SET scopes = ARRAY['root'] WHERE id = rel2; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F24 no unpublished scopes (table)');
  got := false; BEGIN DELETE FROM pta_events; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F25 history append-only');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...PTA_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('pta_orgs') AS t`)));
}
