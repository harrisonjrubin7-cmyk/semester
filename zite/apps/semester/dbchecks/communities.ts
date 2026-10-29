import { neon } from '@neondatabase/serverless';
import { CMY_MIGRATION } from '../src/lib/cmyMigration';

// Community Manager "setup" and joining rules (lib/cmyMigration.ts). One rolled-back transaction with synthetic ids.
// Run on app jeabiv2536: import { run } from './dbchecks/communities'; await run();
export const CHECKS = `DO $$
DECLARE x text; rq bigint; got boolean; v int;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO rr VALUES (cmy_set_staff('cm1', false, 't1', 'cm1', true) = 'Only administrators appoint community managers.', 'C1 only administrators appoint managers');
  INSERT INTO rr VALUES (cmy_set_staff('adm', true, 't1', 'adm', true) = 'Ask another administrator to change your own access.', 'C2 no self-appointment');
  PERFORM cmy_set_staff('adm', true, 't1', 'cm1', true); PERFORM cmy_set_staff('adm', true, 't1', 'cm2', true);
  x := cmy_setup('t1', 'stu', 'create', 'g1', 't1', 'Community', NULL, 'Commuters', 'Be kind, stay on topic, no selling. Share rides only in the rides thread.', 'request');
  INSERT INTO rr VALUES (x = 'Only community managers set up communities.', 'C3 only managers set up communities');
  x := cmy_setup('t1', 'cm1', 'create', 'gX', 't2', 'Community', NULL, 'Other', 'Be kind, stay on topic, no selling. Share rides only in the rides thread.', 'open');
  INSERT INTO rr VALUES (x = 'Community not found.', 'C4 another institution''s group cannot be set up');
  x := cmy_setup('t1', 'cm1', 'create', 'gc', 't1', 'Course Discussion', NULL, 'Course', 'Be kind, stay on topic, no selling. Share rides only in the rides thread.', 'open');
  INSERT INTO rr VALUES (x = 'Community not found.', 'C5 a course discussion is not a community');
  x := cmy_setup('t1', 'cm1', 'create', 'g1', 't1', 'Community', NULL, 'Commuters', 'Be kind.', 'request');
  INSERT INTO rr VALUES (x = 'Write the community guidelines (40+ characters). Moderators cite them.', 'C6 guidelines are required');
  x := cmy_setup('t1', 'cm1', 'create', 'g1', 't1', 'Community', NULL, 'Commuters', 'Be kind, stay on topic, no selling. Share rides only in the rides thread.', 'request');
  INSERT INTO rr VALUES (x IS NULL, 'C7 a manager sets up a request-to-join community');

  INSERT INTO rr VALUES (cmy_can_join('t1', 'stu', 'gc', 't1', 'Course Discussion', '') = 'Course discussions follow class enrollment. Join through your course.', 'C8 nobody joins a course discussion from Campus (the bug fixed here)');
  INSERT INTO rr VALUES (cmy_can_join('t1', 'stu', 'g9', NULL, 'Club', '') = 'That group is not at your institution.', 'C9 a group with no institution is refused');
  INSERT INTO rr VALUES (cmy_can_join('t1', 'stu', 'gX', 't2', 'Community', '') = 'That group is not at your institution.', 'C10 another institution''s group is refused');
  INSERT INTO rr VALUES (cmy_can_join('t1', 'stu', 'gU', 't1', 'Community', '') = 'join', 'C11 a community without setup stays open (unchanged behaviour)');
  INSERT INTO rr VALUES (cmy_can_join('t1', 'stu', 'g1', 't1', 'Community', 'I commute from Riverside') = 'requested', 'C12 request policy creates a request, not a membership');
  INSERT INTO rr VALUES (cmy_can_join('t1', 'stu', 'g1', 't1', 'Community', '') = 'You already asked to join.', 'C13 one pending request');
  SELECT id INTO rq FROM cmy_requests WHERE user_id = 'stu' AND group_id = 'g1';
  INSERT INTO rr VALUES (cmy_decide('t1', 'stu', rq, true, '') = 'error:Only community managers decide join requests.', 'C14 the person cannot approve themselves');
  INSERT INTO rr VALUES (cmy_decide('t2', 'cm1', rq, true, '') = 'error:Only community managers decide join requests.', 'C15 another institution cannot decide');
  INSERT INTO rr VALUES (cmy_decide('t1', 'cm1', rq, false, 'no') = 'error:Say why (10+ characters). The person sees this.', 'C16 declining needs a reason');
  INSERT INTO rr VALUES (cmy_decide('t1', 'cm1', rq, true, '') = 'stu', 'C17 approving returns the person to add');
  INSERT INTO rr VALUES (cmy_decide('t1', 'cm2', rq, false, 'Changed my mind on this') = 'error:This request was already decided.', 'C18 a decision is final');
  PERFORM cmy_can_join('t1', 'cm2', 'g1', 't1', 'Community', '');
  SELECT id INTO rq FROM cmy_requests WHERE user_id = 'cm2' AND group_id = 'g1';
  INSERT INTO rr VALUES (cmy_decide('t1', 'cm2', rq, true, '') = 'error:Another manager decides your own request.', 'C19 a manager cannot approve their own request');

  SELECT version INTO v FROM cmy_communities WHERE group_id = 'g1';
  INSERT INTO rr VALUES (cmy_setup('t1', 'cm1', 'archive', 'g1', 't1', 'Community', v, NULL, NULL, NULL) IS NULL, 'C20 a manager archives a community');
  INSERT INTO rr VALUES ((SELECT state FROM cmy_requests WHERE id = rq) = 'declined', 'C21 archiving declines pending requests');
  INSERT INTO rr VALUES (cmy_can_join('t1', 'new', 'g1', 't1', 'Community', '') = 'This community is archived and not taking new members.', 'C22 an archived community takes no members');
  INSERT INTO rr VALUES (cmy_setup('t1', 'cm1', 'edit', 'g1', 't1', 'Community', v, 'x', NULL, NULL) = 'This community changed since you opened it. Refresh and try again.', 'C23 stale version refused');
  PERFORM cmy_set_staff('adm', true, 't1', 'cm1', false);
  INSERT INTO rr VALUES (cmy_setup('t1', 'cm1', 'reopen', 'g1', 't1', 'Community', v + 1, NULL, NULL, NULL) = 'Only community managers set up communities.', 'C24 a revoked manager loses access at once');
  got := false; BEGIN UPDATE cmy_requests SET decided_by = user_id WHERE id = rq; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'C25 the table refuses deciding your own request');
  got := false; BEGIN DELETE FROM cmy_events; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'C26 history is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 700)); } };
  await go('real:', CMY_MIGRATION);
  const muts: [string, string, string][] = [
    ['course discussion join (C8)', `IF p_group_kind = 'Course Discussion' THEN RETURN`, `IF false THEN RETURN`],
    ['cross-institution join (C9, C10)', `IF p_group_tenant IS NULL OR p_group_tenant <> p_tenant THEN RETURN`, `IF false THEN RETURN`],
    ['request policy ignored (C12)', `IF c.join_policy = 'open' THEN RETURN 'join'; END IF;`, `RETURN 'join';`],
    ['self-decide (C19; constraint must still stop it)', `IF r.user_id = p_actor THEN RETURN 'error:Another manager`, `IF false THEN RETURN 'error:Another manager`],
  ];
  for (const [name, from, to] of muts) { const m = CMY_MIGRATION.map((q) => q.replace(from, () => to)); console.log(`${name} applied:`, m.join('') !== CMY_MIGRATION.join('')); await go(`mutant ${name}:`, m); }
}
