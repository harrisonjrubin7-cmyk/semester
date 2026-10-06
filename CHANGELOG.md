# What changed

For people testing Semester, not for people writing it. Every entry says what
you will *see* and whether you have to do anything; the commit history has the
reasoning and the measurements.

Three rules for this file, because a changelog nobody trusts is worse than
none:

- **Anything a tester can notice goes in**, including things that got worse and
  things that were taken away again. A feature that vanishes without a word
  teaches people to distrust the whole app, and that is harder to win back than
  the deploy was.
- **A rollback gets an entry of its own**, saying what went back and what you
  will see change back. See [`ROLLBACK.md`](ROLLBACK.md).
- **Dates are when it reached the live page**, not when it was written.

The live page is <https://harrisonjrubin7-cmyk.github.io/semester/>. It updates
within a few minutes of anything landing. If a change here does not match what
you are looking at, hard-reload — the app keeps working offline, which means it
will happily serve you the copy you already had.

---

## Unreleased

- **The bill says the figures are yours.** Under the total you track yourself, a “Student entered” label now says you typed these numbers in and the school has not confirmed them. Nothing else on the screen changed.

### Signing out other devices says it cannot be undone

On Account, under Sign-in and security, the confirmation before **Sign out other devices** now says those devices will be asked to sign in again, that this device stays signed in and nothing is deleted, and that the sign-out cannot be undone — those devices sign in again themselves. The button still asks before it does it. Nothing else about the account changed.

### Registration readiness opens with one line on where you stand

At the top of the registration readiness list there is now a single status: **Ready**, **Almost ready**, **Getting ready**, **Blocked** or **Information unavailable**, with a sentence saying why. **Blocked** appears only when two courses in your schedule overlap, which the app can see for itself. Holds and prerequisites live in your school's system, so they never produce it. **Information unavailable** appears when no course catalog is loaded, or when a section you selected has no meeting times, so conflicts cannot be checked and the line will not say Ready. The Schedule conflicts step says the same. It is still preparation, not clearance: your registrar and official system decide the result. The steps below are unchanged and you do not have to do anything.

### Operators see four more console tabs, and only the ones their grant allows

Only an account holding the operator grant sees this, so students and school administrators will notice nothing. The operations console now has **Tenant operations**, **Privacy requests**, **Integration health** and **Release & incidents**. Each of those appears only when the signed-in operator holds that tab's own capability, and Support still appears only when tickets are on and the operator may answer them. A tab the operator cannot use is absent, and a saved view that names one does not open it. The tabs an operator with `console:operate` already had, including **Finance model**, **Releases and flags** and **Launch readiness**, are unchanged. You do not have to do anything.

### Links from the company site into the app say which page they came from

The "Start planning free", "Log in" and demo links on the company site now carry a few short, plain facts into the app's address: which page the click was on, the campaign link that brought you to the site (if there was one), and that the link is for a student. The app uses them to keep your place through first-run setup. They are not stored on a server, and nothing in them says who you are or what you can open; that stays with your account. Nothing about how the site looks or reads has changed, and you do not have to do anything.

### The operations console has a Launch readiness tab

For operators holding the console grant: a new **Launch readiness** tab, after Releases and flags, shows where the launch go/no-go stands. It lists the twelve launch gates (met, partial or unmet, the files that show it and what is still missing), the council seats with who holds each and whether it has signed, and the verdict worked out from them: go, go with conditions or no-go, with the reasons. It is read-only and says it is the repository's record as of a date, not a live check; nothing on it can mark a gate met. Nothing else in the console moves, and you do not have to do anything.

### A link that names a screen keeps it through first-run setup

If a link sends someone who has never used Semester to a particular screen (`?continue=calendar`), setting up no longer drops them on the import screen instead: the run, or Skip, ends on the screen the link named. Only the screens a `?screen=` link may already open are accepted, and a link can say where to go but cannot say who somebody is or what they may open. Nothing changes for anyone arriving without such a link, and you do not have to do anything.

### Registration’s planner is named Term plan, and a clash is the first thing in the cart

On Registration, the planning tab is now Term plan. In the cart, a time conflict is listed before the sections. A cart whose meetings do not overlap still has no conflict line. Official enrollment is unchanged, and it is still the Enrollment screen.

### Leaving a university, and approving someone, says whether you can take it back

The confirmation before you leave a university, and the one before staff approve a join request, now says what happens, what stays, and that you can undo it (claim the university again, or remove the person later). Nothing else about claiming a university changed.

