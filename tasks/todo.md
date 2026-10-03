# Semester finalization execution checklist

## Phase 0 — Truth layer

### T00: Reconcile current evidence

**Acceptance criteria:**
- [x] Repository, deployment, operational, legal, commercial, and external evidence are separated.
- [x] Existing uncommitted changes are inventoried and preserved.
- [x] Current readiness decisions remain conservative where evidence is absent.

**Verification:** branch/revision/status capture; source links resolve; external facts remain UNKNOWN unless documented.

**Dependencies:** None

### T01: Build baseline and deliverable crosswalk

**Acceptance criteria:**
- [x] `FINALIZATION-BASELINE.md` covers all 26 required baseline sections.
- [x] All 232 requested filenames map to present, candidate-source, or no-close-source status.
- [x] Duplicate source-of-truth risks are identified before new documents are created.

**Verification:** automated filename inventory plus manual claim/evidence review.

**Dependencies:** T00

### T02: Reconcile risks, owners, and external gates

**Acceptance criteria:**
- [x] Every RED/UNKNOWN item has owner role, risk, evidence, remediation, and blocked motion.
- [x] External reviewers and founder decisions are queued without being marked complete.

**Verification:** compare baseline, risk register, owner matrix, legal queue, and current go/no-go decision.

**Dependencies:** T01

## Phase 1 — Company operations

- [x] C01: company documents 1–5; verified purpose, owner, cadence, authority, version/effective-date placeholders, dependencies, and external confirmations on 2026-10-03.
- [x] C02: company documents 6–10; verified required structure, professional-review boundary, and external confirmations on 2026-10-03.
- [x] C03: company documents 11–15; verified required structure, professional-review boundary, and external confirmations on 2026-10-03.
- [x] C04: company documents 16–20; verified control lifecycle, ownership, cadence, approval boundary, evidence requirements, and external limits on 2026-10-03.
- [x] Checkpoint C: all 20 company artifacts preserve founder, attorney, accountant, tax, insurance, banking, IP, employment, vendor, and continuity facts as unverified until supplied by the accountable authority.

**Dependencies:** T02

## Phase 2 — Legal and commercial drafts

- [x] L01: public legal documents 1–5; reconciled canonical sources, disclaimer, placeholders, jurisdiction/age questions, behavior mapping, plain-language summary, and publication blockers on 2026-10-03.
- [x] L02: public legal documents 6–10; reconciled source drafts and added community, copyright, accessibility, security, and AI disclosure controls on 2026-10-03.
- [x] L03: public legal documents 11–15; created controlled drafts with exact disclaimer, public summaries, consumer/institution boundaries, age/jurisdiction decisions, behavior mappings, and publication blockers on 2026-10-03.
- [x] L04: public legal documents 16–20; created controlled drafts with exact disclaimer, applicability/decision placeholders, public summaries, audience boundaries, behavior mappings, and publication blockers on 2026-10-03.
- [x] L05: institutional legal documents 21–25; created evidence-bounded MSA, order form, pilot agreement, SOW, and DPA drafts with exact disclaimer, decision schedules, behavior mappings, and signature/activation blockers on 2026-10-03.
- [x] L06: institutional legal documents 26–30; created evidence-bounded student-data, security, service-level, support, and acceptable-use exhibits with exact disclaimer, schedules, behavior mappings, and signature/activation blockers on 2026-10-03.
- [x] L07: institutional legal documents 31–35; added evidence-bounded responsibility, data lifecycle, subprocessor, incident-notification, and accessibility-roadmap exhibits with exact disclaimer and signature/activation blockers on 2026-10-03.
- [x] L08: institutional legal documents 36–40; added evidence-bounded AI-use terms, mutual NDA, evaluation agreement, professional-services terms, and institutional pilot proposal drafts with exact disclaimer, decision schedules, behavior mappings, and signature/activation blockers on 2026-10-03.
- [x] L09: institutional legal documents 41–44; added procurement-cover, controlled RFP library, negotiation, and contract-deviation drafts with exact disclaimer, truthful-status controls, approval routing, and signature/activation blockers on 2026-10-03.
- [x] L10: internal legal governance documents 45–49; added compliance-calendar, legal-intake, claim-approval, marketing-review, and data-rights procedures with exact disclaimer, evidence ceilings, routing, and operational blockers on 2026-10-03.
- [x] L11: internal legal governance documents 50–54; added evidence-bounded law-enforcement-request, legal-hold, IP-inventory, open-source-compliance, and release-notices drafts with exact disclaimer, scoped evidence mappings, approval routing, and operational/publication blockers on 2026-10-03.
- [x] L12: internal legal governance documents 55–56 plus `LEGAL-TRUTH-MAPPING.md`; added evidence-bounded trademark/brand and domain/digital-asset controls and consolidated every legal artifact's evidence ceiling and activation gate on 2026-10-03.
- [x] Checkpoint L: all 56 requested legal files begin with the required disclaimer and preserve placeholders, jurisdiction/age review, plain-language summaries, behavior/evidence mappings, publication blockers, and the distinction between draft completeness and external approval.

