# HECVAT Roadmap (Lite first, then Full)

| Control | Value |
| --- | --- |
| Status | **DRAFT - INTERNAL ROADMAP - NO HECVAT HAS BEEN COMPLETED, SUBMITTED, REVIEWED OR APPROVED** |
| Owner | Harrison Rubin (interim; security and privacy seats interim; backup unassigned) |
| Evidence date | 2026-10-05 at repository revision `5eba494` |
| Labels used | [VERIFIED] [ASSUMPTION] [DRAFT] [INTERNAL] [REVIEW: security] [REVIEW: counsel] [REVIEW: privacy] [REVIEW: accessibility] [REVIEW: procurement] |
| Audience | Internal |

> Operating document, not security, legal, privacy or accessibility advice. HECVAT is an EDUCAUSE assessment questionnaire, not a certification. **No HECVAT completion, submission, buyer acceptance or approval exists for Semester.** [VERIFIED] `docs/trust/HECVAT-READINESS-MATRIX.md` status `PARTIAL / NOT A COMPLETED HECVAT`; `docs/market-readiness/HECVAT_READINESS.md` status `IN_PROGRESS`.

## Relationship to existing artifacts

| Existing artifact | What it already covers | What this document adds | Why a new document rather than an edit |
| --- | --- | --- | --- |
| [docs/market-readiness/HECVAT_READINESS.md](../../market-readiness/HECVAT_READINESS.md) | The test-held register of HECVAT-area controls (ids such as GOV-1, VULN-2, A11Y-2) with status READY / TESTING / IN_PROGRESS / NOT_STARTED / BLOCKED and "what moves it" | Phasing, effort, dependencies and the answer-now / HELD split per area | The register is held by `app/src/lib/hecvat-readiness.test.ts`; schedules do not belong in it |
| [docs/market-readiness/HECVAT_DRAFT_RESPONSE.md](../../market-readiness/HECVAT_DRAFT_RESPONSE.md) | First-draft answers (Yes / Partial / No / Company to supply), test-held | Review of those answers against the claim ceiling: where a draft "Yes" needs re-checking before use (section 4) | It is a draft owned by the register test |
| [docs/trust/HECVAT-READINESS-MATRIX.md](../../trust/HECVAT-READINESS-MATRIX.md) | Six domain-level statuses (all PARTIAL), the response-record fields, claim ceiling | Used as the domain spine below | Canonical trust doc |
| [docs/market-readiness/HECVAT-EVIDENCE-MATRIX.md](../../market-readiness/HECVAT-EVIDENCE-MATRIX.md) | 17 domains with source of truth, test/proof, current state, review cadence; 1EdTech TrustEd targets; evidence record fields | Referenced for evidence needed per section | Canonical |
| [docs/trust/HECVAT-VPAT-PLAN.md](../../trust/HECVAT-VPAT-PLAN.md) | A 90-day workstream plan and VPAT workstream | Aligned phases; this adds dependencies and the "may answer now" boundary | Plan is generic (no owners/dates) |
| [docs/market-readiness/PROCUREMENT-QUESTIONNAIRE-PROCESS.md](../../market-readiness/PROCUREMENT-QUESTIONNAIRE-PROCESS.md) and [docs/trust/SECURITY-QUESTIONNAIRE.md](../../trust/SECURITY-QUESTIONNAIRE.md) | The response process and response rule (IMPLEMENTED / PARTIAL / PLANNED / NOT APPLICABLE / UNKNOWN) | Cross-linked | Canonical |
| [SECURITY_QUESTIONNAIRE_LIBRARY.md](SECURITY_QUESTIONNAIRE_LIBRARY.md) and [COMPLIANCE_EVIDENCE_REGISTER.md](COMPLIANCE_EVIDENCE_REGISTER.md) | Answers and per-control rows | Roadmap references both | Same folder |

## Gate (what may be answered now versus held)

| Item | Status |
| --- | --- |
| Discuss HECVAT readiness honestly with a design-partner prospect; share the readiness register after NDA via the trust-room flow | NOW (non-activation GO) |
| Answer a buyer's workbook "No / Partial / Planned" with a plan, scoped to the exact version and date | NOW, after Harrison reviews each row; no answer is sent without that review |
| Answer "Yes" to any item whose register row is not `READY`, or whose proof is an attestation, a plan or a draft | HELD (section 4 lists the known cases) |
| State or imply HECVAT completion, approval, "HECVAT compliant" or any score | PROHIBITED (CLM-010) |
| Submit a workbook alongside a price quote, order form or payment request | HELD with the paid-pilot gate (NO-GO / RED) |

