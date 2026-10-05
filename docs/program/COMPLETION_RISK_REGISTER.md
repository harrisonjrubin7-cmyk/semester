# Semester — completion-baseline risk register (PR-xx)

**Date:** 2026-10-04 · **Does not replace:** [`LAUNCH-RISK-REGISTER.md`](../../LAUNCH-RISK-REGISTER.md) (FR-001..FR-016, v0.2, 2026-10-03) and [`03-RAID.md`](03-RAID.md). This register **maps** to them and adds the risks Phase 0 found that they do not carry. Severity uses the launch register's rule: **P0** blocks every affected motion, no exception · **P1** blocks paid or supported activation · **P2** needs owner, dated mitigation, disclosure and approval · **P3** maturity.

**Owners.** Only one person is evidenced in the repo. "Owner role" is the accountable seat; **backup is `UNASSIGNED` on every row** (`OWNER-AND-ACCOUNTABILITY-MATRIX.md`, FR-006). Proposed expiry dates are *proposals for the owner to confirm*, not commitments.

## 0. Relationship to main's `RISK_REGISTER.md` (R-001…R-036)

The program asked for `docs/program/RISK_REGISTER.md`. PR #1252 merged a register at that path first (36 risks, R-001…R-036). **That file is authoritative; this one is kept beside it** under a new name and uses a different prefix (`PR-`) so the two never collide. Where a risk is already carried there, this register points at it and adds only what is new (evidence from this baseline, a later date, or a correction).

| Mine | Same risk on main | What this register adds |
| --- | --- | --- |
| PR-01 AI bypass | R-010, R-011, R-033 | exact call sites (`claude/index.ts`, `claude.ts:960,1357`, `openai.ts:186`) and `converse.ts:226` |
| PR-02 FORCE RLS / runtime role | R-005, R-006 | verified 0 `FORCE ROW LEVEL SECURITY` in all migrations |
| PR-03 restore unmeasured | R-002 | the "held" label in `DEFINER-RLS-REGISTER.md` B13; CI's restore step is a rehearsal only |
| PR-04 service-role definers trust ids | R-004, R-006 | the `q.ownerId` trace (see `PHASE1_STEP7_TENANT_CONTEXT_TRACE.md`) |
| PR-05 PDP one route family | R-019 | — |
| PR-06 pricing conflict | R-023 | the four conflicting institution price sets and the individual price ($7.99/$59 vs D-1154 $15) |
| PR-07 claims outside the register | R-024 | line citations `index.html:621,660`, `site.js:48` |
| PR-08 no live connector | R-031 | — |
| PR-09 outbox without publisher | R-009, R-019 | verified: nothing sets `published_at` |
| PR-10 no telemetry or paging | R-016 | — |
| PR-12 no redaction | R-033 | — |
| PR-13 `anon` DML + TRUNCATE | R-007 | — |
| PR-15 definer register stale | R-006, R-029 | — |
| PR-17 scanners not required | R-014, R-026 | CodeQL skips on a private repo (`codeql.yml:49`) |
| PR-20 stale inventories | R-029 | — |
| PR-21 personal contact and host | R-035 | — |
| PR-22 one person on every seat | R-018 | — |
| **PR-11, PR-14, PR-16, PR-18, PR-19, PR-23, PR-24** | *not on main* | AI evals not gated; `authenticated` grant allowlist absent; staging never proven; lint at its cap; offboarding and workflow engine unwired; design spec unchecked; latent private-repo failure of the `secrets` and CodeQL checks |

Note on `R-014` ("`main` has no live ruleset"): this register and the rest of this pack describe `secrets`, `build` and `account-sync` as *required* because `.github/rulesets/main.json` names them. That file is not evidence the ruleset is applied; treat "required" below as "named as required in the repository's ruleset file".

## 1. Mapping to the existing register

| FR | Priority | Phase 0 finding that bears on it |
| --- | --- | --- |
| FR-001 entity/authority | P0 | Confirmed ABSENT; also contradicts `ops/billing/README.md` "legal reviews complete" (C1) |
| FR-002 no customer | P0 | Confirmed: `ops/customer-commitments/README.md`, `contracts/README.md` |
| FR-003 DAST/pen test | P0 | `hawkscan` job **succeeded** on PR #1254 head `07c7abb` (so its secrets are configured); scope and findings not read; independent pen test still absent |
| FR-004 tenant isolation | P0 | 0 FORCE RLS (V); no end-to-end HTTP negative test; storage cross-tenant test not found (N) |
| FR-005 recovery | P0 | `RESTORE.md` L295–307 blank (V); register B13 labels it "held" |
| FR-006 operations | P0 | No rota; no APM/error tracking in code |
| FR-007 accessibility | P1 | Automated only; `site.js:48` over-claims (C3) |
| FR-008 commercial | P1 | Price baseline absent; four conflicting institution price sets |
| FR-009 release quality | P1 | Now measured: 1,413 files / 22,707 tests green; lint at cap 25/25 |
| FR-010 privacy/data | P1 | DSR SLA is a human daily check |
| FR-011 monitoring/support | P1 | Status page is a browser probe |

