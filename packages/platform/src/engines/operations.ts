import type { RequestContext } from '../tenancy/context.ts';
import { PlatformError } from '../gateway/errors.ts';
import type { Clock } from '../kernel/clock.ts';

export const WORK_ITEM_PRIORITIES = ['normal', 'high', 'urgent'] as const;
export type WorkItemPriority = (typeof WORK_ITEM_PRIORITIES)[number];
export type WorkItemState = 'open' | 'claimed' | 'resolved';

export interface WorkItemHistoryEntry {
  action: 'opened' | 'claimed' | 'resolved' | 'reopened';
  actorId: string;
  at: string;
  reason?: string;
  resolution?: { code: string; summary: string; receiptRef: string };
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

export type OpenWorkItemInput = Omit<OperationsWorkItem, 'tenantId' | 'state' | 'version' | 'createdAt' | 'updatedAt' | 'history' | 'assignedTo' | 'resolution'>;

export interface OperationsWorkItemStore {
  get(tenantId: string, id: string): Promise<OperationsWorkItem | undefined>;
  put(item: OperationsWorkItem, expectedVersion: number): Promise<boolean>;
}

export type WorkItemAction = 'open' | 'claim' | 'resolve' | 'reopen';
export type OperationsWorkItemAuthorizer = (
  ctx: RequestContext,
  action: WorkItemAction,
  item?: OperationsWorkItem,
) => boolean | Promise<boolean>;

export class MemoryOperationsWorkItemStore implements OperationsWorkItemStore {
  private rows = new Map<string, OperationsWorkItem>();

  async get(tenantId: string, id: string): Promise<OperationsWorkItem | undefined> {
    const item = this.rows.get(JSON.stringify([tenantId, id]));
    return item ? freezeItem(structuredClone(item)) : undefined;
  }

  async put(item: OperationsWorkItem, expectedVersion: number): Promise<boolean> {
    const key = JSON.stringify([item.tenantId, item.id]);
    if ((this.rows.get(key)?.version ?? 0) !== expectedVersion) return false;
    this.rows.set(key, structuredClone(item));
    return true;
  }
}

export class OperationsWorkItemRuntime {
  private readonly store: OperationsWorkItemStore;
  private readonly clock: Clock;
  private readonly authorize: OperationsWorkItemAuthorizer;

  constructor(store: OperationsWorkItemStore, clock: Clock, authorize: OperationsWorkItemAuthorizer) {
    this.store = store;
    this.clock = clock;
    this.authorize = authorize;
  }

  async open(ctx: RequestContext, input: OpenWorkItemInput): Promise<OperationsWorkItem> {
    await this.requireAuthorized(ctx, 'open');
    const item = openWorkItem(ctx, input, this.clock.now());
    if (!(await this.store.put(item, 0))) throw changed();
    return item;
  }

  async load(ctx: RequestContext, id: string): Promise<OperationsWorkItem> {
    const item = await this.store.get(ctx.tenantId, id);
    if (!item) throw new PlatformError('not_found', 'We could not find that work item.');
    return freezeItem(item);
  }

  async claim(ctx: RequestContext, id: string, expectedVersion: number): Promise<OperationsWorkItem> {
    const current = await this.load(ctx, id);
    await this.requireAuthorized(ctx, 'claim', current);
    return this.save(claimWorkItem(ctx, current, expectedVersion, this.clock.now()), current.version);
  }

  async resolve(ctx: RequestContext, id: string, expectedVersion: number, resolution: { code: string; summary: string; receiptRef: string }): Promise<OperationsWorkItem> {
    const current = await this.load(ctx, id);
    await this.requireAuthorized(ctx, 'resolve', current);
    return this.save(resolveWorkItem(ctx, current, expectedVersion, resolution, this.clock.now()), current.version);
  }

  async reopen(ctx: RequestContext, id: string, expectedVersion: number, reason: string): Promise<OperationsWorkItem> {
    const current = await this.load(ctx, id);
    await this.requireAuthorized(ctx, 'reopen', current);
    return this.save(reopenWorkItem(ctx, current, expectedVersion, reason, this.clock.now()), current.version);
  }

  private async save(next: OperationsWorkItem, expectedVersion: number): Promise<OperationsWorkItem> {
    if (!(await this.store.put(next, expectedVersion))) throw changed();
    return freezeItem(next);
  }

