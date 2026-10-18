> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# AI Use and Data Governance Policy — Draft

This controlled review artifact is not approved, published, or in force. It must not be presented as a contractual promise, compliance conclusion, or authorization to activate AI features.

## Purpose and scope

This draft describes the policy Semester intends to apply when an AI feature processes user, customer, institutional, or course information. It covers user-requested generation, retrieval, evaluation, safety monitoring, support, provider administration, model changes, and any proposed use of production data for improvement.

The detailed source is the [AI Model Training and Data Use Policy](../trust/AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md). The public-language companion is the [AI Use Policy draft](../legal/AI-USE-POLICY-DRAFT.md). Those sources remain drafts and must be reconciled before publication.

## Proposed default rules

- Process only the information necessary for the feature the user deliberately invokes.
- Do not use education records, private content, support material, accessibility information, or AI conversations for general-purpose model training by default.
- Do not allow a provider to use covered production data for its own training unless the exact provider terms, contract, purpose, technical controls, legal basis, and required authorization are documented and approved.
- Keep tenants and authorized source sets separated.
- Treat provider, model, retention, training, residency, and subprocessor changes as reviewable changes, not silent configuration updates.
- Show limitations and require human confirmation before a proposed action changes user data or workflow.
- Provide a route to report harmful, inaccurate, inaccessible, or policy-inappropriate output.

These are proposed controls, not proof that every provider contract, runtime path, or deployment enforces them.

## Data-use decisions requiring approval

Before any production AI scope is enabled, the accountable owners must record:

1. The feature, users, data categories, provider, model, region, and purpose.
2. The legal and contractual authority for processing.
3. Provider retention, training, secondary-use, deletion, incident, and subprocessor terms.
4. Data minimization, classification, redaction, access, logging, deletion, and tenant-isolation controls.
5. Accessibility, accuracy, safety, human-review, and incident-response expectations.
6. Whether notice, consent, opt-in, institutional authorization, or instructor policy is required.
7. The approved evaluation, monitoring, suspension, and change-control plan.

## Current evidence boundary

Repository controls and tests can evidence parts of minimization, kill-switch behavior, confirmation, tenant policy, and metadata logging. They do not establish executed provider terms, production configuration, legal authority, institutional approval, accessibility conformance, or observed operational performance. A `store: false` request parameter must not be described as zero retention without provider-specific evidence and approval.

## Product-behavior mapping

| Policy statement | Current evidence | Status / remediation |
| --- | --- | --- |
| AI is used only for an approved invoked purpose | AI action/provider code and feature controls | CONDITIONAL; verify every deployed route and institution configuration |
| minimum approved data reaches the provider | classification, prompt-builder and provider controls | PARTIAL; reconcile exact prompts/context/logging and contract terms |
| student data is not used for general model training | governance tests and draft notices | CONDITIONAL on every provider, runtime, contract and telemetry path |
| human confirmation and high-impact limits apply | confirmation/governance controls | repository evidence; operating oversight and customer acceptance open |
| kill switch, evaluation and incident controls exist | tests, evidence register and runbooks | point-in-time evidence; production exercise and named ownership open |

## Required decision placeholders

`[APPROVED AI SYSTEMS/PROVIDERS/MODELS]`, `[PERMITTED PURPOSES/DATA CLASSES]`, `[AGE/COURSE/INSTITUTION AUTHORITY]`, `[RETENTION/TRAINING/REGION TERMS]`, `[EVALUATION THRESHOLDS]`, `[HUMAN OVERSIGHT]`, `[INCIDENT/KILL-SWITCH OWNERS]`, `[NOTICE/CONSENT]`, and `[EFFECTIVE DATE/APPROVERS]`.

## Plain-language summary

Semester should use AI only for a clear, user- or institution-authorized purpose, send the minimum necessary information, explain important limits, and preserve human control. Production use remains limited to the exact scopes that have completed legal, privacy, security, accessibility, procurement, and operational review.

## Publication and activation blockers

- [ ] Qualified counsel approves the policy, applicable jurisdictions, age posture, and required notices or consent.
- [ ] Privacy and security owners approve the data flow, classification, provider, retention, access, deletion, and incident controls.
- [ ] Current provider terms or executed agreements substantiate every training, retention, residency, and secondary-use statement.
- [ ] Each enabled feature has passed documented accessibility, safety, accuracy, and misuse evaluation.
- [ ] Institution-specific use is approved by the institution and reflected in the applicable agreement and policy configuration.
- [ ] The public summary, detailed policy, subprocessor register, product behavior, and support procedure agree.

Until every applicable blocker is closed, this draft must not be published as an effective policy or used to justify institutional activation.
