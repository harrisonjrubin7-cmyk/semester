import { randomUUID } from 'node:crypto';
import {
  UNIVERSITY_AREAS,
  decide,
  isRefusal,
  groundsFor,
  isUniversityArea,
  mayStep,
  parseAction,
  validateActionFields,
  type ActionInput,
  type AuthorizationRequest,
  type PolicyEnvironment,
  type UniversityArea,
  type UniversityIdentity,
  type UserAction,
} from '../../../packages/institution/src/index.ts';
import {
  PlatformError,
  errorResponse,
  isPlatformError,
  resolveCorrelationId,
  type ErrorEnvelope as PlatformErrorEnvelope,
} from '../../../packages/platform/src/index.ts';
import type { AdapterContext, InstitutionAdapter } from './adapter.ts';
import { contextFor } from './context.ts';
import type { ActionJournalStore } from './journal.ts';
import type { IntelligenceService } from './intelligence.ts';
import type { PublicSsoConfig } from './membership.ts';
import { MemoryRateLimiter, type RateLimiter } from './rate-limit.ts';
import type { ReadinessResult } from './readiness.ts';
import type { RegistrationReadinessService } from './readiness-service.ts';

/**
 * The gateway: everything that is the same whichever university it is.
 *
 * Authentication, rate limiting, the two-phase action, the journal and the
 * refusals. Anything specific to an institution is behind an
 * `InstitutionAdapter`, and there are none installed — so in this build every
 * route that needs one answers 503, which is the honest state and the state
 * the app's screens are written to draw.
 *
 * ## Nothing is ever done in one request
 *
 * `/actions/prepare` returns a review and changes nothing.
 * `/actions/commit` needs that review's id and an explicit `confirmed: true`.
 * Between them the gateway re-fetches the record, re-checks the version,
 * re-runs the adapter's review, and compares it to what the person actually
 * read. If any of that has moved, the commit is refused and a new review is
 * required.
 *
 * That is four opportunities to refuse, and each exists because the
 * alternative is somebody dropping a course they did not mean to drop.
 *
 * ## A failed execute is never retried
 *
 * If `execute` throws, the outcome is unknown — the school may have acted. The
 * journal goes to `uncertain` and the only way out is `/actions/reconcile`,
 * which *asks* what happened rather than doing it again. The 502 says so in
 * the words a student needs.
 *
 * ## What the client is never trusted for
 *
 * The identity (it comes from `auth.ts`), the institution (from the identity),
 * the adapter (an installed module, looked up by the identity's own tenant),
 * or whether an action is permitted (the adapter decides, every call).
 *
 * ## One id, carried through
 *
 * Every response carries two ids. `X-Request-Id` is minted here, once per
 * request, and is never anything a client sent. `X-Correlation-Id` is the
 * client's if it sent a well-formed one, and minted otherwise — it is the id
 * that follows one student action from the tap in the browser through this
 * request, its audit rows, its telemetry line and, if it comes to that, the
 * support ticket. The audit row and the telemetry event both carry it, so
 * "which audit event proves this happened" is a lookup rather than a search.
 *
 * ## Every refusal has the same shape
 *
 * `{ error: { code, message, correlation_id, retryable, user_action? } }`,
 * plus a top-level `message` for the client that predates the envelope.
 * `retryable` is a statement, not a hint: a 429 or a 503 may be tried again,
 * and a 502 from an unknown outcome **may not** — the sentence says to
 * reconcile, and the flag says the same thing to a client that only reads
 * flags.
 */

interface Config {
  origin: string;
  institutionName: string;
  authenticate: (token: string) => Promise<UniversityIdentity | null>;
  refreshIdentity?: (identity: UniversityIdentity, token: string) => Promise<UniversityIdentity | null>;
  adapters: InstitutionAdapter[];
  journal: ActionJournalStore;
  intelligence?: IntelligenceService;
  loadSsoConfig?: () => Promise<PublicSsoConfig | null>;
  rateLimiter?: RateLimiter;
  readiness?: () => Promise<ReadinessResult>;
  /** Default-off command boundary; production composition supplies it only when explicitly enabled. */
  registrationReadiness?: Pick<RegistrationReadinessService, 'start'>;
  telemetry?: (event: GatewayTelemetryEvent) => void | Promise<void>;
  /**
   * Read-only mode: every write is refused with a 503 `read_only` that says
   * to try again later, and reads go on as before. Asked each request rather
   * than read once, so an operator can turn it on and off without a restart
   * when the process is given a way to. `start.ts` reads
   * `SEMESTER_READ_ONLY=on`; the app has its own copy in `lib/readonly.ts`,
   * and the two are registered together in `docs/FEATURE-FLAG-REGISTRY.md`.
   */
  readOnly?: () => boolean;
  /** Which environment the tenants of this gateway are in. `production` unless told otherwise. */
  environment?: PolicyEnvironment;
}

