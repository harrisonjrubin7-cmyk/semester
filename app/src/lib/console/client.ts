/**
 * The operations console's reads and writes, typed, over the account service.
 *
 * Every function here is a thin wrapper over one RPC or one table, and the
 * database is the authorization: `console:operate`, the duty's parties, fresh
 * MFA and row-level security are all checked there, not here. What this
 * module adds is the shape — a row's columns become a record a screen can
 * render — and the rule that an error is thrown with its message rather than
 * returned beside `null`, so a screen cannot render an empty list where a
 * refusal was.
 *
 * Nothing is cached, and nothing is written to browser storage. Saved views
 * and the last-open tab go through `operator_preference`, which is owner-only
 * server-side; `screens/console.test.tsx` asserts nothing console-related
 * ever reaches `localStorage`.
 *
 * The RPC names and argument names are the contract with
 * `supabase/migrations/20260929100000_console_control_plane.sql` and
 * `20260929110000_console_approvals_and_break_glass.sql`.
 */

import { cloud } from '../cloud';

export { CONSOLE_CAPABILITY, holdsConsole } from './capability';

/** MFA is fresh for a privileged action within this many minutes of verifying (`private.mfa_fresh`). */
export const MFA_FRESH_MINUTES = 15;

type Row = Record<string, unknown>;

function message(error: { message?: string } | null, fallback: string): string {
  const said = error?.message?.trim();
  return said ? said : fallback;
}

const text = (v: unknown): string => (v == null ? '' : String(v));
const maybe = (v: unknown): string | null => (v == null ? null : String(v));
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(text) : []);

// ── duties ─────────────────────────────────────────────────────────────────

export interface DutyRow {
  id: string;
  action: string;
  requester: string;
  approvers: string[];
  twoPerson: boolean;
  evidence: string;
}

export async function loadDuties(): Promise<DutyRow[]> {
  const db = await cloud();
  const { data, error } = await db.from('console_duty').select('*').order('id');
  if (error) throw new Error(message(error, 'Could not load the duties.'));
  return rows(data).map((r) => ({
    id: text(r.id),
    action: text(r.action),
    requester: text(r.requester),
    approvers: strings(r.approvers),
    twoPerson: r.two_person === true,
    evidence: text(r.evidence),
  }));
}

// ── approvals ──────────────────────────────────────────────────────────────

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'expired';

export interface ApprovalRequest {
  id: string;
  dutyId: string;
  requester: string;
  tenantId: string | null;
  tenantName: string | null;
  isDemo: boolean;
  target: string | null;
  detail: Row;
  evidence: string;
  ticket: string;
  status: ApprovalStatus;
  correlationId: string | null;
  createdAt: string;
  expiresAt: string;
  decidedAt: string | null;
  executedAt: string | null;
  /** Distinct approvers who said yes, and no. */
  approvals: number;
  rejections: number;
  /** Whether the caller asked for it — a requester cannot decide their own. */
  mine: boolean;
  decidedByMe: boolean;
  /** What the server says about offering a decision: pending, unexpired, not mine, and a party I hold. */
  canDecide: boolean;
}

const STATUSES: ApprovalStatus[] = ['pending', 'approved', 'rejected', 'executed', 'expired'];

const num = (v: unknown): number => (typeof v === 'number' ? v : Number.parseInt(text(v), 10) || 0);
const object = (v: unknown): Row => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {});

export function readApproval(r: Row): ApprovalRequest {
  const status = STATUSES.includes(r.status as ApprovalStatus) ? (r.status as ApprovalStatus) : 'pending';
  return {
    id: text(r.id),
    dutyId: text(r.duty_id),
    requester: text(r.requester),
    tenantId: maybe(r.tenant_id),
    tenantName: maybe(r.tenant_name),
    isDemo: r.is_demo === true,
    target: maybe(r.target),
    detail: object(r.detail),
    evidence: text(r.evidence),
    ticket: text(r.ticket),
    status,
    correlationId: maybe(r.correlation_id),
    createdAt: text(r.created_at),
    expiresAt: text(r.expires_at),
    decidedAt: maybe(r.decided_at),
    executedAt: maybe(r.executed_at),
    approvals: num(r.approvals),
    rejections: num(r.rejections),
    mine: r.mine === true,
    decidedByMe: r.decided_by_me === true,
    canDecide: r.can_decide === true,
  };
}

/** Pending first, then newest. Demo tenants' requests are left out unless asked for. */
export async function loadApprovals(includeDemo = false): Promise<ApprovalRequest[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('console_approvals', { include_demo: includeDemo });
  if (error) throw new Error(message(error, 'Could not load the approval requests.'));
  return rows(data).map(readApproval);
}

export interface ApprovalInput {
  dutyId: string;
  tenantId: string | null;
  target: string | null;
  detail: Row;
  evidence: string;
  ticket: string;
  correlationId?: string | null;
}

