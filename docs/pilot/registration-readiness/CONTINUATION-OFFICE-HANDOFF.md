# Continuation record: registration blocker routing (office handoff)

Baseline: `origin/main` at `955d9e06` (merge of #1634). Branch: `claude/eloquent-brahmagupta-5sywqo`.

## Batch position

Batch 0 (reconcile) is done for this slice. Batch 1 (identity and authorization proof) is not started. This record covers the first domain-rule increment of candidate workflow 1 (registration readiness → blocker → office case → refreshed receipt).

## Gap map for this slice (verified by reading, commit `955d9e06`)

| Item | State | Evidence |
|---|---|---|
| Readiness evaluation workflow, blockers, holds, reconciliation | Implemented | `packages/institution/src/readiness-workflow.ts`, `readiness.ts`, `app/server/institution/registration-readiness-commands.ts` |
| `registration.blocker.route` command | Declared, not implemented | `packages/platform-control/registry/capabilities/registration.readiness.json` |
| `POST /api/v1/me/registration/route-blocker` | Specified, not implemented | `docs/handoff/api/endpoints.json` (`implementationStatus: specified`, `rpc: api.route_blocker`) |
| `acad.office_handoffs`, `acad.readiness_items`, `acad.holds`, `api.route_blocker` | Absent from `supabase/migrations/` | grep, no matches |
| `blocker.route` policy action | Absent from `POLICY_ACTIONS` | `packages/institution/src/policy.ts` |
| Office handoff decision rules | **Added in this change** (pure, no persistence) | `packages/institution/src/office-handoff.ts` |

## Changed files (uncommitted working tree)

- `packages/institution/src/office-handoff.ts` (new): `OFFICE_HANDOFF` state machine; `decideBlockerRoute`; `decideHandoffAction`; `routeFingerprint`; `classifyRetry`.
- `packages/institution/src/office-handoff.test.ts` (new): tests for each refusal path, ordering, and retry classification.
- `packages/institution/src/index.ts`: one `export *` line for the new module.
- `docs/pilot/registration-readiness/CONTINUATION-OFFICE-HANDOFF.md` (this file).

`OFFICE_HANDOFF` is deliberately not added to `WORKFLOWS` in `workflow.ts`. `office-handoff.ts` imports `transition` from `workflow.ts`, so registering it there would create an import cycle.

## Verification status

Run in `app/` after `npm ci` at the repository root:

- Passed: `npx vitest run` on `office-handoff.test.ts` and `workflow.test.ts` (53 tests, then 23 after the revert check).
- Passed: `npx tsc -b` (exit 0), `npm run check:university` (exit 0), `npm run lint` (exit 0; existing warnings in unrelated files).
- Passed: revert check. Making `actorMayAct` let any office act turned `refuses another office acting on a handoff it does not own` red. The rule was then restored.
- Not run yet: `npm test` (full suite), `npm run test:shuffle`, `npm run build`.

## Decisions taken (reversible, in scope)

- Offices can act only on handoffs routed to them. They never start one.
- Only the student a handoff concerns can withdraw it.
- Resolving a handoff does not clear the readiness item. Clearance remains a source refresh or reconciliation result.
- The owning office comes from an institution-owned table, never from the client.
- A route request must name the readiness version the caller reviewed. A newer version refuses rather than routing against facts the caller never saw.

## Remaining work, in order

1. Run the gates and the revert check above. Commit and push the four files, then open a draft PR.
2. Add `blocker.route` to `POLICY_ACTIONS` with an audit event, and cover it in `policy.test.ts`.
3. Migration: `acad.office_handoffs` with tenant-scoped foreign keys, plus `api.route_blocker` as a `security definer` function with a pinned `search_path`. Add a `supabase/*.check.sql` harness and register it.
4. Gateway route `POST /v1/me/registration/route-blocker` with idempotency keyed on actor and payload, using `classifyRetry`. Add a route test.
5. Office acknowledge and resolve commands, then the source refresh that produces the refreshed receipt.
6. Action Center item and staff views. Only after 1 to 5 are verified.

## Approvals required before any of this reaches hosted environments

Migrations to any hosted Supabase project, deployments, and changes to live institutional data each need named approval for the exact target. None has been requested or given.
