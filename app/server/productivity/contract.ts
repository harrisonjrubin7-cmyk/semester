/**
 * The wire contract of the productivity service (tasks and calendar), v1.
 *
 * One file holds everything a client and the server must agree on: the entity
 * shapes, the command vocabulary the offline queue replays, the validators
 * that refuse anything else, the hybrid logical clock, and the cursor. The
 * service, the HTTP layer and the tests import from here; none of them
 * re-declares a limit or a field name.
 *
 * ## Strict on purpose
 *
 * A validator here rejects an unknown key rather than ignoring it. A client
 * that sends `ownerId`, `tenantId`, `version` or `source` on a command is
 * either confused or probing, and silently dropping the field would hide both.
 * Who owns a record and which tenant it is in come from the verified session
 * (`service.ts`), never from the body.
 *
 * ## Time
 *
 * Instants are ISO-8601 with an explicit offset or `Z`, normalised to UTC
 * milliseconds. A calendar event also carries an IANA zone name, because
 * "9:00 every Tuesday" is a statement about a place's clock, not an instant.
 */

export const API_VERSION = '1';

export const LIMITS = {
  titleMax: 200,
  notesMax: 4_000,
  locationMax: 200,
  courseIdMax: 64,
  sourceRefMax: 200,
  /** Commands in one request. An offline queue replays in several. */
  batchMax: 50,
  pageDefault: 50,
  pageMax: 200,
  /** A query window over the calendar. Wider is a report, not a screen. */
  windowMaxDays: 366,
  eventMaxDays: 366,
  /** A queued command older than this is refused, and the ledger outlives it. */
  commandMaxAgeMs: 30 * 86_400_000,
  ledgerRetentionDays: 35,
  /** How far ahead of the server a device clock may claim to be. */
  clockSkewMs: 5 * 60_000,
} as const;

