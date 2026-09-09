# One app — the audit

Step 1 of `/simplify`, run again. Committed with no code; the status column in
§4 and the two corrections at the end were filled in as the merges landed.

Counted against `app/src` at `3a12e03`: **50 destinations** in `lib/nav.ts`, 75
screen files, 89 components, 8 shelves, 4 navigations.

This is the third pass. The first two took the destination count 59 → 56 → 50,
and they took the easy half: two whole clusters of duplicate *screens* (three
reports into one at three grains, two reconciliation screens into one with two
sources) plus the assistant, the second search, the second Settings door and
Files & mail. **There are no duplicate screens left that I can find.** What is
left is two duplicate *controls*, and they are the more dangerous kind, because
a screen you can see twice is an annoyance and a setting you can set twice is a
setting that disagrees with itself.

Saying that plainly matters more than producing a long list. The previous audit
ended with a sentence worth repeating: this app is large because it does a lot,
not because it does the same thing repeatedly.

---

## What I checked, and what it cost to clear

Every cluster the brief names, plus every one the last pass left open. The
verdict column is the point; the evidence is why you can believe it.

| Cluster | Verdict | Evidence |
| --- | --- | --- |
| The six "what is due" screens | **Kept** (settled last pass) | `home`/`ahead`/`tonight`/`mine` answer four different questions; `weekly`+`worked` already merged into `brief` at three grains |
| The assistant's three surfaces | **Done** | `screens/Ask.tsx` is the conversation; only `ai/Assistant.tsx`, `lib/route.ts` and `lib/softtop.ts` dispatch `ask` |
| Five ways to change course data | **Done** | `check` merged into `announce`; `import`/`edit`/`update` are three different inputs |
| Five ways to find a screen | **Kept** | `Everything.tsx`'s own comment argues it: "where is X" and "what would I use this for" are different objects |
| Where you stand | **Kept** | `grades` is this term's marks, `degree` is a four-year ledger |
| The Make cluster (7 screens) | **Kept** | Each carries a distinct fence — see below |
| `quiz` vs Guide's quiz block | **Kept** | Launcher and player, not two homes — see below |
| Header `+` vs springboard FAB | **Kept** | Different jobs, proven in `lib/adding.ts` — see below |
| **The Claude key and model** | **MERGE (D1)** | Two screens, both calling `saveSettings` |
| **The storage measurement** | **MERGE (D2)** | Two screens, same bytes, two different measurements |
| Hand-rolled rows | **Mostly done** | 36 in 13 files, down from 74 in 31; 18 files use shared `Rows` |
| Hand-rolled chip rows | **MERGE (D3)** | 14 files by this count — but see §4, where the count turns out to be two idioms, not one |

### Three that look like duplicates and are not

Recording these because each cost real reading, and the next person to run this
command should not have to pay for it twice.

**The Make cluster is seven tools, not one tool seven times.** `work`, `solve`,
`analyse`, `essay`, `draw`, `deck` and `proof` all take text and call a model.
They are not interchangeable, and the difference is a *fence* in each one:
`Analyse` computes every number in `lib/stats.ts` and never lets the model
report a figure; `Essay` is gated by `gate()` in `lib/essay.ts` so it cannot
touch coursework; `Solve` works a parallel problem rather than the one being
marked; `Work` refuses to write the assignment at all. Merging any two would
merge their fences, and a fence is the only thing standing between this app and
an Honor Code case. **Kept, emphatically.**

**`quiz` is not a second copy of Guide's quiz.** `Guide.tsx:306` renders a card
describing the quiz with a "Start quiz" button; `startQuiz` in
`state/slices/study.ts:126` pushes `screen: 'quiz'`, which renders `Quiz` out of
`screens/Drill.tsx`. Launcher and player. They read as duplicates from the
registry and are one flow.

**The header `+` and the springboard's floating button both point at
`import`, and they are different buttons.** When this was written, `lib/adding.ts`
made the header's `+` mean "add a course" on the courses list and "add something
in one line" everywhere else, while `lib/chrome.ts` only draws the FAB on `home`
in the `feed` navigation — so on the one screen where both exist, one added a
deadline and the other a course.

