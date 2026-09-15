# Whole-app audit

A pass over `app/src` for redundancy, duplication, bugs, and pathways that
break — what was checked, what was found, and what was checked and found
clean, so the next pass does not spend its time here again.

Baseline and result are both green: `npm run lint`, `npm test`, `npm run build`.

**Two of the five below were found independently on `main` while this pass ran**
and are marked as such. Their entries are kept because the reasoning is still
the record of what was wrong, not because this branch fixed them — after the
merge, main's version of each is what ships.

## What was wrong

### 1. The launcher grid answered for a student, whoever was holding it

`appShelves` and `tilesFor` in `lib/apps.ts` and `lib/launcher.ts` called
`destinationsFor` without a role. That compiles, because the argument is
defaulted, so the grid silently asked what a **student** may open — for
everybody.

Every other surface asked correctly: search goes through `offered`, the
shortcut row through `readFavourites`, Lately through `lately`, and all three
take the role. Only the grid did not, so the three gates in `lib/nav.ts` held
everywhere except the one screen whose whole claim is that it is everything.

For a teacher that is eight screens — Housing, Costs, The degree, When you are
behind, Tonight, Groupwork, Classmates, Applying — in the launcher and the All
apps list, one tap from opening, while the search field beside them had already
stopped offering them.

The existing test compared the grid against `offered` at the default role on
**both sides**, which is why it stayed green throughout.

### 2. The browser shell kept four settings of its own — *also fixed on `main`*

`components/GoogleShell.tsx` held the shortcut row's contents, whether that row
is drawn, light versus dark, and a recents list in `localStorage` under
`semester.google.*`, behind a private `usePreference` hook. All four already
had a home:

| What | Its home in this app | The shell's private copy |
|---|---|---|
| Shortcuts pinned | `look.favourites`, resolved by `lib/desk.ts` | `semester.google.favorites` |
| Whether to draw them | `look.shortcuts` | `semester.google.showFavorites` |
| Light or dark | `look.ground` | `semester.google.lightHome` |
| Where you have been | `state.recent`, filled by `push` | `semester.google.recent` |

So pinning an app there left the search home, the launcher and every other
navigation's sidebar unchanged; the Appearance switch moved a CSS class on one
`<div>` while Settings → Look went on believing it owned light and dark; and
none of it reached the account, because a look key syncs and a private
`localStorage` key does not.

That is the failure `components/desk/Customize.tsx` opens by warning against —
a panel grown until it is a second settings screen, at which point there are
two that disagree.

Three things fell out of the fix: `DEFAULT_FAVORITES` there was a fifth list of
default shortcuts, the shell's own light/dark toggle became a second door to a
setting with a screen, and the recents list was a second answer to "where have
you been".

### 3. Customize Semester could be seen, hovered, and never clicked — *also fixed on `main`*

The panel was rendered under the overlay that dims the page behind it, so every
click landed on the dimmer and closed it. Nothing threw, the panel looked
right, and the one thing it existed for could not be done.

### 4. Tab put the focus ring around a link drawn behind the header

The skip link was in the document before the header and painted under it, so
the first Tab of every page focused something invisible.

### 5. The Appearance swatches previewed the opposite of what they did — *moot on `main`*

The ground swatches drew `--app-bg` of the theme they were *leaving*.

## The duplicates

Listed in `SIMPLIFY-AUDIT.md` and merged there. Nothing new in this pass.

## Checked and found clean

Covered by the September 14 pass below.

## What guards it now

The tests named in each entry, plus the two linters `npm run lint` runs.

---

# The September 14 pass: every screen, every navigation, every layout

The brief was to run the whole application through and confirm that every
function, screen, capability and pathway is finished and works. This is what
was actually exercised, what broke, and what was fixed.

Five things were wrong. None of them could fail a test, and two were the same
shape: a capability built end to end — type, reducer, arithmetic, persistence,
and the sentence that reports it — with no control anywhere in the app to
reach it. A suite that passes its inputs in by hand can never ask where the
inputs come from.

## How it was checked

Static checks first, then the app itself in a real browser, because the two
find different things and this pass was started by the suite being green.

