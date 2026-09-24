import { randomUUID } from 'node:crypto';
import {
  UNIVERSITY_AREAS,
  isRefusal,
  isUniversityArea,
  parseAction,
  validateActionFields,
  type ActionInput,
  type UniversityArea,
  type UniversityIdentity,
} from '../../../packages/institution/src/index.ts';
import type { AdapterContext, InstitutionAdapter } from './adapter.ts';
import type { ActionJournal } from './journal.ts';
import type { IntelligenceService } from './intelligence.ts';

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
 */

interface Config {
  origin: string;
  institutionName: string;
  authenticate: (token: string) => Promise<UniversityIdentity | null>;
  refreshIdentity?: (identity: UniversityIdentity, token: string) => Promise<UniversityIdentity | null>;
  adapters: InstitutionAdapter[];
  journal: ActionJournal;
  intelligence?: IntelligenceService;
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/*
 * A declaration rather than a const arrow, deliberately: TypeScript only
 * narrows control flow through a `never`-returning call when the callee is a
 * function declaration (or a const with an explicit type annotation). As an
 * arrow, every `fail(...)` guard below would still leave its subject nullable.
 */
function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}

/** Requests per minute, per account. */
const RATE = { window: 60_000, max: 60 } as const;
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

export function createGateway(config: Config) {
  /*
   * Adapters are installed modules, keyed by the tenant they belong to.
   *
   * Built once, from the array. A request can name an *area*, and the tenant
   * comes from the verified identity — so there is no input anywhere that
   * selects which adapter runs.
   */
  const installed = new Map(config.adapters.map((a) => [`${a.institutionId}:${a.area}`, a]));
  const limits = new Map<string, { until: number; count: number }>();

  return async (request: Request): Promise<Response> => {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      Vary: 'Origin',
    });

    /*
     * One exact origin, echoed only when it matches.
     *
     * Never `*`: these responses carry somebody's university records, and a
     * wildcard would let any page that can get a token read them.
     */
    const origin = request.headers.get('origin');
    if (origin && origin !== config.origin) {
      return new Response(JSON.stringify({ error: 'This origin is not allowed.' }), { status: 403, headers });
    }
    if (origin) headers.set('Access-Control-Allow-Origin', origin);
    if (request.method === 'OPTIONS') {
      headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
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
      if (request.method === 'GET' && path === '/health') {
        const ready = config.journal.healthy();
        return Response.json(
          {
            service: 'Semester university gateway',
            version: 1,
            status: ready ? 'ready' : 'unavailable',
            adapters: config.adapters.length,
            intelligence: config.intelligence?.status ?? 'policy-disabled',
          },
          { status: ready ? 200 : 503, headers },
        );
      }
      if (!['GET', 'POST'].includes(request.method)) fail(405, 'Method not supported.');

      const token = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') || '')?.[1];
      if (!token) fail(401, 'Sign in to your school-approved Semester account.');

      const authenticated = await config.authenticate(token);
      if (!authenticated) fail(403, 'No verified university access is assigned to this account.');
      let who: UniversityIdentity = authenticated;

      const now = Date.now();
      for (const [id, limit] of limits) if (limit.until < now) limits.delete(id);
      const key = `${who.institutionId}:${who.userId}`;
      const limit = limits.get(key) ?? { until: now + RATE.window, count: 0 };
      if (++limit.count > RATE.max) fail(429, 'Please wait a minute before trying again.');
      limits.set(key, limit);

      const context: AdapterContext = { identity: who, signal: AbortSignal.timeout(20_000) };

      const intelligenceConfirm = /^\/v1\/intelligence\/actions\/([^/]+)\/confirm$/.exec(path);
      if (request.method === 'GET' && path === '/v1/intelligence/policy') {
        if (!config.intelligence) return Response.json({ code: 'policy-disabled', message: 'Semester Intelligence is not configured for this gateway.' }, { status: 503, headers });
        const response = await config.intelligence.policy(who);
        return Response.json(response.body, { status: response.status, headers });
      }
      if (
        request.method === 'POST' &&
        (path === '/v1/intelligence/respond' || intelligenceConfirm)
      ) {
        if (!config.intelligence) {
          return Response.json(
            { code: 'policy-disabled', message: 'Semester Intelligence is not configured for this gateway.' },
            { status: 503, headers },
          );
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
        }
        const response = path === '/v1/intelligence/respond'
          ? await config.intelligence.respond(who, value)
          : await config.intelligence.confirm(who, decodeURIComponent(intelligenceConfirm![1]), value);
        return Response.json(response.body, { status: response.status, headers });
      }

      /** The adapter for an area, if it exists and currently permits this. */
      const adapterFor = async (area: UniversityArea, write = false) => {
        const adapter = installed.get(`${who.institutionId}:${area}`);
        if (!adapter) fail(503, 'An approved university connection is not configured for this service.');
        const status = await adapter.status(context);
        if (status.state !== 'connected' || !status.canRead || (write && !status.canWrite)) {
          fail(403, 'This connection does not permit that action.');
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
          fail(409, 'This record changed. Refresh it and review your action again.');
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
        config.journal.audit(who, area, 'records.read');
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
        config.journal.save({ review, input, identity: who, state: 'ready' });
        config.journal.audit(who, input.area, 'action.prepared', review.id);
        return Response.json(review, { headers });
      }

      const asked = body as { reviewId?: unknown; confirmed?: unknown };
      // Commit needs an explicit `true`. Nothing else counts as confirmation.
      if (!asked || (path === '/actions/commit' && asked.confirmed !== true) || typeof asked.reviewId !== 'string') {
        fail(400, 'Confirm the reviewed action before continuing.');
      }
      const row = config.journal.get(asked.reviewId as string, who);
      if (!row) fail(404, 'Review not found for this account.');

      // Already done: hand back the same receipt rather than doing anything.
      if (row.state === 'completed') return Response.json(row.receipt, { headers });

      // Terminal, and there is nothing to look up: it was answered by a
      // refusal, not left hanging. Said before the two generic 409s below,
      // both of which would tell the person to reconcile it.
      if (row.state === 'refused') fail(409, 'This action was refused. Prepare a new review.');

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
          fail(409, 'The school has not confirmed the result yet. Do not submit it again.');
        }
        config.journal.finish(row, result.status === 'pending' ? 'pending' : 'completed', result);
        config.journal.audit(who, row.input.area, 'action.reconciled', row.review.id);
        return Response.json(result, { headers });
      }

      if (row.state === 'pending') return Response.json(row.receipt, { headers });
      if (row.state !== 'ready') {
        fail(409, 'This action is processing or needs reconciliation. Do not submit it again.');
      }
      if (Date.parse(row.review.expiresAt) <= now) {
        fail(410, 'Review expired. Refresh and review the action again.');
      }

      if (config.refreshIdentity) {
        const current = await config.refreshIdentity(who, token);
        if (!current || current.userId !== who.userId || current.institutionId !== who.institutionId) {
          fail(403, 'Your current university access does not permit this action.');
        }
        who = current;
        context.identity = current;
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
        fail(409, 'The action details changed. Prepare a new review.');
      }

      if (!config.journal.claim(row.review.id, who, Date.now())) {
        fail(409, 'This action was already claimed or expired.');
      }

      try {
        config.journal.audit(who, row.input.area, 'action.started', row.review.id);
        const receipt = await adapter.execute(context, row.input, row.review.id);
        if (!receipt.id || !['completed', 'pending'].includes(receipt.status) || !receipt.recordedAt) {
          throw new Error('Invalid upstream receipt.');
        }
        config.journal.finish(row, receipt.status === 'pending' ? 'pending' : 'completed', receipt);
        config.journal.audit(who, row.input.area, 'action.receipt', row.review.id);
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
          config.journal.finish(row, 'refused');
          config.journal.audit(who, row.input.area, 'action.refused', row.review.id);
          return fail(400, e.message);
        }
        /*
         * The one place this gateway refuses to guess.
         *
         * The school may have acted. Marking it failed could have somebody
         * pay twice; marking it done could have them miss a deadline. So it
         * is marked unknown, and only `/actions/reconcile` can resolve it.
         */
        config.journal.finish(row, 'uncertain');
        config.journal.audit(who, row.input.area, 'action.uncertain', row.review.id);
        return fail(
          502,
          'The result could not be confirmed. Ask the institution to reconcile this action before submitting again.',
        );
      }
    } catch (e) {
      /*
       * Three kinds of thrown thing, and the middle one used to be lost.
       *
       * An `HttpError` is something this gateway meant to say. A `Refusal` is
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
      if (isRefusal(e)) return Response.json({ error: e.message }, { status: 400, headers });
      return Response.json(
        { error: e instanceof HttpError ? e.message : 'The university service is unavailable. Please try again later.' },
        { status: e instanceof HttpError ? e.status : 503, headers },
      );
    }
  };
}
