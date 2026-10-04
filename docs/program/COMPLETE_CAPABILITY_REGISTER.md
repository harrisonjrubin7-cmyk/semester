# Semester — complete capability register (Phase 0)

**Assessment date:** 2026-10-04 · **Repository:** `origin/main` @ `c170dcd` · **Companion:** [`FINAL_BASELINE_AUDIT.md`](FINAL_BASELINE_AUDIT.md)

This register is keyed to **verified code**, not to claims. It does not replace [`docs/CAPABILITY-ACTIVATION-REGISTER.md`](../CAPABILITY-ACTIVATION-REGISTER.md) (60 CAP rows, generated from `app/src/lib/governance/capability-governance.ts`), which governs L0–L9 maturity. This one answers a different question: *what class is each capability in today, and what separates it from the next class.*

## Classes (the program's ten, plus the A–D live-status tiers)

| Class | Meaning here |
| --- | --- |
| **Live native** (A) | Meets all of program §2-A. **Nothing qualifies today.** |
| **Live connected** (B) | Native + approved, activated tenant connector with health/reconcile/retry/dead-letter. **Nothing qualifies** (`ADAPTERS = []`). |
| **Live human-governed** (C) | Native workflow + staffed, auditable human queue operating today. **Nothing evidenced** (no staff, no rota). |
| **Built but not release-ready** | Real server/engine code with tests; held by flag, hold, missing evidence, unstaffed support, or unaccepted review |
| **Partially implemented** | Real code for part of the job; a material part is client-only, flagged off, or unwired |
| **Client-only/mock** | Persists on the device (localStorage/IndexedDB/seed) or is a fixture; no server authority |
| **Documented but unimplemented** | Exists as a document or typed registry that nothing reads at runtime |
| **Not marketed/not enabled** (D) | Behind a flag/hold; must not be sold. Applies *in addition* to a class above |
| **Retire candidate** | Superseded or duplicate |
| **Unknown/investigate** | Not verified |

**Marks:** V = verified by author in this session · A = audit-reported with path/symbol · N = not verified.
**Owner column** is a *role*. The only person evidenced anywhere in the repo is Harrison Rubin, primary on nearly every seat; backups are `UNASSIGNED` (`OWNER-AND-ACCOUNTABILITY-MATRIX.md`, `LAUNCH-RISK-REGISTER.md` FR-006). Ownership detail: [`DOMAIN_OWNERSHIP_MATRIX.md`](DOMAIN_OWNERSHIP_MATRIX.md).

## Summary

| Class | Count |
| --- | --- |
| Live native | 0 |
| Live connected | 0 |
| Live human-governed | 0 |
| Built but not release-ready | 38 |
| Partially implemented | 35 |
| Client-only/mock | 9 |
| Documented but unimplemented | 23 |
| Retire candidate | 1 |
| Unknown/investigate | 3 |
| **Total** | **109** |

