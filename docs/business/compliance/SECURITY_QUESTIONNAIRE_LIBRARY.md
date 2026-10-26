# Security Questionnaire Library

| Control | Value |
| --- | --- |
| Status | **DRAFT - ANSWER WORDING NOT APPROVED BY ANY NAMED APPROVER - INTERNAL SOURCE FOR RESPONSES** |
| Owner | Harrison Rubin (interim; backup unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: security] [REVIEW: counsel] [REVIEW: privacy] [REVIEW: accessibility] |
| Audience | Internal. Answer text is written so it can be adapted into a customer response only after review; it is not a customer-ready document |

> Operating document, not legal, security, privacy or accessibility advice. The count of approved customer-facing answers here is zero: `PUBLIC-CLAIMS-APPROVAL-REGISTER.md` records no named approver for customer-facing wording.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document rather than an edit |
| --- | --- | --- | --- |
| [docs/HIGHER-ED-RFP-RESPONSE-LIBRARY.md](../../HIGHER-ED-RFP-RESPONSE-LIBRARY.md) (source of truth `app/src/lib/gtm/rfp.ts`, held by `rfp.test.ts`) | Standard answers for RFPs with a status vocabulary, evidence and a certification-language guard | A security-questionnaire view grouped by the user's twelve domains, with "do not answer yes" flags and a cross-reference to the RFP row each answer agrees with | The RFP library is test-held data; this adds domains and flags it does not model. **Where they differ, the RFP library governs** (section 13 lists wording differences) |
| [docs/market-readiness/HECVAT_DRAFT_RESPONSE.md](../../market-readiness/HECVAT_DRAFT_RESPONSE.md) | HECVAT-area draft answers | Flags where its "Yes" rows need re-checking ([HECVAT_ROADMAP.md](HECVAT_ROADMAP.md) section 4) | Test-held draft |
| [docs/trust/SECURITY-QUESTIONNAIRE.md](../../trust/SECURITY-QUESTIONNAIRE.md) and [docs/market-readiness/INFORMATION-SECURITY-QUESTIONNAIRE.md](../../market-readiness/INFORMATION-SECURITY-QUESTIONNAIRE.md) | Response rule (IMPLEMENTED / PARTIAL / PLANNED / NOT APPLICABLE / UNKNOWN) and readiness map | Pre-written answers by domain | Framework, not an answer bank |
| [docs/trust/REVIEWER-QUESTION-MAP.md](../../trust/REVIEWER-QUESTION-MAP.md) | Where each reviewer question is answered | Cross-referenced | Canonical |
| [COMPLIANCE_EVIDENCE_REGISTER.md](COMPLIANCE_EVIDENCE_REGISTER.md) | Per-control status | Each answer names its register row | Single detail home |

## Gate (what may be answered now versus held)

| Item | Status |
| --- | --- |
| Answer a prospect's security questions in design-partner discovery using this wording after Harrison reviews it | NOW (non-activation GO), through the trust-room flow for any document |
| Any answer implying live customer data, tenant activation or a launch commitment | HELD |
| Any answer marked **DO NOT ANSWER YES** below | HELD until the named evidence exists |
| Any price, order form, contract promise or notification clock in a response | HELD (paid-pilot gate NO-GO / RED; counsel) |

## How to use

1. Find the question; copy the **safe answer** unchanged; if the buyer asks more, add the extra part here first (same rule as the RFP library).
2. Never upgrade an answer's status without the evidence in the same change.
3. Attach evidence only by controlled packet. Never paste a secret, key, token-bearing URL or connection string into a response.
4. Statuses use the RFP vocabulary: Available now / Available with tenant configuration / Feature-flagged pilot / Planned / not available / Not supported / Company to supply.
5. **DO NOT ANSWER YES** marks a question whose natural short answer is "Yes" but where a Yes would exceed the evidence. Answer in the safe wording instead.
6. Label legend: [VERIFIED] answer rests on a cited repository path; [DRAFT] wording unapproved (all answers); [REVIEW: x] needs a professional before release.

