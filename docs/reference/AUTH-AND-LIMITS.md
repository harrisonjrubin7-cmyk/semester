# Gateway authentication and limits

> **Type:** reference · **Audience:** partner-developers, implementers · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/gateway-reference.test.ts`

This page says how the institution gateway decides who is calling, which limits it enforces, and which environment variables configure it. Stop reading if you are not deploying or calling the gateway.

The gateway is MOCK_DEMO in the [feature truth table](../FEATURE-TRUTH-TABLE.md): the controls below are implemented and tested, and no production adapter sits behind them. This page describes controls. It makes no statement about legal or regulatory status; counsel review is pending where the [registers](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) say so.

Related: [routes](API-GATEWAY.md), [error codes](ERRORS.md), [SCIM](SCIM-API.md).

## The order of checks

Every request to the gateway goes through these steps in this order. The first that refuses ends the request.

1. **Origin.** A request with an `Origin` header that is not exactly the configured origin: `403 origin_not_allowed`. A request with no `Origin` header (a server, or `curl`) is not refused here.
2. **Preflight.** `OPTIONS` on any path: `204` with the CORS headers, no authentication.
3. **Unauthenticated routes.** `GET /health/live`, `GET /health`, `GET /health/ready` and `GET /v1/auth/config` answer now, without a token and without touching the rate limit.
4. **Method.** Anything other than `GET` or `POST`: `405 method_not_supported`. This comes before the token check.
5. **Token present.** The `Authorization` header must be exactly `Bearer <token>` with no spaces in the token. Otherwise `401 unauthenticated`.
6. **Identity.** The token is validated and turned into an identity. No identity: `403 forbidden`.
7. **Rate limit.** Over the limit: `429 rate_limited`.
8. **Read-only mode.** A `POST` to anything but `/actions/reconcile` while read-only mode is on: `503 read_only`.
9. **The route.** Content type, size, JSON, then the route's own checks ([API-GATEWAY.md](API-GATEWAY.md)).

Anything unexpected that is thrown anywhere in steps 5 to 9 becomes `503 unavailable` with one fixed sentence. The thrown message is never repeated, because it could carry a connection string or another person's data.

<!-- example:no-token -->
**Request**

```bash
curl -s 'http://127.0.0.1:8787/status' \
  -H 'X-Correlation-Id: docs-example-0015'
