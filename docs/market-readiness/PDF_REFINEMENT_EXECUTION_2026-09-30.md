# Semester refinement and hardening execution register

Date: 2026-09-30  
Branch: `codex/semester-unified-system`  
Inputs: `what more is needed or can be imporved and refiene.pdf` and `where else can semester imporve enhance and harden.pdf`

This register turns the two recommendation documents into work against the existing Semester product. The documents are advisory inputs, not authorities that override repository policy, student control, source truth, or release gates.

## Status language

- **Present** — implemented in this checkout; still requires release verification before it is called live.
- **Strengthened in this tranche** — changed and covered by focused tests in this branch.
- **Product work** — a bounded implementation is still needed.
- **External evidence** — cannot be completed by code alone; it needs a connected institution, account, review, drill, or pilot.

## What the product already has

The recommendations do not start from an empty product. This checkout already contains:

- a Today Action Center with one ranked action, an explanation, alternatives, correction, help, snooze, dismissal, and student-controlled history;
- source labels shared with database constraints, visible freshness language, source correction controls, and AI disclosure;
- accessible page framing, keyboard controls, modal focus management, reduced-motion/contrast controls, automated labels and screen audits;
- offline persistence, conflict-aware synchronization, recovery exports, deletion tombstones, and offline tests;
- Trust Center, Configuration Studio, Migration Center, institutional preview, evidence register, risk register, interoperability registry, and release/production smoke tooling;
- registration, advising, study, career-evidence, support-routing, and campus workflow surfaces.

Those are implementation assets, not proof of production connectivity, institutional approval, accessibility conformance, security certification, or student-success impact.

## Executed now

### Universal provenance detail for Today actions

Every Today action can now carry and disclose:

- source label and source system;
- authority over the fact;
- data owner;
- correction route;
- official fallback.

The explanation sheet renders those fields in one accessible definition list. Deadline, My Path, review, and zero-state actions now populate them. This advances both PDFs' rule: no important recommendation without a source, reason, limitation, correction route, and official fallback.

### Explicit stale or unavailable status

`Unavailable or stale` is now a display-only trust state. It does not expand the five stored database source labels. A reusable freshness classifier requires each caller to supply its own maximum age, because registration data, a transcript, and a student note do not share one honest freshness rule.

Today applies a 24-hour account-sync rule in its at-a-glance context. Missing or older sync evidence is no longer visually neutral: Semester says what may be affected, what still works, how to recover, and when to use the official system.

### Verification

- Focused behavior: 47 tests passed.
- Changed-file lint: passed with zero warnings.
- Style-token check: passed.
- Accessible-label check: passed.
- Retired-language check: passed.
- Production TypeScript/Vite build: passed.
- Broad repository suite: 18,897 tests passed and 5 timed out in source-census/property tests during an accidentally broad run. No assertion failure was reported in the changed behavior; the focused suite was rerun successfully.
- Full lint remains red because the checkout already exceeds its repository-wide 25-warning ceiling in unrelated files. The changed files pass strict zero-warning lint.

## Workstream register

