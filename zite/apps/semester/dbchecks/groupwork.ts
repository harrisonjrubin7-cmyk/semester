import { neon } from '@neondatabase/serverless';
import { GRP_MIGRATION } from '../src/lib/grpMigration';
import { GWK_MIGRATION } from '../src/lib/gwkMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; st bigint; g1 bigint; g2 bigint; o st%TYPE; p bigint; got boolean; n int;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO grp_sets (tenant_id, section_id, name, max_size, created_by) VALUES ('t1','sec1','Project teams',4,'in1') RETURNING id INTO st;
  INSERT INTO grp_groups (set_id, name) VALUES (st,'Team 1') RETURNING id INTO g1;
  INSERT INTO grp_groups (set_id, name) VALUES (st,'Team 2') RETURNING id INTO g2;
  INSERT INTO grp_members (set_id, group_id, student_id, added_by) VALUES (st,g1,'s1','in1'), (st,g1,'s2','in1'), (st,g2,'s3','in1');
  r := gwk_save('s1','t1',g1,NULL,'Literature review','s2','To do','2026-11-20','',0); p := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%:1', 'W1 a member adds a part for a groupmate');
  INSERT INTO rr VALUES (gwk_save('s3','t1',g1,NULL,'Sneak in','s3','To do',NULL,'',0) LIKE 'Only members%', 'W2 a student in another group cannot add');
  INSERT INTO rr VALUES (gwk_save('in1','t1',g1,p,'Edit','s2','Done',NULL,'',1) LIKE 'Only members%', 'W3 the instructor cannot edit parts');
  INSERT INTO rr VALUES (gwk_save('s1','t1',g1,NULL,'Give away','s3','To do',NULL,'',0) LIKE 'A part can only be given%', 'W4 cannot assign to someone outside the group');
  INSERT INTO rr VALUES (gwk_save('s1','t2',g1,NULL,'Other tenant','s2','To do',NULL,'',0) LIKE 'Only members%', 'W5 another tenant cannot use the group');
  INSERT INTO rr VALUES (gwk_save('s2','t1',g1,p,'Literature review','s2','Done',NULL,'',9) LIKE 'Someone in your group changed%', 'W6 stale version refused');
  r := gwk_save('s2','t1',g1,p,'Literature review','s2','In progress','2026-11-20','',1);
  INSERT INTO rr VALUES (r = 'ok:' || p || ':2' AND (SELECT status = 'In progress' AND updated_by = 's2' FROM gwk_parts WHERE id = p), 'W7 another member updates the status');
  INSERT INTO rr VALUES ((SELECT count(*) = 2 FROM gwk_log WHERE part_id = p) AND EXISTS (SELECT 1 FROM gwk_log WHERE part_id = p AND what LIKE '%status To do → In progress%'), 'W8 every change is logged with what changed');
  INSERT INTO rr VALUES (gwk_save('s1','t1',g1,p,'Literature review','s2','Finished',NULL,'',2) = 'Unknown status.', 'W9 unknown status refused');
  INSERT INTO rr VALUES (gwk_delete('s2','t1',g1,p) LIKE 'Only the person who added%', 'W10 only the creator removes a part');
  INSERT INTO rr VALUES (gwk_delete('s3','t1',g1,p) LIKE 'Only members%', 'W11 a non-member cannot remove');
  r := gwk_delete('s1','t1',g1,p);
  INSERT INTO rr VALUES (r IS NULL AND NOT EXISTS (SELECT 1 FROM gwk_parts WHERE id = p) AND EXISTS (SELECT 1 FROM gwk_log WHERE part_id = p AND what LIKE 'removed%'), 'W12 creator removes; the removal is logged');
  INSERT INTO rr VALUES (gwk_can_read('s1','t1',g1,false) AND gwk_can_read('in1','t1',g1,true) AND NOT gwk_can_read('s3','t1',g1,false), 'W13 members and instructors read; other students do not');
  got := false; BEGIN UPDATE gwk_log SET what = 'x' WHERE group_id = g1; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'W14 the log cannot be edited');
  got := false; BEGIN DELETE FROM gwk_log WHERE group_id = g1; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'W15 the log cannot be deleted');
  SELECT string_agg(lbl, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => {
    try { await sql.transaction([...GRP_MIGRATION.map((q) => sql.query(q)), ...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); }
    catch (e) { const x = e as any; console.log(label, String(x.message).slice(0, 500), x.where ?? ''); }
  };
  await go('real:', GWK_MIGRATION);
  await go('mutant membership-ignores-tenant (W5):', GWK_MIGRATION.map((q) => q.replace(' AND s.tenant_id = p_tenant', () => '')));
  await go('mutant owner-not-checked (W4):', GWK_MIGRATION.map((q) => q.replace(`IF p_owner IS NOT NULL AND NOT gwk_is_member(p_tenant, p_group, p_owner) THEN RETURN 'A part can only be given to someone in the group.'; END IF;`, () => '')));
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('gwk_parts') AS t, to_regclass('grp_sets') AS g`)));
}
