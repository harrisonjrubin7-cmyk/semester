import { createHash, randomUUID } from 'node:crypto';
import {
  applyObligations,
  decide,
  makeEvent,
  type AuthorizationRequest,
  type ConsentGrant,
  type PolicyAction,
  type PolicyObligation,
  type RoleGrant,
  type SemesterEvent,
  type UserAction,
} from '../../../packages/institution/src/index.ts';
import {
  AUTHORITATIVE_FIELDS,
  TASK_FIELDS,
  LIMITS,
  clampClock,
  encodeCursor,
  entityTypeOf,
  isUuid,
  parseClock,
  spanIssue,
  validateCommand,
  verbOf,
  type CalendarEvent,
  type Command,
  type CommandResult,
  type CursorPosition,
  type Entity,
  type EntityType,
  type Page,
  type Task,
} from './contract.ts';
import {
  taskSortKey,
  type AuditRow,
  type ProductivityRepository,
  type ProductivityTx,
  type Scope,
  type StoredResult,
} from './repository.ts';

/**
 * Who is asking, as the server established it. Built from the verified
 * session and the membership records by the authenticator — never from
 * anything in the request body or the URL.
 */
export interface Principal {
  actor: AuthorizationRequest['actor'];
  tenant: AuthorizationRequest['tenant'];
  membershipIds: string[];
  roleGrants: RoleGrant[];
  capabilities: string[];
  featureFlags: string[];
  policyVersions: Record<string, string>;
  /** Share grants from `ownerId` to this actor, resolved on demand; absent means none. */
  consentGrantsFor?: (ownerId: string) => ConsentGrant[] | Promise<ConsentGrant[]>;
}

export interface RequestMeta {
  correlationId: string;
  /** Said by the caller, recorded, and required for anything that is not the person's own data. */
  purpose?: string;
}

/** A refusal the HTTP layer turns into the error envelope. `code` is something a client may switch on. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly userAction?: UserAction;
  readonly details?: { path: string; issue: string }[];
  constructor(status: number, code: string, message: string, extra: { userAction?: UserAction; details?: { path: string; issue: string }[] } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    if (extra.userAction) this.userAction = extra.userAction;
    if (extra.details) this.details = extra.details;
  }
}

export interface ServiceDeps {
  repo: ProductivityRepository;
  now?: () => number;
  newId?: () => string;
  /** Called once per command with its outcome, for metrics. Never carries content. */
  onCommand?: (outcome: { type: string; status: string; actorType: string }) => void;
  /** Called after every policy decision, allowed or not. The action and the verdict, nothing about the data. */
  onDecision?: (decision: { action: string; allow: boolean; reasonCode?: string }) => void;
  /**
   * Called with whatever a failed command threw. The caller of the API is told only that it failed and may
   * be resent; this is where the reason goes — to the server's own log, keyed by the correlation id.
   */
  onError?: (error: unknown, context: { where: 'command'; correlationId: string }) => void;
}

// ── Wire shapes ───────────────────────────────────────────────────────────

/** What leaves the service: the record without the machinery of the merge. */
export type Wire = Record<string, unknown>;

const INTERNAL = new Set(['clocks', 'deleteClock', 'tenantId']);

function wire(entity: Entity): Wire {
  const type: EntityType = 'status' in entity ? 'task' : 'calendar_event';
  const out: Wire = { type };
  for (const [k, v] of Object.entries(entity)) if (!INTERNAL.has(k)) out[k] = v;
  return out;
}

const iso = (ms: number) => new Date(ms).toISOString();

/** Keys sorted at every depth, so the same command always hashes the same. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const EVENT_FOR: Record<string, Record<string, string>> = {
  task: { create: 'task.created', update: 'task.updated', complete: 'task.completed', reopen: 'task.updated', delete: 'task.deleted' },
  calendar_event: { create: 'calendar_event.created', update: 'calendar_event.updated', delete: 'calendar_event.deleted' },
};

/** Obligations this service knows how to honour. Anything else and the decision is not enforced, so it is refused. */
const HONOURED = new Set<PolicyObligation['type']>(['audit', 'expire_at', 'limit_fields', 'mask_fields']);

const UNAVAILABLE_ACTION: UserAction = { label: 'Try again in a moment', kind: 'retry_later' };

