import { neon } from '@neondatabase/serverless';
import { IDC_MIGRATION } from '../src/lib/idcMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; zo bigint; zr bigint; c1 bigint; c2 bigint; g1 bigint; g2 bigint; g3 bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  INSERT INTO rr VALUES (idc_set_staff('adm','t1','adm','officer') IS NOT NULL, 'F1 self-grant refused');
  PERFORM idc_set_staff('adm','t1','off','officer'); PERFORM idc_set_staff('adm','t1','off2','officer'); PERFORM idc_set_staff('adm','t1','sec','security');
  INSERT INTO rr VALUES (idc_zone('t1','off','Server room',true) = 'Only security staff mark a zone restricted.', 'F2 only security marks restricted');
  r := idc_zone('t1','off','Library',false); zo := split_part(r,':',2)::bigint;
  r := idc_zone('t1','sec','Server room',true); zr := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (idc_issue('t1','ic-0001','off','s1','6011000990139424','student','Enrolment verified',NULL,NULL) LIKE 'Use the card office reference%', 'F3 raw card number refused');
  r := idc_issue('t1','ic-0001','off','s1','VU-2026-0001','student','Enrolment verified in SIS',NULL,NULL); c1 := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'F4 issue');
  INSERT INTO rr VALUES (idc_issue('t1','ic-0001','off','s1','VU-2026-0001','student','Enrolment verified in SIS',NULL,NULL) = 'replay:' || c1, 'F5 replay');
  INSERT INTO rr VALUES (idc_issue('t1','ic-0002','off','s1','VU-2026-0002','student','Enrolment verified in SIS',NULL,NULL) = 'This person already has a card.', 'F6 one live card per person');
  INSERT INTO rr VALUES (idc_issue('t1','ic-0003','off','off','VU-2026-0003','staff','HR record checked',NULL,NULL) LIKE 'Another officer%', 'F7 officers do not issue their own card');
  -- grants
  r := idc_request_grant('t1','s1',c1,zo,'Study late in the library'); g1 := NULLIF(split_part(r,':',2),'')::bigint;
  r := idc_request_grant('t1','s1',c1,zr,'Research project needs rack access'); g2 := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (idc_request_grant('t1','s2',c1,zo,'Not my card at all') = 'Card not found.', 'F8 others cannot request on my card');
  INSERT INTO rr VALUES (idc_grant_step('t1','off',g2,'approve',1,NULL) = 'Restricted zones are approved by security staff.', 'F9 restricted needs security');
  INSERT INTO rr VALUES (idc_grant_step('t1','off',g1,'approve',1,NULL) IS NULL, 'F10a officer approves open zone');
  INSERT INTO rr VALUES ((SELECT state FROM idc_grants WHERE id = g1) = 'provision_requested', 'F10b approval only requests provisioning');
  INSERT INTO rr VALUES (idc_grant_step('t1','sec',g1,'confirm',2,'DOOR-778') LIKE 'Only the card office%', 'F11 security cannot record a confirmation');
  INSERT INTO rr VALUES (idc_grant_step('t1','off',g1,'confirm',2,'') LIKE 'Enter the door system%', 'F12 confirmation needs a reference');
  INSERT INTO rr VALUES (idc_grant_step('t1','off',g1,'confirm',2,'DOOR-778') IS NULL, 'F13a confirm');
  INSERT INTO rr VALUES ((SELECT state FROM idc_grants WHERE id = g1) = 'active', 'F13b active only after confirmation');
  INSERT INTO rr VALUES (idc_grant_step('t1','sec',g2,'approve',1,NULL) IS NULL, 'F14 security approves restricted');
  r := idc_request_grant('t1','sec',c1,(SELECT id FROM idc_zones WHERE name = 'Library'),'dup'); 
  INSERT INTO rr VALUES (r LIKE 'This card already has%', 'F15 no duplicate live grant');
  -- lost card
  INSERT INTO rr VALUES (idc_card_step('t1','s1',c1,'revoke',1,'Lost on campus',NULL) IS NULL, 'F16a holder reports lost');
  INSERT INTO rr VALUES ((SELECT count(*) FROM idc_grants WHERE card_id = c1 AND state = 'revoke_requested') = 2, 'F16b all access asked to be removed');
  INSERT INTO rr VALUES (idc_issue('t1','ic-0004','off','s1','VU-2026-0004','student','Replacement, ID shown at desk',NULL,c1) LIKE 'Confirm the old card%', 'F17 no replacement before confirmed revocation');
  INSERT INTO rr VALUES (idc_card_step('t1','off',c1,'confirm_revoke',2,'','CARDSYS-91') IS NULL, 'F18a card revocation confirmed');
  INSERT INTO rr VALUES (idc_issue('t1','ic-0004','off','s1','VU-2026-0004','student','Replacement, ID shown at desk',NULL,c1) LIKE 'Some door access%', 'F18b grants still unconfirmed block replacement');
  PERFORM idc_grant_step('t1','off',g1,'confirm',4,'DOOR-779'); PERFORM idc_grant_step('t1','off',g2,'confirm',3,'DOOR-780');
  r := idc_issue('t1','ic-0004','off','s1','VU-2026-0004','student','Replacement, ID shown at desk',NULL,c1); c2 := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'F19 replacement after everything confirmed ' || r);
  -- table guards
  got := false; BEGIN UPDATE idc_cards SET card_ref = '4111111111111111' WHERE id = c2; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F20 no card number can be stored (table)');
  r := idc_request_grant('t1','s1',c2,zo,'Library again on new card'); g3 := NULLIF(split_part(r,':',2),'')::bigint;
  got := false; BEGIN UPDATE idc_grants SET state = 'active', approved_by = 'off' WHERE id = g3; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F21 active without a confirmation is refused (table)');
  got := false; BEGIN UPDATE idc_grants SET approved_by = requested_by, state = 'provision_requested' WHERE id = g3; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F22 requester never approves (table)');
  INSERT INTO rr VALUES (idc_card_step('t2','off',c2,'revoke',1,'Other tenant tries',NULL) = 'Card not found.' OR idc_card_step('t2','off',c2,'revoke',1,'x',NULL) IS NOT NULL, 'F23 other tenant');
  got := false; BEGIN DELETE FROM idc_events; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F24 history append-only');
  PERFORM idc_set_staff('adm','t1','off',NULL);
  INSERT INTO rr VALUES (idc_grant_step('t1','off',g3,'approve',1,NULL) = 'Access request not found.', 'F25 revoked officer loses access');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...IDC_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('idc_cards') AS t`)));
}
