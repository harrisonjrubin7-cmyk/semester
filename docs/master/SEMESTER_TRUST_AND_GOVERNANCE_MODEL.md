# Semester trust and governance model

**As of** 2026-10-05 · **Base** origin/main 790ebbf · **Part of** [`SEMESTER_COMPLETE_OPERATING_SYSTEM.md`](SEMESTER_COMPLETE_OPERATING_SYSTEM.md)

> **Claim ceiling.** This model names the controls, where each is enforced, and what is missing. It is not a security, privacy or accessibility attestation. There is **no** SOC 2 report, ISO 27001 certificate, HECVAT, penetration test, accessibility conformance report or executed DPA. Public statements about security, compliance and accessibility are prohibited (CLM-006, CLM-008, CLM-010, CLM-012, CLM-016). The permitted wording is in [`docs/trust/CONTROL-FACTS.md`](../trust/CONTROL-FACTS.md).

The controls below exist in more depth elsewhere. This page is the map from **non-negotiable requirement** to **mechanism** to **gap**, so that a reviewer can see in one place what is real.

## The sixteen non-negotiable controls

Every feature and domain needs each of these. "Enforced by" is what in the repository carries it today.

| # | Control | Enforced by | Honest gap |
| ---: | --- | --- | --- |
| 1 | Source authority | Source states (`lib/source.ts`); platform precedence label | A label, not a rule; not enforced at write time |
| 2 | Tenant isolation | `tenant_id`/`school_id` columns (170 tenant-bearing public tables); RLS on all 354 objects; `private.has_capability` | **FORCE RLS on none; isolation off for every school and covers course rooms only (F-01); no negative suite per object class (R-001)** |
| 3 | Role/capability check | `app_roles`, `app_capabilities`, `role_capabilities`; policy engine | Engines have 0 importers from the app; `decide()` has one non-test caller |
| 4 | Data classification | `data_classification` T0 to T6; `data_classification_rules`; `table-classification.json` | Classes rule-derived, not human-reviewed |
| 5 | Consent | `consent_record`, guardian and family grants, `demand_consents` | Counsel review open (EXT-003) |
| 6 | Accessibility | `app/src/a11y/` (axe), contrast tests | **No qualified human evaluation; no ACR (EXT-008)** |
| 7 | Security threat model | `docs/trust/THREAT-MODEL.md`, `docs/security/` | Few per-feature threat records; no independent assessment |
| 8 | Privacy/retention | Retention sweeps, legal holds, export/erase, minimum age | Schedule not reviewed by counsel |
| 9 | Audit event | `audit_event`; domain audit tables; hash-chained ledgers | Not tamper-evident across all tables (F-10) |
| 10 | Support route | `support_tickets`, support-access grants | One person |
| 11 | Monitoring/SLO | `docs/sre/`, hourly `production-smoke.yml` | **No alert reaches a person (F-08); RTO/RPO unmeasured** |
| 12 | Test coverage | 1,340 test files; 111 SQL check suites; shuffle and time-zone runs | `main` CI red 26 of last 30; no ruleset |
| 13 | Migration/rollback | Factory ([migration factory](SEMESTER_MIGRATION_FACTORY.md)); `ROLLBACK.md` | No production restore; no real migration |
| 14 | Documentation | About 300 pages under `docs/`; card-governed pages | Drift between registers |
| 15 | Owner | 12 council seats | One person; backups unassigned |
| 16 | Review date and release evidence | Card `Reviewed` field; `docs/evidence/` | Evidence is a handful of repo-scoped items |

## The AI controls

The brief requires AI to be policy-bound, course-aware, tenant-aware, permission-aware, source-aware, citation-aware, cost-aware, integrity-aware, human-escalation-capable, audited, evaluated and **never silently authoritative for official institutional decisions**.

