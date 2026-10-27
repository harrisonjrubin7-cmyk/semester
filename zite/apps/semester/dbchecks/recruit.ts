import { neon } from '@neondatabase/serverless';
import { RCR_MIGRATION } from '../src/lib/rcrMigration';

const T1 = 'Assistant registrar, 1.0 FTE, start 1 January, salary band B as published.';
const T2 = 'Assistant registrar, 1.0 FTE, start 15 January, salary band B as published.';
export const CHECKS = `DO $$
DECLARE r text; x text; q bigint; a1 bigint; a2 bigint; o1 bigint; o2 bigint; v int; h text; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  INSERT INTO rr VALUES (rcr_set_staff('adm','t1','adm','hiring',true) IS NOT NULL, 'F1 no self-grant');
  PERFORM rcr_set_staff('adm','t1','hire','hiring',true); PERFORM rcr_set_staff('adm','t1','hire2','hiring',true); PERFORM rcr_set_staff('adm','t1','appt','appointment',true);
  r := rcr_requisition('hire','t1','Assistant registrar','','Backlog of transcript requests','REG-2'); q := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (rcr_req_step('hire','t1',q,'approve','',1) LIKE 'A different hiring authority%', 'F2 requester cannot approve');
  PERFORM rcr_req_step('hire2','t1',q,'approve','',1);
  INSERT INTO rr VALUES (rcr_req_step('hire2','t1',q,'publish','',2) = 'Name a committee chair first.', 'F3 no publish without a chair');
  PERFORM rcr_committee_set('hire','t1',q,'c1',true,true); PERFORM rcr_committee_set('hire','t1',q,'c2',false,true); PERFORM rcr_committee_set('hire','t1',q,'c3',false,true);
  PERFORM rcr_req_step('hire2','t1',q,'publish','',2);
  INSERT INTO rr VALUES (rcr_apply('c2',q,'I would like to apply to this search please.') LIKE 'Committee members cannot apply%', 'F4 committee cannot apply');
  r := rcr_apply('ann',q,'Five years in a registrar office, transcript automation.'); a1 := split_part(r,':',2)::bigint;
  r := rcr_apply('bob',q,'Three years records experience and a records degree.'); a2 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (rcr_apply('ann',q,'Applying a second time with a new statement.') = 'You have already applied.', 'F5 one application each');
  -- recusal
  PERFORM rcr_conflict('c2',a1,'Former direct report');
  INSERT INTO rr VALUES (rcr_evaluate('c2',a1,5,'Strong candidate overall') = 'You are recused from this applicant.', 'F6 recused member cannot evaluate');
  INSERT INTO rr VALUES (rcr_evaluate('c2',a2,3,'Solid but less experience') IS NULL, 'F7 recusal is per applicant');
  PERFORM rcr_reference('c1','t1',a1,'Dr. Lee','Ann ran our transcript office reliably for five years.');
  INSERT INTO rr VALUES (rcr_reference('c2','t1',a1,'Someone','Trying to add a reference while recused') LIKE 'Only the chair%', 'F8 members do not file references');
  INSERT INTO rr VALUES (rcr_evaluate('outsider',a1,5,'Not on the committee at all') = 'Only committee members evaluate.', 'F9 only committee evaluates');
  PERFORM rcr_evaluate('c1',a1,5,'Excellent fit and references');
  SELECT version INTO v FROM rcr_requisitions WHERE id = q;
  INSERT INTO rr VALUES (rcr_select('c1','t1',q,a1,'propose',v) LIKE 'At least two committee members%', 'F10 recused evaluation never counts; needs two');
  PERFORM rcr_evaluate('c3',a1,4,'Good fit, strong references');
  INSERT INTO rr VALUES (rcr_select('c3','t1',q,a1,'propose',v) LIKE 'The committee chair proposes%', 'F11 only the chair proposes');
  PERFORM rcr_select('c1','t1',q,a1,'propose',v);
  SELECT version INTO v FROM rcr_requisitions WHERE id = q;
  INSERT INTO rr VALUES (rcr_select('c1','t1',q,NULL,'approve',v) LIKE 'Only a hiring authority%', 'F12 chair cannot approve own selection');
  PERFORM rcr_select('hire','t1',q,NULL,'approve',v);
  -- offer pinned to version
  r := rcr_offer_draft('c1','t1',q,'${T1}'); o1 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (rcr_offer_approve('hire','t1',o1,(SELECT sha256 FROM rcr_offers WHERE id = o1)) LIKE 'Only an appointment authority%', 'F13 only appointment authority approves offers');
  PERFORM rcr_offer_approve('appt','t1',o1,(SELECT sha256 FROM rcr_offers WHERE id = o1));
  r := rcr_offer_draft('hire','t1',q,'${T2}'); o2 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES ((SELECT state = 'superseded' FROM rcr_offers WHERE id = o1) AND (SELECT state = 'draft' FROM rcr_offers WHERE id = o2), 'F14 editing the offer supersedes the approved version');
  INSERT INTO rr VALUES (rcr_offer_respond('ann',o1,(SELECT sha256 FROM rcr_offers WHERE id = o1),true) = 'This offer is not open for a response.', 'F15 superseded offer cannot be accepted');
  INSERT INTO rr VALUES (rcr_offer_respond('ann',o2,(SELECT sha256 FROM rcr_offers WHERE id = o2),true) = 'This offer is not open for a response.', 'F16 unapproved version cannot be accepted');
  PERFORM rcr_offer_approve('appt','t1',o2,(SELECT sha256 FROM rcr_offers WHERE id = o2));
  INSERT INTO rr VALUES (rcr_offer_respond('ann',o2,(SELECT sha256 FROM rcr_offers WHERE id = o1),true) LIKE 'The offer changed%', 'F17 acceptance tied to the exact version');
  INSERT INTO rr VALUES (rcr_offer_respond('bob',o2,(SELECT sha256 FROM rcr_offers WHERE id = o2),true) = 'Offer not found.', 'F18 only the selected applicant responds');
  x := rcr_offer_respond('ann',o2,(SELECT sha256 FROM rcr_offers WHERE id = o2),true);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT state = 'filled' FROM rcr_requisitions WHERE id = q) AND (SELECT state = 'declined' FROM rcr_applications WHERE id = a2), 'F19 accepted: filled, others declined, history kept');
  -- table guards
  got := false; BEGIN UPDATE rcr_offers SET approved_by = drafted_by WHERE id = o1; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F20 table refuses drafter approving');
  got := false; BEGIN DELETE FROM rcr_references; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F21 references append-only');
  got := false; BEGIN DELETE FROM rcr_conflicts; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F22 recusals cannot be erased');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...RCR_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('rcr_requisitions') AS t`)));
}
