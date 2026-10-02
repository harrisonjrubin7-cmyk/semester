# Incident response and recovery playbook

**Status:** designed and test-backed in the repository; not yet exercised with a production institution.
**Owner:** an incident commander must be named for every incident. The permanent owner and backup remain a launch gate.
**Authority:** this playbook does not authorize production access, tenant activation, external communication, or an institutional SLA.

Semester restores a verified safe state, not merely a visible interface. Private student plans, notes, reflections, energy selections, and unshared Context Packets are never part of a routine staff incident view.

## Severity

| Severity | Meaning | Required response |
| --- | --- | --- |
| SEV1 | Suspected cross-tenant exposure, systemic authorization or consent failure, widespread unsafe official write, or total outage | Contain immediately; name commander; preserve evidence; begin security/privacy and institution routes |
| SEV2 | Core workflow broken for many users, including broad SSO/LTI outage or integrity failure | On-call response; safe mode; incident record; customer contact |
| SEV3 | Degraded or partial service, stale source, accessibility defect, or limited AI-quality issue | Named owner; visible fallback; defined remediation target |
| SEV4 | Isolated low-impact, cosmetic, or single-user defect | Normal product/support cycle |

A suspected cross-tenant exposure is SEV1 until disproven. This is the same taxonomy used by `docs/market-readiness/INCIDENT_RESPONSE.md`.

## Universal lifecycle

1. **Detect:** record the signal, first observation, affected tenant/service, student-visible effect, and correlation identifiers. Do not copy private student content into the incident.
2. **Contain:** disable the smallest unsafe path, block risky or ambiguous writes, revoke affected credentials when required, quarantine untrusted sources, and preserve evidence. Never weaken JWT, authorization, consent, or policy checks for availability.
3. **Communicate:** say what is affected, what remains safe, what a student can do now, and when the next update will occur. External messages are drafts until an authorized person sends them.
4. **Recover:** restore a known-good configuration, tested replica, approved model route, or source-only/read-only fallback. Do not retry an ambiguous official write.
5. **Verify:** prove the security, privacy, integrity, accessibility, source, and reconciliation conditions for the affected path. A healthy status check alone is insufficient.
6. **Close:** record the measured timeline, impact, recovery point, verification, communications, and corrective actions. SEV1/SEV2 reviews occur within five business days of stabilization.

An incident cannot close without a named commander, a future next-update time while active, and recovery verification. The executable contract is in `app/src/lib/incident-recovery.ts`.

## Service tiers and unset recovery objectives

The tiers below reuse the repository's established service catalog. RTO and RPO remain unset: Semester has not completed the timed restore exercise required to state either figure.

| Tier | Services | Proposed RTO | Proposed RPO | Safe fallback |
| --- | --- | ---: | ---: | --- |
| 0 | Public marketing and resource pages | Unset | Unset | Status and official-resource route |
| 1 | Student planning, Today, actions, resource discovery | Unset | Unset | Saved workspace and official sources with freshness labels |
| 2 | SSO, course access, assignments, submissions, integrations | Unset | Unset | Fail closed; official LMS and source links |
| 3 | Grading, assessments, payments, high-impact records | Unset | Unset | Block and reconcile against the system of record |
| Restricted | Basic-needs intake, accommodations, health and safety data | Unset | Unset | Institution-owned restricted process |

Each institution must approve objectives after reviewing academic-calendar peaks, legal obligations, dependencies, data classification, maximum tolerable downtime, fallback, owners, and test plan. A number may be added only after a timed restore/failover exercise records it.

## Service runbooks

### Identity, LTI, or SSO failure

- Detect launch failure spikes, issuer/deployment mismatches, unknown key errors, or SSO health alarms.
- Fail closed for the affected route. Do not relax token validation.
- Keep the official LMS and approved course links available when safe.
- Validate issuer, client, deployment, JWKS, tenant membership, and invalid-token rejection before restore.

### Source or sync failure

- Mark the source stale or unavailable and suppress source-dependent certainty.
- Show its owner, last verified time, correction route, and official fallback.
- Resync, compare changed fields, validate anchors/links, and sample affected answers before clearing the warning.

### AI model or policy-engine failure

- Disable the affected agent/tool route. Do not bypass policy to preserve availability.
- Use source-only/template mode, or a fallback model only when it is already approved and evaluated.
- Verify grounding, privacy, academic-integrity, policy, and tool-use tests before restore.

### Student workspace recovery

- Stop destructive jobs and preserve versions/audit history.
- Restore only through an authorized process from a backup, event, or saved device copy.
- Verify content, sharing/consent state, and source references; tell the student what was and was not restored.

### Official-write or reconciliation failure

- Mark the action **Pending verification** and block automatic retry.
- Query the authoritative system using the idempotency reference.
- Close only after proving one and only one intended effect exists and showing the confirmed result to the student.

## Automation boundaries

Automation may disable a risky feature, quarantine a source, block a write, fail over to a tested replica, use a pre-approved fallback, mark data stale/pending, and open an incident/page an owner.

Automation must not weaken authentication, override consent/policy, retry ambiguous official writes, share private student details, use an unapproved model/tool, restore deleted/revoked data blindly, or declare resolution without verification.

## Student communication frame

Every notice includes:

- a plain-language title;
- what is affected;
- what is still safe and available;
- the official fallback or human route;
- whether any action was confirmed, pending, or not attempted;
- the next update time; and
- a privacy sentence when student data could reasonably be a concern.

Canonical examples remain in [`market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md`](market-readiness/INCIDENT_COMMUNICATION_TEMPLATES.md). They are templates, not evidence that a message was sent.

## Post-incident review

Collect the timeline, alerts, tickets, redacted traces, changes, communications, RTO/RPO measurements, data and official-write reconciliation, accessibility behavior, and control outcomes. Every corrective action has one owner, due date, severity, required evidence, a regression/rehearsal when applicable, and verification before closure.

## Remaining operational gates

- Name the permanent incident owner, backup, and institution contacts.
- Back up and restore-test the gateway journal.
- Restore a production backup into an isolated project and time the complete verification path.
- Run a SEV1/SEV2 tabletop through the real contact tree.
- Obtain institution-specific RTO/RPO approval and record it as configuration-bound evidence.
