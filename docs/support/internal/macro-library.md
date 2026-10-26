# Macro library

> **Type:** runbook · **Audience:** support · **Owner:** `success` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/support.test.ts`

Use this page for canned replies to the twelve most common cases, written to claim only what the repository can back; stop reading if the case is a safety, security or data-rights matter you have not yet routed, because the [escalation map](escalation-map.md) comes first.

**Status:** PARTIAL. The wording is ready. Nobody is staffed to send it at any stated pace, so every reply says there is no committed response time where timing comes up.

## Claim discipline

Every reply is held by a test. The quoted text of each macro must not contain:

- A response time or hours ("within a day", "24/7", "as soon as possible", "immediately", "shortly").
- An outcome promise ("we will fix it", "I will refund", "guaranteed", "never lost").
- An assurance of safety or assurance status ("safe", "secure", "encrypted", "compliant", "certified", "SOC 2", "HECVAT", "VPAT", "WCAG", "FERPA", "COPPA", "GDPR", "uptime", "SLA").
- A claim to replace a school's system.

Where the truth is "no committed response time", say exactly that. The sources are the [service level expectations](../../market-readiness/SERVICE-LEVEL-EXPECTATIONS.md), the [public claims register](../../../PUBLIC-CLAIMS-APPROVAL-REGISTER.md) (CLM-016) and the [support operations model](../../market-readiness/SUPPORT-OPERATIONS.md). The in-app ticket panel shows first-response targets when tickets are on; they are targets, not commitments, so do not quote them in a reply.

How to use a macro:

1. Replace `{name}` and `{reference}` and delete any bullet that does not apply.
2. Read the reply against the person's actual message. Add one line that answers what they asked.
3. Do not add a time, a promise or a reassurance that is not in the macro.
4. Keep the closing line.

Closing line used in every reply that could be read as promising a reply: "I can't promise when I can reply. There is no committed response time for Semester support."

### M01 — I can't sign in

**Use when:** sign-in fails, no email arrived, the account is invite-only, or a reset is needed. **Article:** [I can't sign in](../articles/cannot-sign-in.md).

> Hi {name}, thanks for writing about signing in.
>
> - You do not need an account to use Semester. Everything works on your device without one.
> - To reset a password, open Account, type your email address and press "Send a reset link". The app gives the same answer whether or not the address has an account.
> - If you made an account and no confirmation email came, check spam. Then come back to Semester and try signing in anyway, because the confirmation may have worked.
> - If it says Semester is invite-only, try the address your invitation was sent to.
>
> Please do not send me a password or any link from an email. If this does not help, send me the exact words on the screen and the Reference if one is shown (it looks like SEM-0000).
>
> I can't promise when I can reply. There is no committed response time for Semester support.

<!-- macro: id=M01; articles=cannot-sign-in; docs=docs/DEGRADED-MODE-MAP.md -->

### M02 — My syllabus didn't parse, or a date is wrong

**Use when:** Add a course fails, or a date is missing or wrong. **Article:** [Syllabus did not parse](../articles/syllabus-did-not-parse.md).

> Hi {name}, thanks for the detail on your syllabus.
>
> - Open Add a course and read the message on the screen. "Nothing readable came out of that" can mean a file with no selectable text, such as a scan. Photograph the pages or paste the text instead.
> - Before you add the course, check The dates it found against your syllabus. You can change a title or date with "Edit title or date", and check the year if your syllabus gave none.
> - If you only want the course in your plan, "Add it by hand" needs no document reading.
>
> The official source for a deadline is your syllabus and your school's own system. Semester shows the dates you gave it.
>
> I can't promise when I can reply. There is no committed response time for Semester support.

<!-- macro: id=M02; articles=syllabus-did-not-parse; docs=docs/pilot/KNOWN-LIMITATIONS.md -->

### M03 — My calendar isn't updating

**Use when:** a subscribed calendar looks old, a link is refused, or items are duplicated. **Article:** [Calendar isn't updating](../articles/calendar-not-updating.md).

> Hi {name}, here is how calendars work in Semester.
>
> - Open Connect accounts and look at Connected calendars. Each row says when it was last read. A subscribed calendar is read when you add it and when you press REFRESH on its row.
> - If you are told the address is a web page, you have the page link and not the calendar feed. Use the .ics or webcal link from your calendar service, or download the file and use "Add an .ics file".
> - The buttons that send deadlines to Google or Microsoft add items and do not sync. Running one twice makes duplicates, which you remove in that calendar.
>
> Please do not send me your calendar link. It carries your access. Tell me which service it came from instead.
>
> I can't promise when I can reply. There is no committed response time for Semester support.

<!-- macro: id=M03; articles=calendar-not-updating; docs=docs/pilot/KNOWN-LIMITATIONS.md -->

### M04 — The app shows an old version

**Use when:** a fix is missing, a reload message appears, or a screen will not open offline. **Article:** [The app shows an old version](../articles/old-version-showing.md).

> Hi {name}, this usually means your copy of the app is older than the latest one.
>
> - If you see "A newer version of the app is ready.", press Reload. The app never reloads by itself, so it does not interrupt what you are writing.
> - If a screen says "Reload to pick up the new version.", press Reload. Nothing is lost.
> - If it still looks old, close the tab or the installed app and open it again.
> - Please do not clear your browser's site data until you have downloaded your data from Take it with you. Clearing it removes the copy on this device.
>
> If it persists, tell me the heading you saw word for word, your browser and whether you use a tab or the installed app.
>
> I can't promise when I can reply. There is no committed response time for Semester support.

<!-- macro: id=M04; articles=old-version-showing; docs=docs/DEGRADED-MODE-MAP.md -->

### M05 — Sync says queued, conflict or review

**Use when:** Account shows a waiting, conflict or review state, or devices differ. **Article:** [Sync is waiting](../articles/sync-waiting-or-conflict.md).

> Hi {name}, here is what the sync words mean.
>
> - Queued or Offline means your changes are saved on this device and go up when the connection returns. You do not need to do anything.
> - Review means something was changed on two devices before either synced. Both versions are saved on this device. Open Account, find Choose a version, and press Keep this one on the one you want.
> - Press Check now on Account to ask for the latest. Files you attach stay on the device that has them and do not sync.
>
> Please do not erase your device before your changes have reached your account.
>
> I can't promise when I can reply. There is no committed response time for Semester support.

<!-- macro: id=M05; articles=sync-waiting-or-conflict; docs=docs/OFFLINE-MODE.md -->

### M06 — I deleted something and it came back

**Use when:** a deleted item reappears on another device, or an item cannot be deleted. **Article:** [I deleted something and it came back](../articles/deleted-item-came-back.md).

> Hi {name}, this is a known limit and not something you did wrong.
>
> - Deleting a course, note, action, appointment, document, sheet or deck on one device deletes it on the others once they sync. Other lists, such as folders, equations and places, do not carry a deletion yet, so an item can come back from another device. Delete it again.
> - If you wanted something back, press Undo while it is shown. The app also keeps copies of your whole workspace on this device for up to seven days. Open Take it with you to see what going back would change before you do it.
> - A course you removed comes back by importing its syllabus again.
>
> I can't promise when I can reply. There is no committed response time for Semester support.

<!-- macro: id=M06; articles=deleted-item-came-back; docs=docs/RECOVERY-CENTER.md -->

### M07 — The assistant is unavailable or won't answer

**Use when:** Ask Semester refuses, is off, or says it cannot help with an assessment. **Article:** [The assistant is unavailable](../articles/ai-unavailable.md).

> Hi {name}, thanks for telling me what the assistant said.
>
> - "AI generation is switched off right now" means a switch is on. Everything else in Semester still works and nothing you typed has been lost.
> - "The shared key is switched off" means the shared key is not active. You can add your own key in Settings, under Semester Intelligence.
> - The assistant will not produce answers for an assessment. It can help you plan the work, practise on similar problems and prepare questions for your instructor.
> - If an answer says "No source", check a date or rule against your syllabus or the official record before you act on it.
>
> Please do not send me your API key.
>
> I can't promise when I can reply. There is no committed response time for Semester support.

<!-- macro: id=M07; articles=ai-unavailable; docs=docs/trust/AI-INCIDENT-AND-KILL-SWITCH-RUNBOOK.md -->

### M08 — Billing: plan, cancel, receipt, unfamiliar charge

**Use when:** a student asks about Plus, cancelling, receipts, or a charge. **Article:** [Billing](../articles/billing.md).

> Hi {name}, here is what I can tell you about billing.
>
> - Plus and Pro are not on sale in this build, and during the pilot every feature a student can use is free.
> - If you have a Plus subscription: open Account, then Membership, press Cancel membership and then Cancel Plus. Plus stops at the end of the period you have paid for.
> - For receipts and invoices, press "Receipts, invoices and payment method" in Membership. It opens Stripe's billing page. Semester holds no card or bank details.
> - If you see a charge you do not recognise, send me the date and the receipt number from Stripe's email. I can't promise a refund. The refund and cancellation policy sets the terms.
>
> Please do not send a card number, a CVC or a bank login.
>
> I can't promise when I can reply. There is no committed response time for Semester support.

<!-- macro: id=M08; articles=billing; docs=docs/legal/REFUND-AND-CANCELLATION-POLICY-DRAFT.md -->

### M09 — Export or delete my data

**Use when:** a student wants a copy of their data or their account removed. **Article:** [Delete my account, or export my data](../articles/delete-account-export-data.md).

> Hi {name}, you can do both yourself in the app.
>
> - Open Privacy and your rights. "Download my account data" saves what the server holds about your account as one file. "Take it with you" saves your records as files you can open elsewhere.
> - "Delete my account" removes your account and its data from the server. If the answer says it could not tell whether anything was deleted, press it again. The answer says what is left. Deleting an account cannot be undone from the app.
> - Your device keeps its own copy. "Erase from this device" removes that.
>
> Some records stay by design, such as a report you filed about someone else or your school's own record of you. The Privacy screen lists each one with the reason.
>
> Please do not send me an export file or a government ID.
>
> I can't promise when I can reply. There is no committed response time for Semester support.

<!-- macro: id=M09; articles=delete-account-export-data; docs=docs/DATA-RIGHTS-REQUEST-RUNBOOK.md -->

### M10 — My school's data isn't showing

**Use when:** a student expects school records, a course-site launch or a school calendar. **Article:** [My school's connection is failing](../articles/school-connection-failing.md).

> Hi {name}, thanks for asking about your school's data.
>
> - Semester is not connected to your school's systems today. What it shows came from what you gave it, such as a syllabus, a pasted schedule or a calendar file. Register, drop, pay and submit in your school's own systems, because they are the official record.
> - If you opened Semester from Brightspace and got a second account, sign in to your own account first, then open Connect accounts and press "Connect my existing account".
> - If you run a connection for a school, send me the connection's status and its last successful sync, not any student record.
>
> I can't promise when I can reply. There is no committed response time for Semester support.

<!-- macro: id=M10; articles=school-connection-failing; docs=docs/INTEGRATION-OPERATOR-RUNBOOK.md -->

### M11 — Accessibility barrier

**Use when:** a student reports a barrier or needs a setting. **Article:** [Accessibility help](../articles/accessibility-help.md).

> Hi {name}, thank you for telling me. A barrier is a real problem and I want to record it properly.
>
> - Open Settings. Text size, Movement and Workspace mode are there, and the Accessibility mode turns on larger text, more space and less motion together.
> - To report the barrier, please tell me the screen, what you were trying to do, what happened, and your browser and assistive technology.
> - If this reply does not resolve it, write again with "Accessibility escalation" in the subject and it goes to the accessibility seat.
>
> Semester has no accessibility conformance report, and nobody has yet recorded a manual review by a person using a screen reader. I won't tell you otherwise.
>
> I can't promise when I can reply. There is no committed response time for Semester support.

<!-- macro: id=M11; articles=accessibility-help; docs=docs/legal/ACCESSIBILITY-STATEMENT-DRAFT.md -->

### M12 — Someone could be hurt, or an unsafe post

**Use when:** a student reports danger or an unsafe post. Route to the [escalation map](escalation-map.md) before replying at length. **Article:** [I want to flag something unsafe](../articles/safety-concern.md).

> Hi {name}, thank you for telling me.
>
> If someone is in immediate danger, contact local emergency services or your campus emergency/safety service now. Semester Community is not monitored as an emergency-response service.
>
> If this is about a post in Semester Community, use Report this post on that post. If it is about your own wellbeing, the Support screen in the app shows which campus offices to go to.
>
> I can't promise when I can reply. There is no committed response time for Semester support.

<!-- macro: id=M12; articles=safety-concern; docs=docs/CRISIS-RESPONSE-RUNBOOK.md -->
