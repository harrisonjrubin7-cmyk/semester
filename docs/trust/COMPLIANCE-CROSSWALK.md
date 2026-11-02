# Compliance crosswalk: HECVAT 4, 1EdTech TrustEd Apps and EDUCAUSE 2026

<!-- Rendered from app/src/lib/trust/compliance-crosswalk.ts by compliance-crosswalk.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

**HECVAT is a questionnaire and the TrustEd Apps rubrics are self-assessments;
neither is a certification, and Semester has completed neither.** This page
is one control library with three views, the way five documents of
28 September 2026 ask for it, and every score on it is computed by the test
from the four registers the repository already keeps. A score cannot be typed
here. The documents are kept under `docs/expansion/` as supplied; none is
cited as evidence of anything.

| Supplied document | What it holds |
| --- | --- |
| [HECVAT vs 1EdTech TrustEd Apps compliance matrix: map overlap and gaps](../expansion/HECVAT-vs-TrustEd-Apps-Compliance-Scorecard.pdf) | The 0–4 scale, the full scorecard by domain, the cloud-infrastructure mapping, the four rubric criteria, the P0/P1/P2 plan and the four dashboard values. |
| [Interactive cross-walk: HECVAT vs 1EdTech TrustEd Apps rubrics](../expansion/HECVAT-vs-TrustEd-Apps-Interactive-Crosswalk.pdf) | The crosswalk table with overlap and primary gap per domain, the procurement-fit matrix, the vendor intake tiers and the AI governance overlay. |
| [HECVAT vs 1EdTech TrustEd Apps: map rubric overlaps and coverage gaps](../expansion/HECVAT-vs-TrustEd-Apps-Rubric-Overlap-and-Intake-Workflow.pdf) | The coverage rule, the intake workflow and decision states, the request object, the vendor-request email and the AI governance rubric. |
| [Semester Campus EdTech Vendor Intake Policy](../expansion/Campus-EdTech-Vendor-Intake-Policy.pdf) | The intake policy a university would apply to Semester: principles, roles, tiers, required evidence, launch gates, reassessment and exceptions. |
| [Build an edtech compliance matrix: HECVAT mapping table, TrustEd evidence checklist, dashboard API](../expansion/Compliance-Matrix-HECVAT-Mapping-and-Dashboard-API.pdf) | The HECVAT mapping table by domain, the TrustEd Apps evidence checklist, the dashboard calculations, the release manifest and the guardrails. |

## The scale, and the ceiling

| Score | Meaning |
| --- | --- |
| 0 | Missing, unknown, unsafe, or contradicted by the implementation |
| 1 | Policy or design exists; implementation or evidence is incomplete |
| 2 | Implemented, but manually operated, partially tested or partially evidenced |
| 3 | Implemented, owned, monitored, tested and audit-evidenced |
| 4 | Independently tested, automated where appropriate, continuously improved and transparently reported |

A 3 needs an artifact somebody produced by operating the control. The master
register keeps those under `docs/evidence/`, which holds the AI drills of 29 September,
so **the ceiling today is 4** for every domain, held by the test to the
directory rather than to this sentence. A domain's score is the lower median of
its rows' levels: the level the middle row reaches, so one tested row cannot
carry a domain and one owed row cannot sink it. Rows read on the scale as:

| Register | Its statuses, on the 0–4 scale |
| --- | --- |
| [`docs/MASTER-LAUNCH-READINESS-REGISTER.md`](../MASTER-LAUNCH-READINESS-REGISTER.md) | not-started → 0, blocked → 0, designed → 1, building → 1, implemented → 2, tested → 2, evidenced → 3, operational → 3, launch-approved → 4 |
| [`docs/market-readiness/HECVAT_READINESS.md`](../market-readiness/HECVAT_READINESS.md) and [`docs/FERPA-COPPA-1EDTECH-READINESS.md`](../FERPA-COPPA-1EDTECH-READINESS.md) | NOT_STARTED → 0, BLOCKED → 0, IN_PROGRESS → 1, TESTING → 2, READY → 2 |
| [`docs/operating-model/OPERATIONAL-MATURITY.md`](../operating-model/OPERATIONAL-MATURITY.md) | owed → 0, partial → 1, in-place → 2 |

`tested` and `READY` are 2, not 3: a test that runs on every change proves the
control is implemented, and says nothing about whether anybody operates it.

## The scorecard

Statuses were read at main commit 7476aca on 28 September 2026. 26 domains:
1 at 0, 22 at 1, 3 at 2, none above the ceiling.