```

**Response** `401`

```json
{
  "error": {
    "code": "unauthenticated",
    "message": "Sign in to your school-approved Semester account.",
    "correlation_id": "docs-example-0015",
    "retryable": false
  },
  "message": "Sign in to your school-approved Semester account."
}
```
<!-- /example -->

<!-- example:unknown-token -->
**Request**

```bash
curl -s 'http://127.0.0.1:8787/status' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'X-Correlation-Id: docs-example-0016'
```

**Response** `403`

```json
{
  "error": {
    "code": "forbidden",
    "message": "No verified university access is assigned to this account.",
    "correlation_id": "docs-example-0016",
    "retryable": false
  },
  "message": "No verified university access is assigned to this account."
}
```
<!-- /example -->

## Authentication

The gateway never trusts anything the client says about who it is. Three facts are used, and none comes from the request body, a header other than `Authorization`, or the browser:

- **The token.** A Supabase Auth access token, sent as `Authorization: Bearer <token>`. The gateway does not decode it. It asks the auth service about it (`auth.getUser`) on every request, so a revoked token or a deleted account stops working at once. The client used for this keeps no session and refreshes nothing.
- **The sign-in route.** The validated user must have signed in through a single sign-on provider: `app_metadata.provider` must start with `sso:` and the user must have an email address. A user who signed in another way has no identity here.
- **A current membership.** `membership.ts` looks up the provider by its identifier and requires exactly one, with status `authorized`. It then requires exactly one membership for that user, tenant and provider, with status `active`, and roles that are all in the [role list](API-GATEWAY.md#roles). If the user has no membership yet, the lookup tries to bind one by user name through the database function `bind_institution_sso_membership`. Every outcome, accepted or denied, is written to the process log as an `institution.authorization` JSON line with a reason such as `missing-provider`, `ambiguous-membership` or `membership-not-active`. The reason is not returned to the caller.

The result is an identity of three fields: `userId`, `institutionId` and `roles`. The institution id picks the adapter, so there is no request input that selects an adapter. `user_metadata` and a stale `app_metadata.semester` role claim play no part. `trustedIdentity` in `auth.ts`, which reads `app_metadata.semester`, is a fixture helper for tests; neither entry point calls it.

Both entry points re-run the token check at the moment of a commit (and of an intelligence confirm) and require the same user and institution as before. If the answer changed, the commit is `403 forbidden` ("Your current university access does not permit this action.").

With `SEMESTER_AUTH_URL`, `SEMESTER_AUTH_PUBLIC_KEY` and `SEMESTER_AUTH_SERVICE_KEY` unset, `start.ts` authenticates nobody: a request without a bearer token is `401`, and a request with one is `403`. The Vercel runtime refuses to build without all three and answers `503` to every request ([errors outside the envelope](ERRORS.md#errors-outside-the-envelope)).

### Single sign-on configuration

`GET /v1/auth/config` tells a sign-in screen whether to offer single sign-on. It needs no token. It answers `{"enabled": true, "label": …, "domain": …}` only when `SEMESTER_SSO_DOMAIN` and `SEMESTER_SSO_LABEL` are both set and exactly one authorized provider lists that domain; otherwise `{"enabled": false}`. A failure of the lookup is also `{"enabled": false}`. See [API-GATEWAY.md](API-GATEWAY.md#health-and-sign-in-configuration) for the example.

### SCIM credentials

SCIM does not use the Supabase token. It has its own bearer credential, checked in `scim.ts`: see [SCIM-API.md](SCIM-API.md#authentication).

## CORS

The gateway allows one origin: the value of `SEMESTER_APP_ORIGIN`. Never `*`, because the responses carry a person's university records. The value must be an exact origin: `https://…`, or `http://` for `localhost` or `127.0.0.1` only, with no path, no trailing slash and no credentials. A bad value stops `start.ts` at startup and makes every Vercel request `503`.

- A request whose `Origin` matches gets `Access-Control-Allow-Origin: <that origin>` and `Access-Control-Expose-Headers: X-Request-Id, X-Correlation-Id`.
- A request whose `Origin` differs is refused before anything else.
- A preflight (`OPTIONS`, any path) adds `Access-Control-Allow-Headers: Authorization, Content-Type, X-Correlation-Id` and `Access-Control-Allow-Methods: GET, POST, OPTIONS`.
- There is no `Access-Control-Allow-Credentials`, no `Access-Control-Max-Age` and no cookie. The token travels in the `Authorization` header.
- `Vary: Origin` is always set.

<!-- example:wrong-origin -->
**Request**

```bash
curl -s 'http://127.0.0.1:8787/status' \
  -H 'Origin: https://other.example' \
  -H 'X-Correlation-Id: docs-example-0017'
```

**Response** `403`

```http
cache-control: no-store
content-type: application/json
vary: Origin
x-content-type-options: nosniff
x-correlation-id: docs-example-0017
x-request-id: 00000000-0000-4000-8000-000000000004
```

```json
{
  "error": {
    "code": "origin_not_allowed",
    "message": "This origin is not allowed.",
    "correlation_id": "docs-example-0017",
    "retryable": false
  },
  "message": "This origin is not allowed."
}
```
<!-- /example -->

<!-- example:preflight -->
**Request**

```bash
curl -s -X OPTIONS 'http://127.0.0.1:8787/records' \
  -H 'Origin: http://localhost:5173' \
  -H 'X-Correlation-Id: docs-example-0023'
```

**Response** `204` No Content

```http
access-control-allow-headers: Authorization, Content-Type, X-Correlation-Id
access-control-allow-methods: GET, POST, OPTIONS
access-control-allow-origin: http://localhost:5173
access-control-expose-headers: X-Request-Id, X-Correlation-Id
cache-control: no-store
content-type: application/json
vary: Origin
x-content-type-options: nosniff
x-correlation-id: docs-example-0023
x-request-id: 00000000-0000-4000-8000-000000000005
```

No body.
<!-- /example -->

<!-- example:cors-simple -->
**Request**

