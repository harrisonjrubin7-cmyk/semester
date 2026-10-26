// Semester multi-agent reference contracts (owner blueprint "multi-agent system", 2026-10-24). Pure, unit-tested.
// Run-state graph, handoff lifecycle, model-facing tool input validation and the ten workflow families. This is the
// reference reducer the blueprint describes; no runtime executes it yet, and nothing here can call a service.
// Durable workflow state is separate from model conversation: the model never supplies identity, scope or approval.
import { PROFILES } from './intelligence';

// ---------- Run state ----------
export type RunState = 'NEW' | 'DENIED' | 'AUTHORIZED' | 'RUNNING' | 'PROPOSED' | 'AWAITING_APPROVAL' | 'APPROVED' | 'EXECUTING'
  | 'OUTCOME_UNKNOWN' | 'RECONCILING' | 'COMPLETED' | 'CANCELLED' | 'REVOKED';
export type Binding = { payloadDigest: string; recordVersion: number; policyVersion: number };
export type Run = {
  id: string; principal: string; machineActor: string; state: RunState; version: number; fence: number;
  domainEnabled: boolean; requiresApproval: boolean; requiredDecisions: string[];
  proposal: Binding | null; approval: (Binding & { approver: string; decisions: string[] }) | null;
  dispatched: boolean; executions: number; receipt: string | null; reason: string | null;
};
export type Event =
  | { type: 'authorize'; ok: boolean }
  | { type: 'start' }
  | { type: 'deliver' }
  | { type: 'propose'; binding: Binding }
  | { type: 'submit' }
  | { type: 'approve'; approver: string; decisions: string[]; binding: Binding }
  | { type: 'revise'; binding: Binding }
  | { type: 'execute'; fence: number; current: Binding }
  | { type: 'acknowledge' }
  | { type: 'timeout' }
  | { type: 'reconcile'; verified: boolean; receipt?: string }
  | { type: 'cancel' }
  | { type: 'revoke' }
  | { type: 'disableDomain' };

export const newRun = (id: string, principal: string, machineActor: string, o: Partial<Pick<Run, 'requiresApproval' | 'requiredDecisions' | 'domainEnabled'>> = {}): Run => ({
  id, principal, machineActor, state: 'NEW', version: 0, fence: 0, domainEnabled: o.domainEnabled ?? true, requiresApproval: o.requiresApproval ?? true,
  requiredDecisions: o.requiredDecisions ?? [], proposal: null, approval: null, dispatched: false, executions: 0, receipt: null, reason: null,
});
const same = (a: Binding, b: Binding) => a.payloadDigest === b.payloadDigest && a.recordVersion === b.recordVersion && a.policyVersion === b.policyVersion;
const TERMINAL: RunState[] = ['DENIED', 'COMPLETED', 'CANCELLED', 'REVOKED'];