| Domain | Score | Overlap | TrustEd rubric | EDUCAUSE 2026 | Rests on (level) |
| --- | ---: | --- | --- | --- | --- |
| **Governance and accountability** | 1 | High | Security Practices Rubric | Collaborative cybersecurity | GOV-1 (1), GOV-2 (0), PRG-001 (1), SEC-001 (1), LEGAL-2 (0) |
| **Security program** | 1 | High | Security Practices Rubric | Collaborative cybersecurity | GOV-1 (1), SEC-001 (1), SEC-002 (1), SEC-011 (1) |
| **Asset inventory** | 1 | High | Security Practices Rubric | Data foundations and governance | PRG-006 (1), EX-01 (2), DV-06 (0), SEC-010 (1) |
| **Cloud infrastructure** | 1 | High | Security Practices Rubric | Resilient digital services | CRYPTO-1 (1), MON-1 (1), SRE-002 (1), EX-03 (1), EX-04 (1), DR-01 (1) |
| **Identity and access** | 2 | High | Security Practices Rubric | Collaborative cybersecurity | IAM-1 (2), IAM-2 (2), IAM-3 (0), IAM-003 (1), IAM-004 (2), IAM-005 (2), IAM-006 (2), IAM-010 (2), IAM-011 (1) |
| **Secure development** | 1 | High | Security Practices Rubric | Collaborative cybersecurity | SDLC-1 (2), SDLC-2 (2), SEC-002 (1), SEC-003 (1), SRE-008 (1) |
| **Encryption and secrets** | 1 | High | Security Practices Rubric | Student trust and data agency | CRYPTO-1 (1), SDLC-2 (2), IAM-009 (2), DR-04 (0) |
| **Multi-tenant separation** | 2 | High | Security Practices Rubric | Connected technology ecosystem | TEN-1 (1), IAM-007 (2), IAM-008 (2), UOS-009 (2), FERPA-8 (1) |
| **Monitoring and logging** | 1 | Medium-high | Security Practices Rubric | Collaborative cybersecurity | LOG-1 (2), MON-1 (1), SEC-006 (1), FERPA-4 (2), SRE-003 (1) |
| **Vulnerability management** | 1 | High | Security Practices Rubric | Collaborative cybersecurity | VULN-1 (1), VULN-2 (0), SEC-004 (1), SEC-005 (1) |
| **Incident response** | 1 | High | Security Practices Rubric | Resilient digital services | IR-1 (1), SEC-007 (1), AI-014 (1), FERPA-10 (1) |
| **Business continuity** | 1 | Medium | Security Practices Rubric | Resilient digital services | BCP-1 (0), SRE-004 (1), SRE-005 (1), SRE-006 (1), EX-05 (1) |
| **Data inventory and classification** | 1 | High | Data Privacy Rubric | Data foundations and governance | PRIV-1 (2), SEC-008 (1), TRUST-003 (1), RM-01 (1) |
| **Data ownership and control** | 2 | High | Data Privacy Rubric | Student trust and data agency | PRIV-2 (2), PRIV-3 (2), PRIV-6 (2), FERPA-5 (2), FERPA-6 (2), UOS-007 (2), STU-011 (2) |
| **Retention, deletion and legal hold** | 1 | High | Data Privacy Rubric | Data foundations and governance | PRIV-1 (2), PRIV-2 (2), FERPA-7 (1), LEG-004 (1), RM-01 (1), RM-02 (1), RM-04 (1), RM-05 (1) |
| **Data sharing and subprocessors** | 1 | High | Data Privacy Rubric | Collaborative cybersecurity | PRIV-5 (1), FERPA-11 (2), SEC-010 (1), DR-05 (1), EX-10 (0) |
| **FERPA and education records** | 1 | Medium-high | Data Privacy Rubric | Student trust and data agency | PRIV-4 (0), FERPA-1 (0), FERPA-2 (1), FERPA-3 (2), FERPA-9 (2), SEC-009 (1) |
| **Accessibility** | 1 | High | Accessibility Rubric | Equitable digital access | A11Y-1 (2), A11Y-2 (0), A11Y-3 (0), A11Y-4 (0), A11Y-001 (2), A11Y-002 (2), A11Y-003 (2), A11Y-004 (2), A11Y-005 (2), A11Y-006 (1), A11Y-007 (1), IT-01 (1) |
| **Interoperability** | 1 | Medium | Interoperability standards and certification | Connected technology ecosystem | INT-1 (1), EDT-1 (2), EDT-2 (2), EDT-3 (2), EDT-4 (2), EDT-5 (0), EDT-6 (0), INT-002 (2), INT-004 (2), INT-005 (1), INT-006 (0), INT-007 (1), INT-014 (1) |
| **Community and social safety** | 1 | Medium-high | Data Privacy Rubric | Connected campus experience | TS-1 (1), UOS-003 (1), COPPA-2 (2) |
| **AI disclosure and transparency** | 1 | High | Generative AI Data Rubric | AI literacy and responsible adoption | AI-1 (2), AI-002 (1), AI-005 (1), AI-008 (1), AI-013 (1), TRUST-001 (2), TRUST-004 (1) |
| **AI data use and training** | 1 | High | Generative AI Data Rubric | AI literacy and responsible adoption | AI-1 (2), FERPA-9 (2), AI-002 (1), AI-004 (1), AI-006 (1) |
| **AI quality, safety and misuse** | 1 | Medium | Generative AI Data Rubric | AI literacy and responsible adoption | AI-2 (0), AI-3 (0), AI-009 (2), AI-010 (2), AI-011 (1), AI-012 (3), AI-014 (1) |
| **Assessment and grade integrity** | 1 | Medium | Generative AI Data Rubric | Student trust and data agency | LMS-006 (1), LMS-011 (1), LMS-012 (1), LMS-013 (1), AI-009 (2), INT-005 (1) |
| **Physical and workforce security** | 0 | High | Security Practices Rubric | Collaborative cybersecurity | DV-01 (0), DV-02 (0), DV-03 (0), DV-04 (0), DV-05 (0), DV-07 (0) |
| **Customer assurance** | 1 | Medium-high | Security Practices Rubric | Collaborative cybersecurity | SEC-011 (1), SEC-012 (1), SEC-013 (1), COM-003 (1), PRG-002 (2), EDT-7 (0), LEGAL-1 (0) |