## 1. Governance

| ID | Question | Safe answer | Evidence | Status | Do not answer yes | Cross-reference |
| --- | --- | --- | --- | --- | --- | --- |
| SQ-G01 | Who is accountable for information security? | The founder, Harrison Rubin, is the accountable owner and holds all seats. No backup owner is named. | `OWNER-AND-ACCOUNTABILITY-MATRIX.md` | Company to supply (confirm per response) | DO NOT ANSWER YES to "dedicated security team", "CISO" or "backup coverage" | HECVAT COMP-02 (Partial) |
| SQ-G02 | Do you have a written information security program? | A controlled draft program exists in the repository. It has not been adopted through an operating review and is not independently assessed. | `docs/trust/INFORMATION-SECURITY-PROGRAM.md` | Planned / not available (as an adopted program) | DO NOT ANSWER YES to "approved/adopted/annually reviewed" | HECVAT DOCU-02 (Partial) |
| SQ-G03 | Is a risk register reviewed on a schedule? | Not yet. Risks are tracked in readiness documents and a risk-treatment plan draft; no adopted appetite or review minutes exist. | `docs/trust/RISK-TREATMENT-PLAN.md` | Planned / not available | DO NOT ANSWER YES | HECVAT GOV-2 (NOT_STARTED) |
| SQ-G04 | Do you hold SOC 2, ISO 27001 or similar? | No. Semester has no independent audit report and does not plan one before a first pilot. A readiness register is available under NDA. | `docs/trust/SOC2-READINESS.md` | Not supported | DO NOT ANSWER YES | RFP SEC-5 |
| SQ-G05 | Do you carry cyber liability insurance? | No policy is held today. | `docs/market-readiness/HECVAT_DRAFT_RESPONSE.md` (COMP-03) | Company to supply | DO NOT ANSWER YES | HECVAT LEGAL-2 |

## 2. Data

| ID | Question | Safe answer | Evidence | Status | Do not answer yes | Cross-reference |
| --- | --- | --- | --- | --- | --- | --- |
| SQ-D01 | Provide a data inventory and retention schedule. | Every database table has a written retention answer in the retention schedule, and a test fails if a table is added without one. This is a repository inventory; a reconciliation against a customer's production scope is done per pilot. | `RETENTION.md`; `app/src/lib/retention.test.ts`; `docs/trust/DATA-INVENTORY.md` | Available now (repository scope) | Do not answer yes to "complete production inventory" or "field-level classification" | RFP PF-2 |
| SQ-D02 | Do you classify data? | A four-level classification vocabulary exists in code (public, internal, student_private, education_record) and drives institution policy decisions. Field-level coverage across all data is not complete. | `packages/institution/src/policy.ts`; `docs/trust/DATA-CLASSIFICATION-STANDARD.md` | Planned / not available (universal classification) | DO NOT ANSWER YES to "all data is classified" | HECVAT-READINESS-MATRIX |
| SQ-D03 | Do you sell data, serve advertising to students or score students for risk? | No to all three. The in-app privacy disclosure is held to the code by a test. | `app/src/lib/privacy.ts`; `app/src/lib/privacy.test.ts` | Available now | - | RFP PF-5 |
| SQ-D04 | Where is data stored? | The production database is Supabase, in the region recorded when read from the project on 2026-09-28; the web app is static files on GitHub Pages; other providers' regions are being confirmed. No residency guarantee is offered. | `docs/trust/VENDOR-RISK-REGISTER.md` | Planned / not available (residency commitment) | DO NOT ANSWER YES to data residency or "US only" | HECVAT DATA-06 |
| SQ-D05 | What happens to our data when the contract ends? | Students can export and delete their own data today. A school offboarding procedure (inventory, two-sided approval, access disable, export, verification, archive) is designed and has been rehearsed on synthetic data only. Return-and-destroy terms and windows are subject to the DPA and counsel. | `docs/SCHOOL-OFFBOARDING.md`; `docs/evidence/offboarding/2026-09-30-hosted-preview-rehearsal.md` | Planned / not available | DO NOT ANSWER YES to any deletion time or "certificate of destruction" [REVIEW: counsel] | HECVAT DATA-07 |
| SQ-D06 | Are backups encrypted and how long are they kept? | Backups are the database provider's. The window recorded in the repository is taken from the provider's plan documentation and has not been read from the dashboard on a date; encryption at rest is provider-managed and not yet evidenced by a filed configuration. | `RETENTION.md` (Backups section) | Planned / not available | DO NOT ANSWER YES to a stated retention period or "encrypted backups" | HECVAT BCDR-01 |
| SQ-D07 | Describe data minimization. | Collection is scoped to enabled workflows; the proposed initial institutional boundary is manual or read-only; rosters, grades and enrollment lists are not requested through identity or LMS flows. | `docs/trust/DATA-MINIMIZATION-STANDARD.md`; `app/src/lib/ltikey.test.ts` | Available with tenant configuration | Do not answer yes to "minimized in production" | RFP INT-4 |