/** Applies one event with compare-and-set on the run version. Refusals return the run unchanged plus a reason. */
export function step(r: Run, e: Event, expectedVersion: number): { run: Run; refused: string | null } {
  const no = (why: string) => ({ run: r, refused: why });
  const go = (patch: Partial<Run>) => ({ run: { ...r, ...patch, version: r.version + 1 }, refused: null });
  if (expectedVersion !== r.version) return no('stale_version');
  if (TERMINAL.includes(r.state)) return no('terminal');
  switch (e.type) {
    case 'authorize': return r.state !== 'NEW' ? no('bad_state') : go({ state: e.ok ? 'AUTHORIZED' : 'DENIED', reason: e.ok ? null : 'not_authorized' });
    case 'start': return r.state !== 'AUTHORIZED' ? no('bad_state') : go({ state: 'RUNNING' });
    case 'deliver': return r.state !== 'RUNNING' ? no('bad_state') : go({ state: 'COMPLETED' });
    case 'propose': return r.state !== 'RUNNING' ? no('bad_state') : go({ state: 'PROPOSED', proposal: e.binding });
    case 'submit':
      if (r.state !== 'PROPOSED') return no('bad_state');
      return go(r.requiresApproval ? { state: 'AWAITING_APPROVAL' } : { state: 'APPROVED', approval: { ...r.proposal!, approver: r.principal, decisions: [] }, fence: r.fence + 1 });
    case 'approve':
      if (r.state !== 'AWAITING_APPROVAL') return no('bad_state');
      if (e.approver === r.principal || e.approver === r.machineActor) return no('self_approval');
      if (!r.proposal || !same(e.binding, r.proposal)) return no('approval_not_for_this_proposal');
      if (r.requiredDecisions.some((d) => !e.decisions.includes(d))) return no('missing_decision');
      return go({ state: 'APPROVED', approval: { ...e.binding, approver: e.approver, decisions: e.decisions }, fence: r.fence + 1 });
    case 'revise':
      if (!['PROPOSED', 'AWAITING_APPROVAL', 'APPROVED'].includes(r.state)) return no('bad_state');
      return go({ state: 'PROPOSED', proposal: e.binding, approval: null, fence: r.fence + 1 });
    case 'execute':
      if (r.state !== 'APPROVED') return no(r.state === 'EXECUTING' || r.dispatched ? 'already_dispatched' : 'bad_state');
      if (!r.domainEnabled) return no('domain_disabled');
      if (e.fence !== r.fence) return no('stale_fence');
      if (!r.approval || !same(e.current, r.approval)) return no('changed_since_approval');
      return go({ state: 'EXECUTING', dispatched: true, executions: r.executions + 1 });
    case 'acknowledge': return r.state !== 'EXECUTING' ? no('bad_state') : go({ state: 'RECONCILING' });
    case 'timeout': return r.state !== 'EXECUTING' ? no('bad_state') : go({ state: 'OUTCOME_UNKNOWN' });
    case 'reconcile':
      if (!['RECONCILING', 'OUTCOME_UNKNOWN'].includes(r.state)) return no('bad_state');
      if (e.verified && !e.receipt) return no('receipt_required');
      return go(e.verified ? { state: 'COMPLETED', receipt: e.receipt! } : { state: 'OUTCOME_UNKNOWN' });
    case 'cancel':
    case 'revoke': {
      const end: RunState = e.type === 'cancel' ? 'CANCELLED' : 'REVOKED';
      // Before dispatch: fence invalidated, no effect possible. After possible dispatch: stop new effects, reconcile what exists.
      if (!r.dispatched) return go({ state: end, fence: r.fence + 1, reason: e.type });
      return go({ state: r.state === 'COMPLETED' ? r.state : 'RECONCILING', fence: r.fence + 1, reason: `${e.type}_after_dispatch` });
    }
    case 'disableDomain': return go({ domainEnabled: false, fence: r.fence + 1 });
  }
}

// ---------- Handoffs ----------
export type HandoffState = 'proposed' | 'awaiting_disclosure_approval' | 'queued' | 'accepted' | 'in_progress' | 'delivered' | 'declined' | 'expired' | 'cancelled';
const HANDOFF_NEXT: Record<string, HandoffState[]> = {
  proposed: ['awaiting_disclosure_approval', 'cancelled'], awaiting_disclosure_approval: ['queued', 'cancelled', 'expired'],
  queued: ['accepted', 'declined', 'expired', 'cancelled'], accepted: ['in_progress', 'cancelled'], in_progress: ['delivered', 'cancelled'],
};
export const handoffStep = (from: HandoffState, to: HandoffState) => (HANDOFF_NEXT[from] ?? []).includes(to);
export type HandoffEnvelope = { id: string; sender: string; recipient: string; purpose: string; projectionDigest: string; disclosureApproval: string | null; expiresAt: number; depth: number };
export function handoffBlocker(h: HandoffEnvelope, now: number, maxDepth = 2): string | null {
  if (h.sender === h.recipient) return 'recipient_is_sender';
  if (!h.disclosureApproval) return 'disclosure_not_approved';
  if (h.expiresAt <= now) return 'expired';
  if (h.depth > maxDepth) return 'depth_exceeded';
  if (!h.projectionDigest) return 'no_minimum_projection';
  return null;
}

