// A typed client for the institution gateway. Node 22, no dependencies.
// Run through its test: cd app && npx vitest run src/lib/docs/examples.test.ts
import type {
  ActionInput,
  InstitutionStatus,
  Receipt,
  RecordPage,
  Review,
  UniversityArea,
} from '../../packages/institution/src/index.ts';

/** Anything that turns a Request into a Response. `fetch` fits; so does a gateway handler. */
export type Transport = (request: Request) => Promise<Response>;

export interface ClientOptions {
  baseUrl: string;
  /** Called per request, so a refreshed token is picked up without rebuilding the client. */
  token: () => string | Promise<string>;
  transport?: Transport;
  /** Injected so tests do not wait. Defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
  /** Total tries for a retryable refusal. Default 4. */
  maxAttempts?: number;
}

/** The gateway's error envelope, as a thrown value. */
export class GatewayError extends Error {
  status: number;
  code: string;
  correlationId: string;
  retryable: boolean;
  userAction?: { label: string; kind: string; href?: string };
  retryAfterMs: number | null;
  constructor(status: number, body: any, retryAfterMs: number | null) {
    const e = body?.error ?? {};
    super(e.message ?? body?.message ?? `HTTP ${status}`);
    this.status = status;
    this.code = e.code ?? 'error';
    this.correlationId = e.correlation_id ?? '';
    this.retryable = e.retryable === true;
    this.userAction = e.user_action;
    this.retryAfterMs = retryAfterMs;
  }
}

/** What `runAction` reports. `unknown` means: do not submit again, ask the institution. */
export type ActionResult =
  | { state: 'declined'; review: Review }
  | { state: 'done'; receipt: Receipt; reconciled: boolean }
  | { state: 'unknown'; reviewId: string };

export function createClient(options: ClientOptions) {
  const transport: Transport = options.transport ?? ((request) => fetch(request));
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const maxAttempts = options.maxAttempts ?? 4;

  // One id per logical operation, reused on every retry of it.
  const send = async <T>(method: 'GET' | 'POST', path: string, body: unknown, correlationId: string): Promise<T> => {
    for (let attempt = 1; ; attempt++) {
      const response = await transport(
        new Request(new URL(path, options.baseUrl), {
          method,
          headers: {
            authorization: `Bearer ${await options.token()}`,
            'x-correlation-id': correlationId,
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
      );
      if (response.ok) return (await response.json()) as T;

      const header = response.headers.get('retry-after');
      const seconds = header === null ? NaN : Number(header);
      const error = new GatewayError(
        response.status,
        await response.json().catch(() => null),
        Number.isFinite(seconds) ? seconds * 1000 : null,
      );
      // Trust the flag, not the status: a 502 is never retryable, whatever it looks like.
      if (!error.retryable || attempt >= maxAttempts) throw error;
      await sleep(error.retryAfterMs ?? Math.min(250 * 2 ** (attempt - 1), 8000));
    }
  };

  const newId = () => crypto.randomUUID();
  const client = {
    status: (id: string = newId()) => send<InstitutionStatus>('GET', '/status', undefined, id),

    records: (area: UniversityArea, query: { search?: string; cursor?: string | null } = {}, id: string = newId()) => {
      const params = new URLSearchParams({ area });
      if (query.search) params.set('search', query.search);
      if (query.cursor) params.set('cursor', query.cursor);
      return send<RecordPage>('GET', `/records?${params}`, undefined, id);
    },

    /** Follows `nextCursor` until the adapter says there is no more. */
    async *allRecords(area: UniversityArea, search = '') {
      let cursor: string | null = null;
      do {
        const page: RecordPage = await client.records(area, { search, cursor });
        yield* page.records;
        cursor = page.nextCursor;
      } while (cursor);
    },

    prepare: (input: ActionInput, id: string = newId()) => send<Review>('POST', '/actions/prepare', input, id),
    commit: (reviewId: string, id: string = newId()) =>
      send<Receipt>('POST', '/actions/commit', { reviewId, confirmed: true }, id),
    reconcile: (reviewId: string, id: string = newId()) => send<Receipt>('POST', '/actions/reconcile', { reviewId }, id),

    /**
     * Prepare, show the review to a person, commit only if they say yes.
     * Never resubmits: after a 502 it asks the gateway what happened.
     */
    async runAction(input: ActionInput, confirm: (review: Review) => Promise<boolean>): Promise<ActionResult> {
      const id = newId(); // prepare, commit and reconcile share one correlation id
      const review = await client.prepare(input, id);
      if (!(await confirm(review))) return { state: 'declined', review };
      try {
        return { state: 'done', receipt: await client.commit(review.id, id), reconciled: false };
      } catch (e) {
        if (!(e instanceof GatewayError) || e.status !== 502) throw e;
      }
      try {
        return { state: 'done', receipt: await client.reconcile(review.id, id), reconciled: true };
      } catch (e) {
        // 409 outcome_uncertain: the institution has not said yet. Wait; do not prepare again.
        if (e instanceof GatewayError && e.code === 'outcome_uncertain') return { state: 'unknown', reviewId: review.id };
        throw e;
      }
    },
  };
  return client;
}
