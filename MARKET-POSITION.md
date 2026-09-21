# The strengths-and-weaknesses review, checked against the code — September 2026

The tracked copy of *Semester: Strengths, Weaknesses & How to Win the Market*
(21 September 2026), which scans ten direct competitors plus seven adjacent
products, names nine strengths and seven weaknesses, and ends in a nine-item
prioritised action plan.

It is the **fourth** outside document filed here, and it is filed for the reason
`ACTION-PLAN.md` gives for its own existence: **every item that names something
about this repository was checked against the code before it was filed.** The
habit has now been run against four outside documents and returned the same
shape of answer every time — seventeen items in `ACTION-PLAN.md` with seven
different from the claim, nine proposals in `COMPETITION.md` with six already
built, three recommendations in `GRADESCOPE-TURNITIN.md` with two already
landed. [`COMPETITIVE-REVIEW.md`](COMPETITIVE-REVIEW.md) is the one exception
worth remembering before dismissing any of this: it found a **real defect**
nobody here had caught, in four lines in the middle of step 4.

**Checked against `08dbff4` on 21 September 2026.** Every verdict names what was
measured and where, and every file and line quoted below was opened rather than
inferred.

Legend: **Open** · **Already built** (was already in the app; nothing to do) ·
**Wrong** (checked, and the claim does not hold) · **Not a code item**.

**No code is proposed here.** This review is a record of what was measured. One
item (§6) was open when it began and was merged by somebody else before it
ended, which is the fourth time in this file that main moved under it and is the
reason `CLAUDE.md` opens the way it does.

---

## The headline: the one defect it names is the fix, and the claim it wants on the landing page is the one to check

This document is the strongest of the four on market reading and the weakest on
this repository, and both halves are worth stating plainly because the
recommendations flow from the second.