**Dependencies:** T02; company-fact placeholders from C01–C04 where relevant.

## Phase 3 — Trust, security, privacy, and AI

- [x] S01: trust documents 1–5; added evidence-bounded data inventory, classification, flow map, processing register, and student-data governance program with explicit control status, code/config evidence, operational evidence, owners, missing proof, and claim ceilings on 2026-10-03.
- [x] S02: trust documents 6–10; added evidence-bounded minimization, retention/deletion, export, rights-request, and consent/preference controls with explicit status, ownership, missing proof, and prohibited-claim ceilings on 2026-10-03.
- [x] S03: trust documents 11–15; added evidence-bounded subprocessor, vendor-review, information-security, access-control, and IAM programs with status, ownership, missing proof, and prohibited-claim ceilings on 2026-10-03.
- [x] S04: trust documents 16–20; added evidence-bounded password/session/MFA, encryption/key-management, secure-development, vulnerability-management, and security-testing controls with explicit status, owners, technical and operational evidence, missing proof, and claim ceilings on 2026-10-03.
- [x] S05: trust documents 21–25; added evidence-bounded logging/monitoring/alerting, incident plan/runbook, continuity/recovery plan, and backup/restore/rollback runbook with explicit staffing, target-exercise, provider-backup, and RTO/RPO blockers on 2026-10-03.
- [x] S06: trust documents 26–30; added evidence-bounded change, release, asset, threat-model, and risk-treatment controls with explicit approval, inventory, target-testing, recovery, staffing, and residual-risk blockers on 2026-10-03.
- [x] S07: trust documents 31–34; added controlled security-questionnaire, HECVAT, NIST 800-53, and education-privacy readiness matrices with explicit customer scope, external assessment, legal applicability, and approval blockers on 2026-10-03.
- [x] S08: AI-governance documents 35–39; added controlled governance, system inventory, risk, data-use, and transparency/user-notice artifacts with feature-specific approval gates, repository-versus-operational evidence, and explicit claim ceilings on 2026-10-03.
- [x] S09: AI-governance documents 40–42; added controlled human-oversight, AI incident/kill-switch, and model/prompt change-management artifacts with scoped operational evidence, target exercise blockers, and explicit claim ceilings on 2026-10-03.
- [x] Checkpoint S: audited all 42 requested trust and AI-governance artifacts on 2026-10-03; every artifact has status, code/config or implementation evidence, operational evidence, owner, missing test/proof or gap, and an explicit prohibited-claim ceiling.

**Dependencies:** T02; relevant legal mapping batches.

## Phase 4 — Product and design

- [x] D01: design/product documents 1–5; added a controlled current-state audit, design-system operating standard, product quality bar, core-journey map, and student first-win specification while preserving the existing Semester foundation and separating repository evidence from observed outcomes on 2026-10-03.
- [x] D02: design/product documents 6–10; added controlled pilot-first-proof, accessibility, responsive QA, performance-budget, and UI-consistency artifacts that distinguish repository guards and measured bundle ceilings from customer, device, field and human-validation evidence on 2026-10-03.
- [x] D03: design/product document 11 and cross-document consistency review; added the controlled product-copy and voice guide, reconciled owner, status, evidence, missing-proof and claim-boundary fields across all 11 product/design artifacts, and preserved the existing Semester vocabulary on 2026-10-03.
- [x] Checkpoint D: first win, first proof, state coverage, responsive matrix, keyboard/zoom/reduced-motion plans, performance budgets, component reuse, brand continuity and explicit evidence ceilings are documented; human, target-environment, qualified-reviewer and named-customer proof remain open.