// ---------- Model-facing tool contracts ----------
export const ACTION_KINDS = ['save_private_task', 'add_private_calendar_block', 'send_approved_draft', 'publish_approved_artifact', 'request_human_review', 'prepare_official_workflow'] as const;
export const MODEL_TOOLS = ['source_search', 'source_excerpt', 'workflow_status', 'artifact_draft', 'action_propose', 'handoff_propose', 'memory_propose'] as const;
type Spec = Record<string, { type: 'string'; min: number; max: number; enum?: readonly string[] }>;
const SPECS: Record<(typeof MODEL_TOOLS)[number], Spec> = {
  source_search: { query: { type: 'string', min: 1, max: 300 } },
  source_excerpt: { reference_handle: { type: 'string', min: 1, max: 180 }, purpose: { type: 'string', min: 1, max: 300 } },
  workflow_status: { object_handle: { type: 'string', min: 1, max: 180 } },
  artifact_draft: { kind: { type: 'string', min: 1, max: 60 }, instructions: { type: 'string', min: 1, max: 2000 } },
  action_propose: { action_kind: { type: 'string', min: 1, max: 60, enum: ACTION_KINDS }, artifact_handle: { type: 'string', min: 1, max: 180 }, target_handle: { type: 'string', min: 1, max: 180 }, intent: { type: 'string', min: 1, max: 500 } },
  handoff_propose: { recipient_profile: { type: 'string', min: 1, max: 80 }, artifact_handle: { type: 'string', min: 1, max: 180 }, purpose: { type: 'string', min: 1, max: 300 } },
  memory_propose: { preference: { type: 'string', min: 1, max: 300 }, scope: { type: 'string', min: 1, max: 40, enum: ['personal'] } },
};
/** Shape check only (additionalProperties: false). It never establishes permission: identity and approval come from the server. */
export function validateToolInput(tool: string, input: Record<string, unknown>): string | null {
  const spec = SPECS[tool as keyof typeof SPECS];
  if (!spec) return 'unknown_tool';
  for (const k of Object.keys(input)) if (!(k in spec)) return `unexpected_field:${k}`;
  for (const [k, s] of Object.entries(spec)) {
    const v = input[k];
    if (typeof v !== 'string') return `missing:${k}`;
    if (v.length < s.min || v.length > s.max) return `length:${k}`;
    if (s.enum && !s.enum.includes(v)) return `not_allowed:${k}`;
  }
  return null;
}

// ---------- Workflow families ----------
export const FAMILIES = ['learning_planning', 'family_payer_support', 'teaching_research', 'advising_case', 'controlled_academic_financial',
  'campus_community', 'career_partner', 'governance_it', 'semester_company', 'machine_adapter'] as const;
export type Family = (typeof FAMILIES)[number];
const FAMILY_OF_GROUP: Record<string, Family> = {
  Learners: 'learning_planning', Supporters: 'family_payer_support', 'Teaching & research': 'teaching_research', 'Support & advising': 'advising_case',
  'Academic & finance': 'controlled_academic_financial', 'Campus & community': 'campus_community', 'Career & partners': 'career_partner',
  'Governance & IT': 'governance_it', 'Semester company': 'semester_company',
};
export function familyOf(profileId: string): Family | null {
  const p = PROFILES.find((x) => x.id === profileId);
  if (!p) return null;
  if (p.adapter) return 'machine_adapter';
  if (p.id === 'role.developer_platform_partner') return 'governance_it';
  return FAMILY_OF_GROUP[p.group] ?? null;
}
/** Families whose proposals always need an independent human approval before any execution. */
export const APPROVAL_FAMILIES: Family[] = ['controlled_academic_financial', 'governance_it', 'advising_case', 'machine_adapter'];
