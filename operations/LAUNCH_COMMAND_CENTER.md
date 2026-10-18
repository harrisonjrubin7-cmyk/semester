# Semester — launch command center (Phase 0)

**Date:** 2026-10-04 · **Status:** OPERATING VIEW — it sequences work; it approves no launch · **Builds on:** [`docs/program/04-RITUALS-STATUS-ESCALATION.md`](../docs/program/04-RITUALS-STATUS-ESCALATION.md) (weekly review, escalation ladder; next weekly report due 2026-10-11), [`docs/program/02-DEPENDENCIES-AND-CRITICAL-PATH.md`](../docs/program/02-DEPENDENCIES-AND-CRITICAL-PATH.md), [`GO-NO-GO-DECISION.md`](../GO-NO-GO-DECISION.md) · **Rule:** [`NO_MORE_UNSCOPED_BUILD_RULE.md`](../docs/program/NO_MORE_UNSCOPED_BUILD_RULE.md) (proposal)

## 1. State on one screen

| | |
| --- | --- |
| Repo | `origin/main` @ `c170dcd`; tsc/lint/`check:university` exit 0; **22,707 tests passed, 0 failed** (A) |
| Live-status classes | A 0 · B 0 · C 0 · built-not-release-ready 38 · partial 35 · client-only 9 · doc-only 23 · retire 1 · unknown 3 (109 rows, script-tallied) |
| Motions | M1 YELLOW · M2 held · M3 GREEN (non-activation) · M4 RED · M5 RED |
| Customers / entity / counsel / staff | none / none / none / one person |
| Biggest engineering gaps | AI bypass (PR-01) · restore unmeasured (PR-03) · FORCE RLS/runtime role (PR-02) · no adapter (PR-08) · no telemetry (PR-10) |
| Biggest company gaps | entity · counsel · price authority · staffing · named customer |
| Open exceptions | E-1…E-5 ([scorecard](GO_NO_GO_SCORECARD.md) §5) |

## 2. Cadence

| Ritual | When | Output |
| --- | --- | --- |
| Weekly program review | Mondays (first: **2026-10-11** report) | Status counting **verified outcomes only**; scorecard re-scored; risk expiries checked |
| Risk review | with the weekly review | `LAUNCH-RISK-REGISTER.md` + [`COMPLETION_RISK_REGISTER.md`](../docs/program/COMPLETION_RISK_REGISTER.md) updated |
| Claims check | before any outbound copy | `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` row exists, approver recorded |
| Pre-merge | every PR | scope line (S1–S5); `CLAUDE.md` first step: `git fetch origin main` and grep for the thing itself |
| Escalation | per `04-RITUALS…` ladder | stop conditions below |

**Roles.** One person is evidenced. Until backups are named (PR-22) every seat below is a *single point of failure* and the center reports it as such.

## 3. Phase 1 — ordered execution plan

Order follows the program (1→10), annotated with what blocks each step and what needs **owner authorization** before an agent may act. "Evidence" is the exit artifact; a step is not done without it.

