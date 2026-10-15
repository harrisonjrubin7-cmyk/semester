import { randomUUID } from 'node:crypto';
import { CORRELATION_ID_PATTERN, type PolicyAction, type UserAction } from '../../../packages/institution/src/index.ts';
import { isPlatformError } from '../../../packages/platform/src/index.ts';
import { DEFAULT_RATE_LIMIT, MemoryRateLimiter, type RateLimiter } from '../institution/rate-limit.ts';
import {
  API_VERSION,
  LIMITS,
  decodeCursor,
  isUuid,
  normalizeInstant,
  validateBatch,
  type CursorPosition,
  type EntityType,
} from './contract.ts';
import { ApiError, type Principal, type ProductivityService, type RequestMeta } from './service.ts';

/**
 * The HTTP face of the productivity service, v1.
 *
 * A pure `Request -> Response` function, so the same handler runs behind a
 * Vercel function, the local dev server and the tests, and none of them needs a
 * socket. What it owns is the conventions every Semester domain API follows
 * (docs/API-PLATFORM.md): one error envelope, correlation ids, strict
 * parsing, bounded bodies, per-identity rate limits, and no content in logs.
 * What it does not own is any decision about data: authorization is the
 * service's, asked of the policy decision point, per command and per read.
 *
 * Order matters and is the order of cost: route, then who, then how often,
 * then what. A request that is not from a known person never reaches a parser.
 */

export const MAX_BODY_BYTES = 256_000;

export interface ApiTelemetry {
  /** The route template, never the path: ids in a metric label are a cardinality bomb and a privacy leak. */
  route: string;
  method: string;
  status: number;
  durationMs: number;
  requestId: string;
  correlationId: string;
  actorType?: string;
}

export interface ApiConfig {
  service: ProductivityService;
  /** Resolves the bearer credential to a verified principal, or null. See docs/API-PLATFORM.md §6. */
  authenticate: (request: Request) => Promise<Principal | null>;
  /** Separate budgets: reading a screen is not the same load as replaying an offline queue. */
  limiters?: { read: RateLimiter; write: RateLimiter };
  retryAfterSeconds?: number;
  telemetry?: (event: ApiTelemetry) => void;
  /** Whatever an unexpected failure threw, with the ids that find it again. Never sent to the caller. */
  onError?: (error: unknown, context: { route: string; requestId: string; correlationId: string }) => void;
  /** Path before `/v1`, when mounted under a prefix. */
  basePath?: string;
  now?: () => number;
}

type RouteName = 'commands' | 'tasks.list' | 'tasks.get' | 'events.list' | 'events.get' | 'agenda' | 'changes';

interface Route {
  name: RouteName;
  method: 'GET' | 'POST';
  pattern: RegExp;
  template: string;
  write: boolean;
  /**
   * The policy actions this route asks the decision point. Declared so that an
   * endpoint with none is visible in review, and checked in `http.test.ts`
   * against what the service actually asked when the route was called.
   */
  policy: readonly PolicyAction[];
}

export const ROUTES: readonly Route[] = [
  { name: 'commands', method: 'POST', pattern: /^\/v1\/productivity\/commands$/, template: '/v1/productivity/commands', write: true, policy: ['task.write', 'calendar.event.write'] },
  { name: 'changes', method: 'GET', pattern: /^\/v1\/productivity\/changes$/, template: '/v1/productivity/changes', write: false, policy: ['task.read', 'calendar.event.read'] },
  { name: 'tasks.list', method: 'GET', pattern: /^\/v1\/tasks$/, template: '/v1/tasks', write: false, policy: ['task.read'] },
  { name: 'tasks.get', method: 'GET', pattern: /^\/v1\/tasks\/([^/]+)$/, template: '/v1/tasks/{id}', write: false, policy: ['task.read'] },
  { name: 'events.list', method: 'GET', pattern: /^\/v1\/calendar\/events$/, template: '/v1/calendar/events', write: false, policy: ['calendar.event.read'] },
  { name: 'events.get', method: 'GET', pattern: /^\/v1\/calendar\/events\/([^/]+)$/, template: '/v1/calendar/events/{id}', write: false, policy: ['calendar.event.read'] },
  { name: 'agenda', method: 'GET', pattern: /^\/v1\/agenda$/, template: '/v1/agenda', write: false, policy: ['task.read', 'calendar.event.read'] },
];

