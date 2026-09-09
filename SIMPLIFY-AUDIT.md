# One app — the audit, second pass

Step 1 of `/simplify`, run again. No code in this commit.

Counted against `app/src` at `3a12e03`: **50 destinations** in `lib/nav.ts`, 72
members of the `Screen` union, 75 screen files, 96 components, 8 shelves.

The first pass of this audit ran at `ac5a2c8` against 59 destinations. Every row
in it is resolved and the resolutions are kept at the bottom of this file. Nine
destinations have gone since, across five passes by different hands, and the
first job here was to check what that left behind rather than to re-run the same
greps and re-report the same clusters.

**The headline of this pass is that the remaining duplication is not in the
screens.** It is in one directory drawn twice, one storage report written twice,
and 76 pieces of code with no caller. The screen count should come down by one,
not by nine.

> **A third pass ran against `3a12e03` at the same time as this one**, by other
> hands and without sight of it, and landed three things before this document
> was written. They are folded in below rather than kept apart, because two
> audits of one app is exactly the shape this command exists to remove.
>
> · **S2 is done** — and was reached independently, with the same survivor and
>   the same requirement to carry the drafts and attachments rows across. Two
>   passes agreeing about a merge from different starting points is the best
>   evidence either of them offers.
> · **§3's conclusion was wrong, and is corrected there.** There *was* a
>   genuine second copy of a control. A `set*` scan cannot see it.
> · **A second chip idiom** had five hand-rolled copies and no component; §4
>   carries it as S8.

---

## 0. What the last five passes removed

| Pass | Destinations | What went |
| --- | --- | --- |
| Reports at three grains | −2 | `weekly`, `worked` → `brief` |
| A change to a date, two sources | −1 | `check` → `announce` |
| The Ask tab became the conversation | −1 | `chat` → `ask` |
| Files & mail deleted | −1 | `files` |
| Personal → Places folded into the map | 0 | a tab, not a destination |
| Progress → Settings tab | 0 | a tab that rendered the Settings index |
| The second search deleted | 0 | 15 in-screen filters, `screenbox`, `scoped` |

59 → 50. Two of those passes are the precedent this one leans on: a tab that
rendered another screen's content was removed because *pressing the tab and
pressing the button landed on the same list*. That argument is not finished —
see S1.

---

## 1. Screen overlap

Verdict per cluster, with the evidence that decided it.

### S1 — the directory, drawn twice · **MERGE**

`screens/Me.tsx` (the Progress tab) has two tabs: **You** and **Everything**.
The Everything tab renders `Lately`, `NotYetOpened`, and then `GROUPS.map` — a
`Panel` per shelf with a `Destination` row per screen.

`screens/Everything.tsx` has four views. The first, **By area**, renders
`offered(caps)` grouped by shelf. The third, **Not tried**, renders
`untried(rows, state.visited, state.lastOpened)` — which is what `NotYetOpened`
renders.

```
$ grep -n "GROUPS.map" app/src/screens/Me.tsx            # the shelves, in Me
$ grep -n "view === 'area'" app/src/screens/Everything.tsx # the shelves, again
$ grep -n "NotYetOpened" app/src/screens/Me.tsx           # 'not tried', in Me
$ grep -n "view === 'untried'" app/src/screens/Everything.tsx
```

Both read the same registry through the same two helpers (`offered`, `listed`),
gate on the same `school.capabilities`, and draw the same rows. Two of
Everything's four views are the Me tab, and `everything` is not in `HIDE_IN_ME`,
so the directory contains a row that opens the directory.

**The survivor is `me`.** It is in `DEFAULT_TABS`; `everything` is not, and
nothing in the app routes to `everything` except the soft shell's action bar
(`lib/softtop.ts`, twice). What is genuinely only in `everything` is **By task**
(`byTask`, the `taskTags` intention view) and **Shortcuts** (the `?` array,
which is also the `?` sheet and a section of the guide).

