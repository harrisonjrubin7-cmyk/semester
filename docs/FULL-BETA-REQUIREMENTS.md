# Full-beta requirements, audit and delivery plan — Milestone 0

Baseline `origin/main` `9ffe292`, 2026-09-30. Static audit; see [FEATURE-TRUTH-TABLE.md](FEATURE-TRUTH-TABLE.md)
for the per-feature status and its caveats. **No behavior was changed to produce this report.**
Approved to proceed 30 Sep 2026; decisions in D-150. Milestone 1 progress is in §13.

## 1. Headline

Semester is not a greenfield build. It is a mature local-first SPA (~83 screens, 1,064 test files,
121 migrations, ~250 RLS-protected tables, 78 SQL policy suites, 13 edge functions) whose
**institutional and commercial layers are built and tested but switched off, unconnected or
unauthorized**. The full beta is therefore mostly (a) closing named gaps, (b) making beta-critical
data server-persistent, (c) producing evidence, and (d) resolving external dependencies. Milestone
sizes below reflect that; several of the requested capabilities already exist and only need
hardening, and I will not rebuild them (rule 4).

What the repo itself says about readiness: Master Launch Readiness Register has 142 rows, none above
`tested`; the go/no-go checklist verdict is **NO-GO** (1 MET, 9 PARTIAL, 2 UNMET); `docs/evidence/`
does not exist; production has never been restored; no alert reaches anyone; all incident owners are
unassigned.

## 2. Scope and conflicts to decide

Points where the brief and the repo disagree. Each needs your decision; I have not assumed.

| # | Conflict | Recommendation |
|---|---|---|
| C-1 | Brief: no beta-critical feature depends only on localStorage. Repo: ADR 0001 makes the device the working copy and the app usable signed out. | Keep ADR 0001. Define "beta-critical" = data an institution or the student must not lose or that another party reads (shares, grants, tenant content, Workspace files, billing, consent). Give those server persistence; leave personal scratch data device-first with sync. Needs your sign-off. |
| C-2 | Brief: full Workspace incl. files, sharing. Repo: files live in IndexedDB and never sync; FEATURE-INVENTORY warns against new `#/workspace/*` routes. | Add server-side file storage (Supabase Storage + RLS) behind existing routes; no new route family. |
| C-3 | Brief: Free/Plus/Pro/Access. Repo: only Plus is buyable at $7.99/$59 (D-134). | Ship only plans whose entitlements are enabled; Pro/Access stay hidden until real. |
| C-4 | Brief: SCIM/gateway service. ADR 0003: no application server. Gateway is a separate Node/Vercel service. | Needs an ADR amendment or a decision to host SCIM/SSO on edge functions. |
| C-5 | Brief: deploy previews per milestone. Repo: production is GitHub Pages (no headers); Vercel prepared but host choice undecided (`LAUNCH-DECISIONS` 6). | Decide host before M1 so a preview URL exists. Until then previews are local only. |
| C-6 | Brief: 20 named docs under `docs/`. 17 already exist elsewhere under other names, some code-rendered and test-guarded. | Do not fork them. See §5. |
| C-7 | Brief: `BLOCKED_PENDING_EXTERNAL_APPROVAL`. Repo has no such token; it uses claims/Master-Register words. | Adopt as a truth-table status name `BLOCKED` with the reason column; keep register words for public claims. |

## 3. Module map

Columns compress the requested mapping. "Authz" = how access is enforced today. Full tables/APIs are
in the truth table and `DEFINER-RLS-REGISTER.md`.

