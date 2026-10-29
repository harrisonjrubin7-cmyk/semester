import { neon } from '@neondatabase/serverless';
import { MOD_MIGRATION } from '../src/lib/modMigration';

// Moderator: reports, contextual review, enforcement, warnings, reversible actions, appeals (lib/modMigration.ts).
// One rolled-back transaction with synthetic people and message ids. Run on app jeabiv2536:
// import { run } from './dbchecks/moderation'; await run();
export const CHECKS = `DO $$
DECLARE x text; c jsonb; w bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO rr VALUES (mod_set_staff('m1', 't1', 'm1', true) = 'You cannot change your own moderator access.', 'M1 nobody appoints themselves');
  PERFORM mod_set_staff('adm', 't1', 'm1', true); PERFORM mod_set_staff('adm', 't1', 'm2', true); PERFORM mod_set_staff('adm', 't1', 'm3', true);
  INSERT INTO rr VALUES (mod_report('aut', 't1', 'zz-r0', 'msg0', 'aut', 'spam spam', 'x') = 'You can delete your own post instead of reporting it.', 'M2 no reporting your own post');
  PERFORM mod_report('rep', 't1', 'zz-r1', 'msg1', 'aut', 'Insulting another student', 'You are all idiots');
  PERFORM mod_report('rep', 't1', 'zz-r2', 'msg2', 'aut', 'Off-topic advertising', 'Buy my notes');
  PERFORM mod_report('rep', 't1', 'zz-r9', 'msg9', 'other', 'Spam link', 'click here');

  c := mod_context('m1', 't1', 'zz-r1');
  INSERT INTO rr VALUES ((c->>'reportsOnThisPost')::int = 1 AND (c->>'reporterTargetsAuthor')::int = 2 AND (c->>'reporterReports90d')::int = 3, 'M3 context shows report counts for the post and the reporter ' || coalesce(c::text, 'null'));
  INSERT INTO rr VALUES (mod_context('rep', 't1', 'zz-r1') IS NULL AND mod_context('aut', 't1', 'zz-r1') IS NULL, 'M4 non-moderators get no context');
  PERFORM mod_set_staff('adm', 't1', 'rep', true);
  INSERT INTO rr VALUES (mod_context('rep', 't1', 'zz-r1') IS NULL, 'M5 a moderator who filed the report gets no context');
  PERFORM mod_set_staff('adm', 't1', 'rep', false);
  INSERT INTO rr VALUES (mod_context('m1', 't2', 'zz-r1') IS NULL, 'M6 no context across institutions');

  INSERT INTO rr VALUES (mod_decide('m1', 't1', 'zz-r1', 'hide', 'short') = 'Cite the community guideline and why it applies (10+ characters).', 'M7 enforcement cites a guideline');
  INSERT INTO rr VALUES (mod_decide('m1', 't1', 'zz-r1', 'hide', 'Guideline 2: no personal insults') IS NULL, 'M8 a moderator hides a post');
  INSERT INTO rr VALUES (EXISTS (SELECT 1 FROM mod_hidden('t1') WHERE message_id = 'msg1'), 'M9 the post is hidden');
  c := mod_context('m2', 't1', 'zz-r2');
  INSERT INTO rr VALUES ((c->>'authorDecisions12m')::int = 1, 'M10 context counts the author''s earlier decision');

  x := mod_warn('rep', 't1', 'aut', 'zz-r2', 'Guideline 4: no advertising', 'Please do not advertise in course groups.', 30);
  INSERT INTO rr VALUES (x = 'Only moderators issue warnings.', 'M11 only moderators warn');
  x := mod_warn('m1', 't1', 'm1', NULL, 'Guideline 4: no advertising', 'Please do not advertise in course groups.', 30);
  INSERT INTO rr VALUES (x = 'Warn someone other than yourself.', 'M12 nobody warns themselves');
  x := mod_warn('m1', 't1', 'other', 'zz-r2', 'Guideline 4: no advertising', 'Please do not advertise in course groups.', 30);
  INSERT INTO rr VALUES (x = 'Report not found.', 'M13 a warning tied to a report must name that report''s author');
  x := mod_warn('m1', 't1', 'aut', 'zz-r2', 'Guideline 4: no advertising', 'Please do not advertise in course groups.', 365);
  INSERT INTO rr VALUES (x = 'A warning lasts 7 to 180 days.', 'M14 warnings expire within 180 days');
  x := mod_warn('m1', 't1', 'aut', 'zz-r2', 'Guideline 4: no advertising', 'Please do not advertise in course groups.', 30); w := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND NOT EXISTS (SELECT 1 FROM mod_hidden('t1') WHERE message_id = 'msg2'), 'M15 a warning hides nothing');
  c := mod_context('m2', 't1', 'zz-r2');
  INSERT INTO rr VALUES ((c->>'authorActiveWarnings')::int = 1, 'M16 context counts active warnings');
  INSERT INTO rr VALUES (mod_withdraw_warning('m2', 't1', w, 'short') = 'Say why it is withdrawn (10+ characters).', 'M17 withdrawal needs a reason');
  x := mod_withdraw_warning('m2', 't1', w, 'Ad was a club event the group allows');
  c := mod_context('m3', 't1', 'zz-r2');
  INSERT INTO rr VALUES (x IS NULL AND (c->>'authorActiveWarnings')::int = 0, 'M18 a withdrawn warning no longer counts');

  INSERT INTO rr VALUES (mod_reverse('m1', 't1', 'zz-r1', 'I decided this one and want to undo it') = 'A moderator who was not involved reverses a decision.', 'M19 the decider cannot reverse their own decision');
  INSERT INTO rr VALUES (mod_reverse('m2', 't1', 'zz-r1', 'too short') = 'Explain why it is reversed (20+ characters). The author sees this.', 'M20 reversal needs a reason');
  INSERT INTO rr VALUES (mod_reverse('m2', 't1', 'zz-r9', 'Nothing decided yet on this report') = 'There is no hide or remove decision in force to reverse.', 'M21 only a hide/remove in force is reversed');
  PERFORM mod_set_staff('admB', 't2', 'mB', true);
  INSERT INTO rr VALUES (mod_reverse('mB', 't2', 'zz-r1', 'Context shows this was quoting a novel') = 'Report not found.', 'M22 another institution''s moderator cannot reverse it');
  x := mod_reverse('m2', 't1', 'zz-r1', 'Context shows this was quoting a novel');
  INSERT INTO rr VALUES (x IS NULL AND NOT EXISTS (SELECT 1 FROM mod_hidden('t1') WHERE message_id = 'msg1'), 'M23 a reversal makes the post visible again ' || coalesce(x, ''));
  INSERT INTO rr VALUES (mod_reverse('m3', 't1', 'zz-r1', 'Reversing the reversal for some reason') = 'This decision was already reversed.', 'M24 a reversal is final');
  INSERT INTO rr VALUES (mod_appeal('aut', 't1', 'zz-r1', 'I want to appeal even though it was reversed already') = 'This decision was already reversed.', 'M25 nothing left to appeal after a reversal');
  c := mod_context('m3', 't1', 'zz-r2');
  INSERT INTO rr VALUES ((c->>'authorDecisions12m')::int = 0, 'M26 a reversed decision no longer counts against the author');

  PERFORM mod_decide('m1', 't1', 'zz-r9', 'remove', 'Guideline 5: no spam links');
  INSERT INTO rr VALUES (mod_appeal('other', 't1', 'zz-r9', 'It was a link to the official library page') IS NULL, 'M27 the author appeals');
  INSERT INTO rr VALUES (mod_review_appeal('m1', 't1', 'zz-r9', 'overturned', 'Library link is allowed') = 'Appeals are reviewed by a moderator who was not involved.', 'M28 the decider cannot review the appeal');
  INSERT INTO rr VALUES (mod_review_appeal('m2', 't1', 'zz-r9', 'upheld', 'Shortened link hid the destination') IS NULL, 'M29 another moderator reviews it');
  INSERT INTO rr VALUES (mod_reverse('m2', 't1', 'zz-r9', 'Changing my own appeal outcome now') = 'A moderator who was not involved reverses a decision.', 'M30 the appeal reviewer cannot also reverse it');
  got := false; BEGIN INSERT INTO mod_reversals (report_id, tenant_id, reversed_by, decided_by, reason) VALUES ('zz-r9', 't1', 'm1', 'm1', 'self reversal attempt here'); EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'M31 the table refuses a self-reversal');
  got := false; BEGIN DELETE FROM mod_reversals WHERE report_id = 'zz-r1'; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'M32 reversals are append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 700)); } };
  await go('real:', MOD_MIGRATION);
  const muts: [string, string, string][] = [
    ['decider reverses (M19; constraint must still stop it)', `IF p_actor IN (r.decided_by, r.author_id, r.reporter_id) OR p_actor = coalesce(r.appeal_by, '') THEN RETURN 'A moderator who was not involved`, `IF false THEN RETURN 'A moderator who was not involved`],
    ['reversal ignored by visibility (M23)', `AND NOT EXISTS (SELECT 1 FROM mod_reversals v WHERE v.report_id = r.id) $$`, ` $$`],
    ['context for involved (M5)', `IF NOT FOUND OR r.tenant_id <> p_tenant OR p_actor IN (r.author_id, r.reporter_id) THEN RETURN NULL; END IF;`, `IF NOT FOUND OR r.tenant_id <> p_tenant THEN RETURN NULL; END IF;`],
    ['withdrawn warnings counted (M18)', `AND w.withdrawn_at IS NULL AND w.expires_at > now()`, `AND w.expires_at > now()`],
  ];
  for (const [name, from, to] of muts) { const m = MOD_MIGRATION.map((q) => q.replace(from, () => to)); console.log(`${name} applied:`, m.join('') !== MOD_MIGRATION.join('')); await go(`mutant ${name}:`, m); }
}