### Your browser stops filling your own details into other people's boxes

Fields that take someone else's email address (an email's To, Cc and Bcc, a contact's, a family member's) now tell the browser not to autofill them, so your own address no longer appears in them. The two assistant key boxes in Settings tell it not to offer to save a key as a login. The two name boxes about you (on Profile, and what a call shows as your name) now say what they are for, so a browser or screen reader can help. Nothing was removed and you do not have to do anything.

### The operations console has a Releases and flags tab

For operators holding the console grant: a new **Releases and flags** tab, between Finance model and Evidence, lists the feature flags this build was made with (the experience, module, toolkit and community flags, and the four standalone ones) and the state of each — Off, Preview, Sandbox or On in production — most live first, with a filter box. It is read-only: a flag is fixed when a build is made, so there is nothing to switch here, and the tab says so. A flag the registry does not describe says that instead of guessing. Nothing else in the console moves, and you do not have to do anything.

### Forms that find several problems now list them together

On **Costs** (the bill and the out-of-pocket form), **Meals** and **Housing**, pressing the add button with more than one thing wrong now shows a short list above the form — "2 things need fixing" — with one line per problem. Each line is a link that takes you to that box. The message under each box and the move to the first wrong box are unchanged, and with only one problem nothing new appears. You do not have to do anything.

### Support and the assistant now point you to a person

On **Support**, each tab has a line under its introduction: "Not sure which door fits? See who can help with what". It opens Help, where the offices and what to bring are listed. In the assistant, under the sources of an answer, there is a new "Not sure it's right? See who can help" link to the same place, because an assistant answer is not an official answer. Nothing was removed and you do not have to do anything.

### Semester staff get a finance planning tool in the operations console

Only people holding the operator grant see this, so students and school administrators will notice nothing. The console has a new **Finance model** tab: a 36-month planning model with twelve scenarios, editable assumptions, two sensitivity grids, warnings for runway, margin, delivery capacity and AI cost, and downloads as CSV, JSON and Markdown. Every figure on it says it is a forecast on planning assumptions, it works on sample data only, and it saves nothing. No price, target or result in it is approved. You do not have to do anything.

New business planning documents, a report build (`npm run generate:gtm-pdf` from `app/`) and four PDFs came with it; they are in `docs/business/` and `output/`, not in the app.

### Moving an action to another day on the month calendar now offers Undo

Tap the day-shift button on an action in the month view and you get "Action moved" with Undo for a few seconds, the way dragging it to another day already did. It used to move silently. Nothing else about adding, ticking, moving or deleting an action changes, and you do not have to do anything. Behind the scenes these now go through one place in the code, which a build can switch to the new rules with `VITE_DOMAIN_TASKS`; it is off, and with it off everything behaves exactly as before.

### Deleting something offline now sticks, and you can keep two sends for later

A note, course, action, appointment, document, sheet or deck you delete on one
device stays deleted on the others. It used to come back from the other device,
and a course deleted offline came back if you closed the app first. If you
deleted something on one device and changed it on another, the changed one stays
and Account asks which you want.

Offline, you can now keep an advisor share or your course plan to send yourself
later. They wait on Account under "Waiting for you to send", and they do not go
by themselves, even when you are back online. One that waits three days is not
sent and has to be made again. Files you attach still do not sync between devices.
### For school staff: a Workflows tab on University (off for now)

Staff with workflow rights at a school get a **Workflows** tab for the ten
processes a school runs: registration clearance, advisor approval, transfer-
credit review, study-abroad approval, tutoring referral, scholarship
deadlines, organization events, internship approval, course substitution and
graduation application. Each starts from a template you change: its steps, who
owns each, the checks a student must meet, and the office it hands off to. A
preview shows what a student would be told. A change is a draft; a colleague
who holds the publish role publishes it as a numbered version, and you cannot
publish your own.

It is switched off, and nothing in the app runs these definitions yet: the tab
says so. It holds no student and no request. Students see no difference.
### For school staff: a Configuration tab on University (off for now)

Staff with configuration rights at a school get a **Configuration** tab in
eleven domains — academic structure, workflows, roles, branding, content, AI,
notifications, data, features, accessibility and reporting. A change is a
draft; a colleague who holds the publish role publishes it as a numbered
version, and you cannot publish your own. Old versions stay, and you can start
a new draft from any of them.

