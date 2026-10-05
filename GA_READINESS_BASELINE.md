# Semester GA readiness baseline

**Assessment date:** 2026-10-02 (America/Chicago)
**Candidate baseline:** `origin/main` at `92eeafd9`
**Candidate version:** no GA version assigned
**Decision:** **NO-GO**

This baseline records what is demonstrably true. It does not convert a repository control, a passing local test, a draft, or a proposed integration into production or institutional evidence.

## Executive finding

Semester has unusually broad product and governance machinery, but the release gates required for general availability are not closed. The repository's executable launch model returns `NO-GO`; the live go-live checklist still has blocking operational items; the Vanderbilt named-tenant register is 0 approved / 60 pending; legal documents are drafts; external accessibility and security assessments are absent; restore, rollback, support, incident, and monitoring evidence is incomplete; and no institution has accepted the production configuration.

Beta and preview language must remain. Removing it now would create a misleading public claim.

## Evidence layers

| Layer | Evidence observed | Baseline status |
| --- | --- | --- |
| Source | Current `origin/main` candidate inspected at the commit above | established |
| Build | Typecheck, lint and production build completed locally; bundle-size warnings remain | pass with warning |
| Unit/integration | Targeted launch/security/Guide tests pass; default full suite: 1,257/1,257 files pass, with 19,610 tests passed and 48 intentionally skipped | pass; the load-sensitive timeout failures were remediated and the default command is green locally |
| Browser | Manual runtime checks covered Today, Courses, Account, Privacy and Guide listen mode at 390×844 and 1440×900 | limited pass; not the complete supported matrix |
| Security | Security controls and CI workflows exist; the production npm dependency audit reports 0 vulnerabilities; HawkScan DAST still cannot run without its runtime and API key | partial; DAST and independent testing remain open |
| Operations | Runbooks exist; live alert ownership, production restore and rollback drills are not evidenced | incomplete |
| Legal/privacy | Draft policies and data-handling inventories exist; counsel approval and in-force publication are not recorded | incomplete |
| Accessibility | Automated checks exist; independent audit, assistive-technology coverage and ACR/VPAT are not complete | incomplete |
| Institution | Vanderbilt L5 register reports 0 approved / 60 pending and explicitly caps evidence at L4 | blocked |
| Commercial | Pricing material exists, but checkout, terms, refund, support and institutional contract authority are not GA-ready | incomplete |

Dependency installation was not freshly completed: native `npm` was unavailable on this host. The assessment reused an existing dependency tree only after confirming its `package-lock.json` hash matched this checkout. That supports local verification, but it does not satisfy the clean-install gate; `npm ci` must pass in the release environment.

## Product-area audit

The main product surface spans the workspace shell, onboarding, courses, course items, calendar, profile/account/settings, import, study modes, planning, content creation, communication, privacy/export, institutional operations, registration/gradebook, university services and student-life workspaces. The route union and capability registry prove breadth, not operational readiness.

### Route and workflow inventory

The source audit reports 96 screens across 90 modules. Route identifiers, grouped by product area, are:

- **Shell/unassigned:** `search`, `directory`, `activity`, `whatsnew`, `agreements`, `recovery`, `volunteers`.
- **Today:** `gap`, `home`, `hub`, `notifs`.
- **Plan:** `note`, `community`, `career`, `event`, `mine`, `moderation`, `pathway`, `applying`, `registrar`, `runway`, `volunteer`, `yes`, `calendar`, `costs`, `launchpad`, `opportunities`, `registration`, `announce`.
- **Learn:** `drill`, `quiz`, `guide`, `ask`, `guess`, `slides`, `import`, `course`, `create`, `equations`, `exam`, `item`, `lesson`, `study`, `update`, `work`, `write`, `deck`, `edit`, `groupwork`, `proof`, `sheet`, `analyse`, `clocks`, `courses`, `draw`, `essay`, `gradebook`, `meet`, `solve`, `sources`.
- **Help:** `family`, `behind`, `help`, `people`, `support`.
- **Campus:** `call`, `mail`, `nil`, `athletics`, `maps`, `university`, `activities`, `classmates`, `housing`, `links`, `meals`.
- **Progress:** `degree`, `brief`, `console`, `dining`, `me`.
- **You/settings:** `settings`, `data`, `setAlerts`, `setAssistant`, `setCourses`, `setLook`, `connect`, `privacy`, `profile`, `setAbout`, `setGrading`, `setNav`, `setWorkload`, `account`, `export`.

Primary workflows are: first run and optional account creation; syllabus import → source review → date confirmation → course; Today action → calendar planning → completion/resume; study guide/card/quiz/listen/source modes; user-data export/device erase/cloud-account deletion; connection setup and health; support/barrier/incident reporting; and controlled institutional configuration → approval → activation → audit → rollback. Payments, official registration/gradebook writes, human-help sending, shared services and institutional integrations are configuration-dependent and are not all live.

The audit classifies capabilities as follows:

- **Usable with repository evidence:** local-first planning and coursework flows, source-backed study tools, user-controlled export/deletion surfaces, feature/capability registries, tenant-aware policy code, and automated accessibility checks.
- **Controlled or configuration-dependent:** account sync, human-help routing, SSO, institutional configuration, notifications, AI providers, payment, moderation, operational console and shared services.
- **Institution-dependent:** registrar, SIS/LMS, gradebook, official deadlines, bursar/financial aid, dining, housing, campus card, sanctioned directory/service data and production SSO.
- **Not GA-proven:** production restore and rollback, on-call response, contractual SLO, full incident exercise, qualified accessibility audit, external penetration test, counsel-approved terms/DPA, paid lifecycle, and a named institution's acceptance.

