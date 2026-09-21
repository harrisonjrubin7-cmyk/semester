# Submitting into Gradescope, checked against both companies' own docs — September 2026

The tracked copy of the *Gradescope + Turnitin integration feasibility* research,
which asks whether Semester can take a student's finished work and push it into
Gradescope or Turnitin, so that "turn it in on Semester" means the assignment is
actually handed in.

It is filed here for the reason `ACTION-PLAN.md` and `COMPETITION.md` give for
their own existence: **every item that names something about this repository was
checked against the code before it was filed.** That habit has now been run
three times against three outside documents and returned the same answer each
time. Seventeen items in the action plan, seven different from the claim. Nine
in the competitor pass, six already built. Three recommendations here, and
**two of them describe work that has already landed.**

The market reading is the part that holds up, and it holds up completely: the
answer to "can we submit into Gradescope" is no, it is no for a reason that is
not going to move, and the research found the right reason. What it could not do
is read this codebase, and `CLAUDE.md` says why that gap opens as fast as it
does.

**Checked against `9d8c7f4` on 21 September 2026.** Every verdict names what was
measured and where. The vendor claims were re-checked against Gradescope's and
Turnitin's own documentation rather than against the summary, and two citations
in the research do not survive that — see *Two sources that do not say what they
are cited for*.

Legend: **Open** · **Landed** (already in the app; nothing to do) · **Partly**
(some of it is in, the rest is named) · **Not a code item**.

---

## The finding, which stands

**There is no legitimate route for Semester to push a student's submission into
Gradescope.** Gradescope publishes no public API — its own guides say so and
point at a roadmap feature request instead of a timeline. Its integration
surface is LTI 1.3, and LTI 1.3 connects an *LMS* to Gradescope at the
institutional level: roster sync via Names and Role Provisioning, grade
passback via Assignment and Grade Services, assignment creation via Deep
Linking. That is LMS-to-Gradescope. It is not third-party-app-to-Gradescope,
and every step of it is configured by a school administrator.

**Turnitin has a real API for it, and access to that API is a partnership.**
The Turnitin Core API submits documents and generates similarity reports. It is
not self-serve: sandbox access and documentation arrive at step three of a
seven-step partner process, after an agreement is in place, and a certification
review by Turnitin's Professional Services sits between building it and
shipping it. There is no published price, eligibility bar or timeline. You
apply, and it is a sales conversation before it is an engineering one.

**And the structural problem outlives the API question, which is the part worth
keeping.** Both tools are provisioned per course, by the professor, inside the
school's contract. An assignment exists "in Gradescope" because a specific
instructor set it up there. A Turnitin API key would not change that: Semester
still cannot submit into a course it is not connected to. The research states
this plainly and it is the single most useful sentence in the document, because
it means the API is not the blocker and getting the API would not unblock it.

The two ways round — driving Gradescope's web interface as if it were a browser,
or holding student LMS credentials and logging in as them — are outside what
those services permit, and the liability of holding student academic
credentials is not a thing a one-person company should be carrying. The research
rules both out and is right to.

---

## The three recommendations, checked

### 1 · "Now: keep building Semester's native submit/grade/feedback loop (already in progress in `sandbox.ts`)" · **Landed as a vertical — and the thing that would make it matter is a different item**

The file is `app/server/institution/sandbox.ts`, and the loop is not in
progress. It is built, it is tested, and the file names it in as many words at
line 114: *"submit → receipt → grade → feedback → archive loop. No credit, no
registrar, no real marks."*

It is a state machine rather than a set of buttons. `Stage` at line 379 is
`published | submitted | graded | released | archived`, and the invariants are
enforced in that order: nothing is graded before it is submitted, nothing is
released before it is graded, nothing is archived before it is released, and
nothing at all happens to an archived record. Four adapters — `courses`,
`assignments`, `grades`, `records` — share one store, so the submission made in
one is the record the next marks and the row the third archives.

So the recommendation is finished work, and filing it as "keep building" would
have pointed a week at something done. But the verdict is Landed on the loop and
not on the goal, because the file is emphatic about what it is:

- It is **never installed unless somebody asks for it** — `adapters.ts` stays
  empty, and this adapter is added by `start.ts` only when
  `SEMESTER_SANDBOX_INSTITUTION=1` is set on the server.
- It **answers only to a sandbox identity**, resolved from server-side
  `app_metadata` no client can write.
- Every string a person can read **begins SANDBOX**, and `sandbox.test.ts` reads
  them back and fails on one that does not.

That is the right way to have built it and the reason it can be trusted. It also
means the honest form of the recommendation is not "keep building the loop" but
**"the loop is demonstrated; what is open is a real institution on the other end
of the wire."** That is an institutional-adoption item, not a code item, and it
is the same ask as the Vanderbilt work in `IP.md` — which is exactly where the
research's third recommendation lands, one item early.

### 2 · "Parallel, low effort: the read-only Canvas/Brightspace API token sync already scoped in your roadmap" · **Landed, twice, and one of the two carries more than the recommendation asks for**

This is the item the research is furthest behind on, and it is behind by days
rather than by months.

**The calendar half landed first.** `lib/feedlink.ts` takes the feed link a
student copies out of their LMS and turns it into an address this app can fetch,
and it knows the providers by name — `{ has: /(^|\.)brightspace\.|(^|\.)d2l\./i,
kind: 'brightspace', name: 'Brightspace' }` at line 62, with Canvas, Outlook,
Google and iCloud in the same list. No key, no registration, no institutional
deal.

