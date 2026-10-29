import { neon } from '@neondatabase/serverless';
import { PTA_MIGRATION } from '../src/lib/ptaMigration';
import { RSA_MIGRATION } from '../src/lib/rsaMigration';
import { TEAM_MIGRATION } from '../src/lib/teamMigration';
import { ASM_MIGRATION } from '../src/lib/asmMigration';
import { CRS_MIGRATION } from '../src/lib/crsMigration';
import { ASG_MIGRATION } from '../src/lib/asgMigration';
import { REUSE_MIGRATION } from '../src/lib/reuseMigration';
import { FIL_MIGRATION } from '../src/lib/filMigration';
import { OGR_MIGRATION } from '../src/lib/ogrMigration';
import { CNE_MIGRATION } from '../src/lib/cneMigration';

// S-82 §11 acceptance fixture (platform build plan §8): the ten named scenarios, run against the
// real SQL rules in one rolled-back transaction. A10 (keyboard-only grading) is a UI property and
// is deliberately NOT asserted here — it belongs to the browser pass; see NEXT_ACTIONS.
// A3 note: dated INSTRUCTOR-OF-RECORD assignments are a documented gap (connectionRegister:
// "dated assignments that expire on their own are not modelled"); what expires today is dated
// delegate access, asserted in A3, and removal/revocation bites at once (A4).
const CHECKS = `DO $$
DECLARE x text; out text; rid bigint; k1 bigint; attOwn bigint; attOther bigint; f uuid; n int; r jsonb; off1 bigint; enr1 bigint; ses1 bigint;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;

  -- A1: a second synthetic institution B sees nothing of institution A (research admin surface).
  PERFORM rsa_set_staff('root', 'accA', 'adminA', true);
  PERFORM rsa_set_staff('root', 'accB', 'adminB', true);
  out := rsa_submit('userA', 'accA', 'Harbour study', 'A study of harbour water quality across two seasons of sampling.', 'internal', 0);
  INSERT INTO rr VALUES (out LIKE 'ok:%', 'A1a institution A accepts its own submission');
  rid := split_part(out, ':', 2)::bigint;
  out := rsa_decide('adminB', 'accB', rid, true, '', 'HBR-1');
  INSERT INTO rr VALUES (out = 'Request not found.' AND (SELECT count(*) FROM rsa_requests WHERE tenant_id = 'accB') = 0, 'A1b institution B cannot see or decide institution A requests');

  -- A2: a student who is also a TA grades others, never themselves.
  PERFORM crs_delegate('tx', 'secY', 'prof', 'ta-stu', 30);
  INSERT INTO rr VALUES (crs_is_delegate('tx', 'secY', 'ta-stu'), 'A2a the student holds a live grading delegation on another section');
  INSERT INTO asm_assessments (tenant_id, section_id, title, state, opens_at, closes_at, attempts_allowed, created_by) VALUES ('tx', 'secY', 'Quiz 1', 'published', now() - interval '1 day', now() + interval '1 day', 2, 'prof') RETURNING id INTO k1;
  INSERT INTO asm_versions (assessment_id, version, questions, total_points, published_by) VALUES (k1, 1, '[{\"q\":1}]', 10, 'prof');
  INSERT INTO asm_attempts (tenant_id, assessment_id, version, student_id, state, auto_score, submitted_at) VALUES ('tx', k1, 1, 'ta-stu', 'submitted', 5, now()) RETURNING id INTO attOwn;
  INSERT INTO asm_attempts (tenant_id, assessment_id, version, student_id, state, auto_score, submitted_at) VALUES ('tx', k1, 1, 'stu2', 'submitted', 5, now()) RETURNING id INTO attOther;
  out := asm_grade('tx', attOwn, 'ta-stu', 3, 'Self review.');
  INSERT INTO rr VALUES (out = 'You cannot grade your own attempt.', 'A2b the TA cannot grade their own attempt');
  out := asm_grade('tx', attOther, 'ta-stu', 3, 'Solid work.');
  INSERT INTO rr VALUES (out IS NULL AND (SELECT state FROM asm_attempts WHERE id = attOther) = 'graded', 'A2c the TA grades another student attempt');

  -- A6: once released, an attempt is stale for grading.
  n := asm_release('tx', k1);
  out := asm_grade('tx', attOther, 'prof', 4, 'Second look.');
  INSERT INTO rr VALUES (n >= 1 AND out = 'Only submitted, unreleased attempts can be graded.', 'A6 a released attempt can no longer be graded');

  -- A3: dated delegate access expires on its own.
  INSERT INTO crs_delegations (tenant_id, section_id, delegate_id, granted_by, expires_at) VALUES ('tx', 'secY', 'old-del', 'prof', now() - interval '1 day');
  INSERT INTO rr VALUES (NOT crs_is_delegate('tx', 'secY', 'old-del'), 'A3 an expired delegation confers no access');

  -- A4: a revoked delegate loses access at once.
  PERFORM crs_delegate('tx', 'secZ', 'prof', 'del1', 30);
  INSERT INTO rr VALUES (crs_is_delegate('tx', 'secZ', 'del1'), 'A4a the delegation is live before revocation');
  UPDATE crs_delegations SET revoked_at = now() WHERE section_id = 'secZ' AND delegate_id = 'del1' AND revoked_at IS NULL;
  INSERT INTO rr VALUES (NOT crs_is_delegate('tx', 'secZ', 'del1'), 'A4b revocation removes access immediately');

  -- A5: an interrupted (never scan-cleared) upload is not readable by anyone but its owner.
  f := fil_put('tf', 'stu1', 'essay.pdf', 'application/pdf', 'submission', 'hello'::bytea);
  PERFORM fil_grant('tf', f, 'stu1', 'grader1', 7);
  INSERT INTO rr VALUES ((SELECT count(*) FROM fil_read('tf', f, 'grader1')) = 0, 'A5a while screening is pending, a granted reader gets nothing');
  PERFORM fil_record_scan('tf', f, 'clean', '', 'test-engine');
  INSERT INTO rr VALUES ((SELECT count(*) FROM fil_read('tf', f, 'grader1')) = 1, 'A5b once the scan is clean, the granted reader can read it');

  -- A7: final-grade posting reconciles a timeout retry by request key.
  INSERT INTO ogr_proposals (tenant_id, enrollment_id, section_id, student_id, grade, version, state, proposed_by, certified_by, certified_version)
    VALUES ('tg', 'enr-1', 'sec1', 'stu1', 'A', 1, 'Certified', 'prof1', 'prof1', 1), ('tg', 'enr-2', 'sec1', 'stu2', 'B', 1, 'Certified', 'prof1', 'prof1', 1);
  out := ogr_post('prof1', 'tg', 'enr-1', true, 'post-key-0001', 1);
  INSERT INTO rr VALUES (out = 'The person who certified a grade cannot also post it.', 'A7a the certifier cannot post their own grade');
  out := ogr_post('reg1', 'tg', 'enr-1', true, 'post-key-0001', 1);
  INSERT INTO rr VALUES (out LIKE 'ok:%' AND out NOT LIKE '%replay', 'A7b the registrar posts the certified grade');
  out := ogr_post('reg1', 'tg', 'enr-1', true, 'post-key-0001', 1);
  INSERT INTO rr VALUES (out LIKE '%:replay' AND (SELECT count(*) FROM ogr_entries WHERE tenant_id = 'tg' AND enrollment_id = 'enr-1') = 1, 'A7c a retry with the same request key replays instead of double-posting');
  out := ogr_post('reg1', 'tg', 'enr-2', true, 'post-key-0001', 1);
  INSERT INTO rr VALUES (out = 'This request key was already used for a different grade.', 'A7d the same key cannot be reused for a different grade');

  -- A8: a withdrawn learner keeps no active-enrollment rights (continuing education surface).
  PERFORM cne_set_staff('root', 'tc', 'coord1', 'coordinator', true);
  INSERT INTO cne_offerings (tenant_id, code, title, capacity, state, created_by) VALUES ('tc', 'SWIM-1', 'Swim basics', 20, 'published', 'coord1') RETURNING id INTO off1;
  INSERT INTO cne_sessions (offering_id, starts_at, ends_at) VALUES (off1, now() - interval '1 hour', now() + interval '1 hour') RETURNING id INTO ses1;
  INSERT INTO cne_enrollments (tenant_id, offering_id, learner_id, payment_state) VALUES ('tc', off1, 'learner1', 'not_required') RETURNING id INTO enr1;
  out := cne_withdraw('learner1', enr1);
  INSERT INTO rr VALUES (out IS NULL AND (SELECT state FROM cne_enrollments WHERE id = enr1) = 'withdrawn', 'A8a the learner withdraws');
  out := cne_attend('coord1', 'tc', enr1, ses1, true);
  INSERT INTO rr VALUES (out = 'Attendance is recorded only for active, undecided enrollments.', 'A8b a withdrawn enrollment records no attendance');

  -- A9: copying a section with no prior work succeeds and copies nothing.
  r := reuse_copy_shell('ta', 'sec-empty', 'sec-empty-new', 'prof', 0);
  INSERT INTO rr VALUES ((r->>'error') IS NULL AND (r->>'assignments')::int = 0 AND (r->>'assessments')::int = 0 AND NOT (r->>'syllabus')::boolean, 'A9 an empty shell copies cleanly, with nothing invented');

  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x, '');
END $$`;

const MIG = [...PTA_MIGRATION, ...RSA_MIGRATION, ...TEAM_MIGRATION, ...ASM_MIGRATION, ...CRS_MIGRATION, ...ASG_MIGRATION, ...REUSE_MIGRATION, ...FIL_MIGRATION, ...OGR_MIGRATION, ...CNE_MIGRATION];

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  try { await sql.transaction([...MIG.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log('real: no RESULT raised'); }
  catch (e) { console.log('real:', String((e as Error).message).slice(0, 600)); }
}
