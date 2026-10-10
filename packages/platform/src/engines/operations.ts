import type { RequestContext } from '../tenancy/context.ts';
import { PlatformError } from '../gateway/errors.ts';

export const WORK_ITEM_PRIORITIES = ['normal', 'high', 'urgent'] as const;
export type WorkItemPriority = (typeof WORK_ITEM_PRIORITIES)[number];
export type WorkItemState = 'open' | 'claimed' | 'resolved';

export interface WorkItemHistoryEntry {
  action: 'opened' | 'claimed' | 'resolved' | 'reopened';
  actorId: string;
  at: string;
  reason?: string;
}

export interface OperationsWorkItem {
  id: string;
  tenantId: string;
  kind: string;
  subject: { type: string; id: string };
  sourceRef: string;
  purpose: string;
  priority: WorkItemPriority;
  state: WorkItemState;
  version: number;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  resolution?: { code: string; summary: string; receiptRef: string };
  history: readonly WorkItemHistoryEntry[];
}

export function openWorkItem(
  ctx: RequestContext,
  input: Omit<OperationsWorkItem, 'tenantId' | 'state' | 'version' | 'createdAt' | 'updatedAt' | 'history' | 'assignedTo' | 'resolution'>,
  now: Date,
): OperationsWorkItem {
  for (const [name, value] of [
    ['id', input.id], ['kind', input.kind], ['subject type', input.subject.type], ['subject id', input.subject.id],
    ['source reference', input.sourceRef], ['purpose', input.purpose],
  ] as const) {
    if (!value.trim()) throw new PlatformError('validation_failed', `The work item's ${name} is required.`);
  }
  if (!WORK_ITEM_PRIORITIES.includes(input.priority)) {
    throw new PlatformError('validation_failed', 'The work item priority is not recognized.');
  }
  const at = instant(now);
  return {
    ...input,
    tenantId: ctx.tenantId,
    state: 'open',
    version: 1,
    createdAt: at,
    updatedAt: at,
    history: [{ action: 'opened', actorId: ctx.actor.personId, at }],
  };
}

export function claimWorkItem(ctx: RequestContext, item: OperationsWorkItem, expectedVersion: number, now: Date): OperationsWorkItem {
  inspect(ctx, item, expectedVersion);
  if (item.state !== 'open') throw new PlatformError('precondition_failed', `This work item is ${item.state}, not open.`);
  const at = instant(now);
  return {
    ...item,
    state: 'claimed',
    assignedTo: ctx.actor.personId,
    version: item.version + 1,
    updatedAt: at,
    history: [...item.history, { action: 'claimed', actorId: ctx.actor.personId, at }],
  };
}

export function resolveWorkItem(
  ctx: RequestContext,
  item: OperationsWorkItem,
  expectedVersion: number,
  resolution: { code: string; summary: string; receiptRef: string },
  now: Date,
): OperationsWorkItem {
  inspect(ctx, item, expectedVersion);
  if (item.state !== 'claimed') throw new PlatformError('precondition_failed', `This work item is ${item.state}, not claimed.`);
  if (item.assignedTo !== ctx.actor.personId) throw new PlatformError('forbidden', 'Only the assigned operator may resolve this work item.');
  if (!resolution.code.trim() || !resolution.summary.trim() || !resolution.receiptRef.trim()) {
    throw new PlatformError('validation_failed', 'A resolution code, summary, and durable receipt reference are required.');
  }
  const at = instant(now);
  return {
    ...item,
    state: 'resolved',
    resolution: { ...resolution },
    version: item.version + 1,
    updatedAt: at,
    history: [...item.history, { action: 'resolved', actorId: ctx.actor.personId, at }],
  };
}

export function reopenWorkItem(
  ctx: RequestContext,
  item: OperationsWorkItem,
  expectedVersion: number,
  reason: string,
  now: Date,
): OperationsWorkItem {
  inspect(ctx, item, expectedVersion);
  if (item.state !== 'resolved') throw new PlatformError('precondition_failed', `This work item is ${item.state}, not resolved.`);
  if (!reason.trim()) throw new PlatformError('validation_failed', 'Reopening a work item requires a reason.');
  const at = instant(now);
  const { assignedTo: _assignedTo, resolution: _resolution, ...kept } = item;
  return {
    ...kept,
    state: 'open',
    version: item.version + 1,
    updatedAt: at,
    history: [...item.history, { action: 'reopened', actorId: ctx.actor.personId, at, reason }],
  };
}

function inspect(ctx: RequestContext, item: OperationsWorkItem, expectedVersion: number): void {
  // A foreign id is indistinguishable from a missing id: the operations queue is not a tenant oracle.
  if (item.tenantId !== ctx.tenantId) throw new PlatformError('not_found', 'We could not find that work item.');
  if (item.version !== expectedVersion) {
    throw new PlatformError('conflict', 'This work item changed while you were looking at it. Reload and try again.');
  }
}

function instant(value: Date): string {
  if (!Number.isFinite(value.getTime())) throw new PlatformError('validation_failed', 'The work item time is not valid.');
  return value.toISOString();
}