const RETRYABLE = new Set([429, 503]);

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    correlation_id: string;
    request_id: string;
    retryable: boolean;
    /** On a 429, how long to wait; the same number the `Retry-After` header carries. */
    retry_after_seconds?: number;
    /** Present only when the answer is "we do not know whether the change was made". */
    outcome_known?: boolean;
    user_action?: UserAction;
    details?: { path: string; issue: string }[];
  };
  message: string;
}

export function createProductivityApi(config: ApiConfig): (request: Request) => Promise<Response> {
  const limiters = config.limiters ?? {
    read: new MemoryRateLimiter({ windowMs: DEFAULT_RATE_LIMIT.windowMs, max: 300 }),
    write: new MemoryRateLimiter({ windowMs: DEFAULT_RATE_LIMIT.windowMs, max: 120 }),
  };
  const retryAfter = String(config.retryAfterSeconds ?? Math.ceil(DEFAULT_RATE_LIMIT.windowMs / 1000));
  const now = config.now ?? Date.now;
  const base = (config.basePath ?? '').replace(/\/$/, '');

  return async function handle(request: Request): Promise<Response> {
    const started = now();
    const requestId = randomUUID();
    const given = request.headers.get('x-correlation-id');
    // Capped at 100, not the policy pattern's 128: the shared audit envelope
    // (`audit_event.correlation_id`) refuses more, and an id the audit row cannot
    // hold is one that would fail the commit it is meant to trace.
    const correlationId = given && given.length <= 100 && CORRELATION_ID_PATTERN.test(given) ? given : randomUUID();
    let route = 'unmatched';
    let actorType: string | undefined;

    const headers = new Headers({
      'X-Request-Id': requestId,
      'X-Correlation-Id': correlationId,
      'Semester-API-Version': API_VERSION,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Authorization',
    });

    const fail = (status: number, code: string, message: string, extra: { userAction?: UserAction; details?: ApiError['details']; unknownOutcome?: boolean; retryAfter?: number } = {}): Response => {
      const body: ErrorEnvelope = {
        error: {
          code, message, correlation_id: correlationId, request_id: requestId, retryable: RETRYABLE.has(status),
          ...(extra.retryAfter ? { retry_after_seconds: extra.retryAfter } : {}),
          ...(extra.unknownOutcome ? { outcome_known: false } : {}),
          ...(extra.userAction ? { user_action: extra.userAction } : {}),
          ...(extra.details ? { details: extra.details } : {}),
        },
        message,
      };
      return Response.json(body, { status, headers });
    };
    const done = (response: Response): Response => {
      config.telemetry?.({ route, method: request.method, status: response.status, durationMs: now() - started, requestId, correlationId, ...(actorType ? { actorType } : {}) });
      return response;
    };

    try {
      const url = new URL(request.url);
      const path = base && url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname;
      const matches = ROUTES.map((r) => ({ r, m: r.pattern.exec(path) })).filter((x) => x.m);
      if (matches.length === 0) return done(fail(404, 'route_not_found', 'There is nothing at this address.'));
      const hit = matches.find((x) => x.r.method === request.method);
      if (!hit) {
        headers.set('Allow', matches.map((x) => x.r.method).join(', '));
        route = matches[0]!.r.template;
        return done(fail(405, 'method_not_allowed', 'That method is not available here.'));
      }
      const { r, m } = hit;
      route = r.template;

      const principal = await config.authenticate(request);
      if (!principal) {
        headers.set('WWW-Authenticate', 'Bearer');
        return done(fail(401, 'unauthenticated', 'Sign in to continue.', { userAction: { label: 'Sign in', kind: 'open_screen' } }));
      }
      actorType = principal.actor.type;

      const limiter = r.write ? limiters.write : limiters.read;
      const who = { institutionId: principal.tenant.id, userId: principal.actor.id };
      if (!(await limiter.allow(who, now()))) {
        headers.set('Retry-After', retryAfter);
        return done(fail(429, 'rate_limited', 'Too many requests. Please wait a minute and try again.', { userAction: { label: 'Try again shortly', kind: 'retry_later' }, retryAfter: Number(retryAfter) }));
      }

      const purpose = request.headers.get('x-semester-purpose');
      if (purpose !== null && (purpose.length > 200 || /[\u0000-\u001F\u007F]/.test(purpose))) {
        return done(fail(400, 'validation_failed', 'X-Semester-Purpose must be plain text of at most 200 characters.'));
      }
      const tenantHint = request.headers.get('x-tenant-id');
      const idempotencyKey = request.headers.get('idempotency-key');
      const meta: RequestMeta = {
        correlationId,
        requestId,
        ...(purpose ? { purpose: purpose.trim() } : {}),
        ...(tenantHint !== null ? { tenantHint } : {}),
        ...(idempotencyKey !== null ? { idempotencyKey } : {}),
      };

      if (r.name === 'commands') {
        const type = request.headers.get('content-type') ?? '';
        if (!/^application\/json(\s*;|$)/i.test(type)) return done(fail(415, 'unsupported_media_type', 'Send the request as application/json.'));
        const declared = Number(request.headers.get('content-length') ?? '0');
        if (declared > MAX_BODY_BYTES) return done(fail(413, 'payload_too_large', 'That request is too large. Send fewer commands at once.'));
        const text = await request.text();
        if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return done(fail(413, 'payload_too_large', 'That request is too large. Send fewer commands at once.'));
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          return done(fail(400, 'invalid_json', 'The request body is not valid JSON.'));
        }
        const batch = validateBatch(parsed);
        if (!batch.ok) return done(fail(400, 'validation_failed', `${batch.issues[0]!.path} ${batch.issues[0]!.issue}.`, { details: batch.issues }));
        // The first token paid for the request; a large batch pays for the rest of its weight.
        for (let extra = Math.ceil(batch.value.commands.length / 10) - 1; extra > 0; extra -= 1) {
          if (!(await limiters.write.allow(who, now()))) {
            headers.set('Retry-After', retryAfter);
            return done(fail(429, 'rate_limited', 'Too many changes at once. Send fewer, or wait a minute.', { userAction: { label: 'Try again shortly', kind: 'retry_later' }, retryAfter: Number(retryAfter) }));
          }
        }
        const results = await config.service.execute(principal, batch.value.commands, meta);
        return done(Response.json({ results }, { status: 200, headers }));
      }

      const query = parseQuery(url.searchParams, r.name);
      if ('error' in query) return done(fail(400, 'validation_failed', query.error.message, { details: query.error.details }));
      const q = query.value;

      switch (r.name) {
        case 'tasks.list': {
          const page = await config.service.listTasks(principal, {
            ...(q.ownerId ? { ownerId: q.ownerId } : {}),
            ...(q.status ? { status: q.status } : {}),
            ...(q.dueBefore ? { dueBefore: q.dueBefore } : {}),
            ...(q.dueAfter ? { dueAfter: q.dueAfter } : {}),
            after: q.cursor, ...(q.limit ? { limit: q.limit } : {}),
          }, meta);
          return done(Response.json(page, { headers }));
        }
        case 'events.list': {
          const page = await config.service.listEvents(principal, {
            ...(q.ownerId ? { ownerId: q.ownerId } : {}), from: q.from!, to: q.to!, after: q.cursor, ...(q.limit ? { limit: q.limit } : {}),
          }, meta);
          return done(Response.json(page, { headers }));
        }
        case 'agenda':
          return done(Response.json(await config.service.agenda(principal, { from: q.from!, to: q.to! }, meta), { headers }));
        case 'changes':
          return done(Response.json(await config.service.changes(principal, { after: q.cursor, ...(q.limit ? { limit: q.limit } : {}) }, meta), { headers }));
        case 'tasks.get':
        case 'events.get': {
          const type: EntityType = r.name === 'tasks.get' ? 'task' : 'calendar_event';
          const entity = await config.service.get(principal, type, decodeURIComponent(m![1]!), meta);
          const etag = `"v${String(entity.version)}"`;
          // The record is private, so it is revalidated, not stored by a shared cache; the ETag makes that cheap.
          headers.set('Cache-Control', 'private, no-cache');
          headers.set('ETag', etag);
          if (request.headers.get('if-none-match') === etag) return done(new Response(null, { status: 304, headers }));
          return done(Response.json(entity, { headers }));
        }
        default:
          return done(fail(404, 'route_not_found', 'There is nothing at this address.'));
      }
    } catch (error) {
      if (isPlatformError(error)) {
        return done(fail(error.status, error.code, error.message, {
          ...(error.userAction ? { userAction: error.userAction } : {}),
          ...(error.retryAfterSeconds !== undefined ? { retryAfter: error.retryAfterSeconds } : {}),
        }));
      }
      if (error instanceof ApiError) {
        return done(fail(error.status, error.code, error.message, {
          ...(error.userAction ? { userAction: error.userAction } : {}),
          ...(error.details ? { details: error.details } : {}),
        }));
      }
      // Whatever it was stays in the server's own logs, keyed by the request id. The caller gets neither a
      // stack nor a query, and — for a read — the honest instruction that trying again is safe.
      config.onError?.(error, { route, requestId, correlationId });
      const read = request.method === 'GET';
      return done(read
        ? fail(503, 'unavailable', 'Semester could not load this just now. Please try again.', { userAction: { label: 'Try again in a moment', kind: 'retry_later' } })
        : fail(500, 'internal', 'Something went wrong on our side. Your change may not have been made; send it again and it will not be applied twice.', { unknownOutcome: true }));
    }
  };
}

