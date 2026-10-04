# Call the institution gateway

> **Type:** how-to · **Audience:** implementers, partner-developers · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/examples.test.ts`

This page walks through a typed client for the institution gateway, so you can read records and run an action safely; stop reading if you are writing the school's side of the connection, which is [Write a SIS adapter](sis-adapter.md).

**Status:** `MOCK_DEMO`. The gateway has no production adapters installed, so every real service answers 503 `adapter_not_configured` ([`docs/FEATURE-TRUTH-TABLE.md`](../../FEATURE-TRUTH-TABLE.md)). You can build and test a client today against the gateway running in-process, as the example's test does. You cannot call a school's live gateway yet.

The code is [`examples/gateway-client/client.ts`](../../../examples/gateway-client/client.ts). Every code block below is copied from it byte for byte, and `app/src/lib/docs/examples.test.ts` fails if one drifts. The wire reference is [`docs/reference/API-GATEWAY.md`](../../reference/API-GATEWAY.md); the error catalogue is [`docs/reference/ERRORS.md`](../../reference/ERRORS.md).

## 1. Authenticate every request

The gateway reads `Authorization: Bearer <token>`. It does not decode the token. It asks the auth service whether the token is valid and resolves the person's current institution and roles from server records. Your client sends the token and nothing else about identity.

| You send | The gateway answers |
| --- | --- |
| No header, or `Bearer ` with nothing after it | 401, code `unauthenticated` |
| A token the auth service does not accept | 403, code `forbidden` |
| A valid token | The request goes on |

The client takes a function, not a string, so it picks up a refreshed token on every attempt:

<!-- from: examples/gateway-client/client.ts -->
```ts
          headers: {
            authorization: `Bearer ${await options.token()}`,
            'x-correlation-id': correlationId,
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          },
```

A browser-style `Origin` header is checked: if you send one, it must equal the gateway's configured origin exactly, or you get 403 `origin_not_allowed`. A server-to-server call sends no `Origin` and skips that check.

## 2. Send a correlation id

`X-Correlation-Id` is yours to choose. The gateway keeps it if it matches `[A-Za-z0-9._:-]{8,128}` and mints its own otherwise. It echoes it back in the `X-Correlation-Id` response header and in the error envelope, and writes it to the audit row for the call. `X-Request-Id` is always minted by the gateway.

Use one id per thing a person did. The client reuses one id for the prepare, commit and reconcile of one action, and for every retry of one call. When you ask support about a failure, this is the id to quote.

## 3. Read status and records

`GET /status` lists all 37 service areas. An area with no adapter reports `not-configured`. A broken adapter reports `error` and does not fail the page.

`GET /records?area=<area>` returns one page. Pass `cursor` from the previous page's `nextCursor`, and an optional `search` (cut to 200 characters). The cursor is opaque. The client hides the loop:

<!-- from: examples/gateway-client/client.ts -->
```ts
    /** Follows `nextCursor` until the adapter says there is no more. */
    async *allRecords(area: UniversityArea, search = '') {
      let cursor: string | null = null;
      do {
        const page: RecordPage = await client.records(area, { search, cursor });
        yield* page.records;
        cursor = page.nextCursor;
      } while (cursor);
    },
