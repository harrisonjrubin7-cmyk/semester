# Universal state model

Status: implemented incrementally. `ReadEnvelope` is the typed, fail-closed contract for the first data-backed routes, and shared renderers cover loading, empty, error, offline and permission-denied states. Route-wide adoption and enforcement remain open.

| State | Required behavior | Never imply |
| --- | --- | --- |
| `loading` | Progress/skeleton; retain safe prior work | Empty or failed |
| `empty` | Explain why and provide a next action | Data exists |
| `connected` | Source, scope and last verification | Official without authority |
| `syncing` | In-progress detail and safe continuation | Complete |
| `stale` | Freshness warning and manual/retry route | Current |
| `offline` | What works locally, what waits, preserved work | Submitted/delivered |
| `permission_denied` | Non-leaking boundary and safe next action | Resource existence/content |
| `unavailable` | Dependency reason and native/official fallback | User fault |
| `error` | Human message, preserved work, retry/support and correlation ID | Raw exception/secret |
| `pending_approval` | Approver class, reason and next action | Approved |
| `draft` | Editable and unsent/unpublished | Submitted, paid or official |
| `verified` | Verifier, scope, method and time | Universal correctness |
| `archived` | History and retention treatment | Erased |
| `deleted` | Erased, held, retained or scheduled status | Immediate erasure without evidence |

## Required payload and transitions

Every data-backed state resolves a safe title/explanation, source, source time, checked time, tenant/scope, recovery action, support route, correlation ID and work-preservation result. Protected content stays out of generic diagnostics and analytics.

- `loading → empty|connected|stale|offline|permission_denied|unavailable|error`.
- `connected → syncing → connected|stale|offline|error`.
- `draft → pending_approval|verified|archived|deleted`; provider-owned submissions require an authoritative receipt.
- Client-side role changes cannot create `permission_denied → connected`.
- Unknown states fail closed to `unavailable`, never `connected` or `verified`.

`app/src/lib/read/envelope.ts` owns the typed contract and claim-safe projection. `ReadState` maps it to shared accessible renderers, including a non-leaking `PermissionState`, on Today, Calendar, Me and Mine. `ModuleGateState` uses the same permission renderer for Registration and Gradebook when a school pauses a module, a person is signed out or the account has no school. The remaining work is to map every data-backed route, consolidate older local vocabularies and enforce state/claim parity across that route inventory.
