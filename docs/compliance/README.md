# Compliance evidence index

**Published:** 1 October 2026

**Owner:** Harrison Rubin, founder

**Scope:** Semester web application, company website, and the controls documented in this repository

This index makes the Trust Center's green state precise: **green means a dated,
reviewable evidence artifact exists.** It does not mean that Semester holds a
certification, legal opinion, independent audit report, or customer approval.
Those outcomes remain unavailable until the external gate named below is met.

| Area | Published evidence | What the evidence proves | External gate still open |
| --- | --- | --- | --- |
| SOC 2 | [`docs/trust/SOC2-READINESS.md`](../trust/SOC2-READINESS.md) | Control-readiness scope and the work required before an audit | Engage an independent CPA firm, complete the observation period, remediate exceptions, and receive the report |
| ISO 27001 | [`ISO-27001-READINESS-ASSESSMENT.md`](ISO-27001-READINESS-ASSESSMENT.md) | Internal gap assessment against the ISMS lifecycle | Establish and operate the ISMS, complete internal audit and management review, then pass an accredited certification audit |
| HECVAT | [`docs/market-readiness/HECVAT_DRAFT_RESPONSE.md`](../market-readiness/HECVAT_DRAFT_RESPONSE.md) | A repository-backed draft answer library with explicit Yes, Partial, No, and owner-supplied answers | Owner review, mapping into the current customer workbook, customer delivery, and reviewer acceptance |
| VPAT / ACR | [`VPAT-ACR-SELF-ASSESSMENT.md`](VPAT-ACR-SELF-ASSESSMENT.md) | A scoped self-assessment and the exact criteria that remain unevaluated | Human assistive-technology evaluation, remediation, and issuance of a current ACR on the applicable VPAT template |
| WCAG 2.2 AA | [`docs/WCAG-UI-AUDIT-SCORECARD.md`](../WCAG-UI-AUDIT-SCORECARD.md) | Automated and code-review evidence for covered components and workflows | Manual keyboard, screen-reader, zoom/reflow, target-size, and cognitive review across the production experience |
| FERPA | [`FERPA-ALIGNMENT-ASSESSMENT.md`](FERPA-ALIGNMENT-ASSESSMENT.md) | Technical-control mapping for access, disclosure, export, deletion, isolation, AI use, and incident handling | Counsel review, institutional determination, signed DPA/school-official terms, and production tenant exercise |

## Publication rule

The public Trust Center may mark an evidence row green only when its linked file
exists, identifies its scope and date, and states the remaining gate. It may not
replace phrases such as "not certified", "pending", or "no conformance claim"
with a certification or compliance claim until the corresponding independent
artifact is filed under `docs/evidence/`.
