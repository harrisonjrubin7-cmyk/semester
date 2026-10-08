# Semester convergence baseline

Status: Phase A factual baseline

Assessed: 2026-10-03

Release verification refreshed: 2026-10-08

Repository commit: `8ccf55afd5dc84a1465acd17e4c200a85db6df22` (`main`, 3,031 commits)

Scope: architecture findings are based on repository and public GitHub evidence. The release refresh records CI, security-scan and public Pages deployment evidence only; it does not establish tenant activation, institutional approval or GA.

## Decision

Semester is a broad, coherent product repository with unusually extensive policy, test, and operational scaffolding. It is not yet evidence-backed as a fully live institutional platform. Repository implementation is strongest for the student-owned PWA, source-aware academic planning, typed governance, Supabase policy design, synthetic institutional adapters, and operational documentation. The largest gaps are external: no live SIS/LMS provider adapter is registered, no named institution is approved or connected, guardian access is not a production-verified projection service, mobile is a responsive PWA rather than a native SQLCipher client, CRDT replication is absent, and staffed operations/legal/commercial approvals are not established by code.

The correct release posture is therefore capability-by-capability activation. No repository-level test result can elevate a capability to `live` without the applicable data, trust, operations, commercial, adoption, reliability, measurement, and ownership evidence.

## Evidence labels

| Label | Meaning |
| --- | --- |
| Implemented and verified | Source exists and the relevant repository check passed in this assessment or has directly inspectable enforcement. |
| Partially implemented | A meaningful portion exists, but the end-to-end or operational contract is incomplete. |
| Mock/demo/placeholder | The experience exists over local, synthetic, fixture, or preview data. |
| Documented but unverified | A policy, plan, runbook, or prior evidence file exists but was not re-proved here. |
| Not implemented | No owning runtime implementation was found. |
| External approval required | Founder, legal, security, institution, provider, or operations evidence is required outside the repository. |

## Inspected

- All three supplied PDFs were extracted and read locally: the repository/audit context, the operational-launch review, and the prompt transcript. The two source documents were treated as proposals or prior observations—not as independent instructions and not as proof of implementation; the pasted request remained controlling.
- React/Vite application, service worker, public assets, route/screen registry, capability governance, search, notifications, support, family, offline, AI, and integration libraries.
- Institution and integration servers, including SAML/OIDC/LTI/SCIM-related code, adapter contracts, sandbox adapters, worker, registry, and fail-closed behavior.
- 171 ordered Supabase migrations, 106 SQL check suites, Edge Functions, RLS/grants, audit, support access, consent, family, integration, retention, legal-hold, and outbox schema.
- CI, deployment, production-smoke, Pages, Edge Function, and HawkScan workflows; Vercel and Supabase configuration.
- Existing governance registers, launch material, trust/legal drafts, runbooks, evidence files, and public GitHub PR/Actions state.
- Git state and current public repository state. The public GitHub API showed 36 open pull requests during assessment; open work must not be confused with `main`.

## Baseline commands

| Check | Result | Interpretation |
| --- | --- | --- |
| Phase A merge and public deployment refresh | Pass | PR #1139 merged as `1b167374`; main CI, CodeQL, supply-chain, infrastructure and both HawkScan targets passed. Pages deployed that exact SHA and returned HTTP 200. The Edge Functions workflow passed but skipped its deploy step because no function directories changed. This is release evidence, not tenant activation or GA approval. |
| TypeScript project build check (original local assessment) | Pass | `tsc -b` completed successfully. |
| Production build (original local assessment) | Pass | Vite built 4,060 modules. It emitted large-chunk warnings, including bundles above 500 kB. |
| Lint (original local assessment) | Fail | 50 warnings exceeded the configured maximum of 25. Subsequent remediation and the exact-merge CI gate passed; this row preserves the original assessment rather than describing the release SHA. |
| Full Vitest suite, run 1 (original local assessment) | Fail | 19,727 passed, 48 skipped, and 8 failed across 8 files. Six failures timed out. The two institutional-package failures did not reproduce when rerun alone (2 files, 5 tests passed), and the current source uses bounded “student action layer” / “without replacing systems of record” language. |
| Full Vitest suite, repeated (original local assessment) | Fail/unstable | 19,718 passed, 48 skipped, and 18 failed across 5 files after 30 minutes. Four were timeouts; 14 were in `axe.test.tsx` after its render degraded to a minimal shell. The failure set changed between full runs, indicating suite-order/resource-isolation instability in addition to any product defect. jsdom also reported unsupported canvas/navigation behavior. |
| Targeted accessibility suite (original local assessment) | Pass | `axe.test.tsx`: 24/24 passed alone in 53.47 seconds; the 14 failures in the repeated full run did not reproduce. |
| Targeted rerun of the six timeout files (original local assessment) | Fail | 5 files passed and `DemandContribution.test.tsx` failed: 4 failed and 28 passed across the six files. The remaining failures include a 15-second timeout, overlapping React `act()` calls, a detached/null host, and missing rendered controls/content. |
| PostgreSQL/RLS harness (original local assessment) | Not run | The harness correctly refused to test against the wrong major because PostgreSQL 17 was unavailable locally. No local claim about migration/RLS correctness is made. |
| Secret-backed/live checks | Not run | No live provider credentials or production mutations were used in this documentation assessment. |
| HawkScan on Phase A release | Pass | GitHub Actions completed the product and company-site HawkScan jobs for the exact PR and main release heads. Scan success remains point-in-time DAST evidence, not a compliance or institutional-approval claim. |

