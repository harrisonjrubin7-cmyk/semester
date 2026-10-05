# Semester release readiness register

| | |
| --- | --- |
| **Version** | 0.1 (first pass) |
| **As of** | 2026-10-05, `origin/main` `790ebbf` |
| **Owner of every row** | Harrison Rubin (`HR`). One person holds every seat; backups are `UNASSIGNED` (`OWNER-AND-ACCOUNTABILITY-MATRIX.md`). |
| **Method** | Four read-only audits (security, product, domains/AI, pilot/company) plus one gate run. Tag `static` = read from source, not executed. Tag `ran` = executed in this session. |
| **Next review** | 2026-10-11 |

This is the Phase 0 source-of-truth map. It is a **first pass**: it is not a
file-by-file census, and the audits did not execute the 111 SQL check suites, the
browser smokes or `test:shuffle`. It will be wrong in places, and each row it is
wrong about is a risk-burn-down item, not a footnote.

Classes and release states are defined in the
[completion definition](SEMESTER_COMPLETION_DEFINITION.md#classification-vocabulary).

**Guard.** `app/src/lib/ops/finishline.test.ts` reads the tables below and fails
if a row's Release is `pilot-ready`, `production-ready` or `authoritative` while
its Evidence cell is empty or `—`. **No row is at any of those values today:** the
student-facing rows sit at `preview` because none of them cites the dated
evidence that `pilot-ready` requires.

**Baseline run (ran, 2026-10-05):** `npx tsc -b` exit 0 · `npm run lint` exit 0 ·
`npm test` 1,423 files passed / 1 skipped, 22,897 tests passed / 69 skipped.
Not run: `check:university`, `test:shuffle`, `build`, SQL checks.

Column key: **Code** = source or migration · **Surface** = route, screen or
API/RPC · **Perm/tenant/authority** = who may use it, tenant scope, source
authority · **Tests** = automated coverage · **A·S·P** = accessibility ·
security · privacy/retention status · **Support/monitor** = runbook, monitor,
SLO.

## A. Foundation

| ID | Capability | Class | Release | Code | Surface | Perm / tenant / authority | Tests | A · S · P | Support / monitor | Evidence | Gap → next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F01 | Gateway authentication and role resolution | verified | flag-off | `app/server/institution/auth.ts`, `membership.ts` | gateway API | per-request membership read from Postgres; stale JWT claims ignored | `auth.test`, `membership.test`, `gateway.test`, `identity-provisioning.check.sql` | — · tested · — | none · none | `supabase/identity-provisioning.check.sql` (static) | No production tenant exercises it → run against a real tenant in the pilot. |
| F02 | SAML SSO (via Supabase Auth) | untested | flag-off | `institution_identity_provider`, `Credentials.tsx` | sign-in | `sso:` provider check; `tenant_sso_policy` | `tenant-sso-policy.check.sql` | — · open · — | none · none | — | No IdP round trip; no cert-expiry alert; no single logout. OIDC absent. → one real-IdP acceptance run. |
| F03 | SCIM provisioning | verified | flag-off | `app/server/institution/scim.ts`, `postgres-scim.ts` | `/scim` route | hashed bearer, rate-limited, idempotent | `scim.test`, `postgres-scim.test`, `scim-gateway.check.sql`, `offboarding-grants.check.sql` | — · tested · — | none · none | `supabase/scim-gateway.check.sql` (static) | Org/course/dept/office grants not revoked on deprovision. → extend the revoke trigger. |
| F04 | LTI 1.3 launch and grade passback | verified | flag-off | `supabase/functions/lti`, `_shared/ltiverify.ts` | LTI launch | RS256 pinned, single-use nonce; passback behind `writeback.lms_grade_passback` | `lti.test`, `lti*.check.sql` | — · tested · — | none · none | `supabase/lti*.check.sql` (static) | Unbound registration still launches with a warning; no real LMS launch. → close with first LMS partner. |
| F05 | MFA / step-up | untested | flag-off | `20260929100000_console_control_plane.sql`, `MfaStep.tsx` | console only | `aal2` + fresh `amr` on break-glass/approvals | `console-*.check.sql` | — · partial · — | none · none | — | No MFA for ordinary admin roles. → decide scope. `decision` |
| F06 | Tenant isolation: RLS and grant sweeps | verified | flag-off | `rls-coverage`, `grants`, `definer-sweep`, `tenancy`, `integration-rls-matrix` `.check.sql` | CI (`supabase/check.sh`, 111 suites) | per-feature cross-tenant denial suites | 111 SQL suites, run twice per migration set (static, not run here) | — · tested · — | CI · CI | `.github/workflows/ci.yml` (static) | **No generic every-table tenant A/B sweep (TI-01/TI-04)**; storage tests use a stub. → build it. |
| F07 | Tenant membership enforcement | not-tenant-safe | flag-off | `20260930185000_school_membership_enforcement.sql` | course rooms | `schools.enforce_membership` default **false** for every school | `school-membership.check.sql` (50) | — · open · — | none · none | — | Off everywhere; covers course rooms only. → gate: on and swept before a second real school. |
| F08 | SECURITY DEFINER surface | verified | flag-off | 530 winning definitions (281 public, 249 private) by static scan; all set `search_path` | RPCs | `grants.check.sql`: anon callable none | `definerregister.test`, `definer-sweep.check.sql` | — · tested · — | none · none | `docs/DEFINER-RLS-REGISTER.md` | Register proves a gate is present, not that it works; DR-01 `kill_switch_engaged` discloses other tenants' state. 15 policy-less tables post-date the register. → refresh and fix DR-01. |
| F09 | PostgREST / GraphQL exposure | unsafe | flag-off | no `[api]` block in `supabase/config.toml`; no revoke of `pg_graphql` | API | RLS plus anon grants | `rls-coverage.check.sql` | — · open · — | none · none | `docs/infrastructure/README.md` (advisor WARN) | **GraphQL not disabled; `anon` still holds INSERT/UPDATE/DELETE on 32 tables, RLS-bound.** TRUNCATE, TRIGGER, REFERENCES and MAINTAIN were revoked from `anon` and `authenticated` and applied to production on 2026-10-05 (D-1251, `supabase/client-privileges.check.sql`). → disable GraphQL; decide the DML reduction. |
| F10 | Secrets management | verified | flag-off | `SECRETS.md`, `.gitleaks.toml`, `ci.yml` `secrets` job | CI | no committed secrets found (static scan) | `secrets.test`, `boundaries.test` | — · tested · — | none · none | `docs/evidence/security/2026-10-02-*` | Provider tokens and BYO AI keys sit in browser storage (F-02); no rotation drill. → move tokens server-side. |
| F11 | Audit logging | untested | flag-off | `public.audit_event`, `private.record_audit`, 9 other streams | — | immutable trigger; pseudonymised actors | `audit-and-subject-requests.check.sql`, `ledger-chains.check.sql` | — · partial · — | none · none | — | 5+ fragmented streams; gateway audit grants `service_role` DELETE and is unchained; verifier jobs applied by hand. → chain and revoke. |
| F12 | Classification, retention, legal hold | verified | flag-off | `database/schema/table-classification.json`, `RETENTION.md`, `20260930100000_legal_holds.sql` | — | hold-aware sweeps | `tableclassification.test`, `retention.test`, `hold-*.check.sql` | — · tested · tested | none · none | `supabase/legal-holds.check.sql` (static) | pg_cron jobs applied by hand; no proof they run in production. → prove or automate. |
| F13 | Data export and erasure | verified | flag-off | `20260929010000_account_erasure_and_export.sql` | `export_my_data()`, DSR intake | `account_data_map()` from catalog | `deletion.check.sql`, `erasure.test` | — · tested · tested | runbook · none | `docs/drills/erasure-drill-2026-09-30.md` | Browser-store data survives sign-out (F-03); consent model lacks purpose/legal basis. → fix. |
| F14 | Feature flags, kill switches, tenant rollout | verified | flag-off | `app/src/lib/flags.ts`, `feature_kill_switch`, `tenant_feature_policy` | server and client | default off; unknown refused | `flags.test`, `aikillswitch.test`, `tenant-rollout.check.sql` | — · tested · — | runbook · none | `docs/evidence/ai/killswitch-drill-*.json` | Flag evaluation is client-side; device-key AI bypasses kill switch (F-04). Drilled for AI only. → server enforcement. |
| F15 | Backups and restore | unsupported | not-released | `supabase/restore.sh`, `restore-drill.sh` | CI + runbook | — | `restore.sh` in CI | — · — · — | `RESTORE.md` · none | `docs/evidence/restore/2026-09-30-logical-rehearsal.md` | **Production never restored; PITR unverified; RTO/RPO unmeasured.** → run the drill. |
| F16 | CI/CD, dependency and security scanning | untested | not-released | 12 workflows | GitHub Actions | — | — | — · partial · — | none · CI | `docs/evidence/operations/2026-10-04-main-ci-red-diagnosis.md` | **`main` unprotected; 26/30 recent runs red**; `npm audit` non-blocking; CodeQL/HawkScan runs unconfirmed. → protect and green. |
| F17 | Observability, SLOs, status page | unsupported | not-released | `production-smoke.yml`, `app/public/status.html`, `lib/governance/error-budgets.ts` | status page | — | `error-budgets.test` | — · — · — | hourly probes · SLOs defined, **not measured** | `docs/evidence/operations/2026-10-03-*` | No error tracking, no log sink, no paging. → minimum alert path. |
| F18 | Incident response | unsupported | not-released | `SECURITY.md`, `docs/sre/runbooks/RB-01..16` | docs | one owner | `security.test` (clocks) | — · — · — | tabletop only · none | `docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md` | No on-call, no backup, personal Gmail as contact. → see [support](SEMESTER_SUPPORT_AND_INCIDENT_READINESS.md). |

## B. Daily student OS

| ID | Capability | Class | Release | Code | Surface | Perm / tenant / authority | Tests | A · S · P | Support / monitor | Evidence | Gap → next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | Today and Action Center | duplicate | preview | `lib/actions.ts`, `components/ActionCenter.tsx`, `screens/Today.tsx` | `#/home` | device-local, student-owned | `actions.test`, `ActionCenter.test` | tested · — · local | `ScreenGuide` · none | — | A second Today engine (`domains/today`) runs in shadow, flag off; Today stacks six surfaces. → finish or retire the shadow. |
| S02 | Tasks and calendar | duplicate | preview | `PersonalTask` (`lib/types.ts`), `domains/tasks`, `lib/sync/engine/rows.ts` | calendar, work | device-local | `tasks.test` | tested · — · local | none · none | — | 4 task models; 2 behind flags, off. → one model, one authority. |
| S03 | Path, plan and degree planning | untested | preview | `Degree.tsx`, `Pathway.tsx`, `lib/degree.ts`, `lib/graduation.ts` | `#/degree` | student-entered, labelled estimate | `degree.test`, `graduation.test` | — · — · local | none · none | — | No audit engine; no registrar certification. → label and hand off. |
| S04 | Courses and study (learning) | untested | preview | Study, Guide, Drill, Lesson, CourseHub; `lib/fsrs` | study routes | student-owned / derived | many `lib` tests | tested · — · local | none · none | — | Faculty side is sandbox only. |
| S05 | Notes, files, Write | untested | preview | `Write`, `Mine`, IndexedDB `semester-files` | `#/mine` | student-owned | `document.test`, `docx.test` | tested · — · local | none · none | — | Data survives sign-out on shared devices (F-03). |
| S06 | Global search | duplicate | preview | `lib/find.ts`, `components/Command.tsx` | search | one ranker, 2 minor matchers | `find.test` | tested · — · local | none · none | — | Scholarships, people, requirements, registration plan not indexed (`lib/oneos.ts`). |
| S07 | AI assistant (Ask) | duplicate | flag-off | `ai/Chat.tsx`, `ai/Assistant.tsx`, `ai/converse.ts` | `ask` + panel | shared key or device key | 20 `ai/*` test files | tested · partial · — | runbook · cost meter | `docs/evidence/ai/*` | Legacy `chatlog` thread; BYO-key route bypasses kill switch. See [AI](SEMESTER_AI_ASSURANCE_PROGRAM.md). |
| S08 | Notifications | duplicate | preview | `lib/notify.ts`, `screens/Hub.tsx`, `lib/push.ts` | Alerts, Notices | — | `notify.test` | — · — · — | none · none | — | Three surfaces, no single model. |
| S09 | Onboarding and first run | untested | preview | `Onboarding.tsx`, `FirstRun.tsx` | first run | student | `smoke:golden` (CI) | — · — · — | none · none | `app/scripts/golden-path.mjs` | No program/term/credit-target capture at first run (Sprint 1 doc); no admin onboarding. |
| S10 | Registration readiness planner | untested | preview | `RegistrationPortal.tsx`, `RegistrationDay.tsx`, `lib/registration-day.ts` | `registrar` | student-entered; official handoff | `registration-day` tests | — · — · local | none · none | `docs/SPRINT-1-REGISTRATION-PATH.md` | Measurement not wired; no official term feed. → pilot wedge. |
| S11 | Support, help and feedback | unsupported | flag-off | `ScreenGuide`, `FixThis`, `open_support_ticket` | every screen | ticket send behind `supportTickets` (off) | `supporttickets.test` | — · — · — | **no staffed queue** | — | "Support has no address yet." → [support](SEMESTER_SUPPORT_AND_INCIDENT_READINESS.md). |
| S12 | Source and authority labels | untested | preview | `SourceBadge.tsx`, `ProvenanceChips.tsx` | ~25 of 96 screens (static) | nothing is labelled "official" | `source.test`, `clm018.test` | — · — · — | none · none | `docs/CLM-018-SOURCE-LABEL-EVIDENCE.md` | 71 screens lack a label; `onReport` wired at 2 call sites. |
| S13 | Product analytics | designed | not-released | `lib/activity.ts` (3 marks) | server | 3 marks only | `activity.test`, `activity.check.sql` | — · tested · tested | none · none | `ANALYTICS.md` | 8 pilot events are definitions only. → decision, then build. `decision` |

## C. Institution OS

| ID | Capability | Class | Release | Code | Surface | Perm / tenant / authority | Tests | A · S · P | Support / monitor | Evidence | Gap → next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| I01 | Course Studio | untested | preview | `20260928309000_course_studio.sql`, `EditCourse.tsx` | `university` tab | faculty-published rules/guidance/packs | `coursestudio.check.sql` | — · tested · — | none · none | — | No shell, roster, submissions, question banks or rubric levels outside `sandbox.ts`. |
| I02 | Registration transaction (ledger) | untested | flag-off | `20260929300000_registration_transaction.sql`, `Registration.tsx` | nested, off at every school | registrar roles; idempotent RPCs | `registration_transaction.check.sql` | — · tested · — | none · none | — | **SIS adapter not built;** domain register omits it. |
| I03 | Gradebook of record | untested | flag-off | `20260929310000_gradebook.sql`, `Gradebook.tsx` | nested, off | append-only, second-person moderation | `gradebook.check.sql` | — · tested · — | none · none | — | Domain register says "no gradebook of record" (`stale`). Passback behind a flag. |
| I04 | Academic record ledger | untested | preview | `20260929210000_academic_record_ledger.sql` | `RecordLedger.tsx` | proposer ≠ approver | `academic-record.check.sql`, `ledger-chains.check.sql` | — · tested · — | none · none | — | No transcript issuance. |
| I05 | Student accounts and payment plans | untested | preview | `20260929220000_student_accounts.sql` | `StudentAccounts.tsx` | append-only entries | `student-accounts.check.sql` | — · tested · — | none · none | — | No payment provider; amounts entered by hand. |
| I06 | Advising / advisor share | untested | preview | `20260928301000`, `AdvisorMeeting.tsx` | student-initiated share, 120-day expiry | student-controlled | `advisor.check.sql` | — · tested · — | none · none | — | No case model, caseloads or advisor notes. |
| I07 | Dining | untested | flag-off | `20260929330000` (10 tables), `Dining.tsx` | nested | — | `dining.check.sql` | — · tested · — | none · none | — | CBORD is a mock. |
| I08 | Housing, career, community | mock | flag-off | `housing.ts` sandbox; `talent_profiles` etc. | — | — | `housing.test`, `career.test` | — · — · — | none · none | — | Housing has no migration; Handshake is a mock; no verifiable credential. |
| I09 | Family / supporter | untested | preview | `family_*`, `Family.tsx` | student-side page | student-controlled | `family.check.sql` | — · tested · tested | none · none | — | No family-member surface; not one of the 14 domains. |
| I10 | Governance and control plane | untested | preview | `governance_*`, `ControlPlane`, `ConfigurationStudio` | `university` tabs | needs verified grant no preview supplies | `tenancy.check.sql`, `governance.check.sql` | — · tested · — | none · none | — | A university's staff have no operations console. |
| I11 | Integration framework | mock | flag-off | `app/server/integration/`, `lib/integration/` | worker, tick | `ADAPTERS = []` | 18 + 3 test files | — · — · — | none · none | — | **Zero real connectors; no live inbound webhook.** |
| I12 | Migration center | untested | preview | `20260929200000_migration_center.sql`, `scripts/institution-migration.ts` | `MigrationCenter.tsx` | — | `migration-center.check.sql`, 15 tests | — · tested · — | none · none | `docs/migration/README.md` | Never run on a real institution. [Factory](SEMESTER_MIGRATION_FACTORY.md). |
| I13 | School offboarding | untested | preview | `school_offboarding*` | SQL case workflow | — | `school-offboarding.check.sql` | — · tested · tested | runbook · none | `docs/evidence/offboarding/2026-09-30-hosted-preview-rehearsal.md` | No export job, no screen. |

## D. Company and pilot spine

| ID | Capability | Class | Release | Code | Surface | Perm / tenant / authority | Tests | A · S · P | Support / monitor | Evidence | Gap → next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C01 | Operator console | untested | preview | `screens/Console.tsx`, `console_*` | `console` (no inbound link) | `console:operate` + MFA | `console-*.check.sql`, `console.test` | — · tested · — | none · none | `docs/ops/OPERATIONS_CONSOLE_CURRENT_STATE.md` (production read 2026-10-05) | `console_audit_event` has 0 rows in production: the approval path has never run there, only in SQL checks. 4 platform grants. No champion role. |
| C02 | Billing, individual plan | verified | flag-off | `billing-*` edge functions, `lib/plans.ts` | checkout | Stripe | `commercial.check.sql` | — · tested · tested | none · none | `docs/evidence/BILLING-LIVE-ACCEPTANCE-2026-10-03.md` | Monthly lifecycle only; no annual, refund, renewal, dispute. New checkout held off by `INDIVIDUAL_PAID_ACQUISITION_ENABLED = false`. |
| C03 | Institutional quotes and contracts | designed | not-released | `20260929070000_commercial_core.sql`, `deal-desk.ts` | tables only | — | `commercial.check.sql` | — · tested · — | none · none | — | `contracts/` empty; `evaluateUnderContract` not called by the app. |
| C04 | GTM and CRM data model | designed | not-released | `gtm_*` (~25 tables) | no UI | — | `gtm.check.sql` | — · tested · — | none · none | — | "Operated CRM unproven." |
| C05 | Trust room | untested | preview | `trust_room_*`, `functions/trust-room`, `TrustRoom.tsx` | trust room | NDA-gated request | — | — · — · — | none · none | — | Site describes a document room the gap matrix did not find behind it. |
| C06 | Lead intake and company site | untested | not-released | `functions/lead-intake`, `company-site/` | public | public by reason | — | — · — · — | none · none | — | `docs/marketing/COMPANY_SITE_CURRENT_STATE.md` (source inspection, 2026-10-05) says `company-site/` is configured for Vercel project `semester-company-site` at `www.semester.website` and that `app/src/site/` is a second public stack, not deployed by default; secrets and live deploy state still need human evidence. |
| C07 | Customer health, renewal, QBR | designed | not-released | `compute_account_health()`, `renewal_opportunities`, `qbrs` | none | — | — | — · — · — | none · none | — | No UI caller; no accounts. |
| C08 | Support tickets and help requests | untested | flag-off | `support_tickets`, `support_reply`, `console/SupportQueue.tsx` | console, `Support.tsx` | break-glass `support_access` | `support-access.check.sql`, `supporttickets.test` | — · tested · — | none · none | — | See S11. |

## E. AI routes

| ID | Capability | Class | Release | Code | Surface | Perm / tenant / authority | Tests | A · S · P | Support / monitor | Evidence | Gap → next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A01 | Shared-key AI function | verified | flag-off | `supabase/functions/claude`, `_shared/clamp.ts`, `aispend.ts` | edge function | data-class ceiling T2 (D-1260); kill switch | `aiclass.test`, `claudeclass.test`, `ai-spend.check.sql` | — · tested · — | runbook · spend meter | `docs/evidence/ai/injection-redteam-*.json`, `killswitch-drill-*.json` | One model, one run; shared key blocked pending owner evidence. |
| A02 | Institution AI gateway | untested | flag-off | `app/server/institution/intelligence.ts` | gateway | tenant `ai_policy`; course rules | `intelligence-*.test`, `intelligence-policy.check.sql` | — · tested · — | none · none | — | Tenant `data_classification_rules` read by nothing on the AI path. |
| A03 | Device-key AI routes | unsafe | flag-off | `lib/assistant.ts`, `claude.ts` | browser to provider | student-owned key | — | — · open · — | none · none | `docs/security/FINDINGS-REGISTER.md` F-04 | Bypass the kill switch and school AI-off policy. |

## F. Claimed-but-absent

These were looked for and not found. They appear in marketing or planning
documents and are **not** capabilities.

| Item | Where claimed | Finding |
| --- | --- | --- |
| Real Banner, Colleague, Workday, PeopleSoft, Ellucian, Blackboard connector | mocks, docs, site | Not found as code. |
| OneRoster, QTI export, Common Cartridge export | docs | Not found as code. |
| Tenant bulk export | offboarding docs | Not found. |
| Incumbent feature-parity matrix | `docs/CAPABILITY-PARITY-MATRIX.md` | That file is screen-width parity only. |
| Prompt registry | AI docs | Not found; ~28 `*_SYSTEM` constants. |
| SOC 2, penetration test, ACR/VPAT | site, trust docs | None held (the site says so). |
| Customer, pilot agreement, order form | — | None. |
| Faculty, advisor, registrar, family or operator screens of their own | — | Not found as routes. |

## P0 launch blockers

A P0 blocks the **paid institutional pilot** and any claim above `pilot-ready`.
Blockers marked **H** need a human, a vendor or money; the repository cannot
close them.

| ID | Blocker | Type | Evidence | Closes when |
| --- | --- | --- | --- | --- |
| B-01 | `main` has no branch protection or ruleset; 26 of 30 recent runs red | engineering | `docs/security/FINDINGS-REGISTER.md` F-09; `2026-10-04-main-ci-red-diagnosis.md`; GitHub API read 2026-10-05 | ruleset applied with a satisfiable reviewer rule; last 10 runs green |
| B-02 | No customer, champion, order form or signed pilot | **H** | `contracts/README.md`; `ops/customer-commitments/README.md`; `GO-NO-GO-DECISION.md` | an executed agreement is filed |
| B-03 | No counsel engaged; pilot agreement, DPA, policies are drafts with 100+ `[DECIDE]` markers | **H** | `docs/legal/LEGAL_REVIEW_QUEUE.md` (0 rows closed) | counsel-reviewed paper filed |
| B-04 | No approved price book; three inconsistent institutional number sets and an unsourced public band | decision + **H** | `commercial/READINESS_GAP_MATRIX.md` | one price book approved and the site reconciled |
| B-05 | Tenant isolation not proven generically; membership enforcement off | engineering | F06, F07 | TI-01/TI-04 green in CI; enforcement on and swept |
| B-06 | No production restore, PITR unverified, RTO/RPO unmeasured | engineering + **H** | F15 | drill recorded with date, owner, recovery point and time |
| B-07 | No alert delivery or on-call; personal Gmail as security contact | **H** | F17, F18 | probe failure reaches a person within a stated time, demonstrated |
| B-08 | No operator or champion screens for the pilot spine; roster import is `service_role` only | engineering | pilot steps 1–4, 6, 8, 13 | tenant create, cohort import, invite and dashboard operate on a synthetic tenant |
| B-09 | Pilot measurement not wired (three marks only) | decision + engineering | S13 | activation and first-action events defined, built and tested |
| B-10 | `fetchcal` request precedes the redirect check | engineering | confirmed in `supabase/functions/fetchcal/index.ts` | per-hop check before the request, with a failing test first |
| B-11 | GraphQL exposure unmitigated; `anon` DML on 32 tables and the `authenticated` allowlist undecided (TRUNCATE-class privileges already revoked, D-1251) | engineering + decision | F09; `database/GRANT_ALLOWLIST.md` | GraphQL disabled; DML reduction decided and a check suite asserts it |
| B-12 | BYO-key AI route bypasses the kill switch and school AI-off policy | engineering | A03 | route refused when the policy says off, with a test |
| B-13 | No independent security assessment, HawkScan run or qualified accessibility review | **H** | `EXTERNAL-EVIDENCE-QUEUE.md` EXT-006/007/008 | reports filed |
| B-14 | Target-environment drills not run (rollback, data rights, revocation, offboarding) | engineering + **H** | EXT-011 | each drill filed under `docs/evidence/` |
| B-15 | No live official data connector | engineering + customer | I11 | pilot runs on manual data with every screen marked unavailable, **or** one adapter passes real-source acceptance |

B-10, B-11 and B-12 are small and independent of any customer. They are the
first code work this register recommends.
