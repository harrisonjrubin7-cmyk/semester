# Procurement and accessibility artefacts

> **Type:** reference · **Audience:** buyers, security-reviewers · **Owner:** `trust` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/institution-guides.test.ts`

This page indexes the security, privacy and accessibility documents a procurement committee asks for and quotes the status each document gives itself; stop reading if you want a conformance statement or a certificate, because none exists.

**Status:** `IN_PROGRESS` for the HECVAT readiness register, the word that register uses for itself. No HECVAT is submitted, no formal accessibility conformance report has been issued, no external penetration test has been performed, and no SOC 2 examination has been done. This page makes no conformance claim for any standard or law.

<!-- status: HECVAT readiness register = IN_PROGRESS @ docs/market-readiness/HECVAT_READINESS.md :: **Status: `IN_PROGRESS`** -->
<!-- claim: vpat Planned -->
<!-- claim: sso In preparation -->
<!-- claim: CLM-008 PROHIBITED -->
<!-- claim: CLM-010 PROHIBITED -->
<!-- artefact: docs/market-readiness/HECVAT_READINESS.md | `IN_PROGRESS` -->
<!-- artefact: docs/market-readiness/HECVAT_DRAFT_RESPONSE.md | DRAFT, not sent -->
<!-- artefact: docs/compliance/VPAT-ACR-SELF-ASSESSMENT.md | no formal ACR has been issued -->
<!-- artefact: docs/market-readiness/ACCESSIBILITY-CONFORMANCE-PLAN.md | RED formal conformance claim -->
<!-- artefact: docs/trust/PENETRATION-TEST-PLAN.md | No external penetration test has been performed -->
<!-- artefact: docs/trust/SOC2-READINESS.md | not SOC 2 audited -->
<!-- artefact: docs/compliance/FERPA-ALIGNMENT-ASSESSMENT.md | no certification is claimed or available -->
<!-- artefact: docs/trust/DPA-CHECKLIST.md | `NOT_STARTED` as a signed agreement -->
<!-- artefact: docs/institutional-readiness/INSTITUTIONAL-ACCESSIBILITY-PACKAGE.md | FORMAL CONFORMANCE OPEN -->
<!-- artefact: docs/institutional-readiness/INSTITUTIONAL-PROCUREMENT-READINESS.md | CONTRACT/ACTIVATION NOT READY -->
<!-- artefact: PUBLIC-CLAIMS-APPROVAL-REGISTER.md | NO UNRESTRICTED PUBLIC CAMPAIGN APPROVED -->

## How to read the status column

Each status below is copied from the document it describes, and a test checks that the document still says it. A status is the document's own word about itself. It is not an assessment by this page, and it is not an approval by anyone. Legal conclusions are for qualified counsel; where the registers say counsel review is pending, that is the state.

## Security and assurance

| Artefact | What it is | Status the document gives | Link |
| --- | --- | --- | --- |
| HECVAT readiness register | Each control a higher-ed review asks about, with its status and the files that show it | `IN_PROGRESS`. HECVAT is a questionnaire, not a certification | [`HECVAT_READINESS.md`](../../market-readiness/HECVAT_READINESS.md) |
| HECVAT draft response | First draft of answers for a university workbook | DRAFT, not sent | [`HECVAT_DRAFT_RESPONSE.md`](../../market-readiness/HECVAT_DRAFT_RESPONSE.md) |
| HECVAT evidence matrix | Procurement work plan by domain | A work plan, not a certification | [`HECVAT-EVIDENCE-MATRIX.md`](../../market-readiness/HECVAT-EVIDENCE-MATRIX.md) |
| Penetration test plan | What an independent tester will be asked to attack | No external penetration test has been performed | [`PENETRATION-TEST-PLAN.md`](../../trust/PENETRATION-TEST-PLAN.md) |
| SOC 2 readiness | Gap assessment against the trust services criteria | Semester is not SOC 2 audited | [`SOC2-READINESS.md`](../../trust/SOC2-READINESS.md) |
| Security package | The controlled security package index | See the page's own status line | [`INSTITUTIONAL-SECURITY-PACKAGE.md`](../../institutional-readiness/INSTITUTIONAL-SECURITY-PACKAGE.md) |

## Privacy and contract

| Artefact | What it is | Status the document gives | Link |
| --- | --- | --- | --- |
| FERPA alignment assessment | Technical-control assessment of education-record handling | No certification is claimed or available | [`FERPA-ALIGNMENT-ASSESSMENT.md`](../../compliance/FERPA-ALIGNMENT-ASSESSMENT.md) |
| DPA checklist | Requirements and starting clauses for a data processing agreement | `NOT_STARTED` as a signed agreement | [`DPA-CHECKLIST.md`](../../trust/DPA-CHECKLIST.md) |
| Subprocessors | Who processes data, and whether the institution or the student chose them | See [`SUBPROCESSORS.md`](../../SUBPROCESSORS.md) | [`SUBPROCESSORS.md`](../../SUBPROCESSORS.md) |
| Data map and retention | What is held, where, for how long | See [student data map](STUDENT-DATA-MAP.md) | [`RETENTION.md`](../../../RETENTION.md) |
| Legal drafts | Terms, privacy and policy drafts | Marked draft for qualified legal review | [`legal/`](../../legal/) |

## Accessibility

| Artefact | What it is | Status the document gives | Link |
| --- | --- | --- | --- |
| VPAT and ACR self-assessment | An internal self-assessment | No formal ACR has been issued | [`VPAT-ACR-SELF-ASSESSMENT.md`](../../compliance/VPAT-ACR-SELF-ASSESSMENT.md) |
| Accessibility conformance plan | The manual test protocol and release rule | YELLOW self-assessment, RED formal conformance claim | [`ACCESSIBILITY-CONFORMANCE-PLAN.md`](../../market-readiness/ACCESSIBILITY-CONFORMANCE-PLAN.md) |
| Institutional accessibility package | The package index | FORMAL CONFORMANCE OPEN | [`INSTITUTIONAL-ACCESSIBILITY-PACKAGE.md`](../../institutional-readiness/INSTITUTIONAL-ACCESSIBILITY-PACKAGE.md) |
| HECVAT and VPAT 90-day plan | The plan that moves those rows | A plan | [`HECVAT-VPAT-PLAN.md`](../../trust/HECVAT-VPAT-PLAN.md) |

The public claims register marks claims of WCAG conformance or a completed VPAT or ACR (CLM-008) and blanket security or legal-assurance claims (CLM-010) as PROHIBITED.

The conformance plan's release rule is that all critical blockers are remediated and retested by a qualified reviewer before a paid pilot launch, limitations and an accommodation path are published, and no conformance or VPAT claim is made without a verified process. The public claims register rates a conformance report (`vpat`) as Planned.

## Procurement process

| Artefact | What it is | Status the document gives | Link |
| --- | --- | --- | --- |
| Procurement readiness | Index of the package | CONTRACT/ACTIVATION NOT READY | [`INSTITUTIONAL-PROCUREMENT-READINESS.md`](../../institutional-readiness/INSTITUTIONAL-PROCUREMENT-READINESS.md) |
| Questionnaire process | How Semester answers questionnaires | See the page | [`PROCUREMENT-QUESTIONNAIRE-PROCESS.md`](../../market-readiness/PROCUREMENT-QUESTIONNAIRE-PROCESS.md) |
| Public claims register | The exact words allowed in public, and the prohibited ones | NO UNRESTRICTED PUBLIC CAMPAIGN APPROVED | [`PUBLIC-CLAIMS-APPROVAL-REGISTER.md`](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) |
| Institutional claims on the site | The status word printed beside each capability | SSO and SCIM: In preparation. LTI and SIS: Planned | [`ops/claims/README.md`](../../../ops/claims/README.md) |
| Trust tab exports | An evidence pack (JSON) and procurement questions (CSV) | Semester's own capability assessment | University, `Trust` tab |

## What to do with this

1. Send your reviewers the status column, not a summary of it.
2. Ask for the document, not for an assertion. Where a document says an artefact does not exist, the answer to the questionnaire row is that it does not exist.
3. Record the date of the evidence. Statuses here move as the registers move.
4. Route anything that reads like a legal question to your counsel and Semester's.