## The crosswalk

What each instrument asks of the domain, where the two overlap, the coverage
gap to manage between them, and the objective and evidence the domain is held to.

| Domain | HECVAT 4 | 1EdTech TrustEd Apps | Gap to manage | Semester objective | Evidence required |
| --- | --- | --- | --- | --- | --- |
| **Governance and accountability** | Organization, policy governance, risk management, workforce controls, insurance, audit process | Public company and policy information; responsible supplier practice | HECVAT requires more formal operational evidence: minutes, a RACI, an exception record. | Named executives, a RACI, risk appetite, policy review and exception approval. | Governance charter, RACI, policy register, risk register, review minutes. |
| **Security program** | Security management, awareness training, risk assessment, audits | Security procedures, processes and baseline technical practices | TrustEd is a baseline rubric and not a substitute for technical assurance; HECVAT asks for implementation detail. | A security program with tested controls and workforce accountability. | Training records, control register, control-testing schedule, assessment reports. |
| **Asset inventory** | Product and infrastructure assets and their ownership | System-management practices | Neither instrument accepts a list; the inventory needs an owner per item and a review log. | Inventory cloud accounts, services, repositories, data stores, integrations and endpoints. | Asset inventory, owner list, review log. |
| **Cloud infrastructure** | Hosting, network, compute, storage, configuration, operations, monitoring | Systems management and third-party hosting disclosure | HECVAT probes architecture and operations more deeply than a hosting disclosure. | A segmented, encrypted, monitored and hardened environment, with the provider’s share of it named. | Architecture diagram, infrastructure as code, configuration evidence, monitoring reports. |
| **Identity and access** | Authentication, MFA, authorization, privileged access, access reviews, offboarding | Authentication and account-management practices | Operating evidence, not statements: a quarterly access review that was actually run. | SSO, MFA for privileged roles, least privilege, access review, offboarding, break-glass control. | IAM architecture, MFA policy, RBAC matrix, quarterly access review, break-glass log. |
| **Secure development** | SDLC, secure coding, testing, change and release control, vulnerability handling | Software development and maintenance practices | HECVAT asks for deeper testing and remediation evidence: SAST/DAST output, threat models, release approvals. | Threat modelling, CI security gates, code review, dependency and secrets scanning, rollback. | PR and CI evidence, scan results, threat models, release approvals. |
| **Encryption and secrets** | Encryption in transit and at rest, key management, credential protection | Protection of data in transit and at rest | Key lifecycle and implementation proof, not a statement that encryption is on. | TLS everywhere, encrypted storage and backups, managed keys, rotation, a secret vault, no secret in code. | TLS settings, KMS design, key-rotation record, secret-vault policy. |
| **Multi-tenant separation** | Data segregation, authorization, infrastructure isolation | Hosting and data-separation practices; responsible data handling | Must demonstrate technical enforcement and test results, not an architecture claim. | No cross-institution, cross-course or cross-role data access. | Tenant-isolation test suite, row-level authorization policy, penetration-test scope and results. |
| **Monitoring and logging** | Security logging, alerting, monitoring, investigation support | Security monitoring and process disclosure | Define what is logged, who can read it, how long it is kept, and show an alert being tested. | Central audit and security logging with retention, alerting and investigation. | Log architecture, sample investigation, alert test, retention configuration. |
| **Vulnerability management** | Scanning, patching, remediation SLAs, penetration testing | Security assessment and maintenance process | Evidence of a severity SLA and of remediation actually happening. | Severity SLAs, scanning, patching, an independent test, tracked exceptions. | Scan reports, patch dashboard, penetration-test summary, exception register. |
| **Incident response** | Incident plan, notification timelines, exercises, post-incident actions | Security incident procedures | HECVAT asks for response-time commitments and exercise evidence. | Detect, contain, investigate, notify, learn and improve — exercised, not only written. | IR runbook, tabletop evidence, post-mortem tracker, status templates. |
| **Business continuity** | Backup, disaster recovery, availability, RTO/RPO | General operational reliability | TrustEd does not replace a detailed recovery review; a restore has to have been performed and timed. | Tested RTO/RPO, restore capability, provider-outage and key-person contingency. | Restore-test results, DR plan, RTO/RPO record, vendor-outage playbook. |
| **Data inventory and classification** | Classification, processing, data flows, privacy governance | Data collected, collection method, purpose, ownership | Link every field and integration to an operational purpose and a retention answer. | A data map with an owner, purpose, classification, storage, sharing and retention per class. | Data inventory, data-flow diagrams, field-classification registry. |
| **Data ownership and control** | Privacy, contractual use, access, data rights | Learner and customer ownership, collection and use; no sale of student data | Clarify the contract roles and show the technical user controls working. | The student owns their data: export, deletion, share and revoke, each logged. | DPA, privacy policy, export/delete/share-revoke workflows and their tests. |
| **Retention, deletion and legal hold** | Record lifecycle, disposal, backup handling, legal obligations | Retention and deletion rights; clear policy per data class | Operational deletion across caches, indexes and backups, and what a hold does to it. | A schedule by data class, a deletion workflow, backup expiry, a legal hold that overrides deletion. | Retention schedule, deletion test, legal-hold runbook, backup-expiry evidence. |
| **Data sharing and subprocessors** | Vendor risk, third parties, transfers, contractual controls | Hosting and sharing disclosure; policy transparency | Onward-transfer, residency and exit evidence, not only a list. | A public subprocessor list, due diligence, DPAs, ongoing review, an exit plan. | Subprocessor list, vendor assessments, agreements, offboarding plan. |
| **FERPA and education records** | Privacy, legal and contractual safeguards | Education-data ownership and transparency | The school-official, consent and exception analysis is institution-specific and needs counsel. | A signed agreement with school-official terms, purpose-limited use, minimum-necessary flows, consent with a record. | FERPA workflow, consent ledger, disclosure log, access matrix, DPA. |
| **Accessibility** | IT accessibility, conformance, alternatives | Documentation, procurement communication, conformance, alternatives and accommodations | Test every role and workflow, not only the public site; an ACR from a human evaluation. | A WCAG 2.2 AA programme: ACR/VPAT, manual testing, remediation tracking, accessible authoring. | Current ACR/VPAT, manual test evidence, issue tracker, release-gate evidence. |
| **Interoperability** | API and integration security, data transfer | LTI, OneRoster, QTI, CLR/Open Badges; certification and conformance | HECVAT does not prove education-standard conformance; only 1EdTech’s own suite does. | Standards-first integrations, versioned APIs, data maps, a sandbox, documented offboarding. | LTI/OneRoster/QTI test logs, API documentation, sandbox, integration data maps. |
| **Community and social safety** | Privacy, user-generated content, incident handling | Social-interaction transparency and data practices | Moderation, harassment, escalation, appeal and retention controls, with a case audit. | Moderation, reports, block and mute, escalation, appeal, limited staff access. | Community policy, moderation runbooks, training, case-audit evidence. |
| **AI disclosure and transparency** | AI governance, data, vendor and change controls (HECVAT 4 AI section) | AI-use notice, purpose, source, internal versus third-party provider | The interface must match the policy: what the screen says AI does has to be what the model does. | Source, scope and status labels on every generated output; a model and provider notice; a report route. | AI policy, product screenshots, model and provider inventory. |
| **AI data use and training** | AI data flow, vendors, privacy and security controls | Training, retention and ownership transparency; user choice | Technically enforce the no-training default and show deletion propagating to provider-held data. | No general-model training on production student data by default; tenant-scoped retrieval; provider terms reviewed. | Provider terms, gateway configuration, AI data-flow diagram, deletion tests. |
| **AI quality, safety and misuse** | AI risk governance, security, evaluation, operations | Broad transparency and data-practice expectations | Add NIST AI RMF and AI 800-1 evaluations, red teaming, a kill switch and an AI incident route. | Grounding, hallucination, fairness, prompt-injection and accessibility evaluations; no consequential action without review; a kill switch that everything reads. | Risk register, evaluation reports, red-team evidence, AI incident runbook. |
| **Assessment and grade integrity** | Product integrity, data accuracy, audit, availability | Responsible learner-data and AI disclosure | Educational validity, human judgment, rubric provenance and an appeal path are outside both instruments. | Versioned rubrics, a grade ledger, human approval, reconciliation, appeal. | Calculation tests, grade audit sample, change and appeal logs. |
| **Physical and workforce security** | Endpoint, device, facility and HR controls | Company security practice | A one-person company still needs the device policy written down and the device managed. | Managed, encrypted, lockable devices; secure disposal; onboarding and offboarding. | Device-management reports, asset inventory, HR and offboarding evidence. |
| **Customer assurance** | Questionnaire completion, contracts, evidence sharing | Public transparency; the Trusted Apps directory and certification path | Keep evidence fresh and customer-specific; never present a questionnaire as a certification. | A secure procurement room, evidence freshness, a customer trust view. | HECVAT answer library, Trust Center, evidence-vault index, customer trust dashboard. |