| Recommendation cluster | Current evidence | Status | Next release-bounded step |
|---|---|---|---|
| Trusted daily home / first 90 seconds | `TodayActionCenter`, ranked actions, explanations, calm completion state | Present + strengthened | Measure load time and action completion in a consented pilot; do not infer habit or outcome impact from UI tests. |
| Source authority and freshness | Shared source enum, `SourceBadge`, intelligence disclosure, new provenance detail and stale state | Strengthened in this tranche | Add domain-specific freshness policies to registration, advising, catalog, and integration feeds; expose change history where the backend supplies it. |
| Change Impact Engine | Change surfaces, action ranking, recovery primitives exist | Product work | Define a versioned source-event contract, preserve before/after state, link affected plans, and require bounded recovery options before enabling notifications. |
| No-wrong-door support and human handoff | Help routes, office actions, advisor meeting and support surfaces exist | Present, not institution-connected by default | Validate routing against one institution's official directory; test failed handoff, no-response recovery, consent, expiry, and revocation. |
| Student Control Center | Trust, privacy, sharing, export, deletion and account controls exist across current surfaces | Product work | Consolidate them into one inventory showing data, origin, connections, sharing, AI use, exportability, deletion limits, and expiry. |
| Institution Configuration Studio | Configuration and control-plane components exist | Present, release evidence incomplete | Prove draft → preview → impact → approval → effective date → audit → rollback against a sandbox tenant. |
| Implementation as a product | Migration/operations centers, launch kit, readiness and evidence registers exist | Present, release evidence incomplete | Run a complete sandbox implementation with named owners, decision aging, training, hypercare, and go-live blockers. |
| Open ecosystem | Interoperability, SSO/SCIM/LTI/OneRoster/QTI/CASE/Open Badges registries and tests exist | Capability inventory present | For each claimed integration, attach a sandbox exchange, mapping, reconciliation result, freshness rule, failure test, and export/exit proof. |
| Accessibility advantage | Automated accessibility and interaction guards exist | Present, external evidence required | Complete keyboard, screen reader, zoom/reflow, authentication, offline, and low-bandwidth manual testing; publish known issues and remediation dates; prepare ACR/VPAT when appropriate. |
| Offline and low connectivity | Offline persistence, sync states, safe-write and recovery tests exist | Present | Run installed-PWA loss/reconnect tests on target devices and verify conflict resolution against a real account. |
| Critical-period modes | Registration and several focused workflow surfaces exist | Partial product work | Use one shared critical-period contract: checklist, action center, source health, support route, official fallback, and recovery mode. Start with Registration; gate later modes on evidence. |
| Student-owned learner record | Career evidence, skills, projects, exports and sharing controls exist | Partial product work | Define issuer/verification, portability, revocation, visibility, retention, and deletion rules before calling the record definitive or verified. |
| Honest AI | Source-aware answers, provider controls, quality tests and kill-switch/governance code exist | Present, external evidence required | Maintain an approved-use-case register and evaluation set; verify provider terms, identifiable-data defaults, incident kill switch, course-policy handling, and human escalation. |
| Screen quality standard / simpler IA | UI constitution, screen audit, page shell and navigation registries exist | Present as governance, migration incomplete | Use the generated screen audit to retire or nest routes only after deep-link, search, accessibility, and workflow-entry tests pass. Do not remove destinations by label alone. |
| Onboarding and zero state | First-run, import, sample-retirement and empty-workspace action exist | Present, measurement needed | Validate the first-session sequence with new accounts and measure time to first meaningful action without requiring an institution connection. |
| Notification restraint | Notification policies and tests exist | Partial product work | Enforce one-priority, quiet-hours, deduplication, privacy-safe lock-screen copy, handled-elsewhere, pause-all, digest, and “Why did I get this?” across every channel. |
| Reliability, security, privacy, FERPA, AI safety | Governance, risk, compliance and operational registers exist | External evidence | Attach current threat model, access tests, scan results, tenant-isolation test, backup/restore drill, incident drill, DPA/data map, retention/offboarding evidence, SLO history, and accountable owners. |
| Repeatable institutional adoption | Launch kit and institutional operations tooling exist | External evidence | Complete one controlled pilot implementation and report launch time, manual configuration, exceptions, training, support burden, activation, outcomes, limitations, and expansion decision. |
| Commercial discipline | Product/launch materials exist outside this student-app tranche | Business decision | Name the first buyer, pilot package, measurable workflow change, price/contract assumptions, expansion gates, and claims-review owner before publishing enterprise claims. |

## Release boundary

This branch is a local implementation result. It is not, by itself:

- merged into the active release branch;
- deployed to a production Vercel project;
- connected to the live Supabase project;
- proof of fresh institutional data or working third-party integrations;
- an accessibility conformance report;
- a security, FERPA, or AI-safety certification;
- evidence of student-success outcomes;
- a completed institutional pilot.

Those states must remain separate in release notes, sales materials, the company site, and the in-product status surfaces.