| # | Step | First actions (in-repo) | Exit evidence | Needs a human / authorization | Closes |
| --- | --- | --- | --- | --- | --- |
| 1 | **Restore drill, measured RTO/RPO** | Read `supabase/restore-drill.sh`, `restore.sh`, `RESTORE.md`; prepare a scratch/branch target plan; define witness and abort conditions | `RESTORE.md` table L295–307 filled with dated numbers; B13 relabelled | **Owner authorizes a target and witnesses**; the script targets a fixed project id, so an agent must not run it unprompted | PR-03, G-M5, FR-005 |
| 2 | **Privilege and grant hardening** | Review `database/proposed/anon_grant_reduction.sql`; write the `authenticated` allowlist; add table-privilege assertions to `supabase/grants.check.sql` | Reduction migration + passing suites; allowlist doc; classification of the 16 write tables | Owner answers Q1 (is `schools` meant to be public?) | PR-13, PR-14 |
| 3 | **Tenant AI policy at every model/tool/retrieval call** | Inventory every provider call; route `claude/index.ts` through tenant policy; wire `lib/aistatus.ts` `decideDoor`; tenant kill on every door; add a test that fails on any new direct provider `fetch`; redaction design | Test red against a reintroduced direct call, green after; kill drill covering every door | **Decision DO-3/DO-4**: BYO-key for managed accounts; counsel PL-06/PL-07 | PR-01, PR-12, A-02/03/05 |
| 4 | **Secret scanning, SAST, dependency scanning, DAST baseline, SBOM** | Make CodeQL/supply-chain required; `npm audit` blocking at high; Deno coverage; HawkScan secrets are confirmed (the job succeeded on `07c7abb`); read its scope and findings | Required-check list; green DAST run link | **Owner configures `HAWK_API_KEY` / target**; ruleset change is an owner action | PR-17, FR-003 (partial) |
| 5 | **SECURITY DEFINER forged-argument audit and hardening** | Regenerate the definer register; diff the 25 names; locate `begin_checkout` grant; write adversarial forged-argument tests for `productivity_*`, `gateway_*`, `reserve_ai_budget`, `add_spend`, `scim_gateway_*` | Register regenerated; each service-only definer has a caller-derivation test | none | PR-04, PR-15 |
| 6 | **Staging environment proof** | Run `STAGING.md` steps 2–4 on a Supabase preview branch: fingerprint compare, RLS on, secrets | Dated record; "staging proven" ticked | **Owner authorizes branch use** | PR-16 |
| 7 | **Single trusted membership-derived tenant context** — **TRACE DONE for the productivity API** ([`PHASE1_STEP7_TENANT_CONTEXT_TRACE.md`](../docs/program/PHASE1_STEP7_TENANT_CONTEXT_TRACE.md)): no entitlement bypass; API unmounted. **Open:** per-function table for the gateway and Edge Functions (grep-level only), and a mount-level test that fails if `consentGrantsFor` is derived from request data (do it with step 9) | Trace table (done for productivity); per-function table (open) | none | I-05, PR-04 (narrowed) |
| 8 | **Policy gateway adoption** | Route-by-route adoption of `decide()` (`advising`, `athletics`, `career`, `clubs`, `family`, `housing`, `money`, `registration`, `scim`) and Edge Functions; add a coverage test | "Every route passes the PDP" test (function #6) | none | I-06, PR-05 |
| 9 | **Governed productivity API adoption** — **mount DONE by #1265** (`app/api/productivity/[...path].ts`, `runtime.ts`; off unless `SEMESTER_PRODUCTIVITY=on`; principal from membership; no grant resolver) | Add the mount-level test that fails if the principal ever carries request-derived grants; extend adoption to the next route family (step 8) | Contract test through the real handler | Depends on 8 | register P-03, I-05 |
| 10 | **Runtime role / FORCE RLS where verified** | Evaluate FORCE per table against definer ownership (the `rls-coverage` header records why it was declined); design the runtime role | `D-<PR#>` decision; migration + green `rls-coverage` | **Owner decision DO-5** | PR-02, FR-004 |

**Proving rule for every step** (`CLAUDE.md`): revert the fix under the new test and watch it go red; include a control; look at the screenshot for anything visual. Run from `app/`: `npx tsc -b`, `npm run lint`, `npm run check:university`, `npm test`, `npm run test:shuffle`, `npm run build`. **Lint has zero headroom** — fix warnings before adding code.

**Phase 1 gate (program):** no cross-tenant access in API/RPC/DB/storage/search/queue/worker/AI tests; no unreviewed privilege path; no AI policy bypass; restore and rollback evidence complete; staging, release and rollback pass. **Today: NO-GO** (see scorecard G2, G3, G9).

## 4. Stop conditions (withhold activation)

Suspected secret exposure; unauthorized or cross-tenant access; material data loss; a critical accessibility barrier without an equivalent path; unavailable monitoring or support; a false public or contractual statement (`LAUNCH-RISK-REGISTER.md` escalation conditions). New this week: **a published price, savings or WCAG statement not in the claims register** (PC-1…PC-4) is a false-claim risk *today* — resolve before any outbound.

## 5. Communications

None outbound. Design-partner conversations stay inside the GREEN boundary; no customer, logo or readiness claim. Status updates are internal: the weekly report and the scorecard.

## 6. Housekeeping on this pack

- Capability class counts in §1 were tallied by script from the register's 109 rows; re-run the tally whenever a row changes class.
- No ADR is written yet. Open the pull request, then write `docs/decisions/D-<PR#>.md` for: price authority, DO-1…DO-6, FORCE RLS (`docs/decisions/README.md`).
- Step 7's productivity trace is done. Next smallest complete package: **step 5** (definer forged-argument audit: regenerate the register, diff the 25 names, locate the `begin_checkout` grant) — read-only to start, no authorization needed. Steps 1, 4, 6 are blocked on owner authorization; step 2 on Q1.