## 3. Identity and access

| ID | Question | Safe answer | Evidence | Status | Do not answer yes | Cross-reference |
| --- | --- | --- | --- | --- | --- | --- |
| SQ-I01 | Do you support SSO? | Not yet available. SAML single sign-on is built and tested in the repository for one identity provider per institution; it is enabled for no institution and untested against a real identity provider. | `supabase/identity-provisioning.check.sql` | Planned / not available | DO NOT ANSWER YES | RFP SEC-1 |
| SQ-I02 | Is MFA enforced for your administrative accounts? | The owner attests MFA is on for the GitHub, Google and Supabase administrative accounts (2026-09-28). Configuration exports are being collected. | `docs/market-readiness/HECVAT_DRAFT_RESPONSE.md` (owner attestation) | Company to supply | DO NOT ANSWER YES until exports are filed (CER-C01); the draft HECVAT row answers Yes | HECVAT AAAI-04; trust row SEC-IAM-002 |
| SQ-I03 | Do users have MFA? | Student accounts do not currently offer MFA. Accounts with a live `platform_admin` or `support_agent` grant must establish AAL2 before privileged capabilities or supporter-window metadata become available; sensitive actions also require fresh MFA. | `supabase/migrations/20261008223000_privileged_role_mfa.sql`; `supabase/migrations/20261009213000_support_access_window_mfa.sql`; `supabase/privileged-mfa.check.sql`; `supabase/support-case-access.check.sql`; `app/src/components/PrivilegedMfaBoundary.test.tsx` | Available now for privileged roles; Planned / not available for students | DO NOT ANSWER YES to universal or student MFA | TC-SEC-10/11 |
| SQ-I04 | How is privileged access controlled? | By named capability over a scope; grants are audited; the database checks the capability on every protected read and write. High-impact console actions need two approvers. | `supabase/capabilities.check.sql`; `supabase/console-approvals.check.sql` | Available now | Do not claim "no standing access" (break-glass flag is not consumed by authorization: TC-SEC-09) | RFP SEC-2 |
| SQ-I05 | Do you perform access reviews and have a joiner/mover/leaver process? | Not yet. A quarterly review of role grants is planned; there are no staff other than the founder. | `docs/trust/IDENTITY-AND-ACCESS-MANAGEMENT-STANDARD.md` | Planned / not available | DO NOT ANSWER YES | HECVAT AAAI-03 |
| SQ-I06 | How is administrative activity logged? | Role, moderation and support-access changes are written to append-only audit tables checked by database suites; audit rows are kept three years per the retention schedule. | `supabase/role-grant-audit.check.sql`; `RETENTION.md` | Available now | Do not claim SIEM, central log review or alerting | HECVAT AAAI-05 |

## 4. Application security

