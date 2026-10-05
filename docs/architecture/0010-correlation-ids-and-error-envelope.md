# 0010 · One id from the tap to the audit row, and one shape for every refusal

**Status:** Accepted, live in the institution gateway. Edge functions carry
neither yet; the roadmap lists them.

## Decision

Every institution-gateway response carries `X-Request-Id`, minted per request
and never anything a client sent, and `X-Correlation-Id`, which is the
client's if it sent a well-formed one (`CORRELATION_ID_PATTERN`:
8–128 characters of letters, digits, `.`, `_`, `:`, `-`) and minted
otherwise. The correlation id is written to every audit row the request
causes (`gateway_audit.correlation_id`, via `gateway_write_audit_v2`; the
SQLite journal's `audit.correlation_id`) and to the telemetry event. The
browser client (`lib/university.ts`) mints one per call and sends it.

Every refusal the gateway makes is one envelope:

```json
{ "error": { "code": "review_expired", "message": "…", "correlation_id": "…",
             "retryable": false, "user_action": { "label": "…", "kind": "…" } },
  "message": "…" }
```

`code` is a name a client may switch on; `retryable` is a statement — true
only for 429 and 503 — and a 502 from an unknown outcome is explicitly not,
because the sentence says to reconcile and a client that reads only flags must
hear the same. The top-level `message` is kept for clients written before the
envelope.

## Why

The question the specification asks operations to be able to answer is
"which audit event proves the action?", and the gateway could not: the audit
row had a tenant, an actor, an area and an event, and no way to join it to
the request, the telemetry line or the ticket. `X-Request-Id` existed and was
set after the fact, on the response only.

The envelope replaced two shapes: `{ error: "sentence" }` from the gateway
and `{ code, message }` from the intelligence service. A client reading the
first could not tell "the review expired" from "the record moved", both 409s
with sentences; a client reading the second could not tell whether to try
again. Both are the same failure — the gateway knew, and did not say.

## How it is held

`gateway.test.ts`: the id sent is the id on the response, the audit row and
the telemetry event; five malformed ids are replaced rather than echoed; a
journal file from before the column opens and takes a write; every refusal
matches the envelope; the 502 says not to retry and names a user action.
`gateway-journal.check.sql` refuses a malformed or overlong correlation id at
the database. `university.test.ts` reads the envelope and both older shapes.

## What it was chosen over

- **A sixth parameter on `gateway_write_audit`.** Rejected: two overloads a
  five-argument call cannot choose between, and a re-applied earlier
  migration would re-create the old one — the schema after two passes would
  differ from after one, which `check.sh` refuses. `_v2` sits beside it.
- **Trusting the client's id unconditionally.** Rejected: a header is a place
  to put a sentence, a script or four kilobytes, and this one lands in logs.

## What this constrains

Anything that writes an audit row for a request writes the request's
correlation id with it, or the row is not evidence. A new refusal carries a
`code` more specific than its status when the status is ambiguous. A client
retries only when `retryable` is true. Edge functions adopt both when they
next change.
