# Playbook review — the September strategy document, checked against the code

The current-state analysis and four-pillar playbook, read item by item against
`5361261` on 21 September 2026, with the app driven and measured where a claim
was measurable.

**Eleven of its code claims are wrong, and they are wrong in the expensive
direction: the thing is built.** The document's Phase 0 asks for a server-side
AI gateway, an adversarial test set for Quote Verification, and five study
modes. All seven exist and are wired. Its two measured accessibility claims
are both wrong and in different ways: "touch targets under 44px" was
re-measured here in real Chromium across fifty-eight destinations, two
viewports and three densities, and the WCAG AA failure count is zero in all six
cells — 44px is the AAA aim, not the failure line — while "text elements under
12px" is not a WCAG criterion at all.

The eleven are enumerated below with the file or the measurement behind each.

**The one item that was genuinely open is built here.** The document asks for a
"≥98% accuracy, 100% citation mapping" gate and neither the number nor a method
existed; `app/src/lib/extractaccuracy.test.ts` is the method. It reported a
defect on its first run — a PDF schedule table losing its column boundaries —
**and the defect was not real.** It came from the test stub rather than from the
app, which is worth more of this document than the gate is.

This is not the first time this repository has caught an audit in the same
position. [CLAUDE.md](CLAUDE.md) says why it keeps happening and
[ACTION-PLAN.md](ACTION-PLAN.md) carries the previous instance: "a plan item
that has quietly landed is worse than no plan item, because somebody will spend
a week on it." The playbook's *strategy* is mostly untouched by this — pillars 1
through 4 are business judgment, not claims about the tree — but two of them
rest on a premise about the code that is false, and those are marked below.

Legend: **Landed** (in the app; nothing to do) · **Partly** (some in, the rest
named) · **Open** (nobody has done it) · **Not a code item**.

---

## Section 1 — "Current Operational Gaps & Debt"

| Claim | Verdict | Evidence |
| --- | --- | --- |
| "Syllabus parsing and content generation rely on student-supplied AI API keys… the primary barrier to external user adoption" | **Landed** | `supabase/functions/claude/index.ts`. The Anthropic key is a function secret and never reaches a browser; the caller's JWT is verified against the project so it is not an open relay; usage is metered per account in `usage` with a monthly cap counted in one atomic statement; streaming passes through. The client builds the URL at `app/src/lib/assistant.ts:132` (`${base}/functions/v1/claude`) and `lib/allowance.ts` reads the `X-Calls-Remaining` header back. A device key is still *preferred* when set — the gateway is the fallback, which is the right order — so a reader who tests with their own key configured will not see the gateway fire. **Remaining: deployment, not code** (`supabase secrets set ANTHROPIC_API_KEY`, `supabase functions deploy claude`, and the `usage_atomic` migration). |
| "Multi-user testing… licensing infrastructure, institutional SSO/Vanderbilt integrations, formal compliance/accessibility audits are Not Yet Started" | **Partly** | Accurate for SSO, licensing and the *formal* audits. Not accurate for the account layer underneath them: `lib/cloud.ts` holds accounts and cross-device sync, `lib/merge.ts` reconciles field by field (last-write-wins across the whole copy was destructive and was replaced), `lib/invite.ts` gates sign-up, and row level security is exercised by sixteen `.check.sql` suites that `supabase/check.sh` runs against a throwaway Postgres with synthetic account pairs (see item 2 of the next section, and the caveat about what `migrations/` is not). Attached files deliberately do not sync and the screen says so. |
| "Key modes (Watch, Cases, Listen, Figures, Slides)… remain in partial or planned states" | **Landed** | All five are in `app/src/lib/modes.ts` with the other six, each carrying a `ready` flag and a `missing` sentence. They are *content-gated*, which is not the same as unfinished: Figures is unavailable on a course with no diagrams because that course has no diagrams. `listen` is the sharpest case and the comment in the file argues it — a script is not an episode, so a course with a generated running order does not get to print "1 episode" and look identical to one with three recordings behind it. |
| "cross-course tools (Exam Runway)… remain in partial or planned states" | **Landed** | `lib/runway.ts` counts the four weeks before an exam backwards from it, in bands, over undrilled units, never-answered cards, cards due back, papers sat and every other deadline standing between now and the exam. `lib/meet.ts` (Where Courses Meet) is built too. |
| "production utilities (Spreadsheet, Document Editor) remain in partial or planned states" | **Landed** | `lib/sheet.ts`, `lib/sheetedit.ts`, `lib/sheettemplates.ts`; `lib/document.ts`. |
| "University Services exist only as non-transactional 'Prepare-Only' scaffolds" | **Landed, and correctly so** | `app/server/institution/` has adapters for registration, advising, money, family, career, housing, clubs and athletics, plus `sandbox.ts` and `gateway.ts`. Prepare-only is a deliberate stage gate, not debt — `lib/role.ts` states the reason at length: a role that reads *somebody else's* data needs a server, an authenticated identity on both sides and an authorisation model, and shipping those as screens holding only what you typed in would be "a confident thing that is not true." |
| "Unincorporated entity with no formal IP assignment agreements or signed legal terms" | **Not a code item; already written up** | [IP.md](IP.md) carries the Vanderbilt IP question, the trademark position including the descriptiveness refusal under 15 U.S.C. §1052(e)(1), the deciding facts as a checklist and a ready-to-send email. Still open as *work*; not open as *analysis*. |
| "Deployed at 0 active users beyond the founder's personal use" | **Not a code item** | Stands. |