| ID | Question | Safe answer | Evidence | Status | Do not answer yes | Cross-reference |
| --- | --- | --- | --- | --- | --- | --- |
| SQ-A01 | Describe your SDLC. | Every change runs type, lint, unit, shuffled-order and database-policy checks in CI, with secret and dependency scanning. | `.github/workflows/ci.yml`; `.gitleaks.toml` | Available now | - | RFP SEC-3 |
| SQ-A02 | Is every production change reviewed by a second person? | No. It is a one-person company. A branch ruleset requiring review and checks is written but is not applied; every change passes CI before merge. | `.github/rulesets/main.json`; `.github/CODEOWNERS` | Planned / not available | DO NOT ANSWER YES | HECVAT CHNG-01 (No) |
| SQ-A03 | Do you scan dependencies and secrets? | Yes. Dependabot and a dependency audit run, and Gitleaks scans pull requests and the tree. Dated results from 2026-10-02 are on file; the audit step is not yet blocking. | `.github/dependabot.yml`; `docs/evidence/security/2026-10-02-production-dependency-audit.md` | Available now | Do not claim "no vulnerabilities" beyond the dated result | RFP SEC-3 |
| SQ-A04 | Has an independent penetration test been performed? | No. A scoped external test is planned; its summary and remediation plan will be shared under NDA once it exists. | `docs/trust/PENETRATION-TEST-PLAN.md` | Planned / not available | DO NOT ANSWER YES | RFP SEC-4 |
| SQ-A05 | Do you run static and dynamic application security testing? | A static-analysis workflow and a dynamic-scan workflow are defined; neither has a filed result for a frozen release candidate, and the dynamic scan covers a static preview only. | `.github/workflows/codeql.yml`; `.github/workflows/hawkscan.yml` | Planned / not available | DO NOT ANSWER YES | CER-D05, D06 |
| SQ-A06 | Do you have a vulnerability disclosure policy and patch timelines? | A security contact and policy are published (security.txt and SECURITY.md) with four severities and internal remediation targets of 2, 14, 60 and 180 days. The targets are internal, no bug bounty exists and safe-harbour wording is not yet written. | `app/public/.well-known/security.txt`; `SECURITY.md` | Available now (disclosure path); Planned (commitments) | Do not present the day counts as a customer commitment | HECVAT VULN-01 (Partial) |

## 5. Infrastructure and cloud

| ID | Question | Safe answer | Evidence | Status | Do not answer yes | Cross-reference |
| --- | --- | --- | --- | --- | --- | --- |
| SQ-N01 | Describe hosting and architecture. | A static web application on GitHub Pages; account data in Supabase Postgres with row-level security and Edge Functions; an institutional gateway as serverless functions that is not yet deployed. | `docs/ARCHITECTURE.md`; `.github/workflows/pages.yml` | Available now | - | RFP TA-1 |
| SQ-N02 | Is each customer's data isolated from others? | Isolation is enforced and tested with cross-tenant negative checks for the institutional data layer. Extending the same proof to every older table is in progress, so it is not claimed for the whole schema. | `supabase/tenancy.check.sql` | Planned / not available (whole schema) | DO NOT ANSWER YES to "fully multi-tenant isolated" | RFP TA-2 |
| SQ-N03 | Is data encrypted in transit and at rest? | Hosted surfaces are served over HTTPS; the database provider manages at-rest encryption, which is not yet evidenced by a filed provider configuration; gateway action bodies are encrypted before storage. | `app/server/institution/journal-crypto.ts`; `docs/trust/ENCRYPTION-AND-KEY-MANAGEMENT-STANDARD.md` | Planned / not available (at rest); Available now (gateway journal) | DO NOT ANSWER YES to "encrypted at rest" or "TLS 1.2+ enforced" | HECVAT DATA-03/04 |
| SQ-N04 | Do you separate production, staging and development? | Local and per-change preview databases exist; there is no staging tier on the production Postgres version. | `STAGING.md` | Planned / not available | DO NOT ANSWER YES to "staging environment" | HECVAT HOST-02 (No) |
| SQ-N05 | How do you monitor production? | An hourly synthetic check probes the app and database API and a public status page shows the same. No alert is yet proven to reach a named person; there is no 24/7 monitoring. | `.github/workflows/production-smoke.yml`; `MONITORING.md` | Planned / not available (alerting) | DO NOT ANSWER YES to 24/7 or alerting | HECVAT BCDR-03 |
| SQ-N06 | How are secrets managed? | Secrets live in the hosts' managed stores; scanning runs on every change; the browser holds only the publishable key. The rotation log is empty and rotation is not yet on a schedule. | `SECRETS.md` | Planned / not available (rotation) | Do not claim scheduled rotation | CER-D11 |

