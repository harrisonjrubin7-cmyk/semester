# Escalation map

> **Type:** runbook · **Audience:** support, operators · **Owner:** `operations` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/support.test.ts`

Use this page to send a report that support cannot close to the security, privacy, safety, accessibility, data or finance route that owns it; stop reading if the report is a how-to, which the [triage guide](triage-guide.md) closes.

**Status:** PARTIAL. Each route below has a document. Several have no named owner, and none has an exercised hand-off. Where a seat is vacant the page says so.

## How to read this map

- **Route** is where the report goes. **Owner seat** is from the council register; see [severity and routing](severity-and-routing.md) for who holds each seat today.
- "Escalate" means: write down the facts below, hand the case to the route, and tell the person what you did and that no response time is committed. It does not mean a team is waiting.
- Record what happened without copying the student's private content into the case. Facts only: time, screen, what was seen, how many people.

## Routes

| Situation | Severity | Route | Owner seat (holder) | Documents |
| --- | --- | --- | --- | --- |
| Someone could be hurt, or a post raises a safety concern | P0 | Emergency services and the campus safety service first. Then the professional Trust & Safety route. | `trust` (vacant) | [Crisis response runbook](../../CRISIS-RESPONSE-RUNBOOK.md), [campus escalation policy](../../CAMPUS-ESCALATION-POLICY.md), [moderation SOP](../../CAMPUS-MODERATION-SOP.md) |
| A person can read another person's data, or a key or credential is out | P0 | The security route in SECURITY.md. Contain first, understand after. | `security` (vacant in the register) | [SECURITY.md](../../../SECURITY.md), [security incident runbook](../../trust/SECURITY-INCIDENT-RUNBOOK.md), [incident recovery playbook](../../INCIDENT-RECOVERY-PLAYBOOK.md) |
| Export, deletion, correction or "who sees my data" the app cannot do | P2, or P0 if an exposure | Privacy route, through the founder to counsel | `privacy` (Outside counsel) | [Data rights request runbook](../../DATA-RIGHTS-REQUEST-RUNBOOK.md), [data subject request runbook](../../trust/DATA-SUBJECT-REQUEST-RUNBOOK.md), [retention, export and deletion](../../DATA-RETENTION-EXPORT-DELETION.md) |
| An accessibility barrier blocks a task | P1 | Accessibility route. "Accessibility escalation" in the subject reaches the accessibility seat. | `accessibility` (Founder, acting) | [Accessibility help](../articles/accessibility-help.md), [accessibility statement draft](../../legal/ACCESSIBILITY-STATEMENT-DRAFT.md) |
| AI misbehaves, leaks, or must be stopped | P0 or P2 | AI kill switch (`kill.ai_generation`) and the AI incident runbook | `engineering` (Founder, acting) | [AI incident and kill-switch runbook](../../trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md) |
| A school connection is stale, failing or must be stopped | P2, or P1 if broad | Integration operator route: pause, replay, kill switch | `data` (vacant) | [Integration operator runbook](../../INTEGRATION-OPERATOR-RUNBOOK.md) |
| The service is down, a deploy is bad, or data may need a restore | P1 or SEV1 | Incident command, then rollback or restore | `operations` (Founder, acting) | [Incident recovery playbook](../../INCIDENT-RECOVERY-PLAYBOOK.md), [ROLLBACK.md](../../../ROLLBACK.md), [RESTORE.md](../../../RESTORE.md), [degraded modes](../../DEGRADED-MODE-MAP.md) |
| A charge, refund, dispute or tax question | P2 | Founder | `finance` (vacant) | [Billing](../articles/billing.md), [refund and cancellation policy](../../legal/REFUND-AND-CANCELLATION-POLICY-DRAFT.md) |
| A question for a campus office (registration, aid, housing, advising) | P3 | The office. Semester points to it; it does not answer for it. | the school | [Getting help from a person](../../market-readiness/HUMAN_HELP.md), [support policy draft](../../legal/SUPPORT-POLICY-DRAFT.md) |
| An institution's own incident contact asks | by content | The institution's named contact, once one exists | `champion` (vacant) | [Vanderbilt incident routing](../../vanderbilt/incident-routing.md) |

## What to write down

For any escalation:

1. What the person saw, in their words, and the Reference (SEM-0000) or ticket reference (SUP-…) if there is one.
2. When it happened and how many people are affected, if you know.
3. What you told them, and what you did not promise.
4. Which route you used and when.

Do not copy: passwords, tokens, calendar links, API keys, export files, notes, grades, or anyone's record.

## Safety reports

- Quote the notice exactly. It is in the [crisis response runbook](../../CRISIS-RESPONSE-RUNBOOK.md) and in the article [flag something unsafe](../articles/safety-concern.md). Do not rewrite it.
- A crisis-language match is a possible concern for a professional to look at. It is never a diagnosis or a reason for enforcement by itself.
- Escalation to an institution is off by default. It needs a written agreement, two different professionals' approvals and a configured channel ([campus escalation policy](../../CAMPUS-ESCALATION-POLICY.md)). Support does not message a school about a student.
- With the Trust & Safety seat vacant, tell the person the truth: no staffed review is evidenced.

## Security and privacy reports

- Contain before you diagnose. A suspected read of another account's rows is the most serious class until disproven.
- Do not test against other accounts, and do not ask the reporter to.
- Legal conclusions, notices to schools and regulators, and whether something is a breach are for counsel and the founder. Support records facts and routes.
- Never tell a person their data is "safe" or "secure". Say what the app does and where its evidence is.

## What support never does

From the [support policy draft](../../legal/SUPPORT-POLICY-DRAFT.md): change official records at a school, register a student for classes, or reset another person's account. Support does not give academic, legal, medical or financial advice.

## Where operations are not staffed

Support and incident command are one person acting. No backup, rota, paging test or measured response exists ([on-call policy](../../engineering-operations/ON-CALL-AND-ESCALATION-POLICY.md), [production support runbook](../../engineering-operations/PRODUCTION-SUPPORT-RUNBOOK.md)). An escalation therefore goes to the same person. Say that plainly when it matters to the case.