| Module | UI | Data | Authz | Tests | Fallback today | Main work |
|---|---|---|---|---|---|---|
| Today | `Today.tsx`, ActionCenter | store + `activity` | own rows | unit | seed data | source labels, snooze/feedback, un-seed first run |
| My Path | `Pathway`, `Degree` | store | own rows | unit | student-entered | deterministic requirements engine + verified catalog |
| Search | `Search.tsx`, `Command` | none | client | unit | registry only | server index, authz-aware results |
| Plan | `Calendar`, `Registrar`, `Runway` | store, `calendar_feeds` | own rows | unit + zones | clipboard bridge | conflict engine hardening, confirm on calendar writes |
| Study / Studio | `Study`, `StudyStudio` | device | own | unit | offline cache | server extraction, scan, anchors, versions |
| Workspace | `Write/Sheet/Deck/Files` | IndexedDB | own | unit | local export | server storage, versions, consented share |
| Career | `Career` | store | own | unit | static checklists | tracker depth, mentor workflow |
| Campus Hub | `Hub`, `University` | seed | none | unit | seed links | publisher workflow, freshness, expiry |
| Account | `Account`, `Privacy` | Supabase Auth | JWT + RLS | SQL + unit | signed-out use | recovery screen, settings, sessions |
| Membership | `MembershipPanel`, `Bill` | `commercial_*` | RLS + webhook | unit + SQL | Free | portal, refunds, disputes, E2E |
| Institution admin | `Console` | control plane | capability + MFA | SQL | read-only | guide, wizards, simulator |

## 4. Gap register

Severity: **S1** blocks any real-student beta, **S2** blocks institutional pilot, **S3** hardening.
"Ext" = needs an external party.

| ID | Gap | Sev | Milestone | Ext |
|---|---|---|---|---|
| G-01 | Beta-critical data is device-only in most student modules (Workspace files never sync) | S1 | M1/M5 | C-1 decision |
| G-02 | No in-app new-password screen after recovery; no change-email/password; no session list/revoke | S1 | M1 | |
| G-03 | Tenant isolation uneven: `tenancy.check.sql` header says classmates/rooms/groups are not tenant-scoped; verify against current policies, then scope | S1 | M1 | |
| G-04 | No unified audit schema; outbox has no producer or sweep | S2 | M1 | |
| G-05 | No data-subject-request queue; no full-account export including IndexedDB files; erasure fails closed for staff with history rows | S2 | M1 | |
| G-06 | Per-plan and per-cohort flag dimensions absent; flags evaluated client-side | S2 | M1 | |
| G-07 | Seeded semester is the default first-run state, presented as the student's | S1 | M2 | |
| G-08 | Deterministic requirement/credit/degree engine not tied to a verified catalog | S2 | M2 | Catalog data (Ext) |
| G-09 | No server search index or authz-aware result routes | S2 | M3 | |
| G-10 | Content governance (publisher, owner, expiry, approval, freshness alerts) missing for tenant content | S2 | M3 | |
| G-11 | Transfer equivalencies have no screen | S2 | M3 | Approved equivalency source (Ext) |
| G-12 | Source labels DB-enforced on ~4 tables; core tables carry no per-record authority | S2 | M3 | |
| G-13 | Extraction is client-only: no malware/file-type scan, OCR, anchors, review-before-indexing | S1 | M4 | |
| G-14 | Live prompt-injection red-team and AI evaluation run not done; no AI-rule (course/institution) enforcement | S1 | M4 | provider key (Ext) |
| G-15 | Shared AI key unset in production / 502 undiagnosed | S1 | M4 | Owner |
| G-16 | Supporter view: server grant not read by any client | S2 | M5 | |
| G-17 | Customer Portal, plan change, resume-cancel absent | S1 | M6 | Stripe (Ext) |
| G-18 | Refund/dispute events recorded but inert; no dead-letter; events not replayable | S1 | M6 | |
| G-19 | Test-mode Stripe E2E suite and manual script absent | S1 | M6 | Stripe test keys (Ext) |
| G-20 | OIDC not built; SAML cert expiry unmonitored; SCIM never run on real IdP | S2 | M7 | Univ. IdP (Ext) |
| G-21 | No production SIS/catalog adapters; both registries empty | S2 | M7 | University auth (Ext) |
| G-22 | Google/Microsoft tokens in `localStorage`; no institution-level connector; no server token encryption or revocation cascade | S2 | M7 | Provider apps (Ext) |
| G-23 | LTI NRPS refused; unbound registration answers `allowed-unbound` | S2 | M7 | Brightspace reg. (Ext) |
| G-24 | Aggregates: count floor only, no differencing protection | S2 | M7 | |
| G-25 | Tenant admin guide, permission simulator, integration setup wizards | S2 | M7 | |
| G-26 | No alert reaches anyone; no client error capture; incident owners unassigned | S1 | M8 | Owner |
| G-27 | Production restore never run; gateway journal unbacked; `docs/evidence/` absent | S1 | M8 | Owner (prod access) |
| G-28 | No human AT pass, ACR/VPAT | S2 | M8 | Auditor (Ext) |
| G-29 | No SAST, no pen test, no HECVAT/SOC 2 | S2 | M8 | Third parties (Ext) |
| G-30 | Legal docs are drafts with `[DECIDE]` items | S1 | M8 | **Counsel** (Ext) |
| G-31 | Staging parity steps 2–4 never run; no isolated demo tenants | S2 | M9 | |
| G-32 | Tenancy-scoped feature-flag defaults for sensitive features need a test that they are OFF | S3 | M1 | |