export class ProductivityService {
  private readonly repo: ProductivityRepository;
  private readonly now: () => number;
  private readonly newId: () => string;
  private readonly onCommand: NonNullable<ServiceDeps['onCommand']>;
  private readonly onDecision: NonNullable<ServiceDeps['onDecision']>;
  private readonly onError: NonNullable<ServiceDeps['onError']>;

  constructor(deps: ServiceDeps) {
    this.repo = deps.repo;
    this.now = deps.now ?? Date.now;
    this.newId = deps.newId ?? randomUUID;
    this.onCommand = deps.onCommand ?? (() => undefined);
    this.onDecision = deps.onDecision ?? (() => undefined);
    this.onError = deps.onError ?? (() => undefined);
  }

  // ── Commands ───────────────────────────────────────────────────────────

  /**
   * Applies commands in order, each in its own transaction.
   *
   * Not one transaction for the batch: an offline queue holds unrelated
   * intents, and one malformed or refused command must not strand the forty
   * good ones behind it. Each command is atomic and idempotent on its own, so
   * the batch as a whole is safe to send again after any failure.
   *
   * `ownerId` is only for jobs. A person's commands always apply to their own
   * data: the owner is the verified actor, and nothing in the request can
   * name another.
   */
  async execute(principal: Principal, raw: unknown[], meta: RequestMeta, options: { ownerId?: string } = {}): Promise<CommandResult[]> {
    const ownerId = this.ownerFor(principal, options.ownerId);
    const scope: Scope = { tenantId: principal.tenant.id, ownerId };
    const results: CommandResult[] = [];
    let stopped = false;

    for (const item of raw) {
      const hint = commandIdOf(item);
      if (stopped) {
        results.push({ commandId: hint, status: 'not_attempted', retryable: true });
        continue;
      }
      const checked = validateCommand(item, 'command');
      if (!checked.ok) {
        const first = checked.issues[0]!;
        results.push(this.rejected(hint, 'validation_failed', `${first.path} ${first.issue}.`));
        this.onCommand({ type: 'invalid', status: 'rejected', actorType: principal.actor.type });
        continue;
      }
      const command = checked.value;
      let result: CommandResult;
      try {
        result = await this.applyOne(principal, scope, command, meta);
      } catch (error) {
        this.onError(error, { where: 'command', correlationId: meta.correlationId });
        // The store failed or lost its answer. The outcome is unknown, so say that and
        // say what is safe: the same command, sent again, is applied once or answered from the ledger.
        result = { commandId: command.commandId, status: 'failed', code: 'unavailable', message: 'Semester could not finish this just now. Send it again; it will not be applied twice.', retryable: true };
        stopped = true;
      }
      this.onCommand({ type: command.type, status: result.status, actorType: principal.actor.type });
      results.push(result);
    }
    return results;
  }

  private ownerFor(principal: Principal, requested: string | undefined): string {
    if (principal.actor.type === 'user') {
      if (requested !== undefined && requested !== principal.actor.id) throw new Error('a person\'s commands apply to their own data');
      return principal.actor.id;
    }
    if (!requested) throw new Error('a job must say whose data it is acting on');
    return requested;
  }

  private rejected(commandId: string, code: string, message: string, userAction?: UserAction): CommandResult {
    return { commandId, status: 'rejected', code, message, ...(userAction ? { userAction: { label: userAction.label, kind: userAction.kind } } : {}) };
  }

  private async applyOne(principal: Principal, scope: Scope, command: Command, meta: RequestMeta): Promise<CommandResult> {
    const now = this.now();
    if (now - Date.parse(command.createdAt) > LIMITS.commandMaxAgeMs) {
      return this.rejected(command.commandId, 'command_expired', 'This change was made too long ago to apply safely. Look at the current version and make it again.', { label: 'Review the current version', kind: 'open_screen' });
    }
    if (principal.actor.type !== 'integration' && command.type === 'calendar_event.create' && command.source) {
      return this.rejected(command.commandId, 'source_forbidden', 'Only an import can say where an event came from.');
    }
    if (principal.actor.type === 'integration' && command.type === 'calendar_event.create' && !command.source) {
      return this.rejected(command.commandId, 'source_required', 'An imported event must say which feed and entry it came from.');
    }
    const requestSha256 = sha256(canonical(command));
    const { clock, clamped } = clampClock(parseClock(command.clock)!, now);

    return this.repo.transaction(scope, async (tx) => {
      const seen = tx.command(command.commandId);
      if (seen) {
        if (seen.requestSha256 !== requestSha256) {
          return this.rejected(command.commandId, 'idempotency_key_reused', 'This command id was already used for a different change. Make a new id for a new change.');
        }
        return { commandId: command.commandId, status: 'duplicate', original: seen.result };
      }
      return this.applyFresh(principal, scope, command, meta, { tx, now, clock, clamped, requestSha256 });
    });
  }

