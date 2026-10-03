# Known limitations — for pilot users

<!-- Rendered from app/src/lib/knownlimitations.ts by pilotdocs.test.ts. Edit the data, then run `REGISTERS=write npx vitest run src/lib/pilotdocs.test.ts` from app/. -->

**As of 2026-09-28.** What does not work yet, what to do instead, and how to
report something. Every item names the file in this repository that states it;
nothing here is a plan or a guess. The same list is printed on the public site
at `/known-limitations/` and on the Help screen in the app, from the same data.

Semester works on your device without an account, and everything below is
about the edges of that. If something on this page turns out to be wrong in
either direction, that is a bug: report it the same way.

## What does not work yet

### Semester is not connected to your school’s systems.

**What does not work yet.** No registrar, student-information or learning-system connection is live for any institution. The framework exists and is tested with mock adapters; the adapter registry is deliberately empty, and the learning-system launch has only been tested against a test platform.

**What to do instead.** Register, drop, pay and submit in your university’s own systems. Paste your schedule into Registration (#/yes) and upload each syllabus on Add a course (#/import); every date Semester shows came from what you gave it, and the official system is the one that counts.

*Stated in:* `SEMESTER_MARKET_READINESS.md`, `ops/claims/README.md`, `app/server/institution/gateway.ts`

### Files you attach do not sync, and two devices can still disagree.

**What does not work yet.** Files you attach stay on the device they were added on: they can be tens of megabytes, and uploading them over a phone plan is not a decision the app makes for you. Everything else you type or make syncs. A note, action or other record you edit on two devices before either syncs keeps the later edit in use and offers you the other version to choose on Account. Deleting a course, note, action, appointment, document, sheet or deck on one device deletes it on the others, unless you changed it on another device, in which case the changed one stays and you are asked. Other lists (folders, equations, places and the rest) do not carry a deletion yet, so an item you delete from one of them can come back from another device.

**What to do instead.** Keep attachments on the device you use most, or put them in Take it with you (#/export). Check Account for a version to choose after two devices have been used offline. If something you deleted from one of the other lists comes back, delete it again.

*Stated in:* `app/src/lib/cloud.ts`, `app/src/lib/merge.ts`, `app/src/lib/conflicts.ts`, `app/src/lib/deletions.ts`

### Offline, only two things can be kept to send later, and none sends itself.

**What does not work yet.** Sharing an advisor meeting and sending your course plan to your school can be kept on this device when you are offline. Neither goes by itself: when you are back online you send each one from Account, and one that waited more than three days is not sent and has to be made again. A share cut off by a dropped connection may or may not have arrived, so you check before sending it again. Where the browser will not keep saved sends, they are lost if you close the app. Publishing, deleting your account, choosing an office program and opening an official site are refused while you are offline, with a sentence saying nothing was sent and nothing is waiting. Nothing that writes to an official or financial record can be kept.

**What to do instead.** Keep the two from the screen that was refused, then send them from Account when you are back. Do the rest when you have a connection. The banner under the header says when you are offline and when the changes you made have gone up.

*Stated in:* `app/src/lib/offline-mode.ts`, `app/src/lib/sync/outbox.ts`, `app/src/lib/sync/classes.ts`

### Deleting nearly a whole list at once, offline, can bring it back.

**What does not work yet.** A course, note, action, appointment, document, sheet or deck you delete while offline stays deleted, even if you close the app before it syncs. The exception is a safeguard: if you delete five or more of the same kind, and nearly all you had, while offline, and close the app before the next sync, the app treats that as an accident rather than a choice, because an app that lost rows by mistake would look exactly the same and would delete them from your account. They come back on the next sync.

**What to do instead.** Delete them again once you are online, where each deletion goes up as you make it.

*Stated in:* `app/src/lib/deletions.ts`

### No multi-factor sign-in, and no sign-in through your school.

**What does not work yet.** Multi-factor sign-in is planned and not built. Sign-in through an institution’s identity provider is configured for no institution and has not been tested against a real one.

**What to do instead.** Use an email address and a password you use nowhere else, or one of the providers the sign-in screen offers. An account is optional: everything works on the device without one.

*Stated in:* `ops/claims/README.md`, `app/src/lib/cloud.ts`

### No review by a person using a screen reader, and no conformance report.

**What does not work yet.** Automated checks run on every build and find a minority of barriers. No review of the main student journey by a person with a screen reader, keyboard only, at 320px or at 200% zoom has been recorded, and there is no VPAT or ACR.

**What to do instead.** If something does not work for you, report it (below) with “Accessibility” in the subject. A barrier that stops you finishing what you came to do is fixed before anything else in that screen ships.

*Stated in:* `app/src/site/pages.tsx`, `ops/claims/README.md`

### The terms of service and privacy policy are drafts, not in force.

**What does not work yet.** Both exist as drafts for a lawyer and carry open decisions: the legal entity, liability, governing law. The minimum age is 13, set by the owner and not yet reviewed by counsel. Neither has been reviewed or put in force.

**What to do instead.** Read Privacy and your rights in the app (#/privacy) for what leaves your device and what deleting removes; that page is held to the code by a test. You can export or delete everything at any time.

*Stated in:* `docs/legal/TERMS-OF-SERVICE-DRAFT.md`, `docs/legal/PRIVACY-POLICY-DRAFT.md`, `app/src/lib/privacy.ts`

### Plus can be bought in the app, but checkout is new and has taken no live payment.

**What does not work yet.** Plus can be bought and cancelled from the Account screen, at the price the screen shows. The card is typed into Stripe’s page and never reaches Semester. Checkout runs on Stripe test keys, and its first end-to-end check has not been recorded. Pro is not on sale, nothing can be bought on the public site, and during the pilot every student feature is free.

**What to do instead.** Nothing to do. Buy only from the Account screen: if another page asks you to pay for Semester, it is not Semester. Write to support about any charge you do not recognise.

*Stated in:* `app/src/lib/membership.ts`, `app/src/lib/plans.ts`, `docs/DECISION-LOG.md`

### The in-app support desk is built, but it is not switched on in every environment.

**What does not work yet.** When support tickets are enabled, Help shows your questions, stable SUP references, replies and their 24-hour or 72-hour first-response target. Authorized staff answer through an identity-free queue. A generic account-email notice can be sent after a staff reply only when you opt in for that question and where the support notification service and verified sender are configured. Notices are capped at three per question in 24 hours, and turning them off cancels notices still waiting to send; the reply remains available in Help if email is delayed or unavailable. No production support UAT has been recorded, and no support hours or staffed coverage are promised. The status page checks the service from your own browser and its AI and checkout rows only show that the service answered.

**What to do instead.** If the ticket panel is available, use it and keep the SUP reference. Otherwise write to the address below. For “is it down?”, open the status page from Help; Up means your browser reached it just now.

*Stated in:* `app/src/lib/supporttickets.ts`, `app/src/components/console/SupportQueue.tsx`, `docs/GO-NO-GO-CHECKLIST.md`, `app/public/status.html`

### Your own backup is the one that has been rehearsed.

**What does not work yet.** A restore of the account database is rehearsed on every change, into an empty database. The production database has never been restored, and how long that would take is unmeasured.

**What to do instead.** Download “Everything, as data” from Take it with you (#/export) at the start of term and after big changes. Restoring that file into a fresh browser is exercised on every build.

*Stated in:* `RESTORE.md`, `app/scripts/golden-path.mjs`

### Course rooms are not separated by school yet.

**What does not work yet.** Today a confirmed email address of any domain can enter any school’s course room. The claim-your-school step exists and protects nothing yet; the isolation that would use it is not written.

**What to do instead.** Treat a room as open to anyone with a confirmed address. Do not post what you would not say in a public hallway.

*Stated in:* `SEMESTER_MARKET_READINESS.md`

### Ask Semester does not cite its sources.

**What does not work yet.** Answers do not say which reading or syllabus line they came from, and which model answers is a setting rather than chosen for the question asked. When the assistant cannot help it says why.

**What to do instead.** Check any date, rule or grade weighting against the syllabus on the course screen (#/courses) before acting on it.

*Stated in:* `SEMESTER_MARKET_READINESS.md`

### During maintenance the app may be read-only.

**What does not work yet.** While the account service is being restored or repaired, a build may be deployed in read-only mode: nothing you change is sent to your account until it ends, and a banner on every screen says so.

**What to do instead.** Keep working. Everything is saved on the device and goes up by itself once read-only mode ends.

*Stated in:* `app/src/lib/readonly.ts`, `docs/FEATURE-FLAG-REGISTRY.md`

## How to report something

- Write to harrisonjrubin7@gmail.com. Say which screen, what you were trying to do, and what happened; for a barrier, add the browser and assistive technology you used and put “Accessibility” in the subject.
- You will get a reply from a person that says what was found and what happens next. No response time is promised yet.
- If an accessibility reply does not resolve it, write again with “Accessibility escalation” in the subject; it goes to the accessibility seat.
- Please do not test against other students’ accounts.

## How this list stays honest

It is rendered from `app/src/lib/knownlimitations.ts`, where each entry cites the
file that states it. `pilotdocs.test.ts` fails when a cited file is missing or
when this page differs from the data. When a limitation is fixed, its entry is
removed in the same change, and the date above moves.
