# Hypercare support model and handoff to steady state

| Control | Value |
| --- | --- |
| Status | **CONTROLLED MODEL — NO STAFFED ROTA, NO CHANNEL, NO HYPERCARE HAS BEEN RUN** |
| Owner | Support lead seat; backup unassigned |
| Evidence date | 2026-10-04 at `origin/main` `7287ddc` |
| Used in | [phase 9 (hypercare)](METHODOLOGY.md#phase-9--hypercare) and the entry to [phase 10](METHODOLOGY.md#phase-10--optimize) |
| Builds on | [`../commercial/SUPPORT-OPERATIONS.md`](../commercial/SUPPORT-OPERATIONS.md), [`../market-readiness/PILOT-SUPPORT-RUNBOOK.md`](../market-readiness/PILOT-SUPPORT-RUNBOOK.md), [`../LAUNCH-WAR-ROOM.md`](../LAUNCH-WAR-ROOM.md), [`../trust/INCIDENT-RESPONSE-PLAN.md`](../trust/INCIDENT-RESPONSE-PLAN.md), [`../trust/SLA.md`](../trust/SLA.md) |

Hypercare is the first weeks after go-live, staffed as if something will break.
It is bounded by **evidence**, not a number of days, and it ends in a handoff so
that steady-state support can run without the people who built the launch.

## What this model does not promise

Support today has no approved dedicated channels or hours, no trained backup
rota, no tested alert-to-ticket path, and no measured response performance, and
the uptime SLA is `NOT_STARTED` as a commitment. So: **every target below is an
internal objective, proposed and unapproved, and is never published to a
customer as a response or resolution time** unless the executed SLA says so.
Support does not give academic, legal, medical or financial advice, and never
claims 24/7 coverage that is not staffed and tested.

## 1. Entry criteria (all required)

1. Signed go-live record; rollout `production_limited`.
2. A rota with a **primary and a backup on every covered shift**, each with a
   passed support-seat readiness record ([`TRAINING-PLAN-AND-ACADEMY.md`](TRAINING-PLAN-AND-ACADEMY.md)).
3. Channels live and tested end to end: student route, operator/administrator
   route, and the incident route (alert → named person → ticket).
4. Customer help desk contacts, with backups, in the stakeholder map.
5. The known-issues list and limitations page published and agreed.
6. Dashboards in place for the telemetry below.
7. The rollback and kill-switch runbooks rehearsed within 14 days.

## 2. Coverage and channels

| Item | Rule |
| --- | --- |
| Hours | The hours the order and approved support plan state — and only those. Outside them, the page says so and where emergencies go. |
| Student route | In-product help and a support request with consented diagnostics; the school's help desk is first line for its students. |
| Operator route | A named channel for the school's administrators and IT, with identity and tenant verified before any account discussion. |
| Incident route | Alert to a named person; P0/P1 pages the rota; the school's incident contact is told per the routing document. |
| War-room cadence | Daily 15-minute stand-up (IL, SL, IE, champion): open incidents, open changes, queue, yesterday's measures, anything blocking. |
| Seat cover | Every shift names primary and backup; a vacant seat is shown as unowned, never silently covered by whoever is awake. |

## 3. Severity and handling

Severity is by **harm**, as the canonical on-call policy defines it (these are
internal classifications, not promised clocks):

| Class | Meaning | Handling |
| --- | --- | --- |
| P0 | active security, privacy, cross-tenant, data-integrity, safety or rights threat | page now; incident commander named; consider L0–L3 rollback; customer and counsel informed per plan |
| P1 | core workflow unavailable, major accessibility barrier, or serious integrity/reliability risk — even with a temporary workaround | page; owner and next-update time recorded; escalate if unresolved at the next stand-up |
| P2 | other material impairment | queue with owner and date; reviewed at stand-up |
| P3 | question or minor issue | queue; answered in order; themes reviewed weekly |

**Proposed internal objectives (unapproved; for calibration, not for contract)**

| Class | First human acknowledgement | Next-update cadence while open |
| --- | --- | --- |
| P0 | within the covered hours: immediate | every 30 minutes |
| P1 | within the covered hours: 1 hour | every 2 hours |
| P2 | 1 business day | daily |
| P3 | 2 business days | on resolution |

**The handling loop** (from the support operations playbook): verify channel,
identity, tenant and authority → record the blocked task, route, device,
correlation id, impact and consented diagnostics (never passwords, tokens,
unnecessary course content or sensitive categories, or record screenshots) →
classify → route security, privacy, rights, accessibility, safety, billing,
legal, academic-deadline and incident matters to named owners → give a verified
workaround only within approved scope → use time-limited, least-privilege,
consented, audited access and revoke it at close → close with resolution,
scope, communication, access revocation, confirmation, known-issue link and
follow-up owner.

**Escalation triggers into incident or problem management:** any P0/P1;
repeated cohort impact; an unsafe workaround; data loss; a monitoring blind
spot; a missed update; an unowned case.

## 4. Change control during hypercare

Freeze: only fixes, each with a maker and a checker, a rollback path and a
decision-register row. No new scope, new integration, new cohort or
configuration change that is not a fix. Release notes for any fix tell the
champion before the school's users.

## 5. What is watched

| Signal | Source | Action threshold (agree in the cutover plan) |
| --- | --- | --- |
| Sign-in success for the cohort | auth and gateway telemetry | below the agreed share |
| Core-flow success and error rate | production probes and application telemetry | above the agreed rate |
| Integration freshness and sync errors | integration dashboard | beyond the agreed target |
| Reconciliation drift (rolling) | migration `monitoring` runs; roster reconcile | any unexplained difference |
| Support queue: volume, age, unresolved P0/P1 | ticket queue | ageing past the agreed bound |
| Accessibility barriers reported | help and support themes | any critical-path barrier |
| Rights requests (access, export, deletion) | rights runbook queue | any past its legal clock — counsel decides what the clock is |
| Student-facing communications | champion | any confusion theme repeated |

Missing telemetry is reported as **unavailable**, not as healthy.

## 6. Exit criteria (evidence, not elapsed days)

Hypercare ends only when all hold; the proposed minimum length is 14 days and
the maximum before a formal extension decision is 30. A tenant that has had a P0
cannot exit until the root-cause record is accepted.

1. No open P0 or P1; no P2 older than the agreed bound.
2. At least 10 consecutive business days with no P0/P1.
3. Queue volume and ageing stable or falling for two consecutive weeks.
4. Reconciliation clean for the monitoring checks the migration plan listed.
5. Integrations `healthy` against the agreed targets for the period.
6. Every known issue has an owner, a date and a workaround or a decision to accept it.
7. The customer help desk handled at least its routine contacts without Semester
   intervention (a scripted check, not a count of tickets).
8. The backup operator on the rota handled a real or simulated case unaided.
9. Customer sponsor acceptance in writing.

If not met: extend once, with new dates, owners and a reason recorded; if the
second review also fails, the executive sponsors decide between continued
hypercare, narrowing scope (a rollout `paused` with a recovery plan) or stopping.

## 7. Handoff packet to steady-state support

Filed by the support lead and accepted by the steady-state owner (named seat, not
the author). The packet is the whole transfer; nothing lives only in a person's
memory.

| Item | Content |
| --- | --- |
| Account record | contacts and seats (primary and backup, both sides); stakeholder map; success plan; contracts and entitlements |
| Configuration | signed baseline and current readback; change register since go-live |
| Integrations | the integration workbook, current state, credential references and rotation dates |
| Migration | the migration record, evidence, archive location, monitoring results |
| Runbooks | the exact runbooks and rehearsal dates for this tenant |
| Known issues | list with owner, workaround, status |
| Incident history | incidents, root causes, actions and their completion |
| Support baseline | volume by theme, ageing and the unresolved list (aggregate; thresholded) |
| Health baseline | first health review and any Amber/Red items |
| Open decisions | the register, with dates |
| Calendar | first EBR, renewal dates (120/90/60/30), access-review and credential-rotation dates, critical academic windows |

## 8. Steady-state support (after handoff)

| Aspect | Rule |
| --- | --- |
| Ownership | The support lead seat owns the queue; the CSM owns the relationship; engineering owns defects; each has a backup. |
| First line | The school's help desk for its users; Semester's support for operators and for escalations. |
| Cadence | weekly queue review; monthly working session; quarterly EBR; incident reviews as needed |
| Reporting | aggregate, thresholded, excludes sensitive content; recurring friction goes to the product loop, not onto individual users |
| Access | support access is time-limited, least-privilege, consented or authorized, audited and revoked at closure |
| Reviews | grants reviewed on the dates in the calendar; credentials rotated on schedule |
| Improvement | every incident ends with a recorded cause and a tested prevention before the problem is closed |

Stored stage after handoff: `measure`; the operator records the `expansion_decision` evidence and moves rollout from `production_limited` to `production_active`.

## Evidence state

**Repository evidence.** Support ticket and access controls, severity and runbook
language, incident and communication templates, the launch war-room board and
the hourly production probe exist.

**Operational evidence.** No staffed rota, no tested alert-to-ticket path, no
queue record, no measured response, no customer help desk contact.

**Missing test/proof.** A staffed and tested rota with backups; an
alert-to-ticket test; one hypercare run end to end with a second person
shadowing; the first accepted handoff packet.

## Claim ceiling

Semester may describe this as its proposed hypercare and handoff model.

## Prohibited claims

Do not claim staffed support, 24/7 coverage, response or resolution times, an
uptime SLA, or that any hypercare or handoff has occurred.