During the original local assessment the dependency tree was already present and the environment did not expose npm, so `npm ci` and a fresh local `npm audit` were not rerun. The later exact-SHA GitHub CI result and the October 2 Gitleaks artifact are point-in-time evidence, not substitutes for a future release-candidate refresh.

## Confirmed architecture facts

1. The shipping client is a React 19 + Vite PWA backed by Supabase. It includes a service worker and responsive/mobile presentation, but it is not a native iOS/Android SQLCipher application.
2. PostgreSQL/Supabase is the canonical persistence architecture. No need for Cosmos DB was found.
3. The repository contains a typed 60-capability governance register with maturity levels L0-L9, activation classes, data authority, fallbacks, ownership seats, and high-risk requirements. Every row currently has repository state `verified`, which maps to L3; this is not a live-state claim.
4. The repository also contains audience-level release profiles with exact-SHA evidence expiry and activation gates. These are strong foundations, but capability maturity, release profile, route visibility, tenant entitlement, and public claims are not yet one resolved runtime status using the requested vocabulary (`live`, `connected`, `pilot`, `early_access`, `institution_controlled`, `planned_but_not_exposed`).
5. The provider adapter contract is strong and fail-closed, but `app/server/integration/registry.ts` deliberately registers zero live adapters. Current SIS/campus adapters are mocks or sandbox fixtures.
6. LTI, SCIM, identity, reconciliation, support, audit, outbox, and tenant-control foundations exist in source and migrations. That does not prove a real provider or institution has accepted them.
7. Family planning exists locally; synthetic/sandbox family grants exist server-side. Production-verified guardian relationship verification and minimized projection delivery were not established.
8. Browser offline detection, PWA caching, local persistence, and replay helpers exist. SQLCipher key lifecycle and CRDT document replication do not.
9. Search and app discovery exist, but a unified, server-authorized, tenant-filtered search index shared with AI retrieval was not found.
10. Notification preferences and push foundations exist; a fully operated multi-channel inbox with delivery/retry evidence, SMS governance, and staffed escalation is only partial.

## Product-plane summary

| Plane | Current factual state | Operational status |
| --- | --- | --- |
| Student OS | Broad end-user product, source-aware workflows, local-first creation and planning | Pilot/early access by capability; not one blanket live claim |
| Productivity suite | Documents, sheets, decks, data, diagrams, files, notes, study tools | Mostly student-owned/local; collaboration and durable cloud semantics vary |
| Campus super-app | Campus, dining, housing, maps, athletics, clubs and services surfaces | Mostly partial or source-dependent; no universal live campus feeds |
| Institution OS | Typed policies, control-plane code, SCIM/LTI foundations, migrations, sandbox | Institution-controlled; no named-tenant activation evidence |
| AI assistant | Governed assistant, injection tests, kill-switch and confirmation patterns | Provider/policy dependent; no autonomous high-impact action |
| Marketplace | Opportunity/profile concepts and moderation/governance pieces | Early access/design; no production partner ecosystem |
| Family/guardian | Local planning, consent concepts, sandbox grants, family migrations | Institution-controlled and not production-live |
| Career/alumni/credentials | Career planning, applications, mentor/credential concepts | Mostly student-owned planning; verified external network absent |
| Operations/trust | Extensive docs, audit/outbox/support/control-plane foundations | Internal/partial; staffing and current live drills remain external gates |

The complete capability inventory is in `docs/product/capability-inventory.md`.

## Navigation convergence

The current five-item tab model (`Today`, `My Path`, `Search`, `Plan`, `Me`) and the 63-destination registry should not be replaced with new applications. Preserve route IDs and deep links, then introduce the requested seven top-level groups as registry metadata:

| Target group | Existing capabilities/routes to converge |
| --- | --- |
| Home | Today, Priorities, Schedule, Recommended next actions, Assistant |
| My Journey | Courses and assignments, Study and productivity, Writing and creation, Grades and degree, Career and credentials, Financial life, Goals and milestones |
| Campus | People, Community, Events, Dining, Housing, Maps, Athletics, Campus services, Clubs and activities |
| Opportunities | Jobs, Internships, Research, Scholarships, Mentors, Marketplace, Student services, Alumni connections |
| Support | Advising, Tutoring, Financial aid, Accessibility, Wellness, Career services, Help and support requests |
| Family | Consent center, Family invitations, Student-controlled shared updates, Financial coordination, Shared logistics, Privacy and sharing boundaries |
| Settings | Account, Privacy, Connected services, Notifications, AI controls, Data export/deletion, Security |

Institution and internal-operator surfaces remain separate role-appropriate shells, but they must resolve the same person, tenant, capability, policy, evidence, event and audit records. Global search remains a command, not an eighth product silo.

## Source-of-truth summary

| Data | Authority | Semester behavior |
| --- | --- | --- |
| Enrollment, terms, programs, official grades, transcripts, degree certification | SIS/institution | Read-only integration or clearly labeled personal/synthetic copy until explicitly approved. |
| Course delivery, LMS assignments, submissions and receipts | LMS | LMS wins conflicts; no submission may read as complete without authoritative receipt. |
| Personal tasks, notes, drafts, plans, preferences, personal calendar annotations | Student/Semester | Semester may own; export, deletion, conflict, offline and provenance rules apply. |
| Family sharing | Student consent + verified relationship + institution policy | Only minimized, expiring projections; relationship alone is never authority. |
| Marketplace application disclosures | Student-selected disclosure snapshot | Partners receive only approved fields; no raw SIS/LMS access. |
| Derived recommendations | Semester, derived from labeled sources | Preserve source version, freshness, derivation, and override; never become an official record silently. |

## Documentation consolidation

The repository is documentation-heavy and currently has multiple overlapping root-level audits and readiness documents. Preserve them as evidence, but establish these Phase A documents as the current entry points. A later documentation-only PR should:

1. Add `docs/README.md` with canonical indexes for architecture, product, security, operations, API, runbooks, evidence, and archive.
2. Move superseded root audits into `docs/archive/<date>/` without deleting history.
3. Add `status`, `owner`, `last reviewed`, `supersedes`, and `evidence horizon` headers to canonical documents.
4. Generate status tables from typed source where possible; do not maintain duplicate hand-edited maturity facts.
5. Keep legal drafts visibly separate from approved legal instruments and keep repository evidence separate from live operational evidence.

## Branch and pull-request consolidation

At assessment time there were 36 open PRs, including long-lived overlapping institutional-core drafts. Do not bulk-merge or bulk-close them. Triage each against current `main` and the canonical graph before retaining work:

- Treat #1130 as the active operations-console line and compare #1049 before carrying any console-state fix forward.
- Reconcile the overlapping institutional-core chain (#993, #1047, #1059, #1061, #1062, #1063) into dependency-ordered slices against current migrations and policy code.
- Reconcile duplicate alumni-consent work (#1005 and #1023) and guardian work (#1004 and related drafts) into the single relationship/consent/projection model; do not merge both authorization vocabularies.
- Keep small current fixes (#1131, #1119, #1104, #1080) independently reviewable; do not use them as proof of institution activation.
- Label superseded PRs only after diff/evidence review, then close them in a separately approved cleanup action. This Phase A branch changes documentation only and does not mutate PR state.

## Assessment artifacts

The original assessment added the first canonical artifacts below. This documentation follow-up expands the operating contracts without changing runtime code, migrations, external systems, capability activation or production data:

- `docs/architecture/semester-convergence-baseline.md`
- `docs/architecture/unified-education-graph.md`
- `docs/security/ferpa-risk-and-permission-matrix.md`
- `docs/architecture/offline-sync-contract.md`
- `docs/architecture/multi-tenant-isolation.md`
- `docs/product/capability-inventory.md` (supporting inventory)
- `docs/operations/launch-readiness.md` (supporting risk, approval and milestone register)
- `docs/architecture/data-quality-and-reconciliation.md`
- `docs/architecture/workflow-engine.md`
- `docs/operations/company-completion-model.md`
- `docs/operations/full-company-launch-simulations.md`
- `docs/product/accessibility-integrity-content-community.md`
- `docs/security/security-assurance-roadmap.md`

Database migrations added: none. The reason for the change is to create a single evidence-gated baseline for the complete founding thesis before implementation slices begin.

## Release conclusion

No broad GA or named-institution go-live is supported by this assessment. The repository supports a credible, governed pilot architecture. Activation should proceed only after the specific capability's evidence record is current and all external approvals are attached. The first implementation work should strengthen the canonical capability registry and claim gate before adding breadth.

The focused capability-state resolver and release-profile work described in `docs/operations/launch-readiness.md` merged in PR #1139. The next implementation slices are the evidence-gated milestones 11–15 in that document; PostgreSQL 17 policy evidence remains required before changing tenant policy or activating an integration.