## 6. Incident response

| ID | Question | Safe answer | Evidence | Status | Do not answer yes | Cross-reference |
| --- | --- | --- | --- | --- | --- | --- |
| SQ-R01 | Do you have an incident response plan? | A controlled draft plan, runbook and message templates exist. One founder-only document tabletop was held on 2026-10-03; no target exercise or live incident has been run. | `docs/trust/INCIDENT-RESPONSE-PLAN.md`; `docs/evidence/operations/2026-10-03-founder-readiness-tabletop.md` | Planned / not available (exercised process) | DO NOT ANSWER YES to "tested/exercised" | HECVAT INCD-01 (Partial) |
| SQ-R02 | How quickly will you notify us of a breach? | The internal target is to notify affected parties promptly after confirmation; no notification deadline has been approved. Contractual notice terms are subject to counsel and the agreement. | `SECURITY.md`; `docs/legal-drafts/SECURITY-INCIDENT-NOTIFICATION-EXHIBIT-DRAFT.md` | Company to supply | DO NOT ANSWER YES to any hour count; the HECVAT draft INCD-02 and the public site state 72 hours and need counsel review first [REVIEW: counsel] | LEGAL-REVIEW-QUEUE L1 |
| SQ-R03 | Do you have 24/7 incident response? | No. One person holds every role with no rota. | `docs/integrated-trust/INCIDENT-RESPONSE.md` | Not supported | DO NOT ANSWER YES | CER-A13 |

## 7. Business continuity and disaster recovery

| ID | Question | Safe answer | Evidence | Status | Do not answer yes | Cross-reference |
| --- | --- | --- | --- | --- | --- | --- |
| SQ-B01 | State your RTO and RPO. | Not stated. A logical restore rehearsal passes in CI and was run on a throwaway database; a timed restore of a real provider backup has not been done, so objectives will be measured rather than chosen. | `docs/evidence/restore/2026-09-30-logical-rehearsal.md` | Planned / not available | DO NOT ANSWER YES / DO NOT STATE NUMBERS | RFP SEC-6 |
| SQ-B02 | Are backups tested? | A scripted restore drill exists and a logical rehearsal is filed; a restore from the provider's backup has never been done. | `supabase/restore-drill.sh`; `RESTORE.md` | Planned / not available | DO NOT ANSWER YES | HECVAT BCDR-02 (No) |
| SQ-B03 | What uptime do you commit to? | None before a first pilot. Production is observed by an hourly synthetic check. | `.github/workflows/production-smoke.yml` | Not supported | DO NOT ANSWER YES | RFP SS-2 |

## 8. Privacy