---

## Section 2 — "Immediate Improvements", item by item

### 1. Server-side AI gateway — **Landed** (deploy step open)

See above. This is the document's stated "critical cross-cutting prerequisite
for all Phase 1 Study Modes", and it is the item most likely to cost a week to
rediscover.

### 2. Account, auth & sync foundation — **Partly**

Built: accounts (`lib/cloud.ts`), cross-device sync, field-level merge
(`lib/merge.ts`), invite gating (`lib/invite.ts`).

**RLS re-verification is further along than the document assumes, and the
reason is worth reading.** `supabase/check.sh` applies every migration to a
throwaway Postgres and runs sixteen `.check.sql` suites — 348 policy checks,
run here rather than quoted — each of which makes
synthetic users, walks a *pair* of them through what real accounts would do,
asserts what each may see, and rolls back. That pairing is the whole point —
"a policy is only ever wrong in a way you notice when a second account is
involved." Before the runner existed the only way to run one was to paste it
into the live project's SQL Editor against real data by hand, so they were not
run, and two had been failing on their first block since the migration that
broke them: because a failed block aborts the transaction, thirteen of
twenty-two checks in `records.check.sql` and all twenty-five in
`classmates.check.sql` had never executed.

**`supabase/migrations/` is not a history of the live database**, and `#570`
(merged mid-review) is the proof: ten migrations had been applied to the live
project through the dashboard or the management API and never had a file in the
repository, and the eight base files have been edited continuously to absorb
every later migration, so there is no order in which all twenty-five replay.
The ten sit under `supabase/history/` now, byte-for-byte against per-row md5s,
deliberately *not* in `migrations/`.

**It does, however, build production, which is the question that actually
matters** — and this review got the open item wrong before checking. `#577`
(filed two minutes before this review, and merged while it was being written)
fingerprints production
against a build from `migrations/` on a throwaway Postgres over six md5s:
columns, constraints, indexes, function definitions, function code with
comments stripped, and policies. Five of six match; the sixth is comments, four
functions having been applied to production with their bodies stripped and
every statement in them identical. Its control — the same build with four files
production has never had, added back — moved all six numbers, so the probe is
shown to be a probe.

On that evidence `#577` establishes that **step 3 does not need doing** (the eight files
are a correct baseline of 15 September, not a damaged record of 1 September, and
what ran on 1 September is lost for good) and **withdraws step 5** (filling the
eight blank ledger rows would assert a history that errors ten times on replay:
a blank row is visibly blank, a filled one would be wrong and look right).