**Dependencies:** T02; current route/capability inventory.

## Phase 5 — Engineering operations

- [x] E01: engineering documents 1–5; added controlled system, application, data, integration, and environment/configuration architecture artifacts with Harrison Rubin accountable, repository evidence mapped, and target/customer/backup proof kept explicit on 2026-10-03.
- [x] E02: engineering documents 6–10; added controlled deployment/release, CI/CD, test strategy, coverage-matrix, and critical-flow artifacts with motion-specific closure priorities and explicit immutable-candidate, target, human, external, and customer evidence gaps on 2026-10-03.
- [ ] E03: engineering documents 11–15.
- [ ] E04: engineering documents 16–20.
- [ ] E05: engineering documents 21–24.
- [ ] Checkpoint E: implementation claims match tests/configuration; target-environment drills and owners remain open until evidenced.

**Dependencies:** T02 and S01–S09.

## Phase 6 — Commercial operations

- [ ] R01: commercial documents 1–5.
- [ ] R02: commercial documents 6–10.
- [ ] R03: commercial documents 11–15.
- [ ] R04: commercial documents 16–20.
- [ ] R05: commercial documents 21–25.
- [ ] R06: commercial documents 26–30.
- [ ] R07: commercial documents 31–35.
- [ ] R08: commercial documents 36–40.
- [ ] Checkpoint R: unknown prices/outcomes remain placeholders; pilot scope, stages, owners, metrics, support, renewal, and offboarding are coherent.

**Dependencies:** T02, legal boundaries, product first-win/first-proof definitions.

## Phase 7 — Institutional readiness

- [ ] I01: institutional documents 1–5.
- [ ] I02: institutional documents 6–10.
- [ ] I03: institutional documents 11–15.
- [ ] I04: institutional documents 16–20.
- [ ] I05: institutional documents 21–25.
- [ ] I06: institutional documents 26–27 and package consistency review.
- [ ] Checkpoint I: every capability/integration status is evidence-backed and the initial wedge remains low-risk, bounded, measurable, and supportable.

**Dependencies:** legal, trust, engineering, and commercial checkpoints.

## Phase 8 — Vertical implementation and validation

Before starting each task, split it into a maximum-five-file patch with focused acceptance criteria.

- [ ] P01: individual first-win journey.
- [ ] P02: account, consent, export, deletion, and recovery journey.
- [ ] P03: institutional first-proof, role/isolation, reporting, and offboarding journey.
- [ ] P04: company-site claim, legal-link, form, analytics, and consent truth pass.
- [ ] P05: logging, monitoring, incident, rollback, restore, kill-switch, and support path.
- [ ] P06: responsive, accessibility, keyboard, zoom, reduced-motion, performance, and failure-state matrix.
- [ ] P07: clean install, typecheck, lint, full tests, shuffle, build, gateway, secret/dependency/license scans, HawkScan fix/rescan, and evidence capture.
- [ ] Checkpoint P: no new regression; pre-existing failures separated; exact revision, command, result, and limitation recorded.

**Dependencies:** all relevant documentation checkpoints; external environment and credentials where required.

## Phase 9 — Final go/no-go package

- [ ] F01: final outputs 1–5.
- [ ] F02: final outputs 6–10.
- [ ] Checkpoint F: individual acquisition, design-partner pilot, paid pilot, and broad enterprise sale each have GO, CONDITIONAL GO, or NO-GO with blockers, owner, remediation, evidence, category, and sequencing.

**Dependencies:** P07 plus all required external evidence. Missing external evidence forces the conservative decision.

## Planning approval

- [x] Human reviewed and approved the staged plan on 2026-10-03.
