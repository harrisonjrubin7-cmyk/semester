# Semester Trust Center content

**Status:** procurement-conversation draft. Controls are documented; certifications, external audit, customer approval, and production operation are not implied.

## Security

Semester is a local-first React application with Supabase-backed account and institutional services, policy-enforced tenant/resource access, scoped capabilities, audited privileged workflows, and a separate institution gateway for approved actions. Data in transit relies on TLS through hosting/providers; at-rest encryption is provider-managed and must be confirmed for each contracted environment. Secrets belong in platform secret stores, never the client. CI includes type, lint, test, browser, accessibility, database-policy, secret, supply-chain and deployment checks. Vulnerability intake is published in `SECURITY.md`; remediation targets are policy targets, not proof of historical performance. A current independent penetration test is not available.

Logging is designed to minimize student content. Incident, rollback, backup and recovery runbooks exist, but target-production incident and restore exercises remain launch gates. Business continuity objectives are pilot-scoped until measured. Subprocessors are inventoried in `docs/SUBPROCESSORS.md`; contractual approval and tenant-specific activation remain required.

## Privacy

Semester collects only data required for the enabled workflow: account/identity, student-entered academic planning content, authorized source/sync metadata, preferences, support records, minimal audit/security events, and narrowly governed AI request metadata. The approved data map for each pilot controls what is actually used. Semester does not sell student data and does not permit behavioral advertising based on education records, private conversations, health/disability information, or institutional records.

Students receive export, correction/revocation and deletion paths subject to identity verification, institutional record duties, legal holds, and backup expiry. Institutions remain responsible for lawful authority, notices and official-record decisions in their systems. AI processing is feature-scoped, disclosed, reversible where possible, and never authoritative for high-impact decisions. Family/guardian access is not inferred and requires an explicit lawful workflow. The initial pilot excludes children under the approved age boundary unless counsel and the institution approve a separate program.

## Accessibility

Semester targets WCAG 2.2 AA and uses automated accessibility, contrast, reflow and keyboard checks plus documented manual protocols. This is an alignment target, not a conformance certification. A formal ACR/VPAT and independent evaluation are not currently available. Every pilot requires manual assistive-technology testing of the exact workflows and a named accommodation escalation path before launch.

## AI governance

AI features may organize, explain, summarize or help a student work with authorized sources. The product discloses source, uncertainty and limits; model output is not authoritative academic, legal, financial, health or accessibility advice. Providers/models and their terms require approval before activation. Customer data may not be used for model training unless the customer and affected user explicitly approve a separately described use. Code—not prompts—enforces permissions. Controls include scoped tools, audit metadata, rate/cost limits, evaluations, prompt-injection assumptions, output handling, human review and kill switches.

## Operations

Support is pilot-scoped with agreed hours and severities; no 24/7 promise is made absent staffing. Service targets are offered only after target-environment baselines and owner acceptance. Changes use reviewed releases, feature controls and rollback. Status communication uses the mechanism named in the pilot agreement; a public multi-service status operation is not yet evidenced.

## Procurement evidence index

| Item | Current status | Source |
| --- | --- | --- |
| HECVAT 4 response | prepared as draft/evidence index | `HECVAT-EVIDENCE-MATRIX.md`; existing HECVAT drafts |
| Security control matrix | controls documented; production proof partial | `SECURITY-CONTROL-MATRIX.md` |
| Privacy control matrix | pilot-scoped program | `PRIVACY-PROGRAM.md` |
| Data-flow diagram | architecture and tenant maps exist; customer map required | `docs/DATA-INVENTORY-AND-LINEAGE.md` |
| DPA/pilot agreement | issue lists/outlines only | `docs/trust/DPA-CHECKLIST.md`; `docs/trust/PILOT-AGREEMENT-OUTLINE.md` |
| Subprocessors | register exists; contractual verification required | `docs/SUBPROCESSORS.md` |
| Insurance | not evidenced | launch blocker before contracted risk requires it |
| Accessibility | self-assessment; external ACR open | `docs/compliance/VPAT-ACR-SELF-ASSESSMENT.md` |
| Penetration test | plan only | `docs/trust/PENETRATION-TEST-PLAN.md` |
| Integration standards | architecture/tests; no customer activation | LTI/interop documentation and gateway tests |

Evidence available under NDA must be shared through a controlled trust room, never placed in marketing copy.
