import { neon } from '@neondatabase/serverless';
import { FIL_MIGRATION } from '../src/lib/filMigration';
import { TRF_MIGRATION } from '../src/lib/trfMigration';
import { TRT_MIGRATION } from '../src/lib/trtMigration';

// Transcript intake (lib/trtMigration.ts). One rolled-back transaction, synthetic ids: st1 student, st2 another student, rg1
// registrar. Run on app jeabiv2536: import { run } from './dbchecks/transcripts'; await run();
export const CHECKS = `DO $$
DECLARE x text; t bigint; f1 uuid := gen_random_uuid(); f2 uuid := gen_random_uuid(); f3 uuid := gen_random_uuid(); got boolean; n int;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO fil_files (id, tenant_id, owner_id, name, mime, size_bytes, sha256, purpose, scan_status) VALUES
    (f1, 'tt1', 'st1', 'transcript.pdf', 'application/pdf', 10, repeat('a', 64), 'evidence', 'clean'),
    (f2, 'tt1', 'st1', 'pending.pdf', 'application/pdf', 10, repeat('b', 64), 'evidence', 'pending'),
    (f3, 'tt1', 'st2', 'theirs.pdf', 'application/pdf', 10, repeat('c', 64), 'evidence', 'clean');
  INSERT INTO fil_blobs (file_id, bytes) VALUES (f1, '\\x255044462d'), (f2, '\\x00'), (f3, '\\x00');
  INSERT INTO trf_requests (id, tenant_id, student_id, ext_institution) VALUES ('rq-st1-aaaaaaaa', 'tt1', 'st1', 'Previous College'), ('rq-st2-bbbbbbbb', 'tt1', 'st2', 'Other College');
  x := trt_add('tt1', 'st1', 'rq-st2-bbbbbbbb', f1);
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'A1 only to your own request');
  x := trt_add('tt1', 'st1', 'rq-st1-aaaaaaaa', f3);
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'A2 only your own file');
  x := trt_add('tt1', 'st1', 'rq-st1-aaaaaaaa', f2);
  INSERT INTO rr VALUES (x = 'This file has not passed screening.', 'A3 only a screened file');
  x := trt_add('tt1', 'st1', 'rq-st1-aaaaaaaa', f1); t := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (t IS NOT NULL, 'A4 the student attaches a screened transcript');
  x := trt_add('tt1', 'st1', 'rq-st1-aaaaaaaa', f1);
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'A5 the same file once');
  SELECT count(*) INTO n FROM trt_read('tt1', 'st2', false, t);
  INSERT INTO rr VALUES (n = 0, 'R1 another student cannot read it');
  SELECT count(*) INTO n FROM trt_read('tt1', 'st1', false, t);
  INSERT INTO rr VALUES (n = 1, 'R2 the student reads their own');
  SELECT count(*) INTO n FROM trt_read('tt1', 'rg1', true, t);
  INSERT INTO rr VALUES (n = 1, 'R3 a registrar reads it');
  INSERT INTO rr VALUES ((SELECT count(*) FROM fil_access_log WHERE file_id = f1 AND action = 'denied' AND actor_id = 'st2') = 1
    AND (SELECT count(*) FROM fil_access_log WHERE file_id = f1 AND action = 'download') = 2, 'R4 every read and refusal is logged');
  SELECT count(*) INTO n FROM trt_read('ttX', 'rg1', true, t);
  INSERT INTO rr VALUES (n = 0, 'R5 another institution cannot read it');
  x := trt_review('tt1', 'st1', true, t, 1, 'accepted_official', '');
  INSERT INTO rr VALUES (x = 'You cannot review your own transcript.', 'V1 the student cannot review their own, even if flagged registrar');
  x := trt_review('tt1', 'st2', false, t, 1, 'accepted_official', '');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'V2 only a registrar reviews');
  x := trt_review('tt1', 'rg1', true, t, 1, 'rejected', 'blurry');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'V3 a rejection needs a reason');
  x := trt_review('tt1', 'rg1', true, t, 1, 'accepted_unofficial', 'Student copy; official copy still needed for posting.');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM trt_transcripts WHERE id = t) = 'accepted_unofficial', 'V4 the registrar accepts it as unofficial');
  x := trt_review('tt1', 'rg1', true, t, 2, 'accepted_official', '');
  INSERT INTO rr VALUES (x NOT LIKE 'ok:%', 'V5 a review is decided once');
  got := false; BEGIN UPDATE trt_transcripts SET reviewed_by = 'st1' WHERE id = t; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'V6 the table refuses a student as their own reviewer');
  got := false; BEGIN DELETE FROM trt_events; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'H1 review history is append-only');
  UPDATE trf_requests SET state = 'withdrawn' WHERE id = 'rq-st2-bbbbbbbb';
  x := trt_add('tt1', 'st2', 'rq-st2-bbbbbbbb', f3);
  INSERT INTO rr VALUES (x = 'This request is closed.', 'A6 nothing is attached to a closed request');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run(only?: string) {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const pre = [...FIL_MIGRATION, ...TRF_MIGRATION];
  const base = [...TRT_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...[...pre, ...mig].map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 1200)); } };
  const muts: [string, string, string][] = [
    ['unscreened file (A3)', `IF (SELECT scan_status FROM fil_files WHERE id = p_file) <> 'clean' THEN RETURN`, `IF false THEN RETURN`],
    ['anyone reads (R1)', `IF NOT (p_actor = t.student_id OR p_registrar) OR`, `IF false AND`],
    ['self review (V1; table backstop)', `IF p_actor = t.student_id THEN RETURN 'You cannot review`, `IF false THEN RETURN 'You cannot review`],
  ];
  if (!only || only === 'real') await go('real:', base);
  for (const [label, from, to] of muts) {
    if (only && only !== 'mutants' && !label.startsWith(only)) continue;
    const m = base.map((q) => q.replace(from, () => to));
    console.log(label, 'applied:', m.join('') !== base.join(''));
    await go('mutant ' + label + ':', m);
  }
}
