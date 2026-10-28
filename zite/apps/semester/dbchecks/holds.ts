import { neon } from '@neondatabase/serverless';
import { HLD_MIGRATION } from '../src/lib/hldMigration';

export const CHECKS = `DO $$
DECLARE r text; x text; y text; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO rr VALUES (hld_claim('stu1','t1','h1','stu1','Registrar','paid in full') LIKE 'This hold is on your own record%', 'H1 a student cannot lift their own hold');
  INSERT INTO rr VALUES (hld_claim('reg1','t1','h1','stu1','Registrar','no') LIKE 'Give a reason%', 'H2 a release needs a reason');
  r := hld_claim('reg1','t1','h1','stu1','Registrar','documents received');
  INSERT INTO rr VALUES (r = 'ok:new', 'H3 the first release claims the hold ' || coalesce(r,''));
  x := hld_claim('reg2','t1','h1','stu1','Registrar','also received');
  INSERT INTO rr VALUES (x = 'This hold has already been lifted.', 'H4 a second person cannot release it again ' || coalesce(x,''));
  INSERT INTO rr VALUES ((SELECT count(*) FROM hld_releases WHERE hold_id = 'h1') = 1, 'H5 one release row per hold');
  y := hld_claim('reg1','t1','h1','stu1','Registrar','documents received');
  INSERT INTO rr VALUES (y = 'ok:resume', 'H6 the same person retrying an unfinished release resumes it ' || coalesce(y,''));
  PERFORM hld_applied('t1','h1','reg1'); PERFORM hld_applied('t1','h1','reg1');
  y := hld_claim('reg1','t1','h1','stu1','Registrar','documents received');
  INSERT INTO rr VALUES (y = 'ok:done', 'H7 a finished release replays as done ' || coalesce(y,''));
  INSERT INTO rr VALUES ((SELECT count(*) FROM hld_events WHERE hold_id = 'h1' AND action = 'release applied') = 1, 'H8 applying twice is logged once');
  INSERT INTO rr VALUES (hld_claim('reg1','t2','h1','stu1','Registrar','documents received') = 'Hold not found.', 'H9 another institution cannot see or resume it');
  PERFORM hld_noticed('t1','h1',false,'mail service down');
  INSERT INTO rr VALUES ((SELECT applied AND NOT notified AND notice_error = 'mail service down' FROM hld_releases WHERE hold_id = 'h1'), 'H10 a failed notice keeps the release and records the failure');
  PERFORM hld_noticed('t1','h1',true,'');
  INSERT INTO rr VALUES ((SELECT notified AND notice_error = '' FROM hld_releases WHERE hold_id = 'h1'), 'H11 a later notice is recorded as sent');
  got := false;
  BEGIN UPDATE hld_events SET detail = 'x' WHERE hold_id = 'h1'; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'H12 the hold log cannot be edited');
  got := false;
  BEGIN INSERT INTO hld_releases (hold_id, tenant_id, student_id, actor_id, office, reason) VALUES ('h2','t1','stu1','stu1','Registrar','self release'); EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'H13 the table itself refuses a self-release');
  r := hld_respond('t1','h8','stu1','Released','I have paid the deposit in full.');
  INSERT INTO rr VALUES (r = 'This hold is no longer active.', 'H14 a lifted hold cannot be answered ' || coalesce(r,''));
  r := hld_respond('t1','h9','stu1','Active','paid');
  INSERT INTO rr VALUES (r LIKE 'Say a little more%', 'H15 a stub response is refused ' || coalesce(r,''));
  r := hld_respond('t1','h9','stu1','Active','I have paid the deposit in full.');
  INSERT INTO rr VALUES (r = 'ok', 'H16 a substantive response on an active hold is accepted ' || coalesce(r,''));
  INSERT INTO rr VALUES ((SELECT count(*) FROM hld_responses WHERE hold_id = 'h9' AND student_id = 'stu1' AND tenant_id = 't1') = 1, 'H17 the response is on file');
  INSERT INTO rr VALUES ((SELECT count(*) FROM hld_events WHERE hold_id = 'h9' AND action = 'student responded') = 1, 'H18 the response is in the hold log');
  got := false;
  BEGIN UPDATE hld_responses SET body = 'edited afterwards' WHERE hold_id = 'h9'; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'H19 a response cannot be edited after it is sent');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', HLD_MIGRATION);
  const m1 = HLD_MIGRATION.map((q) => q.replace(' ON CONFLICT (hold_id) DO NOTHING;', () => ' ON CONFLICT (hold_id) DO UPDATE SET actor_id = EXCLUDED.actor_id;'));
  console.log('second-releaser mutant applied:', m1.join('') !== HLD_MIGRATION.join(''));
  await go('mutant second-releaser-wins (H4):', m1);
  const m2 = HLD_MIGRATION.map((q) => q.replace(`IF r.tenant_id <> p_tenant THEN RETURN 'Hold not found.'; END IF;`, () => ''));
  console.log('tenant mutant applied:', m2.join('') !== HLD_MIGRATION.join(''));
  await go('mutant cross-tenant-resume (H9):', m2);
  const m3 = HLD_MIGRATION.map((q) => q.replace(`IF p_actor = p_student THEN RETURN 'This hold is on your own record, so someone else has to lift it.'; END IF;`, () => ''));
  console.log('self mutant applied:', m3.join('') !== HLD_MIGRATION.join(''));
  await go('mutant self-release (H1):', m3);
  const m4 = HLD_MIGRATION.map((q) => q.replace(`IF p_status <> 'Active' THEN RETURN 'This hold is no longer active.'; END IF;`, () => ''));
  console.log('status mutant applied:', m4.join('') !== HLD_MIGRATION.join(''));
  await go('mutant released-hold-answer (H14):', m4);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('hld_releases') AS t`)));
}