## 5. Required documents: where each stands

Rule for new docs: **synthesise and link; do not fork** authoritative pages. The repo's convention is
a data file under `app/src/lib`, a rendering test, and an entry in `npm run registers`, plus an entry
in `ops/operatingsystem.ts`; hand-written pages are not policed.

| Required | Status at M0 | Authoritative source today | Plan |
|---|---|---|---|
| FULL-BETA-REQUIREMENTS | **this file** | — | maintained each milestone |
| FEATURE-TRUTH-TABLE | **created** | — | mechanise in M1 |
| ARCHITECTURE | extended (§ Full-beta target) | `docs/ARCHITECTURE.md`, ADRs | update each milestone |
| DATA-INVENTORY-AND-LINEAGE | missing | `FIELD-LINEAGE-…`, `DATA-STEWARDSHIP`, `account_data_map()` | write in M1 from the catalog-derived map |
| ROLE-PERMISSION-MATRIX | missing | `ROLE-LAUNCH-REGISTER.md` (readiness, not grid) | generate role × capability from migrations, M1 |
| INTEGRATION-CATALOG | missing | `LMS-INTEROPERABILITY-MATRIX`, `INTEGRATION-*`, `_shared/integration/catalog.ts` | M7 |
| SECURITY-THREAT-MODEL | missing (integration/AI-only models exist) | `INTEGRATION-THREAT-MODEL`, `SECURITY.md` | whole-platform STRIDE, M1 then M8 |
| PRIVACY-IMPACT-ASSESSMENT | exists at `operating-model/PRIVACY-IMPACT-ASSESSMENT.md` (code-rendered) | same | root pointer only, no fork |
| ACCESSIBILITY-ACR-PLAN | missing | `trust/HECVAT-VPAT-PLAN`, `AT-PASS-PROTOCOL` | M8 |
| AI-GOVERNANCE-AND-EVALUATION | missing | `operating-model/AI-ASSURANCE` | M4 |
| STRIPE-BILLING-OPERATIONS | missing (no operator runbook) | `COMMERCIAL-CORE`, `ENTITLEMENT-RESOLUTION` | M6 |
| TENANT-ADMIN-GUIDE | missing | `OPERATIONS-CONSOLE-MAP` | M7 |
| PILOT-OPERATIONS-MANUAL | missing | `/PILOT.md`, `PILOT-TO-PRODUCTION` | M7/M9 |
| INSTITUTION-IMPLEMENTATION-GUIDE | missing | `market-readiness/IMPLEMENTATION_PLAYBOOK` | M7 |
| SUPPORT-OPERATIONS | missing | `SUPPORT_PLAYBOOK`, `HUMAN_HELP` | M6/M8 |
| INCIDENT-RESPONSE | missing | `market-readiness/INCIDENT_RESPONSE` | M8 |
| DATA-RETENTION-EXPORT-DELETION | missing | `/RETENTION.md`, `DATA-PORTABILITY-AND-OFFBOARDING` | M1 |
| RELEASE-CHECKLIST | missing | `/REGRESSION-CHECKLIST.md`, `GO-NO-GO-CHECKLIST` | M9 |
| ROLLBACK-AND-DISASTER-RECOVERY | missing | `/ROLLBACK.md`, `/RESTORE.md` | M8 |
| KNOWN-LIMITATIONS | exists at `docs/pilot/KNOWN-LIMITATIONS.md` (code-rendered, public) | same; `docs/launch/` copy is older | root pointer only; decide which wins |

