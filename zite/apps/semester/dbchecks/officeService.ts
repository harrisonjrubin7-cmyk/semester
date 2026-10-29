import { neon } from '@neondatabase/serverless';
import { OSV_MIGRATION } from '../src/lib/osvMigration';

// University Staff: office queues, requests, knowledge, resolution (lib/osvMigration.ts). One rolled-back transaction.
// Run on app jeabiv2536: import { run } from './dbchecks/officeService'; await run();
export const CHECKS = `DO $$
DECLARE x text; o1 bigint; o2 bigint; oX bigint; r1 bigint; r2 bigint; a1 bigint; a2 bigint; v int; h text; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  x := osv_office('t1', 'stf1', false, NULL, 'Registrar', '', '', true);
  INSERT INTO rr VALUES (x = 'Only administrators set up offices.', 'O1 only administrators create offices: ' || coalesce(x,''));
  x := osv_office('t1', 'adm', true, NULL, 'Registrar', 'Records and enrollment', 'Mon–Fri 9–4', true); o1 := substr(x, 4)::bigint;
  x := osv_office('t1', 'adm', true, NULL, 'Financial Aid', '', '', true); o2 := substr(x, 4)::bigint;
  x := osv_office('t2', 'admB', true, NULL, 'Housing', '', '', true); oX := substr(x, 4)::bigint;
  x := osv_office('t1', 'adm', true, NULL, 'registrar', '', '', true);
  INSERT INTO rr VALUES (x = 'An office with that name already exists.', 'O2 office names are unique per institution');
  x := osv_set_staff('stf1', false, 't1', o1, 'stf1', false, true);
  INSERT INTO rr VALUES (x = 'Only administrators appoint office staff.', 'O3 staff cannot appoint themselves (not admin)');
  x := osv_set_staff('adm', true, 't1', o1, 'adm', true, true);
  INSERT INTO rr VALUES (x = 'Ask another administrator to change your own office access.', 'O4 an administrator cannot appoint themselves');
  x := osv_set_staff('adm', true, 't1', oX, 'stf1', false, true);
  INSERT INTO rr VALUES (x = 'Office not found.', 'O5 cannot appoint to another institution''s office');
  PERFORM osv_set_staff('adm', true, 't1', o1, 'stf1', false, true);
  PERFORM osv_set_staff('adm', true, 't1', o1, 'stf2', false, true);
  PERFORM osv_set_staff('adm', true, 't1', o1, 'lead1', true, true);
  PERFORM osv_set_staff('adm', true, 't1', o2, 'fa1', false, true);

  x := osv_open('t1', 'key-0001', 'stu', oX, 'Room change please', '');
  INSERT INTO rr VALUES (x = 'That office is not taking requests.', 'R1 cannot send to another institution''s office');
  x := osv_open('t1', 'key-0001', 'stu', o1, 'Enrollment verification letter', 'For my insurance'); r1 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM osv_requests WHERE id = r1) = 'sent', 'R2 a student sends a request to the Registrar');
  x := osv_open('t1', 'key-0001', 'stu', o1, 'Enrollment verification letter', 'For my insurance');
  INSERT INTO rr VALUES (x = 'replay:' || r1 AND (SELECT count(*) FROM osv_requests WHERE requester_id = 'stu') = 1, 'R3 a retry replays, no duplicate');
  x := osv_open('t1', 'key-0001', 'stu', o1, 'Something else entirely', '');
  INSERT INTO rr VALUES (x = 'That request was already sent with different details. Refresh and try again.', 'R4 reused key with new content is refused');
  INSERT INTO rr VALUES ((SELECT reference FROM osv_requests WHERE id = r1) ~ '^OSV-[0-9A-F]{8}$', 'R5 reference is server-made');

  x := osv_step('t1', r1, 'fa1', 'claim', 1, '', NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Request not found.', 'R6 another office''s staff cannot see or take it');
  x := osv_step('t2', r1, 'stf1', 'claim', 1, '', NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Request not found.', 'R7 another institution cannot act on it');
  x := osv_step('t1', r1, 'stf1', 'claim', 1, '', NULL, NULL, NULL);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT state = 'claimed' AND assignee_id = 'stf1' FROM osv_requests WHERE id = r1), 'R8 office staff take it ' || coalesce(x,''));
  x := osv_step('t1', r1, 'stf2', 'claim', 1, '', NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'This request changed since you opened it. Refresh and try again.', 'R9 a stale version is refused');
  x := osv_step('t1', r1, 'stf2', 'claim', 2, '', NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Someone already has this request.', 'R10 two staff cannot both take it');
  x := osv_step('t1', r1, 'stf2', 'resolve', 2, 'Letter sent to your email.', 'done', NULL, NULL);
  INSERT INTO rr VALUES (x = 'Only the person handling this request resolves it.', 'R11 only the assignee resolves');
  x := osv_step('t1', r1, 'stf1', 'ask', 2, 'Which insurer?', NULL, NULL, NULL);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT state FROM osv_requests WHERE id = r1) = 'waiting_on_student', 'R12 assignee asks the student');
  x := osv_step('t1', r1, 'stf2', 'note', 3, 'Student had a prior hold.', NULL, NULL, NULL);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT internal FROM osv_messages WHERE request_id = r1 ORDER BY id DESC LIMIT 1), 'R13 staff add an internal note');
  x := osv_step('t1', r1, 'stu', 'note', 4, 'I am staff now', NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Internal notes are for staff of this office.', 'R14 the student cannot write internal notes');
  x := osv_step('t1', r1, 'stu', 'reply', 4, 'Blue Cross', NULL, NULL, NULL);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT state FROM osv_requests WHERE id = r1) = 'claimed', 'R15 student reply returns it to the handler');
  x := osv_step('t1', r1, 'stf1', 'resolve', 5, 'short', 'done', NULL, NULL);
  INSERT INTO rr VALUES (x = 'Write what was done (10+ characters). The student sees this.', 'R16 resolution needs a summary');
  x := osv_step('t1', r1, 'stf1', 'resolve', 5, 'Letter emailed to you and the insurer.', 'nope', NULL, NULL);
  INSERT INTO rr VALUES (x = 'Choose an outcome.', 'R17 resolution needs an outcome');
  x := osv_step('t1', r1, 'stf1', 'resolve', 5, 'Letter emailed to you and the insurer.', 'done', NULL, NULL);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT state = 'resolved' AND outcome = 'done' FROM osv_requests WHERE id = r1), 'R18 assignee resolves');
  x := osv_step('t1', r1, 'stu', 'reopen', 6, 'Insurer says nothing arrived.', NULL, NULL, NULL);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT state = 'claimed' AND reopen_count = 1 AND assignee_id = 'stf1' AND resolution = '' FROM osv_requests WHERE id = r1), 'R19 student reopens once, back to the same handler');
  PERFORM osv_step('t1', r1, 'stf1', 'resolve', 7, 'Resent to the insurer fax line.', 'done', NULL, NULL);
  x := osv_step('t1', r1, 'stu', 'reopen', 8, 'Still nothing from them.', NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'This request was already reopened once. Send a new request.', 'R20 only one reopen');
  x := osv_step('t1', r1, 'stu', 'confirm', 8, '', NULL, NULL, NULL);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT state FROM osv_requests WHERE id = r1) = 'closed', 'R21 student confirms; closed');
  x := osv_step('t1', r1, 'stu', 'withdraw', 9, '', NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'This request is finished.', 'R22 a closed request is final');

  x := osv_open('t1', 'key-0002', 'stf1', o1, 'My own transcript question', ''); r2 := substr(x, 4)::bigint;
  x := osv_step('t1', r2, 'stf1', 'claim', 1, '', NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Only staff of this office can take it, and not on a request you sent.', 'R23 staff cannot handle their own request');
  x := osv_step('t1', r2, 'lead1', 'assign', 1, '', NULL, 'stf1', NULL);
  INSERT INTO rr VALUES (x = 'Assign it to a staff member of this office who did not send it.', 'R24 the lead cannot assign it to its sender');
  x := osv_step('t1', r2, 'stf2', 'assign', 1, '', NULL, 'stf2', NULL);
  INSERT INTO rr VALUES (x = 'Only the office lead assigns requests.', 'R25 only the lead assigns');
  x := osv_step('t1', r2, 'lead1', 'refer', 1, 'Belongs to aid office', NULL, NULL, oX);
  INSERT INTO rr VALUES (x = 'Choose another office at your institution.', 'R26 cannot refer to another institution');
  x := osv_step('t1', r2, 'lead1', 'refer', 1, 'This is about aid disbursement, not records.', NULL, NULL, o2);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT office_id = o2 AND state = 'sent' AND assignee_id IS NULL FROM osv_requests WHERE id = r2), 'R27 referral moves it to the other office''s queue');
  x := osv_step('t1', r2, 'stf2', 'claim', 2, '', NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Request not found.', 'R28 the old office loses access after referral');
  x := osv_step('t1', r2, 'fa1', 'claim', 2, '', NULL, NULL, NULL);
  INSERT INTO rr VALUES (x IS NULL, 'R29 the new office takes it');
  PERFORM osv_set_staff('adm', true, 't1', o2, 'fa1', false, false);
  x := osv_step('t1', r2, 'fa1', 'resolve', 3, 'Disbursement date confirmed.', 'answered', NULL, NULL);
  INSERT INTO rr VALUES (x = 'Request not found.', 'R30 a revoked appointment stops working at once');

  x := osv_article('t1', 'stu', 'draft', NULL, NULL, o1, 'How to get an enrollment letter', 'Open Help, choose Registrar, and ask for an enrollment verification letter.', NULL, NULL);
  INSERT INTO rr VALUES (x = 'Only staff of that office write its articles.', 'K1 only office staff draft articles');
  x := osv_article('t1', 'stf1', 'draft', NULL, NULL, o1, 'How to get an enrollment letter', 'Open Help, choose Registrar, and ask for an enrollment verification letter.', NULL, NULL); a1 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'K2 staff draft an article');
  x := osv_article('t1', 'stf1', 'submit', a1, 1, NULL, NULL, NULL, NULL, NULL);
  SELECT version, osv_text_hash(title, body) INTO v, h FROM osv_articles WHERE id = a1;
  x := osv_article('t1', 'stf1', 'publish', a1, v, NULL, NULL, NULL, h, NULL);
  INSERT INTO rr VALUES (x = 'You wrote this article, so another staff member reviews it.', 'K3 the author cannot publish their own');
  x := osv_article('t1', 'fa1', 'publish', a1, v, NULL, NULL, NULL, h, NULL);
  INSERT INTO rr VALUES (x = 'Article not found.', 'K4 staff of another (or revoked) office cannot review');
  x := osv_article('t1', 'stf2', 'publish', a1, v, NULL, NULL, NULL, 'not-the-text', NULL);
  INSERT INTO rr VALUES (x = 'The text changed since you opened it. Reload and review again.', 'K5 publishing is bound to the text the reviewer saw');
  x := osv_article('t1', 'stf2', 'publish', a1, v, NULL, NULL, NULL, h, 'Checked against the registrar policy');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state = 'published' AND reviewer_id = 'stf2' FROM osv_articles WHERE id = a1), 'K6 a second staff member publishes');
  SELECT version INTO v FROM osv_articles WHERE id = a1;
  x := osv_article('t1', 'stf1', 'edit', a1, v, NULL, 'Changed title here', 'Changed body that is long enough to be accepted as an answer.', NULL, NULL);
  INSERT INTO rr VALUES (x = 'Only drafts can be edited. Published text changes through a revision.', 'K7 published text is never edited in place');
  x := osv_article('t1', 'stf1', 'revise', a1, v, NULL, NULL, NULL, NULL, NULL); a2 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT supersedes = a1 AND state = 'draft' FROM osv_articles WHERE id = a2) AND (SELECT state FROM osv_articles WHERE id = a1) = 'published', 'K8 a revision is a new draft; the old one stays live');
  PERFORM osv_article('t1', 'stf1', 'edit', a2, 1, NULL, 'How to get an enrollment letter', 'Open Help, choose Registrar, ask for an enrollment letter. It arrives in 2 days.', NULL, NULL);
  PERFORM osv_article('t1', 'stf1', 'submit', a2, 2, NULL, NULL, NULL, NULL, NULL);
  SELECT version, osv_text_hash(title, body) INTO v, h FROM osv_articles WHERE id = a2;
  x := osv_article('t1', 'lead1', 'publish', a2, v, NULL, NULL, NULL, h, 'Updated timing');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM osv_articles WHERE id = a1) = 'retired' AND (SELECT state FROM osv_articles WHERE id = a2) = 'published', 'K9 publishing the revision retires the old one');
  got := false; BEGIN UPDATE osv_articles SET reviewer_id = author_id WHERE id = a2; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'K10 the table refuses self-review');
  got := false; BEGIN UPDATE osv_requests SET state = 'resolved', resolution = '' WHERE id = r2; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'K11 the table refuses a resolution without a summary');
  got := false; BEGIN DELETE FROM osv_events WHERE subject_id = r1; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'K12 history is append-only');
  got := false; BEGIN UPDATE osv_messages SET body = 'edited' WHERE request_id = r1; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'K13 messages are append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 900)); } };
  await go('real:', OSV_MIGRATION);
  const muts: [string, string, string][] = [
    ['own-request (R23)', `IF NOT staff OR mine THEN RETURN 'Only staff of this office can take it`, `IF NOT staff THEN RETURN 'Only staff of this office can take it`],
    ['cross-office visibility (R6, R28)', `IF NOT staff AND NOT mine THEN RETURN 'Request not found.'; END IF;`, ``],
    ['self-publish (K3; constraint must still stop it)', `IF a.author_id = p_actor THEN RETURN 'You wrote this article`, `IF false THEN RETURN 'You wrote this article`],
    ['unseen text (K5)', `IF p_seen IS DISTINCT FROM osv_text_hash(a.title, a.body) THEN`, `IF false THEN`],
    ['revocation (R30)', `AND office_id = p_office AND user_id = p_user AND revoked_at IS NULL) $$`, `AND office_id = p_office AND user_id = p_user) $$`],
  ];
  for (const [name, from, to] of muts) {
    const m = OSV_MIGRATION.map((q) => q.replace(from, () => to));
    console.log(`${name} mutant applied:`, m.join('') !== OSV_MIGRATION.join(''));
    await go(`mutant ${name}:`, m);
  }
}
