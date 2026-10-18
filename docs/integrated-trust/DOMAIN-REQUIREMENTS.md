# Domain requirements

<!-- Rendered from app/src/lib/ops/trustdomains.ts by trustcontrols.test.ts. Edit the data, then run `npm run registers` from app/. -->

> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../../SEMESTER-OPERATING-SYSTEM.md).

What each of the thirteen product domains must have before it carries real students — a threat model, a privacy review, an accessibility review, a reliability objective, a support route and an incident playbook — and what it has now.

Across the 78 cells: 11 held, 16 partial, 33 drafted in this package and 18 absent.

**Standings.** *Held*: a document or register in the tree covers this domain and says so; the file exists. *Partial*: something covers part of it, or the platform in general. *Drafted*: written in this package and not yet reviewed by the seat that owns it; a draft is not a review, and the cell does not become held until that seat signs and a file records it. *Absent*: nothing.

## Matrix

| Domain | Reviewer | Threat model | Privacy review | Accessibility review | Reliability objective | Support route | Incident playbook |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Identity and tenancy | security | partial | partial | partial | held | drafted | drafted |
| Academic core and records | data | partial | partial | absent | held | drafted | drafted |
| Learning and assessment | product | absent | absent | drafted | held | drafted | drafted |
| Productivity and documents | engineering | drafted | partial | partial | held | drafted | drafted |
| AI assistant, tutor and advisor | trust | partial | held | partial | held | drafted | drafted |
| Campus life and community | trust | drafted | held | absent | absent | drafted | drafted |
| Family and guardian | privacy | drafted | held | absent | absent | drafted | drafted |
| Finance and payments | finance | partial | held | absent | absent | drafted | drafted |
| Career and alumni | product | drafted | absent | absent | absent | drafted | drafted |
| Marketplace and partners | trust | drafted | partial | absent | absent | drafted | drafted |
| Institution console and support | security | partial | partial | absent | absent | drafted | drafted |
| Trust, safety and support | trust | drafted | held | absent | held | partial | drafted |
| Mobile and offline | engineering | drafted | partial | absent | partial | drafted | drafted |

## Domain by domain

### Identity and tenancy

Reviewing seat: **security**. Playbooks: IR-01, IR-02, IR-14. Objectives: sign_in.

| Requirement | Standing | Backed by | What is missing |
| --- | --- | --- | --- |
| Threat model | partial | [docs/SECURITY-THREAT-MODEL.md](../SECURITY-THREAT-MODEL.md) | Spoofing rows only; no model of sessions, recovery or multi-factor. |
| Privacy review | partial | [docs/security/ferpa-risk-and-permission-matrix.md](../security/ferpa-risk-and-permission-matrix.md) | No assessment of the sign-in record or device list. |
| Accessibility review | partial | [app/src/a11y/axe.test.tsx](../../app/src/a11y/axe.test.tsx) | The sign-in screen is in the first-run case; no manual pass. |
| Reliability objective | held | sign_in | — |
| Support route | drafted | [docs/integrated-trust/SUPPORT-ROUTES.md](SUPPORT-ROUTES.md) | Recovery has no owner or hours. |
| Incident playbook | drafted | IR-02 | — |

### Academic core and records

Reviewing seat: **data**. Playbooks: IR-01, IR-03, IR-12. Objectives: advisor_agenda_save.

| Requirement | Standing | Backed by | What is missing |
| --- | --- | --- | --- |
| Threat model | partial | [docs/INTEGRATION-THREAT-MODEL.md](../INTEGRATION-THREAT-MODEL.md) | Integration rows T14, T18 and T19 only; no model of the record workflow itself. |
| Privacy review | partial | [docs/trust/FERPA-CONSENT-WORKFLOW.md](../trust/FERPA-CONSENT-WORKFLOW.md) | Academic-record-ledger is the one assessed surface. |
| Accessibility review | absent | — | Registration, Degree and Grades appear in the journey smoke; no manual pass; tables and editors are unaudited. |
| Reliability objective | held | advisor_agenda_save | No objective for registration, grade display or record export. |
| Support route | drafted | [docs/integrated-trust/SUPPORT-ROUTES.md](SUPPORT-ROUTES.md) | — |
| Incident playbook | drafted | IR-03 | — |

### Learning and assessment

Reviewing seat: **product**. Playbooks: IR-04, IR-05, IR-11. Objectives: assignment_draft_save.

| Requirement | Standing | Backed by | What is missing |
| --- | --- | --- | --- |
| Threat model | absent | — | No model for submissions, gradebook or assessment; most of the learning domain is building. |
| Privacy review | absent | — | No assessment of submissions or feedback. |
| Accessibility review | drafted | [docs/integrated-trust/ACCESSIBILITY-PROGRAM.md](ACCESSIBILITY-PROGRAM.md) | Rich-text editors, media and charts are unaudited. |
| Reliability objective | held | assignment_draft_save | Submission receipt durability has no objective of its own. |
| Support route | drafted | [docs/integrated-trust/SUPPORT-ROUTES.md](SUPPORT-ROUTES.md) | — |
| Incident playbook | drafted | IR-11 | — |