**Two kinds of number appear below, and they age differently.** A *measured*
row is re-run and re-stated whenever this file is touched; it says what the
repository does today. A *dated* one is a record of what this pass actually
executed and does not move, because rewriting it would be inventing a run that
never happened. Each is marked. This distinction is §4's own lesson applied to
the file that reported it: a count nothing reads goes stale silently, and the
only defence a prose number has is saying out loud which kind it is.

Measured — last re-run against `main` at `9ca4788`, 14 September:

| Check | Result |
|---|---|
| `npm test` | 8097 passed, 10 skipped, 393 files |
| `npm run lint` (oxlint · style rule · label rule) | clean |
| `npm run build` (`tsc -b` + vite) | clean |
| `npm run check:university` | clean |
| `npm run counts` | clean — and one error quieter than before, see §1 |
| `node pipeline/validate.mjs` | 4 courses, 48 items, 8 episodes, all checks passed |

Dated — what this pass ran in headless Chromium, driven per
`.claude/skills/run`, on the code as it stood:

- **1,560 screen loads.** Every screen in the `Screen` union — 81 of them, with
  real ids for the ones that name something — across all **6 navigations** and
  all **6 shells**, at phone width and at desktop width. **Zero `pageerror`s
  and zero blank screens.** (`NAVS` and `SHELLS` are still six and six, and the
  union is still 82 with `onboarding` handled before the switch, so the shape
  of that sweep is unchanged; the count of loads is the run, not a claim about
  today.)
- **Every stored-state version.** A seed at each of schema 1–6, one with no
  version marker, one from the future, one of pure garbage, and five payloads
  that are not JSON at all. All ten migration paths and all five corrupt
  payloads come up working; none throws, none lands on a blank page.
- **Both adoption pathways,** and the whole five-step onboarding to the screen
  it lands on.
- **Structural checks against the registries:** every `Screen` has a case in
  `CurrentScreen`, every source file is imported by something, every dispatched
  action has a handler, and every `Action` variant was traced to the code that
  sends it — which is how §3 and §5 below were found.

## What was wrong

### 1. `npm run counts` printed a resolver error on every successful run

`scripts/counts.mjs` borrows Vite's module resolver so the stated numbers in
the README cannot drift from the registries. It aliased `@semester/contract`
and not `@semester/institution`; `vite.config.ts` aliases both.

Nothing failed, because `lib/counts.ts` does not reach `lib/softtop.ts` and so
never asked for the missing one. The resolver still walked the tree, still
failed to find it, and still printed

```
(!) Failed to run dependency scan. Skipping dependency pre-bundling. Error: The
following dependencies are imported but could not be resolved:
  @semester/institution (imported by .../src/lib/softtop.ts)
```

above the line that says `counts ok`. An error on a passing check is worse than
one on a failing check: it teaches the reader to skip the output. It is also
exactly the drift the note at the top of that file says the mechanism exists to
prevent — a second, shorter copy of a list that has to match.

Fixed by giving the script both aliases, with the reason written beside them.

### 2. The AI Tutor button had no name on any phone

`components/desk/TopBar.tsx` draws the assistant button in the workspace top
bar as a glyph and a `<span>AI Tutor</span>`. That is a good name, until
`app.css` says

```css
@media (max-width: 759px) { .desktop-ai span { display: none } }
```

`display: none` takes an element out of the accessibility tree as well as off
the page, so below 760px — **every viewport this app is designed for** — the
button's accessible name was computed from nothing. A screen reader announced
"button" and stopped, on the one control in that bar that opens the assistant.

Three things had to line up for this to ship, and they did:

- the label rule in `a11y/labels.ts` checks `input`, `select` and `textarea`,
  not `button`;
- the button really did contain the words, so nothing in the markup looks wrong;
- the suite renders in jsdom, which parses the stylesheet and applies no media
  query, so the span was present in every test that asked for it.

It took reading the rendered page at 420px to see. Fixed with `aria-label="AI
Tutor"` — the same answer the tab bar already gives when its labels are off:
the glyph carries the picture, `aria-label` carries the name, and the button
reads identically at every width.

