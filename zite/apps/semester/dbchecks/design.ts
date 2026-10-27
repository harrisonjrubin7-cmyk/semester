import { neon } from '@neondatabase/serverless';
import { CRS_MIGRATION } from '../src/lib/crsMigration';
import { IDN_MIGRATION } from '../src/lib/idnMigration';

const B1 = 'Week 1: Introduction to the course, expectations and the first reading.';
const B2 = 'Week 1: Introduction, expectations, first reading and a short practice quiz.';
const B3 = 'Week 1 rewritten after release; should never reach students without approval.';
export const CHECKS = `DO $$
DECLARE r text; x text; q bigint; q2 bigint; d1 bigint; d2 bigint; d3 bigint; d4 bigint; v int; h text; got boolean; pub text; n int;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  INSERT INTO rr VALUES (idn_set_designer('adm','t1','adm',true) IS NOT NULL, 'F1 no self-grant');
  PERFORM idn_set_designer('adm','t1','des',true); PERFORM idn_set_designer('adm','t1','des2',true);
  INSERT INTO rr VALUES (idn_request('stu','t1','sec1','new','Build week one module',false) LIKE 'Only an instructor%', 'F2 only instructors request');
  r := idn_request('prof','t1','sec1','new','Build week one module with a quiz',true); q := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (idn_save_draft('des','t1',q,'${B1}','',false) LIKE 'Only the instructor or the assigned designer%', 'F3 unassigned designer cannot edit');
  INSERT INTO rr VALUES (idn_claim('prof','t1',q,1) LIKE 'Only an instructional designer%', 'F4 only designers claim');
  PERFORM idn_claim('des','t1',q,1);
  PERFORM idn_objective('des','t1',q,'lo1','Explain the course structure and expectations','understand','Quiz Q1',false);
  r := idn_save_draft('des','t1',q,'${B1}','first',false); d1 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (idn_review('des','t1',q,d1,'quality',true,'',0) LIKE 'Someone other than the draft%', 'F5 author cannot review own draft');
  INSERT INTO rr VALUES (idn_review('des2','t1',q,d1,'accessibility',true,'',2) LIKE 'The automated accessibility check found errors%', 'F6 accessibility cannot pass with automated errors');
  PERFORM idn_review('des2','t1',q,d1,'accessibility',true,'',0);
  SELECT version INTO v FROM idn_requests WHERE id = q; SELECT sha256 INTO h FROM idn_drafts WHERE id = d1;
  INSERT INTO rr VALUES (idn_approve('prof','t1',q,d1,h,true,v) LIKE 'This draft needs passing accessibility and quality%', 'F7 approval needs both reviews');
  PERFORM idn_review('des2','t1',q,d1,'quality',false,'Quiz missing',0);
  r := idn_save_draft('des','t1',q,'${B2}','added quiz',false); d2 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (idn_review('des2','t1',q,d1,'quality',true,'',0) = 'Review the latest draft.', 'F8 reviews apply to the latest draft only');
  PERFORM idn_review('des2','t1',q,d2,'accessibility',true,'',0); PERFORM idn_review('des2','t1',q,d2,'quality',true,'',0);
  SELECT version INTO v FROM idn_requests WHERE id = q; SELECT sha256 INTO h FROM idn_drafts WHERE id = d2;
  INSERT INTO rr VALUES (idn_approve('des','t1',q,d2,h,false,v) LIKE 'Only an instructor%', 'F9 designers do not approve publication');
  INSERT INTO rr VALUES (idn_approve('prof','t1',q,d2,repeat('0',64),true,v) LIKE 'The draft you reviewed is not the one on file%', 'F10 approval pinned to the exact content');
  PERFORM idn_approve('prof','t1',q,d2,h,true,v);
  -- editing after approval voids it
  r := idn_save_draft('des','t1',q,'${B3}','late change',false); d3 := split_part(r,':',2)::bigint;
  SELECT version INTO v FROM idn_requests WHERE id = q;
  INSERT INTO rr VALUES ((SELECT state = 'building' AND approved_draft_id IS NULL FROM idn_requests WHERE id = q), 'F11 a newer draft voids the approval');
  INSERT INTO rr VALUES (idn_release('prof','t1',q,true,'',0,v) = 'Approve the latest draft first.', 'F12 cannot release unapproved content');
  INSERT INTO rr VALUES (NOT EXISTS (SELECT 1 FROM crs_syllabus_versions WHERE section_id = 'sec1'), 'F13 nothing published yet');
  -- re-review and approve d3, then release
  PERFORM idn_review('des2','t1',q,d3,'accessibility',true,'',0); PERFORM idn_review('des2','t1',q,d3,'quality',true,'',0);
  SELECT version INTO v FROM idn_requests WHERE id = q; SELECT sha256 INTO h FROM idn_drafts WHERE id = d3;
  PERFORM idn_approve('prof','t1',q,d3,h,true,v);
  SELECT version INTO v FROM idn_requests WHERE id = q;
  INSERT INTO rr VALUES (idn_release('des','t1',q,false,'',0,v) LIKE 'Only an instructor%', 'F14 only instructors publish');
  x := idn_release('prof','t1',q,true,'',0,v);
  SELECT body INTO pub FROM crs_syllabus_versions WHERE section_id = 'sec1' AND version = 1;
  INSERT INTO rr VALUES (x IS NULL AND pub = '${B3}', 'F15 release publishes exactly the approved draft into Course Studio: ' || coalesce(x,''));
  -- editing a finished request is refused; published copy unchanged
  INSERT INTO rr VALUES (idn_save_draft('des','t1',q,'Silent edit after release attempt','',false) LIKE 'This request is finished%', 'F16 released request cannot be edited');
  -- revision: new request, impact required, history preserved
  r := idn_request('prof','t1','sec1','revision','Fix week one reading list',true); q2 := split_part(r,':',2)::bigint;
  PERFORM idn_claim('des2','t1',q2,1);
  r := idn_save_draft('des2','t1',q2,'${B2}','revert reading',false); d4 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES ((SELECT body FROM crs_syllabus_versions WHERE section_id = 'sec1' AND version = 1) = '${B3}' AND (SELECT count(*) FROM crs_syllabus_versions WHERE section_id = 'sec1') = 1, 'F17 drafting a revision leaves published material untouched');
  PERFORM idn_review('des','t1',q2,d4,'accessibility',true,'',0); PERFORM idn_review('des','t1',q2,d4,'quality',true,'',0);
  SELECT version INTO v FROM idn_requests WHERE id = q2; SELECT sha256 INTO h FROM idn_drafts WHERE id = d4;
  PERFORM idn_approve('prof','t1',q2,d4,h,true,v);
  SELECT version INTO v FROM idn_requests WHERE id = q2;
  INSERT INTO rr VALUES (idn_release('prof','t1',q2,true,'',1,v) LIKE 'Describe the impact%', 'F18 revisions need an impact note');
  INSERT INTO rr VALUES (idn_release('prof','t1',q2,true,'Two students already read the old list; notified',0,v) LIKE 'Someone published a newer syllabus%', 'F19 stale published version refused');
  x := idn_release('prof','t1',q2,true,'Two students already read the old list; notified',1,v);
  SELECT count(*) INTO n FROM crs_syllabus_versions WHERE section_id = 'sec1';
  INSERT INTO rr VALUES (x IS NULL AND n = 2 AND (SELECT body FROM crs_syllabus_versions WHERE section_id = 'sec1' AND version = 1) = '${B3}', 'F20 new version released, history kept');
  got := false; BEGIN UPDATE idn_drafts SET body = 'tampered body for the check' WHERE id = d2; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F21 drafts append-only');
  got := false; BEGIN INSERT INTO idn_requests (tenant_id, section_id, kind, scope, requested_by, state) VALUES ('t1','sec9','new','Scope long enough here','p','approved'); EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F22 table refuses approval without a pinned draft');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...CRS_MIGRATION, ...IDN_MIGRATION].map((q) => sql.query(q)).concat([sql.query(CHECKS)])); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('idn_requests') AS t`)));
}
