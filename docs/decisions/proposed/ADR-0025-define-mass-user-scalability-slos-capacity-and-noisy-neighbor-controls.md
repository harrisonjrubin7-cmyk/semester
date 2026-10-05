# ADR-0025 · SLOs, capacity and per-tenant limits are measured on the real path before any availability or scale number is promised

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Reliability and platform owner (founder until another is named) |
| Deciders / reviewers | Founder; security owner; customer sponsor for any contractual number; counsel for SLA and uptime language in contracts and public pages (counsel required) |
| Review date | 2026-11-04 |
| Phase / gate | Phase 2 gate "multi-school activation"; Phase 1 for load-test and alerting prerequisites |
| Related | [`docs/trust/SLA.md`](../../trust/SLA.md); `MONITORING.md`; `docs/SERVICE-RELIABILITY-AND-SUPPORT-OPERATIONS.md`; `docs/PERFORMANCE-AND-LOW-END-DEVICE-PLAN.md`; `docs/REGISTRATION-DAY-MODE.md`; [`FITNESS_FUNCTIONS.md`](../../governance/FITNESS_FUNCTIONS.md) "What is not in either table"; ADR-0016, ADR-0018, ADR-0021; legal rows Q-05, Q-03; claims C-05, C-15 |
| Supersedes / superseded by | — |

> **Counsel required.** Uptime, response-time, capacity and "99.9%" statements in contracts or public pages: `LEGAL_REVIEW_QUEUE.md` Q-03 (SLA in pilot paper), Q-05 (representations); claims C-05, C-15 in `PUBLIC_CLAIMS_APPROVAL_REGISTER.md`. No target below is a promise.