export interface GatewayTelemetryEvent {
  event: 'institution.request';
  requestId: string;
  correlationId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  errorClass: 'none' | 'client' | 'server';
}

const TELEMETRY_ROUTES = new Set([
  '/health', '/health/live', '/health/ready', '/v1/auth/config',
  '/v1/intelligence/policy', '/v1/intelligence/respond',
  '/v1/registration-readiness/evaluations',
  '/status', '/records', '/actions/prepare', '/actions/commit', '/actions/reconcile',
]);

function telemetryRoute(pathname: string): string {
  if (/^\/v1\/intelligence\/actions\/[^/]+\/confirm$/.test(pathname)) {
    return '/v1/intelligence/actions/:id/confirm';
  }
  return TELEMETRY_ROUTES.has(pathname) ? pathname : '/unmatched';
}

/**
 * The machine-readable name for each refusal, by status, unless a `fail`
 * names a more specific one. The names are the envelope's vocabulary and a
 * client may switch on them; a status alone is not enough to tell "the
 * review expired" from "the record moved", and both are 4xx.
 */
export const CODE_BY_STATUS: Record<number, string> = {
  400: 'invalid_request',
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'not_found',
  405: 'method_not_supported',
  409: 'conflict',
  410: 'expired',
  413: 'too_large',
  415: 'unsupported_media_type',
  429: 'rate_limited',
  502: 'outcome_uncertain',
  503: 'unavailable',
};

/*
 * A declaration rather than a const arrow, deliberately: TypeScript only
 * narrows control flow through a `never`-returning call when the callee is a
 * function declaration (or a const with an explicit type annotation). As an
 * arrow, every `fail(...)` guard below would still leave its subject nullable.
 */
function fail(status: number, message: string, code?: string, userAction?: UserAction): never {
  throw PlatformError.from(status, code ?? CODE_BY_STATUS[status] ?? 'error', message, userAction ? { userAction } : {});
}

/**
 * The envelope every refusal is: `@semester/platform`'s, which is this
 * gateway's own shape (ADR 0010) lifted out so every surface says it the same
 * way. Kept as an export here because clients and tests import it by this name.
 */
export type ErrorEnvelope = PlatformErrorEnvelope;

function envelope(status: number, code: string, message: string, correlationId: string, userAction?: UserAction): ErrorEnvelope {
  return errorResponse(PlatformError.from(status, code, message, userAction ? { userAction } : {}), correlationId).body;
}

/**
 * The correlation id for this request: the client's, if it sent one that is
 * plainly an id, and a fresh one otherwise. The pattern is the same the audit
 * column checks, so nothing accepted here is refused there — and nothing
 * outside it (a sentence, a script, four kilobytes) reaches a log line.
 */
export function correlationIdFor(request: Request): string {
  return resolveCorrelationId(request.headers.get('x-correlation-id') ?? undefined, { next: () => randomUUID() });
}

/** How long somebody has to read a review and confirm it. */
const REVIEW_MINUTES = 10;
/**
 * The largest body the gateway will look at.
 *
 * Exported because `start.ts` has to enforce the same number while the request
 * is still arriving — by the time a `Request` exists here the bytes are already
 * held. Two copies of one limit is how a socket-level bound drifts above the
 * bound it was meant to mirror.
 */
