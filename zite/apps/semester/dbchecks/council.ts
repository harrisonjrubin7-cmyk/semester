import { neon } from '@neondatabase/serverless';
import { PCL_MIGRATION } from '../src/lib/pclMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; rb bigint; p bigint; p2 bigint; v int; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO rr VALUES (pcl_set_member('adm','t1','adm','chair') IS NOT NULL, 'P1 no self-grant');
  PERFORM pcl_set_member('adm','t1','m1','member'); PERFORM pcl_set_member('adm','t1','c1','chair'); PERFORM pcl_set_member('adm','t1','c2','chair');
  INSERT INTO rr VALUES (pcl_rubric('u1','t1','Capstone','Evidence of independent work across three artifacts') LIKE 'Only council members%', 'P2 members draft rubrics');
  r := pcl_rubric('m1','t1','Capstone','Evidence of independent work across three artifacts'); rb := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (pcl_submit('prog','t1','Data science badge','Data Science Micro',rb,'Program evidence summary with outcomes mapped') LIKE 'Choose an adopted rubric%', 'P3 drafts cannot be used');
  SELECT version INTO v FROM pcl_rubrics WHERE id = rb;
  INSERT INTO rr VALUES (pcl_rubric_step('m1','t1',rb,'adopt',v) = 'Another member adopts your draft.', 'P4 no self-adoption');
  x := pcl_rubric_step('c1','t1',rb,'adopt',v);
  INSERT INTO rr VALUES (x IS NULL, 'P5 adopted by another member');
  r := pcl_submit('prog','t1','Data science badge','Data Science Micro',rb,'Program evidence summary with outcomes mapped'); p := split_part(r,':',2)::bigint;
  PERFORM pcl_reviewer('m1','t1','rv1',true); PERFORM pcl_reviewer('m1','t1','rv2',true); PERFORM pcl_reviewer('m1','t1','rv3',true); PERFORM pcl_reviewer('m1','t1','prog',true);
  INSERT INTO rr VALUES (pcl_assign('m1','t1',p,'outsider') = 'Choose someone in the reviewer pool.', 'P6 pool only');
  INSERT INTO rr VALUES (pcl_assign('m1','t1',p,'prog') = 'The submitter cannot review their own package.', 'P7 submitter excluded');
  PERFORM pcl_declare('rv3','t1',p,'Co-taught the course');
  INSERT INTO rr VALUES (pcl_assign('m1','t1',p,'rv3') = 'That reviewer declared a conflict on this package.', 'P8 conflict blocks assignment');
  PERFORM pcl_assign('m1','t1',p,'rv1'); PERFORM pcl_assign('m1','t1',p,'rv2');
  INSERT INTO rr VALUES (pcl_review('rv3','t1',p,3,true,'Looks strong overall') = 'You are not assigned to this package.', 'P9 unassigned cannot review');
  PERFORM pcl_review('rv1','t1',p,3,true,'Meets the standard on all three artifacts');
  SELECT version INTO v FROM pcl_packages WHERE id = p;
  INSERT INTO rr VALUES (pcl_step('m1','t1',p,'close_review','',v) = 'At least two reviews are needed.', 'P10 two reviews');
  PERFORM pcl_review('rv2','t1',p,1,false,'Second artifact lacks independent work');
  INSERT INTO rr VALUES (pcl_review('rv2','t1',p,4,true,'Changed my mind on it') = 'Your review is already recorded.', 'P11 one review each');
  x := pcl_step('m1','t1',p,'close_review','',v);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT state = 'not_validated' FROM pcl_packages WHERE id = p), 'P12 any unmet review = not validated');
  SELECT version INTO v FROM pcl_packages WHERE id = p;
  INSERT INTO rr VALUES (pcl_step('c1','t1',p,'recommend','',v) = 'Only validated packages are recommended.', 'P13 recommend needs validation');
  INSERT INTO rr VALUES (pcl_step('rv1','t1',p,'appeal','The second artifact was misread by the reviewer',v) = 'Only the submitter appeals.', 'P14 submitter appeals');
  x := pcl_step('prog','t1',p,'appeal','The second artifact was misread by the reviewer',v);
  INSERT INTO rr VALUES (x IS NULL, 'P15 appeal filed');
  PERFORM pcl_assign('c1','t1',p,'rv3');
  SELECT version INTO v FROM pcl_packages WHERE id = p;
  INSERT INTO rr VALUES (pcl_step('m1','t1',p,'close_review','',v) LIKE 'A chair who did not review%', 'P16 appeal decided by a chair');
  x := pcl_step('c2','t1',p,'close_review','Upheld',v);
  INSERT INTO rr VALUES ((SELECT state = 'not_validated' FROM pcl_packages WHERE id = p), 'P17 appeal decided');
  SELECT version INTO v FROM pcl_packages WHERE id = p;
  INSERT INTO rr VALUES (pcl_step('prog','t1',p,'appeal','Second attempt at the same appeal grounds',v) = 'This package was already appealed once.', 'P18 one appeal');
  -- happy path to recommendation
  r := pcl_submit('c1','t1','Writing badge','Writing Micro',rb,'Writing program evidence with mapped outcomes'); p2 := split_part(r,':',2)::bigint;
  PERFORM pcl_assign('m1','t1',p2,'rv1'); PERFORM pcl_assign('m1','t1',p2,'rv2');
  PERFORM pcl_review('rv1','t1',p2,4,true,'Clear evidence for each outcome'); PERFORM pcl_review('rv2','t1',p2,3,true,'Meets the standard with minor notes');
  SELECT version INTO v FROM pcl_packages WHERE id = p2;
  x := pcl_step('m1','t1',p2,'close_review','',v);
  SELECT version INTO v FROM pcl_packages WHERE id = p2;
  INSERT INTO rr VALUES (pcl_step('c1','t1',p2,'recommend','',v) = 'Another chair recommends your package.', 'P19 submitter-chair cannot recommend');
  INSERT INTO rr VALUES (pcl_step('m1','t1',p2,'recommend','',v) = 'Only a council chair recommends a credential.', 'P20 members cannot recommend');
  x := pcl_step('c2','t1',p2,'recommend','To registrar for award',v);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT state = 'recommended' FROM pcl_packages WHERE id = p2), 'P21 recommended');
  INSERT INTO rr VALUES (pcl_step('c2','t1',p2,'recommend','',v) LIKE 'This package changed%', 'P22 stale version');
  -- table guards
  got := false; BEGIN UPDATE pcl_rubrics SET adopted_by = author_id WHERE id = rb; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'P23 table refuses self-adoption');
  got := false; BEGIN DELETE FROM pcl_reviews; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'P24 reviews append-only');
  got := false; BEGIN INSERT INTO pcl_reviews VALUES (p2,'rv3',4,true,'Not assigned to this one'); EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'P25 table refuses unassigned review');
  SELECT string_agg(lbl, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...PCL_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('pcl_packages') AS t`)));
}
