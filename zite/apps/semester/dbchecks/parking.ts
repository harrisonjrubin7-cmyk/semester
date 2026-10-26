import { neon } from '@neondatabase/serverless';
import { PRK_MIGRATION } from '../src/lib/prkMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; z bigint; v1 bigint; v2 bigint; v3 bigint; p1 bigint; p2 bigint; p3 bigint; c1 bigint; c2 bigint; c3 bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  INSERT INTO rr VALUES (prk_set_staff('adm','t1','adm','staff') IS NOT NULL, 'F1 self-grant refused');
  PERFORM prk_set_staff('adm','t1','off','staff'); PERFORM prk_set_staff('adm','t1','off2','staff'); PERFORM prk_set_staff('adm','t1','adj','adjudicator');
  INSERT INTO rr VALUES (prk_zone('t1','s1',NULL,'Lot A',1,true) NOT LIKE 'ok:%', 'F2 students cannot make zones');
  r := prk_zone('t1','off',NULL,'Lot A',1,true); z := split_part(r,':',2)::bigint;
  r := prk_vehicle('t1','s1',NULL,'abc-123','TN','Blue Civic',true); v1 := NULLIF(split_part(r,':',2),'')::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%' AND (SELECT plate FROM prk_vehicles WHERE id = v1) = 'ABC123', 'F3 plate normalised');
  INSERT INTO rr VALUES (prk_vehicle('t1','s2',NULL,'ABC 123','TN','',true) LIKE 'That plate is already registered%', 'F4 one active owner per plate');
  r := prk_vehicle('t1','s2',NULL,'XYZ9','TN','',true); v2 := split_part(r,':',2)::bigint;
  r := prk_vehicle('t1','s3',NULL,'QQQ1','TN','',true); v3 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (prk_apply('t1','pk-0001','s1',z,v2,'Fall 2026',current_date,current_date+90) = 'Register the vehicle first.', 'F5 cannot use someone else''s vehicle');
  r := prk_apply('t1','pk-0001','s1',z,v1,'Fall 2026',current_date,current_date+90); p1 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (prk_apply('t1','pk-0001','s1',z,v1,'Fall 2026',current_date,current_date+90) = 'replay:' || p1, 'F6 replay');
  INSERT INTO rr VALUES (prk_apply('t1','pk-0009','s1',z,v1,'Fall 2026',current_date,current_date+90) LIKE 'You already have%', 'F7 one live permit per term');
  r := prk_apply('t1','pk-0002','s2',z,v2,'Fall 2026',current_date,current_date+90); p2 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (prk_pstep('t1',p1,'off','allocate',1,'') IS NULL, 'F8 allocate');
  INSERT INTO rr VALUES (prk_pstep('t1',p2,'off','allocate',1,'') LIKE 'This zone is full%', 'F9 capacity never exceeded');
  INSERT INTO rr VALUES (prk_pstep('t1',p2,'off','waitlist',1,'') IS NULL, 'F10 full zone waitlists');
  INSERT INTO rr VALUES (prk_pstep('t1',p1,'off','revoke',2,'') = 'Give a reason.', 'F11 revoke needs a reason');
  PERFORM prk_pstep('t1',p1,'s1','withdraw',2,'');
  INSERT INTO rr VALUES (prk_pstep('t1',p2,'off','allocate',2,'') IS NULL, 'F12 waitlisted allocated once space frees');
  INSERT INTO rr VALUES (prk_zone('t1','off',z,'Lot A',0,true) LIKE '%capacity cannot go below%', 'F13 capacity not below issued');
  PERFORM prk_set_staff('adm','t1','s3','staff');
  r := prk_apply('t1','pk-0003','s3',z,v3,'Fall 2026',current_date,current_date+90); p3 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (prk_pstep('t1',p3,'s3','waitlist',1,'') LIKE 'Another member%', 'F14 staff never decide their own permit');
  -- expired permits stop counting
  UPDATE prk_permits SET valid_to = current_date - 1, valid_from = current_date - 10 WHERE id = p2;
  INSERT INTO rr VALUES (prk_pstep('t1',p3,'off','allocate',1,'') IS NULL, 'F15 an expired permit frees its space');
  -- citations
  INSERT INTO rr VALUES (prk_cite('t1','ct-0001','s1','ABC123','TN',z,'No permit displayed',5000) NOT LIKE 'ok:%', 'F16 students cannot issue citations');
  r := prk_cite('t1','ct-0001','off','abc 123','TN',z,'No permit displayed',5000); c1 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES ((SELECT vehicle_id FROM prk_citations WHERE id = c1) = v1, 'F17 citation links to the registered vehicle');
  INSERT INTO rr VALUES (prk_cstep('t1',c1,'s2','appeal',1,'This was not my car at all, really',NULL,NULL,NULL) = 'Citation not found.', 'F18 a non-owner cannot see or appeal');
  INSERT INTO rr VALUES (prk_cstep('t1',c1,'s1','appeal',1,'short',NULL,NULL,NULL) LIKE 'Explain%', 'F19 appeal needs a reason');
  INSERT INTO rr VALUES (prk_cstep('t1',c1,'s1','appeal',1,'My permit was on the dashboard, photo attached',NULL,NULL,NULL) IS NULL, 'F20 owner appeals');
  INSERT INTO rr VALUES (prk_cstep('t1',c1,'s1','appeal',2,'Appealing a second time to be sure of it',NULL,NULL,NULL) LIKE '%already under appeal%', 'F21 appeal once');
  INSERT INTO rr VALUES (prk_cstep('t1',c1,'off','upheld',2,'Checked photos carefully',NULL,NULL,NULL) LIKE 'Only an appeal adjudicator%', 'F22 officers do not decide appeals');
  INSERT INTO rr VALUES (prk_cstep('t1',c1,'off','void',2,'Changed my mind',NULL,NULL,NULL) LIKE 'Only an unappealed%', 'F23 cannot void around an open appeal');
  INSERT INTO rr VALUES (prk_cstep('t1',c1,'adj','reduced',2,'Permit partly visible in photo',5000,NULL,NULL) LIKE 'A reduction%', 'F24 reduction must reduce');
  INSERT INTO rr VALUES (prk_cstep('t1',c1,'adj','reduced',2,'Permit partly visible in photo',2000,NULL,NULL) IS NULL AND true, 'F25 adjudicator reduces');
  -- an adjudicator who issued? kinds are exclusive, so simulate the table guard
  r := prk_cite('t1','ct-0002','off','QQQ1','TN',z,'Blocking a fire lane',8000); c2 := split_part(r,':',2)::bigint;
  got := false; BEGIN UPDATE prk_citations SET decided_by = issued_by WHERE id = c2; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F26 issuer can never be the decider (table)');
  got := false; BEGIN UPDATE prk_citations SET state = 'upheld', decided_by = 'adj' WHERE id = c2; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F27 no decision without an appeal (table)');
  -- plate correction
  r := prk_cite('t1','ct-0003','off','XYZ8','TN',z,'Expired meter',2500); c3 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES ((SELECT vehicle_id FROM prk_citations WHERE id = c3) IS NULL, 'F28a typo plate links to nobody');
  INSERT INTO rr VALUES (prk_cstep('t1',c3,'off2','correct_plate',1,'Typo at kerbside',NULL,'XYZ9','TN') IS NULL AND true, 'F28b plate corrected with reason');
  INSERT INTO rr VALUES ((SELECT vehicle_id FROM prk_citations WHERE id = c3) = v2 AND EXISTS (SELECT 1 FROM prk_events WHERE subject = 'citation' AND subject_id = c3 AND note LIKE 'XYZ8 -> XYZ9%'), 'F28c relinked and logged');
  UPDATE prk_citations SET issued_at = now() - interval '22 days' WHERE id = c3;
  INSERT INTO rr VALUES (prk_cstep('t1',c3,'s2','appeal',2,'This is late but please consider it',NULL,NULL,NULL) LIKE 'Appeals must be made within%', 'F29 21-day appeal window');
  INSERT INTO rr VALUES (prk_cstep('t2',c1,'adj','upheld',3,'Other tenant tries this',NULL,NULL,NULL) = 'Citation not found.', 'F30 other tenant cannot touch it');
  got := false; BEGIN DELETE FROM prk_events; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'F31 history append-only');
  PERFORM prk_set_staff('adm','t1','off',NULL);
  INSERT INTO rr VALUES (prk_cite('t1','ct-0004','off','ABC123','TN',z,'After revoke attempt',1000) NOT LIKE 'ok:%', 'F32 revoked officer cannot cite');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...PRK_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('no RESULT raised'); }
  catch (e) { const x = e as any; console.log(String(x.message).slice(0, 900), x.position ?? '', x.where ?? ''); }
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('prk_zones') AS t`)));
}