So: **By area** and **Not tried** go — Me already draws both. **By task**
becomes a third tab of Me, or Everything survives holding only the two views
that are its own. Either way one destination goes, and the row in the directory
that opens the directory goes with it. This wants a decision, not a default —
it is the one row in this audit where the survivor is arguable, because
Everything's own file comment argues for the split and that argument was written
before Me grew an Everything tab.

### S2 — what the app is storing, written twice · **MERGE — done**

| | Reads | Renders |
| --- | --- | --- |
| `screens/Data.tsx` (`data`) | `pickPersisted(state)`, `navigator.storage.estimate()` | Every collection, largest first, with bytes · "Room": used of quota, the backend, whether the browser has promised to keep it |
| `screens/settings/Storage.tsx` (`setStorage`) | `localStorage` sizes, IndexedDB | "Your semester", "Drafts in progress", "Attachments", "This browser, in total" · a row to Export |

Both measure the same bytes and answer the same question — *what is this app
taking up, and is it about to run out*. `Storage` is the smaller of the two and
already ends in a link to another screen.

**Survivor: `data`.** Settings → Storage becomes a `NavRow` to it, which is what
Settings does for eight other things. Zero destinations go — `setStorage` is a
settings page, not a destination — but a screen does, and two numbers that do
not agree go with it: both show the browser's own used-of-quota, and beside it
`Data` totals the store a collection at a time while `Storage` totals the store,
the drafts and the attachments as three rows. Neither is wrong and they do not
match, which is what a number kept in two places does. Whichever survives has to
carry the drafts and attachments rows, which exist only on `Storage` today.

**Done, and reached independently.** The third pass merged this before reading
this section and landed on the same survivor for the same reason, with one
detail worth adding to the record: the two numbers disagreed because they were
two *measurements*, not two renders — `Data` asks `space()` in
`lib/inventory.ts`, `Storage` called `navigator.storage.estimate()` inline.
`space()` survives; it asks the same browser API and also reports which backend
is live and whether the browser has promised not to evict. The drafts and
attachments rows moved across as this section requires, drawn below the store's
total and outside it, since that total is the size of one string the app writes
and these are not in it.

### S3 — code with no caller · **CUT**

Not screens: functions. Two counts, from one scan of every `export function`
and `export const` under `app/src`: a name is counted here when no other
production file mentions it and it appears only once in its own file — that is,
nothing but its definition reads it.

- **26 exports nothing reads at all** — not the app, not a test, not their own
  file. `components/Icons.tsx: PlayIcon, PauseIcon`,
  `components/shell/Rows.tsx: SliderRow, DestructiveRow`,
  `components/soft/Soft.tsx: BarButton, Pill`, `lib/activities.ts:
  asAppointments`, `lib/claude.ts: makeCards`, `lib/date.ts: monthName`,
  `lib/intake.ts: intakeFiles, intakeUrl`, `state/store.tsx: useGo`, and 14 more.
- **50 exports whose only reader is their own test.** `lib/connect.ts:
  listMail` and `fetchRemoteText` are the honest example — the Files & mail pass
  said out loud that it was leaving "a tested transport, no longer wired to a
  screen". Also `lib/select.ts: searchItems` (a filter helper from the search
  that was deleted), `lib/settings.ts: rowFor`, `lib/route.ts: linkTo`,
  `lib/records.ts: mergeRows, summaryLine, watermark`, `lib/school.ts: termFor,
  moveOutWhy`, `lib/worth.ts: calibrateFor, guessLine`.

A test is not a reader. A function whose only caller is the test that proves it
works is a function the app does not use, and the test passing is not evidence
that anything needs it. **76 in total**, in 55 files.

Three exclusions, deliberately: an export used inside its own file is not dead
(40 of those, `SettingsIndex` among them — it is rendered by `Settings` two
functions down); the `styles/rules.ts` exports are read by `scripts/styles.mjs`
outside `src`; `data/` course content read only by the guide builder stays.