/** Returns the new request's id. The server writes `approval.requested` first, and refuses if it cannot. */
export async function requestApproval(input: ApprovalInput): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('request_approval', {
    want_duty: input.dutyId,
    want_tenant: input.tenantId,
    want_target: input.target,
    want_detail: input.detail,
    want_evidence: input.evidence,
    want_ticket: input.ticket,
    want_correlation: input.correlationId ?? null,
  });
  if (error) throw new Error(message(error, 'The request was not recorded.'));
  return text(data);
}

/** Returns the request's new status. Needs fresh MFA; self-approval is refused server-side. */
export async function decideApproval(requestId: string, decision: 'approve' | 'reject'): Promise<ApprovalStatus> {
  const db = await cloud();
  const { data, error } = await db.rpc('decide_approval', { want_request: requestId, want_decision: decision });
  if (error) throw new Error(message(error, 'The decision was not recorded.'));
  return STATUSES.includes(data as ApprovalStatus) ? (data as ApprovalStatus) : 'pending';
}

export interface Acted {
  request: string;
  duty: string;
  status: string;
  /** The sequence of the `console.act` audit event, written before the effect. */
  auditSeq: number | null;
  effect: Row;
}

/**
 * The fail-closed write. The server writes the `console.act` audit event and
 * performs the duty's effect in one call; if the event cannot be written,
 * nothing else happens and this throws.
 */
export async function act(requestId: string, correlationId: string | null = null): Promise<Acted> {
  const db = await cloud();
  const { data, error } = await db.rpc('console_act', { want_request: requestId, want_correlation: correlationId });
  if (error) throw new Error(message(error, 'The action did not run.'));
  const r = object(data);
  return {
    request: text(r.request),
    duty: text(r.duty),
    status: text(r.status),
    auditSeq: r.audit_seq == null ? null : num(r.audit_seq),
    effect: object(r.effect),
  };
}

// ── break-glass ────────────────────────────────────────────────────────────

export interface BreakGlassGrant {
  id: string;
  requestId: string | null;
  subject: string;
  tenantId: string;
  tenantName: string | null;
  isDemo: boolean;
  ticket: string;
  scope: string;
  openedAt: string;
  expiresAt: string;
  closedAt: string | null;
  reviewDue: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  /** Open, not closed, not expired — as the server counts it. */
  active: boolean;
  /** Unreviewed past its review date: the subject cannot have another approved. */
  reviewOverdue: boolean;
}

export function readBreakGlass(r: Row): BreakGlassGrant {
  return {
    id: text(r.id),
    requestId: maybe(r.request_id),
    subject: text(r.subject),
    tenantId: text(r.tenant_id),
    tenantName: maybe(r.tenant_name),
    isDemo: r.is_demo === true,
    ticket: text(r.ticket),
    scope: text(r.scope),
    openedAt: text(r.opened_at),
    expiresAt: text(r.expires_at),
    closedAt: maybe(r.closed_at),
    reviewDue: text(r.review_due),
    reviewedBy: maybe(r.reviewed_by),
    reviewedAt: maybe(r.reviewed_at),
    reviewNote: maybe(r.review_note),
    active: r.active === true,
    reviewOverdue: r.review_overdue === true,
  };
}

export async function loadBreakGlass(includeDemo = false): Promise<BreakGlassGrant[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('console_break_glass', { include_demo: includeDemo });
  if (error) throw new Error(message(error, 'Could not load the break-glass grants.'));
  return rows(data).map(readBreakGlass);
}

/** By the subject; returns when it closed. Audited first. */
export async function closeBreakGlass(grantId: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('close_break_glass', { want_id: grantId });
  if (error) throw new Error(message(error, 'The grant was not closed.'));
  return text(data);
}

/** The post-use review, by a security or founder seat other than the subject; returns when it was reviewed. */
export async function reviewBreakGlass(grantId: string, note: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('review_break_glass', { want_id: grantId, want_note: note });
  if (error) throw new Error(message(error, 'The review was not recorded.'));
  return text(data);
}

// ── audit ──────────────────────────────────────────────────────────────────

export interface AuditEvent {
  seq: number;
  occurredAt: string;
  actor: string | null;
  actorKind: string;
  tenantId: string | null;
  action: string;
  target: string | null;
  detail: Row;
  correlationId: string | null;
  hash: string;
}

export interface AuditStatus {
  rows: number;
  lastSeq: number | null;
  headHash: string | null;
  lastSealed: string | null;
  lastVerifiedAt: string | null;
  lastVerifiedOk: boolean | null;
}

/** Reading the audit is itself audited: the server writes `audit.read` before returning a row. */
export async function loadAudit(since: Date, limit = 200): Promise<AuditEvent[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('console_audit_read', { since: since.toISOString(), want_limit: limit });
  if (error) throw new Error(message(error, 'Could not read the audit.'));
  return rows(data).map((r) => ({
    seq: num(r.seq),
    occurredAt: text(r.occurred_at),
    actor: maybe(r.actor),
    actorKind: text(r.actor_kind),
    tenantId: maybe(r.tenant_id),
    action: text(r.action),
    target: maybe(r.target),
    detail: r.detail && typeof r.detail === 'object' ? (r.detail as Row) : {},
    correlationId: maybe(r.correlation_id),
    hash: text(r.hash),
  }));
}