```bash
curl -s 'http://127.0.0.1:8787/health/live' \
  -H 'Origin: http://localhost:5173' \
  -H 'X-Correlation-Id: docs-example-0024'
```

**Response** `200` OK

```http
access-control-allow-origin: http://localhost:5173
access-control-expose-headers: X-Request-Id, X-Correlation-Id
cache-control: no-store
content-type: application/json
vary: Origin
x-content-type-options: nosniff
x-correlation-id: docs-example-0024
x-request-id: 00000000-0000-4000-8000-000000000006
```

```json
{
  "service": "Semester university gateway",
  "version": 1,
  "status": "live"
}
```
<!-- /example -->

## Correlation and request ids

Every response carries two ids.

| Header | Source | Meaning |
| --- | --- | --- |
| `X-Request-Id` | Minted by the gateway, once per request. Never taken from the client. | Identifies this one request in logs. |
| `X-Correlation-Id` | Yours if you sent a well-formed one, otherwise a new UUID. | Follows one person's action from the tap through this request, its audit rows, its telemetry line and a support ticket. |

A correlation id is well formed when it matches `^[A-Za-z0-9._:-]{8,128}$`. The pattern is shared with the audit column, so nothing accepted here is refused there, and nothing outside it (a sentence, a script, four kilobytes) reaches a log line. A malformed id is replaced silently, not rejected. The error envelope's `error.correlation_id` is the same value as the `X-Correlation-Id` header. Both ids are set on every gateway response, including `204` and errors. They are not set on the Vercel entry's own flat `413` and `503` bodies, which are written before the gateway runs.

## Rate limiting

The limit counts requests per signed-in person: the key is the institution id and the user id. The default policy is 60 requests per 60 seconds, a fixed window that starts at a person's first request. The 61st request in a window is `429 rate_limited` with `retryable: true`.

- The count includes every request that passes authentication, including ones that then fail with 400, 404 or 409. It does not include the four unauthenticated routes, requests refused for origin or method, or requests without a valid token.
- The gateway sends no `Retry-After` header and no rate-limit headers. Wait a minute.
- Standalone `start.ts` counts in memory, per process, unless `SEMESTER_GATEWAY_STORE=postgres`. The Vercel runtime always uses the shared Postgres counter, so the limit holds across instances. The Postgres counter validates its policy: a window from 1 second to 1 hour and a maximum from 1 to 10,000. Neither entry point lets you set the policy by environment variable; both use the default.
- The Postgres limiter fails closed. If the counter cannot be read, the request is answered as rate limited rather than let through.
- SCIM has its own bucket per credential on the same counter: [SCIM-API.md](SCIM-API.md#rate-limit).

<!-- example:rate-limited -->
**Request**

```bash
curl -s 'http://127.0.0.1:8787/status' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'X-Correlation-Id: docs-example-0030'
```

**Response** `429`

```http
cache-control: no-store
content-type: application/json
vary: Origin
x-content-type-options: nosniff
x-correlation-id: docs-example-0030
x-request-id: 00000000-0000-4000-8000-000000000001
```

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Please wait a minute before trying again.",
    "correlation_id": "docs-example-0030",
    "retryable": true
  },
  "message": "Please wait a minute before trying again."
}
```
<!-- /example -->

The health routes are exempt:

<!-- example:rate-limit-health-exempt -->
**Request**

```bash
curl -s 'http://127.0.0.1:8787/health/live' \
  -H 'X-Correlation-Id: docs-example-0031'
```

**Response** `200` OK

```json
{
  "service": "Semester university gateway",
  "version": 1,
  "status": "live"
}
```
<!-- /example -->

## Sizes, content types and timeouts

| Limit | Value | Where it applies |
| --- | --- | --- |
| Request body | 128,000 bytes | The standalone server and the Vercel entry stop reading at this size and answer a flat `413`. The gateway checks the same number again and answers `413 too_large` in the envelope. The two limits are one constant, `MAX_BODY`. |
| Content type | `application/json` (a `; charset=` suffix is accepted) | POST routes of the gateway. Other types: `415 unsupported_media_type`. SCIM does not check the content type of a request. |
| Free-text search | 200 characters | `search` on `/records`; longer values are cut. |
| Cursor | 500 characters | `cursor` on `/records`; longer values are cut. |
| Review lifetime | 10 minutes | From prepare to commit. |
| Adapter call | 20 seconds | Each request gives its adapters one abort signal that fires 20 seconds after the request reached the route stage. |
| Vercel function | 30 seconds | `maxDuration` in `app/vercel.json`. |
| Standalone server | `requestTimeout` 30 s, `headersTimeout` 10 s | `start.ts`. It listens on `127.0.0.1` only. |
| Standalone port | 8787 | Default of `SEMESTER_GATEWAY_PORT`. |

<!-- example:not-json-type -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/prepare' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: text/plain' \
  -H 'X-Correlation-Id: docs-example-0020' \
  -d '{}'
```