export const TASK_STATUSES = ['open', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const PRIORITIES = ['low', 'normal', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const EVENT_KINDS = ['event', 'focus_block'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export const SOURCE_KINDS = ['student_entered', 'imported', 'institution_verified'] as const;
export type EntitySourceKind = (typeof SOURCE_KINDS)[number];

export type EntityType = 'task' | 'calendar_event';

/**
 * The fields a source owns when the record came from one. A student may
 * annotate an imported class meeting (notes, a reminder) but not move it: the
 * institution's calendar is the authority on when the class is.
 */
export const AUTHORITATIVE_FIELDS: Record<EntityType, readonly string[]> = {
  task: ['title', 'dueAt', 'courseId'],
  calendar_event: ['title', 'startsAt', 'endsAt', 'allDay', 'timezone', 'location', 'kind'],
};

export interface EntitySource {
  kind: EntitySourceKind;
  ref?: string;
}

interface EntityBase {
  id: string;
  tenantId: string;
  ownerId: string;
  version: number;
  /** Per-owner, gapless, monotonic: the position of this record's last change. */
  seq: number;
  source: EntitySource;
  /** The clock that last won each field; what makes a late replay lose honestly. */
  clocks: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deleteClock: string | null;
}

export interface Task extends EntityBase {
  title: string;
  notes: string | null;
  status: TaskStatus;
  completedAt: string | null;
  dueAt: string | null;
  priority: Priority;
  courseId: string | null;
}

export interface CalendarEvent extends EntityBase {
  title: string;
  notes: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  timezone: string;
  location: string | null;
  kind: EventKind;
}

export type Entity = Task | CalendarEvent;

// ── Commands ──────────────────────────────────────────────────────────────

export const TASK_FIELDS = ['title', 'notes', 'dueAt', 'priority', 'courseId'] as const;
export const EVENT_FIELDS = ['title', 'notes', 'startsAt', 'endsAt', 'allDay', 'timezone', 'location', 'kind'] as const;

export type TaskFields = {
  title: string;
  notes?: string | null;
  dueAt?: string | null;
  priority?: Priority;
  courseId?: string | null;
};

export type EventFields = {
  title: string;
  notes?: string | null;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  timezone: string;
  location?: string | null;
  kind?: EventKind;
};

interface CommandBase {
  /** UUID minted on the device when the intent was made. The idempotency key. */
  commandId: string;
  /** Which installation made it; the tiebreak of the clock, and the audit's "from where". */
  deviceId: string;
  /** Hybrid logical clock stamped when the intent was made, offline or not. */
  clock: string;
  /** When the intent was queued; bounds how late a replay is accepted. */
  createdAt: string;
}

export type Command = CommandBase & (
  | { type: 'task.create'; id: string; fields: TaskFields }
  | { type: 'task.update'; id: string; changes: Partial<TaskFields> }
  | { type: 'task.complete'; id: string }
  | { type: 'task.reopen'; id: string }
  | { type: 'task.delete'; id: string }
  | { type: 'calendar_event.create'; id: string; fields: EventFields; source?: { ref: string } }
  | { type: 'calendar_event.update'; id: string; changes: Partial<EventFields> }
  | { type: 'calendar_event.delete'; id: string }
);

export type CommandType = Command['type'];

/** The verb the policy decision point reads, and the audit event follows. */
export const verbOf = (type: CommandType): 'create' | 'update' | 'complete' | 'reopen' | 'delete' =>
  type.slice(type.indexOf('.') + 1) as 'create' | 'update' | 'complete' | 'reopen' | 'delete';

export const entityTypeOf = (type: CommandType): EntityType =>
  type.startsWith('task.') ? 'task' : 'calendar_event';

export interface FieldIssue {
  path: string;
  issue: string;
}

export type Validated<T> = { ok: true; value: T } | { ok: false; issues: FieldIssue[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/** An instant, as the UTC millisecond string every stored time uses, or null. */
export function normalizeInstant(v: unknown): string | null {
  if (typeof v !== 'string' || !ISO.test(v)) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function validZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || zone.length === 0 || zone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const plain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Text a person typed: trimmed, bounded, and free of control characters other than newline and tab. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

class Issues {
  readonly list: FieldIssue[] = [];
  add(path: string, issue: string): void {
    if (this.list.length < 20) this.list.push({ path, issue });
  }
}

function text(i: Issues, path: string, v: unknown, max: number, opts: { required: boolean; nullable: boolean }): string | null | undefined {
  if (v === undefined) {
    if (opts.required) i.add(path, 'is required');
    return undefined;
  }
  if (v === null) {
    if (!opts.nullable) i.add(path, 'cannot be null');
    return null;
  }
  if (typeof v !== 'string') {
    i.add(path, 'must be text');
    return undefined;
  }
  const t = v.trim();
  if (opts.required && t.length === 0) i.add(path, 'cannot be empty');
  if (t.length > max) i.add(path, `is longer than ${max} characters`);
  if (CONTROL.test(t)) i.add(path, 'contains control characters');
  return t;
}

function instant(i: Issues, path: string, v: unknown, opts: { required: boolean; nullable: boolean }): string | null | undefined {
  if (v === undefined) {
    if (opts.required) i.add(path, 'is required');
    return undefined;
  }
  if (v === null) {
    if (!opts.nullable) i.add(path, 'cannot be null');
    return null;
  }
  const n = normalizeInstant(v);
  if (n === null) i.add(path, 'must be an ISO-8601 time with an offset, such as 2026-10-05T14:00:00Z');
  return n ?? undefined;
}

function oneOf<T extends string>(i: Issues, path: string, v: unknown, allowed: readonly T[]): T | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    i.add(path, `must be one of ${allowed.join(', ')}`);
    return undefined;
  }
  return v as T;
}

function rejectUnknown(i: Issues, path: string, obj: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(obj)) if (!allowed.includes(key)) i.add(`${path}.${key}`, 'is not a field of this command');
}

function taskFields(i: Issues, path: string, raw: unknown, mode: 'create' | 'update'): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!plain(raw)) {
    i.add(path, 'must be an object');
    return out;
  }
  rejectUnknown(i, path, raw, TASK_FIELDS);
  const create = mode === 'create';
  const title = text(i, `${path}.title`, raw.title, LIMITS.titleMax, { required: create, nullable: false });
  if (title !== undefined) out.title = title;
  const notes = text(i, `${path}.notes`, raw.notes, LIMITS.notesMax, { required: false, nullable: true });
  if (notes !== undefined) out.notes = notes === '' ? null : notes;
  const dueAt = instant(i, `${path}.dueAt`, raw.dueAt, { required: false, nullable: true });
  if (dueAt !== undefined) out.dueAt = dueAt;
  const priority = oneOf(i, `${path}.priority`, raw.priority, PRIORITIES);
  if (priority !== undefined) out.priority = priority;
  const courseId = text(i, `${path}.courseId`, raw.courseId, LIMITS.courseIdMax, { required: false, nullable: true });
  if (courseId !== undefined) out.courseId = courseId === '' ? null : courseId;
  if (mode === 'update' && Object.keys(out).length === 0 && i.list.length === 0) i.add(path, 'must change at least one field');
  return out;
}

function eventFields(i: Issues, path: string, raw: unknown, mode: 'create' | 'update'): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!plain(raw)) {
    i.add(path, 'must be an object');
    return out;
  }
  rejectUnknown(i, path, raw, EVENT_FIELDS);
  const create = mode === 'create';
  const title = text(i, `${path}.title`, raw.title, LIMITS.titleMax, { required: create, nullable: false });
  if (title !== undefined) out.title = title;
  const notes = text(i, `${path}.notes`, raw.notes, LIMITS.notesMax, { required: false, nullable: true });
  if (notes !== undefined) out.notes = notes === '' ? null : notes;
  const startsAt = instant(i, `${path}.startsAt`, raw.startsAt, { required: create, nullable: false });
  if (startsAt !== undefined) out.startsAt = startsAt;
  const endsAt = instant(i, `${path}.endsAt`, raw.endsAt, { required: create, nullable: false });
  if (endsAt !== undefined) out.endsAt = endsAt;
  if (raw.allDay !== undefined) {
    if (typeof raw.allDay !== 'boolean') i.add(`${path}.allDay`, 'must be true or false');
    else out.allDay = raw.allDay;
  }
  if (raw.timezone === undefined) {
    if (create) i.add(`${path}.timezone`, 'is required');
  } else if (!validZone(raw.timezone)) {
    i.add(`${path}.timezone`, 'must be an IANA zone name such as America/Chicago');
  } else {
    out.timezone = raw.timezone;
  }
  const location = text(i, `${path}.location`, raw.location, LIMITS.locationMax, { required: false, nullable: true });
  if (location !== undefined) out.location = location === '' ? null : location;
  const kind = oneOf(i, `${path}.kind`, raw.kind, EVENT_KINDS);
  if (kind !== undefined) out.kind = kind;
  if (mode === 'update' && Object.keys(out).length === 0 && i.list.length === 0) i.add(path, 'must change at least one field');
  return out;
}