| ID | Question | Safe answer | Evidence | Status | Do not answer yes | Cross-reference |
| --- | --- | --- | --- | --- | --- | --- |
| SQ-P01 | Will you sign a DPA with FERPA school-official terms? | A DPA draft and checklist exist; counsel has not approved the draft and none is signed. Semester describes its controls and leaves FERPA judgments to the institution's counsel. | `docs/trust/DPA-CHECKLIST.md`; `docs/legal-drafts/DATA-PROCESSING-ADDENDUM-DRAFT.md` | Planned / not available | DO NOT ANSWER YES; do not say "FERPA compliant" [REVIEW: counsel] | RFP PF-1 |
| SQ-P02 | Can students export and delete their data? | Yes, themselves: a portable export and account deletion that empties every table it claims to, proven by a database check. Files held only on the device are outside the server export. | `app/src/lib/export.ts`; `supabase/deletion.check.sql` | Available now | Do not claim a single full-account export including device files | RFP PF-3 |
| SQ-P03 | How do you handle data-subject requests and how fast? | A person can raise an export, correction, restriction or erasure request, which is recorded with a due date column; no operator-side workflow and no agreed response time exist. | `supabase/audit-and-subject-requests.check.sql`; `docs/DATA-RIGHTS-REQUEST-RUNBOOK.md` | Planned / not available | DO NOT ANSWER YES to any response time [REVIEW: counsel] | TR-20 |
| SQ-P04 | How do you handle minors? | Accounts under thirteen are refused and minors are kept out of discovery, matching, mentoring and employer visibility; Community join/post is not gated by minor status in SQL. No COPPA compliance claim. | `supabase/minimum-age.check.sql` | Planned / not available | DO NOT ANSWER YES to COPPA compliance [REVIEW: counsel] | TR-35 |

## 9. AI

| ID | Question | Safe answer | Evidence | Status | Do not answer yes | Cross-reference |
| --- | --- | --- | --- | --- | --- | --- |
| SQ-AI01 | How is generative AI governed? | AI that uses institutional data runs only through a provider the institution has approved, with sources held on the server, a metered budget per tenant and classified data kept from consumer models; it is off until the institution enables it. | `docs/market-readiness/AI_GOVERNANCE.md`; `supabase/intelligence-policy.check.sql` | Available with tenant configuration | Do not claim any provider is approved by any institution | RFP AI-1 |
| SQ-AI02 | Is our data used to train models? | Semester does not use student data to train models. Providers receive requests under their API terms; their current no-training terms are confirmed per provider before enablement; no provider agreement is signed. | `app/src/lib/trust/ai-training-policy.ts`; `docs/trust/PROVIDER-TERMS.md` | Company to supply | DO NOT ANSWER YES to "providers do not train on your data" | HECVAT AIML-02 |
| SQ-AI03 | How are models evaluated for accuracy and bias? | No evaluation results exist yet; an evaluation set from approved course sources is planned. One adversarial prompt-injection run is on file. | `docs/evidence/ai/` | Planned / not available | DO NOT ANSWER YES | RFP AI-2 |
| SQ-AI04 | Can AI be switched off? | A global and per-tenant AI kill switch exists and fails closed; it was drilled once; release after engagement needs a second reviewer who is not yet named. | `app/src/lib/aikillswitch.test.ts`; `docs/trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md` | Available with tenant configuration | Do not claim tested response times | HECVAT AIML-04 stale (see HECVAT_ROADMAP section 4) |

## 10. Accessibility

| ID | Question | Safe answer | Evidence | Status | Do not answer yes | Cross-reference |
| --- | --- | --- | --- | --- | --- | --- |
| SQ-X01 | How is accessibility tested? | Automated audits of critical journeys run in CI in a real browser at desktop and 320-pixel widths alongside component-level focus, label, landmark and motion tests. | `app/scripts/accessibility-smoke.mjs`; `app/src/a11y` | Available now | Do not claim WCAG conformance | RFP AX-1 |
| SQ-X02 | Provide a VPAT / ACR. | None exists; a formal evaluation comes first. Semester targets WCAG 2.2 AA and makes no conformance claim. | `docs/compliance/VPAT-ACR-SELF-ASSESSMENT.md` | Planned / not available | DO NOT ANSWER YES [REVIEW: accessibility] | RFP AX-2 |
| SQ-X03 | Has it been tested with screen readers? | Not by a recorded manual pass; NVDA and VoiceOver passes are planned. | `docs/accessibility/AT-PASS-PROTOCOL.md` | Planned / not available | DO NOT ANSWER YES | RFP AX-3 |

## 11. Subprocessors and vendors