`main` has since gone further and deleted `lib/adding.ts` outright: the `+` is
now the same one-line capture on every screen, on the argument that "the one
control whose meaning you can rely on" should not be one you have to check. The
conclusion here is unchanged and now unambiguous — two buttons, two jobs — and
the file this paragraph originally cited as evidence no longer exists.

---

## 1. Routes per destination — and a correction to how it was counted

The obvious grep is wrong, and the last pass used it.

```
$ grep -rn "screen: '…'" --include=*.tsx --include=*.ts app/src
```

That misses every route through the reducers, which pass the screen
positionally: `push({ …state, quiz: action.quiz }, 'quiz')`. Twelve
sub-screens are reached only that way — `drill`, `quiz`, `guess`, `lesson`,
`slides`, `exam`, `item`, `course`, `event`, `note`, `guide`, `update` — and
counting without them makes `quiz` look dead when it is not. Both greps
together:

```
$ grep -rn "screen: '[a-zA-Z]*'" --include=*.tsx --include=*.ts app/src | grep -v nav.ts
$ grep -rhno "}, '[a-z][a-zA-Z]*'" --include=*.ts app/src/state/slices/
```

The result, for every destination reached more than three times:

| Destination | Routes | What they actually are |
| --- | --- | --- |
| `home` | 9 | `land.ts` / `shape.ts` fallbacks |
| `edit` | 8 | 2 × `softtop`, then 6 contextual (a course card, an office-hours row, a drop-by card) |
| `mine` | 7 | 2 × `Today`, 2 × `Calendar`, all four onto a *named tab* |
| `import` | 7 | header `+`, springboard FAB, `softtop`, and four contextual |
| `item` | 6 | deep links from insights and notifications |
| `ahead` | 6 | 3 × `softtop`, 2 × the reports, 1 × an insight |
| `tonight` | 5 | 5 × `softtop`, i.e. one contextual action on five screens |

