# One app — the audit, before any code

Step 1 of `/simplify`. No code in this commit.

Counted against `app/src` at `ac5a2c8`: **59 destinations** in `lib/nav.ts`, 60
screen files, 76 components, 9 shelves, 4 navigations.

Two of the claims that started this pass were wrong, and saying so first
changes what the merges should be.

---

## The premise, checked

> Six screens answer "what is due and when".

**Half right, and the half that is wrong is the expensive half.** Today, Brief,
Weekly, Ahead, Tonight and Mine do all read `state.tasks`, `state.done` and
`state.commitments`. They are not six answers to one question:

| Screen | The question it answers | Shape |
| --- | --- | --- |
| `home` Today | What is on now | A screen you live on |
| `brief` Your day | How did today start / end | Counted report + AI paragraph |
| `weekly` Weekly report | How did the week go, what is coming | Counted report + AI paragraph |
| `worked` What worked | How did the term go | Counted report, no AI |
| `ahead` The week ahead | Is the next seven days survivable | Hours arithmetic |
| `tonight` Tonight | Which of tonight's hours are worth most | Points-per-hour ordering |
| `mine` Mine | The things I added myself | A different kind of data |

Four of those are genuinely different questions asked on different days. **Three
are the same object at three grains**, and that is the merge — see M1.

> 74 hand-rolled list rows across 31 screens with no shared component.

**Out of date, and it was my own claim.** That was `GROUPED-AUDIT.md`'s count
before the grouped-shell work landed. Today:

```
$ grep -rn "borderBottom: '1px solid var(--app-line)'" --include=*.tsx app/src | wc -l
37
$ grep -rln … | wc -l
15        # of which one is Rows.tsx itself, drawing the shared row
```

`ItemRow` exists in `components/shell/Rows.tsx`, alongside `NavRow`,
`ToggleRow`, `SelectRow`, `SliderRow`, `ValueRow`, `DestructiveRow`,
`CustomRow` and `FullBleed`, and 8 files use them. The row work is half done,
not undone. What is left is 37 rows in 14 files, and the concentration is
`Guide` (8), `Update` (5), `Calendar` (5), `Work` (3), `Field` (3).

> `proof` is one of four screens that say where you stand.

**Wrong.** `Proof` is a paste-box that reads text back to you. It has nothing
to do with standing. The standing cluster is `grades`, `degree` and `worked`,
and only `worked` moves.

---

## 1. Screen overlap

Verdict per cluster, with the evidence that decided it.

### Cluster A — the reports · **MERGE**

`lib/brief.ts` (277 lines) and `lib/weekly.ts` (267) are the same file written
twice at two grains. Both are: an `Input` interface → a counted struct →
a `SYSTEM` prompt constant → a report string.

```
lib/brief.ts    DayInput → morning()/evening() → MORNING_SYSTEM/EVENING_SYSTEM → morningBrief()
lib/weekly.ts   WeeklyInput → behind()      → SYSTEM                       → brief()/document()
```

`screens/Worked.tsx` (232 lines) is the third: the same counted-report shape at
term grain, with the AI paragraph left off. And `screens/Weekly.tsx` imports
`lib/ahead.ts` — it already contains the forward half of `screens/Ahead.tsx`.

**M1: `weekly` and `worked` are subsumed into `brief`, which becomes a report
with three grains — Day, Week, Term.** Survivor is `brief` because it is the
only one of the three that is already dispatched to from another screen
(`Today.tsx`), and the grain switch is the `Segmented` control the app already
has. Two destinations go.

`ahead` **stays.** It is forecast arithmetic with a stated refusal to produce a
readiness score, not a report on something that happened. Its overlap with
Weekly's forward section is real and is recorded here rather than merged, per
the rule about two questions that look alike.

`tonight` and `mine` **stay.** Different question; different data.

### Cluster B — the assistant · **owned by `/ask-tab`**

Three surfaces over one conversation — `screens/Ask.tsx`, `ai/Chat.tsx`,
`ai/Assistant.tsx` — and the `ask` tab does not open any of them, it opens a
sheet. Recorded here, fixed there.

### Cluster C — changing course data · **MERGE, one of five**

`import` (a syllabus in), `edit` (fix a course by hand), `update` (add a
reading), `announce` (paste the email that moved a deadline) and `check`
(compare against the LMS feed) are five screens that all write course data.
Three are genuinely different inputs. Two are one job:

- `announce` — an external statement that a date changed, pasted in.
- `check` — an external statement that a date changed, fetched from the feed.

Both end at the same place: a list of proposed date changes, taken one at a
time, applied through `replaceCourse`. `lib/reconcile.ts` already does the
cautious pairing for one of them.

**M2: `check` is subsumed into `announce`, which becomes "a change you were
told about" with two sources — paste it, or check the feed.** One destination
goes.

### Cluster D — finding a screen · **KEEP, all five**