**What is actually open is step 6, and it is a decision rather than a task** —
see item 4 of the closing list. `#577` also found, on the way, that
`grants.check.sql` could not see an open grant on `rls_auto_enable()` until
`local.stub.sql` was made faithful to what the platform installs; a database
rebuilt from `migrations/` had that grant open, though production had closed it
on 7 September. That is the sharpest available argument for the check suites
existing, and for their stub being honest.

Also open: the pilot allow-list as an operational list of people.

### 3. UX & UI cleanup — one **Landed**, one **Landed**, one **not a WCAG failure**

**"Fix global search to index plain-language terms (e.g. returning Doc mode
when searching 'study guide')" — Landed, and the example resolves to a
different screen than the document expects.** `study guide` returns **Study**,
not Doc, and that is the right answer: Study is where "Create study guide"
lives. The defect was real and is fixed — the four ranking tiers all asked
about the query as one unbroken run, so a phrase whose words sit apart in the
registry scored zero everywhere and the bar said "No app matches that" to the
thing this app is best at. `lib/desk.test.ts` now holds it from six directions,
including two controls worth noting: a test that a phrase is not scored where
two fields happen to abut (the first draft of the fix passed against the
unfixed matcher, because the space joining two fields spelled the phrase out at
the seam), and a test that one-word queries score exactly what they scored
before.

**"Move developer/admin configuration portals off student-facing screens" —
Landed as mechanism.** `lib/role.ts` defines six roles and `forRole` filters
the destination registry; `nav.ts` applies it in `destinationsIn`, `offered`
and the recents list. Exactly one surface in `src/screens` and
`src/components` is gated on `import.meta.env.DEV` (`components/Page.tsx:117`).
Worth saying plainly: `role.ts` is explicit that none of this is a security
boundary — it decides whether a screen exists, never whether somebody is
allowed to see one — so if the concern behind this item was *authorisation*
rather than *clutter*, it is still open and belongs with the institutional
server.

**"Fix measured WCAG accessibility issues (resolving touch targets under 44px
and text elements under 12px)" — the first half is Landed; the second half is
not a WCAG criterion.**

Re-measured here, twice, in real Chromium against fifty-eight destinations on
two tiers and all three densities (`npm run sweep:targets`):

```
under 24px — WCAG 2.5.8 AA, the actual failure line
  phone    Comfortable 0/1476 · Snug 0/1476 · Tight 0/1476
  desktop  Comfortable 0/2078 · Snug 0/2078 · Tight 0/2078

under 44px — WCAG 2.5.5 AAA, an aim and not a failure
  phone    Comfortable  806/1476 · Snug  871/1476 · Tight  863/1476
  desktop  Comfortable 1421/2078 · Snug 1468/2078 · Tight 1473/2078
```

The 44px figure the document quotes is the **AAA** target. Reporting it as the
failure inflates a clean AA result into roughly seventy percent of the app
being broken. `#567` closed the last of the real ones the day before this
review — 33 on phone and 36 on desktop at Tight, all of them controls whose
padding existed to be tap reach and was taken back by a negative margin or a
neighbour painting over it — and `styles/reach.test.ts` holds the mechanism
with seven faithful reverts.

**Sub-12px text is not a WCAG failure.** WCAG has no minimum font size. The
criterion that governs small text is 1.4.4 Resize Text (AA), and the app
already satisfies it: `App.tsx` sets the root as a *percentage* of the
inherited size rather than `16 * scale` px, and reads `--text-scale` back off
what that produced, so a reader who raises their browser default from 16 to 24
gets an app that follows. `a11y/type.test.ts` guards it in both directions,
including the case that started it — driven against Chromium at a 24px default,
the app had come out pixel for pixel identical, root forced back to 16, body
text 12px either way. Every other site they had made bigger; this one quietly
undid it.

The sweep does count sub-12px text and the count is large — 1475 of 3750 on
desktop, 1165 of 3078 on phone. It is **identical at every density**, which is
the tell: this is the design's type scale (`div.kicker` at 10px,
`div.soft-caps` and `span.paper-line` at 11px), not drift and not a
regression. It scales with the reader's browser. Restyling it is a design
decision somebody should make on purpose, and it is not an accessibility
defect to be "resolved".