export async function auditStatus(): Promise<AuditStatus> {
  const db = await cloud();
  const { data, error } = await db.rpc('console_audit_status');
  if (error) throw new Error(message(error, 'Could not read the audit chain status.'));
  const r = rows(data)[0] ?? (data && typeof data === 'object' ? (data as Row) : {});
  return {
    rows: num(r.rows),
    lastSeq: r.last_seq == null ? null : num(r.last_seq),
    headHash: maybe(r.head_hash),
    lastSealed: maybe(r.last_sealed),
    lastVerifiedAt: maybe(r.last_verified_at),
    lastVerifiedOk: typeof r.last_verified_ok === 'boolean' ? r.last_verified_ok : null,
  };
}

// ── figures ────────────────────────────────────────────────────────────────

export interface Figure {
  figure: string;
  value: string;
  source: string;
  timeWindow: string;
  ownerSeat: string;
  refreshedAt: string | null;
  evidence: string;
  limitation: string;
}

export async function loadFigures(includeDemo = false): Promise<Figure[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('console_figures', { include_demo: includeDemo });
  if (error) throw new Error(message(error, 'Could not read the figures.'));
  return rows(data).map((r) => ({
    figure: text(r.figure),
    value: text(r.value),
    source: text(r.source),
    timeWindow: text(r.time_window),
    ownerSeat: text(r.owner_seat),
    refreshedAt: maybe(r.refreshed_at),
    evidence: text(r.evidence),
    limitation: text(r.limitation),
  }));
}

// ── command center ────────────────────────────────────────────────────────

export type CommandSeverity = 'critical' | 'high' | 'medium' | 'info';

export interface CommandItem {
  id: string;
  severity: CommandSeverity;
  category: string;
  title: string;
  tenantId: string | null;
  tenantName: string | null;
  isDemo: boolean;
  owner: string;
  dueAt: string | null;
  status: string;
  nextStep: string;
  route: string;
  source: string;
  evidence: string;
  limitation: string;
  observedAt: string;
}

const COMMAND_SEVERITIES: readonly CommandSeverity[] = ['critical', 'high', 'medium', 'info'];

export function readCommandItem(r: Row): CommandItem {
  const severity = COMMAND_SEVERITIES.includes(r.severity as CommandSeverity)
    ? (r.severity as CommandSeverity)
    : 'info';
  return {
    id: text(r.id),
    severity,
    category: text(r.category),
    title: text(r.title),
    tenantId: maybe(r.tenant_id),
    tenantName: maybe(r.tenant_name),
    isDemo: r.is_demo === true,
    owner: text(r.owner),
    dueAt: maybe(r.due_at),
    status: text(r.status),
    nextStep: text(r.next_step),
    route: text(r.route),
    source: text(r.source),
    evidence: text(r.evidence),
    limitation: text(r.limitation),
    observedAt: text(r.observed_at),
  };
}

/** Live operational exceptions, ordered server-side by urgency. Demo tenants stay out unless explicitly requested. */
export async function loadCommandCenter(includeDemo = false): Promise<CommandItem[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('console_command_center', { include_demo: includeDemo });
  if (error) throw new Error(message(error, 'Could not read the command center.'));
  return rows(data).map(readCommandItem);
}

// ── customers ──────────────────────────────────────────────────────────────

export interface CustomerCommitment {
  id: string;
  commitmentId: string;
  status: string;
  dueOn: string | null;
  evidence: string | null;
  updatedAt: string | null;
}

export interface CustomerContract {
  id: string;
  kind: string;
  signedOn: string | null;
  startsOn: string | null;
  endsOn: string | null;
  documentRef: string | null;
}

export interface Customer {
  id: string;
  tenantId: string;
  /** The school's name, from `public.schools`. */
  schoolName: string;
  isDemo: boolean;
  legalName: string;
  status: string;
  ownerSeat: string;
  createdAt: string | null;
  updatedAt: string | null;
  commitments: CustomerCommitment[];
  contracts: CustomerContract[];
}