### Productivity and documents

Reviewing seat: **engineering**. Playbooks: IR-06, IR-07, IR-15. Objectives: today_load, plan_save, search.

| Requirement | Standing | Backed by | What is missing |
| --- | --- | --- | --- |
| Threat model | drafted | [docs/integrated-trust/THREAT-MODELS.md](THREAT-MODELS.md) | Uploads and shared documents had no model; drafted here. |
| Privacy review | partial | [app/src/lib/governance/pia.test.ts](../../app/src/lib/governance/pia.test.ts) | Notes and documents are not an assessed surface. |
| Accessibility review | partial | [app/src/a11y/axe.test.tsx](../../app/src/a11y/axe.test.tsx) | Write, Sheet and Deck are outside the axe cases. |
| Reliability objective | held | plan_save | — |
| Support route | drafted | [docs/integrated-trust/SUPPORT-ROUTES.md](SUPPORT-ROUTES.md) | — |
| Incident playbook | drafted | IR-07 | — |

### AI assistant, tutor and advisor

Reviewing seat: **trust**. Playbooks: IR-04. Objectives: ask_semester.

| Requirement | Standing | Backed by | What is missing |
| --- | --- | --- | --- |
| Threat model | partial | [docs/ai-toolkit/AI-TOOLKIT-THREAT-MODEL.md](../ai-toolkit/AI-TOOLKIT-THREAT-MODEL.md) | Covers the client-only toolkit, reviewed by an AI agent; the server function and gateway runtime have rows in the platform model only. |
| Privacy review | held | [docs/trust/AI-RISK-ASSESSMENT.md](../trust/AI-RISK-ASSESSMENT.md) | Controlled draft; the ai-conversations surface is assessed; provider terms unsigned. |
| Accessibility review | partial | [app/src/ai/focusbar.test.tsx](../../app/src/ai/focusbar.test.tsx) | Streaming answers are unaudited for screen readers. |
| Reliability objective | held | ask_semester | — |
| Support route | drafted | [docs/integrated-trust/SUPPORT-ROUTES.md](SUPPORT-ROUTES.md) | No report-an-answer flow reaches an owner. |
| Incident playbook | drafted | IR-04 | — |

### Campus life and community

Reviewing seat: **trust**. Playbooks: IR-09, IR-11. Objectives: none defined.

| Requirement | Standing | Backed by | What is missing |
| --- | --- | --- | --- |
| Threat model | drafted | [docs/integrated-trust/THREAT-MODELS.md](THREAT-MODELS.md) | Community had a privacy and media model but no STRIDE; drafted here. |
| Privacy review | held | [docs/COMMUNITY-PRIVACY-MODEL.md](../COMMUNITY-PRIVACY-MODEL.md) | — |
| Accessibility review | absent | — | Maps, directory, events and community are outside every automated case. |
| Reliability objective | absent | — | No objective for campus feeds, freshness or alerts. |
| Support route | drafted | [docs/integrated-trust/SUPPORT-ROUTES.md](SUPPORT-ROUTES.md) | — |
| Incident playbook | drafted | IR-09 | — |

### Family and guardian

Reviewing seat: **privacy**. Playbooks: IR-01, IR-08, IR-12. Objectives: none defined.

| Requirement | Standing | Backed by | What is missing |
| --- | --- | --- | --- |
| Threat model | drafted | [docs/integrated-trust/THREAT-MODELS.md](THREAT-MODELS.md) | A data model and a permission matrix existed; no STRIDE; drafted here. |
| Privacy review | held | [docs/security/guardian-data-model.md](../security/guardian-data-model.md) | Parental consent has not started counsel review. |
| Accessibility review | absent | — | No guardian-facing screen exists to test; the share screens have no assistive-technology pass. |
| Reliability objective | absent | — | Revocation must take effect immediately; nothing measures it. |
| Support route | drafted | [docs/integrated-trust/SUPPORT-ROUTES.md](SUPPORT-ROUTES.md) | — |
| Incident playbook | drafted | IR-08 | — |

### Finance and payments

Reviewing seat: **finance**. Playbooks: IR-10, IR-03. Objectives: none defined.

| Requirement | Standing | Backed by | What is missing |
| --- | --- | --- | --- |
| Threat model | partial | [docs/SECURITY-THREAT-MODEL.md](../SECURITY-THREAT-MODEL.md) | A forged-webhook row and the live-billing acceptance record; no model of the student-account ledger or payment plans. |
| Privacy review | held | [app/src/lib/governance/pia.test.ts](../../app/src/lib/governance/pia.test.ts) | Billing and student-accounts are assessed; no payment credential is stored. |
| Accessibility review | absent | — | Bill and Costs use the shared field-error pattern; no pass on payment flows. |
| Reliability objective | absent | — | No objective for billing summary or payment confirmation. |
| Support route | drafted | [docs/integrated-trust/SUPPORT-ROUTES.md](SUPPORT-ROUTES.md) | — |
| Incident playbook | drafted | IR-10 | — |

