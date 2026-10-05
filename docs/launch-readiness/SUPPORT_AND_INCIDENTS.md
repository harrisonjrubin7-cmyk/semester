# Support and incidents

**Status:** runbooks and templates exist; production operating capability is incomplete

## Present

- Incident, monitoring, rollback, restore and communication documents exist.
- The product includes user-facing help, limitation and barrier-reporting surfaces.
- Hourly synthetic monitoring and a public status surface are described in repository workflows.
- Response windows and institutional routing structures are drafted.

## Draft severity model

| Severity | Example | Required operating posture before GA |
| --- | --- | --- |
| P0 / critical | active data exposure, destructive cross-tenant access, widespread unrecoverable data loss | immediate incident command, containment and approved customer/legal escalation |
| P1 / high | core service unavailable, authentication broadly broken, major accessibility blocker, serious integrity risk | urgent owner acknowledgement, mitigation/rollback and scheduled updates |
| P2 / medium | degraded non-core workflow or bounded defect with workaround | staffed-support triage with owner and target |
| P3 / low | minor defect, polish or documentation issue | prioritised backlog |

This is a release definition, not a customer SLA. Exact support hours, acknowledgement/update clocks and channels must be approved, staffed and included in customer terms before they are promised.

## Incident communication sequence

Detect and validate → assign incident commander and severity → contain/disable/rollback → preserve evidence → notify internal and institution contacts under the approved plan → post accurate status updates → recover and verify → document impact and required notices → complete a blameless review and track corrective actions.

## Missing for GA

- a resilient named on-call/support roster with backup coverage;
- a verified support address/ticket path suitable for customer commitments;
- live alert delivery to accountable people;
- an exercised severity model, paging route and incident command process;
- completed production rollback and restore drills;
- measured RTO/RPO and sufficient availability history for an SLO/SLA;
- customer-specific university contacts and escalation authorization;
- post-incident review practice with retained evidence.

## Minimum operating acceptance

Before GA, send a test request through every support channel, trigger a safe synthetic alert, run a tabletop and technical incident exercise, execute rollback and restore on the intended production path, confirm status/communication updates, and record times, owners, gaps and corrective actions.

No 24/7 support, response-time or uptime guarantee should be sold until staffing and measurements support it.