/** An event's span is checked whole on create; on update the service checks it against the stored record. */
export function spanIssue(startsAt: string, endsAt: string): string | null {
  const a = Date.parse(startsAt);
  const b = Date.parse(endsAt);
  if (b < a) return 'ends before it starts';
  if (b - a > LIMITS.eventMaxDays * 86_400_000) return `is longer than ${LIMITS.eventMaxDays} days`;
  return null;
}

// ── The hybrid logical clock ──────────────────────────────────────────────

/**
 * `<wall ms, 13 digits>.<counter, 4 digits>.<device>`: fixed-width so that
 * comparing two clocks is comparing two strings, in the database as in memory.
 */
export const CLOCK = /^(\d{13})\.(\d{4})\.([A-Za-z0-9_-]{1,64})$/;

export interface ParsedClock {
  wall: number;
  counter: number;
  device: string;
}

export function parseClock(value: unknown): ParsedClock | null {
  if (typeof value !== 'string') return null;
  const m = CLOCK.exec(value);
  return m ? { wall: Number(m[1]), counter: Number(m[2]), device: m[3]! } : null;
}

export function formatClock(c: ParsedClock): string {
  return `${String(c.wall).padStart(13, '0')}.${String(c.counter).padStart(4, '0')}.${c.device}`;
}

/**
 * A device's claim about "when" is only a claim. Past is believed — an offline
 * edit really was made earlier — but a clock further ahead of the server than
 * the allowed skew is pulled back to it, so a device with a wrong or hostile
 * clock can outrank honest ones by minutes, not by years.
 */