### Career and alumni

Reviewing seat: **product**. Playbooks: IR-13, IR-12. Objectives: none defined.

| Requirement | Standing | Backed by | What is missing |
| --- | --- | --- | --- |
| Threat model | drafted | [docs/integrated-trust/THREAT-MODELS.md](THREAT-MODELS.md) | No model existed for credentials, portfolios or employer visibility; drafted here. |
| Privacy review | absent | — | Employer visibility and credential verification have no assessment; minors are kept out in SQL. |
| Accessibility review | absent | — | Portfolio, Opportunities and Pathway are outside every automated case. |
| Reliability objective | absent | — | No objective for applications or credential display. |
| Support route | drafted | [docs/integrated-trust/SUPPORT-ROUTES.md](SUPPORT-ROUTES.md) | — |
| Incident playbook | drafted | IR-13 | — |

### Marketplace and partners

Reviewing seat: **trust**. Playbooks: IR-13, IR-10. Objectives: none defined.

| Requirement | Standing | Backed by | What is missing |
| --- | --- | --- | --- |
| Threat model | drafted | [docs/integrated-trust/THREAT-MODELS.md](THREAT-MODELS.md) | No marketplace exists; the model is written so its controls can be required before it is built. |
| Privacy review | partial | [docs/security/ferpa-risk-and-permission-matrix.md](../security/ferpa-risk-and-permission-matrix.md) | P2 finding only: no purpose-limited application boundary. |
| Accessibility review | absent | — | No marketplace screen exists; the opportunity listing screens are outside every automated case. |
| Reliability objective | absent | — | Nothing to measure until orders exist. |
| Support route | drafted | [docs/integrated-trust/SUPPORT-ROUTES.md](SUPPORT-ROUTES.md) | — |
| Incident playbook | drafted | IR-13 | — |

### Institution console and support

Reviewing seat: **security**. Playbooks: IR-01, IR-05, IR-08. Objectives: none defined.

| Requirement | Standing | Backed by | What is missing |
| --- | --- | --- | --- |
| Threat model | partial | [docs/security/operations-console-access-model.md](../security/operations-console-access-model.md) | An access model, not a threat model. |
| Privacy review | partial | [docs/security/operations-console-access-model.md](../security/operations-console-access-model.md) | Staff reads are modelled and logged for reveals; no assessment covers what the console shows by default. |
| Accessibility review | absent | — | The institution console is outside every automated accessibility case. |
| Reliability objective | absent | — | Integration freshness has targets in prose; no objective is measured. |
| Support route | drafted | [docs/integrated-trust/SUPPORT-ROUTES.md](SUPPORT-ROUTES.md) | — |
| Incident playbook | drafted | IR-08 | — |

### Trust, safety and support

Reviewing seat: **trust**. Playbooks: IR-08, IR-09, IR-12. Objectives: privacy_request_intake.

| Requirement | Standing | Backed by | What is missing |
| --- | --- | --- | --- |
| Threat model | drafted | [docs/integrated-trust/THREAT-MODELS.md](THREAT-MODELS.md) | — |
| Privacy review | held | [docs/SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md](../SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md) | — |
| Accessibility review | absent | — | Help and the ticket form have no manual pass. |
| Reliability objective | held | privacy_request_intake | Intake only; handling a request has no objective because no handling exists. |
| Support route | partial | [docs/SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md](../SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md) | Tickets are behind a flag that is off; no owner or hours. |
| Incident playbook | drafted | IR-09 | — |

### Mobile and offline

Reviewing seat: **engineering**. Playbooks: IR-02, IR-07. Objectives: plan_save.

| Requirement | Standing | Backed by | What is missing |
| --- | --- | --- | --- |
| Threat model | drafted | [docs/integrated-trust/THREAT-MODELS.md](THREAT-MODELS.md) | No mobile threat model existed; the app is a web app and installable PWA, with no native client. |
| Privacy review | partial | [docs/security/ferpa-risk-and-permission-matrix.md](../security/ferpa-risk-and-permission-matrix.md) | P1 finding: sensitive browser persistence is not centrally classified or encrypted. |
| Accessibility review | absent | — | No Dynamic Type, TalkBack or VoiceOver result; touch targets are measured locally only. |
| Reliability objective | partial | [docs/OFFLINE-MODE.md](../OFFLINE-MODE.md) | Sync conflict and queue drain have simulations; no objective. |
| Support route | drafted | [docs/integrated-trust/SUPPORT-ROUTES.md](SUPPORT-ROUTES.md) | — |
| Incident playbook | drafted | IR-07 | — |