### S4 — the same UI drawn by hand · **SHARED COMPONENTS**

| Idiom | Shared thing that exists | Hand-drawn instances | Files |
| --- | --- | --- | --- |
| A caps heading (uppercase + letterSpacing, inline) | `SectionLabel`, `.kicker` | **232** | 79 |
| A list row with a hairline under it | `ItemRow` in `components/shell/Rows.tsx` | **33** | 12 |
| "Nothing here yet" | *(none)* | **96** | 71 |
| A chip row that scrolls sideways | `Segmented` | 8 | 6 |

```
$ grep -rn "textTransform: 'uppercase'" --include=*.tsx app/src | wc -l   # 235
$ grep -rn "borderBottom: '1px solid var(--app-line)'" --include=*.tsx app/src | wc -l  # 36
```

Of the 90 caps headings I could tie to an element, 63 are text (`div`, `span`,
`h2`, `li`) and 27 are buttons or links — so roughly two-thirds are `SectionLabel`
written out longhand and one-third are buttons that happen to share the type
treatment. The row count is down from the first audit's 37 in 14 files; the
heading count has never been measured before and is the largest single body of
copy-paste left in the app.

**The empty state is the one worth adding**: 96 hand-written "nothing yet"
blocks in 71 files (`grep -rniE "nothing (here|yet|to)|no .* yet\b"`), each choosing its own size, opacity and margin, is the
reason the same absence reads as three different weights on three screens.

### S5 — three reports, three files of the same shape · **KEEP, recorded**

`lib/brief.ts` (277 lines), `lib/weekly.ts` (267) and `lib/worked.ts` (220) are one
module written three times: `Input` interface → counted struct → `SYSTEM` prompt
constant → report string. The screens merged; the libraries did not. One reader
each, and that reader is one screen at three grains.

Kept, because collapsing them means one prompt for three grains and the prompts
are what make the three reports read differently. Recorded so the next person
does not have to work it out again.

### S6 — one conversation, two shells · **KEEP, owned elsewhere**

`ai/Assistant.tsx` (686 lines, the sheet over any screen) and `ai/Chat.tsx`
(392, the Ask tab) both render `talk.turns` from the one `useAI` store, and both
already share `Composer` and `Turns`. The pieces are shared; the two shells are
not, and they are genuinely two shapes — a sheet that leaves the screen behind
usable, and a screen with the thread list beside it. `/ask-tab` owns this.

### S7 — cleared, with the evidence

| Cluster | Verdict |
| --- | --- |
| `ahead`, `tonight`, `behind`, `runway` | **Keep.** Four questions: is this week survivable · where do tonight's hours buy most · what do I do having already slipped · how many weeks to the exam and what is in the way. Each file argues its own case at the top and each refuses a readiness score. |
| `grades`, `degree` | **Keep.** This term's marks; a four-year ledger. |
| `help`, `everything` | **Keep, but rewrite one blurb.** A generated manual and a directory are different objects. They are not different *in the registry*: "Every screen in the app, what it is for…" and "Every screen in the app, what it does…" are the two blurbs, and they are what search matches on. Whichever survives S1 needs a blurb that does not open with the other's five words. |
| `essay`, `mail`, `proof` | **Keep.** A draft with a voice and a length; an email with a purpose and a mail app; a paste box that reads text back. `Proof`'s panel is already shared under the app's own boxes — one component, several hosts, which is the pattern rather than the problem. |
| `work`, `solve` | **Keep.** Break an assignment into a plan; work a parallel problem and check a step. |
| `data`, `privacy`, `export`, `connect` | **Keep** all four as destinations. What leaves the device, what is held, how to take it, what is plugged in. Only the settings page duplicates one of them — S2. |
| `import`, `update`, `announce`, `edit` | **Keep.** A syllabus in, a reading in, a stated change in, a hand correction. The fifth (`check`) merged last pass. |

---

## 2. Routes per destination

