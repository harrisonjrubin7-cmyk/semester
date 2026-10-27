import { neon } from '@neondatabase/serverless';
import { DGV_MIGRATION } from '../src/lib/dgvMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; t bigint; a1 bigint; a2 bigint; a3 bigint; q bigint; iss bigint; c bigint; v int; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO rr VALUES (dgv_set_steward('adm','t1','adm',true) IS NOT NULL, 'G1 no self-grant');
  PERFORM dgv_set_steward('adm','t1','ds1',true); PERFORM dgv_set_steward('adm','t1','ds2',true);
  INSERT INTO rr VALUES (dgv_term('u1','t1','Active student','A student enrolled in at least one credit') LIKE 'Only data stewards%', 'G2 non-stewards cannot propose');
  r := dgv_term('ds1','t1','Active student','A student enrolled in at least one credit this term'); t := split_part(r,':',2)::bigint;
  SELECT version INTO v FROM dgv_terms WHERE id = t;
  INSERT INTO rr VALUES (dgv_term_step('ds1','t1',t,'approve',v) = 'Another steward approves your proposal.', 'G3 no self-approval');
  INSERT INTO rr VALUES (dgv_term_step('ds2','t1',t,'approve',v+5) LIKE 'This definition changed%', 'G4 stale version refused');
  x := dgv_term_step('ds2','t1',t,'approve',v);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT state = 'approved' FROM dgv_terms WHERE id = t), 'G5 second steward approves');
  PERFORM dgv_term('ds2','t1','Active student','Revised: enrolled in one or more credits on census day');
  INSERT INTO rr VALUES ((SELECT state = 'proposed' AND approved_by IS NULL FROM dgv_terms WHERE id = t), 'G6 revision returns to proposed');
  -- datasets, classification
  r := dgv_asset('ds1','t1','Enrollment','SIS','confidential','SIS registrar tables'); a1 := split_part(r,':',2)::bigint;
  r := dgv_asset('ds1','t1','Retention dashboard','Warehouse','internal','Warehouse'); a2 := split_part(r,':',2)::bigint;
  r := dgv_asset('ds1','t1','Board report','Reports','internal','Reports'); a3 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (dgv_asset('ds1','t1','Enrollment','SIS','internal','SIS') LIKE 'A dataset with that name%', 'G7 unique dataset names');
  SELECT version INTO v FROM dgv_assets WHERE id = a1;
  x := dgv_classify('ds1','t1',a1,'internal',v);
  INSERT INTO rr VALUES (x = 'pending' AND (SELECT classification = 'confidential' FROM dgv_assets WHERE id = a1), 'G8 lowering is only proposed');
  SELECT version INTO v FROM dgv_assets WHERE id = a1;
  INSERT INTO rr VALUES (dgv_classify('ds1','t1',a1,'internal',v) = 'Another steward confirms a lower classification.', 'G9 proposer cannot confirm the lowering');
  x := dgv_classify('ds2','t1',a1,'internal',v);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT classification = 'internal' FROM dgv_assets WHERE id = a1), 'G10 second steward confirms');
  SELECT version INTO v FROM dgv_assets WHERE id = a2;
  x := dgv_classify('ds1','t1',a2,'restricted',v);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT classification = 'restricted' FROM dgv_assets WHERE id = a2), 'G11 raising applies at once');
  -- lineage
  PERFORM dgv_link('ds1','t1',a1,a2,'nightly aggregate'); PERFORM dgv_link('ds1','t1',a2,a3,'quarterly extract');
  INSERT INTO rr VALUES (dgv_link('ds1','t1',a3,a1,'loop back') = 'That link would make the lineage circular.', 'G12 no lineage cycles');
  INSERT INTO rr VALUES (dgv_link('ds1','t1',a1,a1,'self') = 'A dataset cannot feed itself.', 'G13 no self edge');
  -- quality
  r := dgv_rule('ds1','t1',a1,'Rows with a valid term code',99); q := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (dgv_measure('ds1','t1',q,99.5) = 'ok:pass', 'G14 passing result');
  x := dgv_measure('ds1','t1',q,92);
  SELECT s.id INTO iss FROM dgv_issues s JOIN dgv_results rs ON rs.id = s.result_id WHERE rs.rule_id = q;
  INSERT INTO rr VALUES (x = 'ok:fail' AND iss IS NOT NULL, 'G15 failure opens an issue');
  INSERT INTO rr VALUES (dgv_resolve_issue('ds1','t1',iss,'') = 'Record what fixed it.', 'G16 resolution needs a note');
  INSERT INTO rr VALUES (dgv_resolve_issue('ds1','t1',iss,'Backfilled 312 missing term codes') IS NULL, 'G17 issue resolved');
  -- retention
  INSERT INTO rr VALUES (dgv_retain('ds1','t1',a1,365,1825,'FERPA and state records schedule') LIKE 'Retention cannot be shorter%', 'G18 legal minimum');
  INSERT INTO rr VALUES (dgv_retain('ds1','t1',a1,2555,1825,'State records schedule 7 years') IS NULL, 'G19 retention set');
  -- conflicts
  INSERT INTO rr VALUES (dgv_conflict('ds1','t1','Headcount','SIS','SIS','Different counts on census day') = 'Name two different sources.', 'G20 two sources');
  r := dgv_conflict('ds1','t1','Headcount','SIS','Warehouse','Census headcount differs by 14'); c := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (dgv_settle('ds1','t1',c,'SIS','Registrar is the system of record') = 'Another steward settles a conflict you raised.', 'G21 raiser cannot settle');
  INSERT INTO rr VALUES (dgv_settle('ds2','t1',c,'Other','Registrar is the system of record') = 'Choose one of the two sources.', 'G22 authority is one of the sources');
  INSERT INTO rr VALUES (dgv_settle('ds2','t1',c,'SIS','Registrar is the system of record') IS NULL, 'G23 settled');
  INSERT INTO rr VALUES (dgv_conflict('ds1','t2','Headcount','SIS','Warehouse','Census headcount differs by 14') LIKE 'Only data stewards%', 'G24 steward role is per institution');
  -- table guards
  got := false; BEGIN UPDATE dgv_terms SET approved_by = proposed_by WHERE id = t; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'G25 table refuses self-approval');
  got := false; BEGIN DELETE FROM dgv_results; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'G26 quality results append-only');
  SELECT string_agg(lbl, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...DGV_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('dgv_terms') AS t`)));
}