  private async applyFresh(
    principal: Principal,
    scope: Scope,
    command: Command,
    meta: RequestMeta,
    ctx: { tx: ProductivityTx; now: number; clock: string; clamped: boolean; requestSha256: string },
  ): Promise<CommandResult> {
    const { tx, now, clock, clamped } = ctx;
    const type = entityTypeOf(command.type);
    const verb = verbOf(command.type);
    const existing = tx.entity(type, command.id);

    const changes = 'changes' in command ? (command.changes as Record<string, unknown>) : {};
    const touchesAuthoritative = existing !== null
      && existing.source.kind !== 'student_entered'
      && (verb === 'delete' || Object.keys(changes).some((f) => AUTHORITATIVE_FIELDS[type].includes(f)));
    const sourceKind = existing?.source.kind ?? (principal.actor.type === 'integration' ? 'imported' : 'student_entered');

    // Decided inside the transaction, against the record as it stands in it: the
    // check and the write cannot see two different states.
    const decision = this.ask(this.request(principal, type === 'task' ? 'task.write' : 'calendar.event.write', {
      type,
      id: command.id,
      ownerId: scope.ownerId,
      classification: 'student_private',
      sourceKind,
      attributes: { command: verb, touchesAuthoritative },
    }, meta, [], command.commandId), now);

    if (!decision.allow) {
      this.audit(tx, principal, scope, meta, command, { action: type === 'task' ? 'task.write' : 'calendar.event.write', outcome: 'denied', reasonCode: decision.reasonCode });
      return this.rejected(command.commandId, decision.reasonCode, decision.userMessage, decision.userAction);
    }
    const { remaining } = applyObligations({}, decision.obligations);
    const unmet = remaining.find((o) => !HONOURED.has(o.type));
    if (unmet) {
      this.audit(tx, principal, scope, meta, command, { action: type === 'task' ? 'task.write' : 'calendar.event.write', outcome: 'denied', reasonCode: 'obligation_unsupported' });
      return this.rejected(command.commandId, 'obligation_unsupported', 'This change needs a step this version cannot perform, so it was not made.');
    }
    const auditObligation = decision.obligations.find((o): o is Extract<PolicyObligation, { type: 'audit' }> => o.type === 'audit');
    const eventType = auditObligation?.eventType ?? EVENT_FOR[type]![verb]!;

    const finish = (entity: Entity, appliedFields: string[], supersededFields: string[]): CommandResult => {
      const seq = tx.save(entity);
      const result: StoredResult = {
        commandId: command.commandId, status: 'applied', entity: { type, id: entity.id, version: entity.version },
        seq, appliedFields, supersededFields, clockClamped: clamped,
      };
      this.audit(tx, principal, scope, meta, command, { action: eventType, outcome: 'allowed', fields: appliedFields });
      tx.emit(this.event(principal, scope, meta, command, eventType, { entityType: type, entityId: entity.id, version: entity.version, seq, fields: appliedFields }));
      tx.recordCommand({ commandId: command.commandId, requestSha256: ctx.requestSha256, result, storedAt: iso(now) });
      return result;
    };
    const settle = (entity: Entity | null, result: StoredResult): CommandResult => {
      // Nothing visible changed, but a newer clock may have been learned; keep it so a later,
      // older edit still loses. The change feed sees the record once more, unchanged.
      if (entity) tx.save(entity);
      tx.recordCommand({ commandId: command.commandId, requestSha256: ctx.requestSha256, result, storedAt: iso(now) });
      return result;
    };

    switch (command.type) {
      case 'task.create':
      case 'calendar_event.create': {
        if (existing) return this.rejected(command.commandId, 'id_in_use', 'That id already belongs to something else. Make a new one.');
        const base = {
          id: command.id, tenantId: scope.tenantId, ownerId: scope.ownerId, version: 1, seq: 0,
          createdAt: iso(now), updatedAt: iso(now), deletedAt: null, deleteClock: null,
        };
        if (command.type === 'task.create') {
          const f = command.fields;
          const task: Task = {
            ...base, source: { kind: 'student_entered' },
            title: f.title, notes: f.notes ?? null, status: 'open', completedAt: null,
            dueAt: f.dueAt ?? null, dueOn: f.dueOn ?? null, whenText: f.whenText ?? null,
            priority: f.priority ?? 'normal', courseId: f.courseId ?? null,
            repeat: f.repeat ?? null, steps: f.steps ?? [], plannedFrom: f.plannedFrom ?? null,
            clocks: stamp(['status', ...TASK_FIELDS], clock),
          };
          return finish(task, TASK_FIELDS.filter((k) => k in f || k === 'title'), []);
        }
        const f = command.fields;
        const bad = spanIssue(f.startsAt, f.endsAt);
        if (bad) return this.rejected(command.commandId, 'validation_failed', `Event ${bad}.`);
        const event: CalendarEvent = {
          ...base,
          source: command.source ? { kind: 'imported', ref: command.source.ref } : { kind: 'student_entered' },
          title: f.title, notes: f.notes ?? null, startsAt: f.startsAt, endsAt: f.endsAt,
          allDay: f.allDay ?? false, timezone: f.timezone, location: f.location ?? null, kind: f.kind ?? 'event',
          clocks: stamp(['title', 'notes', 'startsAt', 'endsAt', 'allDay', 'timezone', 'location', 'kind'], clock),
        };
        return finish(event, Object.keys(f), []);
      }

      case 'task.update':
      case 'task.complete':
      case 'task.reopen':
      case 'calendar_event.update': {
        if (!existing) return this.rejected(command.commandId, 'not_found', 'That item does not exist.');
        if (existing.deletedAt) return this.rejected(command.commandId, 'gone', 'That item was deleted, so this change was not applied.');
        const wanted: Record<string, unknown> = command.type === 'task.complete'
          ? { status: 'done' }
          : command.type === 'task.reopen' ? { status: 'open' } : changes;
        const merged = merge(existing, wanted, clock);
        if (merged.changed.length > 0) merged.next.version = existing.version + 1;
        if ('startsAt' in merged.next) {
          const bad = spanIssue(merged.next.startsAt, merged.next.endsAt);
          if (bad) return this.rejected(command.commandId, 'validation_failed', `Event ${bad}.`);
        }
        if (merged.changed.length === 0) {
          const advanced = merged.advanced;
          return settle(advanced ? merged.next : null, {
            commandId: command.commandId, status: 'superseded', entity: { type, id: existing.id, version: existing.version },
            supersededFields: merged.superseded, reason: merged.superseded.length > 0 ? 'newer_edit' : 'no_change',
          });
        }
        if ('status' in merged.next && merged.changed.includes('status')) {
          const done = merged.next.status === 'done';
          merged.next.completedAt = done ? iso(Math.min(parseClock(clock)!.wall, now)) : null;
        }
        merged.next.updatedAt = iso(now);
        return finish(merged.next, merged.changed, merged.superseded);
      }

      case 'task.delete':
      case 'calendar_event.delete': {
        if (!existing) return this.rejected(command.commandId, 'not_found', 'That item does not exist.');
        if (existing.deletedAt) {
          return settle(null, {
            commandId: command.commandId, status: 'superseded', entity: { type, id: existing.id, version: existing.version },
            supersededFields: [], reason: 'already_deleted',
          });
        }
        // A delete outranks any edit, newer or older: bringing back something somebody removed is the surprise.
        const gone = { ...existing, version: existing.version + 1, deletedAt: iso(now), deleteClock: clock, updatedAt: iso(now) } as Entity;
        return finish(gone, ['deleted'], []);
      }
    }
  }