/** The reader returns each customer's commitments and contracts as JSON arrays; nothing else is read. */
export async function loadCustomers(includeDemo = false): Promise<Customer[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('console_customers', { include_demo: includeDemo });
  if (error) throw new Error(message(error, 'Could not read the customers.'));
  return rows(data).map((r) => ({
    id: text(r.id),
    tenantId: text(r.tenant_id),
    schoolName: text(r.school_name),
    isDemo: r.is_demo === true,
    legalName: text(r.legal_name),
    status: text(r.status),
    ownerSeat: text(r.owner_seat),
    createdAt: maybe(r.created_at),
    updatedAt: maybe(r.updated_at),
    commitments: rows(r.commitments).map((m) => ({
      id: text(m.id),
      commitmentId: text(m.commitment_id),
      status: text(m.status),
      dueOn: maybe(m.due_on),
      evidence: maybe(m.evidence),
      updatedAt: maybe(m.updated_at),
    })),
    contracts: rows(r.contracts).map((k) => ({
      id: text(k.id),
      kind: text(k.kind),
      signedOn: maybe(k.signed_on),
      startsOn: maybe(k.starts_on),
      endsOn: maybe(k.ends_on),
      documentRef: maybe(k.document_ref),
    })),
  }));
}

// ── tenant operations ─────────────────────────────────────────────────────

export interface TenantOperationFact {
  tenantId: string;
  tenantName: string;
  isDemo: boolean;
  factKey: string;
  category: string;
  label: string;
  value: string;
  classification: string;
  provenance: string;
  owner: string;
  observedAt: string | null;
  staleAfterDays: number;
  limitation: string;
  visibilityReason: string;
}

/** Metadata-only facts for the exact schools carried by the caller's live implementation grants. */
export async function loadTenantOperations(includeDemo = false): Promise<TenantOperationFact[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('console_tenant_operations', { include_demo: includeDemo });
  if (error) throw new Error(message(error, 'Could not read tenant operations.'));
  return rows(data).map((r) => ({
    tenantId: text(r.tenant_id),
    tenantName: text(r.tenant_name),
    isDemo: r.is_demo === true,
    factKey: text(r.fact_key),
    category: text(r.category),
    label: text(r.label),
    value: text(r.value),
    classification: text(r.classification),
    provenance: text(r.provenance),
    owner: text(r.owner),
    observedAt: maybe(r.observed_at),
    staleAfterDays: num(r.stale_after_days),
    limitation: text(r.limitation),
    visibilityReason: text(r.visibility_reason),
  }));
}

export type ProjectionFreshness = 'fresh' | 'stale' | 'failed' | 'unknown';

export interface TenantProjectionEntitlement {
  capability: string;
  state: string;
  deleted: boolean;
  revision: number;
  sourceOccurredAt: string | null;
  projectedAt: string | null;
}

export interface TenantProjectionCoverage {
  freshness: ProjectionFreshness;
  modelVersion: number;
  freshnessSloSeconds: number;
  workerStatus: string;
}

export interface TenantProjectionEnvelope {
  data: {
    tenantId: string;
    entitlements: TenantProjectionEntitlement[];
    rollout: null | {
      state: string;
      resumeState: string | null;
      revision: number;
      sourceOccurredAt: string | null;
      projectedAt: string | null;
    };
  };
  meta: {
    generatedAt: string;
    sourceUpdatedAt: string | null;
    computedAt: string;
    freshness: ProjectionFreshness;
    authority: 'projection';
    modelVersion: number;
    correlationId: string;
    coverage: {
      entitlements: TenantProjectionCoverage & { hasMore: boolean; nextCursor: string | null };
      rollout: TenantProjectionCoverage & { present: boolean };
    };
  };
  permissions: { canView: true; canExport: false; allowedActions: string[] };
  warnings: string[];
}

const PROJECTION_FRESHNESS: ProjectionFreshness[] = ['fresh', 'stale', 'failed', 'unknown'];

function projectionFreshness(value: unknown): ProjectionFreshness {
  if (!PROJECTION_FRESHNESS.includes(value as ProjectionFreshness)) {
    throw new Error('The tenant projection returned an unknown freshness state.');
  }
  return value as ProjectionFreshness;
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`The tenant projection returned an invalid ${field}.`);
  }
  return value;
}

function projectionCoverage(value: unknown): TenantProjectionCoverage {
  const record = object(value);
  return {
    freshness: projectionFreshness(record.freshness),
    modelVersion: finiteNumber(record.modelVersion, 'model version'),
    freshnessSloSeconds: finiteNumber(record.freshnessSloSeconds, 'freshness target'),
    workerStatus: text(record.workerStatus),
  };
}