It is switched off, and nothing in the app reads these settings yet: the tab
says so. Students see no difference.

Nothing to do.

### On the public site: alumni relations and fundraising, described and not built

Two new pages, `/solutions/advancement/` and `/alumni/`, describe what an
alumni and advancement office could one day run in Semester: alumni relations,
giving, and the office's own console. They say plainly that none of it is
built, that no school uses it, that no gift has been taken and no receipt
issued, and that no price has been set. They also say what is not planned:
wealth screening and predictive donor scoring. The graduate page lists what a
graduate can do today (offer to mentor, take their data with them) and asks
for nothing.

Nothing to do.

### A school can no longer be deleted; leaving is a step-by-step case

Nothing you can see changes in the app. Behind it, a university's record can
no longer be deleted by anyone, because doing so would have silently removed
everything the school had (shares, requests, grants, roll-outs). A school
leaves through a recorded case: sized first, approved by a person at the school
and a person at Semester, access switched off (nothing deleted), the school's
data exported and checked, then archived for at least thirty days. Every step
until the last can be undone. Nothing has been offboarded, and there is still
no way to purge a school's data. Nothing to do.

### Advisor shares and planning screens say where things came from

When you preview or send an advisor meeting, it now ends with "Where this comes
from, and what it assumes": which parts you wrote, which are your own estimate,
the day it was prepared, and that nothing in it comes from the school's records
or is a degree audit. A share made before this still opens as it did. The
graduation projection and the study-abroad credit picture now carry a source
label and say plainly that they are not an official degree audit or credit
evaluation. On the university settings page, the Modules tab no longer says its
settings "could not be read" while they are still loading. Nothing to do.

### Action Center: more snooze times, and say why you hid something

Where the Action Center is switched on: beside "Snooze until tomorrow" there is
now "More snooze times" (later today, next week, and the day before it is due
when that is a real later moment), and "Not relevant" asks why first, with four
reasons or "Hide without saying why". The reason is kept on your device and shown
in the Hidden list so you remember. Registration Day Mode, where it is on, adds
"How heavy this term is": it compares your credits with the limits and study
hours you type, and estimates weekly hours at two per credit. It is an estimate
from numbers you gave, not a rule of your school, and it never stops you doing
anything. Nothing to do.

### Today no longer plans around the sample semester until you say it is yours