  /** The one place this service asks the policy decision point, so none of its paths can skip being counted. */
  private ask(request: AuthorizationRequest, now: number) {
    const decision = decide(request, now);
    this.onDecision({ action: request.action, allow: decision.allow, ...(decision.allow ? {} : { reasonCode: decision.reasonCode }) });
    return decision;
  }

  private request(
    principal: Principal,
    action: PolicyAction,
    resource: AuthorizationRequest['resource'],
    meta: RequestMeta,
    consentGrants: ConsentGrant[],
    idempotencyKey?: string,
  ): AuthorizationRequest {
    return {
      actor: principal.actor,
      tenant: principal.tenant,
      action,
      resource,
      context: {
        membershipIds: principal.membershipIds,
        roleGrants: principal.roleGrants,
        capabilities: principal.capabilities,
        consentGrants,
        featureFlags: principal.featureFlags,
        policyVersions: principal.policyVersions,
        ...(meta.purpose ? { purpose: meta.purpose } : {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
        correlationId: meta.correlationId,
      },
    };
  }

  private audit(
    tx: ProductivityTx,
    principal: Principal,
    scope: Scope,
    meta: RequestMeta,
    command: Command,
    what: { action: string; outcome: 'allowed' | 'denied'; reasonCode?: string; fields?: string[] },
  ): void {
    tx.audit({
      id: this.newId(), tenantId: scope.tenantId, ownerId: scope.ownerId, correlationId: meta.correlationId,
      actorId: principal.actor.id, actorType: principal.actor.type, deviceId: command.deviceId,
      action: what.action, objectKind: entityTypeOf(command.type), objectId: command.id, outcome: what.outcome,
      ...(what.reasonCode ? { reasonCode: what.reasonCode } : {}),
      ...(what.fields ? { fields: what.fields } : {}),
      commandId: command.commandId, occurredAt: iso(this.now()),
    });
  }

  private event(
    principal: Principal,
    scope: Scope,
    meta: RequestMeta,
    command: Command,
    eventType: string,
    payload: Record<string, unknown>,
  ): SemesterEvent {
    return makeEvent({
      eventId: this.newId(),
      eventType: eventType as SemesterEvent['eventType'],
      occurredAt: iso(this.now()),
      producer: 'productivity-api',
      environment: principal.tenant.environment,
      tenantId: scope.tenantId,
      actor: { id: principal.actor.id, type: principal.actor.type },
      subject: { type: entityTypeOf(command.type), id: command.id },
      correlationId: meta.correlationId,
      causationId: command.commandId,
      idempotencyKey: command.commandId,
      payload: { ownerId: scope.ownerId, ...payload },
    });
  }

  // ── Queries ────────────────────────────────────────────────────────────

  /**
   * Decides a read, and — for somebody else's data — writes the audit row
   * *before* anything is returned. A read that cannot be recorded is not made.
   */
  private async authorizeRead(
    principal: Principal,
    kind: 'task' | 'calendar_event',
    ownerId: string,
    meta: RequestMeta,
  ): Promise<PolicyObligation[]> {
    const own = ownerId === principal.actor.id;
    const grants = own || !principal.consentGrantsFor ? [] : await principal.consentGrantsFor(ownerId);
    const action: PolicyAction = kind === 'task' ? 'task.read' : 'calendar.event.read';
    const decision = this.ask(this.request(principal, action, { type: kind, ownerId, classification: 'student_private' }, meta, grants), this.now());
    if (!decision.allow) {
      if (!own) await this.recordSharedRead(principal, kind, ownerId, meta, 'denied', decision.reasonCode);
      throw new ApiError(403, decision.reasonCode, decision.userMessage, decision.userAction ? { userAction: decision.userAction } : {});
    }
    const { remaining } = applyObligations({}, decision.obligations);
    if (remaining.some((o) => !HONOURED.has(o.type))) {
      throw new ApiError(403, 'obligation_unsupported', 'This needs a step this version cannot perform, so nothing was shown.');
    }
    if (!own) await this.recordSharedRead(principal, kind, ownerId, meta, 'allowed');
    return decision.obligations;
  }

  private async recordSharedRead(
    principal: Principal,
    kind: EntityType,
    ownerId: string,
    meta: RequestMeta,
    outcome: 'allowed' | 'denied',
    reasonCode?: string,
  ): Promise<void> {
    const scope: Scope = { tenantId: principal.tenant.id, ownerId };
    await this.repo.transaction(scope, (tx) => {
      const row: AuditRow = {
        id: this.newId(), tenantId: scope.tenantId, ownerId, correlationId: meta.correlationId,
        actorId: principal.actor.id, actorType: principal.actor.type, action: 'productivity.shared_read',
        objectKind: kind, objectId: ownerId, outcome, ...(reasonCode ? { reasonCode } : {}), occurredAt: iso(this.now()),
      };
      tx.audit(row);
      if (outcome === 'allowed') {
        tx.emit(makeEvent({
          eventId: this.newId(), eventType: 'productivity.shared_read', occurredAt: row.occurredAt, producer: 'productivity-api',
          environment: principal.tenant.environment, tenantId: scope.tenantId, actor: { id: principal.actor.id, type: principal.actor.type },
          subject: { type: kind, id: ownerId }, correlationId: meta.correlationId,
          payload: { ownerId, entityType: kind, purpose: meta.purpose ?? '' },
        }));
      }
    });
  }

  private project(entity: Entity, obligations: PolicyObligation[], ownerView: boolean): Wire {
    const full = wire(entity);
    if (ownerView) return full;
    const { type, ownerId, ...content } = full;
    return { type, ownerId, ...applyObligations(content, obligations).record };
  }

  async listTasks(
    principal: Principal,
    params: { ownerId?: string; status?: 'open' | 'done'; dueBefore?: string; dueAfter?: string; after: CursorPosition | null; limit?: number },
    meta: RequestMeta,
  ): Promise<Page<Wire>> {
    const ownerId = params.ownerId ?? principal.actor.id;
    const obligations = await this.authorizeRead(principal, 'task', ownerId, meta);
    const limit = Math.min(params.limit ?? LIMITS.pageDefault, LIMITS.pageMax);
    const rows = await this.repo.listTasks({ tenantId: principal.tenant.id, ownerId }, {
      ...(params.status ? { status: params.status } : {}),
      ...(params.dueBefore ? { dueBefore: params.dueBefore } : {}),
      ...(params.dueAfter ? { dueAfter: params.dueAfter } : {}),
      after: params.after, limit: limit + 1,
    });
    const shown = rows.slice(0, limit);
    const last = shown[shown.length - 1];
    return {
      data: shown.map((t) => this.project(t, obligations, ownerId === principal.actor.id)),
      page: { has_more: rows.length > limit, next_cursor: rows.length > limit && last ? encodeCursor({ k: 'k', key: taskSortKey(last), id: last.id }) : null },
    };
  }

  async listEvents(
    principal: Principal,
    params: { ownerId?: string; from: string; to: string; after: CursorPosition | null; limit?: number },
    meta: RequestMeta,
  ): Promise<Page<Wire>> {
    const ownerId = params.ownerId ?? principal.actor.id;
    const obligations = await this.authorizeRead(principal, 'calendar_event', ownerId, meta);
    const limit = Math.min(params.limit ?? LIMITS.pageDefault, LIMITS.pageMax);
    const rows = await this.repo.listEvents({ tenantId: principal.tenant.id, ownerId }, { from: params.from, to: params.to, after: params.after, limit: limit + 1 });
    const shown = rows.slice(0, limit);
    const last = shown[shown.length - 1];
    return {
      data: shown.map((e) => this.project(e, obligations, ownerId === principal.actor.id)),
      page: { has_more: rows.length > limit, next_cursor: rows.length > limit && last ? encodeCursor({ k: 'k', key: last.startsAt, id: last.id }) : null },
    };
  }

  /** One of the caller's own records. Somebody else's is "not found", not "forbidden": existence is not shared either. */
  async get(principal: Principal, type: EntityType, id: string, meta: RequestMeta): Promise<Wire> {
    if (!isUuid(id)) throw new ApiError(404, 'not_found', 'That item does not exist.');
    await this.authorizeRead(principal, type, principal.actor.id, meta);
    const found = await this.repo.get({ tenantId: principal.tenant.id, ownerId: principal.actor.id }, type, id);
    if (!found) throw new ApiError(404, 'not_found', 'That item does not exist.');
    return wire(found);
  }

  /** The caller's tasks due and events happening in a window, as one time-ordered list. */
  async agenda(principal: Principal, params: { from: string; to: string }, meta: RequestMeta): Promise<{ data: Wire[]; truncated: boolean }> {
    const ownerId = principal.actor.id;
    await this.authorizeRead(principal, 'task', ownerId, meta);
    await this.authorizeRead(principal, 'calendar_event', ownerId, meta);
    const scope: Scope = { tenantId: principal.tenant.id, ownerId };
    const cap = 250;
    const [tasks, events] = await Promise.all([
      this.repo.listTasks(scope, { status: 'open', dueAfter: new Date(Date.parse(params.from) - 1).toISOString(), dueBefore: params.to, after: null, limit: cap + 1 }),
      this.repo.listEvents(scope, { from: params.from, to: params.to, after: null, limit: cap + 1 }),
    ]);
    const items = [
      ...tasks.slice(0, cap).map((t) => ({ at: t.dueAt!, w: wire(t) })),
      ...events.slice(0, cap).map((e) => ({ at: e.startsAt, w: wire(e) })),
    ].sort((a, b) => a.at.localeCompare(b.at) || String(a.w.id).localeCompare(String(b.w.id)));
    return { data: items.map((i) => ({ at: i.at, ...i.w })), truncated: tasks.length > cap || events.length > cap };
  }

  /**
   * The sync pull: every change after a position, tombstones included, in the
   * order they happened. The position is the owner's gapless sequence, so a
   * client that sees a jump knows it missed something and asks again.
   */
  async changes(principal: Principal, params: { after: CursorPosition | null; limit?: number }, meta: RequestMeta): Promise<Page<Wire>> {
    const ownerId = principal.actor.id;
    await this.authorizeRead(principal, 'task', ownerId, meta);
    await this.authorizeRead(principal, 'calendar_event', ownerId, meta);
    const limit = Math.min(params.limit ?? LIMITS.pageDefault, LIMITS.pageMax);
    const after = params.after?.k === 's' ? params.after.seq! : 0;
    const rows = await this.repo.changes({ tenantId: principal.tenant.id, ownerId }, after, limit + 1);
    const shown = rows.slice(0, limit);
    const last = shown[shown.length - 1];
    return {
      data: shown.map((e) => (e.deletedAt
        ? { type: 'status' in e ? 'task' : 'calendar_event', id: e.id, deleted: true, version: e.version, seq: e.seq, deletedAt: e.deletedAt }
        : wire(e))),
      page: { has_more: rows.length > limit, next_cursor: last ? encodeCursor({ k: 's', seq: last.seq }) : (params.after ? encodeCursor(params.after) : null) },
    };
  }

  // ── Operations ─────────────────────────────────────────────────────────

  readiness(): Promise<void> {
    return this.repo.ping();
  }

  outboxStats() {
    return this.repo.outboxStats();
  }

  static readonly unavailableAction = UNAVAILABLE_ACTION;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const commandIdOf = (item: unknown): string =>
  item && typeof item === 'object' && isUuid((item as { commandId?: unknown }).commandId) ? (item as { commandId: string }).commandId : '';

const stamp = (fields: string[], clock: string): Record<string, string> => Object.fromEntries(fields.map((f) => [f, clock]));

/**
 * Field-aware last-writer-wins. Each field is judged on its own clock, so two
 * devices editing different fields of one task both land, and two editing the
 * same field resolve to the later intent whatever order the replays arrive in.
 * A field that loses is reported, not silently dropped.
 */
function merge<E extends Entity>(entity: E, wanted: Record<string, unknown>, clock: string): { next: E; changed: string[]; superseded: string[]; advanced: boolean } {
  const next = structuredClone(entity) as E & Record<string, unknown>;
  const changed: string[] = [];
  const superseded: string[] = [];
  let advanced = false;
  for (const [field, value] of Object.entries(wanted)) {
    const held = next.clocks[field];
    if (held !== undefined && held >= clock) {
      superseded.push(field);
      continue;
    }
    next.clocks[field] = clock;
    advanced = true;
    if (canonical(next[field]) !== canonical(value)) {
      next[field] = value;
      changed.push(field);
    }
  }
  return { next, changed, superseded, advanced };
}
