# Support documentation

> **Type:** reference · **Audience:** students, support · **Owner:** `success` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/support.test.ts`

This is the index of problem-shaped help articles and the internal triage pages behind them; stop reading if you want to learn how a feature works, because the how-to pages are written separately and these pages start from what went wrong.

**Status:** PARTIAL. The help articles are LIVE as written for the features they describe. Support operations are not staffed beyond one person acting in several seats, and no response time is committed. See [Staffing today](#staffing-today).

## Help articles

Each article has the same five parts: Symptom, Check, Fix, Not your fault, Contact. Each says what to send and what not to send, and links the status page and the known limits.

| Article | You say | Feature status |
| --- | --- | --- |
| [I can't sign in](articles/cannot-sign-in.md) | "I can't sign in", "no email came", "invite-only" | LIVE where an account service exists |
| [My syllabus didn't parse, or the dates look wrong](articles/syllabus-did-not-parse.md) | "Nothing happened", "wrong date" | PARTIAL |
| [My calendar isn't updating](articles/calendar-not-updating.md) | "It hasn't changed", "duplicates" | LIVE for calendars you add yourself |
| [The app shows an old version](articles/old-version-showing.md) | "Reload to pick up the new version" | LIVE |
| [Sync says it's waiting, or two devices disagree](articles/sync-waiting-or-conflict.md) | "Queued", "Conflict", "different on my laptop" | LIVE for signed-in accounts |
| [I deleted something and it came back](articles/deleted-item-came-back.md) | "It's back", "I need it back" | PARTIAL |
| [The assistant is unavailable, or says it can't help](articles/ai-unavailable.md) | "Switched off", "monthly limit" | PARTIAL; shared key BLOCKED |
| [Billing: upgrade, cancel, receipts](articles/billing.md) | "How do I upgrade", "what is this charge" | IMPLEMENTED_NOT_RELEASED for new purchases |
| [Delete my account, or export my data](articles/delete-account-export-data.md) | "Delete my account", "give me my data" | LIVE where an account service exists |
| [My school's connection is failing](articles/school-connection-failing.md) | "My school's data isn't there" | PARTIAL; no institution connected |
| [I want to flag something unsafe](articles/safety-concern.md) | "Someone could be hurt", "unsafe post" | IMPLEMENTED_NOT_RELEASED |
| [Accessibility help](articles/accessibility-help.md) | "Text too small", "can't use a screen reader" | PARTIAL |

Statuses use the vocabulary of the [feature truth table](../FEATURE-TRUTH-TABLE.md). The table is a static reading dated 30 September 2026. Where code is newer, the article follows the code.

## Internal pages

For the person answering. Students can read them; they are not written for students.

| Page | Use it to |
| --- | --- |
| [Triage guide](internal/triage-guide.md) | Get from a first message to an article, macro or escalation |
| [Severity and routing](internal/severity-and-routing.md) | Classify a report, and see which seat owns it and who holds the seat |
| [Macro library](internal/macro-library.md) | Send one of twelve replies that claim only what is backed |
| [Escalation map](internal/escalation-map.md) | Send a case to the security, privacy, safety, accessibility, data or finance route |
| [What a supporter may see](internal/supporter-access.md) | Know what data you can reach, and how a student opens a bounded window |

## Staffing today

The council register in `app/src/lib/launchreadiness.ts` is the source. A test compares the table in [severity and routing](internal/severity-and-routing.md) to it.

- **The support seat (`success`) is held by "Founder, acting".** So are product, engineering, accessibility and operations. One person is in all of them.
- **Security, Trust and Safety, data, finance and the institution champion have no holder.** Privacy is held by outside counsel.
- **There is no backup, no rota, no paging test, no stated hours and no phone or chat channel.** The [on-call policy](../engineering-operations/ON-CALL-AND-ESCALATION-POLICY.md) and the [production support runbook](../engineering-operations/PRODUCTION-SUPPORT-RUNBOOK.md) say so.
- **No response time is committed.** Not for a student, a ticket or an institution. The public-claims register prohibits claiming one ([CLM-016](../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md)).

What this means for expectations:

- A message may wait. Say so and do not apologise with a number.
- An escalation goes to the same person. Say that when it matters.
- An outage or a safety report has no staffed watch. The status page is checked from the reader's own browser; nobody is paged by it.
- In-app support tickets are built and off by default. The ticket panel's first-response targets are targets with no owner ([reliability register, SLO-5](../SUPPORT-RELIABILITY-AND-ABUSE-PREVENTION.md)).
- A school that adopts Semester gets support terms from its agreement. None is in force today ([support policy draft](../legal/SUPPORT-POLICY-DRAFT.md)).

## Where help lives in the product

| Place | What it is |
| --- | --- |
| Help (labelled "How this works") | The guide, known limits, the status page link, and the ticket panel where it is on |
| Settings, About, "Saying something is wrong" | A message to the person who builds the app, with the screen you were on |
| Support | A map of campus offices. Semester points to them; they answer |
| Get help | A request to a campus office, only where a school has configured one. Off in production |
| Recovery | What is waiting to sync, and how to get back what went missing |
| Privacy and your rights | Export, delete, support access windows, what your school shares |

## Status and known limits

- [Status page source](../../app/public/status.html). Up means your browser reached the service just now. It lists incidents written by hand in `app/public/status-incidents.json`.
- The live app is at https://harrisonjrubin7-cmyk.github.io/semester/ and the status page is `status.html` under it.
- [Known limits](../pilot/KNOWN-LIMITATIONS.md), written for pilot users.
- [Degraded modes](../DEGRADED-MODE-MAP.md): what still works when something stops.

## What holds these pages

`app/src/lib/docs/support.test.ts` checks that every page has a valid card, that every article has the five sections and the send and not-send lists, that every interface string quoted in an article's `labels` comment exists in the app or function source, that every internal link resolves, that every document a macro cites exists, that macros make no banned claim, and that the staffing table matches the seat register.

Other documentation in `docs/` owns how-to help, security and privacy reports, and the operating runbooks. These pages link to them and do not restate them.