// ── Query strings ─────────────────────────────────────────────────────────

interface Query {
  ownerId?: string;
  status?: 'open' | 'done';
  dueBefore?: string;
  dueAfter?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor: CursorPosition | null;
}

type Parsed = { value: Query } | { error: { message: string; details: { path: string; issue: string }[] } };

const ALLOWED: Record<string, string[]> = {
  'tasks.list': ['owner_id', 'status', 'due_before', 'due_after', 'limit', 'cursor'],
  'tasks.get': [],
  'events.list': ['owner_id', 'from', 'to', 'limit', 'cursor'],
  'events.get': [],
  agenda: ['from', 'to'],
  changes: ['after', 'limit'],
};

const WINDOW_DAYS: Record<string, number> = { 'events.list': LIMITS.windowMaxDays, agenda: 62 };

function parseQuery(params: URLSearchParams, route: RouteName): Parsed {
  const details: { path: string; issue: string }[] = [];
  const add = (path: string, issue: string) => void details.push({ path, issue });
  const allowed = ALLOWED[route] ?? [];
  for (const key of new Set(params.keys())) if (!allowed.includes(key)) add(key, 'is not a parameter of this endpoint');

  const value: Query = { cursor: null };
  const owner = params.get('owner_id');
  if (owner !== null) {
    if (!isUuid(owner)) add('owner_id', 'must be a UUID');
    else value.ownerId = owner;
  }
  const status = params.get('status');
  if (status !== null) {
    if (status !== 'open' && status !== 'done') add('status', 'must be open or done');
    else value.status = status;
  }
  for (const param of ['due_before', 'due_after', 'from', 'to'] as const) {
    const raw = params.get(param);
    if (raw === null) continue;
    const n = normalizeInstant(raw);
    if (n === null) add(param, 'must be an ISO-8601 time ending in Z, such as 2026-10-05T14:00:00Z');
    else if (param === 'due_before') value.dueBefore = n;
    else if (param === 'due_after') value.dueAfter = n;
    else value[param] = n;
  }
  const limit = params.get('limit');
  if (limit !== null) {
    const n = Number(limit);
    if (!/^\d+$/.test(limit) || n < 1 || n > LIMITS.pageMax) add('limit', `must be a whole number from 1 to ${LIMITS.pageMax}`);
    else value.limit = n;
  }
  const kind = route === 'changes' ? 's' : 'k';
  const cursor = decodeCursor(params.get(route === 'changes' ? 'after' : 'cursor'), kind);
  if (cursor === 'invalid') add(route === 'changes' ? 'after' : 'cursor', 'is not a cursor this endpoint issued');
  else value.cursor = cursor;

  if (route === 'events.list' || route === 'agenda') {
    if (!value.from) add('from', 'is required');
    if (!value.to) add('to', 'is required');
    if (value.from && value.to) {
      const span = Date.parse(value.to) - Date.parse(value.from);
      const max = WINDOW_DAYS[route]!;
      if (span <= 0) add('to', 'must be after from');
      else if (span > max * 86_400_000) add('to', `is more than ${max} days after from`);
    }
  }
  if (details.length > 0) return { error: { message: `${details[0]!.path} ${details[0]!.issue}.`, details } };
  return { value };
}