/** Fail closed when the bounded projection envelope drifts from its database contract. */
export function readTenantProjection(value: unknown): TenantProjectionEnvelope {
  const envelope = object(value);
  const data = object(envelope.data);
  const meta = object(envelope.meta);
  const coverage = object(meta.coverage);
  const entitlementCoverage = object(coverage.entitlements);
  const rolloutCoverage = object(coverage.rollout);
  const permissions = object(envelope.permissions);
  const rollout = data.rollout == null ? null : object(data.rollout);

  if (meta.authority !== 'projection'
      || permissions.canView !== true
      || permissions.canExport !== false
      || !Array.isArray(permissions.allowedActions)
      || permissions.allowedActions.some((action) => typeof action !== 'string')
      || !Array.isArray(data.entitlements)
      || !Array.isArray(envelope.warnings)
      || envelope.warnings.some((warning) => typeof warning !== 'string')) {
    throw new Error('The tenant projection returned an invalid read envelope.');
  }

  return {
    data: {
      tenantId: text(data.tenantId),
      entitlements: data.entitlements.map((entry) => {
        const row = object(entry);
        if (typeof row.deleted !== 'boolean') {
          throw new Error('The tenant projection returned an invalid entitlement state.');
        }
        return {
          capability: text(row.capability),
          state: text(row.state),
          deleted: row.deleted,
          revision: finiteNumber(row.revision, 'entitlement revision'),
          sourceOccurredAt: maybe(row.sourceOccurredAt),
          projectedAt: maybe(row.projectedAt),
        };
      }),
      rollout: rollout && {
        state: text(rollout.state),
        resumeState: maybe(rollout.resumeState),
        revision: finiteNumber(rollout.revision, 'rollout revision'),
        sourceOccurredAt: maybe(rollout.sourceOccurredAt),
        projectedAt: maybe(rollout.projectedAt),
      },
    },
    meta: {
      generatedAt: text(meta.generatedAt),
      sourceUpdatedAt: maybe(meta.sourceUpdatedAt),
      computedAt: text(meta.computedAt),
      freshness: projectionFreshness(meta.freshness),
      authority: 'projection',
      modelVersion: finiteNumber(meta.modelVersion, 'envelope model version'),
      correlationId: text(meta.correlationId),
      coverage: {
        entitlements: {
          ...projectionCoverage(entitlementCoverage),
          hasMore: entitlementCoverage.hasMore === true,
          nextCursor: maybe(entitlementCoverage.nextCursor),
        },
        rollout: {
          ...projectionCoverage(rolloutCoverage),
          present: rolloutCoverage.present === true,
        },
      },
    },
    permissions: {
      canView: true,
      canExport: false,
      allowedActions: permissions.allowedActions as string[],
    },
    warnings: envelope.warnings as string[],
  };
}

/** One exact-tenant, non-exportable read over the private operational projections. */
export async function loadTenantProjection(
  tenantId: string,
  afterCapability: string | null = null,
  limit = 50,
): Promise<TenantProjectionEnvelope> {
  const db = await cloud();
  const { data, error } = await db.rpc('read_tenant_projection', {
    want_tenant: tenantId,
    after_capability: afterCapability,
    want_limit: limit,
  });
  if (error) throw new Error(message(error, 'Could not read the tenant projection.'));
  const projection = readTenantProjection(data);
  if (projection.data.tenantId !== tenantId) {
    throw new Error('The tenant projection did not match the requested tenant.');
  }
  return projection;
}

// ── privacy requests ──────────────────────────────────────────────────────

export type IntegrationHealthState = 'healthy' | 'degraded' | 'stale' | 'failed' | 'unconfigured';

export interface IntegrationHealth {
  connectionId: string;
  tenantId: string;
  tenantName: string;
  isDemo: boolean;
  connectionName: string;
  providerDomain: string;
  providerName: string;
  configurationState: string;
  healthState: IntegrationHealthState;
  featureState: string;
  lastSuccessfulSyncAt: string | null;
  freshnessTargetMinutes: number | null;
  minutesSinceSuccess: number | null;
  latestRunStatus: string | null;
  latestRunAt: string | null;
  reconciliationState: string | null;
  recordsReceived: number;
  recordsRejected: number;
  openErrors: number;
  criticalErrors: number;
  openDeadLetters: number;
  ownerName: string;
  backupOwnerName: string;
  customerImpact: string;
  nextSafeAction: string;
  configurationApprovalId: string | null;
  configurationApprovalStatus: string | null;
  canRequest: boolean;
  classification: string;
  provenance: string;
  limitation: string;
}

const HEALTH_STATES: IntegrationHealthState[] = ['healthy', 'degraded', 'stale', 'failed', 'unconfigured'];

function readIntegrationHealth(r: Row): IntegrationHealth {
  if (!HEALTH_STATES.includes(r.health_state as IntegrationHealthState)) {
    throw new Error('The integration health response contained an unknown health state.');
  }
  return {
    connectionId: text(r.connection_id), tenantId: text(r.tenant_id), tenantName: text(r.tenant_name),
    isDemo: r.is_demo === true, connectionName: text(r.connection_name), providerDomain: text(r.provider_domain),
    providerName: text(r.provider_name), configurationState: text(r.configuration_state),
    healthState: r.health_state as IntegrationHealthState, featureState: text(r.feature_state),
    lastSuccessfulSyncAt: maybe(r.last_successful_sync_at),
    freshnessTargetMinutes: r.freshness_target_minutes == null ? null : num(r.freshness_target_minutes),
    minutesSinceSuccess: r.minutes_since_success == null ? null : num(r.minutes_since_success),
    latestRunStatus: maybe(r.latest_run_status), latestRunAt: maybe(r.latest_run_at),
    reconciliationState: maybe(r.reconciliation_state), recordsReceived: num(r.records_received),
    recordsRejected: num(r.records_rejected), openErrors: num(r.open_errors),
    criticalErrors: num(r.critical_errors), openDeadLetters: num(r.open_dead_letters),
    ownerName: text(r.owner_name), backupOwnerName: text(r.backup_owner_name),
    customerImpact: text(r.customer_impact), nextSafeAction: text(r.next_safe_action),
    configurationApprovalId: maybe(r.configuration_approval_id),
    configurationApprovalStatus: maybe(r.configuration_approval_status), classification: text(r.classification),
    canRequest: r.can_request === true,
    provenance: text(r.provenance), limitation: text(r.limitation),
  };
}