**Corroborated since, by somebody not looking for it.** `#581` (merged) is a
type-scale naming pass that formalises exactly the sizes this count flags —
`--type-2xs` at 10px and `--type-2xs-plus` at 10.5px, covering the springboard
tile's caption, the week grid's cell and the caps kicker over a section, 38
sites across two values — and reports that nothing moved: 1,742 elements
summed, the font-size total identical to two decimal places before and after.
A second session arrived at this file's conclusion from the other direction.
These are a deliberate scale being named, not drift to be fixed.

The denominator moved while this was being written and the verdict did not.
`#576`, merged since, makes the maps screen's dead-tile panel `inert` rather
than merely covered, which withdraws four controls from the census: the figures
above are the re-measurement on the merged tree, 1480 having become 1476 on
phone and 2082 having become 2078 on desktop. The four "answering nowhere
inside their own box" are 0, and the single inline AA exemption went with them,
one of the four having been the inline attribution link. `#576` reports **AA
staying 0 at every density** on its own run, which is this review's central
figure measured a third time by somebody who was not looking for it.

One genuine note the figure does surface: `data` reads 132 of 134 text
elements under 12px, `links` 73 of 76, `applying` 57 of 62. A screen that is
almost entirely 11px is worth looking at as a *design* question.

### 4. "Complete one full vertical workflow" in a sandbox — **Partly**

`app/server/institution/sandbox.ts` exists, with adapters for each leg. Whether
the loop closes end to end was not driven here and is the honest open question
in this section.

---

## Section 3 — "Missing Elements for Market Readiness"

| Claim | Verdict | Evidence |
| --- | --- | --- |
| "Strict Integrity Standards for Quote Verification: zero confirmed false positives on an adversarial test set with independent review" | **Landed** | `app/src/lib/quotes.adversarial.test.ts` is exactly this file, and it was written the way the item asks — by someone trying to break the checker, because the false-positive direction is the one that carries weight. Four families: numbers changed inside an otherwise verbatim passage; fragments assembled from pieces that each genuinely appear, separately; a different work by the same author sharing its vocabulary and register; near-miss paraphrases. `found` and `close` on any of them is a failure of the file. It ends with three controls, for the reason CLAUDE.md gives — a file of adversarial cases that all come back `missing` is what a matcher switched off looks like. **Open: the independent review**, which is a person and not a test. |
| "Formal extraction-accuracy audit target (≥98% accuracy, 100% citation mapping) and cross-mode consistency checks" | **Built in this change** | It was the one squarely-open code item in the document. `lib/extractaccuracy.test.ts` is now the instrument — see the section below. |
| "Vetting Vanderbilt's IP policy; executing written IP assignment agreements" | **Not a code item** | [IP.md](IP.md). |
| "Opt-in data privacy policy and student consent forms prior to collecting external student data" | **Partly** | `lib/privacy.ts` and `lib/consent.test.ts` exist in the app. The policy and the forms as *documents* are open. |

---

## The extraction-accuracy gate, built here

The document asks for "≥98% accuracy, 100% citation mapping" and neither the
number nor a method existed. `app/src/lib/extractaccuracy.test.ts` is the
method. It runs in `npm test`, so unlike a sweep that needs a browser it cannot
quietly stop being run.

**What it honestly measures.** A syllabus becomes deadlines in two steps and
only one is this repository's to measure. The second is a model reading text —
it needs a key, it is not deterministic, and a CI gate over it would be
measuring the weather. The first is `lib/extract.ts`, and *that text is all the
model ever sees*: a date lost there is not a date read badly, it is a date that
is not there, and the traceability claim fails at the bottom rather than in the
middle. So the figure is an extraction-fidelity figure and the file says so. It
is the floor under the target, not the target.

Sixty-two labelled facts — dates, readings, unit titles, a room, and verbatim
sentences — carried through the same small ECON syllabus in all five formats the
app reads, plus a schedule table whose facts exist only in cells:

```
plain text  11/11      citation mapping   15/15 confirmed
HTML        11/11                           0/5  forgeries confirmed
Word        11/11
slides      11/11
PDF         11/11
PDF table    7/7
─────────────────
fidelity    62/62  =  100%      gate: ≥98%
```

