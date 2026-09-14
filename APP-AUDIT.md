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

## How it was checked

Static checks first, then the app itself in a real browser, because the two
find different things and this pass was started by the suite being green.

| Check | Result |
|---|---|
| `npm test` | 7492 passed, 10 skipped, 359 files |
| `npm run lint` (oxlint · style rule · label rule) | clean |
| `npm run build` (`tsc -b` + vite) | clean |
| `npm run check:university` | clean |
| `npm run counts` | clean — and one error quieter than before, see §1 |
| `node pipeline/validate.mjs` | 4 courses, 48 items, 8 episodes, all checks passed |

Then the browser, driven per `.claude/skills/run`:

- **1,560 screen loads.** Every screen in the `Screen` union — 81 of them, with
  real ids for the ones that name something — across all **6 navigations** and
  all **6 shells**, at phone width and at desktop width. **Zero `pageerror`s
  and zero blank screens.**
- **Every stored-state version.** A seed at each of schema 1–6, one with no
  version marker, one from the future, one of pure garbage, and five payloads
  that are not JSON at all. All ten migration paths and all five corrupt
  payloads come up working; none throws, none lands on a blank page.
- **Both adoption pathways,** and the whole five-step onboarding to the screen
  it lands on.
- **Structural checks against the registries:** every `Screen` has a case in
  `CurrentScreen`, every source file is imported by something, every dispatched
  action has a handler, and every `Action` variant was traced to the code that
  sends it — which is how §3 and §4 below were found.

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

## Checked and found clean

Worth recording, so the next pass does not re-spend the time:

- **No unfinished work in the source.** Zero `TODO`, `FIXME`, `XXX` or `HACK`
  markers outside tests; no empty handlers (`onClick={() => {}}`); no "coming
  soon", "not implemented" or stub text. Every `placeholder` hit is a real HTML
  input placeholder.
- **No orphan files.** All 624 non-test sources under `app/src` are imported by
  something.
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

## Still open, and deliberately not fixed here

Found by tracing every `Action` variant to its sender. These are reported
rather than changed, because each is a product decision about a capability
rather than a defect in one:

**Dead state — never read, never written, in any commit in this repository:**

| Field | Action | Where |
|---|---|---|
| `calTab` | `setCalTab` | `state/shape.ts`, `slices/navigate.ts` |
| `loadStep` | `setLoadStep` | same |
| `meGroup` | `setMeGroup` | same |
| `picked` | `togglePick` | `slices/settings.ts` — persisted, and read by nothing |

Each has a state field, a default, an action variant and a reducer case, and no
consumer on either side. They were added beside siblings that *are* used
(`setHomeTab`, `setCoursesTab`, `setMeTab`, `setCostsTab`) and nothing ever
reached for them.

**Operations the reducer supports and no screen offers.** The data is live and
on screen in each case; only the verb is missing:

| Action | What cannot be done |
|---|---|
| `patchRequirement` | a degree requirement cannot be edited |
| `patchTaken` | a completed course cannot be edited |
| `patchPerson` | a person can be added and dropped, never corrected |
| `dropVisit` | a visit cannot be deleted |
| `dropSitting` | a sitting cannot be deleted |
| `moveFolder` | a folder cannot be moved into another |
| `addTermDate` | a date of your own cannot be added to the registrar list |
| `setScale` | **the grading scale the GPA on Degree is computed against cannot be changed** |

The last is the one worth doing next: `state.scale` is read by `screens/Degree.tsx`
and by `ai/providers/upkeep.ts` to compute a GPA, and there is no way to set it.

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
- `src/styles/budget.ts` regenerated for the file that grew.