I did not create empty placeholder files for the 15 not yet written: a stub is a claim the doc
exists, and the brief forbids placeholders. They are created in the milestone that owns their
content.

## 6. Schema and migration plan (additive only)

Principles: forward-only additive migrations, each with a `.check.sql` suite that walks a second
account and a denied path, `OWNED_TABLES` updated in the same change, and a written rollback.
Existing check suites already run in CI on a disposable Postgres 17. No migration is applied to
production without your approval; I would apply only to a Supabase preview branch.

| Milestone | Proposed additions (names indicative) |
|---|---|
| M1 | `tenant_id` scoping for classmates/rooms/groups (after G-03 verification); `audit_event` (common envelope) + producers on sign-in, share, export, grant; `data_subject_request`; `cohort` + `cohort_member`; plan and cohort dimensions in `tenant_feature_policy`; session-management RPCs; `private.audit_retention` sweep |
| M2 | `record_source` provenance columns on core tables (`source_label`, `source_url`, `owner`, `reviewed_at`) using the existing five-label CHECK; `action_item_state` (snooze/dismiss/feedback); `plan_share` (view-only, revocable, expiring) |
| M3 | `content_item`, `content_review`, `search_document` (+ RLS-aware index); `opportunity`; `transfer_equivalency` with status label |
| M4 | `study_material`, `material_version`, `extraction_job`, `anchor`, `ai_conversation`/`ai_message` history with delete; `ai_rule` (course/institution) |
| M5 | `workspace_file` + storage bucket policy, `document_version`, `share_grant` (time-limited); `supporter_grant` wired to client |
| M6 | `billing_event_raw` (replayable body), `billing_dead_letter`, refund/dispute effect functions, entitlement hold |
| M7 | `oidc` provider type, SAML cert expiry, connector token vault references + rotation, revocation cascade, small-cell suppression function |
| M8–9 | none structural; demo tenant seeding under `demo` tenant ids |

Compatibility: no destructive change to existing tables; new columns nullable with defaults;
old device shape keys stay (`.v1`), new shapes get new keys.

## 7. Milestone delivery plan

Each milestone ends with the deliverables in the brief (PR, file list, migrations, test output,
preview, security/privacy/accessibility impact, manual QA, rollback, truth-table update, blockers)
and **stops for your approval**. Gates from `CLAUDE.md`: `tsc -b`, `lint`, `check:university`,
`test`, `test:shuffle`, `build`, plus `supabase/check.sh`, and a revert-the-fix check for every new
guard.

| M | Contents | Depends on |
|---|---|---|
| 1 | Auth completion (G-02), tenancy scoping (G-03), audit/DSR/cohort/flag dimensions, export completeness, mechanised truth table, data inventory, role matrix, threat model | your C-1, C-5 decisions |
| 2 | Un-seeded first run, provenance labels, Action Center controls, requirement engine, plan sharing | catalog data for real requirement checks |
| 3 | Search index, content governance, transfer, opportunities | tenant content |
| 4 | Server extraction/scan, AI rules, history/delete, live red-team, eval run | AI key (G-15) |
| 5 | Workspace storage/versions/sharing, supporter view | M1 storage |
| 6 | Portal, refunds/disputes, dead letter, test-mode E2E | Stripe **test** keys |
| 7 | OIDC, connector framework, wizards, admin guide, thresholded reporting | university approvals |
| 8 | Alerts, restore drill, AT pass, SAST, security/privacy/legal packs | prod access, counsel |
| 9 | Staging + demo tenants, acceptance scripts, release report | all |