## 2. New risks from Phase 0

| ID | Sev | Risk | Evidence | Mark | Owner role | Mitigation / exit evidence | Proposed expiry |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PR-01 | **P1** | **Tenant AI policy bypass on the shared-key and browser paths** (the substance of the brief's "RISK-008"). A school-managed user can reach a model with no tenant policy, kill, budget or redaction | `supabase/functions/claude/index.ts` (`aiGenerationKilled(admin, null)`); `app/src/lib/claude.ts:960,1357`; `app/src/lib/openai.ts:186`; `converse.ts:226` (V) | V/A | Security + Engineering | Route all model calls through one enforcement point; wire `lib/aistatus.ts` `decideDoor`; tenant kill reaches every path; test that fails if a new `fetch(api.anthropic.com\|api.openai.com)` appears outside the gateway | before any institutional activation |
| PR-02 | **P1** | **No runtime role distinct from the owner; FORCE RLS = 0** (substance of "RISK-004"). Server code uses `service_role` which bypasses RLS by design; tenant safety rests on application code | 0 statements (V); `supabase/local.stub.sql:42`; `database/TENANT_ISOLATION_MATRIX.md` "Not applied" | V/A | Security | Owner decision recorded as `D-<PR#>`; if yes, migration + runtime role + passing `rls-coverage` after it | before paid pilot |
| PR-03 | **P1** | **Restore evidence is claimed "held" but never measured** | `RESTORE.md` L295–307 (V); `docs/DEFINER-RLS-REGISTER.md` B13 | V/A | Reliability | Run `supabase/restore-drill.sh` on an authorized target, fill the table, relabel B13 | before Motion 1 activation |
| PR-04 | **P1** | **Service-role-only definers trust caller-supplied tenant/owner ids** (`want_tenant`, `p_tenant`, `p_owner`, `want_user`); safe only if every server caller derives them | `public.productivity_*`, `gateway_*`, `reserve_ai_budget`, `add_spend`, `scim_gateway_*`; `app/server/productivity/http.ts:218,228,304` `q.ownerId` **traced 2026-10-04: no entitlement bypass; the API was unmounted at the baseline and is mounted since #1265 behind `SEMESTER_PRODUCTIVITY=on` with a membership-derived principal** ([`PHASE1_STEP7_TENANT_CONTEXT_TRACE.md`](PHASE1_STEP7_TENANT_CONTEXT_TRACE.md)); other service-role callers not traced | V/A | Engineering | Productivity half narrowed. Remaining: trace `gateway_*`, `reserve_ai_budget`, `add_spend`, `scim_gateway_*` callers; add forged-argument tests (`database/README.md` "not written"); add a mount-level test that fails if grants ever come from the request (step 9) | before paid pilot |
| PR-05 | **P1** | **Policy gateway is adopted by one route family**; every other institution route and Edge Function rolls its own check | `packages/institution/src/policy.ts` `decide()` used only in `app/server/productivity/service.ts` | A | Engineering | Route-by-route adoption with a coverage test | before paid pilot |
| PR-06 | **P1** | **Pricing authority conflict**: individual price differs across catalog, DB seed, site, D-1154 and the program baseline; institution price has four sources | `plans.ts:58`; `plus_price.sql`; `D-1154`; `deal-desk.ts`; `company-site/index.html:660` | V/A | Founder + finance | One approved price book; change catalog/seed/site/tests together | before any paid motion |
| PR-07 | **P1** | **Public claims out of register**: institution price bands, "save 38%", "WCAG 2.2 AA standards" for every screen, published $7.99/$59 against CLM-015 | `company-site/index.html:621,623/624,660`; `company-site/site.js:48` | A | Claims owner + counsel | Withdraw or approve per `docs/CLAIM-WITHDRAWAL-RUNBOOK.md` | immediately (public today) |
| PR-08 | P1 | **No live connector**: institutional pilot cannot ingest from any SIS/LMS | `ADAPTERS=[]` (V) | V | Engineering | Phase 8; Phase 1 only scopes the first adapter | paid pilot |
| PR-09 | P1 | **Outbox without a publisher**: events are written and never delivered or dead-lettered | `private.domain_outbox_events`; no writer of `published_at` (V) | V | Engineering | Publisher worker + DLQ + drain test | before any consumer relies on events |
| PR-10 | P1 | **No real telemetry or paging**: no Sentry/OTel; SLOs are models; no rota | `app/src/lib/sre/*`; `MONITORING.md` | A | Reliability | Choose provider; wire errors, latency, alert delivery; one tested page | before Motion 1 activation |
| PR-11 | P2 | **AI evals not release-gating; red-team not started** | `ci.yml` no eval; RT-R04/R05 "not started" | A | AI owner | Gate deterministic evals in CI; commission red team | before AI claims |
| PR-12 | P2 | **Redaction absent on the AI path** | none in `respond()` or providers | A | AI owner | Classification-aware redaction before provider | before institutional AI |
| PR-13 | P2 | **`anon` holds DML + TRUNCATE on ≈24 owner-scoped tables**; TRUNCATE ignores RLS | `database/GRANT_ALLOWLIST.md`; `database/proposed/anon_grant_reduction.sql` unapplied | A | Security | Apply reviewed reduction; extend `grants.check.sql` to table privileges | 2026-10-18 (proposed) |
| PR-14 | P2 | **`authenticated` table grants have no allowlist** (270 SELECT / 129 write; 16 write tables lack tenant/owner column) | `database/GRANT_ALLOWLIST.md` | A | Security | Write allowlist; classify the 16 | before paid pilot |
| PR-15 | P2 | **Definer register stale**: prose 180/183, table 205, production 205; 25 names unreconciled; `begin_checkout` grant not located | `docs/DEFINER-RLS-REGISTER.md`; `database/FUNCTION_AUTHORIZATION_MATRIX.md` | A/N | Security | Regenerate; diff names; check `grants.check.sql` | 2026-10-11 (proposed) |
| PR-16 | P2 | **Staging never proven equivalent** | `STAGING.md` L148/165 | A | Reliability | Fingerprint, RLS-on, secrets checks on a branch | before Motion 1 activation |
| PR-17 | P2 | **CodeQL/HawkScan/supply-chain/infra/docs are not required checks**; `npm audit` non-blocking at high; Dependabot skips Deno. (`codeql.yml:49` also skips the job unless the repo is public or `vars.CODEQL_ENABLED == 'true'`: the repo was private for about 45 minutes on 2026-10-04 and CodeQL skipped throughout; see PR-24) | `.github/rulesets/main.json`; `ci.yml:116`; `codeql.yml:49` | A/V | Engineering | Make required; block at high; cover Deno | 2026-10-18 (proposed) |
| PR-24 | P2 | **Latent: if the repo is private, the required `secrets` PR scan fails and CodeQL skips.** Observed 2026-10-04 ~23:00–23:45 UTC while the repo was private (#1254 run 37243052124; #1252 run 37242926721; CodeQL runs 76–78 skipped, #1254 run 37241815950 failed at upload). The repo was **public again by 23:45** and the re-run of `secrets` on #1254 passed at 23:51, so this is no longer happening, but it will recur on the next visibility change. Cause: the `secrets` job has `permissions: contents: read` only, and listing a PR's commits on a private repo needs `pull-requests: read`; code scanning on a private repo needs a licence | `.github/workflows/ci.yml:713-720`; `codeql.yml:49`; `search_repositories` reported `private:true` then `private:false` | V | Engineering + Security | Before any move to private: add `pull-requests: read` to the `secrets` job (read-only; keep `write` off) and settle the code-scanning licence. Verify the full-tree step runs | before the repo is made private |
| PR-18 | P2 | **Lint has zero headroom** (25/25) | `npm run lint` | A | Engineering | Fix or document warnings before adding code | before new features |
| PR-19 | P2 | **Offboarding, workflow execution, offline engine are built but unwired** | register X-11, X-13, P-03 | A | Product | Wire or retire; do not market | Phase 8 |
| PR-20 | P2 | **Stale inventories mislead planning** | `FEATURE-INVENTORY.md`, `SEMESTER_PRODUCT_COMPLETENESS_MATRIX.md`, `REGRESSION-CHECKLIST.md` | A | Document control | Regenerate or demote | 2026-10-18 (proposed) |
| PR-21 | P2 | **Support/billing contact is a personal address; app hosted on a personal GitHub Pages host** | `company-site/index.html` billing-contact row | A | Founder | Company domain + role mailboxes | before Motion 1 |
| PR-22 | P2 | **Single point of failure: one person on every seat** | FR-006; owner matrix | A | Founder | Name and train backups | before any supported activation |
| PR-23 | P3 | **Design-system spec unchecked** (Ink/Parchment/Semester blue vs tokens) | `app/src/styles/semester.tokens.json` | N | Design | Compare and record | Phase 2 |

## 3. Review rule

Reviewed weekly with `LAUNCH-RISK-REGISTER.md`. A risk closes only when the evidence is current and the authorized owner accepts it; a test or document that exists does not close a target-environment, professional-review or customer-approval risk. Expiry dates here are proposals; a risk past its expiry without a dated extension returns its motion to NO-GO.
