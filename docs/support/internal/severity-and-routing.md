# Severity and routing

> **Type:** runbook · **Audience:** support, operators · **Owner:** `operations` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/support.test.ts`

Use this page to decide how serious a report is and which seat and document own it; stop reading if you only need the words to send, which are in the [macro library](macro-library.md).

**Status:** PARTIAL. The definitions and routes exist. Staffing, hours and any response clock do not: the seat register shows most seats vacant or held by the founder acting.

## Staffing, in one table

This table is held to the council register in `app/src/lib/launchreadiness.ts` by a test. If a holder changes there, this page fails until it is updated.

<!-- seats -->
| Seat | Holder (register) | What that means for support |
| --- | --- | --- |
| `founder` | Founder | Accepts risk and commitments. Receives anything no other seat can. |
| `product` | Founder, acting | Decides product answers. Same person as several other seats. |
| `engineering` | Founder, acting | Fixes, rollback, restore. |
| `security` | vacant | The register names nobody. [SECURITY.md](../../../SECURITY.md) says the founder is acting in this seat; the register does not record it. Route security reports as that file says. |
| `privacy` | Outside counsel | Legal and privacy questions go to counsel through the founder. Support does not decide them. |
| `accessibility` | Founder, acting | Receives "Accessibility escalation". |
| `success` | Founder, acting | The support seat. Support is held by the founder, acting. |
| `trust` | vacant | Nobody is named for safety reports. See the [escalation map](escalation-map.md). |
| `data` | vacant | Nobody is named for source quality or connector health. |
| `finance` | vacant | Nobody is named for refunds, price or tax. Route to the founder. |
| `operations` | Founder, acting | Incidents, monitoring and support operations. |
| `champion` | vacant | The institution's own seat. No institution holds it yet. |
<!-- /seats -->

What this means:

- **Support is staffed by one person acting in several seats.** There is no backup, no rota and no paging evidence ([on-call policy](../../engineering-operations/ON-CALL-AND-ESCALATION-POLICY.md)).
- **No response time is committed.** Not for students, not for institutions. See the targets section.
- **Safety, security and data have no named owner.** Say so to the person who asks. Do not imply a team behind a mailbox.
- Holding a seat is not the same as signing. The register records holders; it does not record that a seat has accepted any commitment.

## Two vocabularies, one table

The repository uses two severity vocabularies. Support classifies with P0 to P3 ([pilot support runbook](../../market-readiness/PILOT-SUPPORT-RUNBOOK.md), [on-call policy](../../engineering-operations/ON-CALL-AND-ESCALATION-POLICY.md)). Incident command uses SEV1 to SEV4 ([incident recovery playbook](../../INCIDENT-RECOVERY-PLAYBOOK.md)).

| Support | Meaning (from the runbooks) | Nearest SEV | Note |
| --- | --- | --- | --- |
| **P0** | Active security, privacy, cross-tenant, data-integrity, safety or rights threat | SEV1 | A suspected cross-tenant exposure is SEV1 until disproven. |
| **P1** | Core workflow unavailable, major accessibility barrier, or serious integrity or reliability risk, even with a workaround | SEV2 | A total outage is SEV1 in the playbook and P1 here. The two documents do not say how to reconcile that; treat a total outage as an incident and name it SEV1. |
| **P2** | Other material impairment | SEV3 | Degraded or partial service, stale source, a limited AI-quality issue. |
| **P3** | Question or minor issue | SEV4 | Isolated, low impact. |

These are internal classifications by harm. They are not promised clocks.

## Routing

| Signal | Severity | Owner seat | First document | What support does |
| --- | --- | --- | --- | --- |
| Someone could be hurt | P0 | `trust` | [Crisis response runbook](../../CRISIS-RESPONSE-RUNBOOK.md) | Point to emergency services and the campus safety service. Send nothing that diagnoses. Escalate per the [escalation map](escalation-map.md). |
| Rows or files readable by someone else | P0 | `security` | [SECURITY.md](../../../SECURITY.md), [security incident runbook](../../trust/SECURITY-INCIDENT-RUNBOOK.md) | Do not investigate in the thread. Stop, record the time and report, and escalate at once. |
| Data-rights request not doable in the app | P0 or P2 | `privacy` | [Data rights request runbook](../../DATA-RIGHTS-REQUEST-RUNBOOK.md) | Record the request and route. Support does not decide the legal question. |
| Accessibility barrier that blocks the task | P1 | `accessibility` | [Accessibility help](../articles/accessibility-help.md) | Give the settings, take the report, escalate. |
| Sign-in, sync or load fails for many people | P1 | `operations` | [Incident recovery playbook](../../INCIDENT-RECOVERY-PLAYBOOK.md), [ROLLBACK.md](../../../ROLLBACK.md) | Check the [status page](../../../app/public/status.html); open an incident. |
| One person cannot sign in or sync | P2 or P3 | `success` | [Can't sign in](../articles/cannot-sign-in.md), [sync](../articles/sync-waiting-or-conflict.md) | Use the article and macro. |
| AI refuses or is off | P2 | `engineering` | [AI incident and kill-switch runbook](../../trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md) | Match the message to [the article](../articles/ai-unavailable.md). |
| A school connection is stale or failing | P2 | `data` | [Integration operator runbook](../../INTEGRATION-OPERATOR-RUNBOOK.md) | The connector owner acts; support relays counts and states only. |
| Charge or refund question | P2 | `finance` | [Billing](../articles/billing.md), [refund policy](../../legal/REFUND-AND-CANCELLATION-POLICY-DRAFT.md) | Give the cancel path. Do not promise a refund. |
| Restore or rollback of the service | P1 | `operations` | [RESTORE.md](../../../RESTORE.md), [ROLLBACK.md](../../../ROLLBACK.md) | Not a support action. |
| How-to or product question | P3 | `success` | [Support index](../README.md) | Answer from the article. |

## Targets: what exists and what does not

- **Ticket first-response targets.** When in-app tickets are on, the database computes a first-response due time from the category: 24 hours for accessibility and privacy, 72 for the rest. This is a computed target. SLO-5 for it is `UNPROBED`: nothing reads the overdue flag on a schedule and nobody owns the queue ([reliability register](../../SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md)). Tickets are off by default.
- **Incident notices.** The incident-communications tool requires a next-update time and sets a maximum gap per audience ([incident communications](../../operating-model/INCIDENT-COMMUNICATIONS.md)). That is a rule on the notice, not a staffed promise.
- **Everything else.** No contractual SLA, uptime figure, support hours, RTO or RPO is approved ([service level expectations](../../market-readiness/SERVICE-LEVEL-EXPECTATIONS.md)). The [public claims register](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) prohibits claiming uptime, RTO or RPO, response time or 24/7 support today (CLM-016).

When a person asks "how long will it take", the true answer is: there is no committed response time.

## Incident roles

Incident owners are unassigned. Every role defaults to the founder. The Vanderbilt routing table lists every owner as unassigned ([incident routing](../../vanderbilt/incident-routing.md)). Do not quote its acknowledgement times as commitments; they are proposals.