## 8. External dependencies (nothing below is represented as enabled)

Owner: support address, alert-to-phone, incident owners, production host choice, AI key + 502
diagnosis, production Supabase access for restore drill. Counsel: all `docs/legal/` drafts, DPA,
MSA, FERPA wording, COPPA. Stripe: test-mode keys, later live approval. University: data agreement
and scope, IdP registration and SCIM group mappings, Brightspace LTI registration, any SIS/catalog
adapter credentials. Third parties: pen test, HECVAT, SOC 2, VPAT auditor.

## 9. Security, privacy, accessibility impact of Milestone 0

None; documentation only. No secrets, keys or student data were read or written. Findings that
matter for privacy (G-03 tenant scoping, G-05 erasure edge case, tokens in `localStorage`) are
listed above as gaps, not fixed.

## 10. Rollback

`git revert` of the single documentation commit. No migrations, no config, no deploy.

## 11. Decisions requested to start Milestone 1 — answered 30 Sep 2026 (D-150)

1. C-1: adopt the narrowed definition of "beta-critical" (server persistence for shared/institutional/billing/consent/file data)?
2. C-5: choose the preview/production host (Vercel vs staying on Pages)?
3. C-4: host SCIM/SSO on edge functions or amend ADR 0003 for the gateway?
4. Confirm I may create Supabase preview branches (never production) for migration rehearsal.
5. Approve this report to proceed.

## 12. Method and limits

Four read-only audits (UI, database/security, server/CI, documentation) plus direct checks of
`origin/main` per `CLAUDE.md`. The audits sampled rather than read every file; some status calls are
inferences and are marked as such (Community, Membership, institutional features depend on
environment state that static reading cannot confirm). I did not run the test suite or the CI
gates for this report. Before Milestone 1 I will re-run the gates to refresh the baseline, since
`REGRESSION-CHECKLIST.md` is nine days behind the tree.

## 13. Milestone 1 progress (in flight)

| Gap | State | Evidence |
|---|---|---|
| G-02 recovery screen, change password/email, sign out other devices | **done** (client) | `components/AccountSecurity.tsx`, 6 tests, guard shown red by disabling the floor. A session *list* is not built: I found no client-side listing call in supabase-js, so it needs a server function. |
| G-03 tenant scoping | **built, off everywhere (D-1021)**: per-school members-only switch, requests, admin approval, leave/remove, readiness count; 32 checks, six guards shown red | `docs/SCHOOL-MEMBERSHIP-ENFORCEMENT.md`; its readiness evidence list is **not yet met** and no school is switched on |
| G-04 common audit envelope | **schema + 2 producers** | `20260930000000_audit_and_subject_requests.sql`, 22 checks; guards shown red by removing the trigger, the insert clause and the immutability trigger |
| G-05 data-subject requests | **schema only** | same migration; no screen or answering workflow yet |
| G-06 plan/cohort flag dimensions, cohorts | **cohort and role limits landed on main** (`20260929340000_feature_cohorts.sql`, another PR); a *plan* dimension was not added — entitlements resolve plans separately | not duplicated here |
| G-32 sensitive features default OFF test | already held: every flag is defined with `defaultEnabled: false` and `flags.test.ts` covers the registry | no change |
| Data inventory, role matrix | **done, generated** from a database built by all migrations | `docs/DATA-INVENTORY-AND-LINEAGE.md`, `docs/ROLE-PERMISSION-MATRIX.md`, `supabase/tools/` |
| Threat model | **done** (a reading, not a penetration test) | `docs/SECURITY-THREAT-MODEL.md` |
| Retention/export/deletion doc | **done** (synthesis) | `docs/DATA-RETENTION-EXPORT-DELETION.md` |
| G-05 request screen + answering workflow | **deliberately not built**: nobody is named to answer, so a screen would promise a 30-day reply nobody agreed to keep | owner decision |
| Truth table guard | **done**: `app/src/lib/truthtable.test.ts` holds status words to the agreed six and every named file to existence (it cannot check that a status is *true*) | mutation shown red |