**Its single highest-leverage item — "the onboarding bug" — is not a bug.** The
claim is that the AI-key gate "blocks the app's own upload-a-syllabus CTA for
signed-out new users", and that this repeats "the exact 'paywall the core
action' mistake" the document's own competitor research flags Due Gooder and
UpAhead for. The gate is real and it is deliberate: it is the fix for a dead
end, it landed on 19 September, and it is held by a test with a control.
[§1](#1--the-onboarding-gate--already-built-and-it-is-the-fix) has the reading.

**And the sentence it wants led with — "the only free, *unlimited*,
workload-aware planner" — is the one claim in the document that this repository
contradicts.** `supabase/functions/claude/index.ts:36` meters the shared key at
**sixty generations per account per month**. The planner is unlimited; the
shared key is not. That distinction is free to make and expensive to omit from
landing copy. [§7](#7--free-and-unlimited--open-and-the-wording-matters).

**One figure it recommends publishing cannot be reproduced from this
repository.** "217 RLS policy checks" appears nowhere here and nothing measured
comes to 217. [§8](#8--the-engineering-figures--two-stale-one-unreproducible).

That is not a criticism of the research. The competitor work is first-hand, the
Canvas IgniteAI reading is the sharpest strategic point anyone has filed here,
and the three recommendations with no code in them are sound. What it could not
do is read this codebase, and `CLAUDE.md` says why that gap opens as fast as it
does: sixteen merges in one hour is the measured rate, and a document written
against a snapshot is stale before it is finished.

## The count

Fourteen sections below, and fifteen verdicts — §6 names two items. Each
section says what was measured and where.

| Verdict | Sections | |
| --- | --- | --- |
| **Already built** — nothing to do | §1, §4, §5, §6a, §6b, §10, §11, §12 | 8 |
| **Wrong** as stated | §3, §8 | 2 |
| **Open**, and correctly identified | §7, §9, §13, §14 | 4 |
| **Not a code item**, and unknowable from here | §2 | 1 |

Half of it describes work that was already done, most of it in the seventy-two
hours before the document was dated — §4, §5, §10 and §6a all landed between 19
and 21 September, and §6b landing *during* this review. That is the pattern
every outside document filed here has hit, and `CLAUDE.md` explains it: the
measured merge rate is sixteen in an hour.

The four *Open* items are the ones worth acting on, and on three of them the
document is simply right: there is no staging environment (§3's real half), no
payment processing (§9), and no second LMS route (§14). The fourth (§7) is not
a gap in the app but a gap in the sentence it proposes to advertise, and it is
the one that could cost something.

---

## 1 · The onboarding gate · **Already built, and it is the fix**

> *"The AI-key gate currently blocks the app's own upload-a-syllabus CTA for
> signed-out new users … functionally the same 'paywall the core action'
> mistake your own competitor research flags Due Gooder and UpAhead for."*

**What the code does.** `screens/Import.tsx:754` draws the gate *instead of* the
build button when `configured()` is false, and `:786` draws it at rest before
any file is staged. That is the shape five other key-gated screens already had,
and `components/NeedsKey.tsx` exists to state it once.

**Why it is the fix rather than the bug.** `screens/deadends.test.tsx:339`
carries the reasoning and the history: the button used to be drawn live whatever
the key situation was, with the gate as a grey paragraph underneath it. Pressing
it read the files, spent the wait, and answered *"No key yet"* into an error
card — "the dead end with directions printed on it … on the one screen where it
costs a pilot its first minute". `ACTION-PLAN.md` item 1 records it landing on
19 September.

**And it is not a paywall, which is the part that matters for the comparison.**
Nothing behind that gate costs money. `lib/assistant.ts:320` (`routeWhy`) names
whichever of four situations the reader is actually in, and every one of them
has a free way through: sign in and use the shared key, or add your own.
`Import.tsx:103` (`NO_KEY_HERE`) then says that two of the screen's four doors —
adding a course by hand, opening one somebody shared — need no key at all, and
both are drawn *above* the gate. Due Gooder and UpAhead put the syllabus upload
behind a payment. This puts one of four doors behind a free sign-in and says so.

**The test has a control**, which is the reason to trust it: a test that only
ever saw the gate "would also pass against a screen with no button at all", so
the second case sets a key and asserts the button returns.

Nothing to do.

## 2 · The production key secret · **Not a code item — and the app already probes it**

> *"the ANTHROPIC_API_KEY secret isn't set on production … the single
> highest-leverage fix available right now."*

Whether the live Supabase project holds that secret is not knowable from this
container, and this file does not claim it either way. What is checkable is the
claim underneath it — that a student would discover the absence by picking a
syllabus and waiting — and that one no longer holds.

`lib/claude.ts:1224` (`checkShared`) is a **deliberately unauthenticated** probe
of exactly this state, wired into Settings → The assistant at
`screens/settings/Assistant.tsx:97`. The edge function looks for its key
*before* it looks at the caller's token, so a POST with no `Authorization`
header reaches the one thing worth knowing and stops two steps short of the
meter — it cannot spend a generation, and it works signed out. Its 501 branch
answers in words:

> *"The function is deployed and has no key in it, so signing in buys nothing —
> every account gets this."*

Its docstring is about this precise failure: the screen used to say *"Signed in,
so this is already working"*, which "is true of the *account*, which the app can
see, and a guess about the *deployment*, which it cannot."

So the deployment step stands as the document says. The blindness it describes
does not.

## 3 · "No CI/CD gate" · **Wrong**

> *"No staging environment. Every commit deploys straight to production — this
> is literally how the course-deep-link bug reached real users. No CI/CD gate,
> no monitoring or alerting…"*

`.github/workflows/ci.yml` runs on `pull_request` to `main` and on push to
`main`, and it runs six things: `npx tsc -b --noEmit`, `npm run lint`,
`npm run check:university`, `npm run check:video`, `npm test`, and
`npm run test:zones`. Two more workflows sit beside it — `contrast.yml`
(nightly browser sweep) and `functions.yml` (edge-function deploys, with
`--no-verify-jwt`).

Its concurrency block is worth reading before anyone reports this gap again: it
groups `main` *by commit* rather than by ref, because at this repository's merge
rate "three pull requests merged inside two minutes, and each merge killed the
run checking the one before it". Somebody has already been here.

**The half that is right, and it is the useful half:** there is no staging
environment, and CI passing is not the same as a deploy being gated on it.
"Stand up a staging environment" stays on the list. "No CI/CD gate" does not.

## 4 · The migration history · **Already built**

> *"the production schema currently can't be rebuilt from the repo (8 migrations
> are missing SQL)."*

True when written down somewhere, and repaired before this document was dated.
`MIGRATION-HISTORY.md` opens with **"The repair is done."** All eight of the
named migrations — `schema`, `classmates`, `classmates_schools`, `rooms`,
`groups`, `push`, `records`, `calendar` — now carry SQL in
`supabase/migrations/`, from `20260901000100_schema.sql` (4,804 bytes) through
`20260901000800_calendar.sql`. **None of the seventeen files there is empty**,
measured with `find supabase/migrations -name '*.sql' -empty`.

The second fault that document names, ten migrations existing only in
production, was closed the same day into `supabase/history/`, byte-for-byte, as
a record rather than a migration set.

**The numbering moved under this review twice while it was being written**, an
hour apart, and that is worth recording rather than quietly correcting. First
`9d9f1ae` renumbered the later migrations out of the past — a version stamped
earlier than a deploy can reach is a migration that silently never runs — and
then `ff04f84` renumbered one more that had been merged into the sequence ninety
seconds behind it, in a collision between two merges that were each correct
alone: `#600` added the LTI migration numbered into `#587`'s sequence while
`#588` moved the watermark to `20260921150750`, leaving a migration that a
deploy could not apply and would not skip. `#600`'s CI had run before `#588`
merged, so the guard did not exist on its branch — "a window, not a hole", in
`ff04f84`'s words, and the remedy for it is a branch-protection setting rather
than code.

Anything citing these filenames by number should be re-read rather than trusted,
this file included — and so should the count. This section said **sixteen files,
none empty** when it was written, and thirty minutes later `#614` added
`20260921160100_lti_identity.sql` and made it seventeen.

*None empty* is the claim that survives, because it is a claim about the repair.
The count is not, and neither are the filenames: both are a reading of a
directory several sessions are writing to at once. That is the distinction to
carry into anything published — state what was repaired, not how many files it
took this hour.

## 5 · Retention, audit log, incident response · **Already built, all three**

> *"Write a data-retention schedule, access-audit log, and incident-response
> runbook."*

Three files and a migration:

| Asked for | Where it is |
| --- | --- |
| Data-retention schedule | [`RETENTION.md`](RETENTION.md) — and it records a *decision*, not an absence: the privacy page already promises no schedule over a student's own work, so ageing records out would break a promise. The one genuinely open piece, `sweep_tombstones`, is scheduled weekly at 90 days in `supabase/scheduler.sql` |
| Access-audit log | `supabase/migrations/20260921143653_access_log.sql` (13,451 bytes) |
| Incident-response runbook | [`SECURITY.md`](SECURITY.md), whose own opening line is that what this project had instead was a sentence |

`ACTION-PLAN.md` items 12 and 13 record both landing.

## 6 · The two AI-parity items · **Both already built — and the second landed mid-review**

> *"Ship the two most buildable AI-parity items already scoped — voice mode for
> Ask Claude and a lightweight cross-tool memory profile — while Semester still
> has a depth advantage on schoolwork specifically."*

**Cross-tool memory was already built.** `lib/aboutme.ts`, merged as part of
#571. Its docstring is the same argument the document makes: every assistant
feature "starts from nothing … So they say it again, in every tool, every time —
or more often, they say it once, watch it not stick, and stop saying it."
`preamble` is appended inside `ask`, which is "the single door every assistant
feature in this app leaves by — twenty-five call sites", deliberately rather
than per-caller, because "a memory that reaches four of the tools is worse than
none".

**Voice mode was open when this review began and was merged before it ended.**
`#604` — *"Both halves of a spoken conversation were already here, and had never
met"* — lands it, and this section is a record of that rather than of anything
done here.

It is not the small version. `lib/voiceloop.ts` is a four-phase state machine —
`off`, `listening`, `thinking`, `speaking` — joining `lib/mic.ts`, which has
been filling fields since lecture notes, to `lib/speak.ts`, which reads drill
cards. The point of it being a module rather than component state is the
**echo hazard**, and the docstring is worth quoting because it is the kind of
bug that funds itself:

> *"A phone speaking an answer through its own speaker is a phone whose
> microphone can hear the answer. Leave recognition running while it talks and
> the app transcribes its own voice, sends it as the next question, answers
> that, and is away — a loop that costs money on every turn and cannot be
> stopped by staying quiet, because the person staying quiet is not the one
> talking."*

So the microphone is a function of the phase and nothing else, asserted
exhaustively, and a component cannot reintroduce the bug because it is not the
component's decision. The other judgement worth recording is that **a final
result does not send** — people pause mid-thought, and `QUIET_MS` of silence is
what ends a turn, because "deciding when somebody has finished talking is the
hard half of hands-free, and it cannot be read off the transcript".

The control goes inside the pill beside send, on both surfaces through the
shared component, and is **hidden rather than disabled** where the browser has
no recogniser — "a dead microphone invites tapping, and Firefox has no speech
recognition at all, which is not a state somebody can fix by trying again."

### What this section previously proposed, and why it is not here

This review originally built the smaller thing: dictation into the composer, on
the model of the six long fields that already have `components/Dictate.tsx`.
`#604` merged while it was in flight and occupies the same square inch of the
same control, so it was dropped rather than reconciled — `CLAUDE.md` is explicit
that a merged decision is a decision, and two microphones in one pill is not a
design anybody would choose.

One difference is worth leaving on the record rather than in a deleted branch,
because it is a question about the feature rather than a complaint about the
merge. **The loop sends; dictation composes.** `#604` turns speech into a sent
question after a pause, which is the right shape for asking something walking to
Furman. It is not the shape for building a long or precise question by voice and
editing it before sending — the case `Dictate.tsx` was written for, in its own
words, because "typing a paragraph … is the slowest thing in the app", and the
case that matters most to somebody who cannot comfortably type at all.

Those are different interactions that happen to want the same glyph. Whether the
second is worth a second affordance is the author's call and needs no code to
decide; it is recorded here so that the next person to notice the gap finds the
argument instead of rediscovering it.

## 7 · "Free and unlimited" · **Open, and the wording matters**

> *"Advertise the free/unlimited moat … say plainly in landing copy and the
> pitch that Semester is unlimited where rivals cap or paywall."*

This is the recommendation most worth pausing on, because the document proposes
putting it in outward-facing copy and the repository qualifies it.

`supabase/functions/claude/index.ts:36`:

```ts
const MONTHLY_CALLS = Number(Deno.env.get('MONTHLY_CALL_LIMIT') ?? '60');
```

and `:110`, in the app's own words to the student once `used > MONTHLY_CALLS`
(the figure interpolated, so it reads "60" on the default):

> *"That is 60 generations this month on the shared key. Add your own key under
> Ask Claude → Settings to carry on — it bypasses this limit."*

So the honest form of the claim has two halves, and both are still strong:

- **The planner is free and unlimited** — courses, deadlines, workload fitting,
  grades, the calendar, sharing. No cap, no tier, no payment path (§9).
- **The shared AI key is free and metered at sixty generations a month**, and
  your own key removes the meter.

That is a better sentence than "unlimited" anyway, because it is defensible
under a competitor's screenshot and because 60/month is genuinely generous for
syllabus parsing. Saying "unlimited" flat, in landing copy, against a product
that meters, is the one thing in this document that could cost more than it
gains.

## 8 · The engineering figures · **Two stale, one unreproducible**

> *"11,108 tests across 546 files, 217 Row-Level-Security policy checks, zero
> orphan files, zero TODO stubs … put those numbers in outward-facing
> materials."*

Measured when this review began, on `77c4c0a`:

| Figure | Document | Measured | How |
| --- | --- | --- | --- |
| Tests | 11,108 | **11,265 passed, 10 skipped** | `npm test` |
| Test files | 546 | **558** | same |
| RLS policy checks | 217 | **not reproducible** | see below |
| TODO stubs | zero | **zero — confirmed** | `grep -rn 'TODO\|FIXME' app/src` |

The test figures are stale-low, which is the harmless direction and is simply
the merge rate: `6c2fb1d` recorded 11,236 across 554 files on 21 September, and
by the time this review was finished — the same afternoon — `08dbff4` measured
**11,451 across 569 files**. Four figures, one afternoon. Any number of this kind put
into outward-facing material should carry the commit it was measured on, for
exactly the reason this row exists.

**"Zero TODO stubs" survives checking, and nearly did not.** The grep returns
two hits outside the tests, both in `lib/script.ts:51` — and they are a
*docstring about* a TODO, describing what a drafting tool emits for a person to
replace before an episode is rendered. Counting them would have reported a
defect that is not there, which is the failure mode `CLAUDE.md` names about
probes: "measuring six suspects and finding six problems is also what a broken
probe looks like." The claim is correct.

**The 217 does not resolve.** The string appears nowhere in this repository, and
nothing measured comes to it. The two defensible counts are:

- **84 `create policy` statements** — 51 in `supabase/migrations/`, 33 in
  `supabase/history/`.
- **167 assertion call sites** across the fourteen `supabase/*.check.sql` files,
  which are the things that actually *check* a policy: they make their own
  users, assert that a stranger can neither read nor write, and roll the whole
  thing back.

The file count in that second row was thirteen when this section was written and
fourteen half an hour later, while **167 and 84 both held across the same
window**. That is the more useful thing to know than either number: what the
suite asserts is stable on the scale of an afternoon, and how many files it is
spread over is not. Publish the assertion count, not the file count.

Either is a good number and both can be regenerated on demand. Since this
document's recommendation is specifically to put the figure in front of a
university partnerships office or a seed investor, it should be one that
survives being asked "how did you get that?" — which is the same standard
`CLAUDE.md` already sets internally for commit messages.

## 9 · Payment processing · **Open, and correct**

> *"Stand up real Stripe payment processing before charging anyone — it doesn't
> exist yet despite pricing already being modeled."*

Correct. There is no payment code in `app/src` — the seven matches for "stripe"
are all CSS stripes on course rows and spreadsheet fills. Nothing in the
repository can take money.

## 10 · Google OAuth · **Already built in code; a deployment step outside it**

> *"Turn on Google OAuth in the account UI."*

The code half is closed. `lib/cloud.ts:291` reads GoTrue's `/auth/v1/settings`
— public, needing only the key the app already ships — and takes its `external`
record as "the dashboard's own switch list", drawing only the providers actually
switched on. So a provider left off no longer draws a button that fails after
the press, and the sentence beside the buttons is generated from the same record
rather than written by hand (`:235`, whose docstring records the failure that
taught it: the paragraph named two providers by hand while a third had been
added to the record, so the app drew an Apple button under a line saying "Any
Google or Microsoft account works").

It is careful in the way this repository tends to be: it reads "our three and
nothing else", because the record carries a dozen providers the app does not
offer and "a `true` beside one of them is not a button anybody asked for"; and
`null` means *the question could not be asked* rather than "none".

Pasting client IDs into the Supabase dashboard is the remaining step, and it is
not one this repository can take. `ACTION-PLAN.md` item 2 says the same, and
adds that this is "the item most often reported as missing".

## 11 · Gradescope, Turnitin, Top Hat · **Already filed, and the research agrees**

> *"Gradescope has no public API at all; Turnitin requires a multi-month formal
> partner process; Top Hat has no student-data export."*

Correct, and already the subject of its own tracked review:
[`GRADESCOPE-TURNITIN.md`](GRADESCOPE-TURNITIN.md), checked against `9d8c7f4`
on 21 September, which reaches the same conclusion from both vendors' own
documentation and records that two citations in the source research do not
survive re-checking. `538f5c4` landed two of the three native workarounds.

## 12 · IP and trademark · **Already written up; the search itself still open**

> *"Vanderbilt IP ownership is unresolved (the CTTC email is drafted but
> unsent), the 'Semester' trademark has never been searched."*

Both were rewritten into [`IP.md`](IP.md) in #517 on 19 September, with the
deciding facts as a checklist and a ready-to-send email. The trademark section
answers a question the document does not ask and which comes first: whether
"Semester" is registrable at all. It very likely is not — *merely descriptive*
under **15 U.S.C. §1052(e)(1)** for software that plans a semester, refusable
with no prior mark in sight. A desk check also turned up **`SEMESTERWARE`,
Reg. 3195876 (2007), for educational software**.

The clearance search itself is still unrun — the USPTO databases are blocked
from this container, and a search nobody ran is not one to report. So the
document's action item stands; what changes is that it should be run knowing the
descriptiveness problem exists, because that is the one that does not go away
whatever the search returns.

## 13 · The pricing reconciliation · **Open, and the two documents disagree**

> *"Pricing and cost figures disagreed across older docs … now reconciled inside
> this project, but unconfirmed whether the pitch deck, business plan, or
> scenarios workbook outside the project were updated to match."*

`ACTION-PLAN.md` item 9 still records this as **Open**, with the four specific
collisions: license fee $25K vs $100K, premium $6–7/mo vs a flat $72/yr,
infrastructure $7.80 vs $3.00 per user per year, conversion 10%/12% vs 9%/10%.

Both documents place the source files in the project folder rather than in this
repository, so neither can be checked from here — but they disagree about
whether the work is done, and that disagreement is itself the finding. One of
the two is stale. Worth ten minutes before the next pitch, since the action plan
calls this "the most likely thing a numerate investor catches".

## 14 · The Canvas IgniteAI reading · **Open; the structural answer is partly built**

The strongest strategic point in the document, and no verdict is owed on the
market half of it. On the code half: the "works across every LMS" answer is not
only a positioning claim. `lib/feedlink.ts` takes a calendar feed from any LMS,
and `lib/canvas.ts` (19 September) reads Canvas with a token the student issues
themselves — depth on the LMS that matters most, with no institutional
agreement. That module's docstring names the limit a feed cannot cross: an .ics
"says when a thing is due and nothing whatever about whether you did it".

`ACTION-PLAN.md` item 8 restates what is actually still open, and it is narrower
than "depth or breadth": whether a *second* LMS's self-serve route is worth
building before there are students on the first one.

**And that moved while this file was being written, which is the lesson twice
over.** `6660785` (21 September, twenty commits after the snapshot this review
started against) lands the first slice of a **Brightspace LTI 1.3 launch** —
validated handshake, the rules in `_shared/lti.ts` as a pure importable module
because "an LTI tool that gets this wrong does not fail: it succeeds, for the
wrong person, and neither end logs anything unusual".

The reasoning matters more than the feature for this document's purposes,
because it is the answer to the Canvas IgniteAI threat stated as engineering
rather than as positioning: **LTI 1.3 is a 1EdTech standard rather than a vendor
product**, so Brightspace launching Semester needs a school administrator and
*no partner program*. That is a route a single-LMS agent structurally cannot
match, and it does not depend on anybody at Instructure agreeing to it.

So the strategic recommendation in the document — reframe from "AI-native
student assistant" to "the layer that works across every LMS" — is the right
one, and the repository is further along it than the document knew.

---

## What this review changed, which is nothing but this file

No code. One item (§6b) was open when this began, and `#604` merged it while
this was being written — see that section for what landed and for the one
question it leaves, recorded there rather than acted on.

That outcome is worth stating plainly rather than quietly, because it is the
fourth time in this file that main moved under a finding, and the first time it
moved under a finding this review had already built against:

| What moved | When | Effect on this file |
| --- | --- | --- |
| `9d9f1ae` renumbered the later migrations | before the snapshot | §4 was already stale as written |
| `6660785` landed the Brightspace LTI launch | mid-review | §14's open question narrowed |
| `ff04f84` (`#608`) renumbered the LTI migration | mid-review | §4's note, twice rewritten; unblocked this branch's CI |
| `#604` landed the voice loop | mid-review | §6b rewritten from *Open* to *Already built*; the code this branch had written for it was dropped |

`CLAUDE.md` asks two things of anybody who finds their work already done, and
both were done here. **Does their fix cover every instance yours would have?**
`#604` covers more: a four-phase loop with the echo hazard handled in a testable
module, where this branch had a button that filled a field. **Did they leave the
recurrence open?** The one thing their loop does not do is compose-then-edit,
and §6b records the argument so the next person finds it rather than rebuilding
it.

The same question was asked of `#608` and answered the same way: its fix is
larger than the one this branch deliberately did not write, because it also
found a third hardcoded copy of the watermark in `supabase/rehearse.sh`.

### Verification

Every file and line quoted in this review was opened rather than inferred, and
every figure was measured on the tree it names rather than carried from the
document under review. Where a figure disagreed with the document, both are
printed (§8). Where a measurement cleared a claim the cheap signal convicted —
the two `TODO` hits that turned out to be a docstring *about* a TODO — the
reason is stated rather than the count silently corrected, because `CLAUDE.md`
is right that "a clean reading is a claim about the probe too".

### Gates, on `08dbff4`

This file adds no code, so the gates are a statement about the tree it was
checked against rather than about a change:

```
npx tsc -b            exit 0
npm run lint          exit 0 — oxlint clean, styles ok, labels ok
npm test              569 files, 11,451 passed, 10 skipped, exit 0
npm run test:shuffle  same, seed 1790010840690
npm run build         exit 0
```