**The reported finding, and why it was wrong.** `fromPdf` joins fragments on one
line with `text += str`, consulting no horizontal position. Read from the source
alone that is plainly a defect: a three-cell schedule row should come out

```
Week 3Oct 14Ch. 4
```

and `includes('Oct 14')` is **true** of that string, so the obvious probe cannot
see it. The strict probe was written for exactly this, it caught it, and the
first version of this review reported it as the harness's first find.

**Then it was driven against the real library, and it does not happen.**
`pdfjs-dist` 6.3.289, three hand-built PDFs — one text block with `Td` moves,
separate `BT`/`ET` blocks with `Tm`, and a kerned word — and pdf.js supplies the
inter-cell space itself, either inside one item's string or as its own
zero-height `{ str: ' ' }` item:

```
gap 0.00em  items=1  "aabb"        gap 0.30em  items=1  "aa bb"
gap 0.10em  items=1  "aabb"        gap 1.00em  items=3  "aa bb"
gap 0.15em  items=1  "aa bb"       gap 4.00em  items=3  "aa bb"
```

Below the threshold it is one word and there is nothing to insert; above it the
space is already there. **There is no gap width at which a rule in `fromPdf`
would add anything.** A fix had been written, tested and proven against seven
reverts before this measurement was taken; it was reverted as unreachable, and
this repository cuts unreachable code rather than keeping it as insurance — `#573`
cut `ToggleRow` on the same grounds.

The defect was manufactured by the stub, which omitted the space items pdf.js
actually returns. That is the failure [CLAUDE.md](CLAUDE.md) records twice: the
teardown probe that read every file as leaking, including the two already fixed.
Its lesson — *"a clean reading is a claim about the probe too"* — has an inverse
this session had to learn the hard way, that a **dirty** reading is also a claim
about the probe, and the expensive direction is the one where the probe agrees
with what you expected to find.

So the corpus's `PDF table` document now uses the fragment stream pdf.js was
observed to produce, the schedule table is gated as surviving — which it does —
and the welded string survives in the file as the one input on which the two
probes are known to disagree.

**The controls, which are the reason the 100% is worth anything.** A corpus that
scores full marks is also what a probe stuck on `true` looks like. Absent facts
must score 0; a digit-stripped text must fall far under the gate; the loose and
strict probes must disagree on the welded string; plain text must score 100%,
since a probe that fails everything would read from the summary line exactly
like a real defect in `extract.ts`. **And a stub has to be faithful to the
library it stands in for** — the control none of these four was, and the one
that mattered.

Every guard was run against a faithful revert and watched go red:

| Revert | Goes red |
| --- | --- |
| strict probe → `includes` | the assertions that it is strict |
| probe → always `true` | 5, led by the absent-facts control |
| probe → always `false` | 12, including the gate |
| `entities()` stops decoding `&amp;` | 7 — the gate, three formats, **and both citation tests** |
| `fromPdf` stops restoring line breaks | the gate to 90.3%, `PDF` to 7/11 and `PDF table` to 5/7 |
| slide numbers dropped from the flat text | the slide-number assertion alone |
| the file left off `MOCKS_MODULES` | `isolation.test.ts`, by name |

The entity revert is the one worth reading: it reds the fidelity gate *and* the
citation mapping together, because a format that ships `&amp;` through undecoded
produces a quote that cannot be confirmed against its own document. That is a
citation failure whose entire cause is in the extractor, and it is the argument
for measuring the two halves in one file.

One structural note, since this repository has paid for it before. The corpus is
scored at module load, and an extraction that threw would have errored the file
during collection — nothing would run, and the assertion written to catch that
revert would never get to make it, which is what `#567` lost a guard to. A throw
is recorded as a total loss and reported by the gate instead.

---

## Section 4 — the four pillars

These are business judgment and this review does not second-guess them. Two
corrections where a pillar rests on the tree:

**Pillar 1 asks to "complete features like Where Courses Meet, GPA Projection
and Exam Runway."** Where Courses Meet and Exam Runway are built (`lib/meet.ts`,
`lib/runway.ts`); GPA Projection is `lib/termgpa.ts` — "the GPA this term is
heading for, which the app had every number for and never worked out" — built
over `lib/grades.ts`, `lib/worth.ts`, `lib/cutoffs.ts` and `lib/degree.ts`. The
pillar's *positioning* — grounding as the defence, the context and verification
layer between the LMS and the student — is unaffected and is the strongest claim
in the document. Worth adding to it: `lib/canvas.ts` already reads Canvas with a
token the student issues themselves, which is that layer, built with no
institutional agreement required.

**Pillar 2's Tier 1 proposes "read-only calendar file imports (e.g. Brightspace
exported `.ics`)."** `supabase/functions/fetchcal`, `supabase/functions/calendar`
and `supabase/functions/canvas` are already in the tree. Tier 1 is closer to
done than the pillar assumes; the Canvas path goes further than `.ics` and cost
no institutional friction, which is evidence *for* the pillar's thesis rather
than against it.

**Pillar 3's case against ads** (≈2.5% of Year 10 revenue against the cost to
trust) is the sort of argument this repository likes — a decision with a
measured number attached — and nothing here contradicts it.

---

## What to actually do next

1. **Deploy the gateway.** It is written, tested and unreachable. Three
   commands, and it removes the stated primary barrier to external adoption.
2. **Nothing, on the schedule table.** The instrument reported a defect there
   and the defect is not real (above). Recorded because a retracted finding that
   leaves no trace is how the next pass finds it again.
3. **Get the independent review of the adversarial quote set.** The test set is
   done; the second pair of eyes is the part that is a person.
4. **Make the call in step 6 of [MIGRATION-HISTORY.md](MIGRATION-HISTORY.md).**
   This is the one item on this list that is *yours* rather than an engineer's,
   and it is blocking a deploy. Four merged migrations are numbered
   `20260901000900`–`20260901001300` while production carries thirteen
   migrations with higher numbers, so they cannot apply where they sit. Either
   four already-merged files get renumbered — which changes the key the ledger
   is built on — or they are applied by hand and a fourth version stops
   matching its filename. **Until that decision is made, production's schema
   deploy stays broken and the `supabase/` merge freeze stands.** The strategy
   document files all of this under "Supabase RLS re-verification", which
   understates it to the point of hiding it.
5. **Stop re-deriving the app's status from prose.** [COMPLETION-PLAN.md](COMPLETION-PLAN.md),
   [ACTION-PLAN.md](ACTION-PLAN.md) and now this one have each been caught
   claiming something is missing that was built. `npm run counts`, `scripts/targets-sweep.mjs` and the
   suite are cheaper than a re-audit and they cannot go stale quietly.

Nothing in this review is a reason to change a pillar. It is a reason to stop
paying for seven things twice.

---

## How this was checked

Against `5361261`, 21 September 2026. Every file cited above was opened, not
inferred from a name — one citation in this review was wrong on the first pass
for exactly that reason (`lib/gpatemplate.ts` does not exist; its test covers
`lib/sheettemplates.ts`, and the comment inside that test names a third file
that has since moved). A review of stale claims is not exempt from making them.

The accessibility figures are three independent runs of
`scripts/targets-sweep.mjs` driving real Chromium over fifty-eight
destinations, two viewports and all three densities — two before `#576` landed
and one after, the quoted table being the last. All three returned 0 under the
AA minimum in all six cells. The sub-12px text count came back byte-identical
across densities in all three, and unchanged by `#576` — 1165 of 3078 on phone,
1475 of 3750 on desktop — which is what a figure about a type scale looks like
and not what a figure about density looks like.

The extraction figures are `app/src/lib/extractaccuracy.test.ts`, which runs in
`npm test`. Each of its guards was run against a faithful revert and watched go
red; the table of which revert reds which assertion is in the section above,
and the file itself carries the argument for every control.

Gates, all from `app/`: `npx tsc -b` clean; `npm run check:university` clean;
`npm run lint` clean (styles and labels audits pass); `npm test` 11,414 passed,
10 skipped, 0 failed, 566 files; `npm run test:shuffle` the same; `npm run
build` clean; `node pipeline/validate.mjs` 4 courses, 48 items, 8 episodes.

