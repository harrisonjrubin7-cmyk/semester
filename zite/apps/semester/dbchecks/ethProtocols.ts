import { neon } from '@neondatabase/serverless';
import { RSA_MIGRATION } from '../src/lib/rsaMigration';
import { ETH_MIGRATION } from '../src/lib/ethMigration';

// E25 Research Ethics: conflict-of-interest and quorum rules, expiring approvals
// (lib/ethMigration.ts). One transaction, RESULT raised, everything rolls back.
const SUMMARY = 'We interview adult volunteers about their commute habits, record answers with permission, and store transcripts without names.';
const CONSENT = 'Volunteers sign a written consent form before any interview begins.';
const CHECKS = `DO $$
DECLARE x text; out text; pid bigint; pid2 bigint; st text;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, l text) ON COMMIT DROP;
  out := eth_set_staff('chair1', 'te', 'chair1', 'chair', true);
  INSERT INTO rr VALUES (out LIKE 'Ask another administrator%', 'T1 nobody grants their own committee access');
  PERFORM eth_set_staff('root', 'te', 'chair1', 'chair', true);
  PERFORM eth_set_staff('root', 'te', 'mem1', 'member', true);
  PERFORM eth_set_staff('root', 'te', 'mem2', 'member', true);
  PERFORM eth_set_staff('root', 'te', 'prof1', 'member', true);

  out := eth_submit('prof1', 'te', NULL, 'Commute interviews', '${SUMMARY}', 'human', 'minimal', '');
  INSERT INTO rr VALUES (out LIKE '%consent%', 'T2 human-subject protocols must describe consent');
  out := eth_submit('prof1', 'te', NULL, 'Commute interviews', '${SUMMARY}', 'human', 'minimal', '${CONSENT}');
  INSERT INTO rr VALUES (out LIKE 'ok:%', 'T3 a researcher submits a protocol');
  pid := split_part(out, ':', 2)::bigint;
  out := eth_review('mem1', 'te', pid, 'approve', 'Looks sound to me.');
  INSERT INTO rr VALUES (out LIKE '%under review%', 'T4 reviews wait for an open review');
  out := eth_begin('outsider', 'te', pid);
  INSERT INTO rr VALUES (out LIKE 'Only the ethics committee%', 'T5 only the committee opens reviews');
  out := eth_begin('mem1', 'te', pid);
  INSERT INTO rr VALUES (out IS NULL, 'T6 a member opens the review');
  out := eth_review('prof1', 'te', pid, 'approve', 'My own protocol is fine.');
  INSERT INTO rr VALUES (out LIKE '%conflict of interest%', 'T7 the submitter cannot review their own protocol');
  out := eth_review('mem1', 'te', pid, 'approve', 'Design is sound and consent is real.');
  INSERT INTO rr VALUES (out IS NULL, 'T8 a member records a review');
  out := eth_review('mem1', 'te', pid, 'decline', 'Changed my mind about this one.');
  INSERT INTO rr VALUES (out LIKE '%already recorded%', 'T9 one recorded review per member');
  out := eth_decide('chair1', 'te', pid, 'approve', '', DATE '2030-06-01', '');
  INSERT INTO rr VALUES (out LIKE '%at least two recorded reviews%', 'T10 no decision before two reviews (quorum)');
  out := eth_review('mem2', 'te', pid, 'conditions', 'Approve if recordings are deleted after transcription.');
  INSERT INTO rr VALUES (out IS NULL, 'T11 a second member reviews');
  out := eth_decide('mem2', 'te', pid, 'approve', '', DATE '2030-06-01', '');
  INSERT INTO rr VALUES (out LIKE 'Only the committee chair%', 'T12 members do not render decisions');
  out := eth_decide('chair1', 'te', pid, 'approve', '', DATE '2020-01-01', '');
  INSERT INTO rr VALUES (out LIKE '%expiry date in the future%', 'T13 approvals need a future expiry');
  out := eth_decide('chair1', 'te', pid, 'approve', '', DATE '2030-06-01', '');
  INSERT INTO rr VALUES (out IS NULL AND (SELECT state FROM eth_protocols WHERE id = pid) = 'approved' AND (SELECT expires_on FROM eth_protocols WHERE id = pid) = DATE '2030-06-01', 'T14 the chair approves with an expiry');

  out := eth_submit('prof1', 'te', NULL, 'Commute interviews II', '${SUMMARY}', 'human', 'minimal', '${CONSENT}');
  pid2 := split_part(out, ':', 2)::bigint;
  PERFORM eth_begin('mem1', 'te', pid2);
  PERFORM eth_review('mem1', 'te', pid2, 'conditions', 'Only with the deletion condition applied.');
  PERFORM eth_review('mem2', 'te', pid2, 'approve', 'Fine with the stated condition in place.');
  out := eth_decide('chair1', 'te', pid2, 'conditions', '', DATE '2030-06-01', '');
  INSERT INTO rr VALUES (out LIKE '%conditions of the approval%', 'T15 conditional approval must state its conditions');
  out := eth_decide('chair1', 'te', pid2, 'conditions', '', DATE '2030-06-01', 'Delete recordings within 30 days of transcription.');
  INSERT INTO rr VALUES (out IS NULL AND (SELECT state FROM eth_protocols WHERE id = pid2) = 'conditions', 'T16 a conditional approval lands with its conditions');
  out := eth_close('prof1', 'te', pid);
  SELECT state INTO st FROM eth_protocols WHERE id = pid;
  INSERT INTO rr VALUES (out IS NULL AND st = 'closed', 'T17 the submitter closes a finished protocol');
  INSERT INTO rr VALUES ((SELECT count(*) FROM eth_events WHERE protocol_id IN (pid, pid2)) >= 8, 'T18 submissions, reviews and decisions are in the event log');
  SELECT string_agg(l, '; ') INTO x FROM rr WHERE ok IS NOT TRUE;
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE), coalesce(x, '');
END $$`;

const MIG = [...RSA_MIGRATION, ...ETH_MIGRATION];

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 500)); } };
  await go('real:', MIG);
  const m1 = ETH_MIGRATION.map((q) => q.replace('IF pr.submitter_id = p_actor THEN', () => 'IF false THEN'));
  console.log('conflict mutant applied (first occurrence only — review guard):', m1.join('') !== ETH_MIGRATION.join(''));
  await go('mutant review-own-protocol (T7):', [...RSA_MIGRATION, ...m1]);
  const m2 = ETH_MIGRATION.map((q) => q.replace('IF n < 2 THEN', () => 'IF n < 0 THEN'));
  console.log('quorum mutant applied:', m2.join('') !== ETH_MIGRATION.join(''));
  await go('mutant no-quorum (T10):', [...RSA_MIGRATION, ...m2]);
}
