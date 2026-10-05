# Trust Package: the Documents

These are the long-form documents a university's security, privacy,
accessibility and procurement reviewers read. The brief they came from asked
for:

- a security whitepaper;
- a DPA and a pilot agreement;
- an SLA and monitoring runbooks;
- a SOC 2 readiness matrix;
- a HECVAT/VPAT plan;
- a four-level enterprise roadmap.

**This folder is not the packet index.** Three other documents do that job:

- [`docs/SECURITY-ACCESSIBILITY-READINESS.md`](../SECURITY-ACCESSIBILITY-READINESS.md)
  lists every item in the trust packet, marks each one public, NDA or not
  existing yet, and explains how NDA material is granted.
- [`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md) lists every third party data
  can reach, held by test to the app's Content Security Policy.
- [`docs/FERPA-COPPA-1EDTECH-READINESS.md`](../FERPA-COPPA-1EDTECH-READINESS.md)
  and `docs/market-readiness/HECVAT_READINESS.md` are the control registers.

The documents here fill items those indexes list. The NDA-gated room in
`supabase/migrations/20260928100000_trust_room.sql` and
`app/src/screens/TrustRoom.tsx` is how they reach a named reviewer.

**Three rules hold for everything here:**

1. **No certification claims.** Semester has no SOC 2 report, no ACR, no
   penetration test, no signed DPA, and no insurance. It has not completed a
   HECVAT.
2. **Legal documents are outlines for counsel.** Nothing in this folder is
   contract language anyone should sign as written.
3. **Every path cited in this folder exists.** `app/src/lib/trust.test.ts`
   fails when one does not, and it enforces the scoring rules in
   [`SOC2-READINESS.md`](SOC2-READINESS.md). The SLA figures are checked
   against code by `app/src/lib/sla.test.ts`.

## Start here

| Document | What it is |
| --- | --- |
| [`ENTERPRISE-READINESS.md`](ENTERPRISE-READINESS.md) | The four readiness levels, what "done" means at each, and where Semester is |
| [`SECURITY-WHITEPAPER.md`](SECURITY-WHITEPAPER.md) | The 20-section whitepaper, true to the tree, gaps stated inline |
| [`SOC2-READINESS.md`](SOC2-READINESS.md) | Gap assessment: CC1, CC6 and A1 checklists, scored, plus the HECVAT v4 mapping and a 12-month plan |
| [`DPA-CHECKLIST.md`](DPA-CHECKLIST.md) | FERPA school-official checklist, DPA clause requirements, and starting language for counsel |
| [`SLA.md`](SLA.md) | Availability formula, downtime tables, recommended SLA, credit schedule, exclusions |
| [`APM-RUNBOOK.md`](APM-RUNBOOK.md) | Target telemetry and alert thresholds, marked with what exists; the incident runbook |
| [`PILOT-AGREEMENT-OUTLINE.md`](PILOT-AGREEMENT-OUTLINE.md) | Sections for a 26-week pilot agreement, sample scope, scorecard |
| [`HECVAT-VPAT-PLAN.md`](HECVAT-VPAT-PLAN.md) | HECVAT workstreams, a 90-day plan, and the VPAT/ACR checklist |
| [`BRIDGE-LETTER.md`](BRIDGE-LETTER.md) | The SOC 2 bridge-letter process, for when a report exists |
| [`PROVIDER-TERMS.md`](PROVIDER-TERMS.md) | The AI providers' published terms, quoted verbatim per DPA-checklist question, with what would make each apply. Nothing is signed. Rendered from `app/src/lib/trust/provider-terms.ts` |
| [`SHARED-PROVIDER-ACTIVATION.md`](SHARED-PROVIDER-ACTIVATION.md) | What Semester's shared AI key waits on: five owner decisions, each recorded with evidence, and a deployment switch. Every row is pending the owner, and the `claude` function serves nobody until all are done. Rendered from `supabase/functions/_shared/provideractivation.ts` |
| [`VENDOR-RISK-REGISTER.md`](VENDOR-RISK-REGISTER.md) | One row per subprocessor: data shared, attestation (to confirm), DPA status, tier, and the review procedure. No vendor has been assessed yet |
| [`PENETRATION-TEST-PLAN.md`](PENETRATION-TEST-PLAN.md) | Scope, rules of engagement, test accounts, success criteria and remediation commitments for the first external test. No test has been performed |
| [`FERPA-CONSENT-WORKFLOW.md`](FERPA-CONSENT-WORKFLOW.md) | When consent is needed, the decision gate, the consent screen, the data model field by field against the share tables, and the fifteen workflow controls. Rendered from `app/src/lib/trust/ferpa-consent.ts` |
| [`AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md`](AI-MODEL-TRAINING-AND-DATA-USE-POLICY.md) | The no-training-by-default policy in full and the eleven implementation requirements, each held to the tree. A draft for counsel, rendered from `app/src/lib/trust/ai-training-policy.ts` |
| [`COMPLIANCE-CROSSWALK.md`](COMPLIANCE-CROSSWALK.md) | HECVAT 4, the four 1EdTech TrustEd Apps rubrics and EDUCAUSE 2026 as one control library: every domain rests on rows of the four readiness registers and every 0–4 score is computed by the test, capped at 2 until `docs/evidence/` exists. Also Semester through a university's own vendor intake. Rendered from `app/src/lib/trust/compliance-crosswalk.ts` |
| [`EVIDENCE-REGISTER.md`](EVIDENCE-REGISTER.md) | The evidence index the operating system listed as missing: for every control, the artifact that would prove it operates, its owner seat, frequency and visibility, and what the tree holds today. No evidence has been produced, and the word is refused by test until `docs/evidence/` exists. Rendered from `app/src/lib/trust/evidence-register.ts` |
| [`SECURITY-OVERVIEW.md`](SECURITY-OVERVIEW.md) | How the security model works as built, each statement with the evidence that holds it and what is not shown. Opens with what has not been done |
| [`CONTROL-FACTS.md`](CONTROL-FACTS.md) | Counts rendered from the tree: tables with row-level security, check suites, headers, event classes, edge functions, definer functions. Rendered by `app/src/lib/docs/trust-docs.test.ts` |
| [`REVIEWER-QUESTION-MAP.md`](REVIEWER-QUESTION-MAP.md) | The questions a security or procurement reviewer asks, the page that answers each, and its status. Holds no answers |
| [`DOCUMENT-MAP.md`](DOCUMENT-MAP.md) | Every document in `docs/trust`, `docs/security`, `docs/compliance` and `docs/legal`, grouped by what a reviewer wants |

## Controlled readiness library

These additional documents define the controlled security, privacy, data, AI,
resilience and assurance program. Their individual status and evidence sections
govern what may be claimed; an indexed document is not proof that its control
operates in a target environment.

- Program and risk: [`INFORMATION-SECURITY-PROGRAM.md`](INFORMATION-SECURITY-PROGRAM.md), [`RISK-TREATMENT-PLAN.md`](RISK-TREATMENT-PLAN.md), [`SECURITY-QUESTIONNAIRE.md`](SECURITY-QUESTIONNAIRE.md), and [`THREAT-MODEL.md`](THREAT-MODEL.md).
- Identity and access: [`ACCESS-CONTROL-POLICY.md`](ACCESS-CONTROL-POLICY.md), [`IDENTITY-AND-ACCESS-MANAGEMENT-STANDARD.md`](IDENTITY-AND-ACCESS-MANAGEMENT-STANDARD.md), and [`PASSWORD-SESSION-AND-MFA-STANDARD.md`](PASSWORD-SESSION-AND-MFA-STANDARD.md).
- Engineering and release: [`SECURE-DEVELOPMENT-LIFECYCLE.md`](SECURE-DEVELOPMENT-LIFECYCLE.md), [`CHANGE-MANAGEMENT-POLICY.md`](CHANGE-MANAGEMENT-POLICY.md), [`RELEASE-MANAGEMENT-POLICY.md`](RELEASE-MANAGEMENT-POLICY.md), [`VULNERABILITY-MANAGEMENT-POLICY.md`](VULNERABILITY-MANAGEMENT-POLICY.md), and [`SECURITY-TESTING-PLAN.md`](SECURITY-TESTING-PLAN.md).
- Cryptography, assets and telemetry: [`ENCRYPTION-AND-KEY-MANAGEMENT-STANDARD.md`](ENCRYPTION-AND-KEY-MANAGEMENT-STANDARD.md), [`ASSET-INVENTORY.md`](ASSET-INVENTORY.md), and [`LOGGING-MONITORING-AND-ALERTING-STANDARD.md`](LOGGING-MONITORING-AND-ALERTING-STANDARD.md).
- Incident and resilience: [`INCIDENT-RESPONSE-PLAN.md`](INCIDENT-RESPONSE-PLAN.md), [`SECURITY-INCIDENT-RUNBOOK.md`](SECURITY-INCIDENT-RUNBOOK.md), [`BACKUP-RESTORE-AND-ROLLBACK-RUNBOOK.md`](BACKUP-RESTORE-AND-ROLLBACK-RUNBOOK.md), and [`BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY-PLAN.md`](BUSINESS-CONTINUITY-AND-DISASTER-RECOVERY-PLAN.md).
- Data governance: [`STUDENT-DATA-GOVERNANCE-PROGRAM.md`](STUDENT-DATA-GOVERNANCE-PROGRAM.md), [`DATA-INVENTORY.md`](DATA-INVENTORY.md), [`PERSONAL-DATA-PROCESSING-REGISTER.md`](PERSONAL-DATA-PROCESSING-REGISTER.md), [`DATA-FLOW-MAP.md`](DATA-FLOW-MAP.md), [`DATA-CLASSIFICATION-STANDARD.md`](DATA-CLASSIFICATION-STANDARD.md), and [`DATA-MINIMIZATION-STANDARD.md`](DATA-MINIMIZATION-STANDARD.md).
- Data lifecycle and rights: [`DATA-RETENTION-AND-DELETION-STANDARD.md`](DATA-RETENTION-AND-DELETION-STANDARD.md), [`DATA-EXPORT-STANDARD.md`](DATA-EXPORT-STANDARD.md), [`DATA-SUBJECT-REQUEST-RUNBOOK.md`](DATA-SUBJECT-REQUEST-RUNBOOK.md), and [`CONSENT-AND-PREFERENCE-MANAGEMENT-SPEC.md`](CONSENT-AND-PREFERENCE-MANAGEMENT-SPEC.md).
- Vendor governance: [`VENDOR-SECURITY-REVIEW-PROGRAM.md`](VENDOR-SECURITY-REVIEW-PROGRAM.md) and [`SUBPROCESSOR-GOVERNANCE-PROGRAM.md`](SUBPROCESSOR-GOVERNANCE-PROGRAM.md).
- AI governance: [`AI-GOVERNANCE-PROGRAM.md`](AI-GOVERNANCE-PROGRAM.md), [`AI-SYSTEM-INVENTORY.md`](AI-SYSTEM-INVENTORY.md), [`AI-RISK-ASSESSMENT.md`](AI-RISK-ASSESSMENT.md), [`AI-DATA-USE-STANDARD.md`](AI-DATA-USE-STANDARD.md), [`AI-HUMAN-OVERSIGHT-STANDARD.md`](AI-HUMAN-OVERSIGHT-STANDARD.md), [`AI-TRANSPARENCY-AND-USER-NOTICE.md`](AI-TRANSPARENCY-AND-USER-NOTICE.md), [`MODEL-AND-PROMPT-CHANGE-MANAGEMENT.md`](MODEL-AND-PROMPT-CHANGE-MANAGEMENT.md), and [`AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md`](AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md).
- Readiness matrices: [`EDUCATION-PRIVACY-READINESS-MATRIX.md`](EDUCATION-PRIVACY-READINESS-MATRIX.md), [`NIST-800-53-READINESS-MATRIX.md`](NIST-800-53-READINESS-MATRIX.md), and [`HECVAT-READINESS-MATRIX.md`](HECVAT-READINESS-MATRIX.md).

## What blocks a signature, and none of it is code

Engineering is ahead of everything in this list, and this list is what stops
an institution signing:

1. A legal entity to be the contracting party.
2. Cyber-liability insurance (HECVAT LEGAL-2).
3. A DPA drafted by counsel (HECVAT PRIV-4). The 1EdTech DPSA template is
   the place to start.
4. A penetration test by an independent firm (HECVAT VULN-2).
5. An ACR from a human evaluation (HECVAT A11Y-2).
6. A restore drill, timed, so an RTO and RPO can be stated (HECVAT BCP-1).
7. A privacy policy, terms of service and a vulnerability disclosure policy.

The order matters. Items 1 and 2 come before a pilot conversation turns into
paperwork. Item 6 is an afternoon's work and the cheapest credibility in this
list.

## Readiness is reached when Semester can truthfully say

- We know what data we process.
- We isolate every tenant and user.
- We can explain every AI use.
- We can show sources and control data sharing.
- We can monitor and respond when something fails.
- We can restore data and recover a service.
- We can support a real course cohort.
- We can export and delete data when the contract ends.
- We can document our security, accessibility, privacy and operations.

Today the first three are true, and the rest are not yet. That is the point to
start sending this package: when they are all true, not before.

## Standards and privacy implementation audit

- [Standards and privacy audit](STANDARDS-PRIVACY-AUDIT.md): the interactive 1EdTech / NIST Rev. 5 matrix, education-data boundary map, RFP exports, source-document inventory and outstanding institution activation gates.