```

Each record has a `version`. Send it back with any action on that record. If the record has moved, the gateway answers 409 `record_changed`.

## 4. Run an action in two phases

Nothing is done in one request. `POST /actions/prepare` returns a review and changes nothing. `POST /actions/commit` needs the review id and `confirmed: true`. Between them you show the review to a person.

The gateway runs the adapter's own check again at commit and compares it to the review the person read. If the answer changed, it refuses with 409 `review_changed`. A review expires after 10 minutes (410 `review_expired`).

`runAction` is the whole flow, with the part that matters most for an integrator, the 502:

<!-- from: examples/gateway-client/client.ts -->
```ts
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
```

Two facts the test proves:

- **Commit is safe to repeat.** A second `commit` for a completed review returns the stored receipt and executes nothing. If a commit answer is lost on the way back, send it again.
- **A 502 is not safe to resubmit.** The gateway failed to confirm the outcome, so the school may have acted. Call `/actions/reconcile`, which asks the adapter what happened without repeating it. If the adapter has no answer yet, the gateway answers 409 `outcome_uncertain`; wait and ask again.

## 5. Read the error envelope

Every refusal has one shape:

<!-- from: packages/platform/src/gateway/errors.ts -->
```ts
export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    correlation_id: string;
    retryable: boolean;
    user_action?: UserAction;
  };
  message: string;
}
```

The top-level `message` repeats the same sentence, for a client written before the envelope existed.

The client turns it into a thrown `GatewayError`:

<!-- from: examples/gateway-client/client.ts -->
```ts
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
```

Switch on `code`, not on the message. A selection of codes the gateway sends:

| Code | Status | Meaning | Retry |
| --- | --- | --- | --- |
| `unauthenticated` | 401 | No usable bearer token | No |
| `forbidden` | 403 | The token is not accepted | No |
| `connection_forbids` | 403 | The adapter reports the connection is not live, or cannot write | No |
| `adapter_not_configured` | 503 | No adapter is installed for this institution and area | Flag says yes; it will not succeed until a school installs one |
| `refused` | 400 | The adapter refused, with a sentence meant for the person. Nothing was written | No |
| `record_changed` | 409 | The record's version moved since you read it | No; read again and prepare again |
| `review_expired` | 410 | More than 10 minutes since prepare | No; prepare again |
| `review_changed` | 409 | The adapter's review differs from what was shown | No; prepare again |
| `review_refused` | 409 | The action was refused earlier | No; prepare again |
| `rate_limited` | 429 | Too many requests | Yes |
| `read_only` | 503 | The gateway is in maintenance read-only mode; reads still work | Yes |
| `outcome_uncertain` | 502 | `commit` could not confirm the result | **No. Reconcile** |
| `outcome_uncertain` | 409 | `reconcile` found no answer yet | No; ask again later |

A refusal from an adapter arrives like this. The message is the adapter's own sentence:

<!-- output: gateway-client/refusal -->
```json
{
  "error": {
    "code": "refused",
    "message": "A hold on your account blocks booking. Clear it with the registrar first.",
    "correlation_id": "demo-correlation-4",
    "retryable": false
  },
  "message": "A hold on your account blocks booking. Clear it with the registrar first."
}
```

And an unknown outcome, with the `user_action` the gateway attaches:

<!-- output: gateway-client/uncertain -->
```json
{
  "error": {
    "code": "outcome_uncertain",
    "message": "The result could not be confirmed. Ask the institution to reconcile this action before submitting again.",
    "correlation_id": "demo-correlation-3",
    "retryable": false,
    "user_action": {
      "label": "Ask the institution to reconcile",
      "kind": "contact_support"
    }
  },
  "message": "The result could not be confirmed. Ask the institution to reconcile this action before submitting again."
}
```

Anything the adapter throws that is not a deliberate refusal is flattened to a 503 `unavailable` with one generic sentence. The adapter's real error text never reaches you.

## 6. Retry only what is retryable

`retryable` is true for exactly two statuses, 429 and 503. The flag is the rule: the client retries on the flag and never on the status code. A 502 is never retryable.

<!-- from: examples/gateway-client/client.ts -->
```ts
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
```

What the test shows about this:

- The delays are 250, 500, 1000 milliseconds, doubling to a cap of 8000, and no sleep follows the last attempt.
- **The gateway sets no `Retry-After` header.** The test reads a real 429 and finds none. The client honours one in seconds if something in front of the gateway adds it. If you rely on it, confirm your proxy sends it.
- The default is 4 attempts in total.
- During read-only mode a write is refused 503 `read_only` and retried; reads and `/actions/reconcile` are not blocked.

## Try it

```bash
cd app
npx vitest run src/lib/docs/examples.test.ts -t "gateway-client"
```

## Next

- [Write a SIS adapter](sis-adapter.md): the other side of every call on this page.
- [Which integration path do I want?](which-integration-path.md)
- [`docs/reference/API-GATEWAY.md`](../../reference/API-GATEWAY.md) and [`docs/reference/ERRORS.md`](../../reference/ERRORS.md) for the full wire and error references.