  private async requireAuthorized(ctx: RequestContext, action: WorkItemAction, item?: OperationsWorkItem): Promise<void> {
    if (!(await this.authorize(ctx, action, item))) {
      throw new PlatformError('forbidden', 'Your role cannot perform this operations work action.');
    }
  }
}

function openWorkItem(
  ctx: RequestContext,
  input: OpenWorkItemInput,
  now: Date,
): OperationsWorkItem {
  for (const [name, value] of [
    ['id', input?.id], ['kind', input?.kind], ['subject type', input?.subject?.type], ['subject id', input?.subject?.id],
    ['source reference', input?.sourceRef], ['purpose', input?.purpose],
  ] as const) {
    requiredText(value, `The work item's ${name} is required.`);
  }
  if (!WORK_ITEM_PRIORITIES.some((priority) => priority === input?.priority)) {
    throw new PlatformError('validation_failed', 'The work item priority is not recognized.');
  }
  const at = instant(now);
  return freezeItem({
    ...input,
    tenantId: ctx.tenantId,
    state: 'open',
    version: 1,
    createdAt: at,
    updatedAt: at,
    history: [{ action: 'opened', actorId: ctx.actor.personId, at }],
  });
}

function claimWorkItem(ctx: RequestContext, item: OperationsWorkItem, expectedVersion: number, now: Date): OperationsWorkItem {
  inspect(ctx, item, expectedVersion);
  if (item.state !== 'open') throw new PlatformError('precondition_failed', `This work item is ${item.state}, not open.`);
  const at = instant(now, item.updatedAt);
  return freezeItem({
    ...item,
    state: 'claimed',
    assignedTo: ctx.actor.personId,
    version: item.version + 1,
    updatedAt: at,
    history: [...item.history, { action: 'claimed', actorId: ctx.actor.personId, at }],
  });
}

function resolveWorkItem(
  ctx: RequestContext,
  item: OperationsWorkItem,
  expectedVersion: number,
  resolution: { code: string; summary: string; receiptRef: string },
  now: Date,
): OperationsWorkItem {
  inspect(ctx, item, expectedVersion);
  if (item.state !== 'claimed') throw new PlatformError('precondition_failed', `This work item is ${item.state}, not claimed.`);
  if (item.assignedTo !== ctx.actor.personId) throw new PlatformError('forbidden', 'Only the assigned operator may resolve this work item.');
  if (!isText(resolution?.code) || !isText(resolution?.summary) || !isText(resolution?.receiptRef)) {
    throw new PlatformError('validation_failed', 'A resolution code, summary, and durable receipt reference are required.');
  }
  const at = instant(now, item.updatedAt);
  const recorded = { ...resolution };
  return freezeItem({
    ...item,
    state: 'resolved',
    resolution: recorded,
    version: item.version + 1,
    updatedAt: at,
    history: [...item.history, { action: 'resolved', actorId: ctx.actor.personId, at, resolution: recorded }],
  });
}

function reopenWorkItem(
  ctx: RequestContext,
  item: OperationsWorkItem,
  expectedVersion: number,
  reason: string,
  now: Date,
): OperationsWorkItem {
  inspect(ctx, item, expectedVersion);
  if (item.state !== 'resolved') throw new PlatformError('precondition_failed', `This work item is ${item.state}, not resolved.`);
  if (!isText(reason)) throw new PlatformError('validation_failed', 'Reopening a work item requires a reason.');
  const at = instant(now, item.updatedAt);
  const { assignedTo: _assignedTo, resolution: _resolution, ...kept } = item;
  return freezeItem({
    ...kept,
    state: 'open',
    version: item.version + 1,
    updatedAt: at,
    history: [...item.history, { action: 'reopened', actorId: ctx.actor.personId, at, reason }],
  });
}

function inspect(ctx: RequestContext, item: OperationsWorkItem, expectedVersion: number): void {
  // A foreign id is indistinguishable from a missing id: the operations queue is not a tenant oracle.
  if (item.tenantId !== ctx.tenantId) throw new PlatformError('not_found', 'We could not find that work item.');
  if (item.version !== expectedVersion) {
    throw changed();
  }
}

function changed(): PlatformError {
  return new PlatformError('conflict', 'This work item changed while you were looking at it. Reload and try again.');
}

function instant(value: Date, notBefore?: string): string {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new PlatformError('validation_failed', 'The work item time is not valid.');
  const at = value.toISOString();
  if (notBefore !== undefined && Date.parse(at) < Date.parse(notBefore)) {
    throw new PlatformError('validation_failed', 'A work item transition cannot be recorded before its previous update.');
  }
  return at;
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function requiredText(value: unknown, message: string): asserts value is string {
  if (!isText(value)) throw new PlatformError('validation_failed', message);
}

function freezeItem(item: OperationsWorkItem): OperationsWorkItem {
  for (const entry of item.history) {
    if (entry.resolution) Object.freeze(entry.resolution);
    Object.freeze(entry);
  }
  Object.freeze(item.history);
  Object.freeze(item.subject);
  if (item.resolution) Object.freeze(item.resolution);
  return Object.freeze(item);
}