**And guarded,** because the trap is not that button. It is that hiding a label
in CSS is invisible from the JSX, so the next person to write a responsive
control cannot see what they took away. `hiddenNames` in `a11y/labels.ts` reads
the stylesheet for rules of the shape `.something span { display: none }` and
requires every element wearing that class to carry a name of its own. It runs
in `npm run lint` beside the existing rule and in the suite beside it, one
implementation and two ways in, the same arrangement as the style rule next
door. Verified by reverting the fix: the rule names the file, the line, and
what to write instead.

There is exactly one such CSS rule in the whole stylesheet today, and it was
the bug.

### 3. You could not keep any time for yourself, which quietly inflated every week

The largest of the four. `lib/rest.ts` is the file that answers "does this week
fit", and its own heading calls protected blocks **"the point"**:

> Meals, the gym, one genuinely free evening. Entered as fixed, subtracted like
> the floor. […] These are the ones you promised yourself, which is exactly why
> they need writing down: nobody else will defend them.

All of it was built. The `Rest` type, the `addRest` and `dropRest` cases in the
reducer, `insideRest`, the careful part of `dayCapacity` that refuses to deduct
a nine o'clock dinner twice on a day whose floor starts at eleven, the
persistence, the `readRest` validator, and the clause in `takenLine` that says
`N to what you have kept for yourself`.

**And nothing in the app could add one.** `addRest` was never dispatched from
any screen, so `state.rest` was empty on every device that has ever run this.
Which means:

- `kept` was always `0`, so the Capacity verdict on *The week ahead* ran with
  the sleep floor and nothing else and **overstated the free hours of anybody
  with a standing commitment**;
- the "kept for yourself" clause in `takenLine` was a sentence that could not
  print;
- and the whole of that arithmetic was dead weight being carefully maintained.

This is the failure the suite is structurally unable to see: every unit test
passes a `Rest[]` in by hand, so the functions are correct and well covered,
and *no test asks where the array comes from*.

Fixed by building the missing control, `Kept` in `components/Capacity.tsx`,
directly under the sleep floor that answers the same question. It is shaped
like `components/WorkWindows.tsx` deliberately — the same shape of data asked
the other way round, and two different editors for one shape is how a pair
drifts. Three suggestions to adjust rather than a blank form, which is the
argument `lib/windows.ts` already makes about its own list, and they are the
three the module names: dinner, the gym, one free evening.

Two supporting changes it needed:

- **`patchRest`.** The reducer had add and drop and no edit, unlike its sibling
  `patchWindow`. Without it, changing the hour of a standing dinner meant
  deleting the block and writing it out again. It reads the patch back through
  `newRest` so the bounds and the day list are cleaned in one place, the way
  `setFloor` above it leans on `readFloor`.
- **`SUGGESTED_REST` and `keeps`** in `lib/rest.ts`, beside the arithmetic that
  consumes them.

Measured in the browser, on a student whose windows are weekday evenings
17:00–22:00:

```
with no kept blocks : (no taken line)
after + Dinner      : 25 hours in your windows, 5 to what you have kept for yourself — 20 left.
after + The gym     : 25 hours in your windows, 9.5 to what you have kept for yourself — 15.5 left.
```

The sentence that could not print, prints.

### 4. Two counts in `lib/look.ts` had gone stale, and a skill file with them

`NAVS` and `SHELLS` are six and six. The comment over them said "every one of
the **twelve** pairings is a working app" — true when both lists were shorter,
and now describing a third of the real surface — and the note over `NAVS`
introduced "the **four** navigations" and then described four of the six.

Neither is load-bearing, which is the problem: nothing reads a stated total, so
nothing can disagree with it. Both are now written as the lists rather than as
a number, with the reason said once.

`.claude/skills/run/SKILL.md` had drifted the same way and worse, because it is
the file the next run is driven from:

- it listed **three** shells where there are six, so a sweep following it
  exercises half the layouts and believes it covered them;
- it listed **seven** navigations including `browser`, which no longer exists —
  it merged back into `workspace` and was deleted from the union. Seeding
  `nav: 'browser'` today lands in the workspace silently, because the reader
  falls back for anything it does not recognise. **This pass made that mistake
  itself**: the first sweep reported seven distinct navigations and had really
  run six, and the duplicate was only caught by the chrome probe the file
  itself insists on;
