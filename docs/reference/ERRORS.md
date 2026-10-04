# Gateway error codes

> **Type:** reference · **Audience:** partner-developers, implementers · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/gateway-reference.test.ts`

This page lists every error the institution gateway can return, in the shape each route family uses, and says whether a call that failed may be sent again. Stop reading if you handle errors by status code alone and never switch on the code.

Related: [routes](API-GATEWAY.md), [authentication and limits](AUTH-AND-LIMITS.md), [SCIM](SCIM-API.md). The test `app/src/lib/docs/gateway-reference.test.ts` reads the gateway source and fails if a code, a status or a sentence exists in one and not the other.

## Four shapes

Which shape you get depends on which part of the service refused.

| Shape | Returned by | Looks like |
| --- | --- | --- |
| The envelope | Every gateway route, for the gateway's own refusals | `{"error": {"code", "message", "correlation_id", "retryable", "user_action"?}, "message"}` |
| Flat intelligence refusal | `/v1/intelligence/*`, for the intelligence service's own refusals | `{"code", "message"}` |
| SCIM error | `/scim/v2/*` | `{"schemas": [".../Error"], "status": "404", "detail": "…"}` |
| Flat entry error | The Vercel entry and `start.ts`, around the gateway | `{"error": "…"}` where `error` is a string |

Health bodies are none of these: a `503` from `/health` is the health body with `status: "unavailable"` ([API-GATEWAY.md](API-GATEWAY.md#health-and-sign-in-configuration)).

## The envelope

```json
{
  "error": {
    "code": "record_changed",
    "message": "This record changed. Refresh it and review your action again.",
    "correlation_id": "docs-example-0007",
    "retryable": false
  },
  "message": "This record changed. Refresh it and review your action again."
}
```

| Field | Meaning |
| --- | --- |
| `error.code` | A stable name. You may switch on it. A status alone cannot tell "the review expired" from "the record moved"; both are 4xx. |
| `error.message` | A sentence written for the person. |
| `error.correlation_id` | The same value as the `X-Correlation-Id` response header. Quote it to support. |
| `error.retryable` | `true` only for statuses 429 and 503. It is a statement, not a hint. |
| `error.user_action` | Optional `{label, kind, href?}`. `kind` is `external_link`, `open_screen`, `retry_later` or `contact_support`. Today only `502 outcome_uncertain` sets it, with `contact_support`. |
| `message` | The same sentence as `error.message`, for clients written before the envelope. |

A `retryable: true` response means the same request may be sent again. `502 outcome_uncertain` is `retryable: false` on purpose: the institution may have acted, and the way forward is [`/actions/reconcile`](API-GATEWAY.md#reconcile), never a second commit. The retry rule is by status in `retryable()` in `gateway.ts`; the code does not decide it.

## Envelope codes

The "Emitted" column is `yes` when some call in the gateway source can produce the code, and `no` when the code is declared in the status table but no route emits it today. Statuses are the ones the source pairs with the code.

| Code | Status | Emitted | When |
| --- | --- | --- | --- |
| `invalid_request` | 400 | yes | The body is not JSON, is not shaped like an action or a review reference, has an unknown or missing field, lacks `confirmed: true` on commit, or `area` is missing or unknown on `/records`. |
| `unauthenticated` | 401 | yes | No `Authorization: Bearer <token>` header. |
| `forbidden` | 403 | yes | The token is not accepted or has no active membership; the identity changed between prepare and commit; the record does not offer that action. |
| `origin_not_allowed` | 403 | yes | The `Origin` header is not the configured origin. |
| `connection_forbids` | 403 | yes | The adapter's connection is not `connected`, cannot read, or (for actions) cannot write. |
| `not_ready_to_execute` | 403 | yes | A defensive check before an adapter write found a missing ground (confirmation, authority, policy or audit id). I found no request that reaches it, because those grounds are checked earlier on the same path. |
| `not_found` | 404 | yes | An unknown path; a record not available to the caller; a review not found for the caller. |
| `method_not_supported` | 405 | yes | A method other than `GET`, `POST` or `OPTIONS`. |
| `conflict` | 409 | yes | A commit or reconcile for a review in a state that does not allow it. |
| `record_changed` | 409 | yes | The `version` sent is not the record's current version. |
| `review_changed` | 409 | yes | The adapter's review at commit differs from the one the person read. |
| `review_refused` | 409 | yes | The review was answered by a refusal. Prepare a new one. |
| `already_claimed` | 409 | yes | Another commit holds the claim, or the review expired at the claim. |
| `expired` | 410 | no | Declared for status 410. Every 410 passes `review_expired` instead. |
| `review_expired` | 410 | yes | The review is more than 10 minutes old. |
| `too_large` | 413 | yes | A body over 128,000 bytes reached the gateway. |
| `unsupported_media_type` | 415 | yes | A POST whose `Content-Type` does not start with `application/json`. |
| `rate_limited` | 429 | yes | More than the allowed requests in the window. |
| `refused` | 400 | yes | The adapter said no and wrote nothing. The message is the adapter's own sentence. |
| `outcome_uncertain` | 409, 502 | yes | 502: execute failed and the school may have acted. 409: reconcile asked and the school has not answered. |
| `read_only` | 503 | yes | Read-only mode is on and the call is a write. |
| `adapter_not_configured` | 503 | yes | No adapter is installed for the caller's institution and area. |
| `policy-disabled` | 503 | yes | No intelligence service is configured on this gateway. Note the hyphen: this code is spelled like the intelligence codes. |
| `unavailable` | 503 | yes | Anything unexpected, and an adapter that cannot reconcile. One fixed sentence. |

### Examples

Every block below is a real call to the in-process handler. The first group uses the sandbox adapters; the groups that need an adapter to fail on cue use a named fixture adapter (`Fixture adapter`, institution `school-a`).

**Bad input and a moved record** (sandbox).

<!-- example:records-no-area -->
**Request**

```bash
curl -s 'http://127.0.0.1:8787/records' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'X-Correlation-Id: docs-example-0013'
```

**Response** `400`

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Choose a university service.",
    "correlation_id": "docs-example-0013",
    "retryable": false
  },
  "message": "Choose a university service."
}
```
<!-- /example -->

<!-- example:prepare-bad-body -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/prepare' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0012' \
  -d '{"area":"courses"}'
```

**Response** `400`

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Choose a record and action.",
    "correlation_id": "docs-example-0012",
    "retryable": false
  },
  "message": "Choose a record and action."
}
```
<!-- /example -->

<!-- example:prepare-unexpected-field -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/prepare' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0009' \
  -d '{"area":"assignments","recordId":"student-1:a2","version":"2","actionId":"submit","fields":{"work":"x","admin":"yes"}}'
```

**Response** `400`

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Unexpected action field.",
    "correlation_id": "docs-example-0009",
    "retryable": false
  },
  "message": "Unexpected action field."
}
```
<!-- /example -->

<!-- example:prepare-missing-field -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/prepare' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0010' \
  -d '{"area":"assignments","recordId":"student-1:a2","version":"2","actionId":"submit","fields":{"note":"hello"}}'
```

**Response** `400`

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Your work is required.",
    "correlation_id": "docs-example-0010",
    "retryable": false
  },
  "message": "Your work is required."
}
```
<!-- /example -->

<!-- example:prepare-stale-version -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/prepare' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0007' \
  -d '{"area":"courses","recordId":"sandbox-101","version":"0","actionId":"enrol","fields":{}}'
```

**Response** `409`

```json
{
  "error": {
    "code": "record_changed",
    "message": "This record changed. Refresh it and review your action again.",
    "correlation_id": "docs-example-0007",
    "retryable": false
  },
  "message": "This record changed. Refresh it and review your action again."
}
```
<!-- /example -->

<!-- example:prepare-unknown-action -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/prepare' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0008' \
  -d '{"area":"courses","recordId":"sandbox-101","version":"2","actionId":"nope","fields":{}}'
```

**Response** `403`

```json
{
  "error": {
    "code": "forbidden",
    "message": "This action is not available for this record.",
    "correlation_id": "docs-example-0008",
    "retryable": false
  },
  "message": "This action is not available for this record."
}
```
<!-- /example -->

<!-- example:prepare-other-students-record -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/prepare' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0011' \
  -d '{"area":"assignments","recordId":"student-2:a2","version":"2","actionId":"submit","fields":{"work":"x"}}'
```

**Response** `404`

```json
{
  "error": {
    "code": "not_found",
    "message": "Record not available to this account.",
    "correlation_id": "docs-example-0011",
    "retryable": false
  },
  "message": "Record not available to this account."
}
```
<!-- /example -->

<!-- example:records-adapter-missing -->
**Request**

```bash
curl -s 'http://127.0.0.1:8787/records?area=billing' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'X-Correlation-Id: docs-example-0014'
```

**Response** `503`

```json
{
  "error": {
    "code": "adapter_not_configured",
    "message": "An approved university connection is not configured for this service.",
    "correlation_id": "docs-example-0014",
    "retryable": true
  },
  "message": "An approved university connection is not configured for this service."
}
```
<!-- /example -->

**The request itself** (sandbox).

<!-- example:wrong-method -->
**Request**

```bash
curl -s -X DELETE 'http://127.0.0.1:8787/status' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'X-Correlation-Id: docs-example-0018'
```

**Response** `405`

```json
{
  "error": {
    "code": "method_not_supported",
    "message": "Method not supported.",
    "correlation_id": "docs-example-0018",
    "retryable": false
  },
  "message": "Method not supported."
}
```
<!-- /example -->

<!-- example:unknown-path -->
**Request**

```bash
curl -s 'http://127.0.0.1:8787/nope' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'X-Correlation-Id: docs-example-0019'
```

**Response** `404`

```json
{
  "error": {
    "code": "not_found",
    "message": "Endpoint not found.",
    "correlation_id": "docs-example-0019",
    "retryable": false
  },
  "message": "Endpoint not found."
}
```
<!-- /example -->

<!-- example:invalid-json -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/prepare' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0021' \
  -d '{nope'
```

**Response** `400`

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Invalid JSON.",
    "correlation_id": "docs-example-0021",
    "retryable": false
  },
  "message": "Invalid JSON."
}
```
<!-- /example -->

The `413` below is the gateway's own check. A real body of this size is stopped earlier, by the standalone server or the Vercel entry, with the flat body in [errors outside the envelope](#errors-outside-the-envelope).

<!-- example:too-large -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/prepare' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0022'
```

The request body is a JSON body of 128008 bytes.

**Response** `413`

```json
{
  "error": {
    "code": "too_large",
    "message": "Request is too large.",
    "correlation_id": "docs-example-0022",
    "retryable": false
  },
  "message": "Request is too large."
}
```
<!-- /example -->

**An action whose outcome is unknown** (fixture adapter). The first commit made `execute` throw. The gateway answers `502`, does not repeat the write, and holds the review in `uncertain`.

<!-- example:commit-uncertain -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/commit' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0033' \
  -d '{"reviewId":"00000000-0000-4000-8000-000000000001","confirmed":true}'
```

**Response** `502`

```json
{
  "error": {
    "code": "outcome_uncertain",
    "message": "The result could not be confirmed. Ask the institution to reconcile this action before submitting again.",
    "correlation_id": "docs-example-0033",
    "retryable": false,
    "user_action": {
      "label": "Ask the institution to reconcile",
      "kind": "contact_support"
    }
  },
  "message": "The result could not be confirmed. Ask the institution to reconcile this action before submitting again."
}
```
<!-- /example -->

<!-- example:commit-after-uncertain -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/commit' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0034' \
  -d '{"reviewId":"00000000-0000-4000-8000-000000000001","confirmed":true}'
```

**Response** `409`

```json
{
  "error": {
    "code": "conflict",
    "message": "This action is processing or needs reconciliation. Do not submit it again.",
    "correlation_id": "docs-example-0034",
    "retryable": false
  },
  "message": "This action is processing or needs reconciliation. Do not submit it again."
}
```
<!-- /example -->

<!-- example:reconcile-unresolved -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/reconcile' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0035' \
  -d '{"reviewId":"00000000-0000-4000-8000-000000000001"}'
```

**Response** `409`

```json
{
  "error": {
    "code": "outcome_uncertain",
    "message": "The school has not confirmed the result yet. Do not submit it again.",
    "correlation_id": "docs-example-0035",
    "retryable": false
  },
  "message": "The school has not confirmed the result yet. Do not submit it again."
}
```
<!-- /example -->

<!-- example:reconcile-resolved -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/reconcile' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0036' \
  -d '{"reviewId":"00000000-0000-4000-8000-000000000001"}'
```

**Response** `200` OK

```json
{
  "id": "receipt-1",
  "status": "completed",
  "message": "Confirmed by lookup",
  "recordedAt": "2026-09-13T10:00:00Z"
}
```
<!-- /example -->

**An adapter refusal** (fixture adapter). `execute` threw a `Refusal`, which is an adapter's promise that nothing was written.

<!-- example:commit-refused -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/commit' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0038' \
  -d '{"reviewId":"00000000-0000-4000-8000-000000000002","confirmed":true}'
```

**Response** `400`

```json
{
  "error": {
    "code": "refused",
    "message": "The deadline has passed.",
    "correlation_id": "docs-example-0038",
    "retryable": false
  },
  "message": "The deadline has passed."
}
```
<!-- /example -->

<!-- example:commit-refused-again -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/commit' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0039' \
  -d '{"reviewId":"00000000-0000-4000-8000-000000000002","confirmed":true}'
```

**Response** `409`

```json
{
  "error": {
    "code": "review_refused",
    "message": "This action was refused. Prepare a new review.",
    "correlation_id": "docs-example-0039",
    "retryable": false
  },
  "message": "This action was refused. Prepare a new review."
}
```
<!-- /example -->

**Reviews that cannot be committed** (fixture adapter).

<!-- example:reconcile-not-submitted -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/reconcile' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0041' \
  -d '{"reviewId":"00000000-0000-4000-8000-000000000003"}'
```

**Response** `409`

```json
{
  "error": {
    "code": "conflict",
    "message": "This action has not been submitted.",
    "correlation_id": "docs-example-0041",
    "retryable": false
  },
  "message": "This action has not been submitted."
}
```
<!-- /example -->

<!-- example:commit-review-changed -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/commit' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0042' \
  -d '{"reviewId":"00000000-0000-4000-8000-000000000003","confirmed":true}'
```

**Response** `409`

```json
{
  "error": {
    "code": "review_changed",
    "message": "The action details changed. Prepare a new review.",
    "correlation_id": "docs-example-0042",
    "retryable": false
  },
  "message": "The action details changed. Prepare a new review."
}
```
<!-- /example -->

This one was captured by moving the clock forward 11 minutes between prepare and commit:

<!-- example:commit-expired -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/commit' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0044' \
  -d '{"reviewId":"00000000-0000-4000-8000-000000000004","confirmed":true}'
```

**Response** `410`

```json
{
  "error": {
    "code": "review_expired",
    "message": "Review expired. Refresh and review the action again.",
    "correlation_id": "docs-example-0044",
    "retryable": false
  },
  "message": "Review expired. Refresh and review the action again."
}
```
<!-- /example -->

<!-- example:prepare-connection-forbids -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/actions/prepare' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0046' \
  -d '{"area":"assignments","recordId":"paper","version":"1","actionId":"submit","fields":{"response":"Private coursework response"}}'
```

**Response** `403`

```json
{
  "error": {
    "code": "connection_forbids",
    "message": "This connection does not permit that action.",
    "correlation_id": "docs-example-0046",
    "retryable": false
  },
  "message": "This connection does not permit that action."
}
```
<!-- /example -->

## Intelligence codes

Returned flat, as `{"code", "message"}`, by `/v1/intelligence/respond`, `/policy` and `/actions/{id}/confirm`. The "Emitted" column is `yes` for every row because the table is read from `result(status, {code …})` calls in `intelligence.ts`.

| Code | Status | Emitted | When |
| --- | --- | --- | --- |
| `invalid-request` | 400 | yes | The request does not parse (version, mode, ids, lengths, term format). |
| `scope-refused` | 403 | yes | `tenantId` or `personId` is not the verified identity, or the action belongs to another scope. |
| `policy-disabled` | 403 | yes | Tenant policy is `off`, or none of the caller's roles is permitted. |
| `role-disabled` | 403 | yes | The caller's roles are not in the policy's permitted roles. |
| `mode-disabled` | 403 | yes | The mode is not in the tenant's allowed modes. |
| `agent-action-refused` | 403 | yes | A role other than `assistant` proposed an action that is not `prepare`. |
| `source-not-approved` | 403 | yes | No sources, or a source the tenant has not approved for this account. |
| `source-scope-unverified` | 403 | yes | A source has no institution-approved policy scope. |
| `course-scope-required` | 403 | yes | The `tutor` and `course-guide` roles need approved sources from exactly one course. |
| `course-scope-mismatch` | 403 | yes | The requested course or term does not match the approved scope of the sources. |
| `course-mode-disabled` | 403 | yes | The published course policy does not allow that mode. |
| `course-policy-unavailable` | 503 | yes | The course policy service is missing or failed. |
| `model-unavailable` | 503 | yes | No tenant-approved model fits the cost ceiling. |
| `budget-unavailable` | 503 | yes | The budget service failed. |
| `budget-exhausted` | 429 | yes | The institution AI budget is spent. |
| `provider-unavailable` | 503 | yes | The model provider failed or timed out (20 seconds). |
| `invalid-provider-response` | 503 | yes | The provider's answer was empty, cited an unrequested source, or was not metered. |
| `cost-ceiling-exceeded` | 503 | yes | The response cost more than the ceiling and was discarded. |
| `usage-not-recorded` | 503 | yes | Usage could not be settled, so the response was discarded. |
| `audit-unavailable` | 503 | yes | The audit record of the response could not be written, so the response was discarded. The usage was already settled and stays settled, because the provider did the work. |
| `ai-generation-killed` | 503 | yes | The kill switch for AI generation is engaged for the school or for everyone. |
| `action-not-found` | 404 | yes | No proposed action with that id for this account, or it was already claimed or expired. |
| `confirmation-required` | 409 | yes | The confirmation is missing, not `confirmed: true`, older than five minutes, in the future, or the action expired. |
| `authoritative-readback-required` | 502 | yes | The action was not turned into a receipt because no authoritative readback exists. This is the answer the shipped runtime gives to every confirm. |

<!-- example:intelligence-mode-refused -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/v1/intelligence/respond' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0050' \
  -d '{"version":1,"clientState":"sandbox","tenantId":"school-a","personId":"student-a","question":"What is a derivative?","mode":"draft","category":"study","sourceIds":["s1"],"evidenceIds":["e1"],"proposedActions":[{"id":"a","label":"Add a reminder","effect":"Adds one reminder","target":"plan","class":"prepare","reversible":true,"evidenceIds":["e1"]}]}'
```

**Response** `403`

```json
{
  "code": "mode-disabled",
  "message": "This academic-integrity mode is not permitted."
}
```
<!-- /example -->

<!-- example:intelligence-invalid -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/v1/intelligence/respond' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0051' \
  -d '{"question":"hi"}'
```

**Response** `400`

```json
{
  "code": "invalid-request",
  "message": "Unsupported intelligence contract version."
}
```
<!-- /example -->

<!-- example:intelligence-confirm-again -->
**Request**

```bash
curl -s -X POST 'http://127.0.0.1:8787/v1/intelligence/actions/00000000-0000-4000-8000-000000000001/confirm' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-Id: docs-example-0053' \
  -d '{"confirmed":true,"at":"2026-10-04T12:00:00.000Z"}'
```

**Response** `404`

```json
{
  "code": "action-not-found",
  "message": "Proposed action not found for this account."
}
```
<!-- /example -->

## SCIM error details

SCIM errors carry a status and a `detail` sentence and no code. The sentences are the contract. A status of 5xx is always `503` with the fixed sentence "SCIM service is temporarily unavailable.". The shape and examples are in [SCIM-API.md](SCIM-API.md#errors).

| Status | Detail | When |
| --- | --- | --- |
| 400 | A bounded Idempotency-Key is required for SCIM mutations. | A non-GET request without an `Idempotency-Key` of 1 to 300 characters. |
| 400 | The SCIM request is not valid JSON. | The body does not parse. |
| 400 | Invalid SCIM request. | A validation failure with no more specific sentence. |
| 400 | Invalid SCIM filter. | The filter is not `userName eq "x"` or `externalId eq "x"`, or is too long. |
| 400 | Invalid SCIM user. | The user body is not an object. |
| 400 | Invalid SCIM user schema. | `schemas` does not contain the User schema. |
| 400 | Invalid SCIM user active state. | `active` is present and not a boolean. |
| 400 | Invalid SCIM group. | The group body is not an object. |
| 400 | Invalid SCIM group schema. | `schemas` does not contain the Group schema. |
| 400 | Invalid SCIM group members. | `members` is not a list, or has more than 1,000 entries. |
| 400 | Invalid SCIM group member. | A member is not an object. |
| 400 | Invalid SCIM patch. | The patch body is not an object. |
| 400 | Invalid SCIM patch schema. | `schemas` does not contain the PatchOp schema. |
| 400 | Invalid SCIM patch operations. | `Operations` is missing, empty, or has more than 100 entries. |
| 400 | Invalid SCIM patch operation. | An operation has an unknown `op`, or a `path` that is missing or not allowed for this resource. |
| 400 | Invalid SCIM patch value. | A non-remove operation has no value, or the value has the wrong type. |
| 400 | Invalid SCIM user patch. | A user patch tried to patch `members`. |
| 400 | Invalid SCIM group patch. | A group patch tried to patch `active` or `userName`. |
| 400 | Invalid SCIM … | A field was empty, longer than 300 characters or not a string. The sentence names the field: `Invalid SCIM userName.`, `Invalid SCIM external identifier.`, `Invalid SCIM displayName.`, `Invalid SCIM group displayName.`, `Invalid SCIM member identifier.`, `Invalid SCIM member display.`, or `Invalid SCIM patch <path>.` |
| 400 | A user’s externalId cannot change. Deactivate this user and create a new one. | A PUT or PATCH changed `externalId` (Postgres repository). |
| 400 | A SCIM user needs an externalId: it is how the university identifies the person. | A user was created without `externalId`. |
| 400 | A SCIM group needs the externalId the university administrator mapped. | A group was written without `externalId`. |
| 400 | A group’s externalId cannot change. | A PUT or PATCH changed a group's `externalId`. |
| 400 | A group member is not a SCIM user of this university. | A member `value` is not the id of a user of this tenant. |
| 400 | This group has not been mapped to any role by the university’s Semester administrator, so it grants nothing. Ask them to map it, then send it again. | The group's `externalId` has no active mapping. |
| 401 | A valid SCIM bearer credential is required. | No credential, a malformed one, an unknown id, a revoked or expired one, or a wrong secret. One sentence for all of them. |
| 404 | SCIM endpoint not found. | An unknown path or method, or a request outside the SCIM base. |
| 404 | SCIM user not found. | No such user in the credential's tenant. |
| 404 | SCIM group not found. | No such group in the credential's tenant. |
| 413 | The SCIM request is too large. | The body, or its declared length, is over 128,000 bytes. |
| 429 | SCIM request rate limit exceeded. | The credential's bucket is spent. |
| 503 | SCIM service is temporarily unavailable. | Any unexpected failure, including a repository that could not read or write. |

## Errors outside the envelope

These bodies are written by the entry points, not by the gateway, so they carry no `X-Request-Id`, no `X-Correlation-Id` and no `retryable`.

| Where | Status | Body | When |
| --- | --- | --- | --- |
| Vercel entry `app/api/institution/[...path].ts` | 413 | `{"error":"Request is too large."}` | The body is over 128,000 bytes. |
| Vercel entry | 503 | `{"error":"The university service is unavailable. Please try again later."}` | The runtime could not be built (a missing or malformed environment variable) or anything threw around the gateway. The cause is not returned. |
| `start.ts` | 413 | `{"error":"Request is too large."}` | The body is over 128,000 bytes. |
| `start.ts` | 500 | `{"error":"Gateway request failed."}` | Anything threw around the gateway. The cause is deliberately not returned, because it can carry a path or a query. |

The 503 on the Vercel entry is the answer to every request while a required variable is missing, including `/health/live`. A 503 with this flat body means "the service is not configured or not running", where a 503 with the envelope means "this request was refused, and `retryable` says whether to repeat it".