**Response** `415`

```json
{
  "error": {
    "code": "unsupported_media_type",
    "message": "Send JSON.",
    "correlation_id": "docs-example-0020",
    "retryable": false
  },
  "message": "Send JSON."
}
```
<!-- /example -->

The `413` and `415` examples are in [ERRORS.md](ERRORS.md#examples).

## Read-only mode

Read-only mode lets an operator freeze writes for maintenance while reads go on. When it is on, every `POST` except `/actions/reconcile` is refused with `503 read_only`, `retryable: true`, after authentication and the rate limit and before any route runs. Nothing is sent to an adapter. `GET /health` reports `"readOnly": true` so a runbook step can confirm it with a call.

Reconcile stays open on purpose. It does not act at the institution; it asks what already happened to an action whose outcome is unknown. Refusing it would leave that person's action stuck at `uncertain` for the whole window.

Read-only mode is wired only into `start.ts`. It reads `SEMESTER_READ_ONLY` on every request, accepts `on` in any letter case with surrounding spaces removed, and needs no restart to end. The Vercel runtime does not read `SEMESTER_READ_ONLY`, so on that entry point the variable has no effect. The test holds this; if the runtime is wired later, update this page and [`FEATURE-FLAG-REGISTRY.md`](../FEATURE-FLAG-REGISTRY.md), which currently names only `start.ts`.

<!-- example:read-only-prepare -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/prepare' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0025' \
  -d '{"area":"courses","recordId":"sandbox-101","version":"1","actionId":"enrol","fields":{}}'
```

**Response** `503`

```json
{
  "error": {
    "code": "read_only",
    "message": "Semester is in read-only mode for maintenance. Nothing was sent; try again later.",
    "correlation_id": "docs-example-0025",
    "retryable": true
  },
  "message": "Semester is in read-only mode for maintenance. Nothing was sent; try again later."
}
```
<!-- /example -->

<!-- example:read-only-health -->
**Request**

```bash
curl -s 'http://127.0.0.1:8787/health'
```

**Response** `200` OK

```json
{
  "service": "Semester university gateway",
  "version": 1,
  "status": "ready",
  "adapters": 16,
  "intelligence": "policy-disabled",
  "readOnly": true
}
```
<!-- /example -->

<!-- example:read-only-reconcile -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/reconcile' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0027' \
  -d '{"reviewId":"00000000-0000-4000-8000-000000000001"}'
```

**Response** `200` OK

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "status": "completed",
  "message": "SANDBOX · Enrolled. Nothing here reaches a real institution.",
  "recordedAt": "2026-10-04T12:00:00.000Z"
}
```
<!-- /example -->

## Telemetry and audit

**Telemetry.** After every response the gateway builds one `institution.request` event and passes it to the `telemetry` callback if there is one. A failing callback is ignored and never changes the response. The Vercel runtime supplies a callback that writes the event as a JSON line to the process log. `start.ts` supplies none. The event fields are `event`, `requestId`, `correlationId`, `method`, `route`, `status`, `durationMs` and `errorClass` (`none` below 400, `client` for 400 to 499, `server` from 500). `route` is one of a fixed set, so a client cannot put its own text into a log line:

`/health`, `/health/live`, `/health/ready`, `/v1/auth/config`, `/v1/intelligence/policy`, `/v1/intelligence/respond`, `/status`, `/records`, `/actions/prepare`, `/actions/commit`, `/actions/reconcile`, `/v1/intelligence/actions/:id/confirm`, and `/unmatched` for everything else.

The event carries no token, no body and no record content.

**Audit.** The journal records an audit row, with the correlation id, for these events:

`records.read`, `action.prepared`, `action.started`, `action.receipt`, `action.refused`, `action.reconciled`, `action.uncertain`.

An audit row names the person, the area, the event, the review id and the correlation id. It holds no field values. Retention periods are not stated here: the SQLite journal's are constants in `journal.ts`, and the Postgres journal's were not read for this page.

## Environment variables

Names only. Values are secrets or deployment choices and never belong in the repository. "Both" means both `start.ts` and the Vercel runtime read it.

| Variable | Read by | Effect |
| --- | --- | --- |
| `SEMESTER_APP_ORIGIN` | Both | The one allowed browser origin. `start.ts` defaults to `http://localhost:5173`; the Vercel runtime has no default and fails without it. |
| `SEMESTER_AUTH_URL` | Both | The Supabase project the gateway validates tokens against and stores its journal in. |
| `SEMESTER_AUTH_PUBLIC_KEY` | Both | The public key used to ask the auth service about a token. |
| `SEMESTER_AUTH_SERVICE_KEY` | Both | The server-only service key for membership lookups, SSO configuration, the Postgres journal and limiter, and SCIM. Never use a `VITE_` name for it. |
| `SEMESTER_JOURNAL_KEY` | Both | 32 random bytes as 64 hex characters. Encrypts journal rows. Both refuse to start without it. |
| `SEMESTER_INSTITUTION_NAME` | Both | The name returned by `/status`. Default "Your university". Ignored while the sandbox is on. |
| `SEMESTER_SSO_DOMAIN` | Both | With the label, enables the `enabled: true` answer of `/v1/auth/config`. |
| `SEMESTER_SSO_LABEL` | Both | The label shown for single sign-on. |
| `SEMESTER_AI_PROVIDERS` | Both | Comma-separated model ids, all starting `openai:`. Any other prefix leaves intelligence policy-disabled. |
| `OPENAI_API_KEY` | Both | The provider key. Intelligence stays policy-disabled without it. |
| `SEMESTER_AI_MAX_REQUEST_CENTS` | Both | Per-request cost ceiling. Must be above 0. |
| `SEMESTER_AI_ESTIMATED_REQUEST_CENTS` | Both | Estimated cost per request. Must be 0 or more and not above the ceiling. |
| `SEMESTER_AI_RUNTIME_STATUS` | Both | `production` reports `configured-production`; anything else reports `configured-sandbox`. |
| `SEMESTER_MINIMUM_ADAPTERS` | Vercel runtime | Readiness needs at least this many adapters. Default 1. Must be a non-negative integer. |
| `SEMESTER_MONITORING_READY` | Vercel runtime | `1` tells readiness that monitoring is configured. |
| `SEMESTER_INTEGRATIONS_READY` | Vercel runtime | `1` tells readiness that integrations are healthy. Needed when the minimum is above 0. |
| `SEMESTER_REQUIRE_AI` | Vercel runtime | `1` makes readiness require `configured-production` intelligence. |
| `SEMESTER_SCIM` | Vercel runtime | `on` mounts SCIM under `/scim/v2`. |
| `SEMESTER_SCIM_PUBLIC_URL` | Vercel runtime | The HTTPS address identity providers are given; every `meta.location` is built from it. Required when SCIM is on. |
| `SEMESTER_GATEWAY_PORT` | `start.ts` | Listen port, default 8787. |
| `SEMESTER_GATEWAY_STORE` | `start.ts` | `postgres` selects the shared journal, limiter and action store; it then needs the Supabase URL and service key. |
| `SEMESTER_JOURNAL_PATH` | `start.ts` | SQLite journal file, default `work/university/private/actions.sqlite`. |
| `SEMESTER_SANDBOX_INSTITUTION` | `start.ts` | `1` installs the sandbox adapters. |
| `SEMESTER_SANDBOX_PATH` | `start.ts` | Sandbox SQLite file, default `work/university/private/sandbox.sqlite`. |
| `SEMESTER_READ_ONLY` | `start.ts` | `on` turns read-only mode on ([above](#read-only-mode)). |

The app's own browser setting for the gateway address, `VITE_UNIVERSITY_GATEWAY_URL`, is in `app/.env.example`; the gateway does not read it.