## Highest-risk findings

| ID | Severity | Finding | Required evidence to close |
| --- | --- | --- | --- |
| GA-001 | P0 | Repository launch model and blocking checklist return NO-GO | every release gate met and signed by the full council |
| GA-002 | P0 | No named institution has approved the candidate; Vanderbilt is 0/60 | current tenant/configuration approvals plus live acceptance results |
| GA-003 | P0 | Legal documents are explicitly drafts and not in force | qualified counsel approval, legal entity details, executed DPA/order terms and published policies |
| GA-004 | P0 | Production restore, rollback and incident response are not exercised end-to-end | dated drill records with owners, RTO/RPO, outcomes and remediation |
| GA-005 | P1 | No qualified accessibility audit or completed ACR/VPAT | independent audit, manual keyboard/screen-reader results, remediation and signed status statement |
| GA-006 | P1 | No completed external penetration test; local HawkScan unavailable | authenticated DAST/pen-test results, triage, fixes and clean rescan |
| GA-007 | P1 | Monitoring has no resilient named on-call route or exercised escalation | alert delivery evidence, rota/coverage, paging test and incident exercise |
| GA-009 | P1 | Public company site still truthfully describes private beta and non-live pricing | retain until all gates close; then update atomically with GA release |
| GA-010 | P2 | Production build emits large-chunk warnings | measured performance budget and accepted or remediated route-level loading costs |
| GA-011 | P2 | Source audit scores 12 screens “redesign before new features” and 55 “targeted migration” on its automatable half | product review, prioritised remediation and human validation of the five non-automated criteria |

## Code defects found and fixed during baseline

A cold deep link to `#/guide/econ?mode=listen` could render before the asynchronous guide catalog arrived and dereference an undefined podcast record. The screen now uses an empty podcast fallback during that loading interval. The accessibility harness was strengthened so an error-boundary screen can no longer count as an accessibility pass. The focused desktop and phone accessibility regression passes.

The full suite's load-sensitive failures were also remediated. Test-worker concurrency is now bounded, long-running integration coverage has an explicit timeout budget, and the key-read audit builds a one-pass source index instead of rescanning every file for every field. The default local suite now passes 1,257/1,257 files, with 19,610 tests passed and 48 intentionally skipped. Current CI evidence is still required for a release decision.

The bundle budget script passes: first load 435.0 KB against a 479.0 KB limit, largest budgeted file 435.7 KB against 480.0 KB, and 93 routes measured. This does not erase the production build's separate warnings for chunks above 500 KB or prove real-user performance.

## Beta-state inventory

Release-state language is concentrated in `company-site/index.html`, the private-beta membership UI, plan/known-limitations copy, launch/governance documents and capability labels. Other occurrences of “preview” are functional previews (for example, review-before-send) and must not be mechanically replaced.

The exact release-state scan (`private beta`, `limited beta`, `early access`, `public preview`, `beta cohort`, `during beta`) found 26 files across application, company-site and documentation sources. No standalone mail/email template matched those exact terms. Public references include metadata/structured data, banner, navigation, pricing, invite, readiness, status, FAQ, capability labels and search index. App references include the beta membership panel and plan/known-limitations copy.

| Class | Examples | GA action |
| --- | --- | --- |
| Release status | private beta banner, metadata, invite pages, beta membership panel | retain under NO-GO; remove only in the atomic GA release |
| Commercial status | free during beta, checkout/test keys, plans not on sale | retain until paid lifecycle and legal terms are proven |
| Capability maturity | Limited beta, Built and tested, Institution-configured, Planned | preserve as capability-specific truth after GA unless that capability itself advances |
| Functional UI | preview an import/message/change before committing | do not rename; this is a product behavior, not release status |
| Technical/math | beta distribution/symbol or preview branch | do not rename; unrelated to product maturity |

## Baseline decision

**NO-GO.** The product may continue as a controlled beta and design-partner preparation program. It must not be represented as generally available, enterprise-ready, compliant, fully accessible, Vanderbilt-approved, or production-proven at institutional scale.

## Institutional capability disposition

| Capability | Disposition | Current boundary |
| --- | --- | --- |
| Organization/workspace model | Implemented and evidenced in code | named-tenant production acceptance absent |
| Multi-tenant isolation | Implemented and evidenced in policy suites | full live and legacy-path proof still required |
| Roles/admin controls/audit logs | Implemented or in progress | configuration approval and operational review absent |
| User export/deletion | Implemented and evidenced in tests | backup, legal-hold and tenant-wide exit require proof |
| Ownership transfer/team management | Enterprise tier / in progress | acceptance and offboarding evidence absent |
| SAML/OIDC SSO | Enterprise tier; controlled tests exist | not live or approved for a named institution |
| SCIM | Enterprise-only where contracted | not GA-evidenced; keep out of sales claims |
| MFA | Identity-provider capability | privileged enforcement/evidence incomplete |
| Data residency | Enterprise/legal requirement | provider region is not a contractual commitment |
| DPA/data-processing terms | Required before institutional production | counsel-approved/executed DPA absent |
| Status and incident communication | In progress | status surface exists; resilient notification/on-call absent |
| Support/escalation | Required before GA | channel, owners and exercised model incomplete |
| Implementation/onboarding | In progress | guides exist; repeatable acceptance not proven |
| APIs/integrations | Enterprise and capability-specific | sell only exact tested protocols; no blanket LMS/SIS claim |
| Accessibility documentation | In progress | independent audit and ACR/VPAT absent |
| SLA/service levels | Deferred until measured operations support them | framework is not a commitment |
| FERPA/GDPR/COPPA/PCI/HIPAA | Legal/applicability determination | no blanket compliance claim |