- and its §6b chrome table still told the reader that `workspace` and `browser`
  differ on `.deskstrip`.

All corrected, with the failure mode — a retired value coming up working and
wrong — written down, since that is the part a table cannot say.

### 5. The GPA was computed against a table nobody could see or set

The second instance of §3's shape, and found the same way. `lib/degree.ts`
opens by explaining why the scale cannot be hardcoded — universities disagree
about whether an A+ is 4.0 or 4.3, some award no minus grades at all — and ends
that paragraph with the rule:

> A wrong GPA displayed confidently is worse than no GPA.

`COMMON_SCALE` beside it is labelled "offered as a starting point". `setScale`
was in the reducer. **Nothing dispatched it**, so the starting point was the
finishing point: every account computed its GPA from the common American table,
`screens/Degree.tsx` printed the number without saying where the table came
from, and the line under it said the left-out courses were "not in **your**
scale" and that this was "**your** arithmetic" — both quietly claiming a
choice the reader had never been offered.

It takes both halves to fix, and neither alone would do:

- **The table is editable.** `components/GpaScale.tsx` on Settings → Grading,
  which is where somebody looking for "what the app thinks a B+ is" looks. The
  rows are the scale's own keys rather than a fixed thirteen, so a school with
  no minus grades can end up with a table that has none, and an unknown grade
  stays uncounted rather than counted as zero — which `gpa()` already did, and
  is also how pass/fail and a withdrawal stay out without a rule of their own.
- **The screen says which table it is.** `gpaLine` takes `assumed` and, while
  the table is untouched, says so and points at the screen that changes it. An
  editor nobody knows to look for does not stop a wrong number being believed;
  a disclaimer over a number you cannot change is an apology rather than a fix.

Measured in the browser, on one finished A+ worth 3 hours:

```
untouched : 4.000 across 3 hours. This is the common table, which your
            university may not use — check it in Settings → Grading.
A+ = 4.3  : 4.300 across 3 hours. This is your arithmetic, not the registrar’s.
reset     : 4.000 across 3 hours. This is the common table, …
```

`isCommon` lives in `lib/degree.ts` beside the table it is about, because two
callers that are not neighbours ask it: the editor, to decide whether to offer
a way back, and `gpaLine`, to decide whether the number rests on an assumption
or on an answer.

## Checked and found clean

Worth recording, so the next pass does not re-spend the time:

- **No unfinished work in the source.** Zero `TODO`, `FIXME`, `XXX` or `HACK`
  markers outside tests; no empty handlers (`onClick={() => {}}`); no "coming
  soon", "not implemented" or stub text. Every `placeholder` hit is a real HTML
  input placeholder.
- **No orphan files.** Measured: all 643 non-test sources under `app/src` are
  imported by something. Re-run at `9ca4788`; it was 624 when the audit ran,
  and the answer is still zero orphans.
- **Screen coverage is complete.** Every member of the `Screen` union has a
  case in `CurrentScreen` except `onboarding`, which is handled before the
  switch, as its own full-screen mode. The screens absent from `DESTINATIONS`
  are the detail screens that need an id, the fullscreen study modes, the
  settings sub-pages and the two the workspace shell uses to look at itself —
  all deliberate, and `lib/chrome.test.ts` already holds the line.
- **No dead dispatches.** Every action sent from the app is handled. The
  handful that a `case` scan appears to miss are handled by `if` in
  `state/reducer.ts` (`undo`, `say`, `forgetUndo`, `forgetSaid`,
  `forgetSyncNote`); the rest of the apparent misses are not app actions at all
  but payload discriminators for the Claude API, Supabase realtime and OOXML.
- **The empty and error states are honest.** `#/note/<gone>` says "That note is
  gone" and offers Notes; `#/classmates` without an account service says so
  plainly; `#/gap` explains what would open it. None of them is a blank screen
  pretending to be a feature.
- **Corrupt and ancient stored state cannot break the app,** across all fifteen
  payloads tried.

## The seven that were filed, and then done

The list below was reported rather than fixed in the first pass, on the
grounds that each was a missing convenience rather than something making the
app say anything untrue. Asked to finish them, all seven now have a way in.

