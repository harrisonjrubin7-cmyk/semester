import { neon } from '@neondatabase/serverless';
import { AUD_MIGRATION } from '../src/lib/audMigration';

const H1 = 'a'.repeat(64), H2 = 'b'.repeat(64);
export const CHECKS = `DO $$
DECLARE r text; x text; g bigint; g2 bigint; pl bigint; c bigint; e1 bigint; e2 bigint; e3 bigint; f bigint; f2 bigint; v int; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  -- grants
  INSERT INTO rr VALUES (aud_grant('adm','t1','adm','Annual cash controls review',ARRAY['finance'],60) LIKE 'Ask another administrator%', 'F1 no self-grant');
  INSERT INTO rr VALUES (aud_grant('adm','t1','aud','Annual cash controls review',ARRAY['finance'],365) LIKE 'Audit access lasts%', 'F2 term bounded');
  INSERT INTO rr VALUES (aud_grant('adm','t1','aud','Annual cash controls review',ARRAY['everything'],60) LIKE 'Choose the areas%', 'F3 no read-all area');
  INSERT INTO rr VALUES (aud_grant('adm','t1','aud','audit',ARRAY['finance'],60) LIKE 'State the purpose%', 'F4 purpose required');
  r := aud_grant('adm','t1','aud','Annual cash controls review',ARRAY['finance'],60); g := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%' AND aud_live('t1','aud','finance'), 'F5 grant live');
  INSERT INTO rr VALUES (NOT aud_live('t1','aud','registrar') AND NOT aud_live('t2','aud','finance'), 'F6 grant limited to its areas and tenant');
  r := aud_grant('adm','t1','aud2','Independent verification of cash findings',ARRAY['finance'],30); g2 := split_part(r,':',2)::bigint;
  -- controls and plans
  INSERT INTO rr VALUES (aud_control('nobody','t1','FIN-1','finance','Bank reconciliations reviewed','') LIKE 'You need live audit access%', 'F7 no control without a grant');
  r := aud_control('aud','t1','FIN-1','finance','Bank reconciliations reviewed monthly','Each account reconciled and reviewed'); c := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'F8 control defined');
  INSERT INTO rr VALUES (aud_plan('aud2','t1',g,'finance','Cash review','') LIKE 'Plans are opened under your own%', 'F9 plan only under own grant');
  INSERT INTO rr VALUES (aud_plan('aud','t1',g,'registrar','Grades review','') LIKE 'Your grant does not cover%', 'F10 plan only in granted area');
  r := aud_plan('aud','t1',g,'finance','FY26 cash controls','Bank accounts and petty cash'); pl := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'F11 plan opened');
  -- evidence
  INSERT INTO rr VALUES (aud_evidence_add('outsider','t1',pl,'s3://evidence/bank-rec-sep.pdf','${H1}','','k1') LIKE 'You need live%', 'F12 no evidence without access');
  INSERT INTO rr VALUES (aud_evidence_add('aud','t1',pl,'s3://evidence/bank-rec-sep.pdf','NOTAHASH','','k1') LIKE 'Record the SHA-256%', 'F13 hash required');
  r := aud_evidence_add('aud','t1',pl,'s3://evidence/bank-rec-sep.pdf','${H1}','September reconciliation','k1'); e1 := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (aud_evidence_add('aud','t1',pl,'s3://evidence/bank-rec-sep.pdf','${H1}','','k1') = 'replay:' || e1, 'F14 same request replays');
  INSERT INTO rr VALUES (aud_evidence_add('aud','t1',pl,'s3://evidence/other.pdf','${H2}','','k1') LIKE 'That request was already used%', 'F15 changed input on same key conflicts');
  INSERT INTO rr VALUES (aud_reproduce('aud2','t1',e1,'${H1}') = 'match', 'F16 reproducible by another auditor');
  x := aud_reproduce('aud2','t1',e1,'${H2}');
  INSERT INTO rr VALUES (x = 'mismatch' AND EXISTS (SELECT 1 FROM aud_events WHERE subject = 'evidence' AND ref = e1 AND step = 'tamper_suspected'), 'F17 mismatch logged as tamper suspected');
  got := false; BEGIN UPDATE aud_evidence SET sha256 = '${H2}' WHERE id = e1; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F18 evidence immutable');
  -- tests
  INSERT INTO rr VALUES (aud_test('aud','t1',pl,c,ARRAY[e1],25,'pass','') LIKE 'Tests are recorded during fieldwork%', 'F19 tests only in fieldwork');
  PERFORM aud_plan_step('aud','t1',pl,'fieldwork',1);
  INSERT INTO rr VALUES (aud_test('aud','t1',pl,c,ARRAY[e1, 999999],25,'pass','') LIKE 'Cite evidence collected for this plan%', 'F20 tests cite only this plan''s evidence');
  INSERT INTO rr VALUES (aud_test('aud','t1',pl,c,ARRAY[e1],25,'fail','3 of 25 unreviewed') LIKE 'ok:%', 'F21 test recorded');
  -- findings
  INSERT INTO rr VALUES (aud_issue('aud','t1',pl,c,'high','Reconciliations not reviewed','','aud',NULL,'f1') LIKE 'Issue the finding to a management owner%', 'F22 no self-owned finding');
  r := aud_issue('aud','t1',pl,c,'high','Reconciliations not reviewed','3 of 25 months','mgr',current_date+30,'f1'); f := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'F23 finding issued');
  INSERT INTO rr VALUES (aud_finding_step('aud','t1',f,'respond','We agree',NULL,1) LIKE 'Only the management owner responds%', 'F24 only owner responds');
  INSERT INTO rr VALUES (aud_finding_step('mgr','t1',f,'remediate','Fixed it',NULL,1) LIKE 'Record a management response first%', 'F25 no remediation before response');
  INSERT INTO rr VALUES (aud_finding_step('mgr','t1',f,'respond','We agree and will add a reviewer',NULL,1) IS NULL, 'F26 owner responds');
  INSERT INTO rr VALUES (aud_finding_step('mgr','t1',f,'remediate','Second reviewer added',NULL,1) LIKE 'This finding changed%', 'F27 stale version refused');
  PERFORM aud_finding_step('mgr','t1',f,'remediate','Second reviewer added to every reconciliation',NULL,2);
  INSERT INTO rr VALUES (aud_finding_step('mgr','t1',f,'verify_accept','',e1,3) LIKE 'You need live audit access%', 'F28 owner cannot verify');
  INSERT INTO rr VALUES (aud_finding_step('aud2','t1',f,'verify_accept','',e1,3) LIKE 'Cite evidence from this plan collected after%', 'F29 old evidence cannot close');
  r := aud_evidence_add('aud2','t1',pl,'s3://evidence/bank-rec-oct.pdf','${H2}','October, reviewed twice','k2'); e2 := split_part(r,':',2)::bigint;
  -- revoked auditor loses access
  PERFORM aud_revoke('adm','t1',g2);
  INSERT INTO rr VALUES (NOT aud_live('t1','aud2','finance') AND aud_finding_step('aud2','t1',f,'verify_accept','',e2,3) = 'Finding not found.', 'F30 revoked auditor locked out');
  INSERT INTO rr VALUES (aud_reproduce('aud2','t1',e1,'${H1}') LIKE 'You need live%', 'F31 revoked auditor cannot read evidence');
  INSERT INTO rr VALUES (aud_finding_step('aud','t1',f,'verify_accept','',e2,3) IS NULL, 'F32 independent auditor closes with fresh evidence');
  INSERT INTO rr VALUES ((SELECT state = 'closed' AND verified_by = 'aud' AND verify_evidence_id = e2 FROM aud_findings WHERE id = f), 'F33 closure recorded');
  -- table guards
  r := aud_issue('aud','t1',pl,NULL,'low','Petty cash log incomplete','','mgr',NULL,'f2'); f2 := split_part(r,':',2)::bigint;
  got := false; BEGIN UPDATE aud_findings SET state = 'closed', response = 'x', remediated_by = 'mgr', remediated_at = now(), verified_by = 'mgr', verify_evidence_id = e2 WHERE id = f2; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F34 table refuses owner self-verification');
  got := false; BEGIN INSERT INTO aud_grants (tenant_id, auditor_id, purpose, areas, granted_by, expires_at) VALUES ('t1','x','Self granted access','{finance}','x',now()+interval '1 day'); EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F35 table refuses self-grant');
  got := false; BEGIN INSERT INTO aud_grants (tenant_id, auditor_id, purpose, areas, granted_by, expires_at) VALUES ('t1','x','Long running access','{finance}','adm',now()+interval '400 days'); EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F36 table refuses unbounded grants');
  SELECT version INTO v FROM aud_plans WHERE id = pl; PERFORM aud_plan_step('aud','t1',pl,'reporting',v);
  SELECT version INTO v FROM aud_plans WHERE id = pl;
  INSERT INTO rr VALUES (aud_plan_step('aud','t1',pl,'closed',v) LIKE 'Every finding needs a management response%', 'F37 plan closes only after responses');
  got := false; BEGIN DELETE FROM aud_events; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F38 history append-only');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...AUD_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('aud_grants') AS t`)));
}
