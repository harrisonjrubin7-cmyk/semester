# Semester — final baseline audit (Phase 0)

| Control | Value |
| --- | --- |
| Assessment date | 2026-10-04 (America/Chicago) |
| Repository state | `origin/main` at `c170dcd` (branch `claude/blissful-dirac-9kla0u`, no code changed) |
| Status | **BASELINE — records what is, decides nothing, approves nothing** |
| Controlling documents it reconciles to, and does not replace | [`GO-NO-GO-DECISION.md`](../../GO-NO-GO-DECISION.md), [`LAUNCH-RISK-REGISTER.md`](../../LAUNCH-RISK-REGISTER.md), [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md), [`LEGAL-REVIEW-QUEUE.md`](../../LEGAL-REVIEW-QUEUE.md), [`EVIDENCE-REGISTER.md`](../../EVIDENCE-REGISTER.md), [`PHASE_0_1_RECONCILIATION.md`](PHASE_0_1_RECONCILIATION.md) |
| Legal | Nothing here is a legal, compliance, security-assurance or accessibility conclusion. Those stay with qualified counsel and assessors. |

## 0. How this pack relates to the parallel baseline on main

Two sessions ran the same completion prompt. PR #1252 merged first and holds a Phase 0 of its own on main: `docs/program/BASELINE_AUDIT.md`, `CAPABILITY_TRACEABILITY_MATRIX.md`, `RISK_REGISTER.md` (R-001…R-036), `DOMAIN_OWNERSHIP_MATRIX.md`, `PHASE_GATE_LOG.md`, `ASSUMPTION_REGISTER.md`, `PHASE_1_EXECUTION_BACKLOG.md`, a restore-drill runsheet, and the four legal registers under `docs/legal/`. **Those are authoritative** for the paths they occupy. This pack was merged *beside* them:

- Four of the sixteen requested filenames collided, so mine live under new names: `COMPLETION_RISK_REGISTER.md`, `COMPLETION_DOMAIN_OWNERSHIP.md`, `COMPLETION_LEGAL_NEW_ITEMS.md`, `COMPLETION_PUBLIC_CLAIMS_SCAN.md` (all in `docs/program/`).
- What this pack adds that main's does not: the per-capability **live-status register** (109 rows), the product and company status pages, the commercial and operations assessments, the go/no-go scorecard and command center, the line-cited public-claims scan, the pricing-baseline reconciliation, the build rule, and the Phase 1 step 7 trace.
- Main's `commercial/READINESS_GAP_MATRIX.md` is a different file from this pack's `docs/program/READINESS_GAP_MATRIX.md` (same name, different directory).
- **Caveat on "required checks":** this pack names `build`, `account-sync` and `secrets` as required because `.github/rulesets/main.json` says so. Main's `R-014` reports that the ruleset is not applied. Read "required" as "named in the ruleset file".

## 1. Method and evidence confidence

Five read-only audits ran in parallel (database/tenancy, product, commercial/legal, CI/ops, AI/integrations), each reading code, not docs. Where a document and the code disagree, the code wins and the disagreement is listed in §5.

Every finding in this pack carries one of three confidence marks:

| Mark | Meaning |
| --- | --- |
| **V** | Re-read or re-run by the author of this pack, in this session, against `c170dcd` |
| **A** | Reported by an audit with exact path and symbol, from code reads or a command run in this session; not independently re-read |
| **N** | Not verified. Stated so nobody builds on it |

Counts from static scans of migrations are static counts, not production catalog reads. Production catalog figures come only from `database/*.md` and are cited as such.

## 2. Executive baseline

Semester is a large, unusually self-honest **planning-and-engineering package for a student action platform**. It is not yet an operating company. The code is broad and well tested; almost nothing is activated, staffed, contracted or independently assured.

