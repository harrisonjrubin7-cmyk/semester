import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The console client's contract with the database: which RPC, which argument
 * names, which columns become which fields, and that a refusal is thrown with
 * the server's words rather than rendered as an empty list.
 *
 * The account service is replaced by a recorder. Each table call is a chain
 * whose every method returns itself and which resolves to the reply set for
 * it, so a test can read back what was selected, filtered and ordered.
 */

interface Reply {
  data?: unknown;
  error?: { message: string } | null;
}

const calls: { kind: 'rpc' | 'from'; name: string; args?: unknown; chain: string[] }[] = [];
const replies = new Map<string, Reply>();
const auth = {
  getUser: vi.fn(async () => ({ data: { user: { id: 'op-1' } } })),
  getSession: vi.fn(async () => ({ data: { session: { expires_at: 1_800_000_000 } } })),
  onAuthStateChange: vi.fn(),
  mfa: {
    getAuthenticatorAssuranceLevel: vi.fn(),
    listFactors: vi.fn(),
    enroll: vi.fn(),
    challenge: vi.fn(),
    verify: vi.fn(),
  },
};

function chain(kind: 'rpc' | 'from', name: string, args?: unknown) {
  const call = { kind, name, args, chain: [] as string[] };
  calls.push(call);
  const reply = () => replies.get(`${kind}:${name}`) ?? { data: null, error: null };
  const self: Record<string, unknown> = {
    then: (ok: (r: Reply) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(reply()).then(ok, bad),
  };
  for (const m of ['select', 'order', 'in', 'upsert', 'eq']) {
    self[m] = (...a: unknown[]) => {
      call.chain.push(`${m}(${a.map((x) => JSON.stringify(x)).join(',')})`);
      return self;
    };
  }
  return self;
}

vi.mock('../cloud', () => ({
  cloudConfigured: true,
  cloud: async () => ({
    auth,
    rpc: (name: string, args?: unknown) => chain('rpc', name, args),
    from: (name: string) => chain('from', name),
  }),
}));

import {
  act,
  auditStatus,
  decideApproval,
  holdsConsole,
  loadApprovals,
  loadAudit,
  loadCustomers,
  loadDuties,
  loadFigures,
  loadCommandCenter,
  loadTenantOperations,
  loadIntegrationHealth,
  loadReleaseIncidents,
  loadPrivacyRequests,
  claimPrivacyRequest,
  readPrivacyRequestDetail,
  verifyPrivacyRequest,
  resolvePrivacyRequest,
  loadPreferences,
  mfaFresh,
  mfaLevel,
  openSupportGrants,
  requestApproval,
  savePreference,
  sessionExpiry,
  closeBreakGlass,
  loadBreakGlass,
  reviewBreakGlass,
  enrollTotp,
  challengeMfa,
  verifyMfa,
  mfaFactors,
  privilegedMfaRequired,
  watchMfaSession,
} from './client';

const HEALTH_ROW = {
  connection_id: 'conn-canvas', tenant_id: 'vu', tenant_name: 'Vanderbilt University', is_demo: false,
  connection_name: 'Canvas', provider_domain: 'lms', provider_name: 'Canvas', configuration_state: 'healthy',
  health_state: 'degraded', feature_state: 'production', last_successful_sync_at: '2026-10-03T10:00:00Z',
  freshness_target_minutes: 30, minutes_since_success: 45, latest_run_status: 'partial',
  latest_run_at: '2026-10-03T10:00:00Z', reconciliation_state: 'warning', records_received: 20,
  records_rejected: 2, open_errors: 1, critical_errors: 0, open_dead_letters: 1,
  owner_name: 'Integration owner', backup_owner_name: 'Backup owner', customer_impact: 'Assignments may be delayed.',
  next_safe_action: 'Review reconciliation.', configuration_approval_id: null, configuration_approval_status: null, can_request: true,
  classification: 'restricted', provenance: 'server sources', limitation: 'No credentials returned.',
};

const RELEASE_INCIDENT_ROW = {
  item_id: 'release:platform', item_kind: 'release', tenant_id: null, tenant_name: null, is_demo: false,
  state: 'deployed_unverified', title: 'Production release', severity: 'critical', owner: 'engineering',
  affected_workflows: ['application', 'database'], customer_impact: 'Post-deploy behavior is not verified.',
  communication_status: 'not_applicable', last_notice_at: null, next_update_at: null,
  rollback_status: 'documented', release_commit: 'a'.repeat(40), deployment_source: 'pages',
  deployment_id: 'deploy-17', observed_at: '2026-10-03T10:00:00Z', expires_at: '2026-10-17T10:00:00Z',
  approval_id: null, approval_status: null, can_request: true, evidence: 'production_verification=blocked',
  next_safe_action: 'Verify the exact commit.', classification: 'restricted',
  provenance: 'server sources', limitation: 'No institutional activation claim.',
};

const last = () => calls[calls.length - 1];

beforeEach(() => {
  calls.length = 0;
  replies.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  replies.clear();
});

describe('holdsConsole', () => {
  const g = (capability: string, scopeKind: string, scopeId = '') => ({ capability, scopeKind, scopeId });
  it('is the capability at platform scope, and nothing narrower', () => {
    expect(holdsConsole([g('console:operate', 'platform')])).toBe(true);
    expect(holdsConsole([g('console:operate', 'school', 'vanderbilt')])).toBe(false);
    expect(holdsConsole([g('audit:read', 'platform')])).toBe(false);
    expect(holdsConsole([])).toBe(false);
  });
});

describe('duties and approvals', () => {
  it('reads the duty table into the shape the screen renders', async () => {
    replies.set('from:console_duty', {
      data: [{ id: 'break-glass', action: 'Break-glass', requester: 'engineering', approvers: ['security', 'founder'], two_person: true, evidence: 'A ticket' }],
    });
    const [d] = await loadDuties();
    expect(d).toEqual({ id: 'break-glass', action: 'Break-glass', requester: 'engineering', approvers: ['security', 'founder'], twoPerson: true, evidence: 'A ticket' });
    expect(last().chain).toEqual(['select("*")', 'order("id")']);
  });

  it('asks for a request with exactly the argument names the function declares', async () => {
    replies.set('rpc:request_approval', { data: 'req-9' });
    const id = await requestApproval({
      dutyId: 'role-grant',
      tenantId: 'vu',
      target: 'user-2',
      detail: { role: 'support_agent' },
      evidence: 'Access request AR-12',
      ticket: 'CHG-100',
    });
    expect(id).toBe('req-9');
    expect(last()).toMatchObject({
      kind: 'rpc',
      name: 'request_approval',
      args: {
        want_duty: 'role-grant',
        want_tenant: 'vu',
        want_target: 'user-2',
        want_detail: { role: 'support_agent' },
        want_evidence: 'Access request AR-12',
        want_ticket: 'CHG-100',
        want_correlation: null,
      },
    });
  });

  it('throws the server’s own words when a request is refused', async () => {
    replies.set('rpc:request_approval', { data: null, error: { message: 'You do not hold the requester party' } });
    await expect(requestApproval({ dutyId: 'x', tenantId: null, target: null, detail: {}, evidence: 'e', ticket: 'T-1' })).rejects.toThrow(
      'You do not hold the requester party',
    );
  });

  it('decides by request id and decision, and reads the new status back', async () => {
    replies.set('rpc:decide_approval', { data: 'approved' });
    expect(await decideApproval('req-9', 'approve')).toBe('approved');
    expect(last()).toMatchObject({ name: 'decide_approval', args: { want_request: 'req-9', want_decision: 'approve' } });
  });

  it('runs the fail-closed action by request id, and a refusal is a throw, never a result', async () => {
    replies.set('rpc:console_act', { data: { request: 'req-9', duty: 'role-grant', status: 'executed', audit_seq: 41, effect: { role_grant: 'rg-1' } } });
    expect(await act('req-9', 'corr-0001')).toEqual({ request: 'req-9', duty: 'role-grant', status: 'executed', auditSeq: 41, effect: { role_grant: 'rg-1' } });
    expect(last()).toMatchObject({ name: 'console_act', args: { want_request: 'req-9', want_correlation: 'corr-0001' } });

    replies.set('rpc:console_act', { data: null, error: { message: 'Fresh MFA required' } });
    await expect(act('req-9')).rejects.toThrow('Fresh MFA required');
  });

  it('loads requests through the demo-aware reader, with what the server says about deciding them', async () => {
    replies.set('rpc:console_approvals', {
      data: [
        {
          id: 'req-1',
          duty_id: 'tenant-suspension',
          requester: 'op-1',
          tenant_id: 'vu',
          tenant_name: 'Vanderbilt University',
          is_demo: false,
          target: null,
          detail: {},
          evidence: 'Change ticket',
          ticket: 'CHG-1',
          status: 'pending',
          correlation_id: null,
          created_at: '2026-09-28T10:00:00Z',
          expires_at: '2026-10-05T10:00:00Z',
          decided_at: null,
          executed_at: null,
          approvals: 1,
          rejections: 0,
          mine: true,
          decided_by_me: false,
          can_decide: false,
        },
      ],
    });
    const [r] = await loadApprovals();
    expect(r).toMatchObject({ status: 'pending', tenantName: 'Vanderbilt University', isDemo: false, approvals: 1, rejections: 0, mine: true, decidedByMe: false, canDecide: false, detail: {} });
    expect(last()).toMatchObject({ kind: 'rpc', name: 'console_approvals', args: { include_demo: false } });
    await loadApprovals(true);
    expect(last()).toMatchObject({ args: { include_demo: true } });
  });
});

describe('integration health', () => {
  it('maps the credential-free health contract and forwards explicit demo inclusion', async () => {
    replies.set('rpc:console_integration_health', { data: [HEALTH_ROW] });
    const [row] = await loadIntegrationHealth(true);
    expect(row).toMatchObject({
      connectionId: 'conn-canvas', tenantId: 'vu', healthState: 'degraded', featureState: 'production',
      freshnessTargetMinutes: 30, minutesSinceSuccess: 45, openDeadLetters: 1,
      configurationApprovalId: null, classification: 'restricted',
    });
    expect(last()).toMatchObject({ name: 'console_integration_health', args: { include_demo: true } });
  });

  it('preserves server refusals and fails closed on an unknown health state', async () => {
    replies.set('rpc:console_integration_health', { error: { message: 'integration:view over an exact school is required.' } });
    await expect(loadIntegrationHealth()).rejects.toThrow('integration:view over an exact school is required.');

    replies.set('rpc:console_integration_health', { data: [{ ...HEALTH_ROW, health_state: 'maybe' }] });
    await expect(loadIntegrationHealth()).rejects.toThrow('unknown health state');
  });
});

describe('release and incident operations', () => {
  it('maps the allowlisted response and forwards explicit demo inclusion', async () => {
    replies.set('rpc:console_release_incidents', { data: [RELEASE_INCIDENT_ROW] });
    const [row] = await loadReleaseIncidents(true);
    expect(row).toMatchObject({
      itemId: 'release:platform', itemKind: 'release', state: 'deployed_unverified',
      releaseCommit: 'a'.repeat(40), deploymentSource: 'pages', affectedWorkflows: ['application', 'database'],
    });
    expect(last()).toMatchObject({ name: 'console_release_incidents', args: { include_demo: true } });
  });

  it('preserves server refusals and fails closed on unknown item kinds or states', async () => {
    replies.set('rpc:console_release_incidents', { error: { message: 'incident:communicate at platform scope is required.' } });
    await expect(loadReleaseIncidents()).rejects.toThrow('incident:communicate at platform scope is required.');
    replies.set('rpc:console_release_incidents', { data: [{ ...RELEASE_INCIDENT_ROW, item_kind: 'secret' }] });
    await expect(loadReleaseIncidents()).rejects.toThrow('unknown item kind');
    replies.set('rpc:console_release_incidents', { data: [{ ...RELEASE_INCIDENT_ROW, state: 'green' }] });
    await expect(loadReleaseIncidents()).rejects.toThrow('unknown state');
  });
});

describe('break-glass', () => {
  it('reads grants through the demo-aware reader, with the server’s active and overdue flags', async () => {
    replies.set('rpc:console_break_glass', {
      data: [{ id: 'bg-1', request_id: 'req-0', subject: 'op-3', tenant_id: 'vu', tenant_name: 'Vanderbilt University', is_demo: false, ticket: 'INC-7', scope: 'connector canvas', opened_at: '2026-09-28T09:00:00Z', expires_at: '2026-09-28T13:00:00Z', closed_at: null, review_due: '2026-09-29T13:00:00Z', reviewed_by: null, reviewed_at: null, review_note: null, active: true, review_overdue: false }],
    });
    const [g] = await loadBreakGlass();
    expect(g).toMatchObject({ id: 'bg-1', tenantName: 'Vanderbilt University', active: true, reviewOverdue: false, closedAt: null, reviewNote: null });
    expect(last()).toMatchObject({ name: 'console_break_glass', args: { include_demo: false } });
  });

  it('closes and reviews by grant id, and reads back when it happened', async () => {
    replies.set('rpc:close_break_glass', { data: '2026-09-28T10:30:00Z' });
    expect(await closeBreakGlass('bg-1')).toBe('2026-09-28T10:30:00Z');
    expect(last()).toMatchObject({ name: 'close_break_glass', args: { want_id: 'bg-1' } });
    replies.set('rpc:review_break_glass', { data: '2026-09-29T09:00:00Z' });
    expect(await reviewBreakGlass('bg-1', 'Scope held; nothing outside the incident.')).toBe('2026-09-29T09:00:00Z');
    expect(last()).toMatchObject({ name: 'review_break_glass', args: { want_id: 'bg-1', want_note: 'Scope held; nothing outside the incident.' } });
  });
});

describe('the audit', () => {
  it('reads since a moment with a limit, and maps the chain columns', async () => {
    replies.set('rpc:console_audit_read', {
      data: [{ seq: 7, occurred_at: '2026-09-28T10:00:00Z', actor: 'op-1', actor_kind: 'authenticated', tenant_id: null, action: 'audit.read', target: null, detail: { limit: 200 }, correlation_id: null, hash: 'ab'.repeat(32) }],
    });
    const since = new Date('2026-09-01T00:00:00Z');
    const [e] = await loadAudit(since, 50);
    expect(e).toMatchObject({ seq: 7, action: 'audit.read', actorKind: 'authenticated', detail: { limit: 200 } });
    expect(last()).toMatchObject({ name: 'console_audit_read', args: { since: '2026-09-01T00:00:00.000Z', want_limit: 50 } });
  });

  it('reads the chain status whether it comes back as one row or a list of one', async () => {
    const row = { rows: 12, last_seq: 12, head_hash: 'cd'.repeat(32), last_sealed: '2026-09-27', last_verified_at: '2026-09-28T03:23:00Z', last_verified_ok: true };
    replies.set('rpc:console_audit_status', { data: [row] });
    expect(await auditStatus()).toEqual({ rows: 12, lastSeq: 12, headHash: 'cd'.repeat(32), lastSealed: '2026-09-27', lastVerifiedAt: '2026-09-28T03:23:00Z', lastVerifiedOk: true });
    replies.set('rpc:console_audit_status', { data: row });
    expect((await auditStatus()).lastSeq).toBe(12);
    replies.set('rpc:console_audit_status', { data: { rows: 0, last_seq: null } });
    expect(await auditStatus()).toEqual({ rows: 0, lastSeq: null, headHash: null, lastSealed: null, lastVerifiedAt: null, lastVerifiedOk: null });
  });
});

describe('figures and customers', () => {
  it('reads the demo-aware command center and preserves evidence boundaries', async () => {
    replies.set('rpc:console_command_center', {
      data: [{
        id: 'gate:production_restore', severity: 'critical', category: 'release gate',
        title: 'Production restore evidence', tenant_id: null, tenant_name: null,
        is_demo: false, owner: 'engineering', due_at: null, status: 'missing',
        next_step: 'Record a dated production result.', route: 'Recovery runbook',
        source: 'public.platform_release_evidence', evidence: '',
        limitation: 'A backup listing is not execution evidence.', observed_at: '2026-09-30T16:00:00Z',
      }],
    });
    const [item] = await loadCommandCenter();
    expect(item).toMatchObject({
      id: 'gate:production_restore', severity: 'critical', tenantId: null,
      status: 'missing', source: 'public.platform_release_evidence',
    });
    expect(last()).toMatchObject({ name: 'console_command_center', args: { include_demo: false } });
    await loadCommandCenter(true);
    expect(last()).toMatchObject({ args: { include_demo: true } });
  });

  it('leaves demo rows out unless asked', async () => {
    replies.set('rpc:console_figures', { data: [{ figure: 'billing', value: 'not applicable', source: 'docs/DECISION-LOG.md D-009', time_window: 'always', owner_seat: 'founder', refreshed_at: null, evidence: 'D-009', limitation: 'Semester takes no payments' }] });
    const [f] = await loadFigures();
    expect(f).toEqual({ figure: 'billing', value: 'not applicable', source: 'docs/DECISION-LOG.md D-009', timeWindow: 'always', ownerSeat: 'founder', refreshedAt: null, evidence: 'D-009', limitation: 'Semester takes no payments' });
    expect(last()).toMatchObject({ name: 'console_figures', args: { include_demo: false } });
    await loadFigures(true);
    expect(last()).toMatchObject({ args: { include_demo: true } });
  });

  it('reads customers, with their commitments and contracts, in one call to the demo-aware reader', async () => {
    replies.set('rpc:console_customers', {
      data: [
        {
          id: 'c-1',
          tenant_id: 'vu',
          school_name: 'Vanderbilt University',
          is_demo: false,
          legal_name: 'The Vanderbilt University',
          status: 'pilot',
          owner_seat: 'success',
          created_at: null,
          updated_at: null,
          commitments: [{ id: 'cc-1', commitment_id: 'C-001', status: 'promised', due_on: '2026-12-01', evidence: null, updated_at: null }],
          contracts: [{ id: 'ct-1', kind: 'pilot-agreement', signed_on: '2026-09-01', starts_on: '2026-09-01', ends_on: '2027-05-31', document_ref: 'VU-PILOT-1' }],
        },
      ],
    });
    const [c] = await loadCustomers();
    expect(c).toMatchObject({ legalName: 'The Vanderbilt University', schoolName: 'Vanderbilt University', isDemo: false });
    expect(c.commitments).toEqual([{ id: 'cc-1', commitmentId: 'C-001', status: 'promised', dueOn: '2026-12-01', evidence: null, updatedAt: null }]);
    expect(c.contracts).toEqual([{ id: 'ct-1', kind: 'pilot-agreement', signedOn: '2026-09-01', startsOn: '2026-09-01', endsOn: '2027-05-31', documentRef: 'VU-PILOT-1' }]);
    expect(calls.map((x) => x.name)).toEqual(['console_customers']);
    expect(last()).toMatchObject({ args: { include_demo: false } });
  });

  it('treats a customer with no children as one with empty lists', async () => {
    replies.set('rpc:console_customers', { data: [{ id: 'c-2', tenant_id: 'x', school_name: 'X', is_demo: true, legal_name: null, status: 'prospect', owner_seat: null, commitments: [], contracts: null }] });
    const [c] = await loadCustomers(true);
    expect(c).toMatchObject({ isDemo: true, legalName: '', commitments: [], contracts: [] });
  });
});

describe('tenant operations', () => {
  it('maps the metadata-only RPC contract without inventing freshness', async () => {
    replies.set('rpc:console_tenant_operations', {
      data: [{
        tenant_id: 'vu', tenant_name: 'Vanderbilt University', is_demo: false,
        fact_key: 'integration', category: 'integration', label: 'Integration connections',
        value: '2 configured; 1 healthy; 1 degraded or error', classification: 'restricted',
        provenance: 'public.integration_connections', owner: 'integration',
        observed_at: null, stale_after_days: 7, limitation: 'Counts only.',
        visibility_reason: 'Live tenant:implement grant at exact school scope.',
      }],
    });

    const [fact] = await loadTenantOperations();
    expect(fact).toEqual({
      tenantId: 'vu', tenantName: 'Vanderbilt University', isDemo: false,
      factKey: 'integration', category: 'integration', label: 'Integration connections',
      value: '2 configured; 1 healthy; 1 degraded or error', classification: 'restricted',
      provenance: 'public.integration_connections', owner: 'integration',
      observedAt: null, staleAfterDays: 7, limitation: 'Counts only.',
      visibilityReason: 'Live tenant:implement grant at exact school scope.',
    });
    expect(last()).toMatchObject({
      kind: 'rpc', name: 'console_tenant_operations', args: { include_demo: false },
    });
  });

  it('passes explicit demo intent and surfaces server refusals', async () => {
    replies.set('rpc:console_tenant_operations', { data: [] });
    await loadTenantOperations(true);
    expect(last()).toMatchObject({ args: { include_demo: true } });

    replies.set('rpc:console_tenant_operations', { error: { message: 'console:operate at platform scope is required.' } });
    await expect(loadTenantOperations()).rejects.toThrow('console:operate at platform scope is required.');
  });
});

describe('privacy request workspace', () => {
  it('maps the metadata-only queue without inventing an approval or owner', async () => {
    replies.set('rpc:console_privacy_requests', {
      data: [{
        request_id: 'request-1', request_ref: 'DSR-1234567890', tenant_id: 'vu',
        tenant_name: 'Vanderbilt University', is_demo: false, kind: 'erasure',
        requested_by: 'self', status: 'received', received_at: '2026-10-01T10:00:00Z',
        due_at: '2026-10-31T10:00:00Z', overdue: false, identity_state: 'unverified',
        assigned_to: null, assigned_at: null, assigned_to_me: false, hold_state: 'clear',
        affected_stores: ['account records', 'audit history'], deletion_approval_id: null,
        deletion_approval_status: null, classification: 'restricted',
        provenance: 'public.data_subject_request', limitation: 'Metadata only.',
      }],
    });

    const [request] = await loadPrivacyRequests();
    expect(request).toEqual({
      requestId: 'request-1', requestRef: 'DSR-1234567890', tenantId: 'vu',
      tenantName: 'Vanderbilt University', isDemo: false, kind: 'erasure',
      requestedBy: 'self', status: 'received', receivedAt: '2026-10-01T10:00:00Z',
      dueAt: '2026-10-31T10:00:00Z', overdue: false, identityState: 'unverified',
      assignedTo: null, assignedAt: null, assignedToMe: false, holdState: 'clear',
      affectedStores: ['account records', 'audit history'], deletionApprovalId: null,
      deletionApprovalStatus: null, classification: 'restricted',
      provenance: 'public.data_subject_request', limitation: 'Metadata only.',
    });
    expect(last()).toMatchObject({ kind: 'rpc', name: 'console_privacy_requests', args: { include_demo: false } });
  });

  it('passes explicit demo intent and preserves a server refusal', async () => {
    replies.set('rpc:console_privacy_requests', { data: [] });
    await loadPrivacyRequests(true);
    expect(last()).toMatchObject({ args: { include_demo: true } });
    replies.set('rpc:console_privacy_requests', { error: { message: 'data_request:handle over an exact school is required.' } });
    await expect(loadPrivacyRequests()).rejects.toThrow('data_request:handle over an exact school is required.');
  });

  it('uses the exact audited lifecycle RPC contracts', async () => {
    replies.set('rpc:claim_privacy_request', { data: 'verifying' });
    await expect(claimPrivacyRequest('request-1')).resolves.toBe('verifying');
    expect(last()).toMatchObject({ name: 'claim_privacy_request', args: { want_request: 'request-1' } });

    replies.set('rpc:read_privacy_request_detail', { data: [{
      request_ref: 'DSR-1234567890', subject_reference: 'ab'.repeat(32), kind: 'export',
      requested_by: 'self', detail: 'Send my export.', tenant_id: 'vu', verified_at: null,
      resolution: '', resolution_evidence: null, completion_certificate_id: null,
    }] });
    await expect(readPrivacyRequestDetail('request-1')).resolves.toMatchObject({
      requestRef: 'DSR-1234567890', subjectReference: 'ab'.repeat(32), detail: 'Send my export.',
    });
    expect(last()).toMatchObject({ name: 'read_privacy_request_detail', args: { want_request: 'request-1' } });

    replies.set('rpc:verify_privacy_request', { data: 'in_progress' });
    await expect(verifyPrivacyRequest('request-1', 'signed-in account holder', 'case://verify-1')).resolves.toBe('in_progress');
    expect(last()).toMatchObject({ name: 'verify_privacy_request', args: {
      want_request: 'request-1', want_basis: 'signed-in account holder', want_evidence: 'case://verify-1',
    } });

    replies.set('rpc:resolve_privacy_request', { data: { status: 'completed', certificate_id: 'certificate-1' } });
    await expect(resolvePrivacyRequest('request-1', 'completed', 'Export delivered.', 'case://export-1', null))
      .resolves.toEqual({ status: 'completed', certificateId: 'certificate-1' });
    expect(last()).toMatchObject({ name: 'resolve_privacy_request', args: {
      want_request: 'request-1', want_outcome: 'completed', want_resolution: 'Export delivered.',
      want_evidence: 'case://export-1', want_approval: null,
    } });

    replies.set('rpc:resolve_privacy_request', { data: { status: 'unknown', certificate_id: null } });
    await expect(resolvePrivacyRequest('request-1', 'refused', 'Request refused.', 'case://refusal-1', null))
      .rejects.toThrow('unexpected resolution status');
  });
});

describe('preferences', () => {
  it('reads the operator’s rows as a map, and writes one keyed by the signed-in subject', async () => {
    replies.set('from:operator_preference', { data: [{ key: 'console.tab', value: 'audit' }, { key: 'console.views', value: [{ name: 'Mine' }] }] });
    expect(await loadPreferences()).toEqual({ 'console.tab': 'audit', 'console.views': [{ name: 'Mine' }] });
    await savePreference('console.tab', 'figures');
    const write = last();
    expect(write.name).toBe('operator_preference');
    expect(write.chain[0]).toMatch(/^upsert\(\{"subject":"op-1","key":"console.tab","value":"figures","updated_at":".+"\},\{"onConflict":"subject,key"\}\)$/);
  });

  it('refuses to write for nobody', async () => {
    auth.getUser.mockResolvedValueOnce({ data: { user: undefined as unknown as { id: string } } });
    await expect(savePreference('console.tab', 'x')).rejects.toThrow('Sign in again');
  });
});

describe('identity', () => {
  it('reads the assurance level and when a second factor was last verified', async () => {
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: {
        currentLevel: 'aal2',
        nextLevel: 'aal2',
        currentAuthenticationMethods: [
          { method: 'password', timestamp: 1_700_000_000 },
          { method: 'totp', timestamp: 1_700_000_600 },
        ],
      },
      error: null,
    });
    const level = await mfaLevel();
    expect(level.currentLevel).toBe('aal2');
    expect(level.verifiedAt?.toISOString()).toBe(new Date(1_700_000_600 * 1000).toISOString());
    expect(mfaFresh(level, new Date(1_700_000_600 * 1000 + 14 * 60_000))).toBe(true);
    expect(mfaFresh(level, new Date(1_700_000_600 * 1000 + 16 * 60_000))).toBe(false);
  });

  it('is not fresh at aal1, and the password’s timestamp is not a factor', async () => {
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal2', currentAuthenticationMethods: [{ method: 'password', timestamp: 1_700_000_000 }] },
      error: null,
    });
    const level = await mfaLevel();
    expect(level.verifiedAt).toBeNull();
    expect(mfaFresh(level, new Date(1_700_000_000 * 1000))).toBe(false);
  });

  it('does not call an unsupported WebAuthn method fresh in the code-factor flow', async () => {
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal2', nextLevel: 'aal2', currentAuthenticationMethods: [{ method: 'webauthn', timestamp: 1_700_000_000 }] },
      error: null,
    });
    const level = await mfaLevel();
    expect(level.verifiedAt).toBeNull();
    expect(mfaFresh(level, new Date(1_700_000_000 * 1000))).toBe(false);
  });

  it('enrols, challenges and verifies TOTP through the auth client', async () => {
    auth.mfa.listFactors.mockResolvedValue({ data: { all: [], totp: [{ id: 'f-1', friendly_name: 'Authenticator', status: 'verified' }], phone: [{ id: 'p-1', friendly_name: 'Mobile', status: 'verified' }] }, error: null });
    expect(await mfaFactors()).toEqual([
      { id: 'f-1', name: 'Authenticator', type: 'totp' },
      { id: 'p-1', name: 'Mobile', type: 'phone' },
    ]);
    auth.mfa.enroll.mockResolvedValue({ data: { id: 'f-2', type: 'totp', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'ABCD', uri: 'otpauth://x' } }, error: null });
    expect(await enrollTotp()).toEqual({ factorId: 'f-2', qrCode: 'data:image/svg+xml;utf-8,<svg/>', secret: 'ABCD', uri: 'otpauth://x' });
    expect(auth.mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'Operations console' });
    auth.mfa.challenge.mockResolvedValue({ data: { id: 'ch-1' }, error: null });
    expect(await challengeMfa('f-2')).toBe('ch-1');
    auth.mfa.verify.mockResolvedValue({ data: {}, error: null });
    await verifyMfa('f-2', 'ch-1', '123 456');
    expect(auth.mfa.verify).toHaveBeenCalledWith({ factorId: 'f-2', challengeId: 'ch-1', code: '123456' });
    auth.mfa.verify.mockResolvedValue({ data: null, error: { message: 'Invalid TOTP code' } });
    await expect(verifyMfa('f-2', 'ch-1', '000000')).rejects.toThrow('Invalid TOTP code');
  });

  it('asks the database whether a privileged grant needs elevation', async () => {
    replies.set('rpc:privileged_mfa_required', { data: true });
    await expect(privilegedMfaRequired()).resolves.toBe(true);
    expect(last()).toMatchObject({ kind: 'rpc', name: 'privileged_mfa_required' });
  });

  it('rechecks on Auth session changes and unsubscribes cleanly', async () => {
    const unsubscribe = vi.fn();
    let changed: ((event: string) => void) | undefined;
    auth.onAuthStateChange.mockImplementation((callback: (event: string) => void) => {
      changed = callback;
      return { data: { subscription: { unsubscribe } } };
    });
    const onChange = vi.fn();
    const stop = await watchMfaSession(onChange);
    changed?.('INITIAL_SESSION');
    expect(onChange).not.toHaveBeenCalled();
    changed?.('TOKEN_REFRESHED');
    changed?.('MFA_CHALLENGE_VERIFIED');
    expect(onChange).toHaveBeenCalledTimes(2);
    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('turns the session’s epoch expiry into a date, and none into null', async () => {
    expect((await sessionExpiry())?.toISOString()).toBe(new Date(1_800_000_000 * 1000).toISOString());
    auth.getSession.mockResolvedValueOnce({ data: { session: null as unknown as { expires_at: number } } });
    expect(await sessionExpiry()).toBeNull();
  });
});

describe('support access', () => {
  it('lists only the windows open to this operator as the supporter, unrevoked and unexpired', async () => {
    const now = new Date('2026-09-28T12:00:00Z');
    replies.set('rpc:support_access_windows', {
      data: [
        { grant_id: 'g-1', side: 'supporter', counterpart_label: 'A student (VU)', reason: 'Ticket SUP-4', expires_at: '2026-09-29T12:00:00Z', revoked_at: null },
        { grant_id: 'g-2', side: 'supporter', counterpart_label: 'B', reason: 'old', expires_at: '2026-09-27T12:00:00Z', revoked_at: null },
        { grant_id: 'g-3', side: 'supporter', counterpart_label: 'C', reason: 'revoked', expires_at: '2026-09-29T12:00:00Z', revoked_at: '2026-09-28T00:00:00Z' },
        { grant_id: 'g-4', side: 'student', counterpart_label: 'Support', reason: 'mine', expires_at: '2026-09-29T12:00:00Z', revoked_at: null },
      ],
    });
    expect(await openSupportGrants(now)).toEqual([{ grantId: 'g-1', student: 'A student (VU)', reason: 'Ticket SUP-4', expiresAt: '2026-09-29T12:00:00Z' }]);
  });
});
