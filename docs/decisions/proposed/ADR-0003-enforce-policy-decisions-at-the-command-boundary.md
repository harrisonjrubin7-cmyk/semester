# ADR-0003 · Every state-changing command asks the one policy decision point before it runs

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Platform security architect (authorization) |
| Deciders / reviewers | Founder; security owner; database owner |
| Review date | 2026-11-04 |
| Phase / gate | Phase 1 (baseline and ratchet file); Phase 2 (ratchet upward) |
| Related | `docs/architecture/0007-policy-decision-point.md`; `docs/platform/adr/commands-commit-record-audit-and-event-together.md`; `docs/platform/adr/policy-engine-declares-actions-and-delegates-institution-ones.md`; `findings-platform.md` #6; `FITNESS_FUNCTIONS.md` #6; ADR-0002, ADR-0007, ADR-0010 |
| Supersedes / superseded by | — (completes the adoption that `0007` leaves "incremental") |

## Context
- `docs/architecture/0007` accepts the vocabulary and evaluator `decide(AuthorizationRequest)` in `packages/institution/src/policy.ts`, and says adoption by route is incremental (tracker `docs/ZERO-TRUST-EVENT-API-OBSERVABILITY-ROADMAP.md`).
- Measured 2026-10-04: `grep -rn "\bdecide\b" app/server app/api --include=*.ts` outside tests finds one call, `app/server/productivity/service.ts:380`. `app/server/institution/*.ts` has 29 non-test files, none calls it. `@semester/platform` is imported by no production file (`FITNESS_FUNCTIONS.md` #6).
- `app/src/architecture/architecture.test.ts` ratchets import direction, not policy use. No metric tracks adoption.
- The `ai.retrieve_source` rule exists (`packages/institution/src/policy.ts:75,272`) but is not called from the AI path (`ai-policy-enforcement-map.md` §5).
- Authorization elsewhere is each door's own credential check: all 16 Edge Functions set `verify_jwt=false` and are the only gate (`supabase/config.toml`; `.github/workflows/functions.yml:239`; `privileged-surface-map.md` §4); gateway routes check role in `app/server/institution/*`.
- In the database, 205 authenticated-callable definers gate by `auth.uid()` or `private.has_capability` (`database/FUNCTION_AUTHORIZATION_MATRIX.md`); gates are structural, "right id, wrong owner" is undetected by `supabase/definer-sweep.check.sql`.

## Problem
Where is policy evaluated for a state-changing command, so that a new handler cannot ship without being evaluated and a denied decision is recorded?

## Decision drivers
1. No sensitive mutation reaches storage without a decision whose inputs include a server-verified tenant (ADR-0002).
2. Adoption is measurable and cannot go backwards.
3. Database RLS stays the last line (`docs/architecture/0002`), not replaced.
4. Do not stall pilot work on a rewrite of all 16 functions.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. DB-only authorization (today for the browser path) | Strongest, already tested in 110 suites | Cannot express AI, export or cross-system rules; Edge/gateway code paths with service key skip it | Kept as layer 2, insufficient alone |
| B. External policy engine (OPA/Cedar) | Mature, testable | New runtime and ops burden for a one-operator team (`findings-platform.md` #7) | Rejected for now; `decide()` is already specified |
| C. Per-framework middleware | Easy to apply | Hides action vocabulary; drifts from `policy.ts` | Rejected |
| D. `decide()` in a command runner (`runCommand`: parse, authorize, commit record + audit + event) | One place; matches `docs/platform/adr/commands-commit...` | Postgres unit of work does not exist yet | Chosen, phased |

## Decision
**Recommended, unratified; no agent can accept it.**
1. A handler under `app/server/**` or `supabase/functions/**` that mutates data must call `decide()` (or run through `runCommand`) with actor, verified tenant, action, and resource classification, or appear on a dated exempt list with an owner.
2. Default deny for an action not in the policy catalog.
3. Commit `scripts/architecture/policy-adoption.baseline.json` with the measured ratio (1 module today) and ratchet only upward.
4. Denials write an audit row (ADR-0007). Security-definer RPCs keep their in-body gate; they are layer 2, listed in the register.
5. First adopters: gateway routes that touch records or AI (ADR-0005), then exports and role changes (ADR-0010).

## Consequences
Positive: one auditable vocabulary; adoption shows in CI. Negative: latency of an extra evaluation per command; policy and SQL gates can disagree and need a conformance test. Harder: shipping a one-off Edge Function.

## Impact
- **Data / tenancy:** tenant is an input, not a filter (ADR-0002).
- **Security:** removes "each door checks its own credential" as the only control.
- **Privacy:** classification on the resource enables per-class decisions.
- **Accessibility:** none.
- **Operations (SLO, alert, runbook, support):** denial rates become an operational signal; needs `alert-delivery` (ADR-0012).
- **Cost / commercial:** none.

## Implementation
1. Write `scripts/architecture/policy-adoption.mjs`; record baseline.
2. Wrap gateway handlers (`app/server/institution/gateway.ts`) first; pass `TenantContext`.
3. Add a conformance test: for each action in `policy.ts`, the SQL gate and `decide()` agree for owner, member, stranger, other-school.
4. Move Edge Function mutations behind the helper, one function per pull request.

## Tests and verification
- New handler that mutates without `decide`: `policy-adoption` fails. Prove by adding a dummy handler, then removing it.
- Ratchet: lower the baseline by one in a test branch; check fails.
- `policy.test.ts`: unknown action returns deny; cross-tenant request returns deny; a request with a client-supplied tenant that differs from the verified one returns deny.
- Control: `app/server/productivity/service.ts` must count as adopted (ratio is not zero).

## Fitness functions
- `policy-gateway adoption` (`scripts/architecture/policy-adoption.mjs` + `policy-adoption.baseline.json`): ratio below baseline, or an unexempt mutating handler; CI `build`.
- `definer` (`scripts/architecture/definer-count-drift.mjs`): definer counts disagree across migrations, register, allowlist.
- `tenant-boundaries`: see ADR-0002.

## Rollback / reversal
Remove the ratchet and exempt list; handlers keep working because `decide()` is additive. Not cheap after handlers rely on `runCommand` ordering (parse, authorize, commit).

## Open questions
- Whether `packages/platform` (imported by no production file) is the vehicle or `packages/institution` alone.
- Latency budget per `decide()` call is unmeasured.

## Addenda
(none)