export const MAX_BODY = 128_000;
const COMMAND_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TERM_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function createGateway(config: Config) {
  /*
   * Adapters are installed modules, keyed by the tenant they belong to.
   *
   * Built once, from the array. A request can name an *area*, and the tenant
   * comes from the verified identity — so there is no input anywhere that
   * selects which adapter runs.
   */
  const installed = new Map(config.adapters.map((a) => [`${a.institutionId}:${a.area}`, a]));
  const rateLimiter = config.rateLimiter ?? new MemoryRateLimiter();

  const handle = async (request: Request, correlationId: string, requestId: string): Promise<Response> => {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Origin',
    });
    const refuse = (status: number, code: string, message: string, userAction?: UserAction) =>
      Response.json(envelope(status, code, message, correlationId, userAction), { status, headers });

    /*
     * One exact origin, echoed only when it matches.
     *
     * Never `*`: these responses carry somebody's university records, and a
     * wildcard would let any page that can get a token read them.
     */
    const origin = request.headers.get('origin');
    if (origin && origin !== config.origin) {
      return refuse(403, 'origin_not_allowed', 'This origin is not allowed.');
    }
    if (origin) {
      headers.set('Access-Control-Allow-Origin', origin);
      // Without this a browser client can send the id but never read it back.
      headers.set('Access-Control-Expose-Headers', 'X-Request-Id, X-Correlation-Id');
    }
    if (request.method === 'OPTIONS') {
      headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key, X-Correlation-Id');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      return new Response(null, { status: 204, headers });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      /*
       * Before authentication, deliberately: it is how a deployment is checked.
       *
       * It used to answer `{service, version}` unconditionally, which is a
       * liveness check wearing a readiness check's name. Those two are worth
       * separating here more than in most services: this process answers 200
       * while being unable to do the one thing it exists for, because the
       * journal is a file and a file can stop being usable long after boot —
       * a volume that did not come back is the case this catches.
       * `journal.healthy()` is precise about which failures it can and cannot
       * see; read that before quoting this endpoint's green at anybody.
       *
       * A deployment check that cannot see that is worse than none. It is the
       * green light somebody points at while a student's withdrawal is going
       * unrecorded, and the two-phase action means an unrecorded attempt is
       * precisely the failure the `uncertain` state was built to prevent.
       *
       * 503 rather than 200-with-a-flag, so that a load balancer and a
       * monitor reading nothing but the status code both get it right. What it
       * does *not* say is why: "journal" names a subsystem, and an unauthenticated
       * endpoint that narrates which part of a service is broken is a map for
       * somebody choosing what to lean on.
       */
      if (request.method === 'GET' && path === '/health/live') {
        return Response.json({ service: 'Semester university gateway', version: 1, status: 'live' }, { status: 200, headers });
      }
      if (request.method === 'GET' && (path === '/health' || path === '/health/ready')) {
        const readiness = config.readiness
          ? await config.readiness()
          : { ready: await config.journal.healthy(), status: 'ready' as const };
        const ready = readiness.ready;
        return Response.json(
          {
            service: 'Semester university gateway',
            version: 1,
            status: ready ? 'ready' : 'unavailable',
            adapters: config.adapters.length,
            intelligence: config.intelligence?.status ?? 'policy-disabled',
            // So the runbook's "confirm" step is a curl, not a guess.
            readOnly: config.readOnly?.() === true,
          },
          { status: ready ? 200 : 503, headers },
        );
      }
      if (request.method === 'GET' && path === '/v1/auth/config') {
        try {
          const sso = await config.loadSsoConfig?.();
          return Response.json(sso ?? { enabled: false }, { status: 200, headers });
        } catch {
          return Response.json({ enabled: false }, { status: 200, headers });
        }
      }
      if (!['GET', 'POST'].includes(request.method)) fail(405, 'Method not supported.');

      const token = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') || '')?.[1];
      if (!token) fail(401, 'Sign in to your school-approved Semester account.');

      const authenticated = await config.authenticate(token);
      if (!authenticated) fail(403, 'No verified university access is assigned to this account.');
      let who: UniversityIdentity = authenticated;

      const now = Date.now();
      if (!(await rateLimiter.allow(who, now))) fail(429, 'Please wait a minute before trying again.');

      /*
       * Read-only mode. After authentication and the rate limit, so that a
       * frozen gateway is not also an open one; before any route that can
       * write, so that no route has to remember to check.
       *
       * Every POST but one: `/actions/reconcile` does not do anything at the
       * school, it *asks* what already happened to an action whose outcome is
       * unknown, and refusing it would leave that student's action stuck at
       * `uncertain` for as long as the mode lasts — which is exactly when a
       * restore or a repair may have made the answer worth asking for. The
       * journal row it finishes records a result the school already has.
       *
       * 503, which is the one refusal that says "the same request may be sent
       * again" and means it here: the mode ends, the request works.
       */
      if (request.method === 'POST' && path !== '/actions/reconcile' && config.readOnly?.()) {
        fail(503, 'Semester is in read-only mode for maintenance. Nothing was sent; try again later.', 'read_only');
      }

      /*
       * The platform's request context, built once from the verified identity
       * and the two ids this request already carries. It is where a client's
       * `X-Tenant-Id` that disagrees with the session is refused
       * (`tenant_mismatch`) instead of ignored: the tenant is the session's, and
       * a request that names another one is a bug or an attack worth hearing about.
       */
      const ids = { requestId, correlationId };
      const intelligencePurpose = path === '/v1/intelligence/respond' ? 'ai_context' : undefined;
      const context: AdapterContext = {
        identity: who,
        signal: AbortSignal.timeout(20_000),
        request: contextFor(request, who, ids, config.environment, intelligencePurpose),
      };

      const intelligenceConfirm = /^\/v1\/intelligence\/actions\/([^/]+)\/confirm$/.exec(path);
      if (request.method === 'GET' && path === '/v1/intelligence/policy') {
        if (!config.intelligence) return refuse(503, 'policy-disabled', 'Semester Intelligence is not configured for this gateway.');
        const response = await config.intelligence.policy(who);
        return Response.json(response.body, { status: response.status, headers });
      }
      if (
        request.method === 'POST' &&
        (path === '/v1/intelligence/respond' || intelligenceConfirm)
      ) {
        if (!config.intelligence) {
          return refuse(503, 'policy-disabled', 'Semester Intelligence is not configured for this gateway.');
        }
        if (!request.headers.get('content-type')?.startsWith('application/json')) fail(415, 'Send JSON.');
        const text = await request.text();
        if (Buffer.byteLength(text) > MAX_BODY) fail(413, 'Request is too large.');
        let value: unknown;
        try {
          value = JSON.parse(text);
        } catch {
          fail(400, 'Invalid JSON.');
        }
        if (intelligenceConfirm && config.refreshIdentity) {
          const current = await config.refreshIdentity(who, token);
          if (!current || current.userId !== who.userId || current.institutionId !== who.institutionId) {
            fail(403, 'Your current university access does not permit this action.');
          }
          who = current;
          context.identity = current;
          context.request = contextFor(request, current, ids, config.environment);
        }
        const response = path === '/v1/intelligence/respond'
          ? await config.intelligence.respond(context.request!, who, value)
          : await config.intelligence.confirm(who, decodeURIComponent(intelligenceConfirm![1]), value);
        return Response.json(response.body, { status: response.status, headers });
      }

      if (request.method === 'POST' && path === '/v1/registration-readiness/evaluations') {
        if (!config.registrationReadiness) {
          fail(503, 'Registration readiness is not enabled for this deployment.', 'readiness_not_configured');
        }
        if (!request.headers.get('content-type')?.startsWith('application/json')) fail(415, 'Send JSON.');
        const idempotencyKey = request.headers.get('idempotency-key') || '';
        if (!COMMAND_UUID.test(idempotencyKey)) fail(400, 'Send a UUID Idempotency-Key for this request.');

        const text = await request.text();
        if (Buffer.byteLength(text) > MAX_BODY) fail(413, 'Request is too large.');
        let value: unknown;
        try {
          value = JSON.parse(text);
        } catch {
          fail(400, 'Invalid JSON.');
        }
        if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Send a registration-readiness request.');
        const input = value as Record<string, unknown>;
        if (Object.keys(input).some((key) => key !== 'termId')) {
          fail(400, 'Only termId may be supplied; account and institution come from your verified session.');
        }
        if (typeof input.termId !== 'string' || !TERM_ID.test(input.termId)) fail(400, 'Choose a valid term.');

        const authorization: AuthorizationRequest = {
          actor: { id: who.userId, type: 'user', authenticatedAt: new Date(now).toISOString() },
          tenant: { id: who.institutionId, environment: config.environment ?? 'production', verifiedBy: 'membership' },
          action: 'registration.readiness.request',
          resource: {
            type: 'registration_readiness_evaluation',
            id: idempotencyKey,
            ownerId: who.userId,
            classification: 'education_record',
            attributes: { tenantId: who.institutionId, termId: input.termId },
          },
          context: {
            membershipIds: [`${who.institutionId}:${who.userId}`],
            roleGrants: who.roles.map((role) => ({ role, scopeKind: 'tenant', scopeId: who.institutionId })),
            capabilities: who.roles.includes('student') ? ['registration.readiness.request'] : [],
            consentGrants: [],
            featureFlags: [],
            policyVersions: { registration: '1' },
            idempotencyKey,
            correlationId,
          },
        };
        const decision = decide(authorization, now);
        if (!decision.allow) fail(403, decision.userMessage, decision.reasonCode, decision.userAction);
        if (decision.obligations.length !== 1 || decision.obligations[0]?.type !== 'audit'
          || decision.obligations[0].eventType !== 'registration.readiness_requested') {
          fail(503, 'Registration readiness authorization could not be enforced.', 'authorization_obligation_unmet');
        }

        const result = await config.registrationReadiness.start({
          evaluationId: idempotencyKey,
          tenantId: who.institutionId,
          subjectId: who.userId,
          requestedBy: who.userId,
          termId: input.termId,
          correlationId,
          idempotencyKey,
          at: new Date(now).toISOString(),
        });
        return Response.json({
          evaluationId: result.record.id,
          receipt: result.receipt,
          replayed: result.replayed,
        }, { status: 202, headers });
      }

      /** The adapter for an area, if it exists and currently permits this. */
      const adapterFor = async (area: UniversityArea, write = false) => {
        const adapter = installed.get(`${who.institutionId}:${area}`);
        if (!adapter) fail(503, 'An approved university connection is not configured for this service.', 'adapter_not_configured');
        const status = await adapter.status(context);
        if (status.state !== 'connected' || !status.canRead || (write && !status.canWrite)) {
          fail(403, 'This connection does not permit that action.', 'connection_forbids');
        }
        return adapter;
      };

      /**
       * The record an action names, checked four ways.
       *
       * That it exists and is this account's; that it is the record and area
       * claimed; that its version has not moved since the review was
       * prepared; and that the action is one the record actually offers, with
       * fields that fit it. A 409 on the version is the check that stops
       * Monday's bill being paid at Friday's amount.
       */
      const recordFor = async (adapter: InstitutionAdapter, input: ActionInput) => {
        const record = await adapter.get(context, input.recordId);
        if (!record || record.id !== input.recordId || record.area !== input.area) {
          fail(404, 'Record not available to this account.');
        }
        if (record.version !== input.version) {
          fail(409, 'This record changed. Refresh it and review your action again.', 'record_changed');
        }
        const action = record.actions.find((a) => a.id === input.actionId);
        if (!action) fail(403, 'This action is not available for this record.');
        try {
          validateActionFields(input, action);
        } catch (e) {
          fail(400, (e as Error).message);
        }
        return record;
      };

      if (request.method === 'GET' && path === '/status') {
        const connections = await Promise.all(
          UNIVERSITY_AREAS.map(async ([area]) => {
            const adapter = installed.get(`${who.institutionId}:${area}`);
            if (!adapter) {
              return {
                area,
                state: 'not-configured' as const,
                provider: '',
                canRead: false,
                canWrite: false,
                lastSyncAt: null,
                permissions: [],
                message: 'Awaiting an approved school adapter.',
              };
            }
            try {
              return { ...(await adapter.status(context)), area };
            } catch {
              // One broken connection must not fail the whole page.
              return {
                area,
                state: 'error' as const,
                provider: '',
                canRead: false,
                canWrite: false,
                lastSyncAt: null,
                permissions: [],
                message: 'Connection status could not be read.',
              };
            }
          }),
        );
        return Response.json(
          {
            version: 1,
            institutionId: who.institutionId,
            institutionName: config.institutionName,
            roles: who.roles,
            connections,
          },
          { headers },
        );
      }

      if (request.method === 'GET' && path === '/records') {
        const area = url.searchParams.get('area');
        if (!isUniversityArea(area)) fail(400, 'Choose a university service.');
        const adapter = await adapterFor(area);
        const page = await adapter.list(context, {
          search: (url.searchParams.get('search') || '').slice(0, 200),
          cursor: (url.searchParams.get('cursor') || '').slice(0, 500) || null,
        });
        await config.journal.audit(who, area, 'records.read', null, correlationId);
        return Response.json(page, { headers });
      }

      const ACTIONS = ['/actions/prepare', '/actions/commit', '/actions/reconcile'];
      if (request.method !== 'POST' || !ACTIONS.includes(path)) fail(404, 'Endpoint not found.');
      if (!request.headers.get('content-type')?.startsWith('application/json')) fail(415, 'Send JSON.');

      const text = await request.text();
      if (Buffer.byteLength(text) > MAX_BODY) fail(413, 'Request is too large.');
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        fail(400, 'Invalid JSON.');
      }

      if (path === '/actions/prepare') {
        let input: ActionInput;
        try {
          input = parseAction(body);
        } catch (e) {
          return fail(400, (e as Error).message);
        }
        const adapter = await adapterFor(input.area, true);
        await recordFor(adapter, input);

        const summary = await adapter.review(context, input);
        const review = {
          id: randomUUID(),
          title: summary.title,
          details: summary.details,
          expiresAt: new Date(now + REVIEW_MINUTES * 60_000).toISOString(),
        };
        await config.journal.save({ review, input, identity: who, state: 'ready' });
        await config.journal.audit(who, input.area, 'action.prepared', review.id, correlationId);
        return Response.json(review, { headers });
      }

      const asked = body as { reviewId?: unknown; confirmed?: unknown };
      // Commit needs an explicit `true`. Nothing else counts as confirmation.
      if (!asked || (path === '/actions/commit' && asked.confirmed !== true) || typeof asked.reviewId !== 'string') {
        fail(400, 'Confirm the reviewed action before continuing.');
      }
      const row = await config.journal.get(asked.reviewId as string, who);
      if (!row) fail(404, 'Review not found for this account.');

      // Already done: hand back the same receipt rather than doing anything.
      if (row.state === 'completed') return Response.json(row.receipt, { headers });

      // Terminal, and there is nothing to look up: it was answered by a
      // refusal, not left hanging. Said before the two generic 409s below,
      // both of which would tell the person to reconcile it.
      if (row.state === 'refused') fail(409, 'This action was refused. Prepare a new review.', 'review_refused');

      if (path === '/actions/reconcile') {
        if (row.state === 'ready') fail(409, 'This action has not been submitted.');
        if (row.state === 'processing') fail(409, 'This action is still processing. Recheck its receipt shortly.');
        const adapter = await adapterFor(row.input.area);
        if (!adapter.reconcile) fail(503, 'This adapter needs institutional support to reconcile the action.');

        const result = await adapter.reconcile(context, row.input, row.review.id);
        /*
         * No answer is not an answer. Left unresolved rather than guessed,
         * because the guess that costs somebody money is "it probably failed".
         */
        if (!result || !result.id || !['completed', 'pending'].includes(result.status)) {
          fail(409, 'The school has not confirmed the result yet. Do not submit it again.', 'outcome_uncertain');
        }
        await config.journal.finish(row, result.status === 'pending' ? 'pending' : 'completed', result);
        await config.journal.audit(who, row.input.area, 'action.reconciled', row.review.id, correlationId);
        return Response.json(result, { headers });
      }

      if (row.state === 'pending') return Response.json(row.receipt, { headers });
      if (row.state !== 'ready') {
        fail(409, 'This action is processing or needs reconciliation. Do not submit it again.');
      }
      if (Date.parse(row.review.expiresAt) <= now) {
        fail(410, 'Review expired. Refresh and review the action again.', 'review_expired');
      }

      if (config.refreshIdentity) {
        const current = await config.refreshIdentity(who, token);
        if (!current || current.userId !== who.userId || current.institutionId !== who.institutionId) {
          fail(403, 'Your current university access does not permit this action.');
        }
        who = current;
        context.identity = current;
        context.request = contextFor(request, current, ids, config.environment);
      }

      /*
       * Everything checked again, at the moment of doing it.
       *
       * The record may have moved and the adapter's own answer may have
       * changed since the review was written. Comparing the re-run review to
       * what was shown is the check that the person is confirming the thing
       * they actually read — not a different action wearing its id.
       */
      const adapter = await adapterFor(row.input.area, true);
      await recordFor(adapter, row.input);
      const checked = await adapter.review(context, row.input);
      if (JSON.stringify(checked) !== JSON.stringify({ title: row.review.title, details: row.review.details })) {
        fail(409, 'The action details changed. Prepare a new review.', 'review_changed');
      }

      /*
       * The ladder, asked at the one place something is written.
       *
       * Everything above is what "confirm" and its four grounds are made of:
       * the explicit `true`, write access to this area, an action the adapter
       * offered for this record, and the correlation id the journal will hold
       * the start of the action under. If any is missing the answer is a
       * refusal that names it, before anything is claimed or sent.
       */
      const step = mayStep(
        { from: 'confirm', to: 'execute' },
        groundsFor({
          confirmed: asked.confirmed,
          institutionId: who.institutionId,
          area: row.input.area,
          actionId: row.input.actionId,
          correlationId,
        }),
      );
      if (!step.ok) {
        await config.journal.audit(who, row.input.area, 'action.refused', row.review.id, correlationId);
        fail(403, `This action cannot run yet: ${step.why}`, 'not_ready_to_execute');
      }

      if (!(await config.journal.claim(row.review.id, who, Date.now()))) {
        fail(409, 'This action was already claimed or expired.', 'already_claimed');
      }

      try {
        await config.journal.audit(who, row.input.area, 'action.started', row.review.id, correlationId);
        const receipt = await adapter.execute(context, row.input, row.review.id);
        if (!receipt.id || !['completed', 'pending'].includes(receipt.status) || !receipt.recordedAt) {
          throw new Error('Invalid upstream receipt.');
        }
        await config.journal.finish(row, receipt.status === 'pending' ? 'pending' : 'completed', receipt);
        await config.journal.audit(who, row.input.area, 'action.receipt', row.review.id, correlationId);
        return Response.json(receipt, { headers });
      } catch (e) {
        /*
         * A refusal at this point is the adapter saying it looked, said no,
         * and wrote nothing — which is the whole meaning of the type. Twelve
         * of the sandbox's refusals live here rather than in `review`, on
         * purpose: a client does not have to prepare anything first, so the
         * check has to be at the write as well as at the menu. Reporting
         * those as an unknown outcome would send somebody to their registrar
         * to reconcile an action that provably did not happen.
         */
        if (isRefusal(e)) {
          await config.journal.finish(row, 'refused');
          await config.journal.audit(who, row.input.area, 'action.refused', row.review.id, correlationId);
          return fail(400, e.message, 'refused');
        }
        /*
         * The one place this gateway refuses to guess.
         *
         * The school may have acted. Marking it failed could have somebody
         * pay twice; marking it done could have them miss a deadline. So it
         * is marked unknown, and only `/actions/reconcile` can resolve it.
         */
        await config.journal.finish(row, 'uncertain');
        await config.journal.audit(who, row.input.area, 'action.uncertain', row.review.id, correlationId);
        return fail(
          502,
          'The result could not be confirmed. Ask the institution to reconcile this action before submitting again.',
          'outcome_uncertain',
          { label: 'Ask the institution to reconcile', kind: 'contact_support' },
        );
      }
    } catch (e) {
      /*
       * Three kinds of thrown thing, and the middle one used to be lost.
       *
       * A `PlatformError` is something this gateway meant to say. A `Refusal` is
       * something the *adapter* meant to say — a rubric line that will not
       * parse, a mark outside its range, a deadline that has passed — and it
       * is the caller's to fix, so it is a 400 carrying that sentence. Every
       * refusal in this repository used to land in the third case instead,
       * and a marker who mistyped a line was told the university was down,
       * with a 503 inviting them to try it again.
       *
       * Anything else is a bug or an upstream failure, and its message could
       * carry a connection string or a stack — so it becomes one flat
       * sentence, which is still the default and still the right one.
       */
      if (isRefusal(e)) return refuse(400, 'refused', e.message);
      if (isPlatformError(e)) return refuse(e.status, e.code, e.message, e.userAction);
      return refuse(503, 'unavailable', 'The university service is unavailable. Please try again later.');
    }
  };

  return async (request: Request): Promise<Response> => {
    const requestId = randomUUID();
    const correlationId = correlationIdFor(request);
    const started = performance.now();
    const response = await handle(request, correlationId, requestId);
    response.headers.set('X-Request-Id', requestId);
    response.headers.set('X-Correlation-Id', correlationId);
    const pathname = new URL(request.url).pathname;
    const route = telemetryRoute(pathname);
    const event: GatewayTelemetryEvent = {
      event: 'institution.request',
      requestId,
      correlationId,
      method: request.method,
      route,
      status: response.status,
      durationMs: Math.max(0, Math.round(performance.now() - started)),
      errorClass: response.status >= 500 ? 'server' : response.status >= 400 ? 'client' : 'none',
    };
    try { await config.telemetry?.(event); } catch { /* observability must not rewrite the response */ }
    return response;
  };
}