Every `screen: '…'` outside `lib/nav.ts`, counted by file, tests excluded:

| Destination | Files | Reading |
| --- | --- | --- |
| `home` | 7 | `land.ts`, `shape.ts`, `navigate.ts` fallbacks. Not front doors. |
| `edit` | 7 | `Courses`, `Essay`, `Import`, `DropBy`, `OfficeHours`, `guidebook`, `softtop` |
| `import` | 6 | `App`, `keys`, `softtop`, `FirstRun`, `Runway`, `Yes` |
| `courses` | 6 | one tab plus five contextual actions |
| `mine`, `calendar` | 5 | tab plus deep links |
| everything else | ≤4 | |

`edit` and `import` were examined in the first pass and left alone on the
grounds that `App`, `softtop` and the springboard are three *navigations* of
which exactly one is drawn at a time (`NAVS` in `lib/look.ts`). That still
holds; I re-ran it rather than trusting it.

**One hole in this grep, found on the third pass and worth keeping written
down.** `screen: '…'` misses every route through the reducers, which pass the
screen positionally — `push({ …state, quiz: action.quiz }, 'quiz')`. Twelve
sub-screens are reached only that way (`drill`, `quiz`, `guess`, `lesson`,
`slides`, `exam`, `item`, `course`, `event`, `note`, `guide`, `update`), so a
count without them makes `quiz` read as dead code when it is the second half of
a flow that starts on the guide. The second grep is
`grep -rhno "}, '[a-z][a-zA-Z]*'" app/src/state/slices/`.

**Three destinations have nothing routing to them at all** — `activities`,
`analyse`, `solve` — reachable by the tab bar, the directory and search only.
That is the shape the brief asks for, and it is worth saying that the app is
mostly already in it: the counts above are `softtop`'s contextual action bar and
the insight cards, both of which answer a question you are already holding.

---

## 3. Duplicated controls

Every `set*` action dispatched from more than one file outside `state/`:

| Action | Files | Verdict |
| --- | --- | --- |
| `setLook` | `Appearance`, `settings/Look`, `settings/Nav`, `nav/Folder`, `lib/tools` | **Fine.** One shared control with two hosts, plus the springboard's own key and the assistant's tool surface. |
| `setMineTab`, `setDueTab`, `setCoursesTab` | `Today`, `Courses`, `Calendar`, `report/Day`, `openhit` | **Deep links.** "Open Mine, on tasks". |
| `setSample` | `SampleMark`, `FirstRun`, `settings/Courses` | **Fine.** One component, three hosts. |
| `setCalView`, `setCalDay` | `Clashes`, `Calendar` | **Fine.** A clash card jumps to its day. |
| `setLinkUrl` | `Courses`, `Links` | **Cleared.** Different namespaces in one map: `Courses` writes `lms:${course.id}`, `Links` writes campus and user link ids. Checked because it looked like the same editor twice. |
| `setDayBudget` | `Clashes`, `lib/tools` | **Fine.** The tool surface is the assistant, not a second screen. |
| `setReport`, `setChanges`, `setQuery` | 2 each | **Deep links.** |

### The one this scan could not see · **MERGE**

**There was a genuine second copy of a control, and the table above cannot
contain it.** The scan is "every `set*` action dispatched from more than one
file" — and the Claude API key, the proxy field and the model picker do not go
through the reducer at all. They call `saveSettings()` in `lib/claude.ts`, which
writes `localStorage` directly. A duplicate implemented that way is invisible to
this method by construction, however carefully the method is run.

```
$ grep -ln "config.apiKey" app/src/screens/*.tsx app/src/screens/settings/*.tsx
app/src/screens/Connect.tsx            # a private ClaudeAccount(), ~145 lines
app/src/screens/settings/Assistant.tsx # the whole screen
```

