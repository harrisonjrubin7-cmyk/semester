import type { ApprovalRequest, CommandItem, IntegrationHealth } from './client';
import type { ConsoleWorkspaceId } from './workspaces';

/**
 * My work: one queue over readers the console already has.
 *
 * Nothing here reads, grants or decides anything. Each source is read by its
 * own server reader under its own capability; this module only turns the rows
 * those readers return into one shape, orders them, and says how complete the
 * picture is. A source that was not readable is never counted as zero: the
 * overview says which sources are missing, and the total becomes a floor.
 */

export type WorkSource = 'command' | 'approvals' | 'integration-health';
export type WorkPriority = 'critical' | 'high' | 'medium' | 'low';

export const WORK_SOURCES: readonly { id: WorkSource; label: string; reader: string; workspace: ConsoleWorkspaceId }[] = [
  { id: 'command', label: 'Operational exceptions', reader: 'console_command_center', workspace: 'command' },
  { id: 'approvals', label: 'Approvals', reader: 'console_approvals', workspace: 'approvals' },
  { id: 'integration-health', label: 'Integration health', reader: 'console_integration_health', workspace: 'integration-health' },
];

export interface WorkItem {
  /** Unique across sources. */
  key: string;
  source: WorkSource;
  title: string;
  priority: WorkPriority;
  status: string;
  owner: string;
  /** Why this is in the operator's queue, in one plain sentence. */
  reason: string;
  tenantId: string | null;
  tenantName: string | null;
  dueAt: string | null;
  nextStep: string;
  evidence: string;
  limitation: string;
  observedAt: string | null;
  /** The workspace that holds the record and its permitted actions. */
  openIn: ConsoleWorkspaceId;
}

export type SourceRead =
  | { state: 'not-granted' }
  | { state: 'loading' }
  | { state: 'unavailable'; error: string }
  | { state: 'read'; readAt: string };

export const PRIORITY_ORDER: Record<WorkPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
export const PRIORITY_LABEL: Record<WorkPriority, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

/** An approval that expires inside this window is raised to high. */
export const EXPIRY_SOON_MS = 24 * 60 * 60 * 1000;

export function fromCommand(item: CommandItem): WorkItem {
  return {
    key: `command:${item.id}`,
    source: 'command',
    title: item.title,
    priority: item.severity === 'info' ? 'low' : item.severity,
    status: item.status,
    owner: item.owner,
    reason: `Open ${item.category} exception from the live command center.`,
    tenantId: item.tenantId,
    tenantName: item.tenantName,
    dueAt: item.dueAt,
    nextStep: item.nextStep,
    evidence: item.evidence,
    limitation: item.limitation,
    observedAt: item.observedAt || null,
    openIn: 'command',
  };
}

/**
 * Only approvals the operator can move are work: one they can decide, one
 * they asked for that is still waiting, or one they asked for that is
 * approved and not yet executed. Expired and finished requests are history.
 */
export function fromApproval(a: ApprovalRequest, now: Date): WorkItem | null {
  const expires = Date.parse(a.expiresAt);
  if (Number.isFinite(expires) && expires <= now.getTime()) return null;
  const soon = Number.isFinite(expires) && expires - now.getTime() <= EXPIRY_SOON_MS;

  let priority: WorkPriority;
  let status: string;
  let reason: string;
  let nextStep: string;
  if (a.status === 'pending' && a.canDecide && !a.decidedByMe) {
    priority = 'high';
    status = 'Awaiting your decision';
    reason = 'You hold an approver party for this duty and have not decided.';
    nextStep = 'Open it in Approvals, check the target and evidence, then approve or reject.';
  } else if (a.status === 'pending' && a.mine) {
    priority = soon ? 'high' : 'medium';
    status = 'Waiting on approvers';
    reason = 'You asked for this; it needs other approvers before it can run.';
    nextStep = 'Follow up with an approver before it expires, or let it lapse.';
  } else if (a.status === 'approved' && a.mine && !a.executedAt) {
    priority = 'high';
    status = 'Approved — ready to act';
    reason = 'You asked for this and it is approved but not yet executed.';
    nextStep = 'Act on it from Approvals; the server revalidates before it runs.';
  } else {
    return null;
  }
  return {
    key: `approval:${a.id}`,
    source: 'approvals',
    title: `${a.dutyId}${a.target ? ` — ${a.target}` : ''}`,
    priority,
    status,
    owner: a.mine ? 'you (requester)' : 'approver',
    reason: soon ? `${reason} It expires within a day.` : reason,
    tenantId: a.tenantId,
    tenantName: a.tenantName,
    dueAt: a.expiresAt || null,
    nextStep,
    evidence: `Ticket ${a.ticket}. ${a.evidence}`,
    limitation: `${a.approvals} approval${a.approvals === 1 ? '' : 's'}, ${a.rejections} rejection${a.rejections === 1 ? '' : 's'} recorded. The request cannot be edited after it is made.`,
    observedAt: a.decidedAt ?? a.createdAt ?? null,
    openIn: 'approvals',
  };
}