## Three views, four values

The documents’ rule: a dashboard shows four values and never one “compliance
percentage”. Implementation is rows at 2 or above; evidence is rows at 3 or
above; effectiveness is rows an automated test runs on every change; risk is
master rows at P0 not yet tested. Per register, over every row this page names:

| View | Rows | Implementation | Evidence | Effectiveness | Risk (open P0) |
| --- | ---: | ---: | ---: | ---: | ---: |
| [`docs/market-readiness/HECVAT_READINESS.md`](../market-readiness/HECVAT_READINESS.md) | 33 | 11 of 33 | 0 of 33 | 11 of 33 | 0 |
| [`docs/FERPA-COPPA-1EDTECH-READINESS.md`](../FERPA-COPPA-1EDTECH-READINESS.md) | 21 | 12 of 21 | 0 of 21 | 10 of 21 | 0 |
| [`docs/MASTER-LAUNCH-READINESS-REGISTER.md`](../MASTER-LAUNCH-READINESS-REGISTER.md) | 80 | 25 of 80 | 1 of 80 | 25 of 80 | 51 |
| [`docs/operating-model/OPERATIONAL-MATURITY.md`](../operating-model/OPERATIONAL-MATURITY.md) | 28 | 2 of 28 | 0 of 28 | 3 of 28 | 0 |
| **All** | 162 | 50 of 162 | 1 of 162 | 49 of 162 | 51 |

## The TrustEd Apps rubrics, item by item

**Carried** when a row it rests on is at 2; **partly** when the best row is at
1; **not carried** otherwise. The exact rubric version is confirmed with
1EdTech before any submission; this is the internal read.

### Data Privacy Rubric

15 items: 10 carried, 5 partly, 0 not carried.