**The honest claim, stated as the brief asks for it:** no destination in
`lib/nav.ts` has two general front doors. Every count above three is one of
three things — `lib/softtop.ts`'s action bar, which is one registry giving each
screen a single contextual "what you came to do next"; a deep link that names a
tab or an id (`setMineTab` then `go: 'mine'` is not "open Mine", it is "open
Mine's appointments"); or a fallback in `land.ts`. A contextual action is not a
pathway to a home. It is the app answering the question you are already
holding, and removing them would not simplify the app, it would make it stupid.

What I cannot claim is the stronger version — "exactly one pathway each" — and
I am not going to write it down when the greps above say otherwise.

---

## 2. Duplicated controls — the two real findings

### D1 — the Claude key and model live on two screens · **MERGE**

The whole point of the rule, and the app has one.

```
$ grep -ln "config.apiKey" app/src/screens/*.tsx app/src/screens/settings/*.tsx
app/src/screens/Connect.tsx
app/src/screens/settings/Assistant.tsx
```

Both render a key field and a model picker. Both call `saveSettings`.
`Connect.tsx` holds it in a private `ClaudeAccount()` component (lines 65–223,
~145 lines) rendered at line 495; `settings/Assistant.tsx` is the whole screen.

`settings/Assistant` is the survivor, and not by preference — it is a strict
superset. It has two providers (Claude *and* OpenAI), the routing between them
(`route()`, `routeLabel`), the monthly spend, and the disclosure about what
leaves the device. Its own file comment already says this is where the choice
belongs: "a choice made once, checked occasionally, and belonging on a page you
go to on purpose."

Connect's copy has exactly one thing Settings lacks: a **check this key works**
button (`checkKey`). That moves rather than dies.

`screens/Links.tsx`'s comment is the tell that this has been half-known for a
while — it describes the links as having lived "at the bottom of Connect, under
the accounts, the calendar feeds **and the Claude settings**." The Claude
settings should have left when the links did.

**Verdict: delete `ClaudeAccount` from Connect; move `checkKey` into
Settings → Assistant; leave a link where the block was.** No destination goes.

### D2 — the storage measurement lives on two screens · **MERGE**

```
$ grep -ln formatBytes app/src/screens/Data.tsx app/src/screens/settings/Storage.tsx
app/src/screens/Data.tsx
app/src/screens/settings/Storage.tsx
```

`Data.tsx` renders "Room" — bytes used of quota, with a bar.
`settings/Storage.tsx` renders "Space used" — your semester, drafts,
attachments, and the browser's total. **The same fact, measured twice by two
different code paths**: `Data` through its own `room` hook, `Storage` by calling
`navigator.storage.estimate()` inline. Two numbers that can disagree, about the
one thing somebody opens these screens to check.

`Data.tsx`'s file comment carefully explains why it is not the *privacy*
screen. It never asks why it is not the *storage settings* page, which is the
screen it actually overlaps.

`data` is the survivor: it is a directory destination with its own shelf,
keywords and search entry, and it is the richer screen (per-collection counts,
the total, the span of dates). It is missing only Storage's breakdown of drafts
and attachments, which moves across.

Settings → Storage keeps what is genuinely a setting-page job — `Snapshots`
(restore from a local copy) and the link to Take it with you — and its "Space
used" group becomes a row pointing at Data.

**Verdict: the measurement has one home (`data`); Settings keeps the actions.**
No destination goes.

### Everything else in `settings.ts`, cleared

Every `set*` action dispatched from more than one file, re-checked:

| Action | Files | Verdict |
| --- | --- | --- |
| `setLook` | `Appearance`, `settings/Look`, `settings/Nav`, `nav/Folder` | **Fine.** `Appearance` is one shared control with two hosts; `Folder` writes a different key |
| `setMineTab` | `Calendar`, `Mine`, `Today` | **Deep link**, not a control |
| `setDueTab`, `setCoursesTab` | `Brief`, `Courses`, `Today` | **Deep link** |
| `setSample` | `SampleMark`, `FirstRun`, `settings/Courses` | **Fine.** One component, three hosts |
| `setCalView`, `setCalDay` | `Clashes`, `Calendar` | **Fine.** A clash card jumps to the day it is about |
| `setMeTab` | `Ahead`, `Me` | **Fine** |

A shared component rendered on two screens is not a duplicated control. A
second implementation of the same control is, and D1 is the only one.

---

## 3. Duplicated UI

| Thing | Hand-rolled | Shared | Where |
| --- | --- | --- | --- |
| List rows | 36 in 13 files | 18 files use `shell/Rows` | `Guide`, `Update`, `Calendar` |
| Chip rows | 14 files | 8 files use `ChipRow` | `Look` (5), `Applying` (4), `People` (3) |
| Section labels | — | 82 files use `SectionLabel` | settled |

The row work is two-thirds done and the remaining 36 are concentrated in three
screens that draw genuinely unusual rows. **D3 is the chip rows**: 14 files
build a row of mutually-exclusive pressed buttons by hand when
`components/ui.tsx` exports `ChipRow` for exactly that.

One number in this section needs care, because the naive grep oversells it:
`aria-pressed` appears 71 times across 45 files, but most are a *single* toggle
button — a star, a filter, a switch — and a single toggle is not a chip row and
must not be converted into one. Only 14 files map a list into chips. That is
the real number and it is the one D3 is scoped to.

---

## 4. The work, in order

| # | Change | Destinations | Status |
| --- | --- | --- | --- |
| D1 | Claude key + model → Settings → Assistant only | 0 | **done** |
| D2 | Storage measurement → `data` only | 0 | **done** |
| D3 | The second chip idiom becomes `PickChips` | 0 | **done**, and rescoped |

### D3 was mis-scoped in this document, and the correction is the finding

The row above said "14 files hand-roll what `ChipRow` already does". Reading
them, that is wrong: **there are two chip idioms in this app and only one of
them had a component.**

`ChipRow` is a filled, uppercase, 29px chip in a row that scrolls sideways, and
its own comment explains why it must not grow — the calendar stacks a
`Segmented` directly above one, and at 44px their targets overlapped by 4px, in
which band the lower row silently won taps meant for the upper.

The other is an outlined pick, accented when chosen, that wraps onto several
lines under a heading. Five copies, with the padding drifting between 7px and
9px and the radius between `--r-sm` and `--r-md`. That is `PickChips` now.
Converting them into `ChipRow` would have shrunk them, uppercased them and put
them in a scrolling row — three changes nobody asked for.

Three of the fourteen are deliberately left alone, and they are the reason the
naive count oversold this: Registrar's found-dates list and Degree's "Taking it
now" are **toggles**, not picks, and a single pressed button is not a chip row.
Mine's course filter is `ChipRow`'s shape but its value is `CourseId | null`,
and threading a sentinel through the filter for a styling win is not a trade
worth making.

### The two claims the brief asks for, checked

**"No saved state can land the app on a screen that no longer exists, and there
is a test proving it."** There are exactly two things that can put the app on a
screen across a restart, and neither can strand you:

  · **Saved state cannot, because the screen is not in it.** `screen` lives in
    `Ephemeral` and is absent from `pickPersisted`, so nothing about where you
    were standing reaches storage. Asserted now in
    `app/src/state/screens.test.ts`, because that is load-bearing for screen
    deletion and was previously only true by habit.
  · **A URL can, and it lands on Today.** `fromHash` passes an unknown name
    through on purpose, and `App.tsx`'s `default: return <Today />` catches it.
    Checked in a browser: `#/cloud` (deleted this week) renders Today,
    `#/weekly` (merged) renders Reports through the `RETIRED` table, and
    `#/nonsense` renders Today. None blank.

**"The screen count is lower than 59."** It is **50**, and none of that came
from this pass — the reports, the reconciliation screens, the assistant's
second door, the second search, the second Settings door and Files & mail all
went earlier. This pass removed no destination, because there was no duplicate
screen left to remove.

**No destination is cut by this pass, and that is the finding.** 50 stays 50.
The previous two passes removed the duplicate screens; what was left when I
looked was two settings that could disagree with themselves and a component
used by a third of the files that should use it.

Nothing here touches `lib/context.ts`, `docs/data-contract.md` or
`packages/contract`, and no merge blurs a syllabus-derived date with a
student-written one.

---

## 5. Duplicate tabs — an axis this pass did not look at

*The section below came from a pass running on `main` at the same time as this
one, and it is kept whole because it is right and because this audit missed it.
Sections 1–4 look at screens, routes and controls; none of those greps can see
a **tab that renders another screen**, because such a tab adds no destination
and no `go` dispatch. It is a second front door all the same.*

*Its two findings — Today's "Report" tab and Courses' "Grades" tab — are
already cut on `main`. Read together with §2 above, the shape of the whole
result is: the duplicate screens went in passes one and two, the duplicate
tabs went here, and what this pass found was the duplicate controls.*

Counted against `app/src` at `659a424`: **50 destinations**, 57 screen files.

Sections 1–4 audited *screens* and *routes*. Neither catches a **tab that
renders another screen**, because the tab adds no destination and no `go`
dispatch — the grep in section 2 cannot see it. It is a second front door all
the same, and it is the shape #34 removed for Settings.

The tell is a `bare` prop: a screen exported with a second render path that
drops its own `<Page>` frame so it can sit inside somebody else's.

```
$ grep -rn "bare" --include=*.tsx app/src/screens | grep -v 'className'
screens/Reports.tsx:43   export function Reports({ bare = false })
screens/Today.tsx:273      {tab === 'brief' && <Reports bare />}
screens/Grades.tsx:29    export function Grades({ bare = false })
screens/Courses.tsx:74       <Grades bare />
```

Two, and the app has exactly two remaining. Both are destinations in their own
right, so each is one job with two homes.

### Every screen-level tab bar, and what each tab is

| Screen | Tabs | Any tab a destination? |
| --- | --- | --- |
| `home` Today | Today · Hours · Week · Done · **Report** | **Yes — `brief`** |
| `courses` Courses | Courses · Coming up · **Grades** | **Yes — `grades`** |
| `study` Study | Guides · Tonight · Tools | Name collision only — see below |
| `me` Progress | You · Everything | Name collision only — see below |
| `mine` Personal | Tasks · Events · Notes · Files | No (Places went in #35) |
| `brief` Reports | Day · Week · Term | No — grains of one report |
| `calendar` Calendar | Day · Week · Month · Semester | No — grains of one grid |
| `degree` | What is left · Taken · Requirements | No |
| `people` | People · Letters | No |
| `clocks` | Timers · Alarms | No |
| `applying` | Open · Add one · Closed | No |
| `activities` | Yours · Add one · Find things | No |
| `registrar` | Fill them in · Paste the page | No |
| `deck` | From a unit · From a brief | No |
| `exam` | From your cards · Written for you | No |
| `announce` | A connected feed · Paste a calendar | No — M2's two sources |
| `maps` | Campus · Nashville | No — map scope |

Everything else that renders a `<Segmented>` is an option picker inside a form
(`settings/Look`, `settings/Nav`, `Essay` lengths and voices, `Exam` and `Deck`
durations, `Sources` filter). Those are controls, not tabs, and are out of
scope.

### T1 — Today's "Report" tab · **CUT the tab, keep the screen**

`brief` is a destination with `short: 'Report'`, three grains of its own, and
its own `keywords`. Today renders the same component inline as a fifth tab.
Pressing Today → Report and opening Reports land on the identical body, and
the tab even shares `state.report`, so the grain you left on one is the grain
you find on the other. One job, two homes.

The tab is the copy that goes, per #34: the screen is the thing the directory,
the search box and the tab bar all point at, and a tab cannot be any of those.
It also buys back the fifth-tab problem the code comments about — the comment
at `Today.tsx:262` records that "This week" had to be shortened to "Week"
because Report made the switcher a fifth tab and it wrapped to two lines.

### T2 — Courses' "Grades" tab · **CUT the tab, keep the screen**

Identical shape. `grades` is a destination (`root: 'courses'`, `taskTags:
['stand']`); `Courses.tsx:70` intercepts its own `grades` tab and returns
`<Grades bare />` inside a `<Page bottom={0}>`. Section 1 Cluster E already
ruled that `grades` stays a screen; this is the second door to it.

### Kept, with the reason

- **Study → "Tonight" is not the `tonight` screen.** The tab is "Tonight's 25
  minutes": weakest unit per course, ordered by mastery, opening a card drill.
  The screen is points of final grade per hour over outstanding deadlines. Two
  questions — *what should I revise* and *how do I spend the evening* — that
  happen to share a word. Kept, per the rule about two things that look alike.
  **The shared name is a real cost and is recorded here as a naming collision,
  not a duplication.**
- **Progress → "Everything" is not the `everything` screen.** `Everything.tsx`
  argues this out in its own file comment and section 1 Cluster D accepted it:
  "where is the thing called X" versus "what would I use this for, and what
  have I never opened". Same collision, same verdict.
- **Today → "Week" is not `ahead`.** Five upcoming rows and the next campus
  event, against seven days of hours arithmetic, clash detection and reading
  extents. A preview is not the screen it previews.

### Done

| # | Change | Tabs | Destinations | Done |
| --- | --- | --- | --- | --- |
| T1 | Today's "Report" tab → the `brief` screen | −1 | 0 | ✅ `0ec5044` |
| T2 | Courses' "Grades" tab → the `grades` screen | −1 | 0 | ✅ `0ec5044` |

### After T1 and T2

Two tabs go; no destination goes; nothing becomes unreachable, because in both
cases the survivor is the destination and it keeps its own row, keywords and
task tags. `homeTab` and `coursesTab` are `Ephemeral` — declared in the
`Ephemeral` interface, defaulted in `blank()`, never read back out of a save —
so there is no persisted value to migrate, which is why #34 narrowed `meTab`'s
union and added no migration either. The `bare` prop and its second render path
come out of both screens with the callers.