Every one followed the same rule the codebase already states, in
`screens/Mine.tsx` over `AppointmentRow`: **the row is the thing, pressing it
turns that row into its fields, and Save puts it back.** Editing behind a
press rather than always on, because "a list that is also a page of live
inputs is a page where a stray tap lands in a field", and the draft re-seeded
when the editor opens rather than kept in sync, because "a draft that follows
the thing while you are typing in it is a draft that fights you".

| Action | The way in, now |
|---|---|
| `patchTaken` | `TakenRow` in `screens/Degree.tsx` — press a transcript row, correct any of its six fields, Save |
| `patchRequirement` | `RequirementRow` beside it — the same, including the accepts list that was the worst to retype |
| `patchPerson` | `Correct` in `screens/People.tsx`, inside the drawer that already opens on a press |
| `dropVisit` | a × on each recorded conversation, in the same drawer |
| `dropSitting` | `PaperTag` in `screens/Grades.tsx` — the score tag arms, then removes |
| `moveFolder` | a **Move** button on `FolderRow`, opening the picker files already use |
| `addTermDate` | `YourOwn` at the foot of `screens/Registrar.tsx` |

Four things worth recording about the doing of it.

**`canMove` had been written for folders all along.** It refuses a move into
the thing's own subtree — and a file has no subtree, so that guard could never
fire on the only caller it had. The picker now takes the thing rather than the
file; the old call passed the literal string `'file'` as the id, which made
the subtree check a no-op that happened to be harmless, and it now passes the
real id, which is the same answer for a file and the correct one for a folder.
Verified in the browser: offering to move *Problem sets*, the picker disables
*Problem sets* itself and disables *Drive* because it is already there.

**Two of the seven already had undo labels written for them.** `lib/undo.ts`
carried `dropVisit: { label: 'Conversation removed' }` and `dropSitting:
{ label: 'Paper removed' }` — undo copy for controls that did not exist. Both
new controls inherit it, and the toast was visible on the first run.

**A third needed one adding, by that file's own argument.** Its rule is that
an edit is not undoable because "an edit leaves the thing there to edit back",
but that the three *moves* are exceptions, because the previous state "is gone
from the screen the moment the thing lands". A moved folder leaves the view it
was in, the place it came from is not on screen to put it back from, and the
picker is a list of near-identical rows one tap apart. `moveFolder` is now the
fourth entry, with `onChange` — counting cannot see a move, since the list is
exactly as long afterwards.

**The three patches correctly get no undo,** by the same rule, and
`addTermDate` adds rather than removes.

**None of the seven needed the style ledger raised.** Where the surrounding
idiom was off the scale, the new code uses tokens instead — `var(--type-xs)`,
`var(--sp-3)`, `paddingInline` — so the per-file budgets in
`src/styles/budget.ts` are untouched.

### How they were checked

Driven in a real browser, not only in the suite, because every one of these is
a control that either exists on screen or does not:

```
patchTaken       edit opens · grade B+ → A- · row still there
patchRequirement accepts list ECON 3010 → ECON 3010, ECON 3012
patchPerson      name and role corrected · both conversations survived
dropVisit        one removed, one left, the person kept
addTermDate      20 → 21 date inputs · its own row, dated · form cleared
                 · and Clear removes it for good, where a landmark is emptied
moveFolder       picker disables the impossible rows · Problem sets leaves the
                 root and is found inside Econ
dropSitting      12% arms to "Remove?" then goes · 78% kept
```

Two driver traps worth writing down, because both cost a cycle and both are
the tester's fault rather than the app's. Every run of capitals in this app is
`text-transform`, so an exact `innerText` match on `Taken`, `Add` or `Remove?`
finds nothing — the run skill says so and this pass still did it twice. And
once a row can be edited there are **two** fields carrying each label, the add
form's and the editor's, so `querySelector` takes the form and the assertion
then reports the edit as not having happened.

## The four dead fields, deleted — three of them twice

Reported in the first pass and left alone, on the grounds that removing a
persisted field touches storage for no user-visible gain. Each had a state
field, a default, an action variant and a reducer case, and **no consumer on
either side in any commit in this repository**. They were added beside
siblings that *are* used (`setHomeTab`, `setCoursesTab`, `setMeTab`,
`setCostsTab`) and nothing ever reached for them.

