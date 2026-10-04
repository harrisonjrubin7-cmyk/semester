# Semester security incident runbook — controlled draft

- **Status:** `DESIGNED / NOT TARGET-EXERCISED`
- **Owner:** Harrison Rubin, incident commander and security primary; backup `UNASSIGNED`
- **Evidence date:** 2026-10-03

## First response

1. **Protect people and scope.** If real student/customer data, a third party, or production is reached unexpectedly, stop testing and preserve what already exists.
2. **Open the record.** Assign incident ID, timestamp, reporter, environment/tenant, suspected systems/data, provisional severity, commander, recorder, evidence location, and next update time.
3. **Contain safely.** Refuse unsafe writes, disable the feature/provider, enable read-only or invite-only controls, isolate access, revoke/rotate credentials, or roll back. Do not delete logs, rebuild affected systems, or restore over production without authorization.
4. **Assess.** Establish what happened, when, affected identities/tenants/data/regions, confidentiality/integrity/availability, continued exposure, attacker access, provider impact, and evidence confidence.
5. **Escalate.** Bring in privacy/legal, operations, engineering, support/communications, executive authority, customer contacts, providers/insurers/law enforcement only through approved routes. Record every notice decision and clock source.
6. **Eradicate/recover.** Fix or remove cause; rotate/revoke; restore/reconcile; verify identities, permissions, tenant isolation, deletions/holds, data integrity, audit continuity, core journeys, alerts, and rollback.
7. **Communicate.** Use verified facts, impact, affected scope, safe actions/workarounds, and next update. Never guess root cause, promise a clock, or reveal another person's data.
8. **Close/learn.** Approve residual risk; preserve the timeline; record root/contributing causes, control/detection gaps, notices, recovery proof, corrective actions, owners/dates, and retest.

## Severity and routing

P0 includes suspected cross-tenant exposure, high-impact secret compromise, destructive integrity loss, broad auth/outage, or active exploitation; treat suspected exposure as P0 until disproven. P0/P1 pauses launch or active pilot until accountable owners approve safe recovery. Exact response or notice times remain contractual/legal and operational decisions, not promises in this runbook.

P0/P1 is this runbook's scale. `SECURITY.md` (Critical–Low) is for vulnerability reports, `docs/INCIDENT-RECOVERY-PLAYBOOK.md` (SEV1–4) is for service recovery, and the privacy overlay (PX-0–3) in `docs/privacy-operations/05-PRIVACY-INCIDENT-COORDINATION.md` §4 maps onto all of them; each stays in its lane.

## Control and evidence map

| Control | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| stop/contain | `SECURITY.md`, feature controls, read-only/invite gates, rollback | no integrated target timing | `PARTIAL` | Commander/Engineering | containment and access-revocation drill |
| evidence | correlation IDs, logs/audits and templates | storage, custody, access and retention unapproved | `PARTIAL` | Security/Privacy | evidence-preservation exercise |
| communicate | incident/status/customer templates | authority, contacts, channel resilience, legal review absent | `DESIGNED` | Executive/Legal/Support | communication tabletop |
| recover | restore/rollback/check suites | provider backup restore and full validation absent | `PARTIAL` | Operations | timed isolated restore and recovery acceptance |
| learn | postmortem/corrective-action requirements | no complete P0/P1 sample | `DESIGNED` | Security/Product | tabletop record, action tracking and retest |

## Claim ceiling and activation blockers

Permitted: “Semester has a repository-linked security incident runbook with defined containment, assessment, recovery, and learning steps.” Prohibited: exercised response, 24/7 on-call, guaranteed response or notification time, forensically complete evidence, or customer-approved operations. Blocks: named rota/backups, protected incident/evidence system, contacts and communication authority, legal decision tree, target tabletop, credential/access/rollback/restore exercises, provider escalation, training, and approved closure criteria.
