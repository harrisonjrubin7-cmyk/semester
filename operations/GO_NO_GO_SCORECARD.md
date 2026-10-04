# Semester — go / no-go scorecard (Phase 0)

**Date:** 2026-10-04 · **Repository:** `origin/main` @ `c170dcd` · **Status:** BASELINE SCORECARD — it scores evidence; it grants no approval · **Controlling decision:** [`GO-NO-GO-DECISION.md`](../GO-NO-GO-DECISION.md) (2026-10-03). Any conflict resolves to the **more conservative** boundary.

Scoring: **PASS** = current, accepted evidence exists · **BUILT** = code/tests exist, proof does not · **OPEN** = no evidence · **N/A**. Only PASS counts toward a gate. Marks V/A/N as in [`FINAL_BASELINE_AUDIT.md`](../docs/program/FINAL_BASELINE_AUDIT.md) §1.

## 1. Motion scorecard

| Gate | M1 individual (invite, unpaid) | M2 individual paid | M3 design-partner (non-activation) | M4 paid institutional | M5 broad / mass-user |
| --- | --- | --- | --- | --- | --- |
| G1 Frozen candidate, hosted exact-SHA CI | OPEN (local green only, A) | OPEN | n/a | OPEN | OPEN |
| G2 Tenant isolation proven on target | n/a | n/a | n/a | **OPEN** (BUILT in suites, not run) | OPEN |
| G3 Restore/rollback exercised | **OPEN** (restore never run, V) | OPEN | n/a | OPEN | OPEN |
| G4 DAST clean + independent assessment | n/a | OPEN | n/a | OPEN | OPEN |
| G5 Qualified accessibility review | OPEN | OPEN | n/a | OPEN | OPEN |
| G6 Counsel-approved paper/policies | OPEN | OPEN | n/a | OPEN | OPEN |
| G7 Entity, price/signing authority, tax, payment | n/a | OPEN | n/a | OPEN | OPEN |
| G8 Staffed support, monitoring, on-call | OPEN | OPEN | n/a | OPEN | OPEN |
| G9 AI path governed | **OPEN** (bypass, PR-01) | OPEN | n/a | OPEN | OPEN |
| G10 Real connector for connected data | n/a | n/a | n/a | **OPEN** (`ADAPTERS=[]`, V) | OPEN |
| G11 Named customer scope + UAT | n/a | n/a | n/a | OPEN | OPEN |
| G12 Real telemetry + paging + SLOs | OPEN | OPEN | n/a | OPEN | OPEN |
| G13 Load/soak at HTTP level, capacity proof | n/a | n/a | n/a | OPEN | OPEN |
| G14 Claims clean (PC-1…PC-7 resolved) | OPEN | OPEN | **OPEN** (applies to demo deck) | OPEN | OPEN |
| **PASS count** | **0 / 8 applicable** | **0 / 9** | **0 / 1 applicable** | **0 / 12** | **0 / 13** |
| Controlled decision | CONDITIONAL GO / YELLOW | NO-GO (held in code) | GO / GREEN | NO-GO / RED | NO-GO / RED |
| **Phase 0 reading** | consistent | consistent | consistent **if** G14 resolved before any deck is used | consistent | consistent |

The zeros are not a criticism of the code. Most BUILT items need a human, an outside party or an authorized operation to turn into PASS (see [`LAUNCH_CRITICAL_PATH.md`](../docs/program/LAUNCH_CRITICAL_PATH.md) §1).

## 2. Engineering baseline (re-run this session, by the CI audit)

| Check | Result | Mark |
| --- | --- | --- |
| `npx tsc -b` (`app/`) | exit 0 | A |
| `npm test` (`app/`) | 1,413 files passed, 1 skipped; 22,707 tests passed, 68 skipped; 0 failed; 220 s | A |
| `npm run lint` | exit 0; **25 warnings of 25 allowed** | A |
| `npm run check:university` | exit 0 | A |
| `npm run test:shuffle`, `npm run build` | **not run in Phase 0** | — |
| `supabase/check.sh` (110 DB suites), DAST | **not run** (need PG17; need `HAWK_API_KEY`) | — |

`CLAUDE.md` says green `test` does not imply green `test:shuffle`, and consecutive green shuffle runs are weak evidence of teardown races. Neither is claimed here.

## 3. Required CI checks vs available

`.github/rulesets/main.json` requires `build`, `account-sync`, `secrets` only. Not required: `codeql.yml`, `hawkscan.yml`, `supply-chain.yml`, `infra.yml`, `docs.yml`, `production-smoke.yml` (PR-17).

## 4. The twelve architecture fitness functions

