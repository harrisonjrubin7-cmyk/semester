import { neon } from '@neondatabase/serverless';
import { SREQ_MIGRATION } from '../src/lib/sreqMigration';
import { TCP_MIGRATION } from '../src/lib/tcpMigration';

// Tenant control plane (lib/tcpMigration.ts): structure, policy, configuration, entitlements/quotas, rollout, flags, maintenance.
// One rolled-back transaction, synthetic ids. Run on app jeabiv2536: import { run } from './dbchecks/controlPlane'; await run();
const BODY = 'Students submit their own work. Collaboration is allowed only where the instructor says so in writing.';
export const CHECKS = `DO $$
DECLARE x text; c1 bigint; c2 bigint; s1 bigint; d1 bigint; p1 bigint; p2 bigint; h text; r int; w bigint; got boolean;
BEGIN
  CREATE TEMP TABLE rr (ok boolean, lbl text) ON COMMIT DROP;
  INSERT INTO inst_departments (tenant_id, name) VALUES ('t1', 'History') RETURNING id INTO d1;

  -- Structure
  x := tcp_unit('t1', 'stu', false, 'create', NULL, NULL, 'College of Arts', 'college', NULL, NULL);
  INSERT INTO rr VALUES (x = 'Only an institution administrator changes the structure.', 'C1 only administrators change structure');
  x := tcp_unit('t1', 'a1', true, 'create', NULL, NULL, 'College of Arts', 'college', NULL, NULL); c1 := substr(x, 4)::bigint;
  x := tcp_unit('t1', 'a1', true, 'create', NULL, NULL, 'School of Music', 'school', c1, NULL); s1 := substr(x, 4)::bigint;
  INSERT INTO rr VALUES (s1 IS NOT NULL AND (SELECT parent_id FROM tcp_units WHERE id = s1) = c1, 'C2 nested units');
  x := tcp_unit('t1', 'a1', true, 'create', NULL, NULL, 'college of arts', 'college', NULL, NULL);
  INSERT INTO rr VALUES (x = 'A unit with that name already exists.', 'C3 duplicate names refused');
  x := tcp_unit('t1', 'a1', true, 'move', c1, 1, NULL, NULL, s1, NULL);
  INSERT INTO rr VALUES (x = 'A unit cannot sit inside itself.', 'C4 no cycles');
  x := tcp_unit('t2', 'aB', true, 'create', NULL, NULL, 'Elsewhere', 'college', c1, NULL);
  INSERT INTO rr VALUES (x = 'Choose an active parent unit.', 'C5 another institution''s unit cannot be a parent');
  x := tcp_unit('t1', 'a1', true, 'assign_dept', s1, NULL, NULL, NULL, NULL, d1);
  INSERT INTO rr VALUES (x LIKE 'ok:%', 'C6 department assigned to a unit');
  x := tcp_unit('t1', 'a1', true, 'archive', c1, 1, NULL, NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Move or archive its units first.', 'C7 cannot archive a unit with children');
  x := tcp_unit('t1', 'a1', true, 'archive', s1, 1, NULL, NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Move its departments to another unit first.', 'C8 cannot archive a unit with departments');
  x := tcp_unit('t1', 'a1', true, 'rename', s1, 9, 'Music School', NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'Someone changed this unit. Reload and try again.', 'C9 expected version on structure');

  -- Policy
  x := tcp_policy('t1', 'a1', true, 'draft', NULL, NULL, 'academic_integrity', 'Academic integrity', '${BODY}', NULL); p1 := substr(x, 4)::bigint;
  SELECT body_hash INTO h FROM tcp_policies WHERE id = p1;
  x := tcp_policy('t1', 'a1', true, 'approve', p1, 1, NULL, NULL, NULL, h);
  INSERT INTO rr VALUES (x = 'You wrote this version, so another administrator approves it.', 'C10 no self-approval of policy');
  x := tcp_policy('t1', 'a2', true, 'approve', p1, 1, NULL, NULL, NULL, 'stale');
  INSERT INTO rr VALUES (x = 'The text changed since you opened it. Reload and read it again.', 'C11 approval bound to the text seen');
  x := tcp_policy('t1', 'a2', true, 'approve', p1, 1, NULL, NULL, NULL, h);
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM tcp_policies WHERE id = p1) = 'approved', 'C12 another administrator approves');
  x := tcp_policy('t1', 'a2', true, 'draft', NULL, NULL, 'academic_integrity', 'Academic integrity', '${BODY} Penalties follow the honor code.', NULL); p2 := substr(x, 4)::bigint;
  SELECT body_hash INTO h FROM tcp_policies WHERE id = p2;
  x := tcp_policy('t1', 'a1', true, 'approve', p2, 1, NULL, NULL, NULL, h);
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND (SELECT state FROM tcp_policies WHERE id = p1) = 'retired' AND (SELECT version FROM tcp_policies WHERE id = p2) = 2, 'C13 approving v2 retires v1');
  x := tcp_policy('t1', 'a1', true, 'edit', p2, 2, NULL, 'Academic integrity', '${BODY} edited after approval', NULL);
  INSERT INTO rr VALUES (x = 'Only a draft can be edited. Start a new version.', 'C14 approved policies are not edited in place');

  -- Configuration
  x := tcp_set('t1', 'a1', true, 'timezone', '"Mars/Olympus"', 0, 'Campus is in Nashville');
  INSERT INTO rr VALUES (x = 'Choose a valid time zone, like America/Chicago.', 'C15 settings are validated');
  x := tcp_set('t1', 'a1', true, 'late_grace_days', '30', 0, 'Generous grace period');
  INSERT INTO rr VALUES (x = 'Grace days are a whole number from 0 to 14.', 'C16 numeric bounds');
  x := tcp_set('t1', 'a1', true, 'favourite_colour', '"gold"', 0, 'Brand alignment');
  INSERT INTO rr VALUES (x = 'That setting is not configurable.', 'C17 only allow-listed keys');
  x := tcp_set('t1', 'a1', true, 'timezone', '"America/Chicago"', 0, 'Campus is in Nashville');
  INSERT INTO rr VALUES (x IS NULL, 'C18 setting saved');
  x := tcp_set('t1', 'a2', true, 'timezone', '"America/New_York"', 0, 'Stale screen trying again');
  INSERT INTO rr VALUES (x = 'Someone changed this setting. Reload and try again.', 'C19 expected version on settings');

  -- Entitlements, quotas
  x := tcp_entitle('a1', false, 't1', 'family_portal', true, NULL, NULL, 0, 'Order form 2026-114');
  INSERT INTO rr VALUES (x = 'Only a platform admin changes entitlements.', 'C20 institution admins cannot entitle themselves');
  x := tcp_roll('t1', 'a1', true, 'family_portal', 'pilot', ARRAY['Student'], 0, 'Try with a few students');
  INSERT INTO rr VALUES (x = 'Your institution is not entitled to this module.', 'C21 no rollout without entitlement');
  x := tcp_entitle('pl1', true, 't1', 'family_portal', true, 500, 1000, 0, 'Order form 2026-114');
  INSERT INTO rr VALUES (x IS NULL AND tcp_entitled('t1', 'family_portal') AND NOT tcp_entitled('t2', 'family_portal'), 'C22 platform admin grants one institution');
  INSERT INTO rr VALUES (tcp_quota_ok('t1', 'family_portal', 999) AND NOT tcp_quota_ok('t1', 'family_portal', 1000) AND NOT tcp_quota_ok('t2', 'family_portal', 0), 'C23 daily call quota');

  -- Rollout
  x := tcp_roll('t1', 'a1', true, 'family_portal', 'all', NULL, 0, 'Everyone at once please');
  INSERT INTO rr VALUES (x = 'Run a pilot before turning it on for everyone.', 'C24 pilot first');
  x := tcp_roll('t1', 'a1', true, 'family_portal', 'pilot', ARRAY['Student'], 0, 'Try with a few students');
  INSERT INTO rr VALUES (x IS NULL AND tcp_module_on('t1', 'family_portal', ARRAY['Student']) AND NOT tcp_module_on('t1', 'family_portal', ARRAY['Faculty']), 'C25 pilot reaches only its roles');
  x := tcp_roll('t1', 'a2', true, 'family_portal', 'all', NULL, 1, 'Pilot went well');
  INSERT INTO rr VALUES (x = 'Let the pilot run for at least a day first.', 'C26 pilot runs a day');
  UPDATE tcp_rollouts SET pilot_at = now() - interval '2 days' WHERE tenant_id = 't1' AND module = 'family_portal';
  x := tcp_roll('t1', 'a1', true, 'family_portal', 'all', NULL, 1, 'Pilot went well');
  INSERT INTO rr VALUES (x = 'You started the pilot, so another administrator turns it on for everyone.', 'C27 two people to go institution-wide');
  x := tcp_roll('t1', 'a2', true, 'family_portal', 'all', NULL, 1, 'Pilot went well');
  INSERT INTO rr VALUES (x IS NULL AND tcp_module_on('t1', 'family_portal', ARRAY['Faculty']), 'C28 on for everyone');
  x := tcp_entitle('pl1', true, 't1', 'family_portal', false, NULL, NULL, 1, 'Contract ended 2026-10');
  INSERT INTO rr VALUES (x IS NULL AND NOT tcp_module_on('t1', 'family_portal', ARRAY['Student']) AND (SELECT stage FROM tcp_rollouts WHERE tenant_id = 't1' AND module = 'family_portal') = 'off', 'C29 revoking the entitlement turns it off');

  -- Maintenance
  x := tcp_maint('pl1', true, 'schedule', NULL, 't1', 'Database upgrade', 'Pages may be slow for ten minutes', now() + interval '10 minutes', now() + interval '1 hour');
  INSERT INTO rr VALUES (x = 'Schedule maintenance at least an hour ahead.', 'C30 maintenance needs notice');
  x := tcp_maint('pl1', true, 'schedule', NULL, 't1', 'Database upgrade', 'Pages may be slow for ten minutes', now() + interval '2 hours', now() + interval '12 hours');
  INSERT INTO rr VALUES (x = 'A window ends after it starts and lasts at most 8 hours.', 'C31 windows are bounded');
  x := tcp_maint('pl1', true, 'schedule', NULL, 't1', 'Database upgrade', 'Pages may be slow for ten minutes', now() + interval '2 hours', now() + interval '3 hours'); w := substr(x, 4)::bigint;
  UPDATE tcp_maintenance SET starts_at = now() - interval '5 minutes', ends_at = now() + interval '1 hour' WHERE id = w;
  x := tcp_entitle('pl1', true, 't1', 'payments', true, NULL, NULL, 0, 'Order form 2026-115');
  x := tcp_roll('t1', 'a1', true, 'payments', 'pilot', ARRAY['Student'], 0, 'Try with a few students');
  INSERT INTO rr VALUES (x = 'A maintenance window is in progress. Try again after it ends.' AND tcp_in_maintenance('t1') AND NOT tcp_in_maintenance('t2'), 'C32 no rollout changes during maintenance');
  x := tcp_maint('pl1', true, 'cancel', w, NULL, NULL, NULL, NULL, NULL);
  INSERT INTO rr VALUES (x LIKE 'ok:%' AND NOT tcp_in_maintenance('t1'), 'C33 cancelling ends the window');

  -- Flags
  x := tcp_flag('pl1', true, 'define', 'grading.new_editor', NULL, NULL, NULL, 'New rubric grading editor');
  x := tcp_flag('pl1', true, 'propose', 'grading.new_editor', 1, true, NULL, 'Ready after beta at two schools');
  INSERT INTO rr VALUES (x IS NULL AND NOT tcp_flag_on('t1', 'grading.new_editor'), 'C34 a proposal changes nothing yet');
  x := tcp_flag('pl1', true, 'approve', 'grading.new_editor', 2, NULL, NULL, NULL);
  INSERT INTO rr VALUES (x = 'You proposed this, so another platform admin approves it.', 'C35 two people to turn a default on');
  x := tcp_flag('pl2', true, 'override', 'grading.new_editor', 2, false, 't2', 'School asked to wait until spring');
  x := tcp_flag('pl2', true, 'approve', 'grading.new_editor', 3, NULL, NULL, NULL);
  INSERT INTO rr VALUES (x IS NULL AND tcp_flag_on('t1', 'grading.new_editor') AND NOT tcp_flag_on('t2', 'grading.new_editor'), 'C36 default on, override respected');
  x := tcp_flag('pl1', true, 'kill', 'grading.new_editor', 4, NULL, NULL, 'Editor losing rubric comments');
  INSERT INTO rr VALUES (x IS NULL AND NOT tcp_flag_on('t1', 'grading.new_editor'), 'C37 kill switch acts at once');
  x := tcp_flag('a1', false, 'kill', 'grading.new_editor', 5, NULL, NULL, 'Institution admin tries');
  INSERT INTO rr VALUES (x = 'Only a platform admin changes flags.', 'C38 only platform admins change flags');

  got := false; BEGIN UPDATE tcp_policies SET approver_id = author_id WHERE id = p1; EXCEPTION WHEN check_violation THEN got := true; END;
  INSERT INTO rr VALUES (got, 'C39 the table refuses self-approval');
  got := false; BEGIN DELETE FROM tcp_events; EXCEPTION WHEN OTHERS THEN got := true; END;
  INSERT INTO rr VALUES (got, 'C40 history is append-only');
  RAISE EXCEPTION 'RESULT pass=% fails=% [%]', (SELECT count(*) FROM rr WHERE ok IS TRUE), (SELECT count(*) FROM rr WHERE ok IS NOT TRUE),
    coalesce((SELECT string_agg(lbl, ' | ') FROM rr WHERE ok IS NOT TRUE), '');
END $$`;