While the question under the header ("These are mine" / "Not mine") is still open,
Today's next step, its briefing and its list of commitments leave out the shipped
semester's assignments and classes, instead of telling you to "Prepare" someone
else's paper. With nothing of your own yet, Today suggests starting your semester.
Answer "These are mine" and the same dates appear as yours. Where an item has no
recorded update time, its label now says "Update time not recorded" instead of
saying nothing. Commitments name where each date came from (for example "Needs
review · date not checked"). Nothing to do.

### On the public site: a page for the K–12 edition

A new page, `/k-12/`, describes Semester for high school: who it would start
with, how each part of the app would be set up for a school, and the 26-week
pilot it would offer. It says plainly that no district or school uses
Semester today and that a district's student data is not accepted yet, with
how many of the things that waits on are still undone.

Nothing to do.

### A reset link now lands on a screen of the app's own

Following a password-reset email opens a "Choose a new password" box in Semester,
under the same eight-character rule as making an account (before, it sent you to
a page Supabase draws, which applies its own rule). Account, once you are signed
in, gains a "Sign-in and security" section: change your password, change your
email address (it changes when you follow the link sent to the new address, and
the page says so), and sign out every other device, which asks you to confirm
first. Nothing to do; nothing is deleted by any of it.

### Making an account now asks for your date of birth

When you create an account, the form asks for your date of birth. You need to
be at least 13: a younger date is refused before anything is sent, and the
database refuses it too. If you are 13 to 17, the account is made and the
features where other people can find, match with or message you — mentor
requests, being listed as a mentor, connections, study matching and the talent
profile — stay off until your 18th birthday. Plans, courses, study work, reports and sharing with a
parent or guardian work as usual.

If you signed in with Google, Microsoft or Apple, or your account was made
before this, a line under the header asks for your date of birth, once.
Until you answer, classmates, community, matching and mentoring stay off;
your own plans, courses and study work are unaffected. It cannot be changed
afterwards, and the date itself is not kept.

Nothing else to do.

### On the public site: the platform statement no longer lists payments

The statement at the top of **One Operating System**, under Platform, named
payments among the parts of university life Semester brings together.
Semester does not handle payments, so the word is gone; the rest of the
sentence is unchanged.

Nothing to do.

### Plus is $7.99 a month or $59 a year

The Membership panel on your Account screen now offers Plus at $7.99 a month
or $59 a year, the same price the pricing page and the company site show.
Until now the panel offered $3.99 or $29.99. If you already started a Plus
checkout at the old price in testing, it keeps that price; a new checkout
uses the new one.

Nothing to do.

### On the public site: two more things Semester will never do

**Data & AI Transparency**, under Trust, lists what Semester never does with
student data. It now says two more things: education records, personal plans
and study activity are never used for behavioural advertising, and study
activity is never used to label a student capable or incapable, motivated or
unmotivated. Each line links to the check that holds it, like the others.

Nothing to do.

### A Student accounts tab for the bursar's office

Student accounts officers, financial aid officers and business administrators
see **Student accounts** on the University screen, in builds with it switched
on. Find a student by your school's identifier to see their balance, how old
it is, whether a financial hold applies, every charge and payment, a month's
statement, receipts and a payment-plan schedule. Every change is a request
someone else approves; large refunds, adjustments and scholarships need a
senior approver; a month is reconciled against your payment provider and then
closed. No money moves here and no card is ever asked for.

### Your school's account, on Bill

When your school keeps its student accounts in Semester and its registrar has
linked your student record to your account, **Bill** opens with what the
school's ledger says: what you owe today, how old it is, whether a financial
hold applies, every charge, payment and credit, a receipt for each payment,
and a month's statement to download. Charges for later dates are listed apart
and not counted as owed yet. Nothing here can be changed or paid; the link
goes to your school's own payment page. What you type below stays yours, as
before.

### Ask your school for a payment plan

On the same section of **Bill**, you can ask to spread what you owe over
monthly payments: choose how many and when the first is due, and you see the
exact schedule before you ask. Student Accounts agrees or declines, and once
agreed you see each payment as paid, due, late or coming. While you keep to
the plan, no financial hold applies. Student Accounts staff decide plans in a
queue of their own and can cancel an agreed plan, with a reason you see.

### An Academic record tab for registrar staff

Registrars, deans and faculty with a school-wide role see **Academic record**
on the University screen, in builds with the ledger switched on. Find a
student by your school's identifier and see their record as it stood on any
date, with the full history behind each line. Nothing on it is edited: a
change is proposed with a reason and enters the record only when someone else
approves it, and correcting a posted grade needs a registrar. The export is
labelled as not an official transcript. Students see nothing new yet.

### A Migration tab for staff moving a system into Semester

Staff who hold a migration role at their school (an implementation manager,
an integration admin, the registrar, a dean, a university administrator or an
institutional researcher) now see **Migration** on the University screen, in
builds with the Migration Center switched on. It walks a migration out of a
system being retired through twelve stages, from inventory to post-cutover
monitoring, and each stage opens only once the one before has its evidence.
Export files you check there are read in your browser and go no further;
only counts and the file's fingerprint are saved. Students see nothing new,
and nothing is switched on in an ordinary build.

### Find people, groups and opportunities, from Community

Community now ends with one list — **Find people, groups and opportunities** —
and shows it even where Community itself is switched off or you are not
signed in: who else is in your classes, study groups and course spaces,
clubs and events, project teams, peer and alumni mentors, research and
internships, the people who will write about you, and the campus map. Every
row opens a screen you already had; nothing is recommended, so nothing
needs a reason beside it. Three things the list will hold have no screen
yet and are not drawn: your portfolio, the verified-communities directory,
and saved things in one place.

Nothing to do.

### On the public site: the Semester Community

Five new pages under **Community** in the footer — The Semester Community,
Campus ambassadors, Student stories, Partner directory, and Events and
sessions — and a free resource library at the top of Resources: five tools
that exist and ten guides named as being written. Each page says what is
built instead of a social network, and says plainly that no community
programme is switched on for any campus today, no ambassador has been
recruited, no story published, no partner listed and no event scheduled.
Every next step is a page or a person.

### On the public site: one operating system, and why not another tool

Two new pages under Platform. *One Operating System. Every Student Moment.*
puts the student at the centre and nine areas around them — academic path,
courses and learning, schedule and planning, advising and support, campus
life, career and portfolio, money and important dates, community and
opportunities, institution operations — each opening to the student problem,
the Semester workflow, who benefits, what connects, what stays official, and
how it connects back to Today, the Action Center, Search, Plan, the Workspace
and Semester Intelligence. *Why not another tool?* sets the traditional
approach beside the Semester approach in eight rows. Beside every area and
every row is one of four words — held by a test, being built, designed, not
started — computed from the register behind the page, never written by hand,
so neither page can say “fully built” where the code says “being built”.
Both pages ship no script; an area opens as a plain disclosure.

Nothing to do.

### Describe the problem, and be sent to the right door

Help now opens with one field: describe the problem in your own words — “I
do not understand why I cannot register”, “I need help with a paper”, “I need
an accommodation” — and Semester says whose question it is, what it can do
first, what to bring, and offers a summary to take with you. When the person
is one the help route can reach, one button opens the request with your
sentence as the question; you still read exactly what will be sent before it
goes. Distress is heard before the subject it is about, and routed to campus
counseling. Nothing you type there is kept.

Nothing to do.

### How to read an answer, and six ways to mark it

Under every reply from Ask Semester there is now **How to read this answer**:
source strength (strong, limited or none, from what was actually read), policy
state (allowed, limited or unavailable, from the policy in force), what it can
support, what it cannot determine, and what needs a person or the official
record. The two marks under a reply became six: Helpful and Not helpful stay
on this device as before; Incorrect, Source issue, Policy issue and
Accessibility issue open a report on the right kind with the first words
filled in.

Nothing to do.

### For institutions: simulate a policy change, and a Trust tab

On the Control tab of the institution screen, **Before you change a policy**
simulates turning a module off in a course or for the whole institution, or
changing a retention clock: who sees it, which workflows and alternatives,
what support content to update, the audit event it writes, and the reviewers
it needs. A clock on a student’s own work is refused, and so is one under its
legal floor. Beside Control there is a **Trust** tab: version, modules,
connections and freshness, open issues, known limitations, trust documents,
accessibility status, maintenance, retention, AI policy, feature changes and
usage aggregates, each read from the product itself, with an absence said
plainly.

Nothing to do. Both tabs appear only where the control plane is switched on.

### On the public site

Six new pages — the Semester Standard, Data & AI Transparency, Integrations
and standards, The words we use, the AI Governance Readiness Canvas, and
Research and community — and a fifth free tool, the academic navigation
diagnostic. Every capability the new pages name carries the register’s status
word; no certification, customer or number is claimed.

### One place under Me for what Semester knows about you

Me now opens with one list, in the order the questions come: My profile, My
data, Connected accounts, Sharing, AI controls, Notifications, Accessibility
preferences, Activity, What changed, Recovery, Export data, Request deletion,
Support access, Billing and Security. Each row opens the screen that already
held the thing; nothing moved.

Three of those screens are new. **Activity** is your own trail — a plan saved,
an agenda shared, support let in or shut out, an export requested — each line
with where it came from, who can see it and whether it still stands. It stays
on this device and holds no content. **What changed** is this list, inside the
app, filtered to the parts your school has switched on, with known issues
listed apart. **Recovery** is where to start when something went missing: is
your work safe, is anything waiting to sync, a recovery copy of this device's
libraries, how to reconnect, how to reach a person.

Nothing to do.

### Fix this, on every screen

Under **About this screen**, which every screen has, there is now a short
list: this deadline looks wrong, this source is out of date, this
recommendation is not relevant, this answer is incorrect, this should be
private, report an accessibility barrier, get help. The first four open a
report on the right kind with the first words filled in; the other three open
the screen where the thing is done.

Nothing to do.

### Service notices only where they apply

When the service has an incident or planned maintenance, the screens it
affects say so in one line, with what still works. Unrelated screens say
nothing. Help now links to the status page.

Nothing to do.

### A support ticket can carry what you were doing

Where Semester support is switched on, the ticket form offers to add, as lines
you read before sending: where you were, what you were trying to do, an error
reference, your browser and device, the last error this device logged, whether
your work is saved, and which sources are connected. Off until you tick it.
Never your notes, files, grades, conversations with the assistant or anything
from your student record.

Nothing to do.

### The term, start to finish

On the registrar screen, beside closing the term, two lists: what to do at the
start of a term (confirm courses, read in syllabi, set your week, read each
course's rules, choose reminders, set the term's goal, connect your calendar)
and at the end (review, archive, keep what is worth keeping, export, update
your goals, plan next term, refresh career evidence, review shares, clear old
deadlines). Each opens the screen where it is done.

Nothing to do.

### "Since you last opened" says why

The line on Today that lists what changed while you were away now carries,
for each change, where it came from, when, why it matters and what to do.

Nothing to do.

### Written help on the registrar screen, Ask Semester and the practice paper

About this screen on those three now has answers written for them rather than
the built fallback: what the screen is, why it matters, where its information
comes from, and what to do next.

Nothing to do.

### Setting up ends at your first course, not at somebody else's Today

Finishing the introduction used to land you on Today with the shipped sample
semester in it — a Tuesday quiz for a course called CORE 2500, six deadlines
marked as missed, none of it yours. A banner across the top said whose
semester it was and offered to take it away, and nothing told you it was
there to answer.

Setting up now ends on the screen for adding your first course, if you have
not added one yet — the same door the introduction had just told you to use.
And once you add that first course, the sample steps aside on its own: the
banner is gone, and Today is your own day rather than somebody else's,
whether that course arrived by uploading a syllabus or by typing in a course
code. Nothing is deleted — the sample semester is still there if you switch
it back on from Settings, exactly as before.

Nothing to do.

### The first thing the app said about your semester was about somebody else's

Open the app for the first time and it introduced itself with **"4 syllabi.
One brain."** On the next screen — *"Dropped in. Read."* — it listed four PDF
filenames with ticks beside them: `Econ1020_2026_Fall.pdf`,
`PSCI1104_Trounstine_F26.pdf`, `Sports_Fall26_Syllabus.pdf`, `Syllabus Draft
8262026.pdf`, adding up to *48 dated obligations across 4 courses*, under a
button that said **Looks right**. On the Soft layout the opening line was
*"You have 4 courses, 34 deadlines ahead, and 9 days until your first final."*

None of it was yours. Those are the four sample courses, which ship switched
on so the app has something to show — and the first run was counting
everything loaded rather than everything you had given it.

The run now counts your own courses and nothing else. A brand-new install
opens on *"Your syllabi. One brain."* and **Show me**, the second screen says
*"Drop one in."*, and the Soft layout says *"Nothing loaded yet. Add a
syllabus and the semester comes back."*

Add a course and it goes back to counting — *"1 syllabus. One brain."*, your
filename, your dates — with the sample still on and still not counted. The
sample semester itself has not changed and is where it was, under Settings.

Nothing to do, and nothing you had is affected.

### Photograph a score, and it lands in your grades

Top Hat, iClicker and the rest have no way to hand this app your score — there
is no student API to ask. So under each course's grading table there is now
**From a photo**: photograph the screen that shows your score, and the number
comes across.

What it does *not* do is decide anything for you. It reads the page, shows you
every number on it that could be a score with the line each one came from, and
you tap the one that is yours. Then it proposes which category it belongs to —
and where the line does not name one, it says so and leaves the choice to you
rather than guessing. **Nothing reaches your grades until you have picked
both.**

It files exactly what was on your screen. Photograph "13/14" and "13/14" is
what the field holds, the same as if you had typed it.

Needs the assistant set up, like every other place the app has to read a
photograph. Typing the number in is unchanged and still the fastest route for
a single figure.

### Fixing the wording of a question no longer wipes what you knew about it

A card's identity used to be its question. Drill a card fifty times, then have
the question reworded in an update — a typo fixed, a sentence tightened — and
the app treated it as a card it had never seen. Your streak, your ease, your
next review date: gone, with nothing said, and the unit's mastery quietly back
to the number the guide shipped with.

Every card in the four prepared guides now carries an identity of its own, and
that identity does not move when the wording does. Nothing you have already
answered has changed: each id was set to the key that card's history is
already filed under, so this took effect without anything being migrated,
rebuilt or reset.

Cards from material you add yourself are not covered. A re-imported reading
produces genuinely new cards with no thread back to the old ones, so those
still start their history over — as they always have.

Nothing to do, and nothing to look at: this is only visible the next time a
question is edited, which is exactly when it is meant to be invisible.

### The app asks which semester you are in, instead of assuming Fall 2026

A brand-new install started in Fall 2026 whatever day you opened it on — the
semester was written into the app as a fixed value rather than read off the
calendar. Today that is right. In January it would not have been, and nothing
on screen would have said so: courses you added would have been filed under
last autumn, deadlines with no year on them would have resolved against the
wrong one, and the semester switcher that would let you fix it does not appear
until you have courses in two semesters.

A new install now starts in whatever semester it is actually opened in, and
the first run asks. Step 3 is *"When and where do you study?"*, with the
calendar's guess already chosen and the semesters either side of it beside it
— for setting up in December for a January start, or a summer session the
calendar has already called Fall.

Nothing you have already saved moves. A semester you had already chosen stays
chosen, and courses saved before the app knew about semesters at all stay in
Fall 2026, where their dates belong.

### A quotation in a study guide now tells you where in your material it is

Open *View cited material* under any section of a generated study guide. It
used to name the source — "Prepared course guide · Unit 1; original page not
recorded" — and then print the whole source underneath for you to search by
eye. It now names the place: *characters 27–65*, with the paragraph too where
the material has paragraphs, and shows the quotation underlined inside the few
lines either side of it instead of the entire text.

Nothing changed about which quotations are accepted. Every guide has always
been refused outright if a quotation could not be matched to the material you
selected, and that is unchanged — including the small number of quotations the
app can verify but cannot pin down (an accent written as two characters in your
file and one in the quotation, for instance). Those still appear, still
verified, and simply show the source without a location rather than a location
the app did not find.

The locators that end "original page not recorded" still say so. A prepared
course guide, a pasted excerpt and a PDF with no page structure genuinely have
no page in the original, and a sentence claiming otherwise would be the thing
worth distrusting. You now get both: what the original does not have, and where
inside it the quotation sits.

Nothing to do. Guides you already saved keep the wording they were saved with.

### Settings now tells the truth about what it is connected to

*Settings › About* has a list headed **Where the numbers come from**. It said
Brightspace was on and had synced four courses at 6:40 AM, that Gradescope was
on, that Apple Calendar was two-way, and it printed a Top Hat join code.

**None of that was a connection.** This app has never synced Brightspace — the
Brightspace route is a calendar link you paste, and it is read-only. There is
no Gradescope route at all. Apple publishes a calendar *out*, one direction.
And no app, this one included, can read your Top Hat score: Top Hat has no
student API, so there is nothing to connect to.

The list now names the routes that actually exist — your syllabus, a calendar
link, a Canvas token you issue yourself, what you type in, and Top Hat marked
*not connected* — and the tag beside each says **what it takes** rather than
whether it is switched on, because there was never a switch.

**Nothing you had changes, and nothing stops working.** If you were reading
that screen as "my Brightspace is hooked up", it never was, and the rest of the
app has been telling you so on the Connect screen all along.
### Three things are now counted about your account, and the Privacy screen says which

Semester is about to be piloted, and four questions decide whether it is worth
building further: does it work for somebody who is not its author, do people
come back, does the syllabus extraction hold up on real courses, and would
anybody pay for it. Answering the middle one needs a record of who came back,
and until now there was none.

**What is recorded, in full:** for each day you had the app open while signed
in, up to three words — that you opened it, that you had added a course of
your own by then, and that you had answered a practice card by then. That is
the whole row. Not which screens you opened, not what you typed, not what time
of day, not how long for, not which course.

**What has not changed, and was the reason to build it this way:** there is
still no third-party analytics in this app and no tracking of you anywhere
else on the web. Signed out, none of this happens at all — nothing leaves the
device, exactly as before. You can read your own rows, deleting your account
deletes them, and they are dropped after a little over a year.

The Privacy screen names it in the same words it names everything else, under
*The three things counted about your account*. It is worth reading: that page
is the promise, and a record it did not mention would have made the page
untrue.

Nothing to do, and nothing on screen changes.


### Your university can send its own data as a file, and you load it

Until now there were two ways to tell Semester where you study: find your
school in the list, or answer eight short questions about it. Both are the
right size for one person filling in their own university, and neither is any
use for the thing a university actually has — a term calendar with thirty
dated deadlines on it, a list of every building with its coordinates, the meal
plans and what they cost.

**Now there is a third way.** If your university sends you a Semester school
pack, you load the file under *where do you study* and the screens that were
switched off come on: Term deadlines fills in, the map gets its buildings,
Meals gets the real plans, and the links go to your registrar rather than
nowhere.

- **You see what is in it before anything is kept.** Choosing the file shows
  the school's name, when the file was written, and how many terms, deadlines,
  buildings and meal plans it turned out to contain. Then it asks.
- **Anything it could not use is listed by name.** Not "some rows failed" —
  *"Featheringill Hall — this building was left out, lat must be a number
  between −90 and 90"*. That list is meant to be sent straight back to whoever
  sent you the file, and a first export from any university will have one.
- **Removing it puts everything back.** The profile the app already had is
  still there underneath.
- **It is a snapshot, not a connection.** The dates were true when the file was
  written, so the app shows you that date next to them. Nothing about this
  signs you in to anything, and Semester still cannot read your registrar.

There are two downloads on the same screen: a blank template, and your current
school saved as a pack — which is the one to send a university that is filling
one in, because correcting a file is a much smaller job than writing one.

Nothing changes if nobody sends you a file. The list and the eight questions
work exactly as they did.

### You can record a call, once everybody says yes

**Nobody is recorded without being asked.** Somebody asks, everybody else is
shown the question, and it does not start until every one of them has agreed.

- **Anyone can refuse, and refusing stops it for everyone.** Not just for them.
- **Anyone can stop it once it has started**, including people who agreed.
- **If somebody joins while it is running, it stops** — they have not been
  asked. Whoever was recording can ask again with them in the room.
- **The file is saved on the device of whoever recorded it.** Semester never
  receives it, and there is nothing in the app that could send it.

It is in the **More** panel rather than on the button bar, because pressing it
puts a question to everybody else and that is not a one-tap thing.

**Nothing to do.** If nobody asks, nothing changes.

### A sentence that had become untrue

The More panel used to say the call itself is *never* recorded, here or
anywhere. That was true until the above existed. It now says what is actually
the case: a call is only recorded if somebody asks and everybody agrees, and
the file then stays on their device.

---

## 2026-09-17

A long day. Most of it is the University screen, which went from four
demonstration areas to sixteen.

### University — a sandbox you can actually walk through

The University screen now has sixteen demonstration areas rather than four:
course registration, bills, financial aid, authorised family access, careers,
advising appointments, an alumni network, athletics, clubs, housing and dining.

**Everything in there is a sandbox and says so on every single record.** No
employer, team, club or building named in it exists. No money moves. No
election decides anything. Nobody is housed, cleared to compete, or hired.
Nothing reaches Vanderbilt or any other institution, and nothing here changes
that — connecting a real university needs an agreement this project does not
have.

What it is for is that you can *try* the things a real one would do, and find
out where they refuse:

- Enrol in a section until the seats run out, then meet the waiting list.
- Try to enrol with a hold on your account, or without the prerequisite.
- Pay a bill as a parent who has been granted payment access — and discover
  that the same parent cannot *read* the bill. That asymmetry is deliberate.
- Apply to a job, withdraw the application, and find that withdrawing is final.
- Get an offer, accept it, and watch your other outstanding offers decline
  themselves.
- Vote in a club election, then try to vote twice.
- Sign a housing contract, and read what it says you are agreeing to before you
  sign it. Cancel inside the week; try to cancel after it.

**Nothing to do.** It is on the University screen for anyone.

### Starting from nothing no longer starts at a locked door

If you opened the app with no courses and no API key, the one thing it asked
you to do — add a course from a syllabus — was the one thing that could not
work, and it told you so only after you had picked a file.

Now the first-run screen offers building a course **by hand** beside the
syllabus route whenever there is no key: no key, no upload, no network. A
syllabus can go over it later with every tick and grade kept.

**Nothing to do**, but if you gave up at that door before, it is worth another
go.

### Forms can be answered by people you send them to

A published form is now openable by a respondent rather than only by its
author, which it should have been from the start.

### Calls

Joining by code now needs more than the code. Captions can be written by the
person speaking. Two people can work on one canvas without overwriting each
other's layers.

**Recording is still not built**, and not because nobody got to it: recording a
call is something done *to* the other people in it, and the consent question —
who is told, whether they can refuse, and what happens to the file afterwards —
has to be answered before the engineering one.

### Things that are deliberately not built

These are decisions, not a backlog, and they are listed so nobody schedules
work to undo one:

- **Sending email.** The app writes the draft and opens it in your own mail
  client; you press send. Something that can post a message as you to your
  professor is a bigger promise than a study app should make.
- **Textbook prices.** A wrong price shown confidently is worse than a blank.
- **Writing your coursework.** Templates are headings and empty paragraphs.
- **Guessing what an exam covers.**

---

## Before this

This file starts here. Everything before it is in the commit history, which is
long and written for developers. Starting a changelog late is better than
backfilling one from memory and getting it wrong.