## 1. Scope and version handling

- HECVAT is answered **per buyer, per workbook edition and version, per scope and date**. Do not hardcode question numbers as universal: register guardrail in [docs/trust/EVIDENCE-REGISTER.md](../../trust/EVIDENCE-REGISTER.md). The repository's `HECVAT 4` references are the repository's own working basis. [ASSUMPTION] A buyer will send either a Lite or a Full workbook; confirm the edition and version from the file the buyer sends before any work.
- Ids in this document (GOV-1, IAM-3, ...) are the repository register ids, not EDUCAUSE question ids. The HECVAT draft response says the same of its own ids.
- Use the response-record fields from the readiness matrix for every answer: HECVAT version/question id, exact question, scoped answer/status, code/config evidence, operational/customer evidence, owner, last verified, target configuration, gap/remediation/date, exception, confidential attachment, reviewer/approver, release date.

## 2. Phases

Durations are [ASSUMPTION] estimates for one founder working part time; they start when the named trigger occurs and are not promises.

| Phase | Name | Trigger | Work | Exit criterion | Owner | Effort [ASSUMPTION] |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | Housekeeping | Now | Reconcile contradictions (TR-04); name backup owner (TR-12); decide severity scale (TR-06); update stale rows (section 4) | Registers agree; open decisions recorded | Harrison Rubin | 3-5 person-days |
| 1 | Lite readiness | After phase 0 | Re-read each register row against its cited file; fill "Company to supply" rows (entity facts, contact address); file owner attestations as exports where possible (MFA proof) | A reviewed internal Lite answer set; every Yes rests on a `READY` row with a cited file | Harrison Rubin | 5-8 person-days |
| 2 | Lite for a named buyer | A buyer sends a workbook | Map answers to the buyer's question ids; scope to the buyer's use; counsel and security spot-check [REVIEW: counsel] [REVIEW: security]; share via trust room | Workbook returned with each answer carrying evidence, status and date; no completion or approval wording | Harrison Rubin + reviewers (unassigned) | 3-5 person-days per workbook |
| 3 | Evidence close-out | Independent items scheduled | Independent security assessment (TR-16); authenticated DAST (CER-D06); restore of a real provider backup (TR-10); tabletop with a second person (TR-30); alert route (TR-07); access review (CER-C08); vendor reviews (CER-B12); DPA with counsel (TR-22); qualified accessibility review (TR-25) | Each artifact filed under `docs/evidence/` and its register row raised in the same commit | Harrison Rubin + external parties | Calendar-bound by third parties; internal effort 15-25 person-days spread over months |
| 4 | Full HECVAT | Phase 3 mostly closed, or a buyer insists on Full earlier | Complete Full workbook from the register and the evidence matrix; internal security/privacy/legal review; remediate critical gaps found | Full answer set where No/Partial remain visible with plans; no claim beyond evidence | Harrison Rubin + reviewers | 15-25 person-days |
| 5 | Maintain | After first submission | Quarterly re-read of the register vs code; annual refresh per buyer | Evidence freshness checked; changes logged | Harrison Rubin | 1-2 person-days per quarter |

Dependencies on independent assessment are marked in section 3 with **IA**.

## 3. Evidence needed per section (spine: HECVAT-READINESS-MATRIX domains)

Statuses are quoted from `docs/market-readiness/HECVAT_READINESS.md` at revision `5eba494`. "Answer now" is the scoped wording a reviewed answer may use; "HELD" is what may not be answered affirmatively. The Lite/Full column notes where the Full workbook is expected to ask for more [ASSUMPTION: confirm per workbook].

