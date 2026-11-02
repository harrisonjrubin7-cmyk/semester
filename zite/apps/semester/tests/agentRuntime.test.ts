import { test, eq } from './harness';
import { newRun, step, Run, Event, handoffStep, handoffBlocker, validateToolInput, familyOf, FAMILIES, MODEL_TOOLS } from '../src/lib/agentRuntime';
import { PROFILES } from '../src/lib/intelligence';

const B = { payloadDigest: 'd1', recordVersion: 3, policyVersion: 7 };
const apply = (r: Run, ...es: Event[]) => es.reduce((x, e) => { const o = step(x, e, x.version); if (o.refused) throw new Error(o.refused); return o.run; }, r);
const approved = (o = {}) => apply(newRun('r', 'stu', 'agent', o), { type: 'authorize', ok: true }, { type: 'start' }, { type: 'propose', binding: B }, { type: 'submit' },
  { type: 'approve', approver: 'reg', decisions: ['registrar'], binding: B });
const refuse = (r: Run, e: Event) => step(r, e, r.version).refused;

test('read-only run completes without a proposal', () => eq(apply(newRun('r', 'u', 'a'), { type: 'authorize', ok: true }, { type: 'start' }, { type: 'deliver' }).state, 'COMPLETED'));
test('denied authorization is terminal', () => { const r = apply(newRun('r', 'u', 'a'), { type: 'authorize', ok: false }); eq(r.state, 'DENIED'); eq(refuse(r, { type: 'start' }), 'terminal'); });
test('happy path: approve, execute, acknowledge, reconcile with receipt', () => {
  const r = approved({ requiredDecisions: ['registrar'] });
  const done = apply(r, { type: 'execute', fence: r.fence, current: B }, { type: 'acknowledge' }, { type: 'reconcile', verified: true, receipt: 'rcpt-1' });
  eq(done.state, 'COMPLETED'); eq(done.executions, 1);
});
test('same principal cannot approve', () => {
  const r = apply(newRun('r', 'stu', 'agent'), { type: 'authorize', ok: true }, { type: 'start' }, { type: 'propose', binding: B }, { type: 'submit' });
  eq(refuse(r, { type: 'approve', approver: 'stu', decisions: [], binding: B }), 'self_approval');
  eq(refuse(r, { type: 'approve', approver: 'agent', decisions: [], binding: B }), 'self_approval');
});
test('missing required decision blocks approval', () => {
  const r = apply(newRun('r', 'stu', 'agent', { requiredDecisions: ['registrar', 'bursar'] }), { type: 'authorize', ok: true }, { type: 'start' }, { type: 'propose', binding: B }, { type: 'submit' });
  eq(refuse(r, { type: 'approve', approver: 'reg', decisions: ['registrar'], binding: B }), 'missing_decision');
});
test('approval for a different payload is refused', () => {
  const r = apply(newRun('r', 'stu', 'agent'), { type: 'authorize', ok: true }, { type: 'start' }, { type: 'propose', binding: B }, { type: 'submit' });
  eq(refuse(r, { type: 'approve', approver: 'reg', decisions: [], binding: { ...B, payloadDigest: 'other' } }), 'approval_not_for_this_proposal');
});
test('changed payload, record or policy at execution is refused', () => {
  const r = approved({ requiredDecisions: ['registrar'] });
  eq(refuse(r, { type: 'execute', fence: r.fence, current: { ...B, payloadDigest: 'x' } }), 'changed_since_approval');
  eq(refuse(r, { type: 'execute', fence: r.fence, current: { ...B, recordVersion: 4 } }), 'changed_since_approval');
  eq(refuse(r, { type: 'execute', fence: r.fence, current: { ...B, policyVersion: 8 } }), 'changed_since_approval');
});
test('material revision voids the approval', () => {
  const r = apply(approved({ requiredDecisions: ['registrar'] }), { type: 'revise', binding: { ...B, payloadDigest: 'd2' } });
  eq(r.state, 'PROPOSED'); eq(r.approval, null);
});
test('disabled domain blocks execution', () => {
  const r = apply(approved({ requiredDecisions: ['registrar'] }), { type: 'disableDomain' });
  eq(refuse(r, { type: 'execute', fence: r.fence, current: B }), 'domain_disabled');
});
test('stale state version is refused (compare-and-set)', () => { const r = approved({ requiredDecisions: ['registrar'] }); eq(step(r, { type: 'cancel' }, r.version - 1).refused, 'stale_version'); });
test('stale execution fence is refused', () => { const r = approved({ requiredDecisions: ['registrar'] }); eq(refuse(r, { type: 'execute', fence: r.fence - 1, current: B }), 'stale_fence'); });
test('duplicate execution is impossible', () => {
  const r0 = approved({ requiredDecisions: ['registrar'] });
  const r = apply(r0, { type: 'execute', fence: r0.fence, current: B });
  eq(refuse(r, { type: 'execute', fence: r.fence, current: B }), 'already_dispatched'); eq(r.executions, 1);
});
test('cancel before dispatch ends the run and invalidates the fence', () => {
  const r0 = approved({ requiredDecisions: ['registrar'] });
  const r = apply(r0, { type: 'cancel' }); eq(r.state, 'CANCELLED'); eq(r.fence > r0.fence, true);
});
test('cancel after dispatch reconciles instead of pretending to undo', () => {
  const r0 = approved({ requiredDecisions: ['registrar'] });
  const r = apply(r0, { type: 'execute', fence: r0.fence, current: B }, { type: 'cancel' }); eq(r.state, 'RECONCILING'); eq(r.reason, 'cancel_after_dispatch');
});
test('revoked authority stops a pending run', () => { const r = apply(approved({ requiredDecisions: ['registrar'] }), { type: 'revoke' }); eq(r.state, 'REVOKED'); eq(refuse(r, { type: 'execute', fence: r.fence, current: B }), 'terminal'); });
test('timeout means unknown, and completion needs a receipt', () => {
  const r0 = approved({ requiredDecisions: ['registrar'] });
  const r = apply(r0, { type: 'execute', fence: r0.fence, current: B }, { type: 'timeout' });
  eq(r.state, 'OUTCOME_UNKNOWN'); eq(refuse(r, { type: 'reconcile', verified: true }), 'receipt_required');
  eq(apply(r, { type: 'reconcile', verified: false }).state, 'OUTCOME_UNKNOWN');
});
test('handoff lifecycle: sent is not accepted, accepted is not delivered', () => {
  eq(handoffStep('queued', 'delivered'), false); eq(handoffStep('accepted', 'delivered'), false); eq(handoffStep('in_progress', 'delivered'), true); eq(handoffStep('proposed', 'queued'), false);
});
test('handoff needs disclosure approval, a projection, no expiry and bounded depth', () => {
  const h = { id: 'h', sender: 'a', recipient: 'b', purpose: 'p', projectionDigest: 'x', disclosureApproval: 'ap1', expiresAt: 100, depth: 1 };
  eq(handoffBlocker(h, 50), null); eq(handoffBlocker({ ...h, disclosureApproval: null }, 50), 'disclosure_not_approved');
  eq(handoffBlocker(h, 150), 'expired'); eq(handoffBlocker({ ...h, depth: 3 }, 50), 'depth_exceeded'); eq(handoffBlocker({ ...h, recipient: 'a' }, 50), 'recipient_is_sender');
});
test('seven tool contracts accept valid input', () => {
  eq(MODEL_TOOLS.length, 7);
  eq(validateToolInput('action_propose', { action_kind: 'request_human_review', artifact_handle: 'a1', target_handle: 't1', intent: 'Ask my advisor' }), null);
  eq(validateToolInput('source_search', { query: 'degree requirements' }), null);
});
test('authoritative fields from the model are rejected', () => {
  for (const f of ['principal_id', 'school_id', 'is_admin', 'approved', 'grant_override'])
    eq(validateToolInput('action_propose', { action_kind: 'request_human_review', artifact_handle: 'a', target_handle: 't', intent: 'x', [f]: true }), `unexpected_field:${f}`);
});
test('unknown tools and kinds are refused (no SQL, shell or execute)', () => {
  eq(validateToolInput('run_sql', { q: 'x' }), 'unknown_tool'); eq(validateToolInput('action_execute', {}), 'unknown_tool');
  eq(validateToolInput('action_propose', { action_kind: 'grant_role', artifact_handle: 'a', target_handle: 't', intent: 'x' }), 'not_allowed:action_kind');
  eq(validateToolInput('memory_propose', { preference: 'x', scope: 'institution' }), 'not_allowed:scope');
});
test('every profile maps to one of ten families; adapters to machine_adapter', () => {
  eq(FAMILIES.length, 10);
  eq(PROFILES.every((p) => familyOf(p.id) !== null), true);
  eq(familyOf('role.payment_processor'), 'machine_adapter'); eq(familyOf('role.registrar_staff'), 'controlled_academic_financial'); eq(familyOf('role.nope'), null);
});
