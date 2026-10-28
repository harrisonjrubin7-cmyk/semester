import { neon } from '@neondatabase/serverless';
import { SREQ_MIGRATION } from '../src/lib/sreqMigration';

// Spec §3.5 / §16 link 1 "one approved section". Single-transaction checks of the sreq_* workflow, then a real
// concurrency race: two registrars authorize two requests that clash on the same room and time, in parallel.
export const CHECKS = `DO $$
DECLARE r text; x text; d bigint; rm bigint; small bigint; a bigint; b bigint; v int; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO inst_departments (tenant_id, name, chair_id) VALUES ('t1','Economics','chair1') RETURNING id INTO d;
  INSERT INTO inst_rooms (tenant_id, name, capacity) VALUES ('t1','Hall 101',40) RETURNING id INTO rm;
  INSERT INTO inst_rooms (tenant_id, name, capacity) VALUES ('t1','Seminar 2',10) RETURNING id INTO small;
  r := sreq_submit('t1','fac1','key-aaaa','fp1',d,'c1','ECON 101','term1','F26','01',30,'MW 10:00-11:15',ARRAY['M','W'],600,675,rm,'ins1','');
  a := split_part(r,':',2)::bigint;
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'Q1 a department request is submitted');
  INSERT INTO rr VALUES (sreq_submit('t1','fac1','key-aaaa','fp1',d,'c1','ECON 101','term1','F26','01',30,'MW 10:00-11:15',ARRAY['M','W'],600,675,rm,'ins1','') = 'replay:' || a, 'Q2 the same request key replays');
  INSERT INTO rr VALUES (sreq_submit('t1','fac1','key-aaaa','fp2',d,'c1','ECON 101','term1','F26','01',35,'MW 10:00-11:15',ARRAY['M','W'],600,675,rm,'ins1','') LIKE 'This request was already sent%', 'Q3 a reused key with changed details is refused');
  INSERT INTO rr VALUES (sreq_submit('t1','fac2','key-bbbb','fp3',d,'c1','ECON 101','term1','F26','01',30,'TR 9:00-10:15',ARRAY['T','R'],540,615,rm,'ins2','') LIKE 'A request for this course%', 'Q4 one open request per course, term and section code');
  INSERT INTO rr VALUES (sreq_submit('t1','fac1','key-cccc','fp4',d,'c1','ECON 101','term1','F26','02',30,'TR 9:00-10:15',ARRAY['T','R'],540,615,small,'ins1','') LIKE 'Choose an active room large enough%', 'Q5 room must fit the capacity');
  INSERT INTO rr VALUES (sreq_submit('t2','fac1','key-dddd','fp5',d,'c1','ECON 101','term1','F26','03',30,'TR 9:00-10:15',ARRAY['T','R'],540,615,rm,'ins1','') = 'Choose an active department.', 'Q6 another tenant cannot use this department');
  INSERT INTO rr VALUES (sreq_step('t1',a,'chair1','registrar',true,1,'','') LIKE 'This request is submitted%', 'Q7 the registrar cannot skip the chair');
  INSERT INTO rr VALUES (sreq_step('t1',a,'someone','chair',true,1,'','') = 'Only the department chair can review this request.', 'Q8 only the department chair reviews');
  INSERT INTO rr VALUES (sreq_step('t1',a,'chair1','chair',true,9,'','') LIKE 'Someone else changed%', 'Q9 stale version refused');
  r := sreq_step('t1',a,'chair1','chair',true,1,'ok','');
  INSERT INTO rr VALUES (r IS NULL AND (SELECT state = 'chair_approved' AND chair_decider = 'chair1' FROM sec_requests WHERE id = a), 'Q10 the chair approves');
  INSERT INTO rr VALUES (sreq_step('t1',a,'chair1','registrar',true,2,'','') LIKE 'The registrar decision must come from someone other%', 'Q11 the chair cannot also authorize');
  INSERT INTO rr VALUES (sreq_step('t1',a,'fac1','registrar',true,2,'','') LIKE 'The registrar decision must come from someone other%', 'Q12 the requester cannot authorize');
  r := sreq_step('t1',a,'reg1','registrar',true,2,'','');
  INSERT INTO rr VALUES (r IS NULL AND (SELECT state = 'authorized' FROM sec_requests WHERE id = a), 'Q13 the registrar authorizes');
  -- a clashing request (same room, overlapping time) is refused at authorization
  r := sreq_submit('t1','fac2','key-eeee','fp6',d,'c2','ECON 201','term1','F26','01',30,'MW 10:30-11:45',ARRAY['M','W'],630,705,rm,'ins2',''); b := split_part(r,':',2)::bigint;
  PERFORM sreq_step('t1',b,'chair1','chair',true,1,'','');
  INSERT INTO rr VALUES (sreq_step('t1',b,'reg1','registrar',true,2,'','') LIKE 'Another authorized section already uses this room%', 'Q14 a room clash is refused at authorization');
  INSERT INTO rr VALUES (sreq_step('t1',a,'reg1','created',true,3,'','sec-x') LIKE 'This request is authorized; that step%', 'Q15 created needs begin_create first');
  PERFORM sreq_step('t1',a,'reg1','begin_create',true,3,'','');
  INSERT INTO rr VALUES (sreq_step('t1',a,'reg1','created',true,4,'','') = 'A created section needs its id.', 'Q16 created must name the section');
  PERFORM sreq_step('t1',a,'reg1','create_failed',true,4,'boom','');
  INSERT INTO rr VALUES ((SELECT state = 'authorized' FROM sec_requests WHERE id = a), 'Q17 a failed creation returns to authorized, nothing opened');
  PERFORM sreq_step('t1',a,'reg1','begin_create',true,5,'','');
  PERFORM sreq_step('t1',a,'reg1','created',true,6,'','sec-1');
  r := sreq_step('t1',a,'reg1','reconciled',true,7,'','');
  INSERT INTO rr VALUES (r IS NULL AND (SELECT state = 'reconciled' AND section_id = 'sec-1' FROM sec_requests WHERE id = a), 'Q18 created then reconciled with the section id');
  INSERT INTO rr VALUES ((SELECT array_agg(step ORDER BY id) = ARRAY['submit','chair','registrar','begin_create','create_failed','begin_create','created','reconciled'] FROM sec_request_events WHERE request_id = a), 'Q19 every step is in the history in order');
  got := false; BEGIN UPDATE sec_request_events SET note = 'x' WHERE request_id = a; EXCEPTION WHEN others THEN got := true; END;
  INSERT INTO rr VALUES (got, 'Q20 the history cannot be rewritten');
  INSERT INTO rr VALUES (sreq_step('t1',a,'fac9','withdraw',true,8,'','') LIKE 'This request is reconciled%', 'Q21 a reconciled request cannot be withdrawn');
  SELECT string_agg(lbl, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x,'');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...SREQ_MIGRATION.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('real: no RESULT raised'); }
  catch (e) { const x = e as any; console.log('real:', String(x.message).slice(0, 600), x.where ?? ''); }

  // Concurrency: two clashing requests, both chair-approved, authorized at the same moment by two registrars.
  const race = async (label: string, mig: string[]) => {
    const schema = `sreq_${Math.random().toString(36).slice(2, 10)}`;
    const sp = () => sql.query(`SET LOCAL search_path TO ${schema}, public`);
    try {
      await sql.query(`CREATE SCHEMA ${schema}`);
      await sql.transaction([sp(), ...mig.map((q) => sql.query(q))]);
      const setup = await sql.transaction([sp(),
        sql.query(`INSERT INTO inst_departments (tenant_id, name, chair_id) VALUES ('t','Econ','chair') RETURNING id`),
        sql.query(`INSERT INTO inst_rooms (tenant_id, name, capacity) VALUES ('t','Hall',50) RETURNING id`)]);
      const d = Number((setup[1] as { id: number }[])[0].id), rm = Number((setup[2] as { id: number }[])[0].id);
      const ids: number[] = [];
      for (const [i, code] of [[1, 'A'], [2, 'B']] as const) {
        const r = await sql.transaction([sp(), sql.query(`SELECT sreq_submit('t',$1,$2,$3,$4,$5,$6,'term','F26','01',30,'MW 10:00-11:15',ARRAY['M','W'],600,675,$7,$8,'') AS r`, [`fac${i}`, `key-${code}0000`, `fp${code}`, d, `c${code}`, `C ${code}`, rm, `ins${i}`])]);
        const id = Number(String((r[1] as { r: string }[])[0].r).split(':')[1]); ids.push(id);
        await sql.transaction([sp(), sql.query(`SELECT sreq_step('t',$1,'chair','chair',true,1,'','')`, [id])]);
      }
      const res = await Promise.allSettled(ids.map((id, k) => sql.transaction([sp(), sql.query(`SELECT sreq_step('t',$1,$2,'registrar',true,2,'','') AS e`, [id, `reg${k}`])])));
      const outs = res.map((r) => (r.status === 'fulfilled' ? ((r.value[1] as { e: string | null }[])[0].e ?? 'authorized') : `error:${String((r as PromiseRejectedResult).reason?.message).slice(0, 60)}`));
      const n = Number(((await sql.transaction([sp(), sql.query(`SELECT count(*)::int AS n FROM sec_requests WHERE state = 'authorized'`)]))[1] as { n: number }[])[0].n);
      console.log(`${label}: authorized=${n} outcomes=${JSON.stringify(outs)}`);
      return n;
    } finally {
      await sql.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      console.log(`${label}: schema dropped=${((await sql.query(`SELECT count(*)::int AS n FROM information_schema.schemata WHERE schema_name = $1`, [schema])) as { n: number }[])[0].n === 0}`);
    }
  };
  const slow = (m: string[]) => m.map((q) => q.replace(`IF n > 0 THEN RETURN 'Another authorized section`, () => `PERFORM pg_sleep(0.4); IF n > 0 THEN RETURN 'Another authorized section`));
  const real = await race('race-real', slow(SREQ_MIGRATION));
  const unlocked = await race('race-control-no-term-lock', slow(SREQ_MIGRATION).map((q) => q.replace(`PERFORM pg_advisory_xact_lock(hashtext('sreq:term:' || p_tenant || ':' || r.term_id));`, () => '')));
  console.log(`RESULT race_real_one_authorized=${real === 1} control_both_authorized=${unlocked === 2}`);
}