| Domain / HECVAT area | Register rows (status) | Answer now (scoped, reviewed) | HELD | Evidence needed to move | Owner | Effort [ASSUMPTION] | IA | Lite / Full |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Company and governance | GOV-1 (IN_PROGRESS), GOV-2 (NOT_STARTED), LEGAL-2 (NOT_STARTED) | Single-member LLC owned by the founder (owner attestation, 2026-09-28); security owner named, no backup; no insurance held | "Policies reviewed annually"; "risk register reviewed on a schedule"; insurance coverage | Adopted program, first risk review minutes, insurance certificate | Harrison Rubin | 3 person-days + broker | No | Both |
| Documentation / assurance | LEGAL-1 (NOT_STARTED) | "No SOC 2 or ISO report; none planned before a first pilot; readiness register available under NDA" | Any independent-audit statement | n/a before broad sale (TR-47) | Harrison Rubin | n/a | Yes (outside scope now) | Both |
| Application and SDLC | SDLC-1 (READY), SDLC-2 (READY), WEB-1 (READY) | CI gates, secret and dependency scanning, CSP verified by test | Second-person review of every change (ruleset not applied; CODEOWNERS single owner); "static analysis in place" | Applied ruleset with second reviewer (TR-46); CodeQL result filed (CER-D05) | Harrison Rubin | 2 person-days | No | Both |
| Vulnerability management | VULN-1 (IN_PROGRESS), VULN-2 (NOT_STARTED) | Published contact; four severities with internal remediation targets (2/14/60/180 days); no bounty; no safe-harbour wording | Any "tested by independent party" statement; "SLA met" | First dispositions inside targets; independent test report and remediation | Harrison Rubin + assessor | Assessor-dependent | **IA** | Both |
| Identity and access | IAM-1 (TESTING), IAM-2 (READY), IAM-3 (NOT_STARTED) | Capability-based least privilege with audited grants; SAML/SCIM built, enabled for no institution | MFA enforced on admin/provider accounts; access reviews; live SSO | Console MFA exports; first access review; live IdP exchange recorded | Harrison Rubin | 2-3 person-days + institution | No (live IdP needs a customer) | Both |
| Tenant isolation | TEN-1 (IN_PROGRESS) | Cross-tenant negative tests for the institutional data layer; RLS on every table (CONTROL-FACTS.md, as generated at revision 5eba494) | "Every institution's data is isolated" for the whole schema (RFP TA-2 not claimed) | Legacy-table scoping (TR-18); named-tenant two-account UAT | Harrison Rubin | 5-10 person-days | **IA** (assessor tests isolation) | Both |
| Encryption and keys | CRYPTO-1 (IN_PROGRESS) | HTTPS for hosted surfaces as observed; gateway action bodies encrypted before storage | "Encrypted at rest" as a statement of fact; key-management statements | Provider encryption statement/config filed; key inventory and rotation log | Harrison Rubin | 1-2 person-days | No | Both |
| Logging and monitoring | LOG-1 (READY), MON-1 (IN_PROGRESS) | Immutable audit of role, moderation, support access; hourly synthetic check | Alerting to a person; retained availability history; 24/7 monitoring | Alert route test (TR-07); retained history (TR-19/TR-27) | Harrison Rubin | 3 person-days | No | Both |
| Incident response | IR-1 (IN_PROGRESS), AI-3 (NOT_STARTED; see section 4) | Written plan and templates; one founder document tabletop (2026-10-03) | "Exercised"; response times; customer notification clock | Target tabletop with second person; counsel decision on notice | Harrison Rubin + counsel | 2-3 person-days | No | Both |
| Continuity and recovery | BCP-1 (NOT_STARTED) | Daily provider backups per plan-tier documentation (not read from the dashboard); logical restore rehearsal in CI | Any RTO/RPO; "backups tested"; contractual uptime | Timed provider-backup restore (TR-10) | Harrison Rubin | 3-5 person-days | No | Both |
| Data, privacy, retention | PRIV-1/2/3/6 (READY), PRIV-4 (NOT_STARTED), PRIV-5 (IN_PROGRESS) | Retention answer for every table (test-held); student export and account deletion; no sale, advertising or risk scoring; subprocessor register exists | Signed DPA; "FERPA compliant"; published subprocessor list; data residency guarantee | Counsel-approved DPA; provider terms and regions; rights-request exercise (TR-08, TR-20) | Harrison Rubin + counsel | Counsel-dependent | No | Both |
| Third-party / vendor | PRIV-5 (IN_PROGRESS) | Register of 19 parties with kind (as generated in CONTROL-FACTS.md at revision 5eba494: 6 subprocessors) | "Vendors assessed" | Vendor reviews filed under `docs/evidence/vendors/` | Harrison Rubin | 4-6 person-days | No | Full more detail |
| Accessibility | A11Y-1 (READY), A11Y-2/3/4 (NOT_STARTED) | Automated journey audits in CI (desktop and 320px); WCAG 2.2 AA is a target, not a conformance claim | VPAT/ACR; manual screen-reader pass; barrier-report SLA; "accessible" | Qualified evaluation (TR-25); public barrier route; ACR | Harrison Rubin + evaluator | Evaluator-dependent | **IA** | Both |
| AI | AI-1 (TESTING), AI-2 (NOT_STARTED), AI-3 (NOT_STARTED) | AI for institutional data only through an institution-approved provider, metered, off until enabled; no training on student data by Semester | Evaluation/bias results; provider approval for any institution; "no data used by providers for training" without current terms checked | Evaluation set and run; provider terms signed; provider approval per tenant | Harrison Rubin | 5-8 person-days | No | Full |
| Integrations | INT-1 (IN_PROGRESS) | Gateway contract and adapters built against mock providers; LTI built and tested against a test platform | Any named SIS/LMS/CRM integration; LTI in production | One certified adapter against a real system with a customer | Harrison Rubin + customer | Customer-dependent | No | Full |
| Support and operations | SUP-1 (IN_PROGRESS), TS-1 (IN_PROGRESS) | Support tiers written; consented, logged staff access | Response times; staffed desk; 24/7 | Staffed hours and routing (blocker 6) | Harrison Rubin | 3 person-days | No | Both |
| Personnel | none in register (HECVAT-EVIDENCE-MATRIX: `open`) | One-person company | Background checks, training, acknowledgements | Training record (CER-A09) | Harrison Rubin | 1 person-day | No | Full |