Both rendered a key field and a model list; both called `saveSettings`. Settings
is the survivor — a strict superset, with two providers, the routing between
them and the month's spend — and the two things only Connect had moved rather
than died: the **check-this-key** button, and the sentence saying there is no
"sign in with Claude" to hunt for, which now sits on the page somebody hunting
for a login button actually lands on. Connect keeps a row saying where the key
went. Done on the third pass.

**The lesson for the next run of this section** is that "dispatched from more
than one file" is the wrong net. The right question is *which files write this
setting*, by whatever route — a reducer action, a direct `localStorage` write,
or a module-level helper. The rest of the table stands; it was checked again
after this one was found.

**No other second copy of a control.** Same finding as the first pass, from a
scan that now has three fewer screens to disagree about — and one hole in it,
named above.

---

## 4. What to do, in order

| # | Change | Destinations | Kind |
| --- | --- | --- | --- |
| S1 | The directory drawn twice — `everything`'s By-area and Not-tried views against Me's Everything tab | −1 | Merge, needs a decision on the survivor |
| S2 | Settings → Storage becomes a row that opens `data` | 0 | Merge |
| S3 | 76 exports with no caller — 26 dead outright, 50 read only by their own test | 0 | Cut |
| S4 | An `EmptyState` component (96 hand-written), then `SectionLabel` for the 68 headings written longhand | 0 | Shared components |
| S5 | `brief`/`weekly`/`worked` libraries | 0 | Kept, recorded |
| S6 | The assistant's two shells | 0 | Kept, `/ask-tab` |
| S7 | The `help` / `everything` blurb collision | 0 | Reword with S1 |
| S8 | The second chip idiom — five hand-rolled copies, no component | 0 | Shared component, **done** |

Two of those are already done, on the third pass that ran alongside this one:

| # | Change | Landed as |
| --- | --- | --- |
| S2 | Settings → Storage is a row that opens `data`; the drafts and attachments rows moved with the measuring | the survivor is `data`, as this section asks |
| — | The Claude key stopped being a control on two screens | see §3, "the one this scan could not see" |
| S8 | `PickChips` in `components/ui.tsx` | five sites converted, three left alone on purpose |

**S8, stated properly**, because the naive count oversells it. There are two
chip idioms in this app and only one had a component. `ChipRow` is a filled,
uppercase 29px chip in a row that scrolls sideways, and its comment explains why
it must not grow: the calendar stacks a `Segmented` directly above one, and at
44px their targets overlapped by 4px, in which band the lower row silently won
taps meant for the upper. The other is an outlined pick that wraps onto several
lines under a heading — five copies, padding drifting between 7px and 9px, radius
between `--r-sm` and `--r-md`. Converting those into `ChipRow` would have shrunk
them, uppercased them and put them in a scrolling row: three changes nobody asked
for. Registrar's found-dates list and Degree's "Taking it now" are **toggles**,
not picks, and stay hand-written; Mine's course filter is `ChipRow`'s shape but
its value is `CourseId | null`, and threading a sentinel through the filter for a
styling win is not a trade worth making.

**50 → 49 destinations**, and the honest headline is again that this app is
large because it does a lot. The duplication that is left is one directory, one
storage report, and a long tail of code and markup nothing calls.

Each merge must carry, as before: the survivor's `keywords` widened with the
dead screen's, a `state/shape.ts` migration so a saved `screen` that no longer
exists lands on the survivor, and a test for that migration.

---

## 5. Duplicate tabs — the axis this audit had not looked at

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

- **Study → "Tonight" is not the `tonight` screen.** The tab ranks every unit
  in every course by what has come round in the review schedule, how cold it
  is and what is tested soon, then fills the time you say you have and starts
  the cards. The screen is points of final grade per hour over outstanding
  deadlines. Two questions — *what should I revise* and *how do I spend the
  evening* — that happen to share a word. Both kept, per the rule about two
  things that look alike. **The shared name was the real cost, and it is the
  half that could be fixed without merging anything: the tab is "Revise" (T3).
  Two jobs, two names, both still there.** (The tab was "Tonight's 25 minutes"
  — the weakest unit per course, sized by a fixed string in the course module —
  until `lib/revise.ts`.)
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
| T3 | Study's "Tonight" tab renamed "Revise" | 0 | 0 | ✅ |

