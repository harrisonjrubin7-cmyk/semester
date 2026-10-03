# Semester change management policy — controlled draft

- **Status:** `PARTIAL / PROCESS NOT FULLY OPERATED`
- **Owner:** Engineering/Operations owner with Product, Security, Privacy, Accessibility, Support, and customer change authority
- **Evidence date:** 2026-10-03

## Policy

Every production-affecting code, schema, configuration, provider, integration, policy, data, AI-model, content, legal, support, or operational change requires a traceable request, accountable owner, risk/impact assessment, appropriate review, validation, rollout and rollback/forward-repair plan, communication decision, target verification, and closure evidence. Emergency changes use the same evidence after immediate containment and receive retrospective review.

## Change classes

| Class | Examples | Minimum governance |
| --- | --- | --- |
| standard/low | pre-approved reversible maintenance with unchanged trust boundaries | documented procedure, automated checks, owner, verification |
| normal/material | feature, dependency, configuration, migration, integration, data or policy change | risk review, peer/domain approval, test evidence, rollout/rollback, communication |
| high risk | identity, tenancy, privileged access, sensitive data, AI tools, official writes, payments, crypto, deletion/retention, critical workflow | security/privacy/accessibility/customer review as applicable, negative tests, staged rollout, explicit GO |
| emergency | active incident, critical vulnerability, severe outage or integrity risk | incident authority, containment, minimal safe test, evidence preservation, retrospective within approved window |

## Control and evidence map

| Control | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| source/change traceability | Git history, pull requests, workflow and decision sources | complete ticket-to-release sample not assembled | `PARTIAL` | Engineering | sampled end-to-end records and approver evidence |
| automated validation | CI, function, database, supply-chain, accessibility and smoke checks | current branch/rules enforcement readback incomplete | `PARTIAL` | Engineering/Security | enforced gate export and candidate results |
| migration/config safety | migration checks, feature controls, rollout and rollback sources | target configuration baseline/drift review incomplete | `PARTIAL` | Operations/Engineering | target change rehearsal and readback |
| customer/adoption change | [adoption/change source](../operating-model/CHANGE-MANAGEMENT.md) and implementation playbooks | no named institution committee or accepted calendar | `DESIGNED` | Product/Customer | stakeholder sign-off, training and communication evidence |
| emergency change | incident, rollback, security and recovery procedures | no target emergency-change exercise/sample | `DESIGNED/PARTIAL` | Incident commander | timed exercise and retrospective evidence |

## Required change record

`[CHANGE ID]`, request/reason, owner/backups, systems/assets/tenants/users, data/authority, risk/class, dependencies, threat/privacy/accessibility/AI/legal/customer impact, reviewers/approvers, tests/scans, migration/configuration, rollout/feature state, rollback or forward repair, monitoring/support, communications/training, window/freeze, artifact/commit, target readback, findings/exceptions, result and closure.

## Claim ceiling and activation blockers

Permitted: “Semester has repository change controls, extensive automated checks, and defined risk/adoption requirements.” Prohibited: every change approved, enforced segregation of duties, complete configuration control, customer-approved change process, or proven emergency operation. Blocks: named owners/backups; adopted classifications and approval matrix; enforced branch/release controls; configuration baselines; representative normal/high-risk/emergency records; customer calendars/communications; training; metrics; exceptions; and signed target acceptance.