/** Credential-free health for exact schools derived by the server from live grants. */
export async function loadIntegrationHealth(includeDemo = false): Promise<IntegrationHealth[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('console_integration_health', { include_demo: includeDemo });
  if (error) throw new Error(message(error, 'Could not read integration health.'));
  return rows(data).map(readIntegrationHealth);
}

export type ReleaseIncidentState =
  | 'blocked'
  | 'release_candidate'
  | 'deployed_unverified'
  | 'verified'
  | 'incident'
  | 'rollback'
  | 'recovered';

export interface ReleaseIncident {
  itemId: string;
  itemKind: 'release' | 'incident';
  tenantId: string | null;
  tenantName: string | null;
  isDemo: boolean;
  state: ReleaseIncidentState;
  title: string;
  severity: string;
  owner: string;
  affectedWorkflows: string[];
  customerImpact: string;
  communicationStatus: string;
  lastNoticeAt: string | null;
  nextUpdateAt: string | null;
  rollbackStatus: string;
  releaseCommit: string | null;
  deploymentSource: string | null;
  deploymentId: string | null;
  observedAt: string | null;
  expiresAt: string | null;
  approvalId: string | null;
  approvalStatus: string | null;
  canRequest: boolean;
  evidence: string;
  nextSafeAction: string;
  classification: string;
  provenance: string;
  limitation: string;
}

const RELEASE_INCIDENT_STATES: ReleaseIncidentState[] = [
  'blocked', 'release_candidate', 'deployed_unverified', 'verified', 'incident', 'rollback', 'recovered',
];

function readReleaseIncident(r: Row): ReleaseIncident {
  if (r.item_kind !== 'release' && r.item_kind !== 'incident') {
    throw new Error('The release and incident response contained an unknown item kind.');
  }
  if (!RELEASE_INCIDENT_STATES.includes(r.state as ReleaseIncidentState)) {
    throw new Error('The release and incident response contained an unknown state.');
  }
  return {
    itemId: text(r.item_id), itemKind: r.item_kind, tenantId: maybe(r.tenant_id),
    tenantName: maybe(r.tenant_name), isDemo: r.is_demo === true,
    state: r.state as ReleaseIncidentState, title: text(r.title), severity: text(r.severity),
    owner: text(r.owner), affectedWorkflows: strings(r.affected_workflows),
    customerImpact: text(r.customer_impact), communicationStatus: text(r.communication_status),
    lastNoticeAt: maybe(r.last_notice_at), nextUpdateAt: maybe(r.next_update_at),
    rollbackStatus: text(r.rollback_status), releaseCommit: maybe(r.release_commit),
    deploymentSource: maybe(r.deployment_source), deploymentId: maybe(r.deployment_id),
    observedAt: maybe(r.observed_at), expiresAt: maybe(r.expires_at),
    approvalId: maybe(r.approval_id), approvalStatus: maybe(r.approval_status),
    canRequest: r.can_request === true,
    evidence: text(r.evidence), nextSafeAction: text(r.next_safe_action),
    classification: text(r.classification), provenance: text(r.provenance), limitation: text(r.limitation),
  };
}

/** Evidence-derived release and incident summaries at platform scope. No action is executed here. */
export async function loadReleaseIncidents(includeDemo = false): Promise<ReleaseIncident[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('console_release_incidents', { include_demo: includeDemo });
  if (error) throw new Error(message(error, 'Could not read release and incident operations.'));
  return rows(data).map(readReleaseIncident);
}

export type PrivacyRequestKind = 'export' | 'erasure' | 'correction' | 'restriction';
export type PrivacyRequestOutcome = 'completed' | 'refused';

export interface PrivacyRequest {
  requestId: string;
  requestRef: string;
  tenantId: string | null;
  tenantName: string;
  isDemo: boolean;
  kind: PrivacyRequestKind;
  requestedBy: string;
  status: string;
  receivedAt: string;
  dueAt: string;
  overdue: boolean;
  identityState: 'verified' | 'unverified';
  assignedTo: string | null;
  assignedAt: string | null;
  assignedToMe: boolean;
  holdState: 'clear' | 'live_hold';
  affectedStores: string[];
  deletionApprovalId: string | null;
  deletionApprovalStatus: ApprovalStatus | null;
  classification: string;
  provenance: string;
  limitation: string;
}

