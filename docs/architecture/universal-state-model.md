# Universal state model

Status: target contract. Current UI has many good local patterns but no single enforced state type across every data-backed view.

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

Source badges, offline banners, retry views, empty-state components and sync vocabularies already exist, but names and payloads vary. Phase B should add one typed contract plus accessible shared renderers, map every route, preserve the Semester design system, and assert state/claim parity in tests.