`me` (shelves), `everything` (task tags + what you have never opened), `help`
(the generated guidebook), the search overlay (`components/Command.tsx`), and
the springboard navigation. They read the same registry and they are not the
same screen: `Everything.tsx`'s own file comment argues this out — "where is
the thing called X" and "what would I use this for" need different objects, and
hanging both off Me makes a directory you read once into a screen with four
modes. That argument holds. **Kept, with the reason recorded, per the rule.**

The four navigations in `look.ts` `NAVS` are a preference, not a duplication:
exactly one is drawn at a time and the file says so.

### Cluster E — where you stand · **KEEP `grades` and `degree`**

This term's marks and a four-year requirement ledger are not the same question.
`worked` leaves under M1.

---

## 2. Routes per destination

Every `screen: '…'` outside `lib/nav.ts`, by the file that dispatches it:

| Destination | Files that route to it | Reading |
| --- | --- | --- |
| `home` | 8 | Mostly `land.ts` / `shape.ts` fallbacks. Fine. |
| `item` | 7 | Deep links from insights and notifications. Fine. |
| `edit` | **8** | `Courses`, `EditCourse`, `Essay`, `Import`, `DropBy`, `OfficeHours`, `guidebook`, `softtop` |
| `import` | **7** | `App`, `Courses`, `FirstRun`, `Runway`, `Yes`, `keys`, `softtop` |
| `mine` | 7 | `Calendar`, `Today`, `behind`, `keys`, `openhit`, + 2 tests |
| `study`, `courses`, `calendar` | 5–6 | Tab plus contextual actions. Fine. |
| `chat` | 1 | `ai/Assistant.tsx`. Goes under `/ask-tab`. |

**The finding is that most of these are not second front doors.** They are
`lib/softtop.ts`'s action bar — one registry that gives every screen a
contextual "the thing you came to do next" — plus deep links from insights and
notifications. Those are contextual actions, and a contextual action is not a
pathway to a *home*; it is the app answering the question you are already
holding.

Two are worth cutting:

- **`edit` at 8.** `Courses.tsx` offers it, `softtop` offers it on the same
  screen, and `EditCourse.tsx` dispatches to itself. That is a duplicate
  control on one screen, not a deep link.
- **`import` at 7.** `App.tsx`, `keys.ts` and `softtop.ts` all offer the same
  global "add a course" affordance.

### The one dead claim

`nav.ts` says `home` shows "what is due, what is next, and **tonight's study
plan**". `grep -n "tonight" screens/Today.tsx` returns nothing. The blurb has
been describing a screen that does not exist since Tonight was split out, and
that blurb is what search matches against.

---

## 3. Duplicated controls

Every `set*` action dispatched from more than one file:

| Action | Files | Verdict |
| --- | --- | --- |
| `setLook` | `Appearance`, `settings/Look`, `settings/Nav`, `nav/Folder` | **Fine.** `Appearance` is the shared control; the settings pages render it. `Folder` writes the springboard arrangement, which is a different key. |
| `setMineTab` | `Calendar`, `Mine`, `Today` | **Deep link.** Two screens say "open Mine, on the tasks tab". Keep. |
| `setDueTab`, `setCoursesTab` | `Brief`, `Courses`, `Today` | **Deep link.** Same. Note that `Brief` is one of them — M1 must preserve these. |
| `setSample` | `SampleMark`, `FirstRun`, `settings/Courses` | **Fine.** One component, two hosts. |
| `setCalView`, `setCalDay` | `Clashes`, `Calendar` | **Fine.** A clash card jumps to the day it is about. |
| `setMeTab` | `Ahead`, `Me` | **Fine.** |

**Nothing here is a genuine second copy of a control.** The one real duplicate
control in the app is the `edit`/`import` pair above, which is a link and not a
setting. This section of the brief found less than it expected, and that is the
honest result.

---

## 4. What is left, and in what order

| # | Change | Destinations | Done |
| --- | --- | --- | --- |
| M1 | `weekly` + `worked` → `brief`, at three grains | −2 | ✅ `bc8c5b3` |
| M2 | `check` → `announce`, at two sources | −1 | ✅ `28d8422` |
| M3 | The duplicate `edit` and `import` offers | 0 | ◐ partly — see below |
| M4 | The `home` blurb, and the merged screens' `keywords` | 0 | ✅ with M1 and M2 |

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

- **Study → "Tonight" is not the `tonight` screen.** The tab is "Tonight's 25
  minutes": weakest unit per course, ordered by mastery, opening a card drill.
  The screen is points of final grade per hour over outstanding deadlines. Two
  questions — *what should I revise* and *how do I spend the evening* — that
  happen to share a word. Both kept, per the rule about two things that look
  alike. **The shared name was the real cost, and it is the half that could be
  fixed without merging anything: the tab is "Revise" (T3). Two jobs, two
  names, both still there.**
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