export function clampClock(c: ParsedClock, now: number): { clock: string; clamped: boolean } {
  const ceiling = now + LIMITS.clockSkewMs;
  if (c.wall <= ceiling) return { clock: formatClock(c), clamped: false };
  return { clock: formatClock({ ...c, wall: ceiling }), clamped: true };
}

// ── Command validation ────────────────────────────────────────────────────

export const COMMAND_TYPES = [
  'task.create', 'task.update', 'task.complete', 'task.reopen', 'task.delete',
  'calendar_event.create', 'calendar_event.update', 'calendar_event.delete',
] as const;

const BASE_KEYS = ['commandId', 'deviceId', 'clock', 'createdAt', 'type', 'id'];

/** One command, or the list of reasons it is not one. Pure; knows nothing about who sent it. */
export function validateCommand(raw: unknown, path = 'command'): Validated<Command> {
  const i = new Issues();
  if (!plain(raw)) return { ok: false, issues: [{ path, issue: 'must be an object' }] };
  const type = raw.type;
  if (typeof type !== 'string' || !(COMMAND_TYPES as readonly string[]).includes(type)) {
    return { ok: false, issues: [{ path: `${path}.type`, issue: `must be one of ${COMMAND_TYPES.join(', ')}` }] };
  }
  const t = type as CommandType;
  if (!isUuid(raw.commandId)) i.add(`${path}.commandId`, 'must be a UUID');
  if (typeof raw.deviceId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(raw.deviceId)) i.add(`${path}.deviceId`, 'must be 1-64 letters, digits, - or _');
  const parsed = parseClock(raw.clock);
  if (!parsed) i.add(`${path}.clock`, 'must look like 0001790000000000.0000.<deviceId>');
  else if (typeof raw.deviceId === 'string' && parsed.device !== raw.deviceId) i.add(`${path}.clock`, 'must end with this command\'s deviceId');
  const createdAt = normalizeInstant(raw.createdAt);
  if (createdAt === null) i.add(`${path}.createdAt`, 'must be an ISO-8601 time with an offset');
  if (!isUuid(raw.id)) i.add(`${path}.id`, 'must be a UUID chosen by the client');

  const payloadKey = t.endsWith('.create') ? 'fields' : t.endsWith('.update') ? 'changes' : null;
  const allowedKeys = [...BASE_KEYS, ...(payloadKey ? [payloadKey] : []), ...(t === 'calendar_event.create' ? ['source'] : [])];
  rejectUnknown(i, path, raw, allowedKeys);

  let payload: Record<string, unknown> = {};
  if (payloadKey) {
    const mode = payloadKey === 'fields' ? 'create' : 'update';
    payload = t.startsWith('task.')
      ? taskFields(i, `${path}.${payloadKey}`, raw[payloadKey], mode)
      : eventFields(i, `${path}.${payloadKey}`, raw[payloadKey], mode);
    if (t === 'calendar_event.create' && typeof payload.startsAt === 'string' && typeof payload.endsAt === 'string') {
      const bad = spanIssue(payload.startsAt, payload.endsAt);
      if (bad) i.add(`${path}.fields.endsAt`, bad);
    }
  }
  let source: { ref: string } | undefined;
  if (t === 'calendar_event.create' && raw.source !== undefined) {
    if (!plain(raw.source)) i.add(`${path}.source`, 'must be an object');
    else {
      rejectUnknown(i, `${path}.source`, raw.source, ['ref']);
      const ref = text(i, `${path}.source.ref`, raw.source.ref, LIMITS.sourceRefMax, { required: true, nullable: false });
      if (typeof ref === 'string') source = { ref };
    }
  }
  if (i.list.length > 0) return { ok: false, issues: i.list };

  const base = { commandId: raw.commandId as string, deviceId: raw.deviceId as string, clock: raw.clock as string, createdAt: createdAt! };
  const id = raw.id as string;
  const value = (() => {
    switch (t) {
      case 'task.create': return { ...base, type: t, id, fields: payload as TaskFields };
      case 'task.update': return { ...base, type: t, id, changes: payload as Partial<TaskFields> };
      case 'calendar_event.create': return { ...base, type: t, id, fields: payload as EventFields, ...(source ? { source } : {}) };
      case 'calendar_event.update': return { ...base, type: t, id, changes: payload as Partial<EventFields> };
      default: return { ...base, type: t, id };
    }
  })() as Command;
  return { ok: true, value };
}

