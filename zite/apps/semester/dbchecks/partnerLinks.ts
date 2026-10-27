import { neon } from '@neondatabase/serverless';
import { TRF_MIGRATION } from '../src/lib/trfMigration';
import { PTA_MIGRATION } from '../src/lib/ptaMigration';

// Partner access wired into Transfer: only a live relationship with propose_articulation proposes, only for the org's own name,
// and a registrar (never the partner) decides.
export const CHECKS = `DO $$
DECLARE r text; x text; o bigint; o2 bigint; rel bigint; rel2 bigint; v int; h text; rid bigint;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  r := pta_register('pa','Northside Community College','transfer',''); o := split_part(r,':',2)::bigint;
  r := pta_register('pb','Other Seller','marketplace',''); o2 := split_part(r,':',2)::bigint;
  PERFORM pta_set_staff('adm','t1','m1',true); PERFORM pta_set_staff('adm','t1','m2',true);
  r := pta_apply('pa','t1',o,ARRAY['propose_articulation'],'Feeder college'); rel := split_part(r,':',2)::bigint;
  r := pta_apply('pb','t1',o2,ARRAY['publish_listings'],'Bookstore'); rel2 := split_part(r,':',2)::bigint;
  x := pta_propose_articulation('pa',rel,'BIO 101','equivalent','BIOL 1010',4,'Fall 2027');
  INSERT INTO rr VALUES (x LIKE 'This institution has not given%', 'F1 no proposals before the relationship is live: ' || coalesce(x,''));
  PERFORM pta_manage('m1','t1',rel,'verify',1,'Checked accreditation','',NULL,NULL);
  PERFORM pta_manage('m2','t1',rel,'propose',2,'','Articulation agreement text long enough for the check',current_date+365,ARRAY['propose_articulation']);
  SELECT agreement_hash, version INTO h, v FROM pta_relationships WHERE id = rel;
  PERFORM pta_accept('pa',rel,v,h);
  PERFORM pta_manage('m1','t1',rel2,'verify',1,'Checked registry','',NULL,NULL);
  PERFORM pta_manage('m2','t1',rel2,'propose',2,'','Marketplace agreement text long enough for the check',current_date+365,ARRAY['publish_listings']);
  SELECT agreement_hash, version INTO h, v FROM pta_relationships WHERE id = rel2;
  PERFORM pta_accept('pb',rel2,v,h);
  INSERT INTO rr VALUES (pta_propose_articulation('outsider',rel,'BIO 101','elective',NULL,4,'Fall 2027') = 'Relationship not found.', 'F2 non-members cannot use the relationship');
  INSERT INTO rr VALUES (pta_propose_articulation('pb',rel2,'BIO 101','elective',NULL,4,'Fall 2027') LIKE 'This institution has not given%', 'F3 a live relationship without the scope cannot propose');
  x := pta_propose_articulation('pa',rel,'bio  101','equivalent','BIOL 1010',4,'Fall 2027'); rid := NULLIF(split_part(x,':',2),'')::bigint;
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'F4 live partner proposes: ' || coalesce(x,''));
  INSERT INTO rr VALUES ((SELECT ext_institution = 'Northside Community College' AND ext_course = 'BIO 101' AND state = 'proposed' AND partner_org_id = o FROM trf_rules WHERE id = rid), 'F5 rule carries the org''s own name and stays proposed');
  INSERT INTO rr VALUES (trf_decide_rule('pa','t1',rid,true,'') = 'A different registrar must approve your rule.', 'F6 partner cannot approve its own proposal');
  x := trf_decide_rule('reg','t1',rid,true,'');
  INSERT INTO rr VALUES (x IS NULL AND (SELECT state = 'approved' AND decided_by = 'reg' FROM trf_rules WHERE id = rid), 'F7 registrar decides');
  SELECT version INTO v FROM pta_relationships WHERE id = rel;
  PERFORM pta_manage('m1','t1',rel,'suspend',v,'Paused','',NULL,NULL);
  INSERT INTO rr VALUES (pta_propose_articulation('pa',rel,'CHM 101','elective',NULL,4,'Fall 2027') LIKE 'This institution has not given%', 'F8 suspension stops proposals');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...TRF_MIGRATION, ...PTA_MIGRATION].map((q) => sql.query(q)).concat([sql.query(CHECKS)])); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('pta_orgs') AS t`)));
}