| Field | Action | Who removed it |
|---|---|---|
| `calTab` | `setCalTab` | main's #318, independently |
| `loadStep` | `setLoadStep` | main's #318, independently |
| `meGroup` | `setMeGroup` | main's #318, independently |
| `picked` | `togglePick` | here — with its persistence and `EXTRACT` in `data/misc.ts` |

**Three of the four were found and deleted on `main` while this was being
written**, by #318 — "The university's own services, and the fields nobody
reads". That is the second time in one week this audit and `main` landed on
the same thing from opposite ends, after the `lib/look.ts` sentence, and it is
the same lesson: dead weight that nothing reads is invisible until somebody
goes looking, and then two people find it at once. Rebasing onto #318 left
this commit holding only what it had not done.

`picked` is the one it did not do, and the one that cost the most to pull out
— which is the useful part of the exercise, because everything that resisted
was a guard doing its job.

**`EXTRACT` fell with it.** A nine-row hardcoded list in `data/misc.ts`
labelled "what the syllabus importer finds — the ECON schedule, resolved to
dates", left over from when the importer was a mock. Its only reader was
`picked`'s default. Nothing else in the app had referenced it for a long time.

**Three other tables named the field, and three tests said so.** Removing
`picked` from the store broke `lib/export.test.ts`, `lib/merge.test.ts` and
`lib/privacy.test.ts` — the app keeps a per-field decision in each about what a
backup holds, how two devices merge it, and what the privacy page claims is
uploaded, and each has a test that fails when the store and the table disagree.
Exactly the drift-catcher this audit kept writing about, working unprompted:
the field is now absent from all four places or none.

**A stale key in storage is not a crash.** `state/storage.test.ts` asserted
over every keyed record field, `picked` among them. It keeps `picked` in its
*payloads* and drops it from the assertions, because the case worth testing has
inverted: every copy written before this still carries the field, so what
matters now is that a key this build has never heard of is ignored rather than
breaking the load. Verified in the browser as well — copies seeded with all
four fields, with `picked` holed (`{"x1":null}`), with `picked` as a number,
and with no `schemaVersion` at all, each opened and drew Calendar, Progress,
Everything, Import and Settings without a throw.

## Still open

Nothing found by this audit is left unaddressed. Every `Action` variant in
`state/shape.ts` has a sender, and no state field is read by nothing.

**Out of scope by design.** `docs/IMPLEMENTATION_STATUS.md` lists the work that
needs a real institutional integration — SIS transactions, official
transcripts, faculty grading, family billing. Nothing in the app pretends
otherwise, and the honest gates in front of those screens were checked and are
honest.

## What guards it now

- `hiddenNames` + `saysHidden` in `a11y/labels.ts`, run by `scripts/labels.mjs`
  in `npm run lint` and by `a11y/labels.test.ts` in the suite — including one
  case that asserts the app itself is clean, so the two cannot disagree.
- `lib/rest.test.ts` now covers the way in as well as the arithmetic: that the
  suggestions are complete enough to count, that an unfinished block counts as
  nothing, and that entering one takes hours out of the week *and says so*.
- `state/slices/mine.test.ts` covers `patchRest` — the fields a patch does not
  name surviving it, the id surviving it, the bounds being cleaned, and the
  other blocks being left alone.
- `lib/degree.test.ts` covers `isCommon` — the shipped table, a changed value,
  a school with fewer letters, an added one — and that `gpaLine` says the
  number is assumed while it is, claims it once it is not, and still reports
  the uncounted courses either way.
- `state/slices/mine.test.ts` covers `patchTaken`, `patchRequirement`,
  `patchPerson` and `dropVisit` — including that a patch leaves the fields it
  does not name alone, that correcting a person keeps their conversations
  where `dropPerson` deliberately does not, and that removing one line leaves
  the rest.
- `state/slices/made.test.ts` covers `moveFolder`; `state/reducer.test.ts`
  covers `dropSitting` and `addTermDate`, including the asymmetry the reducer
  documents — a landmark is emptied, one of your own goes for good.
- `lib/undo.test.ts` covers the new `moveFolder` entry, and the reason it
  needs `onChange`: counting says nothing happened, comparing says it did.