| Section | Item | Rests on (level) | Standing |
| --- | --- | --- | --- |
| Data collected | Every category, source, purpose and collection method is inventoried. | PRIV-1 (2), SEC-008 (1) | carried |
| Data collected | Data minimization is implemented and evidenced. | FERPA-3 (2), PRIV-6 (2), EDT-4 (2) | carried |
| Data collected | Sensitive and education-record classes have enhanced controls. | FERPA-9 (2), UOS-007 (2) | carried |
| Ownership and control | Student and customer ownership and control language is clear. | LEG-003 (1), LEG-002 (1) | partly |
| Ownership and control | Sharing is purpose-bound, role-bound, logged and revocable. | FERPA-5 (2), PRIV-6 (2), UOS-007 (2) | carried |
| Ownership and control | No sale of student data and no undisclosed secondary use. | FERPA-2 (1), COPPA-2 (2) | carried |
| Deletion and retention | Retention rules are specific by data class. | PRIV-1 (2), RM-01 (1) | carried |
| Deletion and retention | Deletion, export and correction work in the product. | PRIV-2 (2), FERPA-6 (2) | carried |
| Deletion and retention | Backup lifecycle and legal-hold override are documented. | RM-02 (1), RM-04 (1), SRE-004 (1) | partly |
| Policy transparency | Public privacy policy and terms are current, plain-language, versioned and operationally accurate. | LEG-003 (1), PRIV-3 (2) | carried |
| Policy transparency | Cookies, analytics, advertising and third parties are disclosed. | COPPA-2 (2), PRIV-5 (1) | carried |
| Policy transparency | A privacy contact and an escalation process are published. | VULN-1 (1) | partly |
| Social interactions | Community, club and mentorship data use is disclosed. | TS-1 (1), UOS-003 (1) | partly |
| Social interactions | Visibility, messaging, reporting, moderation and retention rules are clear. | TS-1 (1) | partly |
| Social interactions | No undisclosed social-graph analysis or sensitive inference. | FERPA-2 (1), UOS-008 (2) | carried |

### Security Practices Rubric

4 items: 2 carried, 2 partly, 0 not carried.

| Section | Item | Rests on (level) | Standing |
| --- | --- | --- | --- |
| Documentation and company information | Security contact, policy set, risk ownership, incident process and external-assessment posture exist. | GOV-1 (1), GOV-2 (0), VULN-1 (1), IR-1 (1) | partly |
| Data | Encryption, access control, separation, backup, retention, secure deletion and sensitive-data handling are documented and tested. | CRYPTO-1 (1), IAM-2 (2), TEN-1 (1), BCP-1 (0), PRIV-2 (2) | carried |
| Systems management | Secure SDLC, patching, vulnerability management, monitoring, logging, authentication, authorization, incident response and continuity operate. | SDLC-1 (2), SDLC-2 (2), VULN-1 (1), MON-1 (1), LOG-1 (2), IAM-1 (2), IR-1 (1), BCP-1 (0) | carried |
| Third-party assessment | Cloud and subprocessor inventory, due diligence, contractual controls, attestation review, change notification and an exit plan are maintained. | PRIV-5 (1), SEC-010 (1), EX-10 (0) | partly |

### Accessibility Rubric

9 items: 3 carried, 4 partly, 2 not carried.

| Section | Item | Rests on (level) | Standing |
| --- | --- | --- | --- |
| Information and documentation | Public and customer documentation is accessible. | IT-04 (1), IT-05 (1) | partly |
| Information and documentation | An accessibility statement and contacts are published. | A11Y-4 (0) | not carried |
| Procurement communications | ACR/VPAT materials are current, evidence-based and disclose limitations. | A11Y-2 (0), A11Y-007 (1) | partly |
| Procurement communications | Accessibility claims are accurate and versioned. | PRG-002 (2), LW-03 (2) | carried |
| Conformance | A WCAG 2.2 AA target and test scope are documented. | A11Y-1 (2), A11Y-001 (2), A11Y-002 (2), A11Y-003 (2), A11Y-004 (2) | carried |
| Conformance | Student, faculty, admin and operations-console journeys are tested. | A11Y-3 (0), A11Y-006 (1), IT-01 (1), IT-07 (0) | partly |
| Alternatives and accommodations | Core workflows have accessible alternatives. | A11Y-005 (2), GA-01 (0) | carried |
| Alternatives and accommodations | Accommodation-related settings are privacy-preserving. | AP-01 (0), LMS-009 (1) | partly |
| Alternatives and accommodations | Accessibility defects have support, remediation and communication paths. | A11Y-4 (0) | not carried |

### Generative AI Data Rubric

11 items: 8 carried, 3 partly, 0 not carried.