const HEALTH_PRIORITY: Record<IntegrationHealth['healthState'], WorkPriority | null> = {
  healthy: null,
  failed: 'high',
  degraded: 'medium',
  stale: 'medium',
  unconfigured: 'low',
};

export function fromIntegration(h: IntegrationHealth): WorkItem | null {
  const base = HEALTH_PRIORITY[h.healthState];
  if (base === null) return null;
  const priority: WorkPriority = h.criticalErrors > 0 ? 'critical' : base;
  const lag = h.minutesSinceSuccess === null ? 'no successful sync recorded' : `${h.minutesSinceSuccess} min since last success`;
  return {
    key: `integration:${h.connectionId}`,
    source: 'integration-health',
    title: `${h.connectionName} (${h.providerName})`,
    priority,
    status: h.healthState,
    owner: h.ownerName,
    reason: `Connector is ${h.healthState}: ${lag}; ${h.openErrors} open error${h.openErrors === 1 ? '' : 's'}.`,
    tenantId: h.tenantId,
    tenantName: h.tenantName,
    dueAt: null,
    nextStep: h.nextSafeAction,
    evidence: h.provenance,
    limitation: h.limitation,
    observedAt: h.latestRunAt,
    openIn: 'integration-health',
  };
}

export type WorkSort = 'priority' | 'due' | 'source';

export function sortWork(items: readonly WorkItem[], by: WorkSort = 'priority'): WorkItem[] {
  const due = (w: WorkItem) => {
    const t = w.dueAt ? Date.parse(w.dueAt) : Number.NaN;
    return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
  };
  // Infinity minus Infinity is NaN, so two undated items must compare equal explicitly.
  const dueDiff = (a: WorkItem, b: WorkItem) => {
    const da = due(a);
    const db = due(b);
    return da === db ? 0 : da - db;
  };
  const sourceIndex = (w: WorkItem) => WORK_SOURCES.findIndex((s) => s.id === w.source);
  return [...items].sort((a, b) => {
    const primary = by === 'due'
      ? dueDiff(a, b)
      : by === 'source'
        ? sourceIndex(a) - sourceIndex(b)
        : PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (primary !== 0) return primary;
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || dueDiff(a, b) || a.title.localeCompare(b.title);
  });
}

export interface WorkOverview {
  /** Items counted from sources that were read. */
  counted: number;
  byPriority: Record<WorkPriority, number>;
  read: number;
  granted: number;
  /** Granted sources that failed or are still loading. */
  missing: WorkSource[];
  /** True only when every granted source was read; otherwise the count is a floor. */
  complete: boolean;
}

export function overview(items: readonly WorkItem[], reads: Record<WorkSource, SourceRead>): WorkOverview {
  const byPriority: Record<WorkPriority, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const item of items) byPriority[item.priority] += 1;
  const granted = WORK_SOURCES.filter((s) => reads[s.id].state !== 'not-granted');
  const missing = granted.filter((s) => reads[s.id].state !== 'read').map((s) => s.id);
  return {
    counted: items.length,
    byPriority,
    read: granted.length - missing.length,
    granted: granted.length,
    missing,
    complete: granted.length > 0 && missing.length === 0,
  };
}