- `src/styles/budget.ts` regenerated for the files that grew in §3 and §5. The
  seven needed no raise.


---

# Pass seven — the contrast of what is actually painted

The palette audit is the strongest thing in this repo and it checks the wrong
half. `lib/contrast.test.ts` holds every token of every ground against every
panel — a hundred and forty-three pairings, in milliseconds — and it is worth
exactly as much as the number of places that use the tokens. `lib/dim.ts` was
written about the places that do not, and `styles/rules.ts` counts them. But a
count says a file owes nine. It does not say that any of the nine is
illegible, and those are different questions.

So this pass measured the other half. `app/scripts/paint.mjs` walks every
destination in a ground, photographs each screen twice — once with every glyph
hidden, once with the clip-to-text gradients repainted over their own boxes —
and compares the colour each run of text is painted in against the pixels it is
painted over. Whatever a component did to arrive at that colour, it sees the
colour.

**Most of what it found was fixed on `main` while this ran**, and that is
recorded below rather than quietly absorbed: the entries are kept because the
measurement is the record of what was wrong, not because this branch fixed it.

## What was measured

Sixty destinations, two grounds, phone width, on `f0a2368`:

```
runs measured 3146   skipped, off screen or moved between the shots 2820
below AA: 168 runs of text (113 distinct), 132 runs of punctuation
```

**Not one of the hundred and sixty-eight is on Ink.** Every one is on Fog, and
the reason is one line in `lib/dim.ts`: dark ink on a light page fades faster
than light ink on a dark one. Three clusters account for seventy-seven of the
hundred and thirteen distinct runs, and each is one number:

| painted | ratio | what wrote it |
|---|---|---|
| `rgb(116,119,124)` on the panel | 3.80:1 | `opacity: 0.55` |
| `rgb(127,130,135)` on the panel | 3.28:1 | `opacity: 0.5` |
| `rgb(105,108,113)` on the panel | 4.44:1 | `opacity: 0.6` |

## The line, and why nobody saw it

It is computable, and it is not one number — it is the ground's:

```
ink 0.49   graphite 0.51   midnight 0.50   basalt 0.50   oxide 0.49
forest 0.49   wine 0.50   industry-dark 0.50
parchment 0.61   paper 0.60   bone 0.61   fog 0.61   industry 0.62
```

That is the smallest alpha at which 11–13px text clears 4.5:1 on that ground's
panel. `opacity: 0.55` — at the time the most common number in the tree, 176
style objects — is **above** the line on all seven dark grounds and **below**
it on all six light ones. Which is why it survived being looked at: it is
legible on the ground the app was designed on.

Every ground's own `dimAlpha` is at or above its line, by 0.08 at the tightest.
`--app-dim` is not a better guess than 0.55; it is the audited answer. That is
now a test rather than a paragraph.

## The six that were not any screen's own — *five of them fixed on `main`*

`components/shell/Rows.tsx` is, in its own words, "the row this app did not
have — thirty-one screens drew their own". Five of its style objects dimmed
text with a hand-written number, and one of them dimmed an already-audited
colour:

| where | was | measured on Fog |
|---|---|---|
| the second line under a label | `opacity: 0.55` | 3.80:1 |
| the right-hand value | `opacity: 0.55` | 3.80:1 |
| the note under a group | `opacity: 0.55` | 3.80:1 |
| the heading over a group | `opacity: 0.55` over `--app-accent-deep` | 2.4:1 |
| the note under a framed group | `opacity: 0.65` | passes, by 0.03 |

The heading is the sharp one. `.section-label` is set in `--app-accent-deep`,
which `contrast.test.ts` holds to 4.5:1 on every panel of every ground; the
0.55 laid over the top of it was undoing that audit at the one place the audit
could not see. The grouped layout had it and the plain layout did not, so the
same heading was legible in one layout and not the other.

`components/Fold.tsx` had the sixth: **Collapse all**, the one control above
every set of sections in the app, at 3.80:1.

Both files were fixed on `main` between `f0a2368` and `3c0c0f0`, as part of the
same migration — four of the five in `Rows.tsx` and the Fold control, all to
`color: var(--app-dim)`, which is the same answer. `main`'s version is what
ships; the merge took it rather than adding a third spelling of it. The tree-
wide count went 934 → 740 in those commits.