| Section | Item | Rests on (level) | Standing |
| --- | --- | --- | --- |
| Disclosure | Users can tell when AI is used, what it does, and its limitations. | AI-008 (1), AI-013 (1), TRUST-004 (1) | partly |
| Disclosure | Source, and provider or internal-versus-third-party status, are disclosed. | AI-005 (1), AI-002 (1), TRUST-001 (2) | carried |
| Data use | Training, retention, sharing and ownership rules are clear. | AI-1 (2), FERPA-9 (2) | carried |
| Data use | No general-purpose model training on production student or customer data by default. | AI-1 (2), PRIV-3 (2) | carried |
| Data use | A provider and model inventory and data-flow controls exist. | AI-002 (1), AI-004 (1) | partly |
| User choice | Course and tenant-level policy controls exist. | AI-006 (1), AI-1 (2) | carried |
| User choice | Eligible AI history, sharing and deletion controls are available. | AI-013 (1), PRIV-2 (2) | carried |
| User choice | Opt-in and opt-out expectations are clear where applicable. | AI-013 (1) | partly |
| Quality and risk | Bias, accuracy, accessibility, grounding, prompt-injection and misuse tests exist. | AI-2 (0), AI-010 (2), AI-011 (1) | carried |
| Quality and risk | Human review is required for high-impact outputs and actions. | AI-009 (2) | carried |
| Quality and risk | Report, correction, escalation and incident-response mechanisms exist. | AI-3 (0), AI-014 (1), AI-012 (3) | carried |

## The AI governance overlay

An internal overlay across HECVAT’s AI section, the Generative AI Data Rubric
and Semester’s own controls. The NIST AI RMF matrix behind it is
[`docs/operating-model/AI-ASSURANCE.md`](../operating-model/AI-ASSURANCE.md).

| AI domain | HECVAT-oriented control | TrustEd-oriented control | Semester requirement | Rests on (level) | Standing |
| --- | --- | --- | --- | --- | --- |
| **Inventory** | Identify AI features, models, vendors, data, access, integrations | Disclose whether AI is used and its purpose | A model and system inventory by tenant, feature, provider, version and risk tier | AI-002 (1), AI-001 (1) | partly |
| **Transparency** | Document AI functionality, limitations and customer impact | Inform users when AI is used | Source, scope and status labels; an AI label; limitations; an issue-report control | TRUST-001 (2), TRUST-004 (1), AI-008 (1) | carried |
| **Data sources** | Classify inputs, outputs, retrieval and provider flow | Identify data sources and internal versus third-party AI | Tenant-scoped retrieval, source anchors, no cross-tenant retrieval | AI-004 (1), AI-005 (1), AI-1 (2) | carried |
| **Training and secondary use** | Govern provider training, retention and data sharing | Explain whether and how data is used with AI; user options | No general-model training on production data by default | AI-1 (2), FERPA-9 (2) | carried |
| **User choice** | Configure policy, consent and data sharing | Opt-in, opt-out and preference options where applicable | Tenant, course and user controls; no forced AI use for core access | AI-006 (1), AI-013 (1) | partly |
| **High-impact use** | Prohibit or limit automated decisions; require oversight | Transparency and responsible data handling | No AI-only admissions, aid, discipline, accommodation, grading or risk decisions | AI-009 (2), AI-007 (1) | carried |
| **Quality and validity** | Test and monitor performance, bias, reliability | Data validity and bias considerations | Grounding, hallucination, fairness, accessibility and evaluation thresholds | AI-2 (0), AI-011 (1) | partly |
| **Security and misuse** | Threat-model prompt injection, tool abuse, exfiltration, provider changes | Disclose provider and data behaviour | Input and output safeguards, least-privilege tools, a kill switch, red-team tests | AI-010 (2), AI-012 (3) | carried |
| **Human escalation** | Incident response, support, appeals, change control | User transparency and options | Human review, correction, appeal, feature disablement | AI-3 (0), AI-014 (1), AI-012 (3) | carried |
| **Retention and deletion** | Define the prompt, output and log lifecycle | Disclose data handling | Separate retention for prompts, outputs, retrieval caches and evaluation samples | PRIV-1 (2), AI-013 (1) | carried |
| **Accessibility** | Test AI output and AI controls for accessibility | Transparent, equitable access | Accessible AI interface, generated-content checks, an alternative non-AI workflow | GA-01 (0), GA-02 (0), GA-03 (0), A11Y-006 (1) | partly |
| **Change management** | Reassess model, provider, prompt and tool changes | Update disclosures when practice changes | An approval and retest workflow and a customer change notice | AI-001 (1), AI-011 (1) | partly |

## Semester, through a university’s own intake

The intake policy among the sources is written for a campus to apply to any
vendor. Applied to Semester:

| Tier | Trigger | Review |
| --- | --- | --- |
| **low** | No institutional personal data, no account, no integration, no AI, no consequential workflow. | Privacy, legal and accessibility baseline. |
| **moderate** | Limited directory data, SSO, a low-risk learning or service use. | Data flow, privacy, security, accessibility and contract review. |
| **high** | Education records, LTI/SIS/SCIM, AI, assessments, community, student-generated content, or a broad user population. | HECVAT, TrustEd evidence, ACR/VPAT, integration review, DPA, AI review. |
| **critical** | Payments, proctoring, minors, health or basic-needs intake, agentic writes, high-stakes data or export. | Full HECVAT, DPIA/PIA, threat model, legal and executive approval, strict launch gates. |

**Semester is a `critical`-tier vendor.** A tier is the highest trigger present, and these are present:

- **Grades and grade passback** (critical). Synced grades are high-stakes education records, and LTI Assignment and Grade Services write scores into the institution’s own gradebook. Semester grades nothing itself: the gradebook is designed only, and no AI may assign a grade. (INT-005 (1), EDT-3 (2), LMS-011 (1), AI-009 (2))
- **Education-record data** (high). A student’s synced courses, grades and plan are education records once an institution is the source. (FERPA-1 (0), STU-011 (2))
- **SSO, SCIM and LTI** (high). SAML sign-in with provisioning, SCIM lifecycle and an LTI 1.3 launch exist. (IAM-1 (2), IAM-004 (2), INT-002 (2))
- **AI** (high). Two AI runtimes: the metered edge function and the institution gateway. (AI-1 (2), AI-003 (1))
- **Community and student-generated content** (high). Clubs, groups and a moderated report queue. (TS-1 (1), UOS-003 (1))