| ID | Question | Safe answer | Evidence | Status | Do not answer yes | Cross-reference |
| --- | --- | --- | --- | --- | --- | --- |
| SQ-V01 | List your subprocessors. | A register of every destination student data can reach exists, labelled subprocessor, institution-directed or student-directed, held to the content-security policy and Edge Functions by test. It is a draft not yet reviewed by counsel or published; provider terms and regions are not yet on file. | `app/src/lib/trust/subprocessors.ts`; [VENDOR_RISK_REGISTER.md](VENDOR_RISK_REGISTER.md) | Planned / not available (published list) | DO NOT ANSWER YES to "approved" or "verified" | RFP PF-4 |
| SQ-V02 | Do you assess your vendors? | A tiered register exists; no vendor has been assessed yet. | `docs/trust/VENDOR-RISK-REGISTER.md` | Planned / not available | DO NOT ANSWER YES | HECVAT THRD-02 (No) |

## 12. Integrations

| ID | Question | Safe answer | Evidence | Status | Do not answer yes | Cross-reference |
| --- | --- | --- | --- | --- | --- | --- |
| SQ-T01 | Do you support LTI 1.3? | Not yet available to an institution. Launch, deep linking and assignment scores are built and tested against a test platform, to be registered per institution; no real LMS has launched it. | `supabase/lti.check.sql`; `supabase/functions/lti/index.ts` | Planned / not available | DO NOT ANSWER YES | RFP INT-1 |
| SQ-T02 | Do you support SCIM? | The SCIM 2.0 service and audited data layer are built and tested; not reachable in production. | `app/server/institution/scim.ts` | Planned / not available | DO NOT ANSWER YES | RFP INT-2 |
| SQ-T03 | Which SIS/LMS/CRM do you integrate with? | None is connected today; the contract and adapters are built against mock providers. | `app/server/institution/adapters.ts` | Planned / not available | DO NOT ANSWER YES to any named system | RFP INT-3 |
| SQ-T04 | Can you import full rosters or grades? | No, by design. | `app/src/lib/ltikey.test.ts` | Not supported | - | RFP INT-4 |

## 13. Wording differences from the RFP library

| Topic | RFP library wording | This library | Reason |
| --- | --- | --- | --- |
| Retention (PF-2) | "Every table has a written retention answer" | Same, plus "repository inventory; production reconciliation per pilot" | Avoids implying production verification |
| Encryption (no RFP row) | n/a | At-rest not evidenced; in-transit "served over HTTPS" only | HECVAT CRYPTO-1 is IN_PROGRESS |
| Breach notification (no RFP row) | n/a | No hour count | SECURITY.md target pending counsel |
| SDLC (SEC-3) | "Available now" | Same; second-person review flagged as No (SQ-A02) | HECVAT CHNG-01 |
| Subprocessors (PF-4) | "Planned / not available" | Same | Agrees |
| Statuses | Test-held vocabulary | Same vocabulary | Agrees |

No wording here is stronger than the RFP library's. If a difference is found, the RFP library wins and this file is edited.

## Evidence state

Answers cite repository paths at `5eba494`. Answers about operation (monitoring, restore, notification, MFA) are explicitly Planned or Company to supply.

## Claim ceiling

Permitted: the safe answers above, once reviewed by Harrison and, where flagged, the named professional. Not permitted: any answer marked DO NOT ANSWER YES in the affirmative.

## Prohibited claims

SOC 2/ISO, FERPA/COPPA/GDPR/HIPAA compliance, HECVAT completion, penetration test, WCAG/VPAT conformance, uptime/RTO/RPO, 24/7 monitoring or support, encryption at rest, student MFA, live SSO/SCIM/LTI, named customers.

## Professional review required

[REVIEW: security] SQ-I02, SQ-N03, SQ-A05; [REVIEW: counsel] SQ-D05, SQ-P01, SQ-P03, SQ-P04, SQ-R02; [REVIEW: privacy] section 8; [REVIEW: accessibility] section 10. None named in the repository.