const PRIVACY_KINDS: PrivacyRequestKind[] = ['export', 'erasure', 'correction', 'restriction'];

/** Metadata-only privacy queue, derived by the server from exact-school data steward grants. */
export async function loadPrivacyRequests(includeDemo = false): Promise<PrivacyRequest[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('console_privacy_requests', { include_demo: includeDemo });
  if (error) throw new Error(message(error, 'Could not read privacy requests.'));
  return rows(data).map((r) => ({
    requestId: text(r.request_id),
    requestRef: text(r.request_ref),
    tenantId: maybe(r.tenant_id),
    tenantName: text(r.tenant_name),
    isDemo: r.is_demo === true,
    kind: PRIVACY_KINDS.includes(r.kind as PrivacyRequestKind) ? (r.kind as PrivacyRequestKind) : 'restriction',
    requestedBy: text(r.requested_by),
    status: text(r.status),
    receivedAt: text(r.received_at),
    dueAt: text(r.due_at),
    overdue: r.overdue === true,
    identityState: r.identity_state === 'verified' ? 'verified' : 'unverified',
    assignedTo: maybe(r.assigned_to),
    assignedAt: maybe(r.assigned_at),
    assignedToMe: r.assigned_to_me === true,
    holdState: r.hold_state === 'live_hold' ? 'live_hold' : 'clear',
    affectedStores: strings(r.affected_stores),
    deletionApprovalId: maybe(r.deletion_approval_id),
    deletionApprovalStatus: STATUSES.includes(r.deletion_approval_status as ApprovalStatus)
      ? (r.deletion_approval_status as ApprovalStatus)
      : null,
    classification: text(r.classification),
    provenance: text(r.provenance),
    limitation: text(r.limitation),
  }));
}

export interface PrivacyRequestDetail {
  requestRef: string;
  subjectReference: string;
  kind: PrivacyRequestKind;
  requestedBy: string;
  detail: string;
  tenantId: string | null;
  verifiedAt: string | null;
  resolution: string;
  resolutionEvidence: string | null;
  completionCertificateId: string | null;
}

/** Fresh-MFA claim. The server also requires exact tenant scope and refuses another steward's case. */
export async function claimPrivacyRequest(requestId: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('claim_privacy_request', { want_request: requestId });
  if (error) throw new Error(message(error, 'Could not claim the privacy request.'));
  return text(data);
}

/** A separate, audited, fresh-MFA detail read after the request has been claimed. */
export async function readPrivacyRequestDetail(requestId: string): Promise<PrivacyRequestDetail> {
  const db = await cloud();
  const { data, error } = await db.rpc('read_privacy_request_detail', { want_request: requestId });
  if (error) throw new Error(message(error, 'Could not read the privacy request detail.'));
  const r = rows(data)[0] ?? object(data);
  return {
    requestRef: text(r.request_ref),
    subjectReference: text(r.subject_reference),
    kind: PRIVACY_KINDS.includes(r.kind as PrivacyRequestKind) ? (r.kind as PrivacyRequestKind) : 'restriction',
    requestedBy: text(r.requested_by),
    detail: text(r.detail),
    tenantId: maybe(r.tenant_id),
    verifiedAt: maybe(r.verified_at),
    resolution: text(r.resolution),
    resolutionEvidence: maybe(r.resolution_evidence),
    completionCertificateId: maybe(r.completion_certificate_id),
  };
}

export async function verifyPrivacyRequest(requestId: string, basis: string, evidence: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('verify_privacy_request', {
    want_request: requestId,
    want_basis: basis,
    want_evidence: evidence,
  });
  if (error) throw new Error(message(error, 'Could not verify identity or authority.'));
  return text(data);
}

export interface PrivacyResolution {
  status: PrivacyRequestOutcome;
  certificateId: string | null;
}

export async function resolvePrivacyRequest(
  requestId: string,
  outcome: PrivacyRequestOutcome,
  resolution: string,
  evidence: string,
  approvalId: string | null = null,
): Promise<PrivacyResolution> {
  const db = await cloud();
  const { data, error } = await db.rpc('resolve_privacy_request', {
    want_request: requestId,
    want_outcome: outcome,
    want_resolution: resolution,
    want_evidence: evidence,
    want_approval: approvalId,
  });
  if (error) throw new Error(message(error, 'Could not resolve the privacy request.'));
  const r = object(data);
  if (r.status !== 'completed' && r.status !== 'refused') {
    throw new Error('The privacy request returned an unexpected resolution status.');
  }
  return {
    status: r.status,
    certificateId: maybe(r.certificate_id),
  };
}

// ── preferences ────────────────────────────────────────────────────────────