**The REST half landed on 19 September.** `lib/canvas.ts` is the read-only token
pull the recommendation describes: a personal access token the student makes
themselves under Account → Settings, and
`/api/v1/courses/:id/assignments?include[]=submission` at line 275 — which
answers with the assignment *and* that student's own submission on it. Graded
with the score, submitted with the date, missing by Canvas's own flag.

That last part is why this is more than the recommendation asks for. The
research scopes item 2 as *assignment and grade visibility*, and separates it
carefully from submission — good instinct, and the separation is the right one
to keep in messaging. But the thing Canvas's REST pull adds over the calendar
feed **is submission state**: an `.ics` entry looks identical on the ninth of
never and the morning after you handed it in, and the API knows which. So the
app can already say "you submitted this on Tuesday" about a Gradescope-hosted
problem set, without touching Gradescope.

The token is treated as the stronger secret it is, and the refusals around it are
worth knowing before anyone extends this: it rides in a request **body** rather
than a query string, because a query string lands in every log on the way; and
the forwarders issue `GET` under `/api/v1/` and nothing else, so a bug here
cannot become a write.

`COMPETITION.md` item 5 files the same conclusion at more length and marks it
Landed.

### 3 · "Longer-term: apply at turnitin.com/partners once Semester has real traction, paired with the Vanderbilt outreach" · **Not a code item — and the sequencing is right**

Nothing to check in the repository, and nothing to disagree with. A partner
review is evaluating institutional footprint, and a pilot course is the only
thing that produces one. The tracked copy of the Vanderbilt work is `IP.md`,
which is about ownership and naming rather than outreach, and `VANDERBILT-AUDIT.md`.

One thing to add to it, because it is the route the research walks past.
**Gradescope's own way into an LMS is LTI 1.3, and LTI 1.3 is a 1EdTech
standard rather than a Turnitin product.** Semester being launched *by*
Brightspace as an LTI tool is the reverse direction from submitting into
Gradescope, and the research says so — but it is also the direction that needs
no vendor's partner program, only a school administrator willing to install it
in one instance. That is a much smaller first ask than a Turnitin partnership,
it is the same person the pilot conversation already has to reach, and it is
worth carrying into that conversation as the concrete thing being requested.

---

## Two sources that do not say what they are cited for

The research's other five citations check out. These two do not, and both point
the same way — the finding survives, the source does not support it.

**`apis.io/apis/gradescope/gradescope-lti-api/` is not Gradescope
documentation.** It is an independent third-party profile of Gradescope's API
surface, published by API Evangelist, and it carries an OpenAPI description
nobody at Gradescope wrote. Its own summary agrees with the finding — it states
that Gradescope does not publish a generally available public REST API and that
programmatic integration is delivered through LTI — so citing it does not make
the conclusion wrong. It makes the conclusion rest on a directory entry when
Gradescope's own guides say the same thing and are the thing to quote.
The authoritative pages are on `guides.gradescope.com`: *LTI 1.3 and Advantage
FAQ*, and the per-LMS configuration guides for administrators.

**The LMS list is short by one.** The research names Canvas, Brightspace,
Blackboard and Moodle. Gradescope's LTI 1.3 support covers **five**: Canvas,
Blackboard, Moodle, D2L/Brightspace and Sakai, with a further guide for
configuring it in other LMSs. This does not change the argument — the point is
that every one of them is an *LMS*, not a third-party app — but the number is
checkable and should be right.

A third thing, smaller and worth fixing in whatever tool produced the research:
the two sibling documents it cites by filename,
`competitor-feature-comparison-2026-09.md` and
`vanderbilt-ip-outreach-draft-2026-09.md`, do not exist in this repository. The
tracked copies are `COMPETITION.md` and `IP.md`. A recommendation that points at
a file nobody can open is a recommendation that gets skipped.

---

## What the app already does with these two names

Worth stating, because it is the honest shape of "Semester and Gradescope" today
and it needs nobody's API.

Semester reads the destination off the syllabus and tells the student.
`lib/classify.ts:109` scores `submit (via|to|through)`, `turnitin` and
`brightspace dropbox` as evidence that a piece of text is an assignment;
`data/courses/econ/index.ts:53` carries `where: 'Gradescope'` on a problem set
alongside the quoted syllabus line it came from; `data/misc.ts` says *"Due
Friday 11:59 PM on Gradescope. No extensions, ever."*

So the app already knows where the work goes, when it is due there, and — on
Canvas courses, through `lib/canvas.ts` — whether it went. What it cannot do is
carry the file the last inch, and that inch is owned by a professor's course
configuration rather than by an API.

---

## What this pass found

Three recommendations. Two already built, one not a code item, and zero
buildable gaps — which is the first time one of these passes has come back with
nothing to do in the repository at all.

That is not a null result, because the two that are built are built in a way
that changes the shape of the goal. "Students submit and turn in assignments on
Semester" is true today in the sandbox, end to end, with a receipt and a state
machine that will not let a mark precede a submission. It is not true for a real
course anywhere, and no amount of engineering here makes it true: the missing
piece is one professor deciding to run one assignment through it.

The same standard `COMPETITION.md` ends on applies to this file. Every verdict
above rests on a file that was opened and a line that can be quoted, and the two
vendor corrections rest on the vendors' own documentation rather than on a
summary of it. The one claim this file deliberately does not make is a legal
one: whether scraping Gradescope or holding student credentials is merely
against those services' terms or is something worse is a question for somebody
qualified, and the answer does not change the recommendation, which is not to do
it.
