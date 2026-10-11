# Institution gateway API

> **Type:** reference · **Audience:** partner-developers, implementers · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/gateway-reference.test.ts`

This page lists every route the institution gateway answers, what each takes and returns, and how an action moves from review to receipt. Stop reading if you only use the Semester app: the app calls the gateway for you.

**Status:** MOCK_DEMO. The shipped adapter registry is empty, so every service that needs an adapter answers `503 adapter_not_configured`. The sandbox adapters answer only when the standalone server is started with `SEMESTER_SANDBOX_INSTITUTION=1`. The gateway is listed as MOCK_DEMO ("sandbox adapters only, no production adapters") in the [feature truth table](../FEATURE-TRUTH-TABLE.md). Nothing on this page lets you read or change a real student record today.

Related pages: [authentication, CORS, limits and environment variables](AUTH-AND-LIMITS.md), [every error code](ERRORS.md), the [registration-readiness workflow](registration-readiness-workflow.md), [the SCIM surface](SCIM-API.md), and the machine-readable [OpenAPI file](openapi/institution-gateway.openapi.yaml).

## How the examples on this page were made

Every example block was produced by calling the real in-process handler, `createGateway` in `app/server/institution/gateway.ts`, with the sandbox adapters (or a named fixture adapter where the sandbox cannot produce the case). The test `app/src/lib/docs/gateway-reference.test.ts` re-runs the calls and fails when a block is stale. Three things are normalised so the text is stable:

- The clock is fixed at `2026-10-04T12:00:00.000Z`.
- Random UUIDs are renumbered `00000000-0000-4000-8000-000000000001`, `…02` and so on, in order of first appearance within one scenario.
- The harness accepts the fake tokens `student-token` and similar. In the `curl` lines they are written `$TOKEN`. A real deployment accepts only a Supabase Auth access token ([authentication](AUTH-AND-LIMITS.md#authentication)).

The `curl` lines show the request that produces the response. The standalone server adds nothing to the body.

## Base URL

| Where | Base URL | Notes |
| --- | --- | --- |
| Vercel entry `app/api/institution/[...path].ts` | `/api/institution` on the app's host | The entry removes the `/api/institution` prefix before the gateway routes the request. |
| Standalone `app/server/institution/start.ts` | `http://127.0.0.1:8787` | Loopback only. The port is `SEMESTER_GATEWAY_PORT`. A reverse proxy in front is a deployment decision. |

Paths in the tables below are relative to the base URL.

## Routes