**The framed group's note is the one this branch fixed**, and it is the one
the measurement would not have called a failure: 0.65 clears the line on every
ground, by 0.03 on Industry. It is here because it is the same text as the note
under a plain group, dimmed to a different strength in the other layout, and
out of reach of "Increase contrast" either way — and because the guard below
is worth more than the exception.

## What the branch leaves behind

Measured on the merged tree — `3c0c0f0` plus this branch — same sixty screens,
same two grounds, same instrument:

```
runs measured 3152   skipped, off screen or moved between the shots 2852
below AA: 85 runs of text (67 distinct), 132 runs of punctuation
```

A hundred and sixty-eight to eighty-five, and still nothing on Ink. Most of
that is `main`'s migration rather than this branch, which is the honest
accounting: what this branch adds is the number, the instrument that produces
it, one of the six, and a test that stops the last one coming back.

Re-run at `b83568e`, after four more passes landed on `main` including the
faint rung's own correction in #391: **eighty-five, sixty-seven distinct, still
nothing on Ink** — the same figure to the run. That is a useful thing to know
about the number rather than a coincidence: what is left is not the sort of
thing a pass about something else moves by accident.

## What was not fixed, deliberately

Each remaining run is a screen's own `opacity`, they are counted in
`styles/budget.ts`, and migrating them is the work `lib/dim.ts` already
describes and `secondLine` already exists for. Picking nine of a hundred to fix
in an audit would be arbitrary; what an audit can do is leave behind the
instrument that says which, and a number the next pass can compare against.

The clearest single example of what is left, because it shows the shape: the
profile heading writes `opacity: named ? 1 : 0.55` on `.chrome-text`, with the
comment "the prompt is not the name, and should not be set like one". The
intent is right and the execution puts **Add your name** at 2.20:1 on Fog. It
is not a mistake anybody could have seen in the source.

Icons are out of scope here: the chevron at the end of every row is 0.4, and
1.4.11 is a different rule with a different threshold. This measures runs of
text and says so.

## What the instrument got wrong first

Recorded in the script's own header, because each one read as a fault in the
app:

- a clip-to-text gradient is not a background, and hiding text does not hide
  it — the first run photographed the headings it meant to erase and reported
  every one at 1.00:1 against itself;
- a run's client rect overhangs the box painted behind it, so a 23px serif
  reports three rows of page background as its own;
- something drawn on top is not the background — the assistant's button parks
  over the foot of the home screen;
- and a hit test alone does not settle that, which is the one that got past
  the first version of this page. The button is a circle with a glow, so the
  pixels in the corners of its box are outside the shape `elementFromPoint`
  answers for and still carry its light; one of them, half a pixel outside the
  circle, was the worst reading in a whole census at 1.38:1 — a caption against
  a button nowhere near it. What floats is excluded by its box now, and **the
  two censuses above were re-run from scratch afterwards**: the figures this
  page first carried, 180 and 102, were that artefact;
- a disabled button has no contrast requirement, and the first full census
  opened with five greyed-out primary buttons at 1.41:1, which is the state
  they are supposed to be in;
- the look is spread across the top level of `Persisted`, so a seed nested
  under `look` is accepted, ignored, and measures all thirteen grounds as Ink.

The tell in every case was the same: a number that did not vary when it should
have.

## What guards it now

- `app/scripts/paint.mjs`, run as `npm run build && node scripts/paint.mjs`.
  No `check:` prefix, for the reason `scripts/dock.mjs` gives about its own:
  a browser download and a sixty-screen walk on every pull request is not a
  trade this app should make, and `lib/ci.test.ts` is right to demand that
  anything named `check:` is run.
- `lib/dim.test.ts` gains two cases. The first computes each ground's floor and
  holds `dimAlpha` at or above it, so the token stays the answer rather than
  merely a better number. The second holds that the two components that are not
  a screen's own do not dim text with an `opacity` at all — it fails against
  `main` as it stood at `3c0c0f0`, on the 0.65 that migration left, which is
  the whole reason that one number is in this branch.
