# Institutional Support and Escalation

| Control | Value |
| --- | --- |
| Status | **CONTROLLED MODEL — ACTIVATION RED UNTIL CHANNELS, HOURS, BACKUPS AND CUSTOMER ROUTES OPERATE** |
| Owner | Harrison Rubin — company-side support/incident primary; backup responders, domain specialists and customer contacts unassigned |
| Evidence date | 2026-10-03 at repository revision `d246a348` |
| Source | [`../commercial/SUPPORT-OPERATIONS.md`](../commercial/SUPPORT-OPERATIONS.md), [`../engineering-operations/ON-CALL-AND-ESCALATION-POLICY.md`](../engineering-operations/ON-CALL-AND-ESCALATION-POLICY.md), and [`../legal-drafts/SUPPORT-AND-ESCALATION-POLICY-DRAFT.md`](../legal-drafts/SUPPORT-AND-ESCALATION-POLICY-DRAFT.md) |

## Service boundary

Institutional support requires distinct routes for student/product help, authorized operator requests, accessibility barriers, privacy/data rights, security reports, safety concerns, billing and contractual matters. Each route needs an approved channel, staffed hours, named primary/backup, intake authority, escalation path, communication authority, data-access boundary, retention rule and tested handoff.

The current model does not establish 24/7 coverage, contractual acknowledgement or resolution times, dedicated customer success, a production queue, or institution-approved escalation.

## Triage and escalation matrix

| Internal class | Trigger | Immediate action | Required escalation | Exit evidence |
| --- | --- | --- | --- | --- |
| P0 | suspected cross-tenant/security/privacy exposure, destructive integrity loss, unsafe official write, immediate safety/rights threat | contain under authorized incident controls; preserve evidence; stop affected path | incident command, security/privacy, engineering, authorized customer/legal communication | containment verified, scope assessed, recovery accepted, communications/decisions recorded |
| P1 | core approved workflow unavailable without safe workaround; major accessibility barrier; material data/reliability risk | mitigate, pause/rollback or provide verified safe workaround | engineering/operations, accessibility or domain owner, customer technical contact | service/workaround validated, backlog/risk owner assigned |
| P2 | material impairment with safe workaround or limited cohort impact | triage in staffed hours; assign owner and update expectation | product/engineering/domain owner as needed | resolution/customer confirmation or accepted known limitation |
| P3 | question, guidance or minor defect | answer or route within published scope | normal product/knowledge workflow | answer/resolution and learning captured |

These classes are internal routing controls, not promised clocks. Security/privacy, accessibility, safety, billing, academic-record and legal matters must not be closed as ordinary product support.

## Operating procedure

1. Verify channel, requester identity/authority, tenant, environment and supported scope.
2. Record blocked task, impact/cohort, time, route/device, correlation/error and consented diagnostics; never request passwords, tokens, signing material or unnecessary student content.
3. Classify impact and route to the named primary/backup; activate incident procedure when thresholds are met.
4. Use support access only when specifically authorized, minimum-scope, time-bound and audited; revoke it at closure.
5. Communicate only verified facts, safe workarounds, owner and next update within approved authority. Do not give authoritative academic, legal, medical or financial advice.
6. Escalate unowned, repeated, aging, cohort-wide, safety-sensitive or monitoring-blind cases and any missed approved communication.
7. Close with cause/resolution, affected scope, validation, access revocation, customer/user confirmation where appropriate, known limitation/problem link and follow-up.

## Activation record

Record channels and accessibility alternatives; hours/time zone/holidays; primary/backups and coverage calendar; customer sponsor/technical/security/privacy/accessibility contacts; severity and escalation ladder; approved targets if any; queue/alert routing; diagnostic access; retention/hold; incident/status communication; knowledge/runbooks; training; exercise results; reporting/suppression; exceptions; customer acceptance and review date.

## Evidence state

**Repository evidence.** Intake surfaces, support/access controls, severity/runbook language, incident/communication procedures and selected escalation evidence exist.

**Operational evidence.** No accepted production queue, approved staffed hours, resilient backup rota, monitored end-to-end channels, customer contacts, sustained case history, measured response performance or customer sign-off is evidenced.

**Missing test/proof.** Assign/train owners and backups; configure/test every route; run intake-to-access-to-escalation-to-closure exercises including P0/P1; validate accessible communication and reporting; obtain customer acceptance.

## Claim ceiling

Semester may describe this proposed model and identify Harrison Rubin as the current company-side accountable primary.

## Prohibited claims

Do not claim staffed institutional support, 24/7 coverage, guaranteed response/resolution, dedicated success management, live incident readiness, operated accessibility support, SLA performance or customer-approved escalation without matching evidence.
