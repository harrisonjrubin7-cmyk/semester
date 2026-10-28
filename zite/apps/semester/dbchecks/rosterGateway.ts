import { neon } from '@neondatabase/serverless';
import { RGW_MIGRATION } from '../src/lib/rgwMigration';

const row = (line: number, id: string, cls: string, usr: string, role: string, status: string, mod: string) =>
  `{"line":${line},"sourcedId":"${id}","classSourcedId":"${cls}","userSourcedId":"${usr}","role":"${role}","status":"${status}","modified":"${mod}"}`;
const B1 = `'[${[row(2, 'e1', 'c1', 'u1', 'student', 'active', '2026-10-01T00:00:00Z'), row(3, 'e2', 'c1', 'u2', 'student', 'active', '2026-10-01T00:00:00Z'),
  row(4, 'e3', 'c1', 'u3', 'student', 'active', '2026-10-01T00:00:00Z'), row(5, 'e4', 'cX', 'u1', 'student', 'active', '2026-10-01T00:00:00Z'),
  row(6, 'e1', 'c1', 'u1', 'student', 'active', '2026-10-01T00:00:00Z'), row(7, 'e5', 'c1', 'u4', 'aide', 'active', '2026-10-01T00:00:00Z'),
  row(8, 'e6', 'c1', 'u5', 'teacher', 'active', 'not a date')].join(',')}]'::jsonb`;