Methods other than `GET` and `POST` answer `405 method_not_supported`, except `OPTIONS`, which answers `204` on any path ([CORS](AUTH-AND-LIMITS.md#cors)). The SCIM rows exist only when SCIM is switched on ([SCIM](SCIM-API.md)).

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health/live` | none | Liveness. Always 200 while the process runs. |
| GET | `/health` | none | Readiness. 200 `ready` or 503 `unavailable`. |
| GET | `/health/ready` | none | Same handler as `/health`. |
| GET | `/v1/auth/config` | none | Whether single sign-on is offered, and its label. |
| GET | `/status` | Bearer | Connection state of all 37 service areas. |
| GET | `/records` | Bearer | One page of records for one area. |
| POST | `/actions/prepare` | Bearer | Phase one: returns a review, changes nothing. |
| POST | `/actions/commit` | Bearer | Phase two: needs the review id and `confirmed: true`. |
| POST | `/actions/reconcile` | Bearer | Asks the institution what happened to an uncertain action. |
| GET | `/v1/intelligence/policy` | Bearer | Semester Intelligence policy state for the caller. |
| POST | `/v1/intelligence/respond` | Bearer | A governed model response over approved sources. |
| POST | `/v1/intelligence/actions/{id}/confirm` | Bearer | Confirms an action the model proposed. |
| POST | `/v1/registration-readiness/evaluations` | Bearer + idempotency key | Starts the caller's own term evaluation. |
| POST | `/v1/registration-readiness/evaluations/{id}/evaluate` | Bearer + idempotency key | Evaluates approved evidence for that durable evaluation. |
| GET | `/scim/v2/ServiceProviderConfig` | SCIM credential | SCIM discovery. |
| GET | `/scim/v2/Schemas` | SCIM credential | SCIM discovery. |
| GET | `/scim/v2/ResourceTypes` | SCIM credential | SCIM discovery. |
| GET | `/scim/v2/Users` | SCIM credential | List or filter users. |
| POST | `/scim/v2/Users` | SCIM credential | Create a user. |
| GET | `/scim/v2/Users/{id}` | SCIM credential | Read a user. |
| PUT | `/scim/v2/Users/{id}` | SCIM credential | Replace a user. |
| PATCH | `/scim/v2/Users/{id}` | SCIM credential | Patch a user. |
| DELETE | `/scim/v2/Users/{id}` | SCIM credential | Deactivate a user. |
| GET | `/scim/v2/Groups` | SCIM credential | List or filter mapped groups. |
| POST | `/scim/v2/Groups` | SCIM credential | Set the membership of a mapped group. |
| GET | `/scim/v2/Groups/{id}` | SCIM credential | Read a group. |
| PUT | `/scim/v2/Groups/{id}` | SCIM credential | Replace a group's membership. |
| PATCH | `/scim/v2/Groups/{id}` | SCIM credential | Patch a group. |
| DELETE | `/scim/v2/Groups/{id}` | SCIM credential | Empty a group's membership. |

## What answers today

| Routes | Today |
| --- | --- |
| `/health/live`, `/health`, `/health/ready`, `/v1/auth/config` | Answer in any running gateway. They touch no university record. |
| `/status` | Answers. Every area shows `not-configured` unless an adapter is installed for the caller's institution. |
| `/records`, `/actions/*` | `503 adapter_not_configured` for every area, unless the sandbox is on and the caller's institution is `sandbox`. |
| `/v1/intelligence/*` | `503 policy-disabled` when the gateway has no intelligence service. When one is configured, `/respond` and `/policy` follow the tenant policy. `/confirm` cannot produce a receipt in the shipped runtime: it answers `502 authoritative-readback-required` ([why](#intelligence-routes)). |
| `/v1/registration-readiness/evaluations*` | `503 unavailable` in the shipped runtime because no approved evaluator is injected. The boundary is default-off; when an evaluator is supplied, it revalidates current membership, permits only a student's own scope, requires an idempotency key, and records durable receipts ([workflow](registration-readiness-workflow.md)). |
| `/scim/v2/*` | Off unless `SEMESTER_SCIM=on` on the Vercel runtime. Never run against a real identity provider ([SCIM](SCIM-API.md)). |

## Health and sign-in configuration

These four routes need no token and are not counted against the rate limit.

<!-- example:health-live -->
**Request**

```bash
curl -s 'http://127.0.0.1:8787/health/live'
```

**Response** `200` OK

```http
cache-control: no-store
content-type: application/json
vary: Origin
x-content-type-options: nosniff
x-correlation-id: 00000000-0000-4000-8000-000000000001
x-request-id: 00000000-0000-4000-8000-000000000002
```

```json
{
  "service": "Semester university gateway",
  "version": 1,
  "status": "live"
}
```
<!-- /example -->

`/health` reports readiness. The fields are `service`, `version`, `status` (`ready` or `unavailable`), `adapters` (how many adapters are installed, not how many are healthy), `intelligence` (`policy-disabled`, `configured-sandbox` or `configured-production`) and `readOnly`. The status code is 200 when ready and 503 when not, so a load balancer that reads only the code gets the right answer. The body of a 503 here is the same health body with `status: "unavailable"`, not the [error envelope](ERRORS.md). It does not say which dependency failed.

What "ready" means depends on the entry point:

| Entry point | Ready when |
| --- | --- |
| `start.ts` | The journal reports healthy. |
| Vercel runtime | The journal and its retention check are healthy, `SEMESTER_MONITORING_READY=1`, the installed adapter count is at least `SEMESTER_MINIMUM_ADAPTERS` (default 1), `SEMESTER_INTEGRATIONS_READY=1` whenever that minimum is above 0, and, if `SEMESTER_REQUIRE_AI=1`, the intelligence service is `configured-production`. |

With the shipped empty adapter registry, the Vercel runtime therefore reports `unavailable` on `/health` unless `SEMESTER_MINIMUM_ADAPTERS=0` is set. The test holds this.

<!-- example:health -->
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
  "readOnly": false
}
```
<!-- /example -->

`/v1/auth/config` answers `{"enabled": false}` when no single sign-on provider is configured, when the lookup returns nothing, and when the lookup fails. When a provider is configured it answers `{"enabled": true, "label": …, "domain": …}`; that shape is documented in the [OpenAPI file](openapi/institution-gateway.openapi.yaml) and was not produced here, because it needs a Supabase project.

<!-- example:auth-config -->
**Request**

```bash
curl -s 'http://127.0.0.1:8787/v1/auth/config'
```

**Response** `200` OK

```json
{
  "enabled": false
}
```
<!-- /example -->

## Reading: `/status` and `/records`

`GET /status` returns the verified institution id and name, the caller's roles, and one `connections` entry per service area, in the order of the [area table](#service-areas). The `roles` come from the verified membership, never from the request. An area with no adapter is `not-configured` with `canRead: false` and `canWrite: false`. If one adapter throws while reporting its status, that area is `error` with the message `Connection status could not be read.` and the rest of the page is unaffected.

<!-- example:status -->
**Request**

```bash
curl -s 'http://127.0.0.1:8787/status' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'X-Correlation-Id: docs-example-0001'
```

**Response** `200` OK

Excerpt: 2 of the 37 connections are shown (one connected, one with no adapter).

```json
{
  "version": 1,
  "institutionId": "sandbox",
  "institutionName": "SANDBOX — a demonstration course, not a real institution",
  "roles": [
    "student"
  ],
  "connections": [
    {
      "area": "courses",
      "state": "connected",
      "provider": "SANDBOX — demonstration adapter, not a university system",
      "canRead": true,
      "canWrite": true,
      "lastSyncAt": "2026-10-04T12:00:00.000Z",
      "permissions": [
        "sandbox:student"
      ],
      "message": "A sandbox course for demonstrating the submit → receipt → grade → feedback → archive loop. No credit is awarded and no record here is an official one."
    },
    {
      "area": "assessments",
      "state": "not-configured",
      "provider": "",
      "canRead": false,
      "canWrite": false,
      "lastSyncAt": null,
      "permissions": [],
      "message": "Awaiting an approved school adapter."
    }
  ]
}
```
<!-- /example -->

`GET /records?area=<area>` returns a page of records. Query parameters:

| Parameter | Required | Meaning |
| --- | --- | --- |
| `area` | yes | One of the 37 [area ids](#service-areas). Anything else is `400 invalid_request` ("Choose a university service."). |
| `search` | no | Free text, cut to 200 characters. What it matches is the adapter's choice. |
| `cursor` | no | The `nextCursor` of the previous page, cut to 500 characters. |

The response is `{records, nextCursor, fetchedAt}`. Each record has `id`, `area`, `title`, `summary`, `status`, `version`, `updatedAt`, `details` (label and value pairs for reading), an optional `dates` list (ISO timestamps for a calendar), and `actions`. Each action lists its `fields` with `id`, `label`, `kind` (`text`, `textarea`, `date`, `datetime-local`, `email`, `number` or `select`), `required` and, for `select`, `options`. The `version` is what you send back with any action on that record. Each read writes one `records.read` audit row.

<!-- example:records-courses -->
**Request**

```bash
curl -s 'http://127.0.0.1:8787/records?area=courses' \
  -H "Authorization: Bearer $TOKEN"
```

**Response** `200` OK

Excerpt: the first of the 2 records is shown.

```json
{
  "records": [
    {
      "id": "sandbox-101",
      "area": "courses",
      "title": "SANDBOX · SBX 101 — Running a course end to end",
      "summary": "A demonstration course with two published assignments, used to exercise the submit → receipt → grade → feedback → archive loop. No credit, no registrar, no real marks.",
      "status": "Open for enrolment",
      "version": "1",
      "updatedAt": "2026-10-04T12:00:00.000Z",
      "details": [
        {
          "label": "Institution",
          "value": "SANDBOX — a demonstration course, not a real institution"
        },
        {
          "label": "Taught by",
          "value": "Sandbox faculty"
        },
        {
          "label": "Enrolled",
          "value": "3 on the roster"
        },
        {
          "label": "Late work",
          "value": "This course has not said what late work costs."
        },
        {
          "label": "Problem set 1",
          "value": "worth 20% of the course · due 2026-10-02"
        },
        {
          "label": "Short paper",
          "value": "worth 35% of the course · due 2026-10-23"
        },
        {
          "label": "Your role here",
          "value": "student"
        }
      ],
      "actions": [
        {
          "id": "enrol",
          "label": "Enrol in this sandbox course",
          "fields": []
        }
      ]
    }
  ],
  "nextCursor": null,
  "fetchedAt": "2026-10-04T12:00:00.000Z"
}
```
<!-- /example -->

## Acting: prepare, commit, reconcile

An action is never done in one request. The route order is:

1. `POST /actions/prepare` with the record, its `version`, the action id and the fields. The gateway checks everything it can, asks the adapter to describe the action, stores the review encrypted in the journal, and returns it. The adapter writes nothing and reserves nothing.
2. The person reads the review. It expires 10 minutes after it was prepared.
3. `POST /actions/commit` with the review id and `confirmed: true`. The gateway checks everything again, then asks the adapter to execute the action.
4. If the outcome of step 3 is unknown, `POST /actions/reconcile` asks the institution what happened. It never performs the action again.

These routes accept an optional `Idempotency-Key` using the platform's 16–128-character safe-key format. The gateway validates it and carries it in the adapter's request context; an invalid key is `400 invalid_request`. The single-host SQLite `ActionJournal` now implements the shared idempotency-store contract durably, including scoped keys, request-hash conflicts, fenced leases, encrypted completed-response replay and expiry. A worker that loses its lease cannot publish or release the successor's result and receives `409 idempotency_in_progress` instead of returning a divergent response. The production PostgreSQL journal does not implement that contract yet, and no action route is wrapped with it, so the browser still does not retry a commit after a network failure. The review id remains the route's active durable duplicate guard: the gateway passes it to the adapter as the institution's own key, and repeating a commit with the same review id returns the stored receipt instead of acting again.

### Prepare

Request body:

| Field | Type | Limits |
| --- | --- | --- |
| `area` | string | One of the 37 area ids. |
| `recordId` | string | 1 to 200 characters. |
| `version` | string | 1 to 200 characters. Must equal the record's current `version`. |
| `actionId` | string | 1 to 200 characters. Must be an action the record offers now. |
| `fields` | object | At most 30 entries. Keys match `^[a-zA-Z][a-zA-Z0-9_-]{0,63}$`. Values are strings of at most 20000 characters. A key that is not a field of the action is refused. |

Checks, in order. Each refusal names its [error code](ERRORS.md):

1. The request is `Content-Type: application/json…` (`415 unsupported_media_type`), at most 128,000 bytes (`413 too_large`), valid JSON and shaped like an action (`400 invalid_request`).
2. An adapter exists for the caller's institution and area: `503 adapter_not_configured`.
3. The connection is `connected`, readable and, for prepare and commit, writable for the caller: `403 connection_forbids`.
4. The record exists, is the caller's, and is the named record and area: `404 not_found`.
5. The record's version equals the one sent: `409 record_changed`.
6. The record offers that action: `403 forbidden`.
7. The fields fit the action (unknown key, missing required field, value not in a `select`'s options, non-numeric `number`): `400 invalid_request`.

The response is the review: `{id, title, details, expiresAt}`. The adapter writes `title` and `details`; they are what the person confirms.

<!-- example:prepare-enrol -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/prepare' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0002' \
  -d '{"area":"courses","recordId":"sandbox-101","version":"1","actionId":"enrol","fields":{}}'
```

**Response** `200` OK

```json
{
  "id": "00000000-0000-4000-8000-000000000003",
  "title": "Enrol in SBX 101",
  "details": [
    {
      "label": "Institution",
      "value": "SANDBOX — a demonstration course, not a real institution"
    },
    {
      "label": "Course",
      "value": "SBX 101 — Running a course end to end"
    },
    {
      "label": "This is not real",
      "value": "No registrar is contacted and no credit is awarded."
    }
  ],
  "expiresAt": "2026-10-04T12:10:00.000Z"
}
```
<!-- /example -->

### Commit

Request body: `{"reviewId": "<id>", "confirmed": true}`. Only the JSON value `true` counts as confirmation.

<!-- example:commit-unconfirmed -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/commit' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0003' \
  -d '{"reviewId":"00000000-0000-4000-8000-000000000003"}'
```

**Response** `400`

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Confirm the reviewed action before continuing.",
    "correlation_id": "docs-example-0003",
    "retryable": false
  },
  "message": "Confirm the reviewed action before continuing."
}
```
<!-- /example -->

The gateway looks the review up for the caller's user and institution (`404 not_found` otherwise). A review already `completed` or `pending` returns its stored receipt with 200; one that is `refused` is `409 review_refused`; one that is `processing` or `uncertain` is `409 conflict`. For a review in state `ready` it then:

1. Refuses an expired review: `410 review_expired`.
2. Re-authenticates the same token and requires the same user and institution: `403 forbidden` otherwise (only when the entry point supplies a re-check, which both do).
3. Repeats checks 2 to 7 of prepare. A record that moved is `409 record_changed`.
4. Asks the adapter for the review again and compares it with what was shown: `409 review_changed` if it differs.
5. Claims the review so that two concurrent commits cannot both act: `409 already_claimed` for the loser.
6. Calls the adapter's `execute` with the review id as the idempotency key.

A receipt is `{id, status, message, recordedAt}` where `status` is `completed` or `pending`. `pending` means the institution accepted the request and has not finished it. The gateway rejects an adapter receipt that has no id, no `recordedAt` or another status, and treats that as an unknown outcome.

<!-- example:commit-enrol -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/commit' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0004' \
  -d '{"reviewId":"00000000-0000-4000-8000-000000000003","confirmed":true}'
```

**Response** `200` OK

```json
{
  "id": "00000000-0000-4000-8000-000000000003",
  "status": "completed",
  "message": "SANDBOX · Enrolled. Nothing here reaches a real institution.",
  "recordedAt": "2026-10-04T12:00:00.000Z"
}
```
<!-- /example -->

Repeating the commit returns the same receipt and does nothing:

<!-- example:commit-replay -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/commit' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0005' \
  -d '{"reviewId":"00000000-0000-4000-8000-000000000003","confirmed":true}'
```

**Response** `200` OK

```json
{
  "id": "00000000-0000-4000-8000-000000000003",
  "status": "completed",
  "message": "SANDBOX · Enrolled. Nothing here reaches a real institution.",
  "recordedAt": "2026-10-04T12:00:00.000Z"
}
```
<!-- /example -->

What can happen to a commit, by what `execute` does:

| `execute` | Journal state | Response |
| --- | --- | --- |
| Returns a valid receipt | `completed` or `pending` | 200 with the receipt. |
| Throws a `Refusal` (the adapter says it looked, said no and wrote nothing) | `refused` | `400 refused` carrying the adapter's sentence. Later commits and reconciles: `409 review_refused`. |
| Throws anything else | `uncertain` | `502 outcome_uncertain`, `retryable: false`, with `user_action` of kind `contact_support`. The message is fixed; the thrown message is never repeated. |

A `502` is never retried by the gateway and must not be retried by you. After one, a commit of that review answers `409 conflict`. In the SQLite journal, a new review of the same operation also cannot be claimed while an earlier one is `processing`, `uncertain` or `pending`: that commit answers `409 already_claimed`. I did not read the Postgres journal's claim, which is SQL. Examples of these cases are in [ERRORS.md](ERRORS.md#examples).

### Reconcile

Request body: `{"reviewId": "<id>"}`. The gateway asks the adapter's `reconcile`, which looks the operation up by the review id. For a review already `completed`, the stored receipt is returned. For `pending` and `uncertain` reviews the adapter is asked. A review in `ready` or `processing` is `409 conflict`. An adapter that cannot reconcile gets `503 unavailable` ("This adapter needs institutional support to reconcile the action."). An adapter that answers "still unknown" gets `409 outcome_uncertain` ("The school has not confirmed the result yet. Do not submit it again.").

Reconcile is the one write-like route that stays open in read-only mode ([why](AUTH-AND-LIMITS.md#read-only-mode)).

<!-- example:reconcile-completed -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/reconcile' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0006' \
  -d '{"reviewId":"00000000-0000-4000-8000-000000000003"}'
```

**Response** `200` OK

```json
{
  "id": "00000000-0000-4000-8000-000000000003",
  "status": "completed",
  "message": "SANDBOX · Enrolled. Nothing here reaches a real institution.",
  "recordedAt": "2026-10-04T12:00:00.000Z"
}
```
<!-- /example -->

## Intelligence routes

Status: MOCK_DEMO, part of the same truth-table row as the rest of the gateway. These routes sit behind the same authentication, rate limit and read-only checks as the others. Their bodies are not wrapped in the error envelope: a refusal is a flat `{code, message}` ([codes](ERRORS.md#intelligence-codes)). Only the gateway's own refusals (no token, no intelligence service configured) use the envelope.

| Question | Answer |
| --- | --- |
| Is there an intelligence service? | Only if one is passed to `createGateway`. Both entry points pass one, but `createInstitutionIntelligenceRuntime` returns a policy-disabled service unless a Supabase URL, a service key, an `OPENAI_API_KEY`, at least one `SEMESTER_AI_PROVIDERS` model (all starting `openai:`) and valid `SEMESTER_AI_MAX_REQUEST_CENTS` and `SEMESTER_AI_ESTIMATED_REQUEST_CENTS` are set. |
| What does a policy-disabled service answer? | `/policy`: `403 policy-disabled`. `/respond`: `403 policy-disabled` after the request validates. |
| Can the server be told the client is in production? | No. `clientState` in the request is informational. The policy is loaded on the server for every call. |
| Can `/confirm` produce a receipt? | Not in the shipped runtime. Its `execute` always returns `verified: false`, so a confirmed action answers `502 authoritative-readback-required`. A comment in `intelligence-runtime.ts` says each adapter must supply an authoritative write and readback before actions can ship. |

I could not exercise a configured provider (it needs Supabase and an OpenAI key). The examples below use `createIntelligenceService` with a stub provider that returns the fixed text "A stubbed answer.". They show the real routing, validation and response shape; they say nothing about model behaviour.

A gateway with no intelligence service:

<!-- example:intelligence-unconfigured -->
**Request**

```bash
curl -s 'http://127.0.0.1:8787/v1/intelligence/policy' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'X-Correlation-Id: docs-example-0047'
```

**Response** `503`

```json
{
  "error": {
    "code": "policy-disabled",
    "message": "Semester Intelligence is not configured for this gateway.",
    "correlation_id": "docs-example-0047",
    "retryable": true
  },
  "message": "Semester Intelligence is not configured for this gateway."
}
```
<!-- /example -->

A gateway with a stub service. `/health` reports it:

<!-- example:intelligence-health -->
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
  "adapters": 0,
  "intelligence": "configured-sandbox",
  "readOnly": false
}
```
<!-- /example -->

`GET /v1/intelligence/policy` returns the tenant policy `state` (`off`, `preview`, `sandbox` or `production`) and the `allowedModes` (`explain`, `hint`, `practice`, `review`, `draft`). It is `403 policy-disabled` when the state is `off` or none of the caller's roles is permitted.

<!-- example:intelligence-policy -->
**Request**

```bash
curl -s 'http://127.0.0.1:8787/v1/intelligence/policy' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'X-Correlation-Id: docs-example-0048'
```

**Response** `200` OK

```json
{
  "state": "sandbox",
  "allowedModes": [
    "explain"
  ]
}
```
<!-- /example -->

`POST /v1/intelligence/respond` takes the request documented in the OpenAPI file (`IntelligenceRequest`): `version: 1`, `clientState`, `tenantId` and `personId` (both must equal the verified identity, or `403 scope-refused`), `question` (at most 10,000 characters), `mode`, `category`, optional `agent` (`assistant`, `advisor`, `tutor`, `course-guide`), optional `courseId` and `term` (`^[0-9]{4}(FA|SP|SU)$`), `sourceIds` (1 to 100, each approved for the tenant), `evidenceIds` and `proposedActions` (at most 20). Roles other than `assistant` may propose only actions of class `prepare`. A successful answer lists the cited `sourceIds`, the `route`, the `usage`, and each proposed action with a new id and a five-minute expiry. Those actions are stored server-side.

<!-- example:intelligence-respond -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/v1/intelligence/respond' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0049' \
  -d '{"version":1,"clientState":"sandbox","tenantId":"school-a","personId":"student-a","question":"What is a derivative?","mode":"explain","category":"study","sourceIds":["s1"],"evidenceIds":["e1"],"proposedActions":[{"id":"a","label":"Add a reminder","effect":"Adds one reminder","target":"plan","class":"prepare","reversible":true,"evidenceIds":["e1"]}]}'
```

**Response** `200` OK

```json
{
  "version": 1,
  "text": "A stubbed answer.",
  "agent": "assistant",
  "sourceIds": [
    "s1"
  ],
  "evidenceIds": [
    "e1"
  ],
  "mode": "explain",
  "route": {
    "provider": "openai",
    "model": "openai:stub"
  },
  "usage": {
    "inputTokens": 10,
    "outputTokens": 5,
    "estimatedCents": 1
  },
  "actions": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "label": "Add a reminder",
      "effect": "Adds one reminder",
      "target": "plan",
      "class": "prepare",
      "reversible": true,
      "evidenceIds": [
        "e1"
      ],
      "preparedAt": "2026-10-04T12:00:00.000Z",
      "expiresAt": "2026-10-04T12:05:00.000Z"
    }
  ]
}
```
<!-- /example -->

`POST /v1/intelligence/actions/{id}/confirm` takes `{"confirmed": true, "at": "<ISO time>"}`. The time must be no more than five minutes old and not in the future. The action is claimed before it runs, so a second confirm of the same id answers `404 action-not-found`.

<!-- example:intelligence-confirm -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/v1/intelligence/actions/00000000-0000-4000-8000-000000000001/confirm' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0052' \
  -d '{"confirmed":true,"at":"2026-10-04T12:00:00.000Z"}'
```

**Response** `502`

```json
{
  "code": "authoritative-readback-required",
  "message": "The action was not turned into a receipt because authoritative readback was unavailable."
}
```
<!-- /example -->

## Service areas

The gateway serves 37 areas. The column "Sandbox" says whether the sandbox installs an adapter for it; an area with `no` answers `not-configured` in the sandbox too. The ids come from `UNIVERSITY_AREAS` in `packages/institution/src/index.ts`.

| Area id | Name | Sandbox |
| --- | --- | --- |
| `courses` | Courses | yes |
| `assignments` | Assignments & submissions | yes |
| `assessments` | Quizzes & exams | no |
| `grades` | Grades & feedback | yes |
| `email` | University email | no |
| `registration` | Course registration | yes |
| `advising` | Advising | yes |
| `billing` | University bills | yes |
| `aid` | Financial aid | yes |
| `dining` | Dining | yes |
| `housing` | Housing | yes |
| `mailroom` | Campus mail | no |
| `transport` | Transportation | no |
| `library` | Libraries | no |
| `athletics` | Athletics | yes |
| `recreation` | Recreation & intramurals | no |
| `clubs` | Clubs & organizations | yes |
| `career` | Career & employers | yes |
| `alumni` | Alumni & mentorship | yes |
| `abroad` | Study abroad | no |
| `forms` | Forms & surveys | no |
| `records` | Student records & transcripts | yes |
| `admissions` | Admissions | no |
| `orientation` | Welcome & orientation | no |
| `graduate` | Graduate & professional education | no |
| `research` | Research & ethics | no |
| `international` | International student services | no |
| `accessibility` | Accessibility services | no |
| `appeals` | Feedback & appeals | yes |
| `directory` | University directory | no |
| `graduation` | Graduation & credentials | no |
| `family` | Authorized family access | yes |
| `support` | Help & service status | no |
| `health` | Health services | no |
| `safety` | Campus safety | no |
| `identity` | Student ID | no |
| `admin` | Administration | no |

## Roles

A caller's roles come from an active institution membership. The ten ids come from `UNIVERSITY_ROLES`. A membership with any role outside this list is refused as a whole.

| Role id |
| --- |
| `student` |
| `faculty` |
| `teaching_assistant` |
| `advisor` |
| `admin` |
| `staff` |
| `applicant` |
| `payer` |
| `family` |
| `alumni` |

## The sandbox

The sandbox is a demonstration institution with the id `sandbox` and the name "SANDBOX — a demonstration course, not a real institution". It exists so the enrol, submit, receipt, mark, release and archive loop can be built and tested without any real institution. Its code is `app/server/institution/sandbox.ts`.

What that means when you test against it:

- It is installed only by `start.ts`, only when `SEMESTER_SANDBOX_INSTITUTION=1`. The Vercel runtime never installs it. It is not an entry in `adapters.ts`; that array stays empty, and the test holds that.
- It answers only to an identity whose institution is `sandbox`. The institution comes from the verified membership, so you need an account whose membership resolves to the tenant `sandbox`. With Supabase Auth unset, `start.ts` authenticates nobody: a call with a bearer token gets `403 forbidden`, a call without one gets `401 unauthenticated`. The examples on this page reach it through an in-process harness that stubs authentication.
- It installs 16 adapters: `courses`, `assignments`, `grades`, `records`, `appeals`, `registration`, `billing`, `aid`, `family`, `career`, `advising`, `alumni`, `athletics`, `clubs`, `housing`, `dining`. The other 21 areas answer `not-configured`.
- It has two roles that can act: `student` and `faculty`. A student can act only on their own work; faculty see the roster.
- Its state is a SQLite file (`SEMESTER_SANDBOX_PATH`, default `work/university/private/sandbox.sqlite`). It persists between runs of the server.
- A record's `version` changes when the record changes. In the examples, enrolling moved the course record's version, so the version read before the commit is stale after it ([example](ERRORS.md#examples)).
- Due dates are fixed calendar dates, and statuses such as "overdue" are computed from the date of the call.
- Every record title, the provider name and the receipt messages in the examples begin or end with the word SANDBOX or the sentence "Nothing here reaches a real institution." Nothing it reports is a real record, receipt or mark.

## Entry points compared

The same `createGateway` is composed two ways. What each composition wires differs, and that is the reason this table exists.

| | `start.ts` (standalone) | Vercel runtime (`runtime.ts` via `app/api/institution/[...path].ts`) |
| --- | --- | --- |
| Journal | SQLite file, or Postgres if `SEMESTER_GATEWAY_STORE=postgres` | Postgres |
| Rate limiter | In memory, or Postgres with the store switch | Postgres |
| Sandbox adapters | If `SEMESTER_SANDBOX_INSTITUTION=1` | Never |
| Read-only mode | `SEMESTER_READ_ONLY=on` | Not wired |
| Telemetry line per request | None | JSON line to the process log |
| SCIM | Not mounted | Mounted when `SEMESTER_SCIM=on` |
| Readiness | Journal healthy | The stricter rule [above](#health-and-sign-in-configuration) |
| Missing configuration | Throws at startup, naming the variable, for a bad `SEMESTER_APP_ORIGIN` or `SEMESTER_JOURNAL_KEY`. Unset Supabase variables do not stop it: nobody can then sign in (`403`) | Every request answers `503` with a flat `{"error": …}` body ([errors outside the envelope](ERRORS.md#errors-outside-the-envelope)) |

The public API service has a 30-second function ceiling (`services.api.functions` in root `vercel.json`). The prefix removal, body bound and unavailable answer are in `serveInstitutionRequest` and `institution` in the institution route, which the service entrypoint composes unchanged.

## Response headers

Every response from the gateway carries `Content-Type: application/json`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Vary: Origin`, `X-Request-Id` and `X-Correlation-Id`. `Access-Control-*` headers appear only when the request had an `Origin`. See [AUTH-AND-LIMITS.md](AUTH-AND-LIMITS.md#correlation-and-request-ids).

## Discrepancies with older documents

The code wins. Where [`UNIVERSITY_CONNECTIONS.md`](../UNIVERSITY_CONNECTIONS.md) differs:

- It says the contract has six roles. `UNIVERSITY_ROLES` has ten.
- It says university membership comes from `app_metadata.semester`. Both entry points use the membership resolver in `membership.ts`; `trustedIdentity` remains for tests.
- It says the sandbox covers four areas. `sandboxAdapters` installs 16.
- It describes a SQLite journal only. The Vercel runtime uses Postgres.
