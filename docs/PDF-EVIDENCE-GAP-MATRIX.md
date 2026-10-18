# PDF-to-evidence gap matrix

<!-- Rendered from app/src/lib/ops/pdfgaps.ts by pdfgaps.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).

Source: the owner's source-grounded synthesis of six readiness PDFs, extracted with Adobe on 30 September 2026 — fourteen common P0s, lettered (a)–(n), and five operating artifacts. **The PDFs are not in the repository**, so a row cites the synthesis and its letter, not a page. The synthesis is **requirements evidence, not authority**: nothing here executes it, and a row saying "covered" is a statement about the tree, not about a launch.

Reconciled against `main` and the open pull requests on 30 September 2026. 20 rows: 4 covered, 6 partial, 4 built-here, 3 open-design, 2 security-workstream, 0 blocked, 1 not-to-build.

## Verdicts

| Verdict | Meaning |
| --- | --- |
| `covered` | The tree already does this, with a test; nothing added |
| `partial` | Part is done and cited; the rest is stated |
| `built-here` | Added on this branch (#1021) |
| `open-design` | A real gap, but the design needs a decision first; not built |
| `security-workstream` | Implementation belongs to the security workstream; this page records the requirement and what exists |
| `blocked` | Needs an owner, counsel, a specialist or a manual test that only a person can do |
| `not-to-build` | Deliberately not built or claimed yet |

## Matrix

### a — Compliance ledger with the six states Not started / In progress / Implemented / Tested / Evidenced / Approved and an accountable owner

**covered** · blocked by: owner

**Today.** The Master Launch Readiness Register has nine states that contain the six (not-started = Not started, building = In progress, implemented, tested, evidenced, launch-approved = Approved), a test per claim a state makes, and seat-level sign-off. RELEASE-GATES.md adds the ten readiness gates.

**Remaining.** Owners are seats, and most seats are one person, acting; none has signed. Nothing is above tested until artifacts are filed under docs/evidence/.

**Evidence.** [`app/src/lib/masterregister.ts`](../app/src/lib/masterregister.ts), [`docs/MASTER-LAUNCH-READINESS-REGISTER.md`](MASTER-LAUNCH-READINESS-REGISTER.md), [`app/src/lib/launchreadiness.ts`](../app/src/lib/launchreadiness.ts), [`docs/RELEASE-GATES.md`](RELEASE-GATES.md)

### b — FERPA legitimate-interest authorization = tenant + role + active relationship/scope + purpose code + data class, with permit and deny audit records

**open-design** · blocked by: counsel

**Today.** Tenant + role + scope is enforced (role_grants, has_capability, RLS); support access is student-approved, purpose-limited, time-limited and audited; the audit envelope records outcomes. There is no purpose code and no data-class dimension on a decision, and denied attempts are not yet on the audit record.

**Remaining.** Which purposes exist, which data classes each may reach, and what counts as a legitimate educational interest are counsel's to define. Then: a deny-by-default purpose policy per school, a decision function that writes permit and deny events, and negative tests. Building the mechanism before the policy would ship an empty shell.

**Evidence.** [`docs/FERPA-IDENTITY-GUARDRAILS.md`](FERPA-IDENTITY-GUARDRAILS.md), [`app/src/lib/trust/ferpa-consent.ts`](../app/src/lib/trust/ferpa-consent.ts), [`supabase/migrations/20260930000000_audit_and_subject_requests.sql`](../supabase/migrations/20260930000000_audit_and_subject_requests.sql), [`docs/ROLE-PERMISSION-MATRIX.md`](ROLE-PERMISSION-MATRIX.md)

### c — Canonical person / identity / source-authority model

**open-design** · blocked by: owner · coordinate with: #1011 Configuration Studio, #1018 Workflow Builder

**Today.** Five source labels are DB-checked on four tables; integration connections declare which domains they are source of truth for; account linking and identity privacy are designed. There is no person table above auth.users, no cross-system identifier crosswalk, and no per-domain statement of which system wins a conflict.

**Remaining.** A crosswalk and a conflict rule per data domain, decided with a real institution's systems in view. Designing it against no real SIS invents the answer; it starts with the first pilot school's identifiers.

**Evidence.** [`docs/ACCOUNT-LINKING-AND-IDENTITY-PRIVACY.md`](ACCOUNT-LINKING-AND-IDENTITY-PRIVACY.md), [`docs/DOMAIN-REPLACEMENT-REGISTER.md`](DOMAIN-REPLACEMENT-REGISTER.md), [`docs/DATA-INVENTORY-AND-LINEAGE.md`](DATA-INVENTORY-AND-LINEAGE.md), [`app/src/lib/source.test.ts`](../app/src/lib/source.test.ts)

### d — Strict LTI trust tuple and JWT validation plus replay defense

**security-workstream** · blocked by: security

**Today.** Launch validation checks issuer, audience (string or array), authorized party, expiry, issued-at with skew, a single-use nonce (lti_nonce), LTI version 1.3.0 and the deployment id, each with a named refusal and tests; the JWKS publishes RS256 with a stable kid.

**Remaining.** The security workstream to confirm against the checklist: the inbound signature algorithm is pinned and the platform key is chosen by kid from the registered JWKS; the issuer + client id + deployment id tuple is enforced per tenant end to end; and the FERPA/LTI audit runbook is walked against a real platform. Not re-implemented here.

**Evidence.** [`supabase/functions/_shared/lti.ts`](../supabase/functions/_shared/lti.ts), [`supabase/lti.check.sql`](../supabase/lti.check.sql), [`app/src/lib/lti.test.ts`](../app/src/lib/lti.test.ts), [`docs/LTI-1.3-LAUNCH-RUNBOOK.md`](LTI-1.3-LAUNCH-RUNBOOK.md)

### e — Tenant-scoped, reversible OneRoster staging and reconciliation

**security-workstream** · blocked by: security

**Today.** Drift, reconcile, freshness and retry logic exist as library code; the connection control plane, dead-letter and reconciliation tables exist, per tenant. Adapter registries are empty on purpose, so nothing has reconciled against a real OneRoster source.

**Remaining.** A OneRoster adapter that lands into a staging table per tenant, a reconciliation report a person approves, and a revert. This is identity and IAM-adjacent, so it is left to the security workstream to avoid two implementations.

**Evidence.** [`app/src/lib/interop.ts`](../app/src/lib/interop.ts), [`docs/LMS-INTEROPERABILITY-MATRIX.md`](LMS-INTEROPERABILITY-MATRIX.md), [`supabase/migrations/20260927170000_integration_control_plane.sql`](../supabase/migrations/20260927170000_integration_control_plane.sql), [`docs/INTEGRATION-OPERATOR-RUNBOOK.md`](INTEGRATION-OPERATOR-RUNBOOK.md)

### f — Policy engine: human-readable and executable rule, version, explanation, override, audit and rollback

**open-design** · blocked by: owner · coordinate with: #1011, #1018; human overrides and legal holds landed in #1012

**Today.** Deterministic rules exist in code for schedule, credit, degree and entitlement; roll-out state, feature flags and their narrowing are versioned by history rows; the rollout table refuses moves without evidence; overrides are recorded (registration overrides). There is no single versioned rule object with both a plain-language and an executable form, an explanation on every decision, or one-step rollback across rules.

**Remaining.** Open PRs #1011 (Configuration Studio: a school's settings drafted by one person and published by another) and #1018 (Workflow Builder) cover part of this; a shared human-override log landed in #1012. The gap that remains is decided after they land, not before.

**Evidence.** [`supabase/migrations/20260928050000_tenant_rollout.sql`](../supabase/migrations/20260928050000_tenant_rollout.sql), [`supabase/migrations/20260929370000_feature_policy_narrowing.sql`](../supabase/migrations/20260929370000_feature_policy_narrowing.sql), [`docs/SCHOOL-OFFBOARDING.md`](SCHOOL-OFFBOARDING.md)

### g — Migration studio: profiling, dry run, parallel run, cutover, rollback and legacy archive

**covered** · blocked by: owner

**Today.** The Migration Center (D-144) walks source inventory, classification, mapping, preview, sample import, validation, reconciliation, parallel runs, cutover (dated, with a rollback plan and two approval areas), archive and monitoring; a stage needs its evidence, runs are append-only and their pass is computed from counts.

**Remaining.** It has never been used on a real migration. Profiling is by counts recorded from a file the recorder holds, not by Semester reading it.

**Evidence.** [`supabase/migrations/20260929200000_migration_center.sql`](../supabase/migrations/20260929200000_migration_center.sql), [`supabase/migration-center.check.sql`](../supabase/migration-center.check.sql), [`app/src/components/institutional/MigrationCenter.tsx`](../app/src/components/institutional/MigrationCenter.tsx), [`docs/DATA-MIGRATION-PLAN.md`](DATA-MIGRATION-PLAN.md)

### h — SPOF and degraded-mode map, critical-period priorities, restore evidence, incident roles and status communications

**built-here** · blocked by: owner

**Today.** A map of eleven dependencies with what still works, what does not and the evidence for each; critical-period priorities proposed; a logical restore rehearsal filed. Incident roles and communications templates already existed.

**Remaining.** A timed restore of the live project's backup by a second operator (G5), a second trained operator, a backup for the gateway journal, a freeze calendar and on-call names, incident owners.

**Evidence.** [`docs/DEGRADED-MODE-MAP.md`](DEGRADED-MODE-MAP.md), [`docs/evidence/restore/2026-09-30-logical-rehearsal.md`](evidence/restore/2026-09-30-logical-rehearsal.md), [`docs/market-readiness/INCIDENT_RESPONSE.md`](market-readiness/INCIDENT_RESPONSE.md), [`docs/operating-model/INCIDENT-COMMUNICATIONS.md`](operating-model/INCIDENT-COMMUNICATIONS.md)

### i — Governance charter and decision rights, including two-person approval for high-impact policy, data and security exceptions

**built-here** · blocked by: owner

**Today.** Seven two-person rules that hold in the database are tabulated with their tests. This is a description of enforcement, not a charter.

**Remaining.** The charter itself (adopted by the owner, with counsel, naming people) and two-person rules for policy, security and data exceptions, which exist nowhere yet.

**Evidence.** [`docs/DECISION-RIGHTS.md`](DECISION-RIGHTS.md), [`docs/LAUNCH-READINESS-COUNCIL.md`](LAUNCH-READINESS-COUNCIL.md), [`supabase/console-approvals.check.sql`](../supabase/console-approvals.check.sql), [`supabase/school-offboarding.check.sql`](../supabase/school-offboarding.check.sql)

### j — Procurement artifacts: architecture and data flow, privacy/terms/AI policy, DPA and subprocessors, SLA/support/implementation, BCDR and incident summaries, accessibility statement and VPAT status, pen-test plan, insurance and company documents

**partial** · blocked by: counsel

**Today.** A drafted artifact exists for each named item except insurance and company documents. HECVAT is a draft, not sent; the VPAT is a plan; no pen test has been done.

**Remaining.** Counsel on the drafts; a real DPA and subprocessor list confirmed; insurance and company documents (not in the repository); a pen test; a VPAT. Until then none is offered as a completed procurement pack.

**Evidence.** [`docs/market-readiness/PROCUREMENT_CHECKLIST.md`](market-readiness/PROCUREMENT_CHECKLIST.md), [`docs/trust/DPA-CHECKLIST.md`](trust/DPA-CHECKLIST.md), [`docs/SUBPROCESSORS.md`](SUBPROCESSORS.md), [`docs/trust/SLA.md`](trust/SLA.md), [`docs/trust/PENETRATION-TEST-PLAN.md`](trust/PENETRATION-TEST-PLAN.md), [`docs/trust/HECVAT-VPAT-PLAN.md`](trust/HECVAT-VPAT-PLAN.md), [`docs/trust/SECURITY-WHITEPAPER.md`](trust/SECURITY-WHITEPAPER.md), [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](market-readiness/HECVAT_DRAFT_RESPONSE.md), [`docs/legal/PRIVACY-POLICY-DRAFT.md`](legal/PRIVACY-POLICY-DRAFT.md)

### k — Accessibility proof: keyboard, screen reader, focus and errors, 200/400% reflow, mobile and touch targets, accessible authentication

**partial** · blocked by: manual-test

**Today.** Automated axe, focus, dialog, field-error and contrast tests run in CI; a test protocol for a screen-reader pass exists. Accessible authentication is now held by a guard on the sign-in and account forms: the standard autocomplete tokens are present and nothing blocks paste.

**Remaining.** No human assistive-technology pass, no 200% and 400% reflow record, no touch-target audit on a device, no ACR/VPAT. No conformance claim is made.

**Evidence.** [`docs/accessibility/AT-PASS-PROTOCOL.md`](accessibility/AT-PASS-PROTOCOL.md), [`docs/RESPONSIVE-ACCESSIBILITY-TEST-PLAN.md`](RESPONSIVE-ACCESSIBILITY-TEST-PLAN.md), [`docs/WCAG-UI-AUDIT-SCORECARD.md`](WCAG-UI-AUDIT-SCORECARD.md), [`app/src/components/authaccess.test.ts`](../app/src/components/authaccess.test.ts)

### l — Student support, data-correction, accessibility and privacy routes

**partial** · blocked by: owner

**Today.** Self-serve export and erasure, a report route, a human-help route and a support playbook exist. Account-level correction is the student's own edit.

**Remaining.** The data-subject-request queue has no screen and no named answerer; the support address is a personal mailbox; a route for correcting an institution-sourced record is not defined.

**Evidence.** [`docs/market-readiness/HUMAN_HELP.md`](market-readiness/HUMAN_HELP.md), [`docs/market-readiness/SUPPORT_PLAYBOOK.md`](market-readiness/SUPPORT_PLAYBOOK.md), [`docs/DATA-RETENTION-EXPORT-DELETION.md`](DATA-RETENTION-EXPORT-DELETION.md), [`docs/pilot/KNOWN-LIMITATIONS.md`](pilot/KNOWN-LIMITATIONS.md)

### m — Narrow pilot scorecard and evidence, with targets clearly not claims

**built-here** · blocked by: owner

**Today.** A blank evidence log and scorecard with the TARGET / MEASURED rule; the paid-pilot framework and go/no-go checklist already existed.

**Remaining.** The targets and the pilot sponsor are the owner's; counsel decides whether interviews need consent or review first.

**Evidence.** [`docs/pilot/DISCOVERY-EVIDENCE-LOG.md`](pilot/DISCOVERY-EVIDENCE-LOG.md), [`docs/PAID-PILOT-FRAMEWORK.md`](PAID-PILOT-FRAMEWORK.md), [`docs/GO-NO-GO-CHECKLIST.md`](GO-NO-GO-CHECKLIST.md)

### n — AI use-case and provider registry, retrieval authorization, evaluations, prompt-injection and exfiltration tests, human review, no autonomous high-impact decisions

**partial** · blocked by: owner

**Today.** The providers' published terms are on file; a kill switch and a 21-case injection red-team are filed with results (29 Sep 2026); a model-quality set exists; AI only explains or drafts and never decides schedule, credit, degree or entitlement.

**Remaining.** A use-case register (each AI feature, its data, its human review), a retrieval-authorization test (the model cannot be handed another tenant's or student's rows), an exfiltration test beyond canaries, and a filed model-quality run. The shared key must work first.

**Evidence.** [`app/src/lib/trust/provider-terms.ts`](../app/src/lib/trust/provider-terms.ts), [`docs/market-readiness/AI_GOVERNANCE.md`](market-readiness/AI_GOVERNANCE.md), [`docs/evidence/ai`](evidence/ai), [`app/src/ai/modelquality.live.test.ts`](../app/src/ai/modelquality.live.test.ts), [`docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md`](AI-RECOMMENDATION-EVALUATION-HARNESS.md)

### OA1 — Operating artifact: compliance checklist

**covered** · blocked by: owner

**Today.** Row (a). The go/no-go checklist (12 gates), the ten release gates and the compliance crosswalk exist.

**Remaining.** See (a).

**Evidence.** [`docs/RELEASE-GATES.md`](RELEASE-GATES.md), [`docs/GO-NO-GO-CHECKLIST.md`](GO-NO-GO-CHECKLIST.md), [`docs/trust/COMPLIANCE-CROSSWALK.md`](trust/COMPLIANCE-CROSSWALK.md)

### OA2 — Operating artifact: governance charter

**partial** · blocked by: owner

**Today.** As row (i): decision rights are tabulated from what the database enforces; no charter has been adopted.

**Remaining.** Adoption by the owner with counsel; naming people.

**Evidence.** [`docs/DECISION-RIGHTS.md`](DECISION-RIGHTS.md), [`docs/LAUNCH-READINESS-COUNCIL.md`](LAUNCH-READINESS-COUNCIL.md)

### OA3 — Operating artifact: customer-discovery and pilot evidence engine

**built-here** · blocked by: owner

**Today.** As row (m): the evidence-log template exists; it holds no findings.

**Remaining.** Real entries, gathered by the owner.

**Evidence.** [`docs/pilot/DISCOVERY-EVIDENCE-LOG.md`](pilot/DISCOVERY-EVIDENCE-LOG.md)

### OA4 — Operating artifact: incident playbook

**covered** · blocked by: owner

**Today.** Roles, communications by audience, routing and a crisis runbook exist.

**Remaining.** Incident owners are unassigned; nothing has been drilled with a person other than the author.

**Evidence.** [`docs/market-readiness/INCIDENT_RESPONSE.md`](market-readiness/INCIDENT_RESPONSE.md), [`docs/operating-model/INCIDENT-COMMUNICATIONS.md`](operating-model/INCIDENT-COMMUNICATIONS.md), [`docs/vanderbilt/incident-routing.md`](vanderbilt/incident-routing.md), [`docs/CRISIS-RESPONSE-RUNBOOK.md`](CRISIS-RESPONSE-RUNBOOK.md)

### OA5 — Operating artifact: institutional launch go/no-go review

**partial** · blocked by: owner

**Today.** A twelve-gate go/no-go with a computed verdict (NO-GO), a war-room board, and now ten release gates.

**Remaining.** The ten release gates are not yet inputs to the computed go/no-go verdict; whether they should be is a decision for the owner.

**Evidence.** [`docs/GO-NO-GO-CHECKLIST.md`](GO-NO-GO-CHECKLIST.md), [`docs/LAUNCH-WAR-ROOM.md`](LAUNCH-WAR-ROOM.md), [`app/src/lib/launchreadiness.ts`](../app/src/lib/launchreadiness.ts), [`docs/RELEASE-GATES.md`](RELEASE-GATES.md)

### X1 — Financial aid, payroll, general ledger and broad system-of-record replacement

**not-to-build** · blocked by: specialist

**Today.** Interoperability comes before replacement. Nothing is added here. NOTE: main already contains a student-accounts module (ledger, aid, holds, plans, refunds, provider payments; D-146) and dining/campus-card behind flags, off until a finance owner is named. They are built and off, not ready, and no page may say otherwise.

**Remaining.** Specialist controls (finance, aid compliance, audit) and pre-pilot evidence before any of it is switched on for a school or claimed. Real institutional data stays out.

**Evidence.** [`docs/DOMAIN-REPLACEMENT-REGISTER.md`](DOMAIN-REPLACEMENT-REGISTER.md), [`docs/DECISION-LOG.md`](DECISION-LOG.md), [`docs/RELEASE-GATES.md`](RELEASE-GATES.md)

## What this pull request added, and what it left alone

- Added (documents and one guard): `docs/DEGRADED-MODE-MAP.md`, `docs/DECISION-RIGHTS.md`, `docs/pilot/DISCOVERY-EVIDENCE-LOG.md`, this matrix and its test, and `authaccess.test.ts`.
- Left alone on purpose: a purpose-coded FERPA decision (b) until counsel defines the purposes; a canonical identity model (c) until a real pilot school's identifiers exist; a policy engine (f) until #1011 and #1018 land; LTI and OneRoster (d, e) for the security workstream; and everything in X1.
- Coordinate: #1011 and #1018 are open drafts that touch (c) and (f); #1012 (holds, overrides) has landed.