### After T1 and T2

Two tabs go; no destination goes; nothing becomes unreachable, because in both
cases the survivor is the destination and it keeps its own row, keywords and
task tags. `homeTab` and `coursesTab` are `Ephemeral` — declared in the
`Ephemeral` interface, defaulted in `blank()`, never read back out of a save —
so there is no persisted value to migrate, which is why #34 narrowed `meTab`'s
union and added no migration either. The `bare` prop and its second render path
come out of both screens with the callers.

---

## 6. T2, revisited — which home the grade table gets

Section 5 found the two duplicate tabs and cut both, keeping the destination
each time. T1 is right and stands. **T2 is reopened here and resolved the
other way**: the tab stays and the `grades` destination goes.

Nothing in section 5's evidence changed. What changed is the question it asked.
"Which copy is the copy" has one answer when the two are a screen and an inline
render of that screen — the tab is the copy, which is why #34 cut it for
Settings and why T1 cuts it for the report. It has a different answer when the
embedded screen is genuinely *a view of its host*:

- `Courses.tsx` has said so in its own file comment since it was written:
  "Three views of the same four courses: the courses themselves, everything
  they are asking of you as one list, and what any of it is worth." The third
  view is the grade table. Two of the three shipped as tabs and one shipped
  twice.
- `grades` had `root: 'courses'` in the registry, so even the directory filed
  it under the screen it is a view of.
- Courses is in `DEFAULT_TABS`. The tab is one tap; the destination is two
  taps down a directory. "What do I need on the final" is not a two-tap
  question in week ten.

The report is the opposite case, and that is why the two go different ways: it
has a grain switcher of its own, so as a tab of Today it was a switcher inside
a switcher, and "what is on now" and "how did it go" are asked on different
days by a different person.

### What T2' carries

Deleting a destination is more than deleting a tab, so:

- `courses` takes the grades `keywords`, the plural included — "where are my
  grades" matched `registrar` and nothing else until it did.
- `#/grades` retires into `#/courses` on the grades grain, through a new
  `opens.courses` alongside `opens.report` and `opens.changes`. The course id
  the link used to carry went with it: the table lists every course and never
  read it.
- The soft shell's header and the assistant's context both read the grain, so
  the running-grade hero and the grade rows follow the tab rather than being
  lost with the `case 'grades'` they lived in.
- The projection insight can name the grain it means.
- `UNLOCKS.grades` and the now-unread `hasGrades` fact go: Courses is where the
  first score is typed, and gating it would hide the way in.
- A stored tab bar or `recent` entry naming `grades` is dropped, with a test
  for each.

`lib/onehome.test.ts` from section 5 still holds and is what keeps this honest:
the tab renders `<Grades />` with no prop to choose a frame, because there is
only one caller and one frame.

**50 → 49 destinations.**

### The rest of the sweep

Two censuses run alongside T2', recorded because a null result is worth as much
as a finding — and one of them was a null result for the wrong reason.

- **Controls. This one was wrong, and §3 above says why.** The census was every
  `set*` action in `state/slices/settings.ts` against every file that dispatches
  it: 18 actions, one of them — `setLook` — written from more than one file, and
  those four writes touch different keys. That is all true and it is not the
  question. The Claude key, the proxy field and the model picker were a genuine
  second copy at the time this ran, and they call `saveSettings()` rather than
  the reducer, so no `set*` census could have seen them however carefully it was
  run. Read as "no control is duplicated *through the reducer*"; §3 has the
  finding and #46 has the merge.
- **Routes, recounted.** `edit` 5, `import` 4, `mine` 3, everything else two or
  fewer — unchanged from section 2 and left alone for its reasons.