## Context
- No SLA: `docs/trust/SLA.md` status `NOT_STARTED` as a commitment; formula and tables are computed by `app/src/lib/sla.ts` (`sla.test.ts`); "no retained availability history, no alert proven to reach an accountable person, and no agreed error budget".
- Probing: `.github/workflows/production-smoke.yml` hourly, no notify; status-data branch holds 75 samples vs ~24/day expected (findings-platform header); `app/public/status.html` sends no notifications (`MONITORING.md`).
- Load: DB-level only, `supabase/load.sh` in CI with pgbench scenarios `supabase/load/{demand,flags,plans,plans-same-student}.pgbench.sql` and `invariants.sql`, "registration week" paths; HTTP edge load `supabase/load/edge/edge.mjs` is manual and must target a preview branch; no k6/Artillery tool (`docs/governance/FITNESS_FUNCTIONS.md` footer; findings-platform #17). `Load` failed 4 of the last 100 main runs (findings-platform header).
- Budgets exist for the client: `app/perf-budgets.json` (first load 490,496 bytes, measured 2026-10-01) and `app/complexity-budgets.json`; the CI `Budgets` step failed once.
- Rate limits are per-surface and scattered: gateway per-identity limiter (`app/server/institution/gateway.ts:306`), lead-intake hashed-IP hourly limit (`supabase/functions/lead-intake`; `_shared/cors.ts`), AI call and dollar meters per account (`count_call`, `add_spend`, D-1231), per-tenant AI budget (`reserve_ai_budget`). No per-tenant limit for database reads, storage, or Edge Function invocations; no queue-depth control.
- Capacity facts are not in the repository: Supabase plan, compute size, connection pooler limits, region, and Vercel/GitHub Pages quotas. Production SPA is on GitHub Pages, so `app/vercel.json` headers do not apply (`infra/README.md` R-2; findings-platform #11).
- Scheduled workers run as service role over all tenants (`supabase/scheduler.sql`; `push` processes `push_queue` for all users; `integration-tick` iterates all approved connections) (privileged-surface-map §4): one tenant's backlog shares the same tick.
- Single operator, no rota (findings-platform #7); IaC unapplied, drift never checked (#10); main red about half the time (#4).
- Site copy: "24/7" support and sample 99.9% uptime labelled "Sample figures, not measurements" (`company-site/index.html:662`, `company-site/site.js:783`).

## Problem
Which service levels, capacity limits and noisy-neighbour controls are defined, how are they measured on the deployed path, and what must be true before any number is stated to a customer?

## Decision drivers
1. Numbers come from measurement on the real topology, not from formulas.
2. One tenant (or one bulk import, registration spike or AI burst) cannot starve others.
3. SLOs are tied to alert delivery and an accountable person.
4. Limits are visible to customers and enforced by the entitlement and meter mechanisms (ADR-0016).
5. Cheap before expensive: instrument and throttle before re-architecting.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. State a standard SLA (e.g. 99.9%) now | Procurement-friendly | Unmeasured; no alert; contradicts `SLA.md` | Not chosen |
| B. Internal SLOs and error budgets first; contractual numbers only after a quarter of retained history | Truthful | Slower deals | **Recommended** |
| C. Per-tenant dedicated compute | Strong isolation | Cost; operations beyond one operator | Option for a large customer |
| D. Shared infrastructure with per-tenant quotas, fair queueing and backpressure | Fits stack | Needs instrumentation | **Recommended** with B |

## Decision
**Recommended, unratified.** (1) Define a small set of user-journey SLIs (sign-in, load dashboard, save plan, registration action, AI request) with internal SLOs, set by the owner after a measured baseline; publish nothing until a quarter of retained probe history exists and an alert reaches a human (ADR-0018). (2) Add an HTTP-level load test (k6 or equivalent) for the same journeys against a preview branch with production-shaped data, run before each pilot and tracked; the pgbench scenarios stay. (3) Per-tenant controls: a tenant-keyed rate and concurrency limit on gateway and Edge Functions, a per-tenant worker fair-share in `integration-tick` and queue consumers, a per-tenant storage and active-student meter (ADR-0016), and an admission rule that a bulk import or registration-week mode throttles rather than fails. (4) Capacity record: a dated document of compute size, pooler limits, region, quotas, and the measured headroom at expected pilot size, filed in `docs/evidence/`. (5) Degraded modes are documented per journey (`docs/DEGRADED-MODE-MAP.md`) and tested. (6) Any customer-visible number (SLA %, response time, capacity) requires measurements, an approved claim (ADR-0022) and counsel review. Not ratified.

## Consequences
Positive: scale and SLA statements rest on data; a noisy tenant is bounded. Negative: instrumentation and load-test infrastructure cost; probes must run reliably; delays contractual SLAs. Harder: promising "unlimited" anything.

## Impact
- **Data / tenancy:** limits and meters keyed by tenant; queue partition per tenant (ADR-0021).
- **Security:** rate limits also reduce abuse; limits fail closed for AI spend.
- **Privacy:** metrics avoid personal data; active-student counts minimised (ADR-0017).
- **Accessibility:** degraded-mode messages must be accessible; not assessed.
- **Operations (SLO, alert, runbook, support):** alerts on SLO burn; runbook for throttling a tenant; support tiers reference these (ADR-0020).
- **Cost / commercial:** premium support and storage/overage pricing depend on measured cost per active student (ADR-0016).

## Implementation
1. Fix probe reliability and add notify (ADR-0018). 2. Record the capacity facts from the Supabase and hosting dashboards. 3. Add `supabase/load/http/` scenarios and a workflow dispatched manually first. 4. Add tenant-keyed limiter to `app/server/institution/gateway.ts` and Edge Functions that accept tenant context. 5. Fair-share loop in `integration-tick`. 6. Metrics rollup per tenant (no personal data). 7. Pilot-size rehearsal.

## Tests and verification
- Load rehearsal: simulated tenant A sends 50x normal traffic; tenant B's p95 for the dashboard journey stays inside its SLO; fails today (no per-tenant limiter) with a measurable B degradation. Control: single-tenant run with limiter on shows no regression.
- Limiter unit test: tenant A over limit is throttled; tenant B unaffected; deleting the limiter turns it red.
- Fair-share test: one tenant with 10,000 pending connections does not delay another tenant's tick beyond a bound.
- Probe-history test: SLO computation rejects windows with missing samples (the 75-vs-24/day gap).

## Fitness functions
- `alert-delivery` (#16): SLO burn alert reaches a human; `scripts/architecture/alert-delivery.mjs`.
- `main-health` (#14): red-ratio threshold.
- `drift-ran` (#15): infrastructure drift checked.
- `release-evidence` (#11): capacity record and load result dated and unexpired before a pilot.
- Proposed `scripts/architecture/tenant-fairness.mjs` (load rehearsal wrapper).

## Rollback / reversal
Limits are configuration and reversible. Contractual SLA numbers, once signed, are not cheap to reverse (counsel required).

## Open questions
Supabase plan and region; expected pilot concurrency; whether registration-week demand matches the pgbench scenarios; who carries the pager; whether k6 is acceptable under the supply-chain policy.

## Addenda
None.