The other critical triggers are absent, for reasons that are each a row and are re-read when the row changes:

- **Payments.** Billing stays out (D-009); the bill screen reads a statement and holds no card data. (COM-001 (1))
- **Proctoring.** No proctoring or surveillance, held mechanically by the boundaries register. (TRUST-003 (1))
- **Basic-needs intake.** The navigator is a directory that routes to an office; nothing is taken in, and nobody is notified. (STU-012 (2))
- **Minors.** The service is not directed at children: the minimum age is 13, refused at sign-up by the database (D-139), and a minor aged 13 to 17 is kept out of every feature where others can find or message them. Dual enrollment is identified by the institution, not guessed. (COPPA-1 (2), COPPA-3 (1))
- **Agentic writes.** No consequential write without exact review and confirmation; the two-phase journal never retries an uncertain action. (AI-009 (2))

### The evidence package a critical-tier vendor owes

4 have, 9 drafted,
7 none, of 20. Nothing a third party produces is
marked *have*, by test. The last four are what the critical tier adds to the
high tier’s package: an impact assessment, a threat model, legal review and
executive risk acceptance with periodic re-review.

| Artifact | Key | Standing | Where | Note |
| --- | --- | --- | --- | --- |
| Current privacy policy and terms of service | `privacy_policy_and_terms` | Draft | [`docs/legal/PRIVACY-POLICY-DRAFT.md`](../legal/PRIVACY-POLICY-DRAFT.md) | Drafts for counsel; neither is in force. The in-app disclosure is live and held by test. |
| Accessibility statement | `accessibility_statement` | None | — | Owed (A11Y-4); the public site’s accessibility evidence table is not a statement. |
| Data categories and data-use description | `data_use_description` | Have | [`RETENTION.md`](../../RETENTION.md) | Every table has a retention answer; the disclosure is kept true by test. |
| Subprocessor and third-party disclosure | `subprocessor_list` | Draft | [`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md) | Held to the CSP and the Edge Functions by test; public once counsel has read it. |
| Security contact and incident contact | `security_contact` | Have | [`app/public/.well-known/security.txt`](../../app/public/.well-known/security.txt) | A security.txt in RFC 9116 form under the app’s base path, linked from the site’s /security/ page, with SECURITY.md as its policy (D-114). The address is the owner’s: the security seat is vacant, so the incident contact is the same person. |
| Retention and deletion approach | `retention_and_deletion` | Have | [`RETENTION.md`](../../RETENTION.md) | Per table and per device store; a legal-hold override does not exist. |
| Current HECVAT 4 workbook | `hecvat_4_current_workbook` | Draft | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](../market-readiness/HECVAT_DRAFT_RESPONSE.md) | A first draft for owner review, held to the readiness register; not the workbook and not complete. |
| 1EdTech TrustEd Apps self-assessment materials | `trust_ed_apps_self_assessment` | None | — | The four rubrics are read against the registers on this page; no self-assessment has been submitted (EDT-7). |
| Current ACR/VPAT with known limitations | `accessibility_acr_vpat` | None | — | Needs a formal evaluation by a person; the automated scorecard is not one (A11Y-2). |
| Architecture and data-flow diagram | `data_flow_diagram` | Have | [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) | The current system and the target, with the data flows; hosting regions and key location are named as gaps. |
| DPA and standard contract terms | `dpa` | Draft | [`docs/trust/DPA-CHECKLIST.md`](DPA-CHECKLIST.md) | Clause requirements and starting language for counsel; nothing signed (PRIV-4). |
| Incident-response and business-continuity summary | `incident_response_overview` | Draft | [`docs/market-readiness/INCIDENT_RESPONSE.md`](../market-readiness/INCIDENT_RESPONSE.md) | Written and never exercised; no restore has been performed and no RTO/RPO stated (IR-1, BCP-1). |
| Integration and API documentation with data scopes | `integration_documentation` | Draft | [`docs/INTEGRATION-PERMISSION-MATRIX.md`](../INTEGRATION-PERMISSION-MATRIX.md) | Scopes and the LTI runbook exist; the adapter registry is empty by design. |
| Data-export and offboarding guide | `export_and_offboarding` | Draft | [`docs/DATA-PORTABILITY-AND-OFFBOARDING.md`](../DATA-PORTABILITY-AND-OFFBOARDING.md) | The student export exists and is tested; the institutional offboarding path is written, not built (FERPA-7). |
| Independent security assessment or penetration-test summary | `security_assessment_or_penetration_test_summary` | None | — | The plan exists; no test has been performed (VULN-2). |
| AI feature inventory, providers, data flow, training terms, user notice, decision boundaries, evaluation and incident process | `ai_data_use_and_provider_disclosure` | Draft | [`docs/operating-model/AI-ASSURANCE.md`](../operating-model/AI-ASSURANCE.md) | The audit matrix and the no-training policy draft; provider terms are recorded as published in docs/trust/PROVIDER-TERMS.md and none is signed, and no evaluation has run (AI-2). |
| Data protection or privacy impact assessment (DPIA/PIA) | `dpia_or_pia` | None | — | Owed by the critical tier; the module privacy model is the material one would be written from, not the assessment. |
| Threat model | `threat_model` | Draft | [`docs/INTEGRATION-THREAT-MODEL.md`](../INTEGRATION-THREAT-MODEL.md) | The integration threat model is written; the platform threat model is designed only (SEC-002). |
| Legal review | `legal_review` | None | — | No counsel has reviewed any document; the trust index lists what blocks a signature. |
| Executive risk acceptance and periodic re-review | `executive_risk_acceptance` | None | — | The risk register’s exception record is empty and the founder seat, which accepts risk, is vacant. |

### The launch gates

What a high- or critical-tier service must have before it goes live, each
resting on rows and scored the same way as a domain.

| Gate | Rests on (level) | Score |
| --- | --- | ---: |
| A named business owner and technical owner exist. | PRG-001 (1), SUP-003 (1) | 1 |
| Privacy, security, accessibility, AI, legal and integration reviews are approved. | SEC-011 (1), A11Y-007 (1), AI-001 (1), LEG-002 (1), INT-001 (1) | 1 |
| Contract and DPA requirements are complete. | PRIV-4 (0), LEG-002 (1) | 0 |
| The data map and retention configuration are approved. | PRIV-1 (2), RM-01 (1) | 1 |
| SSO and integration scope are tested in a sandbox. | IAM-1 (2), INT-001 (1), INT-002 (2) | 2 |
| Least-privilege roles and privileged-access controls are configured. | IAM-2 (2), IAM-011 (1) | 1 |
| Accessibility acceptance criteria and known limitations are documented. | A11Y-1 (2), A11Y-2 (0) | 0 |
| AI policy, provider and evaluation controls are approved. | AI-1 (2), AI-2 (0), AI-006 (1) | 1 |
| Support, incident escalation and student communications are ready. | SUP-1 (1), IR-1 (1), SUP-001 (2) | 1 |
| Export, offboarding and credential-revocation procedures are documented. | FERPA-7 (1), LEG-004 (1) | 1 |
| Open findings are accepted, remediated or formally risk-accepted. | GOV-2 (0) | 0 |

### Decision states, and the rule

| Outcome | Meaning |
| --- | --- |
| **Approved** | Evidence and controls meet the applicable risk requirements. |
| **Approved with conditions** | A defined remediation, configuration restriction, contract clause or launch gate is required. |
| **Pilot only** | Limited duration and scope; synthetic or de-identified data where feasible; no production integration unless explicitly approved. |
| **Deferred** | Business purpose, ownership, evidence or data scope is not sufficiently defined. |
| **Not approved** | Risk, control gap, contractual position or unsupported workflow is unacceptable. |

> A vendor is never marked approved merely because it provided a completed questionnaire. Approval is an institution-specific conclusion about evidence, residual risk, contractual terms, configuration and the proposed use.

Reassessment is owed:

- At renewal.
- At least annually for high- and critical-risk services.
- After a material product, AI model or provider, data-use, hosting or subprocessor change.
- After a material security, privacy, accessibility or safety incident.
- Before expanding data scope, users, integrations or external actions.

The quarterly proofs that would carry it are on [`docs/PROOF-CALENDAR.md`](../PROOF-CALENDAR.md).

### Which instrument fits which situation

| Situation | HECVAT Full | HECVAT Lite | 1EdTech TrustEd Apps | Recommended decision |
| --- | --- | --- | --- | --- |
| Public informational tool; no login or personal data | Usually unnecessary | Possible if local policy requires | Public privacy and accessibility review | Lightweight review and an accessibility check |
| Departmental instructional tool with SSO and limited student data | May be excessive initially | Appropriate starting point | Request the self-assessments if available | Moderate review plus data-flow and DPA review |
| LMS, assessment, student-success, advising, community or AI tool | Usually appropriate | Only if the institution’s risk process allows | Strongly recommended: privacy, accessibility, AI and interoperability evidence | High-risk review with HECVAT, TrustEd materials, ACR/VPAT and an integration test |
| SIS, gradebook, payment, proctoring, health or basic-needs intake, or broad production export | Required or strongly expected | Insufficient alone | Useful complement, not sufficient | Full HECVAT, technical security review, DPIA/PIA, legal review, executive approval |
| Vendor claiming 1EdTech certification | Still useful for security and procurement depth | May supplement initial triage | Verify the exact certification and its scope | Never treat a certification as a substitute for HECVAT |
| AI-enabled tool with education-record data | Appropriate, by data and use risk | Only for a constrained low-risk pilot | Request the Generative AI Data Rubric materials | Add an AI impact assessment, provider review, model evaluation and contractual AI controls |

## What would move the scores

- **docs/evidence/.** The AI drills of 29 September lifted the ceiling to 4; a row reaches 3 by citing an artifact filed there, and the proof calendar names the next twelve.
- **A domain at 0** has its middle row at *not started* or *owed*: physical and workforce security.
- **A domain at 1** has a middle row *in progress* or *designed*: the rows
  above name which, and the register that owns the row names what moves it.
- **The evidence package.** Four artifacts only a third party can produce (an
  ACR, a penetration test, a signed DPA, a TrustEd review) and two the company
  writes in an afternoon (a security contact, an accessibility statement).

This page names rows and never changes them. To move a score, move the row in
the register that owns it, with the evidence the register demands.