Counts are tallied by script from the rows below (class = the first matching class name in each row's cells). Re-run before relying on them.

(Every row also carries the D tier "not marketed/not enabled" unless it says otherwise; `GO-NO-GO-DECISION.md` authorizes no activation.)

## 1. Platform, security, tenancy

| ID | Capability | Class | Evidence | Gap to next class | Owner role |
| --- | --- | --- | --- | --- | --- |
| I-01 | RLS on all tables | Built but not release-ready | 352/352 `enable row level security`; `supabase/rls-coverage.check.sql` (A) | No cross-tenant negative suite *run*; FORCE = 0 (V) | Security |
| I-02 | FORCE RLS / non-BYPASSRLS runtime role | Documented but unimplemented | 0 statements (V); `docs/target-architecture/09-CONVERSION-PLAN.md:94`; `database/TENANT_ISOLATION_MATRIX.md` "Not applied" | Owner decision + migration + role | Security |
| I-03 | SECURITY DEFINER hardening | Built but not release-ready | 278/278 public pin `search_path`; `supabase/definer-sweep.check.sql`; `app/src/lib/definerregister.ts` (A) | 25 names unreconciled; forged-argument tests not written (`database/README.md`) | Security |
| I-04 | Grants allowlist (functions) | Built but not release-ready | `supabase/grants.check.sql` (1,013 lines) (A) | Table grants not asserted; `anon` DML+TRUNCATE on ≈24 tables; `database/proposed/anon_grant_reduction.sql` unapplied | Security |
| I-05 | Tenant context from membership | Built but not release-ready | `app/server/institution/gateway.ts`, `context.ts`, `membership.ts` (A) | Productivity API traced, see [`PHASE1_STEP7_TENANT_CONTEXT_TRACE.md`](PHASE1_STEP7_TENANT_CONTEXT_TRACE.md) (V): owner never taken from the request for writes; reads gated by the PDP; **not mounted**. Gateway and Edge Functions grep-level only | Engineering |
| I-06 | Policy decision point | Partially implemented | `packages/institution/src/policy.ts` `decide()` used only by `app/server/productivity/service.ts` (A) | Every other route/Edge Function bypasses | Engineering |
| I-07 | Audit hash chain / ledger seals | Built but not release-ready | `private.console_audit_event`, `ledger_chain_append`, `ledger-chains.check.sql` (A) | Mutable financial tables outside chain (`docs/commercial/REVENUE-OPERATIONS-ARCHITECTURE.md`) | Security |
| I-08 | Domain outbox | Partially implemented | `private.domain_outbox_events`; writers: productivity only; **no publisher** (V) | Publisher worker, DLQ, drain evidence | Engineering |
| I-09 | Feature flags / kill switches | Built but not release-ready | `app/src/lib/flags.ts` (21 `FLAGS`, all `defaultEnabled:false`); `feature_kill_switch`; `_shared/killswitch.ts` (A) | Kill switch reaches gateway + shared-key function only (see A-03) | Engineering |
| I-10 | Restore / recovery | Documented but unimplemented | `RESTORE.md` L295–307 unmeasured (V); `supabase/restore-drill.sh` exists | Run drill, record RTO/RPO | Reliability |
| I-11 | Staging environment | Documented but unimplemented | `STAGING.md` L148/165 "never been run"; Terraform `infra/terraform/envs/staging` unverified applied (N) | Fingerprint match, RLS on, secrets | Reliability |
| I-12 | Rollback | Built but not release-ready | `ROLLBACK.md` 76–180 s ×4 deploys; `app/src/lib/rollback.test.ts` (A) | Single owner; DB rollback untested | Reliability |
| I-13 | Secret scanning | Built but not release-ready | `ci.yml` `secrets` (required check); `.gitleaks.toml` (A) | none material | Security |
| I-14 | SAST | Built but not release-ready | `.github/workflows/codeql.yml` (not a required check) (A). **As of 2026-10-04 23:12 UTC the repository is `private: true` (V) and `codeql.yml:49` runs the job only if the repo is public or `vars.CODEQL_ENABLED == 'true'` (V), so CodeQL now *skips* on main and PRs; one PR run (#1254, run 37241815950) failed at upload with "Code scanning is not enabled for this repository"** | **No SAST is currently running.** Decide visibility and whether code scanning is licensed for a private repo; set `CODEQL_ENABLED` only if so; then make it required | Security |
| I-15 | Dependency scanning | Built but not release-ready | `ci.yml:98-117` non-blocking at high; `supply-chain.yml` blocks at critical; Dependabot skips Deno (A) | Block at high; cover Deno | Security |
| I-16 | DAST baseline | Built but not release-ready | `hawkscan.yml`, `stackhawk*.yml`; fails closed without `HAWK_API_KEY` (A); **`hawkscan` job succeeded on PR #1254 head `07c7abb`** (V), so the key is configured | Scope and findings of the run not read; independent assessment still absent | Security |
| I-17 | SBOM | Built but not release-ready | `pages.yml:444`, `supply-chain.yml:87-139` (A) | none material | Security |
| I-18 | Rate limiting | Built but not release-ready | `app/server/institution/rate-limit.ts`; `20260928230000_direct_rate_limits.sql` (A) | Institution gateway only; Edge Functions unverified (N) | Engineering |
| I-19 | Load / soak / capacity | Partially implemented | `supabase/load/` pgbench in CI (A) | No HTTP-level test; `sre/capacity.ts` says proof sizes unproven | Reliability |
| I-20 | Observability / APM / paging | Documented but unimplemented | No Sentry/OTel; `MONITORING.md` "no rota"; `app/src/lib/sre/*` are models (A) | Real telemetry and alert delivery | Reliability |
| I-21 | Synthetic monitoring | Built but not release-ready | `production-smoke.yml` hourly; institutional probe skipped without vars (A) | Retained history; institutional target | Reliability |
| I-22 | Status page | Partially implemented | `app/public/status.html` browser-side probe; empty `status-incidents.json` (A) | Hosted service with history | Support |
| I-23 | Fitness-function suite | Partially implemented | 12-function audit in [`GO_NO_GO_SCORECARD`](../../operations/GO_NO_GO_SCORECARD.md) §4 (A) | ADR-link, tenant-boundary, PDP-coverage, release-evidence gates absent or partial | Engineering |
| I-24 | CI required checks | Partially implemented | `.github/rulesets/main.json`: `build`,`account-sync`,`secrets` only (A) | CodeQL/hawk/supply-chain/infra/docs not required | Engineering |

## 2. Student product

| ID | Capability | Class | Evidence | Gap | Owner role |
| --- | --- | --- | --- | --- | --- |
| P-01 | Onboarding / accounts / privacy | Partially implemented | `screens/Onboarding.tsx`, `Account.tsx`, `lib/cloud.ts`, `delete-account` (A) | Server copy is one JSON blob (`state`), not per-entity rows | Product |
| P-02 | Today | Client-only/mock | `screens/Today.tsx` no remote import; `domains/today` (A) | Derived from local state | Product |
| P-03 | Tasks | Partially implemented | `domains/tasks`, `packages/offline-sync`, `lib/sync/engine/tasks*.ts` (A) | Engine behind `VITE_OFFLINE_ENGINE_TASKS`, off by default; task writes also route through the tasks domain behind `VITE_DOMAIN_TASKS` (`app/src/lib/experience-flags.ts:106`, default false; merged in [#1149](https://github.com/harrisonjrubin7-cmyk/semester/pull/1149) after this baseline's first read) | Product |
| P-04 | Calendar / feeds | Partially implemented | `functions/calendar`, `fetchcal`, `domains/calendar` (A) | Events local/blob; no Google/Graph connector | Product |
| P-05 | Reminders / notifications | Partially implemented | `lib/push.ts`, `functions/push`, `push_queue` (A) | Web Push only; no APNs/FCM | Product |
| P-06 | Goals / notes | Client-only/mock | `state` slices; localStorage (A) | Blob mirror only when signed in | Product |
| P-07 | Docs / sheets / decks | Client-only/mock | `screens/Write.tsx`, `Sheet.tsx`, `Deck.tsx`; `lib/docx.ts`,`xlsx.ts`,`pptx.ts` (A) | Local engines + real OOXML export; no server doc store, no collaboration | Product |
| P-08 | Files | Client-only/mock | `lib/files.ts`, `lib/idb.ts`; `cloud.ts` header "not synced" (A) | No storage tier; no quota metering | Product |
| P-09 | Search | Client-only/mock | `screens/Search.tsx` (A) | No server index | Product |
| P-10 | Offline sync (general) | Partially implemented | `packages/offline-sync` (HLC, CRDT, vault, wipe); `public/sw.js` (A) | Only tasks use it; flagged off | Engineering |
| P-11 | Mail / Maps | Client-only/mock | no remote import (A) | Seed/local | Product |
| P-12 | Export / deletion | Built but not release-ready | `export_my_data`, `erase_account`, `legal_holds`; `docs/drills/erasure-drill-2026-09-30.md` (A) | DSR SLA is a human daily check; no worker | Privacy |
| P-13 | Student Premium billing | Built but not release-ready | `functions/billing-*`, `_shared/billing*.ts`; **hold** `individualPaidAcquisitionApproved=false` (V); one $7.99 live acceptance (A) | Price conflict; annual/refund/failed-renewal/dispute unexercised; terms/refund policy unreviewed | Commercial |
| P-14 | Entitlement enforcement | Partially implemented | `docs/ENTITLEMENT-RESOLUTION.md` "shadow, enforces nothing"; `lib/membership.ts` reads `subscriptions` (A) | Gate Plus features | Product |
| P-15 | Help / support tickets | Partially implemented | `lib/supporttickets.ts`, `support-reply-notify`, 12 articles `docs/support/articles` (A) | Unstaffed; no SLA (`docs/legal/SUPPORT-POLICY-DRAFT.md`) | Support |
| P-16 | PWA / mobile responsive | Built but not release-ready | `manifest.webmanifest`, `RESPONSIVE-CONTRACTS.md` (A) | No native shell; real-device coverage limited (FR-013) | Design |
| P-17 | Accessibility settings / modes | Built but not release-ready | `app/src/a11y/` (18 files), `smoke:a11y` (A) | No manual AT evaluation; no ACR/VPAT | Design |
| P-18 | Visual regression | Documented but unimplemented | none (A) | Screenshot-diff suite | Design |

## 3. Academic and learning

| ID | Capability | Class | Evidence | Gap |
| --- | --- | --- | --- | --- |
| L-01 | Catalog / terms | Partially implemented | `data/catalog.ts` static; `registrar_put_term/section` (A) | Live path needs tenant gateway |
| L-02 | Registration / holds / waitlist | Built but not release-ready | `20260929300000_registration_transaction.sql`; `lib/enrollment/client.ts` (A) | No tenant; SIS not connected |
| L-03 | Degree / graduation | Partially implemented | `lib/record/api.ts`, `graduation-cloud.ts` (A) | Records authority undefined without SIS |
| L-04 | Academic record + corrections | Built but not release-ready | `academic_record_ledger`; `lib/records.ts` legacy local (A) | Two record paths |
| L-05 | Gradebook / release / regrade | Built but not release-ready | `20260929310000_gradebook.sql`; `gradebook_enter/release/queue_passback`; `screens/Gradebook.tsx` (A) | Official writes never-queued; no tenant |
| L-06 | Course workspace / assignments | Partially implemented | `screens/Courses.tsx`, `lib/coursestudio.ts` (A) | Authoring local |
| L-07 | Course AI rules | Built but not release-ready | `course-agent-policy.ts`; `20261001185348_approved_source_policy_scope.sql` (A) | Gateway path only |
| L-08 | Advising / faculty / registrar workflows | Partially implemented | `lib/advisor-shares.ts`, `server/institution/advising.ts` (A) | No staffed route |
| L-09 | Study tools | Client-only/mock | `StudyStudio`, `lib/generate.ts` via `ask()` (A) | Ungoverned AI path (A-02) |
| L-10 | Core/Connect modes | Built but not release-ready | `tenant_module_mode`, `apply_module_mode`, `module_mode.check.sql` (A) | No tenant |
| L-11 | Reconciliation | Partially implemented | `lib/integration/reconcile.ts` (A) | No live source |
| L-12 | Study-room booking | Documented but unimplemented | `lib/flags.ts:251` "Not implemented; the flag exists so the gate does" (A) | — |

## 4. AI

| ID | Capability | Class | Evidence | Gap |
| --- | --- | --- | --- | --- |
| A-01 | Institution AI gateway | Built but not release-ready | `app/server/institution/intelligence.ts` `respond()`; OpenAI only (`onlyOpenAI`) (A) | Gateway deployment unverified (N); Anthropic path not behind it |
| A-02 | Consumer AI (≈39 consumers of `ask()`) | Partially implemented | `app/src/lib/claude.ts:888-970`; `converse.ts:226` `governed` (V) | ≈38 sites bypass gateway; BYO key/proxy ungoverned |
| A-03 | AI kill switch | Partially implemented | `_shared/killswitch.ts`; `app/scripts/killswitch-drill.mjs`; `docs/evidence/ai/killswitch-drill-2026-09-29T22-51-50-121Z.json`; `lib/aistatus.ts` `decideDoor` unimported (A) | Doesn't reach BYO/proxy/OpenAI-direct |
| A-04 | AI budgets / metering | Built but not release-ready | `reserve/settle/release_ai_budget`; `add_spend`; `20261004170000_ai_spend_meter.sql` (A) | Client-held keys unmetered; no overage billing |
| A-05 | Redaction before model | Documented but unimplemented | none on AI path; `community/pii.ts` unrelated (A) | Build |
| A-06 | Citations / source disclosure | Built but not release-ready | `respond()` requires `citedSourceIds`; `src/intelligence/Disclosure.tsx` (A) | Direct path has none |
| A-07 | Retrieval policy | Partially implemented | `load_approved_source_content`; `ai-retrieval.test.ts` (A) | No classification-tier check, freshness or ranking |
| A-08 | Tool broker / action confirmation | Documented but unimplemented | `lib/governance/ai-tools.ts` "nothing at runtime reads it"; gateway `execute` returns `{verified:false}` (A) | Server broker TB-02+ |
| A-09 | AI evaluations | Partially implemented | `governance/model-quality.ts` (15 cases); `*.live.test.ts` (A) | Not a CI gate |
| A-10 | AI safety / red-team | Documented but unimplemented | `docs/ai-governance/10-red-team-and-launch-gates.md` RT-R04/05 "not started" (A) | Independent red team |
| A-11 | Tenant AI console | Partially implemented | `ai_policy`; Configuration Studio (flag off) (A) | Console sections doc-only |
| A-12 | AI incident response | Partially implemented | `docs/ai-governance/07-…`; one drill (A) | 10-lever ladder is doc |

## 5. Campus, family, finance, career, marketplace

| ID | Capability | Class | Evidence | Gap |
| --- | --- | --- | --- | --- |
| C-01 | Community / messaging / orgs | Partially implemented | `community/client.ts` (71 DB calls); `lib/moderation.ts` (A) | Staffed moderation + escalation absent |
| C-02 | Classmates / groupwork | Partially implemented | `lib/classmates.ts`; `MVP-GAP.md` reports not moderated (A) | Moderation |
| C-03 | Campus directory/maps/events | Client-only/mock | `data/campus.ts`; `Maps` (A) | No source |
| C-04 | Guardian / family | Built but not release-ready | `20260930233000_k12_guardians.sql`; `lib/familyshare.ts`; `server/institution/family.ts` (A) | High-risk class; counsel (minors) open |
| C-05 | Safety reporting / trust-safety | Partially implemented | `docs/CAMPUS-ESCALATION-POLICY.md`, `CRISIS-RESPONSE-RUNBOOK.md`; `trust-room` function (A) | No staffed rota |
| C-06 | Student accounts / bills / payment plans | Built but not release-ready | `lib/finance/*`; `student_accounts`, `student_payment_plans` (A) | University payment is a link-out; no institution collections workflow |
| C-07 | Financial support | Documented but unimplemented | `docs/FINANCIAL-READINESS-WORKSPACE.md` (A) | Unverified in code (N) |
| C-08 | Dining ordering | Partially implemented | `lib/dining/client.ts` `dining_orders` (A) | No provider |
| C-09 | Career / portfolio | Client-only/mock | `screens/Career.tsx` (1,475 lines, local) (A) | — |
| C-10 | Opportunities / listings | Partially implemented | `lib/listings.ts` `moderate_opportunity` (A) | — |
| C-11 | Marketplace (orders, payouts, disputes) | Documented but unimplemented | `docs/commercial/MARKETPLACE-AND-PARTNERSHIP-STRATEGY.md`; `MARKETPLACE-AND-PARTNER-TERMS` draft (A) | No transaction code found (N) |
| C-12 | Alumni / mentors / credential wallet | Unknown/investigate | `docs/CREDENTIAL-WALLET.md`, `server/institution/career.ts` | Not audited |

## 6. Institution control plane and integrations

| ID | Capability | Class | Evidence | Gap |
| --- | --- | --- | --- | --- |
| X-01 | Connector framework | Built but not release-ready | `lib/integration/{pipeline,retry,health,reconcile,vault,oauth}.ts`; `server/integration/worker.ts`; `20260927170000_integration_control_plane.sql` (A) | **No adapter** (V) |
| X-02 | SIS connectors | Documented but unimplemented | `mock-sis.ts`; `ADAPTERS=[]` (V) | Build per vendor |
| X-03 | LMS: Canvas (student token proxy) | Partially implemented | `functions/canvas` GET-only, SSRF-guarded (A) | Not a sync connector |
| X-04 | LMS: Blackboard/Moodle | Documented but unimplemented | `lmsmatrix.ts` only (A) | — |
| X-05 | LTI 1.3 | Built but not release-ready | `functions/lti` (881 lines); `ltiags` passback (A) | No tenant activated |
| X-06 | SSO (SAML/OIDC) | Built but not release-ready | Delegated to Supabase Auth: `docs/SAML-IMPLEMENTATION-RUNBOOK.md`; `bind_institution_sso_membership` (A) | Tenant acceptance is a doc |
| X-07 | SCIM | Built but not release-ready | `server/institution/scim.ts`, `postgres-scim.ts`; `SEMESTER_SCIM=on` (A) | No tenant |
| X-08 | Tenant config / Configuration Studio | Built but not release-ready | `school_config_versions`; `VITE_CONFIGURATION_STUDIO` off (A) | Flag |
| X-09 | Role / capability admin | Built but not release-ready | `role_grants`, `my_capabilities` (A) | — |
| X-10 | Policy hierarchy | Partially implemented | `lib/governance/hierarchy.ts` TS-only (A) | SQL enforcement only for AI/feature policy |
| X-11 | Workflow builder | Documented but unimplemented (definitions only) | `workflow_versions`; no executor (A) | Server execution |
| X-12 | Migration center / parallel run / cutover | Partially implemented | `lib/migration/*`, `parallel-run.ts` (A) | Nothing to run against |
| X-13 | Offboarding / export / restore | Partially implemented | `propose_offboarding` … `restore_school`; no app caller (A) | Operator-only; no UI |
| X-14 | Trust room | Partially implemented | `functions/trust-room`; `docs/TRUST-CENTER.md` (A) | — |
| X-15 | Institutional sandbox / demo | Built but not release-ready | `app/server/institution/sandbox.ts`; keys expire 30 days (A) | Not a sales demo environment |

## 7. Company functions (detail in [`COMPANY_LIVE_STATUS.md`](COMPANY_LIVE_STATUS.md))

| ID | Function | Class | Evidence |
| --- | --- | --- | --- |
| K-01 | Pricing / price book | Documented but unimplemented | `docs/commercial/PRICING-AND-PACKAGING.md` "NO CURRENT PRICE BOOK OR SELLING AUTHORITY" |
| K-02 | Deal desk | Partially implemented | `app/src/lib/governance/deal-desk.ts` `DEAL_POLICY` "proposed defaults" |
| K-03 | Quotes / invoices / collections (institutional) | Documented but unimplemented | `docs/commercial/REVENUE-OPERATIONS-ARCHITECTURE.md` lists gaps |
| K-04 | Sales assets (deck, demo, RFP library) | Documented but unimplemented | drafts only; no sales deck |
| K-05 | Marketing site | Built but not release-ready | `company-site/index.html` (3,099 lines) |
| K-06 | Customer success (pilot method, QBR) | Documented but unimplemented | `docs/pilot/*`; QBR tables empty |
| K-07 | Support operations | Documented but unimplemented | `docs/support/internal`; founder only |
| K-08 | On-call / incident command | Documented but unimplemented | `docs/sre/06-INCIDENTS-AND-ON-CALL.md`; `MONITORING.md` no rota |
| K-09 | Finance model / runway | Documented but unimplemented | `docs/finance/semester-financial-model.xlsx` opening cash $0 placeholder |
| K-10 | Legal documents | Documented but unimplemented | `docs/legal/*-DRAFT.md`, `docs/legal-drafts/*` — none in force |
| K-11 | Governance (board, OKRs, vendor register) | Documented but unimplemented | templates; no board exists |
| K-12 | Public claims control | Built but not release-ready | `app/src/lib/ops/claims.ts` + tests |

## 8. Retire candidates and unknowns

| ID | Item | Class | Reason |
| --- | --- | --- | --- |
| R-01 | `FEATURE-INVENTORY.md`, `SEMESTER_PRODUCT_COMPLETENESS_MATRIX.md`, `REGRESSION-CHECKLIST.md` baseline figures | Retire candidate | Stale against code (baseline §5 D15–D16); regenerate or demote to history |
| U-01 | `productivity/http.ts` `q.ownerId` handling | Built but not release-ready | Traced in [`PHASE1_STEP7_TENANT_CONTEXT_TRACE.md`](PHASE1_STEP7_TENANT_CONTEXT_TRACE.md): no entitlement bypass; **no production caller** (`createProductivityApi` unmounted). Wiring of `authenticate`/`consentGrantsFor` is step 9 |
| U-02 | `begin_checkout(want_user,…)` grant | Unknown/investigate | Grant/revoke not located (N); check `supabase/grants.check.sql` |
| U-03 | Design-system spec (Ink/Parchment/blue, source/status vocabulary) vs tokens | Unknown/investigate | Not compared (N) |

## 9. Inventory coverage by artifact type (program §Phase 0 list)

| Artifact | Count / state | Classified at |
| --- | --- | --- |
| Screens | 119 | group level, §2 + baseline E-1 |
| Routes | hash router `app/src/lib/route.ts`; `screens.tsx` ≈96 rows | group level |
| Components | 430 | not individually (E-1) |
| Services | `app/server/{institution 56, integration 8, productivity 18}`; `packages/{contract,institution,offline-sync,platform}` | by module |
| DB tables / RPCs / migrations | 352 / 510 definers / 180 | counts + existing matrices (E-2) |
| Edge Functions | `billing-cancel, billing-checkout, billing-portal, billing-webhook, calendar, canvas, claude, delete-account, fetchcal, integration-tick, lead-intake, lti, productivity-sourcecheck, push, support-reply-notify, trust-room` | individually: billing-* → P-13; `claude` → A-02; `lti` → X-05; `integration-tick` → X-01; `push` → P-05; `calendar`/`fetchcal` → P-04; `canvas` → X-03; `trust-room` → X-14; `delete-account` → P-12; `lead-intake`/`support-reply-notify` → P-15; `productivity-sourcecheck` → P-03 |
| Workers | `app/public/sw.js`, `app/server/integration/worker.ts` | P-10, X-01 |
| Environments | `app/.env.example`, `app/server/institution/.env.example`, `app/.env.production` (publishable key, committed on purpose) | I-11 |
| Feature flags | 21 `FLAGS` + ≈17 `EXPERIENCE_FLAGS` + `MODULE_FLAG_ENV` | I-09 |
| Workflows | 12 | I-24 |
