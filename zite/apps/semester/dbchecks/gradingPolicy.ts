import { neon } from '@neondatabase/serverless';
import { GPL_MIGRATION } from '../src/lib/gplMigration';

const P = `'{"scale":{"A":4,"B":3,"F":0},"passing":["P"],"noCredit":[],"notAttempted":["W"],"incomplete":["I"],"repeat":"highest"}'::jsonb`;
export const CHECKS = `DO $$
DECLARE r text; x text; p1 bigint; p2 bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO rr VALUES (gpl_propose('reg1','t1',false,${P},true,'Catalog 2026 section 4.2',0) LIKE 'Only a registrar%', 'G1 only a registrar proposes');
  INSERT INTO rr VALUES (gpl_propose('reg1','t1',true,${P},false,'Catalog 2026 section 4.2',0) LIKE 'The policy has problems%', 'G2 a policy with problems is refused');
  INSERT INTO rr VALUES (gpl_propose('reg1','t1',true,${P},true,'short',0) LIKE 'Say what the policy%', 'G3 a proposal names its source');
  INSERT INTO rr VALUES (gpl_propose('reg1','t1',true,${P},true,'Catalog 2026 section 4.2',3) LIKE 'The approved policy changed%', 'G4 stale expected version refused');
  r := gpl_propose('reg1','t1',true,${P},true,'Catalog 2026 section 4.2',0); p1 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%:1', 'G5 first proposal is version 1');
  INSERT INTO rr VALUES (gpl_propose('reg2','t1',true,${P},true,'Catalog 2026 section 4.3',0) LIKE 'A proposed policy is already waiting%', 'G6 one pending proposal at a time');
  INSERT INTO rr VALUES (gpl_decide('reg1','t1',p1,true,true,'') LIKE 'You proposed this policy%', 'G7 the proposer cannot approve');
  INSERT INTO rr VALUES (gpl_decide('reg2','t2',p1,true,true,'') = 'Policy not found.', 'G8 another institution cannot decide it');
  INSERT INTO rr VALUES (gpl_decide('stu','t1',p1,false,true,'') LIKE 'Only a registrar%', 'G9 only a registrar decides');
  INSERT INTO rr VALUES (NOT EXISTS (SELECT 1 FROM gpl_policies WHERE tenant_id = 't1' AND status = 'Approved'), 'G10 nothing applies before approval');
  INSERT INTO rr VALUES (gpl_decide('reg2','t1',p1,true,true,'Matches the catalog') = 'ok', 'G11 a second registrar approves');
  INSERT INTO rr VALUES (gpl_decide('reg2','t1',p1,true,true,'') LIKE 'This policy was already decided%', 'G12 a decision is final');
  r := gpl_propose('reg2','t1',true,${P},true,'Catalog 2027 update',1); p2 := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%:2', 'G13 next proposal is version 2 against approved version 1');
  INSERT INTO rr VALUES (gpl_decide('reg1','t1',p2,true,false,'no') LIKE 'Say why%', 'G14 a rejection gives a reason');
  r := gpl_decide('reg1','t1',p2,true,true,'Approved for 2027');
  INSERT INTO rr VALUES (r = 'ok'
    AND (SELECT status FROM gpl_policies WHERE id = p1) = 'Superseded' AND (SELECT status FROM gpl_policies WHERE id = p2) = 'Approved', 'G15 approving v2 supersedes v1, which is kept');
  got := false; BEGIN UPDATE gpl_policies SET decided_by = proposed_by WHERE id = p2; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'G16 the table refuses a self-approval');
  got := false; BEGIN INSERT INTO gpl_policies (tenant_id, version, policy, proposed_by) VALUES ('t1', 9, '{"scale":{},"repeat":"best"}'::jsonb, 'x'); EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'G17 the table refuses an unknown repeat rule');
  got := false; BEGIN DELETE FROM gpl_events; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got AND (SELECT count(*) FROM gpl_events WHERE tenant_id = 't1') = 4, 'G18 the log is append-only and has every step');
  SELECT string_agg(lbl, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

async function race(sql: ReturnType<typeof neon>, label: string, mig: string[]) {
  const schema = `gpl_race_${label}_${Date.now()}`;
  try {
    await sql.query(`CREATE SCHEMA ${schema}`);
    await sql.transaction([sql.query(`SET LOCAL search_path TO ${schema}, public`), ...mig.map((q) => sql.query(q))]);
    await Promise.allSettled(Array.from({ length: 6 }, (_, i) => sql.transaction([sql.query(`SET LOCAL search_path TO ${schema}, public`),
      sql.query(`SELECT gpl_propose($1,'t-race',true,${P},true,'Concurrent proposal',0) AS r`, [`reg-${i}`])])));
    const [row] = (await sql.transaction([sql.query(`SET LOCAL search_path TO ${schema}, public`), sql.query(`SELECT count(*)::int AS n FROM gpl_policies WHERE status = 'Proposed'`)]))[1] as { n: number }[];
    console.log(`race ${label}: 6 registrars propose at once -> ${row.n} pending proposal(s)`);
  } finally { await sql.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
}

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 400)); } };
  await go('real:', GPL_MIGRATION);
  // The table's CHECK (decided_by <> proposed_by) is a second guard: this mutant must still be refused, by the table.
  await go('mutant proposer-may-approve (G7):', GPL_MIGRATION.map((q) => q.replace(`IF p.proposed_by = p_actor THEN RETURN 'You proposed this policy; another registrar must decide it.'; END IF;`, () => '')));
  await go('mutant no-supersede (G15):', GPL_MIGRATION.map((q) => q.replace(`UPDATE gpl_policies SET status = 'Superseded' WHERE tenant_id = p_tenant AND status = 'Approved';`, () => '')));
  await race(sql, 'real', GPL_MIGRATION);
  // Control: without the lock, the one-pending index and the version key, concurrent proposals all land (each sees none pending).
  await race(sql, 'control', GPL_MIGRATION.filter((q) => !q.includes('gpl_one_pending')).map((q) => q
    .replace(`PERFORM pg_advisory_xact_lock(hashtext('gpl:' || p_tenant));`, () => '')
    .replace(`SELECT coalesce(max(version), 0) + 1 INTO nv`, () => `PERFORM pg_sleep(0.5); SELECT coalesce(max(version), 0) + 1 INTO nv`)
    .replace(`, UNIQUE (tenant_id, version))`, () => ')')));
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('gpl_policies') AS t`)));
}
