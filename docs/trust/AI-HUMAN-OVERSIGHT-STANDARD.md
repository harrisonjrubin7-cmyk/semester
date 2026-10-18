# AI Human Oversight Standard

| Control | Value |
| --- | --- |
| Status | **CONTROLLED DRAFT — HUMAN OPERATING MODEL NOT YET PROVEN** |
| Owner | Harrison Rubin, AI Governance/Product primary; backup and accountable customer decision owner `UNASSIGNED` |
| Evidence date | 2026-10-03 at repository revision `8fc5fd56` |
| Scope | AI-assisted content, recommendations, retrieval, classification, proposed actions and monitoring |

## Standard

AI may assist a person; it may not replace the accountable human or institutional authority. Oversight must be meaningful: the reviewer needs authority, time, relevant source information, understandable output limitations, freedom to reject or correct the result, and a non-AI route. A button press without those conditions is not meaningful review.

Automated final decisions are prohibited for admissions, financial aid, grading, discipline/conduct, disability or accommodation eligibility, health or mental-health judgment, immigration, employment, degree certification and other consequential rights, benefits or adverse actions. AI output is not an official record, professional advice or institutional determination.

## Oversight by action tier

| Tier | Example | Required oversight | Release rule |
| --- | --- | --- | --- |
| H0 — drafting | study aid, summary, explanation | user sees AI label, sources/limitations and can edit, discard or use a non-AI path | permitted only after feature gate and notice approval |
| H1 — reversible suggestion | plan or reminder suggestion | user independently chooses whether to act; no silent write | action remains a proposal until explicit confirmation |
| H2 — external or record-affecting action | approved message, calendar, LMS/SIS or workflow write | authorized person reviews the exact target/effect immediately before execution; system verifies authoritative readback and offers correction/rollback | requires scoped customer approval and tested integration |
| H3 — consequential support | material informing a human decision | qualified institutional decision-maker independently reviews authoritative sources, records rationale and provides correction/appeal route | AI cannot be the sole or determinative basis |
| H4 — prohibited decision | initial prohibited scope above | no amount of nominal review cures the prohibited automation | do not build or activate |

## Reviewer requirements

For each feature, record the accountable decision owner and backup; reviewer qualifications and training; workload/response target; sources visible to the reviewer; exact fields/actions reviewed; conflicts and escalation; override/correction logging; affected-person notice and recourse; quality sampling; and stop criteria. The same person may not silently author an AI change, waive its gate and accept its residual risk where independent review is required.

Reviewers must not infer correctness from fluency, citations alone, model/provider brand, a confidence label or prior acceptance. They must compare consequential content with the authoritative source. Semester and the customer must monitor rubber-stamping, overrides, corrections, complaints, disparities, missed escalations and reviewer capacity without using sensitive traits for undisclosed profiling.

## Evidence and control mapping

| Control | Code/config evidence | Operational evidence | Owner | Missing test/proof |
| --- | --- | --- | --- | --- |
| proposal before action | `app/src/ai/Actions.tsx` and prompt tests distinguish a proposed action from an act | no accepted production record covering every AI action path | Product | UI test and target exercise showing exact review, rejection, confirmation and correction |
| fresh confirmation/readback | institutional intelligence service tests require confirmation and authoritative readback for supported actions | no named-institution SIS/LMS AI-write operation is evidenced | Product + Customer | approved adapter, UAT, rollback and decision-owner acceptance |
| sources and limitations | selected disclosure/source components and tests | route-wide notice and comprehension evidence absent | Product + Accessibility | accessibility/usability test with representative users |
| non-AI and human route | local/manual product paths exist for selected workflows | staffing, hours, escalation and response evidence absent | Support + Customer | submit and close a representative escalation |
| prohibited scope | `docs/operating-model/AI-LIFECYCLE-GATES.md` and governance code refuse defined starting scopes | no operated intake/oversight board record | AI Governance | named board, use-case records and sampled decision audit |

## Escalation and stop rules

Pause the feature or narrow its scope when reviewers cannot verify sources, capacity is insufficient, the output could create immediate harm, a prohibited use appears, material bias/accessibility/privacy risk is suspected, complaints or overrides exceed the approved threshold, the provider/model changes unexpectedly, or required logs and kill switches cannot be trusted. Preserve minimum necessary evidence and use the AI incident runbook.

## Claim ceiling

Semester may say it has defined human-oversight tiers and repository controls for proposals, selected confirmations and prohibited starting scopes. It may describe a specific tested path with its exact limits.

## Prohibited claims

Do not claim universal human review, human-in-the-loop operation, explainability, appeal coverage, qualified reviewer availability, non-discrimination or safe consequential use without current feature- and customer-specific evidence. A policy, confirmation button or audit field alone does not prove meaningful oversight.

## Related controls

- [`AI-GOVERNANCE-PROGRAM.md`](AI-GOVERNANCE-PROGRAM.md)
- [`AI-TRANSPARENCY-AND-USER-NOTICE.md`](AI-TRANSPARENCY-AND-USER-NOTICE.md)
- [`AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md`](AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md)