| Requirement | Mechanism in the repository | Gap |
| --- | --- | --- |
| Policy-bound | `ai_policy` per tenant; `lib/aiflags`; kill switch `kill.ai_generation` | **BYOK path bypasses the kill switch (F-04)**; policy enforced before invocation on every route is ADR-0005 and Phase 1 step 3, partial |
| Course-aware | `course_ai_rules`; course-agent policy in `packages/institution` | Faculty adoption unproven |
| Tenant-aware | Tenant policy; classification ceiling | |
| Permission-aware | Retrieval uses the caller's scope; classification gate | No server index to test (D07) |
| Source-aware, citation/provenance | `approved_source`, `untrusted.ts` handling, citation requirement | Eval coverage thin |
| Cost-aware | `private.ai_usage_month/reservation`, monthly caps, metering | Unit-cost model is a hypothesis |
| Integrity-aware | `docs/operating-model/AI-GRADING-AND-INTEGRITY.md` | AI never grades; human review queue designed |
| Human escalation | Escalation tables and webhooks; routing in the copilot | Staffing: one person |
| Audited | `private.gateway_audit`, `gateway_intelligence_audit/action` | |
| Evaluated | `docs/AI-RECOMMENDATION-EVALUATION-HARNESS.md`; `injection.live.test.ts`, `modelquality.live.test.ts` | One red-team run, one model (21 of 21 held); live tests need keys |
| Never silently authoritative | `docs/DO-NOT-BUILD.md` rule 7 (no AI output as official information; only school-confirmed facts carry `institution_verified`) | Held by review, not by a test |
| Classification ceiling | Consumer AI refuses T3+; unknown treated as T3 | Not proven end to end in a target tenant |
| Training on customer data | Policy forbids (`docs/trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md`) | Provider terms and retention settings unaccepted (shared key blocked) |
| Incident and kill switch | `docs/trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md`; drill 3 of 3 on 2026-09-29 | One drill, throwaway account |

AI roles: student copilot, tutor and study assistant; faculty authoring, rubric and accessible-content assistants; advisor summariser and routing; registrar policy explainer (never final authority); success trend explainer with human-reviewed outreach; admin policy and configuration assistant; security/privacy classification and usage audit; operator support summarisation. Each role's prompts, tools and data classes are defined in `docs/ai-toolkit/` and `docs/operating-model/AI-INTEGRATION-PLAYBOOK.md`. The deterministic rule engine, never the model, computes official eligibility; the copilot explains the decision, identifies next steps, links the policy and routes exceptions to humans.

## Open security findings

From `docs/security/FINDINGS-REGISTER.md` (read directly: 2 High, 8 Medium, 5 Low) and the audits. IDs and severities are the register's.

| ID | Severity | Finding | Why it matters here |
| --- | --- | --- | --- |
| F-01 | High | Tenant isolation is off for every school and covers course rooms only | Any institutional data entering the system is under-protected |
| F-08 | High | No alerting | An incident has no first responder |
| F-02 | Medium | Tokens and user AI keys in `localStorage` | XSS blast radius |
| F-04 | Medium | BYOK path bypasses the AI kill switch | The control cannot stop a path |
| F-03 | Medium | Sign-out clears no local data; account deletion removes the server copy only | Data remains on shared devices |
| F-05 | Medium | Gateway OpenAI provider lacks the untrusted-text fence the client uses | Prompt-injection path |
| F-06 | Medium | GitHub Pages cannot send security headers | CSP and HSTS posture |
| F-09 | Medium | One person owns everything and approves nothing independently; branch ruleset defined, not active | No independent review |
| F-10 | Medium | Audit tables not tamper-evident | Evidence value |
| F-12 | Medium | Verification gaps: open-read sweep flags only a literal `true`; no RLS sweep for `private` and `storage`; about 18 public tables unclassified in sweeps | Checks may miss exposure |
| F-11 | Low | Support access is platform-scoped: any `support:ticket` holder reads every tenant's reply outbox | Wrong once there are two operators |
| F-13 | Low | `security.txt` under the Pages base path with a personal mailbox contact | Continuity and trust |
| — | — | `anon` holds DML on 32 public tables; 24 carry TRUNCATE; `schools_read` is `using (true)`; reduction written, not applied (`database/proposed/anon_grant_reduction.sql`) | Excess grants |
| — | — | 639 `SECURITY DEFINER` mentions; per-function review not done; 12 private and 24 public gate-less names unreviewed; 25-function delta unreconciled | Privilege escalation surface |
| — | — | Every one of 16 edge functions has `verify_jwt` off and authenticates itself | A new function could forget |

