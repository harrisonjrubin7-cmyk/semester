# Semester core OS messaging client stubs
Draft TypeScript only; not compiled, tested, installed or deployed.
Requires an ES2022+ TypeScript configuration with DOM types (fetch, Headers, AbortController).
No external package dependencies. Server must enforce all real authorization and validate every body.

Endpoints are injected: no route in this package is claimed to exist.
Reconcile school scope and capabilities with existing private.has_capability. A schoolId argument
selects context only; it grants nothing. Separate grades:enter, grades:moderate, grades:release,
grades:export and grades:receive on the server as applicable.

Methods: sendMessage, referCase, proposeGrade, releaseGrade, transition, commandStatus.
Messages, inter-OS commands and domain events are different concepts. These stubs call authorized
HTTP command handlers; they do not provide a broker, inbox server, notification worker or SSE stream.

Limits of 64 KiB request, 256 KiB response and 15s timeout are illustrative client defaults,
not measured production budgets, provider limits or SLA claims. Tune after measurement.
Attachments use IDs, not inline documents. Decoder must match the actual server response;
receiptDecoder is for the proposed flat receipt shape, not an assumed deployed API envelope.

Cookie session mode requires SAME-ORIGIN deployment, server CSRF validation and appropriate
Secure/HttpOnly/SameSite cookie policy. Caller must supply the CSRF adapter.
Bearer mode requires a trusted token provider with intended audience; no token storage or refresh
implementation is supplied. Do not pass provider secrets, service-role keys or tokens to logs.
The HTTPS origin pin and redirect rejection prevent forwarding credentials to configured foreign endpoints.
Auth callback duration is not covered by HTTP timeout; bound credential retrieval in the auth adapter.

No automatic retries. A timeout, unreadable response or 5xx after dispatch may leave outcome unknown.
Query command status and reconcile; retry only with SAME idempotency key and request if supported.
Idempotency retention and replay semantics must be verified server-side.
If-Match expectedVersion refers to the resource identified by the actual endpoint; adapt for creation
and multi-resource commands rather than treating this reference precondition as universally deployed.

Verification checklist:
- typecheck in the actual repo and map imports/runtime;
- fake fetch tests for 401, 403, 409, 412, 429, 5xx, abort and timeout;
- validate bearer/cookie/CSRF/redirect behavior;
- test byte caps, streamed responses and invalid receipt decoder;
- test same-key replay and uncertain-outcome recovery against a real server;
- test forged school/resource IDs and current revocation;
- test grade lifecycle and student release privacy end to end.
