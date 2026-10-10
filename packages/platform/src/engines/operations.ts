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

export type WorkItemAction = 'open' | 'read' | 'claim' | 'resolve' | 'reopen';
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
    const item = await this.loadStored(ctx, id);
    await this.requireAuthorized(ctx, 'read', item);
    return item;
  }

  async claim(ctx: RequestContext, id: string, expectedVersion: number): Promise<OperationsWorkItem> {
    const current = await this.loadStored(ctx, id);
    await this.requireAuthorized(ctx, 'claim', current);
    return this.save(claimWorkItem(ctx, current, expectedVersion, this.clock.now()), current.version);
  }

  async resolve(ctx: RequestContext, id: string, expectedVersion: number, resolution: { code: string; summary: string; receiptRef: string }): Promise<OperationsWorkItem> {
    const current = await this.loadStored(ctx, id);
    await this.requireAuthorized(ctx, 'resolve', current);
    return this.save(resolveWorkItem(ctx, current, expectedVersion, resolution, this.clock.now()), current.version);
  }

  async reopen(ctx: RequestContext, id: string, expectedVersion: number, reason: string): Promise<OperationsWorkItem> {
    const current = await this.loadStored(ctx, id);
    await this.requireAuthorized(ctx, 'reopen', current);
    return this.save(reopenWorkItem(ctx, current, expectedVersion, reason, this.clock.now()), current.version);
  }

  private async save(next: OperationsWorkItem, expectedVersion: number): Promise<OperationsWorkItem> {
    if (!(await this.store.put(next, expectedVersion))) throw changed();
    return freezeItem(next);
  }

  private async loadStored(ctx: RequestContext, id: string): Promise<OperationsWorkItem> {
    const item: unknown = await this.store.get(ctx.tenantId, id);
    if (!item) throw missing();
    return validateStoredItem(item, ctx.tenantId, id);
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
    id: input.id,
    tenantId: ctx.tenantId,
    kind: input.kind,
    subject: { type: input.subject.type, id: input.subject.id },
    sourceRef: input.sourceRef,
    purpose: input.purpose,
    priority: input.priority,
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
  const recorded = { code: resolution.code, summary: resolution.summary, receiptRef: resolution.receiptRef };
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

function missing(): PlatformError {
  return new PlatformError('not_found', 'We could not find that work item.');
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

function isPriority(value: unknown): value is WorkItemPriority {
  return typeof value === 'string' && WORK_ITEM_PRIORITIES.some((priority) => priority === value);
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

function validateStoredItem(value: unknown, tenantId: string, id: string): OperationsWorkItem {
  if (!value || typeof value !== 'object') throw corrupt();
  const item = value as Partial<OperationsWorkItem>;
  // Scope and identity are checked before structure, state, version, or policy so a bad adapter cannot become a tenant oracle.
  if (item.tenantId !== tenantId || item.id !== id) throw missing();
  if (!isPriority(item.priority)) throw corrupt();
  if (!isText(item.kind) || !isText(item.sourceRef) || !isText(item.purpose)
    || !item.subject || !isText(item.subject.type) || !isText(item.subject.id)
    || !['open', 'claimed', 'resolved'].includes(item.state ?? '')
    || !Number.isInteger(item.version) || (item.version ?? 0) < 1
    || !isInstant(item.createdAt) || !isInstant(item.updatedAt)
    || Date.parse(item.updatedAt) < Date.parse(item.createdAt)
    || !Array.isArray(item.history) || item.history.length !== item.version) throw corrupt();

  let previous = -Infinity;
  let previousAction: WorkItemHistoryEntry['action'] | undefined;
  let latestClaimActor: string | undefined;
  const history: WorkItemHistoryEntry[] = [];
  for (const entry of item.history) {
    if (!entry || !['opened', 'claimed', 'resolved', 'reopened'].includes(entry.action)
      || !isText(entry.actorId) || !isInstant(entry.at) || Date.parse(entry.at) < previous
      || (entry.reason !== undefined && !isText(entry.reason))
      || (entry.resolution !== undefined && !validResolution(entry.resolution))) throw corrupt();
    const expected = previousAction === undefined ? 'opened'
      : previousAction === 'opened' || previousAction === 'reopened' ? 'claimed'
        : previousAction === 'claimed' ? 'resolved' : 'reopened';
    if (entry.action !== expected) throw corrupt();
    if (entry.action === 'resolved') {
      if (!entry.resolution || entry.reason !== undefined || entry.actorId !== latestClaimActor) throw corrupt();
    } else if (entry.action === 'reopened') {
      if (!entry.reason || entry.resolution !== undefined) throw corrupt();
    } else if (entry.reason !== undefined || entry.resolution !== undefined) throw corrupt();
    if (entry.action === 'claimed') latestClaimActor = entry.actorId;
    history.push({
      action: entry.action,
      actorId: entry.actorId,
      at: entry.at,
      ...(entry.reason !== undefined ? { reason: entry.reason } : {}),
      ...(entry.resolution !== undefined ? { resolution: canonicalResolution(entry.resolution) } : {}),
    });
    previous = Date.parse(entry.at);
    previousAction = entry.action;
  }
  const last = history.at(-1)!;
  const stateFor = last.action === 'claimed' ? 'claimed' : last.action === 'resolved' ? 'resolved' : 'open';
  if (item.createdAt !== history[0]!.at
    || item.updatedAt !== last.at || item.state !== stateFor) throw corrupt();
  if (item.state === 'open' && (item.assignedTo !== undefined || item.resolution !== undefined)) throw corrupt();
  if (item.state === 'claimed' && (item.assignedTo !== latestClaimActor || item.resolution !== undefined)) throw corrupt();
  if (item.state === 'resolved' && (item.assignedTo !== latestClaimActor || !validResolution(item.resolution)
    || !sameResolution(item.resolution, last.resolution))) throw corrupt();
  return freezeItem({
    id,
    tenantId,
    kind: item.kind,
    subject: { type: item.subject.type, id: item.subject.id },
    sourceRef: item.sourceRef,
    purpose: item.purpose,
    priority: item.priority,
    state: item.state,
    version: item.version,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ...(item.assignedTo !== undefined ? { assignedTo: item.assignedTo } : {}),
    ...(item.resolution !== undefined ? { resolution: canonicalResolution(item.resolution) } : {}),
    history,
  });
}

function validResolution(value: unknown): value is { code: string; summary: string; receiptRef: string } {
  if (!value || typeof value !== 'object') return false;
  const resolution = value as Partial<{ code: string; summary: string; receiptRef: string }>;
  return isText(resolution.code) && isText(resolution.summary) && isText(resolution.receiptRef);
}

function canonicalResolution(value: { code: string; summary: string; receiptRef: string }): { code: string; summary: string; receiptRef: string } {
  return { code: value.code, summary: value.summary, receiptRef: value.receiptRef };
}

function sameResolution(
  left: { code: string; summary: string; receiptRef: string },
  right: { code: string; summary: string; receiptRef: string } | undefined,
): boolean {
  return right !== undefined && left.code === right.code && left.summary === right.summary && left.receiptRef === right.receiptRef;
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function corrupt(): PlatformError {
  return new PlatformError('internal', 'The work item record could not be read safely.');
}
