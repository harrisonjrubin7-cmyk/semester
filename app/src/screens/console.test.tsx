// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCESS_BASIS, CONTEXT_BAR, FIGURE_PROVENANCE, PRODUCTION_WRITE_NOTICE } from '../lib/ops/console';
import { EVIDENCE } from '../lib/ops/evidence';
import { READINESS_GATES } from '../lib/ops/readiness';
import type { CommandItem } from '../lib/console/client';

/**
 * The operations console, driven against a replaced account service.
 *
 * What is under test is the reasoning between the policy in
 * `lib/ops/console.ts` and the calls the screen makes: that it stops at the
 * gate without reading anything, that the context bar carries every field,
 * that a privileged write goes behind the second factor when the session is
 * not fresh and straight through when it is, that every record and figure
 * carries its classification, basis and provenance, and that nothing
 * console-related ever reaches browser storage.
 */

const mock = vi.hoisted(() => ({
  configured: true,
  account: { id: 'op-1', email: 'ops@semester.example', via: 'an email address and password' } as { id: string; email: string; via: string } | null,
  env: 'Production' as 'Production' | 'Staging' | 'Demo',
  caps: vi.fn(),
  duties: vi.fn(),
  approvals: vi.fn(),
  request: vi.fn(),
  decide: vi.fn(),
  act: vi.fn(),
  breakGlass: vi.fn(),
  close: vi.fn(),
  review: vi.fn(),
  audit: vi.fn(),
  auditStatus: vi.fn(),
  figures: vi.fn(),
  command: vi.fn(),
  customers: vi.fn(),
  tenantOperations: vi.fn(),
  integrationHealth: vi.fn(),
  releaseIncidents: vi.fn(),
  privacyRequests: vi.fn(),
  claimPrivacy: vi.fn(),
  privacyDetail: vi.fn(),
  verifyPrivacy: vi.fn(),
  resolvePrivacy: vi.fn(),
  prefs: vi.fn(),
  savePref: vi.fn(),
  mfa: vi.fn(),
  factors: vi.fn(),
  enroll: vi.fn(),
  challenge: vi.fn(),
  verify: vi.fn(),
  session: vi.fn(),
  support: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock('../state/store', () => ({
  useStore: () => ({ account: mock.account, state: {}, dispatch: mock.dispatch }),
  useNow: () => new Date(),
}));
vi.mock('../lib/cloud', () => ({
  get cloudConfigured() {
    return mock.configured;
  },
  cloud: vi.fn(),
}));
vi.mock('../lib/capabilities', () => ({ loadMyCapabilities: mock.caps }));
vi.mock('../lib/environment', async (orig) => ({ ...(await orig<object>()), environment: () => mock.env }));
vi.mock('../lib/experience-flags', () => ({ EXPERIENCE_FLAGS: { supportTickets: 'production' } }));
vi.mock('../lib/console/client', async (orig) => ({
  ...(await orig<object>()),
  loadDuties: mock.duties,
  loadApprovals: mock.approvals,
  requestApproval: mock.request,
  decideApproval: mock.decide,
  act: mock.act,
  loadBreakGlass: mock.breakGlass,
  closeBreakGlass: mock.close,
  reviewBreakGlass: mock.review,
  loadAudit: mock.audit,
  auditStatus: mock.auditStatus,
  loadFigures: mock.figures,
  loadCommandCenter: mock.command,
  loadCustomers: mock.customers,
  loadTenantOperations: mock.tenantOperations,
  loadIntegrationHealth: mock.integrationHealth,
  loadReleaseIncidents: mock.releaseIncidents,
  loadPrivacyRequests: mock.privacyRequests,
  claimPrivacyRequest: mock.claimPrivacy,
  readPrivacyRequestDetail: mock.privacyDetail,
  verifyPrivacyRequest: mock.verifyPrivacy,
  resolvePrivacyRequest: mock.resolvePrivacy,
  loadPreferences: mock.prefs,
  savePreference: mock.savePref,
  mfaLevel: mock.mfa,
  mfaFactors: mock.factors,
  enrollTotp: mock.enroll,
  challengeMfa: mock.challenge,
  verifyMfa: mock.verify,
  sessionExpiry: mock.session,
  openSupportGrants: mock.support,
}));

import { Console } from './Console';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const PLATFORM = [{ capability: 'console:operate', scopeKind: 'platform', scopeId: '' }];
const SUPPORT_PLATFORM = [...PLATFORM, { capability: 'support:ticket', scopeKind: 'platform', scopeId: '' }];
const IMPLEMENTATION_PLATFORM = [...PLATFORM, { capability: 'tenant:implement', scopeKind: 'school', scopeId: 'vu' }];
const PRIVACY_PLATFORM = [...PLATFORM, { capability: 'data_request:handle', scopeKind: 'school', scopeId: 'vu' }];
const INTEGRATION_PLATFORM = [...PLATFORM, { capability: 'integration:view', scopeKind: 'school', scopeId: 'vu' }];
const INCIDENT_PLATFORM = [...PLATFORM, { capability: 'incident:communicate', scopeKind: 'platform', scopeId: '' }];
const FRESH = { currentLevel: 'aal2', nextLevel: 'aal2', verifiedAt: new Date(Date.now() - 2 * 60_000) };
const STALE = { currentLevel: 'aal1', nextLevel: 'aal2', verifiedAt: null };
const STALE_AAL2 = { currentLevel: 'aal2', nextLevel: 'aal2', verifiedAt: new Date(Date.now() - 20 * 60_000) };

const DUTIES = [
  { id: 'role-grant', action: 'Grant or widen a privileged role', requester: 'role:university_admin', approvers: ['security'], twoPerson: false, evidence: 'The access request, naming the person, the role, the tenant and the reason' },
  { id: 'break-glass', action: 'Break-glass access to a production tenant', requester: 'engineering', approvers: ['security', 'founder'], twoPerson: true, evidence: 'An incident or change ticket, fresh MFA, an expiry no later than the incident’s close, and a post-use review booked' },
];

const request = (patch: Record<string, unknown> = {}) => ({
  id: 'req-1',
  dutyId: 'role-grant',
  requester: 'op-2',
  tenantId: 'vu',
  tenantName: 'Vanderbilt University',
  isDemo: false,
  target: 'user-9',
  detail: { role: 'support_agent' },
  evidence: 'Access request AR-12',
  ticket: 'CHG-100',
  status: 'pending',
  correlationId: null,
  createdAt: '2026-09-28T10:00:00Z',
  expiresAt: '2026-10-05T10:00:00Z',
  decidedAt: null,
  executedAt: null,
  approvals: 0,
  rejections: 0,
  mine: false,
  decidedByMe: false,
  canDecide: true,
  ...patch,
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mock.configured = true;
  mock.account = { id: 'op-1', email: 'ops@semester.example', via: 'an email address and password' };
  mock.env = 'Production';
  mock.caps.mockResolvedValue(PLATFORM);
  mock.duties.mockResolvedValue(DUTIES);
  mock.approvals.mockResolvedValue([request(), request({ id: 'req-2', tenantId: 'other', ticket: 'CHG-200', status: 'approved', decidedByMe: true })]);
  mock.request.mockResolvedValue('req-3');
  mock.decide.mockResolvedValue('approved');
  mock.act.mockResolvedValue({ request: 'req-2', duty: 'role-grant', status: 'executed', auditSeq: 41, effect: {} });
  mock.breakGlass.mockResolvedValue([
    { id: 'bg-1', requestId: 'req-0', subject: 'op-3', tenantId: 'vu', tenantName: 'Vanderbilt University', isDemo: false, ticket: 'INC-7', scope: 'connector canvas', openedAt: '2026-09-28T09:00:00Z', expiresAt: '2099-01-01T00:00:00Z', closedAt: null, reviewDue: '2099-01-02T00:00:00Z', reviewedBy: null, reviewedAt: null, reviewNote: null, active: true, reviewOverdue: false },
  ]);
  mock.close.mockResolvedValue('2026-09-28T10:30:00Z');
  mock.review.mockResolvedValue('2026-09-29T09:00:00Z');
  mock.audit.mockResolvedValue([
    { seq: 12, occurredAt: '2026-09-28T10:00:00Z', actor: 'op-1', actorKind: 'authenticated', tenantId: null, action: 'audit.read', target: null, detail: { limit: 200 }, correlationId: null, hash: 'ab'.repeat(32) },
  ]);
  mock.auditStatus.mockResolvedValue({ rows: 12, lastSeq: 12, headHash: 'cd'.repeat(32), lastSealed: '2026-09-27', lastVerifiedAt: '2026-09-28T03:23:00Z', lastVerifiedOk: true });
  mock.figures.mockResolvedValue([
    { figure: 'billing', value: 'not applicable', source: 'docs/DECISION-LOG.md D-009', timeWindow: 'always', ownerSeat: 'founder', refreshedAt: null, evidence: 'D-009', limitation: 'Semester takes no payments; no payment provider exists to read from' },
    { figure: 'approvals-open', value: '1', source: 'public.approval_request', timeWindow: 'now', ownerSeat: 'security', refreshedAt: '2026-09-28T10:00:00Z', evidence: 'supabase/console-approvals.check.sql', limitation: 'Counts pending requests only' },
  ]);
  mock.command.mockResolvedValue([]);
  mock.customers.mockResolvedValue([
    {
      id: 'c-1',
      tenantId: 'vu',
      schoolName: 'Vanderbilt University',
      isDemo: false,
      legalName: 'Vanderbilt University',
      status: 'pilot',
      ownerSeat: 'success',
      createdAt: null,
      updatedAt: null,
      commitments: [{ id: 'cc-1', commitmentId: 'C-001', status: 'promised', dueOn: '2026-12-01', evidence: null, updatedAt: null }],
      contracts: [{ id: 'ct-1', kind: 'pilot-agreement', signedOn: '2026-09-01', startsOn: '2026-09-01', endsOn: '2027-05-31', documentRef: 'VU-PILOT-1' }],
    },
  ]);
  mock.tenantOperations.mockResolvedValue([{
    tenantId: 'vu', tenantName: 'Vanderbilt University', isDemo: false,
    factKey: 'rollout', category: 'rollout', label: 'Rollout state', value: 'requested',
    classification: 'internal', provenance: 'public.tenant_rollout', owner: 'implementation',
    observedAt: '2026-10-03T10:00:00Z', staleAfterDays: 14,
    limitation: 'State is not approval evidence.',
    visibilityReason: 'Live tenant:implement grant at exact school scope.',
  }]);
  mock.integrationHealth.mockResolvedValue([{
    connectionId: 'conn-canvas', tenantId: 'vu', tenantName: 'Vanderbilt University', isDemo: false,
    connectionName: 'Canvas', providerDomain: 'lms', providerName: 'Canvas', configurationState: 'healthy',
    healthState: 'healthy', featureState: 'production', lastSuccessfulSyncAt: '2026-10-03T10:00:00Z',
    freshnessTargetMinutes: 30, minutesSinceSuccess: 10, latestRunStatus: 'success',
    latestRunAt: '2026-10-03T10:00:00Z', reconciliationState: 'complete', recordsReceived: 20,
    recordsRejected: 0, openErrors: 0, criticalErrors: 0, openDeadLetters: 0,
    ownerName: 'Integration owner', backupOwnerName: 'Backup owner', customerImpact: 'No current impact.',
    nextSafeAction: 'Continue monitoring.', configurationApprovalId: null, configurationApprovalStatus: null,
    classification: 'restricted', provenance: 'server sources', limitation: 'No credentials returned.',
  }]);
  mock.releaseIncidents.mockResolvedValue([{
    itemId: 'release:platform', itemKind: 'release', tenantId: null, tenantName: null, isDemo: false,
    state: 'deployed_unverified', title: 'Production release', severity: 'critical', owner: 'engineering',
    affectedWorkflows: ['application'], customerImpact: 'Deployment recorded; behavior unverified.',
    communicationStatus: 'not_applicable', lastNoticeAt: null, nextUpdateAt: null,
    rollbackStatus: 'documented', releaseCommit: 'a'.repeat(40), deploymentSource: 'pages', deploymentId: 'deploy-9',
    observedAt: '2026-10-03T10:00:00Z', expiresAt: '2026-10-17T10:00:00Z', approvalId: null,
    approvalStatus: null, canRequest: true, evidence: 'production_verification=blocked', nextSafeAction: 'Verify the deployed commit.',
    classification: 'restricted', provenance: 'server sources', limitation: 'Production behavior remains unverified.',
  }]);
  mock.privacyRequests.mockResolvedValue([{
    requestId: 'request-1', requestRef: 'DSR-1234567890', tenantId: 'vu',
    tenantName: 'Vanderbilt University', isDemo: false, kind: 'export', requestedBy: 'self',
    status: 'received', receivedAt: '2026-10-01T10:00:00Z', dueAt: '2026-10-31T10:00:00Z',
    overdue: false, identityState: 'unverified', assignedTo: null, assignedAt: null,
    assignedToMe: false, holdState: 'clear', affectedStores: ['account-scoped server records'],
    deletionApprovalId: null, deletionApprovalStatus: null, classification: 'restricted',
    provenance: 'public.data_subject_request', limitation: 'Metadata only.',
  }]);
  mock.claimPrivacy.mockResolvedValue('verifying');
  mock.privacyDetail.mockResolvedValue({
    requestRef: 'DSR-1234567890', subjectReference: 'ab'.repeat(32), kind: 'export',
    requestedBy: 'self', detail: 'Provide my export.', tenantId: 'vu', verifiedAt: null,
    resolution: '', resolutionEvidence: null, completionCertificateId: null,
  });
  mock.verifyPrivacy.mockResolvedValue('in_progress');
  mock.resolvePrivacy.mockResolvedValue({ status: 'completed', certificateId: 'certificate-1' });
  // Existing view tests exercise Approvals first; production defaults to the
  // Command center when no server-side preference exists.
  mock.prefs.mockResolvedValue({ 'console.tab': 'approvals' });
  mock.savePref.mockResolvedValue(undefined);
  mock.mfa.mockResolvedValue(FRESH);
  mock.factors.mockResolvedValue([{ id: 'f-1', name: 'Phone' }]);
  mock.challenge.mockResolvedValue('ch-1');
  mock.verify.mockResolvedValue(undefined);
  mock.session.mockResolvedValue(new Date('2026-09-28T18:00:00Z'));
  mock.support.mockResolvedValue([]);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function flush() {
  await act(async () => {});
  await act(async () => {});
}

async function render() {
  await act(async () => {
    root.render(<Console />);
  });
  await flush();
}

describe('support tab capability gate', () => {
  it('does not offer support to console operators without support:ticket', async () => {
    await render();
    expect(button('Support')).toBeUndefined();
  });

  it('offers support to a platform support operator', async () => {
    mock.caps.mockResolvedValue(SUPPORT_PLATFORM);
    await render();
    expect(button('Support')).toBeDefined();
  });
});

describe('tenant operations capability gate', () => {
  it('does not offer tenant operations to a console-shell-only operator', async () => {
    await render();
    expect(button('Tenant operations')).toBeUndefined();
  });

  it('offers and loads tenant operations for an exact-school implementation grant', async () => {
    mock.caps.mockResolvedValue(IMPLEMENTATION_PLATFORM);
    await render();
    await press('Tenant operations');
    expect(mock.tenantOperations).toHaveBeenCalledWith(false);
    expect(host.textContent).toContain('Vanderbilt University');
    expect(host.textContent).toContain('Live tenant:implement grant at exact school scope.');
  });
});

describe('integration health capability gate', () => {
  it('does not offer integration health to a console-shell-only operator', async () => {
    await render();
    expect(button('Integration health')).toBeUndefined();
    expect(mock.integrationHealth).not.toHaveBeenCalled();
  });

  it('offers and loads credential-free health for an exact-school integration grant', async () => {
    mock.caps.mockResolvedValue(INTEGRATION_PLATFORM);
    await render();
    await press('Integration health');
    expect(mock.integrationHealth).toHaveBeenCalledWith(false);
    expect(host.textContent).toContain('Canvas');
    expect(host.textContent).toContain('No credentials returned.');
    expect(mock.request).not.toHaveBeenCalled();
  });
});

describe('release and incident capability gate', () => {
  it('does not offer or load release operations for a console-shell-only operator', async () => {
    await render();
    expect(button('Release & incidents')).toBeUndefined();
    expect(mock.releaseIncidents).not.toHaveBeenCalled();
  });

  it('offers the workspace only with the platform incident communication grant', async () => {
    mock.caps.mockResolvedValue(INCIDENT_PLATFORM);
    await render();
    await press('Release & incidents');
    expect(mock.releaseIncidents).toHaveBeenCalledWith(false);
    expect(host.textContent).toContain('Deployment recorded; behavior unverified.');
    expect(mock.request).not.toHaveBeenCalled();
  });
});

describe('privacy request capability gate', () => {
  it('does not offer privacy requests to a console-shell-only operator', async () => {
    await render();
    expect(button('Privacy requests')).toBeUndefined();
  });

  it('offers and loads the identity-minimized queue for an exact-school data-rights grant', async () => {
    mock.caps.mockResolvedValue(PRIVACY_PLATFORM);
    await render();
    await press('Privacy requests');
    expect(mock.privacyRequests).toHaveBeenCalledWith(false);
    expect(host.textContent).toContain('DSR-1234567890');
    expect(host.textContent).toContain('Metadata only.');
    expect(mock.privacyDetail).not.toHaveBeenCalled();
  });
});

const buttons = () => [...host.querySelectorAll('button')];
const button = (text: string) => buttons().find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;
const must = (text: string) => {
  const b = button(text);
  if (!b) throw new Error(`No button “${text}”; have: ${buttons().map((b) => JSON.stringify(b.textContent?.trim())).join(', ')}`);
  return b;
};
async function press(text: string) {
  await act(async () => must(text).click());
  await flush();
}

function type(el: Element | null, value: string) {
  if (!el) throw new Error('No control to type into');
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

/** The control wrapped by the label whose text starts with `text`. */
function field(text: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const label = [...host.querySelectorAll('label')].find((l) => l.textContent?.trim().startsWith(text));
  const control = label?.querySelector('input, textarea, select');
  if (!control) throw new Error(`No field labelled “${text}”`);
  return control as HTMLInputElement;
}

async function submit(form: Element | null) {
  if (!form) throw new Error('No form');
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await flush();
}

/** The value beside a `<dt>` in the named list. */
function dd(list: Element, field: string): string {
  const dt = [...list.querySelectorAll('dt')].find((d) => d.textContent === field);
  return dt?.nextElementSibling?.textContent ?? '';
}

const noReads = () => {
  for (const fn of [mock.duties, mock.approvals, mock.audit, mock.figures, mock.command, mock.customers, mock.prefs, mock.breakGlass]) expect(fn).not.toHaveBeenCalled();
};

describe('the gate', () => {
  it('stops with one sentence when there is no account service, and reads nothing', async () => {
    mock.configured = false;
    await render();
    expect(host.textContent).toContain('Sign in with an operator account');
    expect(mock.caps).not.toHaveBeenCalled();
    noReads();
  });

  it('stops when nobody is signed in', async () => {
    mock.account = null;
    await render();
    expect(host.textContent).toContain('Sign in with an operator account');
    noReads();
  });

  it('stops for an account without console:operate at platform scope, and never shows a demo', async () => {
    mock.caps.mockResolvedValue([{ capability: 'console:operate', scopeKind: 'school', scopeId: 'vu' }, { capability: 'audit:read', scopeKind: 'platform', scopeId: '' }]);
    await render();
    expect(host.textContent).toContain('holds no console:operate grant at platform scope');
    expect(host.textContent).not.toMatch(/demo/i);
    noReads();
  });

  it('never says "no grant" while the grants are still being read', async () => {
    let answer: (g: unknown[]) => void = () => {};
    mock.caps.mockReturnValue(new Promise<unknown[]>((r) => { answer = r; }));
    await render();
    expect(host.textContent).toContain('Reading your grants');
    expect(host.textContent).not.toContain('holds no console:operate');
    await act(async () => answer(PLATFORM));
    await flush();
    expect(host.querySelector('[aria-label="Context bar"]')).toBeTruthy();
  });
});

describe('command center', () => {
  const exception = (patch: Partial<CommandItem> = {}): CommandItem => ({
    id: 'gate:production_restore', severity: 'critical', category: 'release gate',
    title: 'Production restore evidence', tenantId: null, tenantName: null,
    isDemo: false, owner: 'engineering', dueAt: null, status: 'missing',
    nextStep: 'Record a dated production result.', route: 'Recovery runbook',
    source: 'public.platform_release_evidence', evidence: '',
    limitation: 'A backup listing is not execution evidence.', observedAt: '2026-09-30T16:00:00Z',
    ...patch,
  });

  it('shows live blockers with their evidence boundary and never turns them green', async () => {
    mock.prefs.mockResolvedValue({ 'console.tab': 'command' });
    mock.command.mockResolvedValue([{
      id: 'gate:production_restore', severity: 'critical', category: 'release gate',
      title: 'Production restore evidence', tenantId: null, tenantName: null,
      isDemo: false, owner: 'engineering', dueAt: null, status: 'missing',
      nextStep: 'Record a dated production result.', route: 'Recovery runbook',
      source: 'public.platform_release_evidence', evidence: '',
      limitation: 'A backup listing is not execution evidence.', observedAt: '2026-09-30T16:00:00Z',
    }]);
    await render();
    expect(host.textContent).toContain('NOT GO');
    expect(host.textContent).toContain('Production restore evidence');
    expect(host.textContent).toContain('No evidence recorded');
    expect(host.textContent).not.toContain('GREEN —');
    expect(mock.command).toHaveBeenCalledWith(false);
  });

  it('says green only when the live exception reader returns no rows', async () => {
    mock.prefs.mockResolvedValue({ 'console.tab': 'command' });
    mock.command.mockResolvedValue([]);
    await render();
    expect(host.textContent).toContain('GREEN');
    expect(host.textContent).toContain('no open exception');
  });

  it('keeps the open count and severity status when a filter hides some or all blockers', async () => {
    mock.prefs.mockResolvedValue({ 'console.tab': 'command' });
    mock.command.mockResolvedValue([
      exception({ id: 'tenant:vu', severity: 'high', title: 'Tenant approval', tenantId: 'vu' }),
      exception(),
    ]);
    await render();
    const status = 'NOT GO: 1 critical · 1 high · 0 medium · 0 informational';
    expect(host.textContent).toContain(status);
    expect(host.textContent).toContain('2 open');

    type(field('Filter this view'), 'Tenant approval');
    expect(host.querySelectorAll('article')).toHaveLength(1);
    expect(host.textContent).toContain(status);
    expect(host.textContent).toContain('2 open');
    expect(host.textContent).not.toContain('GREEN');

    type(field('Filter this view'), 'nothing matches');
    expect(host.querySelectorAll('article')).toHaveLength(0);
    expect(host.textContent).toContain('No matching exceptions');
    expect(host.textContent).toContain(status);
    expect(host.textContent).toContain('2 open');
    expect(host.textContent).not.toContain('GREEN');

    type(field('Filter this view'), '');
    expect([...host.querySelectorAll('article')].map((row) => row.getAttribute('aria-label')))
      .toEqual(['critical Production restore evidence', 'high Tenant approval']);
    expect(host.textContent).not.toContain('No matching exceptions');
    expect(host.textContent).toContain(status);
  });

  it('counts only the selected tenant even when its blockers do not match the filter', async () => {
    mock.command.mockResolvedValue([
      exception(),
      exception({ id: 'tenant:other', severity: 'medium', title: 'Other tenant evidence', tenantId: 'other' }),
      exception({ id: 'tenant:vu', severity: 'high', title: 'Tenant approval', tenantId: 'vu' }),
    ]);
    await render();
    await press('Customers');
    type(field('Purpose'), 'SUP-4');
    await submit(host.querySelector('form[aria-label="Purpose of this read"]'));
    await press('Scope the console to this tenant');
    await press('Command center');
    expect(host.textContent).toContain('1 open');
    expect(host.textContent).toContain('NOT GO: 0 critical · 1 high · 0 medium · 0 informational');
    expect(host.querySelectorAll('article')).toHaveLength(1);

    type(field('Filter this view'), 'Other tenant evidence');
    expect(host.textContent).toContain('No matching exceptions');
    expect(host.textContent).toContain('1 open');
    expect(host.textContent).toContain('NOT GO: 0 critical · 1 high · 0 medium · 0 informational');
    expect(host.textContent).not.toContain('GREEN');
    expect(host.querySelectorAll('article')).toHaveLength(0);

    await press('Show all tenants');
    expect(host.textContent).toContain('3 open');
    expect(host.textContent).toContain('NOT GO: 1 critical · 1 high · 1 medium · 0 informational');
    expect(host.querySelectorAll('article')).toHaveLength(1);
  });

  it('can report an empty tenant scope while another scope has blockers', async () => {
    mock.command.mockResolvedValue([exception()]);
    await render();
    await press('Customers');
    type(field('Purpose'), 'SUP-4');
    await submit(host.querySelector('form[aria-label="Purpose of this read"]'));
    await press('Scope the console to this tenant');
    await press('Command center');
    type(field('Filter this view'), 'nothing matches');
    expect(host.textContent).toContain('GREEN');
    expect(host.textContent).toContain('0 open');
    expect(host.textContent).not.toContain('No matching exceptions');

    await press('Show all tenants');
    expect(host.textContent).toContain('NOT GO: 1 critical');
    expect(host.textContent).toContain('1 open');
    expect(host.textContent).toContain('No matching exceptions');
    expect(host.textContent).not.toContain('GREEN');
  });

  it('never reports green while the live exception reader is pending', async () => {
    mock.prefs.mockResolvedValue({ 'console.tab': 'command' });
    mock.command.mockReturnValue(new Promise(() => {}));
    await render();
    expect(host.textContent).toContain('Reading live operational sources');
    expect(host.textContent).not.toContain('GREEN');
    expect(host.textContent).not.toContain('No matching exceptions');
  });

  it('fails closed when the live exception reader cannot be reached', async () => {
    mock.prefs.mockResolvedValue({ 'console.tab': 'command' });
    mock.command.mockRejectedValue(new Error('The operational source refused the read.'));
    await render();
    expect(host.textContent).toContain('NOT GO');
    expect(host.textContent).toContain('The operational source refused the read.');
    expect(host.textContent).toContain('green status cannot be calculated');
    expect(host.textContent).not.toContain('GREEN');
  });
});

describe('the context bar', () => {
  it('renders every field CONTEXT_BAR names, in order, with a real value', async () => {
    mock.support.mockResolvedValue([{ grantId: 'g-1', student: 'A student (VU)', reason: 'Ticket SUP-4', expiresAt: '2026-09-29T12:00:00Z' }]);
    await render();
    const bar = host.querySelector('[aria-label="Context bar"]') as Element;
    expect([...bar.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(CONTEXT_BAR.map((f) => f.field));
    for (const f of CONTEXT_BAR) {
      const value = dd(bar, f.field);
      expect(value.length, f.field).toBeGreaterThan(0);
      expect(value, f.field).not.toContain('Reading');
    }
    expect(dd(bar, 'Environment')).toBe('■ Production');
    expect(dd(bar, 'Scope')).toBe('All');
    expect(dd(bar, 'Operator')).toBe('ops@semester.example');
    expect(dd(bar, 'Role')).toBe('console:operate at platform');
    expect(dd(bar, 'MFA')).toMatch(/^Fresh — verified 2 min ago$/);
    expect(dd(bar, 'Session')).toMatch(/^Expires /);
    expect(dd(bar, 'Support access')).toContain('A student (VU) · Ticket SUP-4 · ends ');
  });

  it('says the environment as a word and a shape, never from a setting', async () => {
    mock.env = 'Staging';
    await render();
    expect(dd(host.querySelector('[aria-label="Context bar"]')!, 'Environment')).toBe('◆ Staging');
  });

  it('lets an ordinary console role mount at aal1; the app-level boundary handles the two privileged roles', async () => {
    mock.mfa.mockResolvedValue(STALE);
    await render();
    expect(host.querySelector('[aria-label="Context bar"]')).not.toBeNull();
    expect(mock.approvals).toHaveBeenCalled();
    expect(mock.support).toHaveBeenCalled();
    expect(host.querySelector('[aria-label="Second factor"]')).toBeNull();
  });
});

describe('approvals', () => {
  it('shows the duty’s evidence requirement and asks with the evidence and ticket typed', async () => {
    await render();
    type(field('Duty'), 'break-glass');
    expect(host.textContent).toContain(DUTIES[1].evidence);
    expect(host.textContent).toContain('two distinct, neither the requester');
    type(field('Tenant'), 'vu');
    type(field('Target'), 'connector canvas');
    type(field('Detail'), '{"scope":"connector canvas"}');
    type(field('Evidence attached'), 'INC-7, expiry 2h, review booked');
    type(field('Ticket'), 'INC-7');
    await submit(host.querySelector('form[aria-label="Approval request"]'));
    expect(mock.request).toHaveBeenCalledExactlyOnceWith({
      dutyId: 'break-glass',
      tenantId: 'vu',
      target: 'connector canvas',
      detail: { scope: 'connector canvas' },
      evidence: 'INC-7, expiry 2h, review booked',
      ticket: 'INC-7',
      correlationId: null,
    });
    expect(host.textContent).toContain('Request req-3 recorded');
  });

  it('refuses a detail that is not a JSON object before it reaches the server', async () => {
    await render();
    type(field('Duty'), 'role-grant');
    type(field('Detail'), '[1,2]');
    type(field('Evidence attached'), 'AR-1');
    type(field('Ticket'), 'CHG-1');
    await submit(host.querySelector('form[aria-label="Approval request"]'));
    expect(mock.request).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Detail must be a JSON object');
  });

  it('prints the production write notice under the request and under every pending or approved request', async () => {
    await render();
    const notices = [...host.querySelectorAll('[role=note]')].map((n) => n.textContent);
    expect(notices.filter((n) => n === PRODUCTION_WRITE_NOTICE).length).toBe(3);
  });

  it('says which database a non-production write reaches instead', async () => {
    mock.env = 'Staging';
    await render();
    expect(host.textContent).not.toContain(PRODUCTION_WRITE_NOTICE);
    expect(host.textContent).toContain('Staging change');
  });

  it('decides straight through when the second factor is fresh', async () => {
    await render();
    await press('Approve');
    expect(host.querySelector('[aria-label="Second factor"]')).toBeNull();
    expect(mock.decide).toHaveBeenCalledExactlyOnceWith('req-1', 'approve');
    expect(host.textContent).toContain('the request is now approved');
  });

  it('puts the second factor in front of a decision when the session is not aal2, and decides once it is', async () => {
    mock.mfa.mockResolvedValueOnce(STALE_AAL2).mockResolvedValue(FRESH);
    await render();
    await press('Approve');
    expect(mock.decide).not.toHaveBeenCalled();
    const step = host.querySelector('[aria-label="Second factor"]') as Element;
    expect(step).toBeTruthy();
    expect(button('Approve')).toBeDefined();
    expect(host.querySelector('[aria-label="Console views"]')).not.toBeNull();
    expect(host.querySelector('[data-console-content]')?.hasAttribute('inert')).toBe(true);
    type(step.querySelector('input'), '123456');
    let finishDecision: (() => void) | undefined;
    mock.decide.mockImplementationOnce(() => new Promise<void>((resolve) => { finishDecision = resolve; }));
    await submit(step.querySelector('form'));
    expect(mock.verify).toHaveBeenCalledWith('f-1', 'ch-1', '123456');
    expect(host.querySelector('[data-console-content]')?.hasAttribute('inert')).toBe(true);
    expect(host.textContent).toContain('Finishing the verified change');
    await act(async () => { finishDecision?.(); });
    await flush();
    expect(mock.decide).toHaveBeenCalledExactlyOnceWith('req-1', 'approve');
    expect(host.querySelector('[aria-label="Second factor"]')).toBeNull();
    expect(host.querySelector('[data-console-content]')?.hasAttribute('inert')).toBe(false);
  });

  it('offers no decision where the server says the caller cannot decide, and says why', async () => {
    mock.approvals.mockResolvedValue([request({ canDecide: false, mine: true })]);
    await render();
    expect(button('Approve')).toBeUndefined();
    expect(host.textContent).toContain('self-approval is refused');
  });

  it('runs nothing when the second factor is cancelled', async () => {
    mock.mfa.mockResolvedValue(STALE_AAL2);
    await render();
    type(field('Evidence attached'), 'Draft evidence survives MFA.');
    await press('Approve');
    await press('Cancel');
    expect(mock.decide).not.toHaveBeenCalled();
    expect(host.querySelector('[aria-label="Second factor"]')).toBeNull();
    expect(field('Evidence attached').value).toBe('Draft evidence survives MFA.');
  });

  it('offers the action only to the requester or an approver who decided it', async () => {
    // The server refuses anybody else; the screen does not send them through
    // the second factor to be told so.
    mock.approvals.mockResolvedValue([request({ id: 'req-3', status: 'approved', mine: false, decidedByMe: false })]);
    await render();
    expect(button('Act on this request')).toBeUndefined();
    expect(host.textContent).toContain('Not yours to act on');
    // The approver who decided req-2 in the default fixture is offered it:
    // the next test presses that button.
  });

  it('acts on an approved request, and a refused action is shown as the refusal', async () => {
    await render();
    await press('Act on this request');
    expect(mock.act).toHaveBeenCalledExactlyOnceWith('req-2', null);
    expect(host.textContent).toContain('after its audit event #41 was written');

    mock.act.mockRejectedValue(new Error('audit event could not be written'));
    await press('Act on this request');
    expect(host.querySelector('[role=status]')?.textContent).toContain('audit event could not be written');
  });
});

describe('scope', () => {
  it('narrows every view to the focused tenant and says so in the bar', async () => {
    await render();
    expect(host.textContent).toContain('CHG-200');
    await press('Customers');
    type(field('Purpose'), 'SUP-4');
    await submit(host.querySelector('form[aria-label="Purpose of this read"]'));
    await press('Scope the console to this tenant');
    expect(dd(host.querySelector('[aria-label="Context bar"]')!, 'Scope')).toBe('vu');
    await press('Approvals');
    expect(host.textContent).toContain('CHG-100');
    expect(host.textContent).not.toContain('CHG-200');
    await press('Show all tenants');
    expect(host.textContent).toContain('CHG-200');
  });
});

describe('break-glass', () => {
  it('closes and reviews a grant, each under the write notice', async () => {
    await render();
    await press('Break-glass');
    expect(host.textContent).toContain('INC-7');
    await press('Close this grant now');
    expect(mock.close).toHaveBeenCalledExactlyOnceWith('bg-1');
    type(field('Post-use review'), 'Scope held.');
    await submit(host.querySelector('form[aria-label="Review of INC-7"]'));
    expect(mock.review).toHaveBeenCalledExactlyOnceWith('bg-1', 'Scope held.');
    expect(host.querySelector('[aria-label="Break-glass INC-7"] [role=note]')?.textContent).toBe(PRODUCTION_WRITE_NOTICE);
  });
});

describe('the audit', () => {
  it('reads only when opened, says the read is itself logged, and shows the chain status', async () => {
    await render();
    expect(mock.audit).not.toHaveBeenCalled();
    await press('Audit');
    expect(mock.audit).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('Reading the audit is itself audited');
    const status = host.querySelector('[aria-label="Audit chain status"]') as Element;
    expect(dd(status, 'Rows')).toBe('12');
    expect(dd(status, 'Head')).toContain('seq 12');
    expect(dd(status, 'Last sealed day')).toBe('2026-09-27');
    expect(dd(status, 'Last verified')).toContain('chain intact');
    expect(host.textContent).toContain('#12 · audit.read');
  });
});

describe('customers', () => {
  it('reads nothing until a purpose is typed', async () => {
    await render();
    await press('Customers');
    expect(must('Read customers').disabled).toBe(true);
    expect(mock.customers).not.toHaveBeenCalled();
  });

  it('names the classification of every record and answers every ACCESS_BASIS field for each', async () => {
    await render();
    await press('Customers');
    type(field('Purpose'), 'SUP-4');
    await submit(host.querySelector('form[aria-label="Purpose of this read"]'));
    expect(mock.customers).toHaveBeenCalledExactlyOnceWith(false);
    const card = host.querySelector('[aria-label="Customer Vanderbilt University"]') as Element;
    // The customer, one commitment and one contract: three records, three classifications, three bases.
    expect((card.textContent?.match(/Classification: internal — /g) ?? []).length).toBe(3);
    const bases = [...card.querySelectorAll('dl[aria-label^="Why you can see"]')];
    expect(bases.length).toBe(3);
    for (const basis of bases) {
      expect([...basis.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(ACCESS_BASIS.map((f) => f.field));
      expect(dd(basis, 'Basis')).toContain('console:operate at platform scope');
      expect(dd(basis, 'Tenant')).toBe('vu');
      expect(dd(basis, 'Purpose')).toBe('SUP-4');
      expect(dd(basis, 'Expires')).toContain('At session end');
      expect(dd(basis, 'Scope').length).toBeGreaterThan(0);
    }
  });

  it('never offers demo tenants in production, and says when there are no customers', async () => {
    mock.customers.mockResolvedValue([]);
    await render();
    await press('Customers');
    expect(host.querySelector('input[type=checkbox]')).toBeNull();
    type(field('Purpose'), 'SUP-4');
    await submit(host.querySelector('form[aria-label="Purpose of this read"]'));
    expect(host.textContent).toContain('No production customers yet');
  });
});

describe('figures', () => {
  it('prints all seven FIGURE_PROVENANCE fields under every figure, billing included', async () => {
    await render();
    await press('Figures');
    const cards = [...host.querySelectorAll('[aria-label^="Figure "]')];
    expect(cards.length).toBe(2);
    for (const card of cards) {
      const list = card.querySelector('dl') as Element;
      expect([...list.querySelectorAll('dt')].map((d) => d.textContent)).toEqual([...FIGURE_PROVENANCE]);
      for (const f of FIGURE_PROVENANCE) expect(dd(list, f).length, f).toBeGreaterThan(0);
    }
    expect(host.textContent).toContain('billing: not applicable');
    expect(host.textContent).toContain('docs/DECISION-LOG.md D-009');
    expect(dd(cards[0].querySelector('dl')!, 'Environment')).toBe('■ Production');
  });
});

describe('evidence', () => {
  it('renders every record of the register with the state the register computes', async () => {
    await render();
    await press('Evidence');
    const cards = [...host.querySelectorAll('article[aria-label^="Evidence "]')];
    expect(cards.length).toBe(EVIDENCE.length);
    expect(EVIDENCE.length).toBeGreaterThan(0);
    for (const card of cards) expect(card.textContent).toMatch(/— (current|expiring|expired)/);
    const readiness = [...host.querySelectorAll('article[aria-label^="Readiness "]')];
    expect(readiness).toHaveLength(READINESS_GATES.length);
    expect(host.textContent).toContain('Configuration — missing');
    expect(host.textContent).toContain('Observed operation — missing');
    expect(host.textContent).toContain('Highest continuous evidence: repository');
    expect(mock.customers).not.toHaveBeenCalled();
  });
});

describe('what the operator keeps', () => {
  it('opens on the last tab the preferences hold', async () => {
    mock.prefs.mockResolvedValue({ 'console.tab': 'figures' });
    await render();
    expect(mock.figures).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('billing: not applicable');
  });

  it('saves the tab and the views through operator_preference, and nothing through localStorage', async () => {
    mock.prefs.mockResolvedValue({ 'console.views': [{ name: 'Old', tab: 'audit', filter: 'read' }] });
    await render();
    await press('Audit');
    expect(mock.savePref).toHaveBeenCalledWith('console.tab', 'audit');
    type(field('Filter this view'), 'audit.read');
    await press('Views');
    expect(host.textContent).toContain('Old');
    type(field('Name for this view'), 'Reads');
    await submit(host.querySelector('form[aria-label="Save a view"]'));
    expect(mock.savePref).toHaveBeenCalledWith('console.views', [
      { name: 'Old', tab: 'audit', filter: 'read' },
      { name: 'Reads', tab: 'views', filter: 'audit.read' },
    ]);
    await press('Open Old');
    expect(mock.audit).toHaveBeenCalledTimes(2);
    expect((field('Filter this view') as HTMLInputElement).value).toBe('read');

    expect(Object.keys(localStorage).filter((k) => /console/i.test(k))).toEqual([]);
    expect(JSON.stringify(localStorage)).not.toMatch(/console|Reads|audit\.read/);
  });
});