const M1 = `'{"u1":["p1"],"u2":["p2a","p2b"],"u4":["p4"],"u5":["p5"]}'::jsonb`;
const B2 = `'[${[row(2, 'e1', 'c1', 'u1', 'student', 'tobedeleted', '2026-09-01T00:00:00Z'), row(3, 'e1b', 'c1', 'u1', 'student', 'active', '2026-10-05T00:00:00Z')].join(',')}]'::jsonb`;
const B3 = `'[${[row(2, 'e1', 'c1', 'u1', 'student', 'tobedeleted', '2026-10-10T00:00:00Z')].join(',')}]'::jsonb`;
export const CHECKS = `DO $$
DECLARE r text; c bigint; c2 bigint; b bigint; got boolean; s jsonb;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO rgw_connections (tenant_id, name, standard, source_system, owner_id) VALUES ('t1','Registrar roster','OneRoster-shaped CSV','Legacy SIS','admA') RETURNING id INTO c;
  INSERT INTO rgw_connections (tenant_id, name, standard, source_system, owner_id) VALUES ('t2','Other roster','OneRoster-shaped CSV','Other SIS','admZ') RETURNING id INTO c2;
  INSERT INTO rgw_class_links VALUES (c,'c1','sec-1','admA');
  INSERT INTO rr VALUES (rgw_ingest('admA','t1',c,'key-rgw-0001','h1',${B1},${M1}) = 'This connection is not approved for imports.', 'R1 a draft connection cannot import');
  INSERT INTO rr VALUES (rgw_approve('admA','t1',c) = 'A different integration administrator must approve this connection.', 'R2 the owner cannot approve their own connection');
  INSERT INTO rr VALUES (rgw_approve('admB','t2',c) = 'Connection not found.', 'R3 another institution cannot approve it');
  INSERT INTO rr VALUES (rgw_approve('admB','t1',c) = 'ok', 'R4 a second administrator approves');
  PERFORM rgw_approve('admY','t2',c2);
  INSERT INTO rr VALUES (rgw_ingest('admA','t2',c,'key-rgw-0001','h1',${B1},${M1}) = 'Connection not found.', 'R5 the institution comes from the connection, not the caller''s claim');
  r := rgw_ingest('admA','t1',c,'key-rgw-0001','h1',${B1},${M1});
  INSERT INTO rr VALUES (r LIKE 'ok:%', 'R6 an approved connection imports ' || coalesce(r,'')); b := split_part(r,':',2)::bigint;
  SELECT summary INTO s FROM rgw_batches WHERE id = b;
  INSERT INTO rr VALUES (s = '{"staged":1,"updated":0,"unchanged":0,"stale":0,"duplicate":1,"quarantined":5}'::jsonb, 'R7 one staged, one duplicate, five quarantined ' || s::text);
  INSERT INTO rr VALUES ((SELECT reason FROM rgw_results WHERE batch_id = b AND external_enrollment = 'e2') = 'more than one person matches', 'R8 an ambiguous identity is quarantined, not guessed');
  INSERT INTO rr VALUES ((SELECT reason FROM rgw_results WHERE batch_id = b AND external_enrollment = 'e3') = 'person not found in this institution', 'R9 an unknown person is quarantined');
  INSERT INTO rr VALUES ((SELECT reason FROM rgw_results WHERE batch_id = b AND external_enrollment = 'e4') = 'class is not linked to a Semester section', 'R10 an unlinked class is quarantined');
  INSERT INTO rr VALUES ((SELECT reason FROM rgw_results WHERE batch_id = b AND external_enrollment = 'e5') = 'role is not student or teacher', 'R11 an unknown role is quarantined');
  INSERT INTO rr VALUES ((SELECT reason FROM rgw_results WHERE batch_id = b AND external_enrollment = 'e6') = 'dateLastModified is not a date', 'R12 a bad date is quarantined');
  INSERT INTO rr VALUES ((SELECT person_id = 'p1' AND method = 'email' FROM rgw_person_links WHERE connection_id = c AND external_user = 'u1'), 'R13 a single email match links the person and records how');
  INSERT INTO rr VALUES (NOT EXISTS (SELECT 1 FROM rgw_person_links WHERE connection_id = c AND external_user = 'u5'), 'R14 no link is made for a row that is quarantined later');
  INSERT INTO rr VALUES (rgw_ingest('admA','t1',c,'key-rgw-0001','h1',${B1},${M1}) = 'ok:' || b || ':replay', 'R15 a retry replays the same batch');
  INSERT INTO rr VALUES (rgw_ingest('admA','t1',c,'key-rgw-0001','h2',${B2},${M1}) = 'This request key was already used for a different file.', 'R16 a reused key with a different file is refused');
  r := rgw_ingest('admA','t1',c,'key-rgw-0002','h2',${B2},'{}'::jsonb);
  INSERT INTO rr VALUES ((SELECT outcome FROM rgw_results WHERE batch_id = split_part(r,':',2)::bigint AND external_enrollment = 'e1') = 'stale'
    AND (SELECT status FROM rgw_staged WHERE connection_id = c AND external_enrollment = 'e1') = 'active', 'R17 an older update never overwrites a newer one');
  INSERT INTO rr VALUES ((SELECT outcome FROM rgw_results WHERE batch_id = split_part(r,':',2)::bigint AND external_enrollment = 'e1b') = 'quarantined', 'R18 a second enrollment id for the same person and class is quarantined, not a second seat');
  r := rgw_ingest('admA','t1',c,'key-rgw-0003','h3',${B3},'{}'::jsonb);
  INSERT INTO rr VALUES ((SELECT status FROM rgw_staged WHERE connection_id = c AND external_enrollment = 'e1') = 'tobedeleted', 'R19 a newer withdrawal is staged');
  r := rgw_ingest('admA','t1',c,'key-rgw-0004','h3',${B3},'{}'::jsonb);
  INSERT INTO rr VALUES ((SELECT outcome FROM rgw_results WHERE batch_id = split_part(r,':',2)::bigint) = 'unchanged', 'R20 the same state again is unchanged');
  got := false; BEGIN UPDATE rgw_results SET outcome = 'staged' WHERE batch_id = b; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'R21 import results are append-only');
  got := false; BEGIN UPDATE rgw_connections SET state = 'Approved', approved_by = NULL WHERE id = c2; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'R22 an approved connection always names its approver (constraint)');
  got := false; BEGIN UPDATE rgw_connections SET mode = 'authoritative' WHERE id = c; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'R23 shadow mode only: a connection cannot be switched to write live records');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 600)); } };
  await go('real:', RGW_MIGRATION);
  const m1 = RGW_MIGRATION.map((q) => q.replace(`ELSIF jsonb_array_length(cand) > 1 THEN outc := 'quarantined'; why := 'more than one person matches';`, () => ''));
  console.log('ambiguity mutant applied:', m1.join('') !== RGW_MIGRATION.join(''));
  await go('mutant guess-ambiguous (R7, R8):', m1);
  const m2 = RGW_MIGRATION.map((q) => q.replace(`ELSIF m < cur.source_modified THEN outc := 'stale'; why := 'older than what is already staged';`, () => ''));
  console.log('stale mutant applied:', m2.join('') !== RGW_MIGRATION.join(''));
  await go('mutant older-overwrites (R17):', m2);
  const m3 = RGW_MIGRATION.map((q) => q.replace(`IF c.owner_id = p_actor THEN RETURN`, () => `IF false THEN RETURN`));
  console.log('self-approval mutant applied:', m3.join('') !== RGW_MIGRATION.join(''));
  await go('mutant self-approval (R2; the table constraint must still stop it):', m3);
  const m4 = RGW_MIGRATION.map((q) => q.replace(`IF outc IS NULL AND EXISTS (SELECT 1 FROM rgw_staged WHERE connection_id = p_conn AND person_id = pid`, () => `IF false AND EXISTS (SELECT 1 FROM rgw_staged WHERE connection_id = p_conn AND person_id = pid`));
  console.log('duplicate-seat mutant applied:', m4.join('') !== RGW_MIGRATION.join(''));
  await go('mutant duplicate-seat (R18):', m4);
  console.log('left behind:', JSON.stringify(await sql.query(`SELECT to_regclass('rgw_connections') AS t`)));
}