## Governance

| Structure | What exists | Gap |
| --- | --- | --- |
| Decisions | `D-<PR>.md` per decision; 80 decision files; ADR programme (25 Proposed) | None accepted; one person decides |
| Decision rights | `docs/DECISION-RIGHTS.md`, `docs/governance/DECISION_RIGHTS.md` | |
| Launch council | 12 seats, signoffs `[]`; verdict NO-GO | Seven held, none signed; customer-side seats unidentified |
| Claims | `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` (CLM-001..018); machine register 40 claims (0 available); withdrawal runbook | 15 site statements over evidence |
| Risk | `LAUNCH-RISK-REGISTER.md` (16), `docs/program/RISK_REGISTER.md` (36), `docs/company/RISK-REGISTER.md`, `docs/strategy/RISK-REGISTER.md` | Four risk registers; see [risk register](SEMESTER_RISK_REGISTER.md) |
| Change | Branch protection design, infra change records, release gates | No ruleset applied on `main` |
| AI | AI governance board design, lifecycle gates | One person |
| Vendor | `docs/trust/VENDOR-RISK-REGISTER.md`, subprocessors | "No vendor has been risk-assessed"; no DPAs on file |
| Document control | Card system, `docs:stale` | Review dates are by the author |

### Governance principles carried into every build

1. **Student control.** The student owns their content, decides what is shared, and can see and revoke it.
2. **Institutional authority.** Official records, policies and decisions belong to the institution.
3. **Provenance.** Every fact has a source and a freshness.
4. **High-impact actions** need two people and an audit entry.
5. **Least privilege** by role, scope, purpose and time.
6. **Failure recovery.** A degraded source is shown as degraded; nothing fails silent.
7. **Public claims never exceed the lowest of product state, evidence freshness, tenant activation, deployment verification and operating approval.**
8. **Smallest safe solution.**

(From `docs/PLATFORM-CONSTITUTION.md`, which lists twelve parts; these eight are the ones that decide most build choices.)

## Compliance posture, as claimable

| Framework | Claimable today | Not claimable |
| --- | --- | --- |
| FERPA | "Designed for institutional use under school-official terms, with consent and audit controls" (design statement) | Compliant; certified |
| COPPA / K-12 | Minimum age 13; minors off social surfaces until 18; guardian links designed | Compliant |
| GDPR / UK GDPR | Rights tooling (export, erase) exercised on a synthetic account | Compliant; DPA executed |
| HECVAT | A readiness matrix and draft | A completed HECVAT |
| SOC 2 | `IN_PROGRESS` readiness matrix; no auditor engaged | Audited; report |
| ISO 27001 | Nothing | Certified |
| WCAG 2.2 AA | Build target; automated tests | Conformant; VPAT/ACR |
| NIST 800-53 | Readiness matrix | Mapped controls implemented |
| 1EdTech certifications | Nothing | Certified |

## Trust Center content plan

`docs/trust/` and `app/src/lib/trust/` define the sections: security overview, privacy overview, accessibility statement, responsible AI, data practices, subprocessors, availability and status, incident communication, compliance roadmap, HECVAT materials, DPA process, security questionnaire request, trust room, vulnerability reporting, customer document access. The trust room is an edge function and a private bucket. Publication of every section waits on counsel (EXT-002) and on the evidence rows above. Until then a section may state facts from `CONTROL-FACTS.md` only.

## Release certification

A release candidate is certified when it has: a frozen exact SHA; hosted CI green on that SHA (not local); the Master Register rows for the surfaces it touches at `tested` or above with current evidence; no open High finding in the touched area; accessibility evidence for new screens; rollback rehearsed; kill switch present for any new high-risk surface; and a reviewer who is not the author. See [`docs/operating-model/RELEASE-CERTIFICATION.md`](../operating-model/RELEASE-CERTIFICATION.md) and the release strategy in the complete operating system.
