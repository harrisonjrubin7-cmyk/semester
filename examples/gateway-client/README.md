# Example: gateway client

> **Type:** reference · **Audience:** implementers, partner-developers · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/examples.test.ts`

A typed client for the institution gateway, for developers who call it; stop reading if you are writing the school's side (see [`sis-adapter`](../sis-adapter/README.md)).

**Status:** `MOCK_DEMO`. The gateway has no production adapters, so every real service answers 503. This client runs in the test against the real gateway with one fake adapter.

## What is here

| File | Purpose |
| --- | --- |
| [`client.ts`](client.ts) | `createClient`, `GatewayError` and the `runAction` flow. Takes any `Request` to `Response` function as its transport. |

## What it does

- Sends `Authorization: Bearer <token>` on every call. The gateway validates the token itself; the client never decodes it.
- Sends an `X-Correlation-Id` on every call and reuses it across the retries and the prepare, commit and reconcile of one action.
- Reads `/status` and pages `/records` by `nextCursor`.
- Runs an action in two phases. `prepare` returns a review and changes nothing; `commit` needs the review id and `confirmed: true`.
- After a 502 `outcome_uncertain` it calls `/actions/reconcile` and does not submit again.
- Turns every refusal into a `GatewayError` with `status`, `code`, `correlationId`, `retryable` and `userAction`.
- Retries only when the envelope says `retryable: true` (a 429 or 503), with exponential delay, or the `Retry-After` seconds if a response carries that header.

## What it does not do

- The gateway sends no `Retry-After` header. The client honours one for a proxy that adds it, and the test proves both facts.
- It reads `Retry-After` as a number of seconds only, not an HTTP date.
- It does not refresh tokens. Pass `token: () => ...` and return a current one.
- It does not cover `/v1/intelligence/*`, `/health` or `/v1/auth/config`.

## Run it and read it

```bash
cd app
npx vitest run src/lib/docs/examples.test.ts -t "gateway-client"
```

Walk-through: [Call the institution gateway](../../docs/guides/integrations/gateway-client.md).