Two tests were failing on `main` while this was being written, and are fixed on
`main` by somebody else. `lib/migrationorder.test.ts` and `lib/rollback.test.ts`
both reported `supabase/migrations/20260921003700_lti.sql` as pending and below
production's watermark of `20260921150750`, so a deploy could never apply it.
They failed identically on a clean `origin/main` worktree — checked, not
assumed — so the break was the base branch's rather than this change's.

This review had the diagnosis right and wrote the fix anyway, which it should
not have. `#608` landed the same renumbering first and did more with it: it
traced the cause to `#600` merging ninety seconds after `#588`, found a **third**
hardcoded copy of the watermark in `supabase/rehearse.sh` that was rehearsing a
deploy nobody was about to run, removed every hardcoded copy, and ran
`supabase/check.sh` green — which this container cannot, `config.toml` naming
Postgres 17 where it has 16. The duplicate rename was dropped on the rebase.
[CLAUDE.md](CLAUDE.md) says to check two things when that happens, and the
second one paid: whether their fix covers every instance, and whether they left
the recurrence open.

**They left one.** `#608` fixed the two references *to* `lti.sql` and not the two
*inside* it, which cite `20260921003500_referrals.sql` and
`20260921003600_function_grants.sql` — four sites naming files that resolve
nowhere in the tree, stale from the moment `#600` merged because `#588` had
renumbered them an hour earlier. That, and the guard that stops a renumbering
leaving prose behind again, landed as
[#621](https://github.com/harrisonjrubin7-cmyk/semester/pull/621), kept separate
from this review because a migration change deserves its own reviewer.

`origin/main` moved a dozen times while this was being written, and the review
was wrong five times in the process, every time in its own characteristic way.

`#570` changed a verdict, sharpening "re-verify RLS" into the
migration-history finding. Then `#577` — filed two minutes before this one, and
merged since — contradicted the recommendation that finding produced: this file
had said step 3 was the open work, and `#577` demonstrates by fingerprint that
step 3 does not need doing and that the real blocker is step 6, a numbering
decision holding a schema deploy shut. A review whose whole subject is stale
claims managed to file one within the hour, which is why item 4 of the closing
list is phrased as a decision for the founder rather than a task for an engineer.

Then two citations: `lib/gpatemplate.ts`, which does not exist, and — in the new
test file's own header — `COMPETITIVE-REVIEW.md` as the source of the ≥98%
target, which does not contain it and never did. Both were name-inference, both
caught by grepping for the thing instead of the filename.

**And the rename above**, which was written, gated and proven against a revert
before anybody checked whether somebody else had already done it — in a
repository whose `CLAUDE.md` opens by saying to check exactly that, first, before
reading any code. `#608` had landed it an hour earlier.

**And then the finding itself.** The harness reported a welding defect in
`fromPdf`; a fix was written, gated and proven against seven faithful reverts;
and only then was it driven against the real pdf.js, which does not have the
defect. The fix is reverted. Seven reverts going red had proved the *guards*
worked and said nothing about whether the thing they guarded was real — which is
a sharper version of the rule this repository already has about probes, and the
reason the whole episode is written up above rather than tidied away.

Three of the four PRs this review leaned on — `#576`, `#577` and `#581` — have
merged since it was drafted, and their findings are folded in above; `#578` is
still open and touches the citation locators. Verdicts here are against merged
`main` at the commit named, which in this repository means a few hours.

The corrections are not a reason to distrust the central finding, and the
pattern in which of them survived is the useful part. `#576` re-measured the AA
count independently, while working on something else, and got 0 at every
density; `#581` reached this file's sub-12px conclusion from the other
direction. Those two are the claims this review is most confident in, and they
are exactly the two that were checked by somebody who was not trying to confirm
them. Every claim it got wrong — three names and one defect — it had checked
only against itself.

This review adds one file of code, and only the one it argued for:
`app/src/lib/extractaccuracy.test.ts`, the extraction-accuracy gate. It adds no
change to `lib/extract.ts`, having established that the change it wrote for it
was not needed. Everything
else it found in the app was already there, which was the point.