- **Screens imported by screens**, the other way a screen could hide inside
  one: `FirstRun` (a shared empty state), `Guide → FieldGuide` (`field` is a
  `StudyMode`, not a `Screen`) and `Today → GapOffer` (`gap` has no directory
  row). None is a destination; none is a duplicate.

---


### T2, a third time — the destination comes back, on Semester

Reversed again, by the person the app is for. The reasoning in this section
is about *which of Courses and the tab* is the copy, and it answers that
well. It does not answer the question actually being asked, which is whether
"how am I doing" is a thing you go to or a thing you find while looking at
something else.

It goes back to being a destination, and to Semester rather than Courses:
the shelf that already holds Reports and When you are behind, which are the
other two ways of asking it. `root` stays `courses`, so the tab bar still
lights Courses when you are on it — the answer above about which screen it
is a view of was never in dispute.

The tab goes, so there is still exactly one way in. That is the half of §5
and §6 that has held through all three turns: whatever the grade table is,
it should not be two things at once.

### T2, a fourth time — the tab, and this one is the answer

Asked for directly by the person the app is for: the grade table is the
Grades tab of Courses, and `grades` is not a destination. This restores the
state §6 and #44 left, and reverts the turn above.

Nothing in the reasoning of the turn above is withdrawn — it is a fair
argument, and it is left standing so this section stays the record of what
was argued rather than only of what won. What settles it is not a better
argument: it is that the question it turns on, whether "how am I doing" is a
thing you go to or a thing you find while looking at something else, is a
question about how one person uses their own app, and that person has now
answered it. Three of the four turns here were an assistant reasoning from
the code about a preference the code cannot contain.

So the practical note for whoever reads this next: this row is closed. It has
been reversed four times, twice in each direction, and each turn cost a
migration of `#/grades`, the tab bar's `root`, the assistant's context and
the projection insight. Reopening it needs a new instruction from the person
whose app it is, not a fresh reading of `Courses.tsx`.

What held through all four turns is still the only part that was never in
dispute: whatever the grade table is, it is not two things at once.
## Appendix — the first pass, resolved

Run at `ac5a2c8` against 59 destinations. Kept because the verdicts still hold
and this pass re-used them rather than re-deriving them.

| # | Change | Destinations | Done |
| --- | --- | --- | --- |
| M1 | `weekly` + `worked` → `brief`, at three grains | −2 | ✅ `bc8c5b3` |
| M2 | `check` → `announce`, at two sources | −1 | ✅ `28d8422` |
| M3 | The duplicate `edit` and `import` offers | 0 | ◐ one fixed; the rest are three navigations, left deliberately |
| M4 | The `home` blurb, and the merged screens' `keywords` | 0 | ✅ |

Its two corrections to the brief it was given are worth keeping too: the six
"what is due" screens were four questions and not one, and `proof` was never a
screen about where you stand.

### M3, as far as it went

One of the two was real and is fixed: the edit screen's "take the semester on"
button dispatched `go: 'edit'` from `edit`, which pushed a history entry, so
Back landed somebody on the screen they had just pressed Back from. `adopt()`
alone is enough — the editor draws on the next render.

The rest were not duplicates on inspection. `import` is offered by the Courses
screen, by the soft shell's action bar and by the springboard's floating
button, and those are three different navigations of which exactly one is on
screen at a time (`NAVS` in `lib/look.ts`). Cutting any of them would remove
the affordance for whoever chose that navigation. Left alone, deliberately.

**59 → 56 destinations.** That is a smaller cut than the brief assumed, and the
reason is worth stating plainly: this app is large because it does a lot, not
because it does the same thing repeatedly. The duplication that exists is
concentrated in the reports, the two reconciliation screens, and the assistant —
and the assistant is a different command.

Every merge must carry: the survivor's `keywords` widened with the dead
screen's, a `state/shape.ts` migration so a saved `screen` that no longer
exists lands on the survivor, and a test for that migration.

---