| Measure | Value | Mark |
| --- | --- | --- |
| Type check (`npx tsc -b`, `app/`) | exit 0 | A |
| Test suite (`npm test`, `app/`) | **1,413 files passed, 1 skipped; 22,707 tests passed, 68 skipped, 0 failed**; 220 s | A |
| Lint (`npm run lint`) | exit 0 with **25 warnings against a cap of 25**: zero headroom | A |
| `npm run check:university` | exit 0 | A |
| Migrations | 180 in `supabase/migrations/` (+14 in `supabase/history/`) | A |
| Tables with RLS | **352 of 352** created in migrations | A |
| `FORCE ROW LEVEL SECURITY` statements | **0** | **V** |
| `SECURITY DEFINER` functions | 510 distinct names (278 `public`, 232 `private`); all 278 `public` pin `search_path` | A |
| DB policy suites | 110 `supabase/*.check.sql`; **passed in the CI `build` job on PR head `07c7abb` (2026-10-04, [run 37240179795](https://github.com/harrisonjrubin7-cmyk/semester/actions/runs/37240179795))**, via `supabase/check.sh` on the PostgreSQL major production runs. Not run locally | **V** (check-run conclusion read; steps per `.github/workflows/ci.yml:494-497`) |
| Screens | 119 non-test `.tsx` under `app/src/screens`; `Screen` union ≈114 members | A |
| Screens importing a server-touching module | 48 of 119 (upper bound); ≈71 use only the local store | A |
| Edge Functions | 16 directories + `_shared` | A |
| Workflows | 12 in `.github/workflows`; **required checks: `build`, `account-sync`, `secrets`** only | A |
| Native mobile app | **None.** Installable PWA (`app/public/manifest.webmanifest`, `app/public/sw.js`) | A |
| Live provider adapters (SIS/LMS) | **0**: `ADAPTERS = []`, `adapters = []` | **V** |
| Paid individual checkout | **hard-coded off**: `individualPaidAcquisitionApproved = false` | **V** |
| Customers / signed pilots / legal entity / counsel | **none evidenced** | A |
| Restore RTO/RPO | **never measured**: every row "not yet measured" | **V** |

**Verdict.** No capability meets the *Live native* definition in the program (§2 of the program: persistent, authorized, audited, accessible, monitored, supported, tested, recoverable, sellable today). The strongest items are *Built but not release-ready*. See [`COMPLETE_CAPABILITY_REGISTER.md`](COMPLETE_CAPABILITY_REGISTER.md).

## 3. Verified facts that change the plan

1. **The pricing baseline in the brief is not in the repository and conflicts with it.** `app/src/lib/plans.ts:58` has Plus at 7.99 / 59, `priceStatus: 'planned'`; the DB seed `supabase/migrations/20260929131000_plus_price.sql` matches (799 / 5900 cents); `docs/decisions/D-1154.md` (2026-10-04) replaces it with $15/month. `$8.99`, `$69`, `$18 per enrolled student`, `$30 per 1,000 units`, `12%`, `$18/TB` are absent from code and finance docs. The finance model uses different units. See [`COMPANY_LIVE_STATUS.md`](COMPANY_LIVE_STATUS.md) §3. **V** for the plan file; **A** for the rest.
2. **RISK-004 and RISK-008 do not exist under those IDs anywhere in the tree.** Their substance exists under other IDs (`LAUNCH-RISK-REGISTER.md` FR-004; `docs/SECURITY-GAP-ANALYSIS.md`). **V** (grep for both IDs returns nothing).
   - *RISK-004 substance* (runtime role / RLS bypass): **open**. 0 FORCE RLS; servers use `service_role`; no runtime login role migration. `docs/target-architecture/09-CONVERSION-PLAN.md:94` names a future `…force_rls.sql` that does not exist. A.
   - *RISK-008 substance* (tenant AI policy at model invocation): **partly fixed, still open.** Enforced in `app/server/institution/intelligence.ts` `respond()`. Bypassed by `supabase/functions/claude/index.ts` (global kill only, `aiGenerationKilled(admin, null)`; no tenant policy) and by browser-direct calls (`app/src/lib/claude.ts:960`, `:1357`; `app/src/lib/openai.ts:186`). **V** that `converse.ts:226` only uses the gateway when `governed`; **A** for ≈38 other consumer call sites going to `ask()`.
3. **The production restore drill has not run.** (CI does run a backup-and-restore *rehearsal* on a throwaway PostgreSQL on every push, `supabase/restore.sh`, which passed on `07c7abb`: it rehearses the procedure and measures nothing about the production project.) `RESTORE.md` L295–307 is blank. `docs/DEFINER-RLS-REGISTER.md` row B13 labels the claim "held" because procedure and tests exist. That label reads as readiness and is not. `STAGING.md` L148/165: steps 2–4 "have never been run". Only `ROLLBACK.md` carries measurements (frontend rollback 76–180 s over four deploys), and those are not database RTO/RPO. **V** (RESTORE.md); A (the rest).
4. **The domain outbox has no publisher.** Events are written (productivity only); nothing in `app/server` or `supabase/functions` sets `published_at`/`dead_lettered_at`. **V** (grep of both trees returns nothing).
5. **PDP adoption is one route family.** `packages/institution/src/policy.ts` `decide()` is called from `app/server/productivity/service.ts` only; other institution routes and every Edge Function carry their own checks. ADR `docs/architecture/0007-policy-decision-point.md` says adoption is incremental. A.
6. **Offline engine is tasks-only and flagged off.** `packages/offline-sync` is real; in the app it backs tasks only, behind `VITE_OFFLINE_ENGINE_TASKS`. Everything else is a localStorage working copy mirrored as one JSON blob (`app/src/lib/cloud.ts` header). A.
7. **Offboarding and workflow execution have no runtime caller.** `propose_offboarding` appears in app code only in `app/src/lib/definerregister.ts`; `workflow_versions` holds definitions with no executor. A.
8. **The AI eval harness is not a CI gate.** Deterministic cases exist (`app/src/lib/governance/model-quality.ts`); live evals are `*.live.test.ts`; `ci.yml` mentions no eval. Red-team gates RT-R04/R05 "not started" (`docs/ai-governance/10-red-team-and-launch-gates.md`). A.

## 4. What is genuinely strong (so it is not re-built)

| Area | Evidence | Mark |
| --- | --- | --- |
| RLS on every table, `search_path` pinned on every public definer, PUBLIC EXECUTE = 0 | `supabase/rls-coverage.check.sql`, `supabase/grants.check.sql`, `database/FUNCTION_AUTHORIZATION_MATRIX.md` | A |
| Hash-chained console audit and ledger chains | `private.console_audit_event`; `ledger_chain_append`/`ledger_chain_seal`; `supabase/ledger-chains.check.sql` | A |
| Institution AI gateway: policy, kill switch, budget, citation, audit-or-discard | `app/server/institution/intelligence.ts` `respond()` | A |
| Tenant derived from verified session; mismatch refused | `app/server/institution/gateway.ts`, `context.ts` `tenant_mismatch` | A |
| Registration, gradebook, regrade, grade release as server RPCs | `20260929300000_registration_transaction.sql`, `20260929310000_gradebook.sql` | A |
| Data lifecycle: export, erasure, holds, retention sweeps | `export_my_data`, `erase_account`, `legal_holds`, `supabase/retention-sweeps.check.sql` | A |
| Secret/SAST/supply-chain/SBOM workflows | `ci.yml` `secrets`, `codeql.yml`, `supply-chain.yml`, `pages.yml` | A |
| Claims control enforced by tests | `app/src/lib/ops/claims.test.ts`, `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` | A |
| One live billing acceptance purchase | `docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md` ($7.99 monthly; annual/refund/failed renewal/dispute not exercised) | A |

## 5. Differences between the brief and repository reality

| # | The brief says | Repository reality | Mark |
| --- | --- | --- | --- |
| D1 | "native Student Action Platform" | PWA only; no Capacitor/Expo/React Native | A |
| D2 | RLS enabled broadly | 352/352 true; FORCE 0 | A / **V** |
| D3 | Policy/PDP "conceptually present or partly implemented" | Real, used by one route family | A |
| D4 | Audit/hash chain, outbox/events | Chains real; outbox written, never published | A / **V** |
| D5 | Sync gateway | Tasks-only engine, flagged off | A |
| D6 | Integration hub | Framework real; zero adapters | **V** |
| D7 | RISK-004 / RISK-008 | IDs absent; substance partly open | **V** |
| D8 | Restore drill evidence "needs recording" | No drill has run | **V** |
| D9 | Student Premium $8.99 / $69 | Plus 7.99/59 "planned"; D-1154 says $15 | **V** / A |
| D10 | Institution pricing baseline | Four mutually inconsistent sets (finance model, deal-desk, site, launchkit) | A |
| D11 | Platform gateway to "mount" | `app/api/institution/[...path].ts` is one Vercel function; no evidence the gateway is deployed | A / N |
| D12 | Design system: Ink chrome, Parchment, Semester blue | Tokens at `app/src/styles/semester.tokens.json`, `DESIGN-SYSTEM-GUIDE.md`. **Brief's colour/vocabulary spec not checked against them.** | N |
| D13 | Marketplace commission 12% | Finance model 15%; strategy doc "10–15%" | A |
| D14 | "Status page" | `app/public/status.html` is a browser-side probe; empty incident feed; no hosted service/history | A |
| D15 | `FEATURE-INVENTORY.md` / `SEMESTER_PRODUCT_COMPLETENESS_MATRIX.md` as inventory | Stale: "72 members" vs ≈114; "7 of 59 reach a server" vs 48 of 119 screens importing server-touching modules | A |
| D16 | `REGRESSION-CHECKLIST.md` baseline | 551 files / 11,193 tests vs 1,413 / 22,707 today; the checklist says its baseline "stopped being a gate" | A |

## 6. Contradictions *inside* the repository (each needs an owner)

| # | Statement | Contradicted by | Action |
| --- | --- | --- | --- |
| C1 | `ops/billing/README.md`: owner "confirmed legal and independent reviews complete on 2026-10-01" | `LEGAL-REVIEW-QUEUE.md` v0.3 (counsel unassigned); `GO-NO-GO-DECISION.md` | Treat as self-attestation without counsel evidence; correct the README (PL-01) |
| C2 | `DEFINER-RLS-REGISTER.md` B13 "held" | `RESTORE.md` L295–307 | Relabel; PR-03 |
| C3 | `company-site/site.js:48` "Every screen uses … WCAG 2.2 AA standards" | CLM-007/008; CI: "not a formal WCAG audit" | Reword to a target; PL-04 |
| C4 | `company-site/index.html:660` institution price bands, `:621` "save 38%" | CLM-015 prohibits publishing prices; D-1154 supersedes the Plus price | Withdraw or approve; PL-03 |
| C5 | `DEFINER-RLS-REGISTER.md` prose "180/183" | its own table (205 rows) and production (205) | Regenerate; 25 names unreconciled |
| C6 | `database/README.md` "106 suites" | repo has 110 | Update |

## 7. Evidence that does not exist (stated so no one cites it)

No customer, signed pilot, legal entity, bank, insurance, domain-ownership evidence, qualified counsel, penetration test, accessibility assessor, VPAT, SOC 2 report, restore measurement, staging-equivalence proof, on-call rota, hosted status service, APM/error tracking (no Sentry/OTel in code or dependencies), HTTP-level load test, visual-regression suite, or CI-gated AI evaluation. Sources: `ops/customer-commitments/README.md`, `contracts/README.md`, `MONITORING.md`, `STAGING.md`, `RESTORE.md`, CI audit §4–§7.

## 8. Coverage and honest limits of this baseline

| Surface | Depth | Exception |
| --- | --- | --- |
| Capabilities / domains | Every one classified ([register](COMPLETE_CAPABILITY_REGISTER.md)) | none |
| Screens (119) | Classified in 14 groups by persistence authority, from import-graph greps | **E-1**: no per-file table |
| Tables (352) / definers (510) | Counted and checked against existing matrices; not classified individually here | **E-2**: delegated to `docs/DEFINER-RLS-REGISTER.md` + `database/`; 25-name reconciliation open |
| Docs (306 in `docs/`) | Classified by directory/purpose | **E-3** |
| Design system | Tokens located; brief's spec not compared | **E-4** |
| DB suites, DAST | Not run locally. **Both ran green in CI on `07c7abb`** (`build`; `hawkscan` job 111547218772). The HawkScan scope and findings were not read | **E-5**, narrowed to: read the HawkScan output |
| Production catalog | Not read | E-2 |

Dated exceptions E-1…E-5 are in [`../../operations/GO_NO_GO_SCORECARD.md`](../../operations/GO_NO_GO_SCORECARD.md) with owners and expiry.
