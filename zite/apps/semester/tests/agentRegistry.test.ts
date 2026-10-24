import { createHash } from 'node:crypto';
import { test, eq } from './harness';
import { PACK_DIGEST } from '../src/lib/agentPack';
import { PROFILES, composePrompt, manifest, SPECIALISTS, specialistInstruction, TOOL_MAPPINGS, profilesForRoles, statusOf, executiveBrief, workflowStatus } from '../src/lib/intelligence';

test('97 unique profiles, 2 adapters without companions', () => {
  eq(PROFILES.length, 97);
  eq(new Set(PROFILES.map((p) => p.id)).size, 97);
  eq(PROFILES.filter((p) => p.adapter).length, 2);
  eq(PROFILES.filter((p) => composePrompt(p, 'companion')).length, 95);
});
test('composed prompts are byte-identical to the owner pack (digest)', () => {
  let all = '';
  for (const p of PROFILES) { all += composePrompt(p, 'delegate') + '\u0000'; const c = composePrompt(p, 'companion'); if (c) all += c + '\u0000'; }
  eq(createHash('sha256').update(all, 'utf8').digest('hex'), PACK_DIGEST);
});
test('digest check is sensitive (control: one changed character fails)', () => {
  let all = '';
  for (const p of PROFILES) all += composePrompt(p, 'delegate')!.replace('Stop on missing', 'Stop on mising') + '\u0000';
  eq(createHash('sha256').update(all, 'utf8').digest('hex') === PACK_DIGEST, false);
});
test('every manifest is production-off, server-resolved, no scope expansion, schema constants', () => {
  for (const p of PROFILES) {
    const m = manifest(p);
    eq(m.production_enabled, false); eq(m.principal_resolution, 'trusted_server_context'); eq(m.autonomy, 'read_explain_ephemeral_draft');
    eq(m.provider_egress_policy, 'preserve_inspected_gateway_exclusions'); eq(m.delegation.scope_expansion_allowed, false);
    eq(/^role\.[a-z0-9_]+$/.test(m.id), true); eq(m.delegation.max_depth <= 2, true);
    eq(m.logical_tools.includes('action_execute' as never), false);
  }
});
test('action_execute is disabled and no profile status claims production', () => {
  eq(TOOL_MAPPINGS.find((t) => t.tool === 'action_execute')!.state, 'disabled');
  eq(PROFILES.every((p) => statusOf(p).productionEnabled === false && statusOf(p).deployed === 'No'), true);
});
test('only modes with a gateway path are enabled; disabled modes give no instruction', () => {
  eq(SPECIALISTS.length, 8);
  eq(SPECIALISTS.filter((s) => s.enabled).map((s) => s.key).sort().join(','), 'course_guide,executive_assistant,tutor,workflow_concierge');
  eq(specialistInstruction('research_assistant'), null);
  eq(specialistInstruction('executive_assistant'), null); // deterministic, never a model prompt
  eq(typeof specialistInstruction('tutor'), 'string');
});
test('roles map to separate companions; unknown roles grant nothing', () => {
  eq(profilesForRoles(['Student', 'Tutor']).map((p) => p.id).join(','), 'role.undergraduate_student,role.tutor');
  eq(profilesForRoles(['Root']).length, 0);
});
test('executive brief ranks overdue/today/week, flags crowded days, executes nothing', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  const b = executiveBrief([
    { id: 'a', title: 'Late lab', due: '2026-10-20', done: false }, { id: 'b', title: 'Quiz', due: '2026-10-24', done: false },
    { id: 'c', title: 'E1', due: '2026-10-27', done: false }, { id: 'd', title: 'E2', due: '2026-10-27', done: false }, { id: 'e', title: 'E3', due: '2026-10-27', done: false },
    { id: 'f', title: 'Done', due: '2026-10-21', done: true }, { id: 'g', title: 'Someday', due: null, done: false },
  ], now);
  eq(b.priorities.overdue.map((t) => t.id).join(), 'a'); eq(b.priorities.dueToday.map((t) => t.id).join(), 'b');
  eq(b.conflicts.length, 1); eq(b.proposedActions.every((x) => x.executes === false), true); eq(b.uncertainty.length, 2);
});
import { ACCEPTANCE, EXTRA_MODES } from '../src/lib/intelligence';
test('second pack: 24 acceptance scenarios tracked, 15 modes total, uncovered ones stay visible', () => {
  eq(ACCEPTANCE.length, 24); eq(SPECIALISTS.length + EXTRA_MODES.length, 15);
  eq(ACCEPTANCE.filter((a) => a.evidence === null).length > 0, true);
});
test('workflow_status: known statuses give a next human step; unknown stays unknown; notes never projected', () => {
  const base = { id: 'c1', title: 'Transcript hold', category: 'Service Request', reference: 'R-1', assigned: false, mine: true };
  const w = workflowStatus({ ...base, status: 'Sent' });
  eq(w.status, 'Sent'); eq(w.owner, 'Campus services'); eq(w.open, true); eq(w.uncertainty, null);
  eq('notes' in w, false);
  const u = workflowStatus({ ...base, status: 'Escalated?' });
  eq(u.status, 'Unknown'); eq(typeof u.uncertainty, 'string');
  eq(workflowStatus({ ...base, status: 'Resolved', assigned: true, mine: false }).yourRole, 'Assignee');
});
test('concierge is deterministic: enabled with no model instruction', () => {
  eq(specialistInstruction('workflow_concierge'), null);
});