/**
 * The operator's own preferences: saved views, the last-open tab. Owner-only
 * by row-level security, so no subject is passed on read, and the write names
 * the caller because the primary key needs it.
 */
export async function loadPreferences(): Promise<Record<string, unknown>> {
  const db = await cloud();
  const { data, error } = await db.from('operator_preference').select('key, value');
  if (error) throw new Error(message(error, 'Could not load your preferences.'));
  const out: Record<string, unknown> = {};
  for (const r of rows(data)) out[text(r.key)] = r.value;
  return out;
}

export async function savePreference(key: string, value: unknown): Promise<void> {
  const db = await cloud();
  const { data: user } = await db.auth.getUser();
  const subject = user.user?.id;
  if (!subject) throw new Error('Sign in again to save a preference.');
  const { error } = await db
    .from('operator_preference')
    .upsert({ subject, key, value, updated_at: new Date().toISOString() }, { onConflict: 'subject,key' });
  if (error) throw new Error(message(error, 'The preference was not saved.'));
}

// ── identity: MFA and the session ──────────────────────────────────────────

export interface MfaLevel {
  currentLevel: string | null;
  nextLevel: string | null;
  /** When a second factor was last verified in this session, or null if never. */
  verifiedAt: Date | null;
}

const MFA_METHODS = new Set(['totp', 'webauthn', 'phone', 'mfa/totp', 'mfa/phone', 'mfa/webauthn']);

export async function mfaLevel(): Promise<MfaLevel> {
  const db = await cloud();
  const { data, error } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw new Error(message(error, 'Could not read the session’s assurance level.'));
  let verifiedAt: Date | null = null;
  for (const entry of data?.currentAuthenticationMethods ?? []) {
    if (typeof entry === 'string') continue;
    if (!MFA_METHODS.has(entry.method)) continue;
    const at = new Date(entry.timestamp * 1000);
    if (!verifiedAt || at > verifiedAt) verifiedAt = at;
  }
  return { currentLevel: data?.currentLevel ?? null, nextLevel: data?.nextLevel ?? null, verifiedAt };
}

/** Whether a second factor was verified within `MFA_FRESH_MINUTES` — what `private.mfa_fresh` will say. */
export function mfaFresh(level: MfaLevel, now = new Date()): boolean {
  if (level.currentLevel !== 'aal2' || !level.verifiedAt) return false;
  return now.getTime() - level.verifiedAt.getTime() <= MFA_FRESH_MINUTES * 60_000;
}

export interface TotpEnrolment {
  factorId: string;
  /** An SVG data URI to draw. */
  qrCode: string;
  secret: string;
  uri: string;
}

/** The verified TOTP factors this account already has, so the step knows whether to enrol or challenge. */
export async function totpFactors(): Promise<{ id: string; name: string }[]> {
  const db = await cloud();
  const { data, error } = await db.auth.mfa.listFactors();
  if (error) throw new Error(message(error, 'Could not list your authenticators.'));
  return (data?.totp ?? []).map((f) => ({ id: f.id, name: f.friendly_name ?? '' }));
}

export async function enrollTotp(friendlyName = 'Operations console'): Promise<TotpEnrolment> {
  const db = await cloud();
  const { data, error } = await db.auth.mfa.enroll({ factorType: 'totp', friendlyName });
  if (error || !data) throw new Error(message(error, 'Could not start enrolment.'));
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri };
}

export async function challengeTotp(factorId: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.auth.mfa.challenge({ factorId });
  if (error || !data) throw new Error(message(error, 'Could not start the challenge.'));
  return data.id;
}

export async function verifyTotp(factorId: string, challengeId: string, code: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.auth.mfa.verify({ factorId, challengeId, code: code.replace(/\s+/g, '') });
  if (error) throw new Error(message(error, 'That code was not accepted.'));
}

/** When the session's access token expires, or null when there is no session. */
export async function sessionExpiry(): Promise<Date | null> {
  const db = await cloud();
  const { data } = await db.auth.getSession();
  const at = data.session?.expires_at;
  return typeof at === 'number' ? new Date(at * 1000) : null;
}

// ── support access ─────────────────────────────────────────────────────────

export interface SupportGrant {
  grantId: string;
  /** The student, as the grant labels them. */
  student: string;
  /** The reason the student gave — the ticket, where one was named. */
  reason: string;
  expiresAt: string;
}

/** The support-access windows open *to* this operator: which student, why, until when. */
export async function openSupportGrants(now = new Date()): Promise<SupportGrant[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('support_access_windows');
  if (error) throw new Error(message(error, 'Could not load support access.'));
  return rows(data)
    .filter((r) => r.side === 'supporter' && r.revoked_at == null)
    .filter((r) => new Date(text(r.expires_at)).getTime() > now.getTime())
    .map((r) => ({
      grantId: text(r.grant_id),
      student: text(r.counterpart_label),
      reason: text(r.reason),
      expiresAt: text(r.expires_at),
    }));
}