export async function run() {
  const sql = neon(process.env.ZITE_POSTGRES_URL!);
  const base = [...SREQ_MIGRATION, ...TCP_MIGRATION];
  const go = async (label: string, mig: string[]) => { try { await sql.transaction([...mig.map((q) => sql.query(q)), sql.query(CHECKS)]); console.log(label, 'no RESULT raised'); } catch (e) { console.log(label, String((e as Error).message).slice(0, 700)); } };
  await go('real:', base);
  const muts: [string, string, string][] = [
    ['all without pilot (C24)', `IF NOT FOUND OR r.stage <> 'pilot' THEN RETURN`, `IF false THEN RETURN`],
    ['same admin goes wide (C27)', `IF r.pilot_by = p_actor THEN RETURN`, `IF false THEN RETURN`],
    ['revoke leaves rollout on (C29)', `UPDATE tcp_rollouts SET stage = 'off', pilot_roles = '{}', updated_by = p_actor`, `UPDATE tcp_rollouts SET updated_by = p_actor`],
    ['rollout during maintenance (C32)', `IF tcp_in_maintenance(p_tenant) THEN RETURN`, `IF false THEN RETURN`],
    ['flag self-approval (C35)', `IF f.proposed_by = p_actor THEN RETURN`, `IF false THEN RETURN`],
    ['kill ignored (C37)', `SELECT CASE WHEN f.killed THEN false ELSE`, `SELECT CASE WHEN false THEN false ELSE`],
    ['structure cycle (C4)', `IF cyc THEN RETURN`, `IF false THEN RETURN`],
  ];
  for (const [name, from, to] of muts) { const m = base.map((q) => q.replace(from, () => to)); console.log(`${name} applied:`, m.join('') !== base.join('')); await go(`mutant ${name}:`, m); }
}
