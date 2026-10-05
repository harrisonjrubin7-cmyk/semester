# Semester incident response plan — controlled draft

- **Status:** `DESIGNED / NOT TARGET-EXERCISED`
- **Owner:** Harrison Rubin, incident-response executive and security primary; backup `UNASSIGNED`
- **Evidence date:** 2026-10-03
- **Scope:** security, privacy, availability, integrity, safety, AI, vendor, integration, and recovery incidents

## Response lifecycle

1. Detect, validate safely, open an incident ID/timeline, preserve minimal evidence, and classify provisional severity.
2. Name incident commander, security/engineering/operations, privacy/legal, support/communications, customer liaison, recorder, and backups.
3. Contain before full diagnosis when necessary: disable a feature/provider, refuse writes, enter read-only mode, isolate access, revoke/rotate, or roll back without destroying evidence.
4. Determine affected systems, data, tenants, users, time window, ongoing risk, source, integrity, availability, and possible notification duties.
5. Eradicate and recover through approved changes; validate authorization, tenant isolation, data integrity, audit continuity, core journeys, monitoring, and rollback.
6. Communicate verified facts, impact, safe action, workaround, and next update through approved authority; do not speculate or expose personal data.
7. Close only after recovery evidence, residual-risk approval, notice decisions, corrective actions, owners/dates, and post-incident review.

## Control and evidence map

| Control | Code/config evidence | Operational evidence | Status | Owner | Missing test/proof |
| --- | --- | --- | --- | --- | --- |
| detection/intake | security contact, smoke workflow, status and provider/health sources | monitored routes, backup coverage, and alert-to-case evidence incomplete | `PARTIAL` | Security/Operations | test report and alert-delivery exercise |
| containment | feature states, read-only/invite controls, credential rotation and rollback sources | integrated target use not exercised | `PARTIAL` | Incident commander/Engineering | timed target containment tabletop |
| evidence/timeline | correlation/audit designs and incident templates | approved protected evidence store and custody process absent | `DESIGNED` | Security/Privacy | evidence capture/access/retention drill |
| assessment/notification | legal drafts and communication templates define decision inputs | counsel/customer contacts, authority, and clocks unapproved | `BLOCKED` | Privacy/Legal/Executive | jurisdiction/contract decision tree and tabletop |
| recovery/learning | restore, rollback, validation and post-incident requirements | no end-to-end target incident exercise | `PARTIAL` | Operations/Security | recovery, notice, postmortem and corrective-action proof |

Operational steps are in [SECURITY-INCIDENT-RUNBOOK.md](SECURITY-INCIDENT-RUNBOOK.md). The earlier [market-readiness plan](../market-readiness/INCIDENT-RESPONSE-PLAN.md) remains source material, not evidence that the process is staffed or accepted.

## Claim ceiling and activation blockers

Permitted: “Semester has a documented incident lifecycle, containment options, communication templates, and supporting technical controls.” Prohibited: 24/7 response, tested response times, guaranteed notification clock, institution-approved incident process, completed tabletop, or proven end-to-end recovery. Blocks: named roles/backups and contacts; monitored intake; severity/escalation and communication authority; evidence store; legal/contract decision tree; target tabletop; containment/rotation/rollback/restore exercise; customer coordination; corrective-action tracking; training; and signed acceptance.
