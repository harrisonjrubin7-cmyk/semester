# Triage guide

> **Type:** runbook · **Audience:** support · **Owner:** `success` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/support.test.ts`

Use this page to take a first message from a student and get to the right article, macro or escalation in a few questions; stop reading if you already know the route, which is in [severity and routing](severity-and-routing.md).

**Status:** PARTIAL. The tree works on documents that exist. Nobody is staffed against it beyond the founder acting in the success seat. Tell people so.

## Before you answer

1. **Say what is true about response time.** There is no committed response time. Use the closing line in the [macro library](macro-library.md).
2. **Never ask for a secret.** No passwords, reset links, one-time codes, API keys, calendar links, card numbers, student ID numbers or export files.
3. **You cannot see the student's semester.** The default is no access. See [what a supporter may see](supporter-access.md).
4. **Do not give academic, legal, medical or financial advice.** Do not change an official record, register anyone, or reset another person's account.
5. **Do not call anything "secure", "compliant" or "certified".** Say what the app does and where the evidence is.

## The tree

Work down. Stop at the first question you answer yes to.

1. **Could someone be hurt, or is the person describing danger to themselves or others?** Use the macro for safety (M12). Escalate as P0 on the [escalation map](escalation-map.md). Do nothing else first.
2. **Can a person read data that is not theirs, or is a key or credential out?** P0. Stop the conversation, do not test it yourself, escalate as the map says.
3. **Is it a request about data rights (export, deletion, who sees my data)?** Use [delete or export](../articles/delete-account-export-data.md) and macro M09. If the app cannot do it, escalate to the privacy route.
4. **Is it an accessibility barrier?** Use [accessibility help](../articles/accessibility-help.md) and macro M11. A barrier that blocks the task is P1.
5. **Is it about a charge, a refund or cancelling?** Use [billing](../articles/billing.md) and macro M08. Never promise a refund.
6. **Is the whole service affected?** Many reports in a short time, or the status page shows it. Check the [status page source](../../../app/public/status.html) and its incident list (`app/public/status-incidents.json`). Treat it as an incident under the [incident recovery playbook](../../INCIDENT-RECOVERY-PLAYBOOK.md). Answer with the facts you have, not a guess about cause.
7. **Otherwise match the symptom to an article** in the table below, send the macro, and close.
8. **Nothing matches.** Ask the three questions under "If it matches nothing", then escalate as P3 to the success seat.

## Symptom to article

| The person says | Article | Macro | Usual severity |
| --- | --- | --- | --- |
| "I can't sign in", "no email came", "invite-only" | [cannot-sign-in](../articles/cannot-sign-in.md) | M01 | P2 or P3 |
| "My syllabus didn't work", "wrong date" | [syllabus-did-not-parse](../articles/syllabus-did-not-parse.md) | M02 | P3 |
| "My calendar isn't updating", "duplicates in Google" | [calendar-not-updating](../articles/calendar-not-updating.md) | M03 | P3 |
| "It looks old", "reload to pick up the new version" | [old-version-showing](../articles/old-version-showing.md) | M04 | P3 |
| "Queued", "conflict", "my phone and laptop differ" | [sync-waiting-or-conflict](../articles/sync-waiting-or-conflict.md) | M05 | P2 |
| "I deleted it and it came back" | [deleted-item-came-back](../articles/deleted-item-came-back.md) | M06 | P3 |
| "The assistant is off", "monthly limit", "won't answer" | [ai-unavailable](../articles/ai-unavailable.md) | M07 | P2 |
| "How do I upgrade or cancel", "what is this charge" | [billing](../articles/billing.md) | M08 | P2 |
| "Delete my account", "give me my data" | [delete-account-export-data](../articles/delete-account-export-data.md) | M09 | P2 |
| "My school's data isn't showing" | [school-connection-failing](../articles/school-connection-failing.md) | M10 | P2 |
| "I can't use this with my screen reader" | [accessibility-help](../articles/accessibility-help.md) | M11 | P1 if blocking |
| "Someone posted something unsafe" | [safety-concern](../articles/safety-concern.md) | M12 | P0 |

## Questions that settle most cases

Ask only what you need, and ask for the least.

1. **What did you see, in the words on the screen?** The exact message usually names the case. Each article lists its messages.
2. **What did you press, and on which screen?**
3. **Is anyone else affected, or only you?** More than one person changes the case from a question to an incident.
4. **Are you signed in, and on which device?** Sync and sign-in cases turn on this.

## If it matches nothing

Ask: what were you trying to do, what happened, and what did you expect. Ask for the Reference (SEM-0000) if the screen shows one. Do not ask for logs. If you still cannot place it, record the facts and escalate it as P3 to the success seat. Offer the person [known limits](../../pilot/KNOWN-LIMITATIONS.md), which may already say it.

## Recording a case

Record, without copying private content: the issue, who it affects, the diagnostics the person chose to share, the classification, the owner, what you told them, the workaround, the resolution, and the known-issue link ([support operations model](../../market-readiness/SUPPORT-OPERATIONS.md)). Close with the resolution and what you did and did not promise.

## Support channels today

- The in-app **Settings**, then **About**, then "Saying something is wrong" form, for signed-in accounts. It goes to the person who builds the app.
- The support address shown there, for people who are not signed in.
- In-app support tickets are built and off by default. Do not tell a student a ticket panel exists unless they can see it.
- Campus questions go to the campus office through **Get help**, only where that feature is switched on and an office is configured. It is off in production today ([human help](../../market-readiness/HUMAN_HELP.md)).

No other channel is documented: no phone, no chat, no stated hours.