| # | Function | State | Evidence |
| --- | --- | --- | --- |
| 1 | ADR link checks for watched changes | PARTIAL | `app/src/lib/docs/docsystem.test.ts`, `developers.test.ts`; no ADR-specific checker for `docs/architecture/0001-0012`; `docs.yml` runs only docs-impact |
| 2 | Grants allowlist | EXISTS (functions) | `supabase/grants.check.sql`; **table grants not asserted** |
| 3 | RLS coverage | EXISTS | `supabase/rls-coverage.check.sql`, `app/src/lib/tablerls.test.ts` |
| 4 | Definer review | EXISTS | `supabase/definer-sweep.check.sql`, `app/src/lib/definerregister.test.ts` (proves a gate string exists, not that it is correct — DR-02) |
| 5 | Tenant boundary test | PARTIAL | inside `rls-coverage`; `docs/architecture/data-architecture/sql/tests/12_dq_cross_tenant_rules.test.sql` **not wired to CI** |
| 6 | Policy-gateway coverage | PARTIAL | `gateway.test.ts`, `policy.test.ts`; no "every route passes the PDP" sweep; `smoke:gateway` not in CI |
| 7 | AI-policy enforcement | EXISTS (gateway path) | `supabase/intelligence-policy.check.sql`, `aikillswitch.test.ts`; **nothing fails if a new direct provider call is added** |
| 8 | Audit/outbox coverage | PARTIAL | `outbox.check.sql`, `ledger-chains.check.sql`; no publisher to test |
| 9 | Accessibility contracts | EXISTS (automated) | `app/src/a11y/*`, `smoke:a11y` |
| 10 | Integration contract standards | EXISTS | `lib/integration/contract-harness.test.ts` |
| 11 | Release evidence | PARTIAL | `app/src/lib/ops/evidence.ts`; no workflow gate enforces it |
| 12 | Public-claims evidence | EXISTS | `app/src/lib/ops/claims.ts`, tests; **does not cover `company-site/site.js` wording (PC-4, PC-5)** (N: not checked whether the test scans `site.js`) |

## 5. Phase 0 gate

**Gate question (program):** *"No capability, pricing claim, customer promise, or company function is left unclassified."*

| Item | Result |
| --- | --- |
| Capabilities (109 rows, product + platform + AI + integrations + company) | Classified — [register](../docs/program/COMPLETE_CAPABILITY_REGISTER.md) |
| Pricing claims | Classified — every program baseline figure is **unapproved and conflicting**; none is a valid claim ([`COMPANY_LIVE_STATUS.md` §3](../docs/program/COMPANY_LIVE_STATUS.md)) |
| Customer promises | Classified — none permitted; no customer exists |
| Company functions | Classified — [`COMPANY_LIVE_STATUS.md`](../docs/program/COMPANY_LIVE_STATUS.md) |
| Launch blockers identified | Yes — [`READINESS_GAP_MATRIX.md`](../docs/program/READINESS_GAP_MATRIX.md), [`RISK_REGISTER.md`](../docs/program/RISK_REGISTER.md) |
| Live-status standard defined | Yes — register §classes; no capability is A/B/C |
| ADRs | **Not created.** Per `CLAUDE.md` a decision takes its pull request's number; six decisions are queued (DO-1…DO-6, PR-02, price authority) and are written after the PR is opened |
| Risks have owners | Roles yes; **backups unassigned** on every row |
| Legal queue exists | Yes — controlled queue + 12 new items |
| Phase 1 planned | Yes — [`LAUNCH_COMMAND_CENTER.md`](LAUNCH_COMMAND_CENTER.md) §3 |
| Not unclassified, but grouped | Screens (119), tables (352), definers (510), docs (306) — see exceptions |

### Dated exceptions

| ID | Exception | Owner (proposed) | Closes with | Expires |
| --- | --- | --- | --- | --- |
| E-1 | Per-file classification of 119 screens and 430 components (classified in 14 groups) | Product | Script-generated table keyed to import graph + `flags.ts` | **2026-10-11** |
| E-2 | Per-table (352) and per-definer (510) classification; 25-name reconciliation; production catalog not re-read | Security | Regenerate `docs/DEFINER-RLS-REGISTER.md`; diff names vs `database/FUNCTION_AUTHORIZATION_MATRIX.md` | **2026-10-11** |
| E-3 | `docs/` (306 files) classified by directory only | Document control | Index with status per file | 2026-10-18 |
| E-4 | Design-system spec (Ink/Parchment/Semester blue/status vocabulary) not compared to `app/src/styles/semester.tokens.json` | Design | Recorded comparison | **Phase 2 entry** |
| E-5 | DB suites and DAST not run | Security + Engineering | PG17 run of `supabase/check.sh`; HawkScan with secrets | before Phase 1 gate |

Owners are proposals for the owner to confirm; the repository evidences one person. Expiry past due returns the affected motion to NO-GO.

### Gate decision

# **PHASE 0 GATE: PASS WITH DATED EXCEPTIONS**

Reasons: every capability, pricing claim and company function is classified with evidence; blockers, risks, legal items and the Phase 1 plan exist; the controlled go/no-go is consistent with the evidence. It is **not** a clean PASS because screens, tables, definers and docs are classified in groups (E-1…E-3), the design spec is unchecked (E-4), and two suites were not run (E-5).

**What this gate does and does not allow:** Phase 1 (security, tenancy, recovery) may begin — it adds no product feature. It does **not** allow Phase 2+ work, any activation, any price or claim publication, or any statement that Semester is launched, pilot-ready, contract-ready, institution-ready, mass-user-ready, secure, accessible, operational or replacement-ready. Several Phase 1 steps need owner authorization first (`LAUNCH_COMMAND_CENTER.md` §3).

## 6. Review

Weekly with `LAUNCH-RISK-REGISTER.md`. Re-score on any new evidence. A PASS cell requires a dated evidence file or run link, not a document.
