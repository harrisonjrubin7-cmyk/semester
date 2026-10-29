import { neon } from '@neondatabase/serverless';
import { CMY_MIGRATION } from '../src/lib/cmyMigration';
import { CNA_MIGRATION } from '../src/lib/cnaMigration';

// Community announcements (lib/cnaMigration.ts). One rolled-back transaction, synthetic ids.
// Run on app jeabiv2536: import { run } from './dbchecks/announcements'; await run();
const G = `'Members follow the community guidelines and keep discussion respectful.'`;
export const CHECKS = `DO $$
DECLARE x text; a1 bigint; a2 bigint; a3 bigint; h text; v int; got boolean; live boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO cmy_staff (tenant_id, user_id, granted_by) VALUES ('t1', 'cm1', 'adm'), ('t1', 'cm2', 'adm');
  INSERT INTO cmy_communities (group_id, tenant_id, guidelines, join_policy, created_by) VALUES ('gA', 't1', ${G}, 'open', 'cm1'), ('gB', 't1', ${G}, 'open', 'cm1'), ('gX', 't2', ${G}, 'open', 'cmX');
  INSERT INTO cmy_communities (group_id, tenant_id, guidelines, join_policy, created_by, state) VALUES ('gOld', 't1', ${G}, 'open', 'cm1', 'archived');

  x := cna_step('t1', 'stu', 'draft', NULL, NULL, ARRAY['gA'], 'Welcome week', 'Join us on the quad Friday at noon.', false, false, NULL, NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Only a community manager posts announcements.', 'A1 only managers post');
  x := cna_step('t1', 'cm1', 'draft', NULL, NULL, ARRAY['gX'], 'Welcome week', 'Join us on the quad Friday at noon.', false, false, NULL, NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Announcements go only to active communities set up at your institution.', 'A2 another institution''s community refused');
  x := cna_step('t1', 'cm1', 'draft', NULL, NULL, ARRAY['gOld'], 'Welcome week', 'Join us on the quad Friday at noon.', false, false, NULL, NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Announcements go only to active communities set up at your institution.', 'A3 archived community refused');
  x := cna_step('t1', 'cm1', 'draft', NULL, NULL, ARRAY['gA'], 'Welcome week', 'Join us on the quad Friday at noon.', false, false, now() + interval '40 days', NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Schedule at most 30 days ahead.', 'A4 schedule bounded');
  x := cna_step('t1', 'cm1', 'draft', NULL, NULL, ARRAY['gA'], 'Welcome week', 'Join us on the quad Friday at noon.', false, false, NULL, now() + interval '200 days', NULL, NULL);
  INSERT INTO rr VALUES (x = 'An announcement expires after it goes live and within 90 days.', 'A5 expiry bounded');

  x := cna_step('t1', 'cm1', 'draft', NULL, NULL, ARRAY['gA'], 'Welcome week', 'Join us on the quad Friday at noon.', false, true, NULL, now() + interval '7 days', NULL, NULL); a1 := substr(x, 4)::bigint;
  x := cna_step('t1', 'cm1', 'submit', a1, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  SELECT cna_live(c) INTO live FROM cna_announcements c WHERE id = a1;
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND live, 'A6 one community, not important: live on submit');

  x := cna_step('t1', 'cm1', 'draft', NULL, NULL, ARRAY['gA', 'gB'], 'Library hours change', 'The library closes at 8pm during reading week.', false, false, NULL, NULL, NULL, NULL); a2 := substr(x, 4)::bigint;
  x := cna_step('t1', 'cm1', 'submit', a2, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  SELECT cna_live(c), body_hash, rev INTO live, h, v FROM cna_announcements c WHERE id = a2;
  INSERT INTO rr VALUES (NOT live AND (SELECT state FROM cna_announcements WHERE id = a2) = 'pending_approval', 'A7 several communities wait for a second manager');
  x := cna_step('t1', 'cm1', 'approve', a2, v, NULL, NULL, NULL, NULL, NULL, NULL, NULL, h, NULL);
  INSERT INTO rr VALUES (x = 'You wrote this, so another community manager approves it.', 'A8 no self-approval');
  x := cna_step('t1', 'cm2', 'approve', a2, v, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'stale', NULL);
  INSERT INTO rr VALUES (x = 'The announcement changed since you opened it. Reload and read it again.', 'A9 approval bound to the text seen');
  x := cna_step('t1', 'cm2', 'approve', a2, v, NULL, NULL, NULL, NULL, NULL, NULL, NULL, h, NULL);
  SELECT cna_live(c) INTO live FROM cna_announcements c WHERE id = a2;
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND live, 'A10 a second manager publishes it');

  x := cna_step('t1', 'cm1', 'draft', NULL, NULL, ARRAY['gB'], 'Boil water notice', 'Do not drink tap water in Hall B until further notice.', true, true, NULL, NULL, NULL, NULL); a3 := substr(x, 4)::bigint;
  x := cna_step('t1', 'cm1', 'submit', a3, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO rr VALUES ((SELECT state FROM cna_announcements WHERE id = a3) = 'pending_approval', 'A11 important announcements need a second manager');

  x := cna_step('t1', 'cm2', 'edit', a1, 2, ARRAY['gA'], 'Welcome week', 'Changed after publishing.', false, true, NULL, NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'A published announcement is not edited. Add a correction instead.', 'A12 published text is never edited');
  x := cna_step('t1', 'cm2', 'correct', a1, 2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Moved indoors to the student center due to rain.');
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT jsonb_array_length(corrections) FROM cna_announcements WHERE id = a1) = 1, 'A13 corrections are appended');

  x := cna_ack('t1', 'stu', a1, ARRAY['gB']);
  INSERT INTO rr VALUES (x = 'Announcement not found.', 'A14 non-members cannot acknowledge (or see it)');
  x := cna_ack('t1', 'stu', a1, ARRAY['gA']);
  x := cna_ack('t1', 'stu', a1, ARRAY['gA']);
  INSERT INTO rr VALUES (x IS NULL AND (SELECT count(*) FROM cna_acks WHERE announcement_id = a1) = 1, 'A15 a member acknowledges once');
  x := cna_ack('t1', 'stu', a2, ARRAY['gA']);
  INSERT INTO rr VALUES (x = 'This announcement does not ask for acknowledgement.', 'A16 acknowledgement only where asked');
  x := cna_step('t1', 'cm2', 'withdraw', a1, 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Event cancelled by the organizers');
  x := cna_ack('t1', 'stu2', a1, ARRAY['gA']);
  INSERT INTO rr VALUES (x = 'Announcement not found.', 'A17 a withdrawn announcement is gone for members');
  UPDATE cna_announcements SET publish_at = now() - interval '2 days', expires_at = now() - interval '1 day' WHERE id = a2;
  SELECT cna_live(c) INTO live FROM cna_announcements c WHERE id = a2;
  INSERT INTO rr VALUES (NOT live, 'A18 expired announcements are not live');

  got := false; BEGIN UPDATE cna_announcements SET state = 'approved', publish_at = now(), approver_id = NULL WHERE id = a3; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'A19 the table refuses an important announcement without a second manager');
  got := false; BEGIN DELETE FROM cna_events; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'A20 history is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...CMY_MIGRATION, ...CNA_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 700)); } };
  await go('real:', base);
  const muts: [string, string, string][] = [
    ['multi-community skips approval (A7)', `SELECT cardinality(a.group_ids) > 1 OR a.important $$`, `SELECT a.important $$`],
    ['self-approval (A8)', `IF a.author_id = p_actor THEN RETURN 'You wrote this`, `IF false THEN RETURN 'You wrote this`],
    ['published edited (A12)', `IF a.state NOT IN ('draft', 'pending_approval') THEN RETURN 'A published`, `IF false THEN RETURN 'A published`],
    ['non-member acknowledges (A14)', `OR NOT (a.group_ids && coalesce(p_member_of, '{}'))`, ``],
    ['expiry ignored (A18)', `AND (a.expires_at IS NULL OR a.expires_at > now()) $$`, ` $$`],
  ];
  for (const [name, from, to] of muts) { const m = base.map((q) => q.replace(from, () => to)); console.log(`${name} applied:`, m.join('') !== base.join('')); await go(`mutant ${name}:`, m); }
}
