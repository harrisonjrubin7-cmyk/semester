> **DRAFT FOR QUALIFIED LEGAL REVIEW. This document is a business and operational template, not legal advice, not an executed agreement, and not a substitute for review by licensed counsel in the applicable jurisdiction.**

# Semester contract deviation approval matrix — draft

- **Owner:** Legal coordinator
- **Record:** `[CONTROLLED DEVIATION REGISTER LOCATION TO BE APPROVED]`
- **Rule:** no deviation is accepted by silence, email convenience, sales urgency, repository documentation, or prior one-off treatment

## Plain-language summary

This matrix routes nonstandard customer language to the people who can assess its legal, financial, product, operational and institutional effects. It does not delegate approval authority: until qualified counsel and authorized owners adopt named people and thresholds, every material deviation remains blocked.

## Approval matrix

| Deviation category | Required reviewers | Evidence/decision required | Default without approval |
| --- | --- | --- | --- |
| parties, authority, law, disputes, term/termination | qualified counsel and authorized executive | final language and authority | reject / baseline only |
| price, discount, credits, payment, tax, renewal | Finance/Deal Desk, counsel as applicable | approved economics and accounting/tax treatment | no offer or signature |
| liability, indemnity, warranty, insurance | counsel, executive, insurance owner | quantified exposure and coverage evidence | reject / baseline only |
| data roles, use, retention, rights, subprocessors, regions | Privacy, Security, counsel, customer owner | approved data map, terms, controls and operations | disable affected processing |
| security, incident, audit, recovery | Security/Engineering Operations, Privacy, counsel | current evidence, staffing, tests and remediation | no unsupported commitment |
| accessibility/accommodations | Accessibility/Product, Support, counsel | scoped evaluation, roadmap and operating route | no conformance claim |
| AI provider/use/training/decision | AI governance, Privacy, Security, Product, counsel, customer authority | exact provider/model/data/use/evaluation/human control | AI disabled for scope |
| integration, official-system write, custom work | Product, Engineering, Implementation, Security/Privacy | accepted architecture, capacity, tests, SOW and rollback | exclude / roadmap |
| support, uptime, response, RTO/RPO | Operations/Support, Engineering, Finance, counsel | measured capability, owners, monitoring and remedies | noncontractual target only |
| IP, feedback, publicity, reference/outcome | counsel, Product/Communications, rights holder | ownership/license and separate permission | no transfer or public use |

Amounts and discount percentages are not set here. They follow the ladder in `app/src/lib/governance/deal-desk.ts`, mirrored in `docs/operating-model/COMMERCIAL-GOVERNANCE.md`, which also lists the seats that are unfilled; this matrix routes the language of a deviation.

## Deviation record

Record customer request, baseline language, proposed response, reason, affected users/data/systems, legal and operational risk, security/privacy/accessibility/AI impact, financial exposure, implementation work, dependencies, compensating controls, approvers and dissent, effective/expiry dates, renewal treatment, precedent status, obligations, verification, and rollback/exit.

Approval of contract language does not prove implementation. Any deviation requiring product, configuration, staffing, vendor, monitoring, support, recovery, or evidence changes remains an activation blocker until those changes are verified in the target environment.

## Product-behavior and evidence mapping

| Evidence state | Permitted treatment |
| --- | --- |
| repository implementation/test only | describe narrowly at a named revision; do not claim deployment or operation |
| configured and tested in target environment | support only that exact scope, date and documented limitation |
| independent review or operational exercise | use only the assessor/exercise scope, result, date and expiry |
| customer acceptance or signed paper | applies only to that customer, version, use case, ages and jurisdictions |

Every deviation affecting age posture, student/education data, geography, governing law, AI, accessibility, security, support, or official-system authority requires an explicit applicability decision; a prior deal is not evidence for a new one.

## Prohibited approval patterns

No self-approval by the requester; no retroactive approval after signature; no “same as last deal” without current comparison; no permanent exception without expiry/review; no privacy/security/accessibility/legal waiver by an unauthorized role; and no reliance on a roadmap promise as a completed control.

## Signature blockers

Complete deviation record; qualified review; accountable approvers and backups; quantified risk/economics; feasible remediation and ownership; alignment with insurance and company authority; contract/obligation register update; and no unresolved P0/P1 or unsupported representation.