export interface CommandBatch {
  commands: unknown[];
}

/** The request body of `POST /v1/productivity/commands`: shape only; each command is validated on its own. */
export function validateBatch(raw: unknown): Validated<CommandBatch> {
  if (!plain(raw)) return { ok: false, issues: [{ path: 'body', issue: 'must be an object' }] };
  const extra = Object.keys(raw).filter((k) => k !== 'commands');
  if (extra.length > 0) return { ok: false, issues: extra.map((k) => ({ path: `body.${k}`, issue: 'is not a field of this request' })) };
  if (!Array.isArray(raw.commands)) return { ok: false, issues: [{ path: 'body.commands', issue: 'must be a list' }] };
  if (raw.commands.length === 0) return { ok: false, issues: [{ path: 'body.commands', issue: 'must have at least one command' }] };
  if (raw.commands.length > LIMITS.batchMax) return { ok: false, issues: [{ path: 'body.commands', issue: `has more than ${LIMITS.batchMax} commands; send the rest in a second request` }] };
  return { ok: true, value: { commands: raw.commands } };
}

// ── Results ───────────────────────────────────────────────────────────────

export interface EntityRef {
  type: EntityType;
  id: string;
  version: number;
}

export type CommandResult =
  | { commandId: string; status: 'applied'; entity: EntityRef; seq: number; appliedFields: string[]; supersededFields: string[]; clockClamped: boolean }
  /** Nothing changed because a newer edit, or a delete, already stood. Drop it from the queue and refetch. */
  | { commandId: string; status: 'superseded'; entity: EntityRef; supersededFields: string[]; reason: 'newer_edit' | 'no_change' | 'already_deleted' }
  /** This exact command was applied before; the original outcome is repeated. */
  | { commandId: string; status: 'duplicate'; original: Exclude<CommandResult, { status: 'duplicate' }> }
  /** Refused, permanently for this command as sent. */
  | { commandId: string; status: 'rejected'; code: string; message: string; userAction?: { label: string; kind: string } }
  /** Could not be completed now; send the same command again. The outcome may be unknown. */
  | { commandId: string; status: 'failed'; code: string; message: string; retryable: true }
  /** Not tried, because an earlier command in the request failed. Send it again, in order. */
  | { commandId: string; status: 'not_attempted'; retryable: true };

// ── Pagination ────────────────────────────────────────────────────────────

/**
 * A cursor is a position, never a permission. It is opaque to the client and
 * not trusted by the server: whatever it says, the query that follows is
 * scoped by the verified tenant and owner, so a forged cursor can at worst
 * start a person's own list somewhere odd.
 */
export interface CursorPosition {
  /** `s` for a change-feed sequence, `k` for a sort key and id. */
  k: 's' | 'k';
  seq?: number;
  key?: string;
  id?: string;
}

export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(JSON.stringify(position), 'utf8').toString('base64url');
}

export function decodeCursor(value: string | null | undefined, kind: CursorPosition['k']): CursorPosition | null | 'invalid' {
  if (value === null || value === undefined || value === '') return null;
  if (value.length > 300 || !/^[A-Za-z0-9_-]+$/.test(value)) return 'invalid';
  try {
    const p = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as CursorPosition;
    if (!plain(p) || p.k !== kind) return 'invalid';
    if (kind === 's') return Number.isSafeInteger(p.seq) && (p.seq as number) >= 0 ? { k: 's', seq: p.seq as number } : 'invalid';
    return typeof p.key === 'string' && typeof p.id === 'string' && p.key.length <= 64 && isUuid(p.id) ? { k: 'k', key: p.key, id: p.id } : 'invalid';
  } catch {
    return 'invalid';
  }
}

export interface Page<T> {
  data: T[];
  page: { next_cursor: string | null; has_more: boolean };
}