## 4. Known cases where a draft "Yes" must not be reused as written [DRAFT]

These are rows in `docs/market-readiness/HECVAT_DRAFT_RESPONSE.md` whose "Yes" rests on something other than a `READY` register row or on wording stronger than the evidence ceiling. The draft is test-held; this review does not edit it. Fix at the source in a reviewed change [REVIEW: security].

| Draft row | Draft answer | Concern | Safer scoped wording |
| --- | --- | --- | --- |
| AAAI-04 MFA on staff/admin accounts | Yes (owner attestation 2026-09-28) | Attestation only; no configuration export; trust register row SEC-IAM-002 is `owed` | "The owner attests MFA is enabled on the administrative accounts; configuration exports are being collected." Status Partial |
| DATA-03 Encryption in transit | Yes ("All traffic is HTTPS") | Security headers are specified for hosts that do not serve production (TC-SEC-14); no TLS configuration filed | "Hosted surfaces are served over HTTPS; configuration evidence is being collected." Status Partial |
| INCD-02 Notification after exposure | Yes (affected accounts emailed within 72 hours) | SECURITY.md labels 72 hours a target pending counsel, not a commitment; no notice deadline approved; LEGAL-REVIEW-QUEUE L1 | "Semester's incident plan sets an internal target of notifying affected accounts; contractual notice terms are subject to counsel review." Status Partial [REVIEW: counsel] |
| AIML-04 AI-specific incident response | No ("Not yet written") | `docs/trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md` exists (controlled draft, limited drill evidence); register row AI-3 still NOT_STARTED | "A controlled draft AI incident and kill-switch runbook exists; one limited drill is filed." Status Partial after the register row is updated |
| HOST-01 / DATA-06 | Partial / Yes | Region read from the project on 2026-09-28; other vendors' regions "to confirm" | Name Supabase region only as read; others "being confirmed" |
| APPL-03 CSP Yes | Yes | Honest as written (host cannot set headers); keep the caveat | Keep verbatim |

## 5. What must exist before any answer is released

1. Exact workbook edition, version, institution, scope and evidence date recorded.
2. Each "Yes" cites a `READY` register row and an existing path; each other answer is Partial / No / Planned with the plan.
3. A named reviewer for each [REVIEW: x] flag, or the answer says "not yet reviewed".
4. Harrison's written release of the response; counsel for privacy/contract rows.
5. Delivery through the trust room, not email attachment (see [TRUST_CENTER_INVENTORY.md](TRUST_CENTER_INVENTORY.md)).

## Evidence state

Register statuses are quoted at revision `5eba494`. No workbook has been filled from this roadmap. Effort figures are [ASSUMPTION].

## Claim ceiling

Permitted: "Semester has an evidence-linked HECVAT readiness register and controlled response process." (the wording in HECVAT-READINESS-MATRIX.md). Nothing about completion, score, approval or buyer acceptance.

## Prohibited claims

HECVAT certified, compliant, complete, approved or scored; "all controls ready"; independent assurance; SOC 2; penetration test; WCAG/VPAT conformance; uptime/RTO/RPO.

## Professional review required

Independent security assessor [REVIEW: security]; counsel [REVIEW: counsel] for DPA, notice and privacy rows; accessibility evaluator [REVIEW: accessibility]; procurement reviewer [REVIEW: procurement] for workbook mapping. None named in the repository.