The Milestone 1 migration was merged to main in #1000. It was run on a disposable local Postgres 17 and in CI's disposable database. **Whether the schema deploy applied it to the production project has not been confirmed by me.**

## 14. Milestone 2 progress (in flight)

Audits of Today/Action Center and Plan/My Path/sharing were read-only readings of the tree.

| Item | State | Evidence |
|---|---|---|
| G-07 sample shown as the student's own | **done for Today's decisions**: the Action Center, the briefing and the commitments list leave out unclaimed sample dates and classes until "These are mine"; with nothing of their own, Today offers "Start your semester" | `lib/standing.ts` `ownedScope`, `TodayActionCenter.test.tsx` (guard shown red by removing the filter). The first-run banner's wording ("The semester this app ships with") is unchanged: its own header records why it avoids "sample" — owner's call |
| Freshness on items | **honest, not real**: course dates carry no per-item timestamp, so the badge now says "Update time not recorded" instead of nothing | `SourceBadge` `unknownAge`; real freshness needs a stored last-checked time (not built) |
| Source words on commitments | done | `TodayActionCenter.tsx` |
| Snooze presets and dismiss reasons | **done** (client, device-only): later today / tomorrow / next week / the day before it is due, never past expiry or after 9 p.m. for "later today"; four fixed dismiss reasons or none, shown in the Hidden list. No storage version bump was needed (the reason rides the existing `note`). Guards shown red by mutation | `lib/actions.ts` `snoozePresets`, `DISMISS_REASONS`; `ActionCenter.test.tsx`; **still device-only, and the Action Center is off by default** |
| Helpful / not-helpful per item | not started | needs the clarity model, not just a button |
| Turn the Action Center on for students | **not done — deliberate.** It is off by default (`VITE_TODAY_ACTION_CENTER`); enabling it is a release decision and needs a DECISION-LOG entry | `lib/experience-flags.ts` |
| Term credit and workload engine | **done** (pure, deterministic, estimates only): credits vs the student's own minimum/maximum/target, and estimated weekly hours (2 h per credit, stated) vs the study hours they say they have; three new optional student-entered numbers in the registration plan. Never says allowed/blocked. Guards shown red | `lib/termload.ts`, `RegistrationDay.tsx` panel (behind Registration Day Mode, off by default) |
| Sharing and audit lifecycle | **advisor shares audited**: create, read, revoke and delete each write one pseudonymous `audit_event` (no title, address or payload), read by the school's auditor only; a refused attempt writes nothing. Five guards shown red | `20260930190000_advisor_share_audit.sql`, `share-audit.check.sql` (14 checks). **Not built:** a general read-only plan share; sources/assumptions/freshness in the advisor payload; denied attempts are not recorded (a refused call rolls back its own write) |
| Source, assumptions and freshness on planning surfaces | **advisor share** carries `provenance` (per-part source labels, three standing assumptions, the day prepared; optional on read so older shares open); **graduation simulator** and **study abroad** now carry a badge and "not an official degree audit / credit evaluation" wording. Guards shown red | `lib/advisor-meeting.ts`, `GraduationSimulator.tsx`, `StudyAbroad.tsx`. Registration cart/backups still unlabelled |
| Fix: `ModulesPanel` said the settings could not be read on first paint | **fixed** as its own commit (bug from #1002, found by the review bot) | `ModulesPanel.tsx`, 2 tests, red without the fix |
| Study blocks, work/travel constraints in a scheduler, catalog-tied requirements | not started | catalog-tied requirements need external data (G-08) |
| Release gates from the readiness analysis | **written**: ten gates with evidence and gaps, and the do-not-claim boundaries | `docs/RELEASE-GATES.md`; G3 (school offboarding) is an owner decision |
