# Semester Privacy Policy — DRAFT

> **Not in force. Not reviewed by a lawyer.** This is a working draft for
> qualified counsel to review, correct and approve. It is written from what
> the code does today — the in-app disclosure in
> [`app/src/lib/privacy.ts`](../../app/src/lib/privacy.ts) and the subprocessor
> register in
> [`app/src/lib/trust/subprocessors.ts`](../../app/src/lib/trust/subprocessors.ts)
> — and it must not be published, linked from the app, or given to a customer
> until the `terms-reviewed` gate in
> [`GO-NO-GO-CHECKLIST.md`](../GO-NO-GO-CHECKLIST.md) records a qualified
> review. Every `[DECIDE: …]` is a question only the owner or counsel can
> answer. `app/src/lib/trust/legal-drafts.test.ts` fails if a subprocessor in
> the register is missing from this page.

**Effective date:** [DECIDE: date of publication]
**Who we are:** [DECIDE: legal entity name — e.g. "Semester, LLC", a Tennessee
limited liability company — or the individual operator's name until one is
formed] ("Semester", "we"). Contact: harrisonjrubin7@gmail.com
[COUNSEL REQUIRED: this is the owner's personal mailbox; no dedicated support and privacy address is decided (P-20)].

## 1. The short version

- Semester works without an account. Signed out, your semester stays on
  your device. What leaves it is only what you choose to send: an answer to
  someone else's shared form, a question to the assistant, an address you
  look up, and the map tiles for the area on screen (section 5).
- Signing in copies your semester to your account so your other devices have
  it. It copies all of it, and section 3 lists what that means.
- We do not sell your information, show you advertising, use third-party
  analytics, or use your information to train AI models.
- You can export everything, and delete everything the app synced, from
  inside the app at any time. Removing the sign-in itself — the email address
  you registered — takes an email to us (section 7).

## 2. Two ways you might be using Semester

**On your own.** You signed up yourself. This policy is the whole agreement
about your information.

**Through your school.** Your university or college has a contract with us
and turned Semester on for you, for example through its learning management
system or single sign-on. In that case your school decides which of its
systems connect to Semester and which of your education records we may
receive. We act on your school's behalf, as a "school official" with a
legitimate educational interest under the U.S. Family Educational Rights and
Privacy Act (FERPA). We use those records only to provide Semester to you and
your school, under your school's direction and our contract with it.
[DECIDE with counsel: the exact FERPA school-official language, and that the
institutional contract/DPA prevails over this policy where they differ.]

## 3. What we collect

**What you enter, if you sign in.** Your courses and deadlines; what you have
finished, started, handed in and attended; your notes, actions, appointments
and calendar subscriptions; your working hours and reminder rules; what you
have told the assistant about yourself; the documents, spreadsheets, decks,
equations and graphs you make; email drafts and mail rules; your study
history; your grades, returned work, degree plan and applications; the people
and advising visits you log; cost, housing, meal and map records you enter;
and your app settings. The in-app **Privacy** page lists these groups from the
same data the sync uses, so it cannot list less than is sent.

**Answers to shared forms.** If you answer a form someone shared with you,
your answers go to that form's owner, whether or not you are signed in.

**Your account.** Your email address and, if you sign in with Google,
Microsoft or Apple, the basic profile that provider shares.

**Three usage facts per day.** For each day you open Semester while signed
in: that you opened it, whether you had added a course by then, and whether
you had answered a study card by then. Nothing about what you wrote or read.
Kept a little over a year.

**Who read your rows.** When your published calendar link is fetched, or the
reminder sender reads your queue, we record the kind of client and the day.
No address, no device fingerprint. Kept ninety days, visible to you on the
Export screen.

**From your school**, only when your school has connected Semester: the
records its contract and approved data scope permit, such as your enrollment
in a course that launched Semester.

**What we do not collect:** your Anthropic or OpenAI API key (it stays on
your device), files you attach to notes (they stay on your device), your
location (unless you switch on the setting that turns your position into a
place name), or any advertising identifier.

## 4. How we use it

To provide Semester to you: keeping your devices in step, sending reminders
you switched on, answering questions you send to the assistant, and letting
you share what you choose to share. To keep it working and secure. To answer
support requests you send. The three daily usage facts are used only to learn
whether Semester is useful: how many people who sign up add a course and
study from it, and how many come back.

We do not sell or rent personal information, we do not use it for targeted
or behavioural advertising, and we do not use it to train AI models.

## 5. Who else handles it

We use service providers to run Semester. Each receives only what its job
needs.

| Provider | What for | When |
| --- | --- | --- |
| Supabase | Database, sign-in, storage of synced rows, background functions | Whenever you are signed in |
| GitHub Pages | Serves the app's files | Every visit |
| Vercel | Runs the institutional gateway | Only for school deployments |
| Anthropic | AI answers, when you use AI features without your own key | Only when you press an AI button |
| Stripe | Payments for a paid plan: the checkout page you type your card into, and recurring billing. Semester never sees your card | Only if you subscribe to a paid plan |
| Resend | Delivers a company-site form to our team; sends a generic notice to your account email when Semester support replies (the reply body and app context stay in Semester) | Only when you send such a form, or support replies to your in-app question |

**Services you or your school choose to connect.** These receive information
only because you, or your school, turned them on:

- **Your own AI key** — Anthropic or OpenAI, using a key you entered on your
  device.
- **OpenAI, when your school approves it** for AI over course materials.
- **Your school's learning management system** (LTI 1.3) — course launch and,
  where an instructor placed a graded link, a quiz score.
- **Google, Microsoft, Zoom and Apple** — signing in, and connecting your own
  calendar, mail, files, tasks or meetings.
- **OpenStreetMap tile servers** — map images when you open the map.
- **Nominatim and Photon** — address lookup, only if you switch it on.
- **Calendar and Canvas hosts you link** — reading a feed you pasted.
- **Your browser's push service** — delivering reminders you switched on.

Their own terms and privacy policies govern what they do with what they
receive. We may also disclose information if the law requires it, to protect
someone's safety, or as part of a merger or sale of Semester, in which case
this policy continues to apply to it. [DECIDE with counsel.]

## 6. How long we keep it

Until you delete it. Your work is not removed on a schedule. The exceptions
are records *about* your use: the log of who read your rows (ninety days) and
the daily usage facts (a little over a year). Queued reminders are deleted
once sent. For school deployments, retention follows the school's contract.

Our hosting provider backs up the whole database daily, and each backup
expires 7 days after it is taken [VERIFY on the provider dashboard before
publishing: the number is the plan tier's documentation, and the table in
`RESTORE.md` is where the verified figure and its date go]. Something you
delete, including your account, can remain in a backup for up to that long;
nobody reads backups, and they exist only to restore the service after a
failure. If the service is ever restored from a backup taken before you
deleted something, that item can come back: we re-apply the deletions we can
identify before the restored service is opened, and we tell everyone who used
Semester in that period that a deletion made then may need to be made again,
because we cannot tell whose it was. [DECIDE with counsel:
the wording. The number and the exception track `RETENTION.md`, *Backups*,
and change there first.]

## 7. Your choices and rights

- **Export**: *Take it with you* downloads everything in portable formats.
- **Delete**: *Delete my account* in Settings empties every table Semester
  can reach on your behalf. It does not remove the sign-in record (your email
  address): an app running in your browser should not be able to delete a
  sign-in, so we remove it when you email us. The in-app Privacy page names
  the few shared rows that survive and why. [DECIDE: whether to build
  server-side removal of the sign-in so no email is needed.]
- **Correct**: edit anything you entered, in the app.
- **Stop syncing**: sign out. The app keeps working on your device.
- **Ask us**: email the address above. We will answer within
  [COUNSEL REQUIRED: no response time is decided; do not publish a number until counsel sets it (P-03)] days.

Depending on where you live, you may have further rights, such as to know,
access, correct, delete or port your information, or to object to or limit
its use. Contact us to use them. We will not treat you differently for doing
so. [DECIDE with counsel: which state (e.g. California) and non-U.S. (e.g.
EU/UK GDPR) provisions apply, given who Semester will serve.]

If you use Semester through your school, requests about your education
records may need to go to your school, which controls them under FERPA. We
will help your school respond.

## 8. Children

Semester is not directed to children under 13, and we do not knowingly
collect personal information from them. The product's recorded setting is a
minimum age of 13, enforced when an age is stated (D-139), and a student aged
13 to 17 is kept out of the features where strangers reach them. [COUNSEL
REQUIRED: whether 13 stays the minimum age in the Terms or becomes 18,
whether a sign-up age question is needed for everyone, and how dual-enrollment
students who are minors are handled — see COPPA-1 to COPPA-5
in `docs/FERPA-COPPA-1EDTECH-READINESS.md`.] If you believe a child under 13
has given us information, contact us and we will delete it.

## 9. Security

Your rows are protected by row-level security in the database, keyed to your
account. Traffic is encrypted in transit. Secrets are kept out of the app's
code. No system is perfectly secure. If a breach affects your information, we
will tell you and, where required, your school and regulators, as the law and
our contracts require. [DECIDE with counsel: notification commitments.]

## 10. Where it is stored

In the United States, at the database host named on the in-app Privacy page.
[DECIDE: confirm the Supabase project region before publishing.]

## 11. Changes

If we change this policy in a way that matters, we will say so in the app
before the change takes effect. The date at the top shows the current
version.

## 12. Contact

harrisonjrubin7@gmail.com [DECIDE: dedicated address; postal address if
counsel requires one].

### Public source checks and private productivity work

**Public institution source hosts you check** receive a public page request only when you request a source check. The check sends no Semester session token, reflections, selected excerpt, or saved student content to that host. Semester checks the excerpt in memory and does not store the page body or source URL server-side. The host receives ordinary request metadata from Semester's server.

Your private productivity cloud copy includes saved decisions, captures, drafts, reflections and history. It is readable only by your own authenticated account. You can delete that cloud copy while keeping the device copy; deleting the account removes the cloud copy. Institution counts require your separate opt-in, active membership and an administrator request, and are suppressed below ten consenting members. The count response contains no names or student content. Assistant drafts and semantic search send only the context displayed for your review, to the assistant provider or institution gateway you selected. Provider retention depends on that connection's terms. Browser captures stay unauthorized for assistant use until you authorize them.
