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

| # | Change | Destinations | Files touched |
| --- | --- | --- | --- |
| M1 | `weekly` + `worked` → `brief`, at three grains | −2 | ~10 |
| M2 | `check` → `announce`, at two sources | −1 | ~6 |
| M3 | Drop the duplicate `edit` and `import` offers where a screen and its own softtop bar both make them | 0 | ~4 |
| M4 | Fix the `home` blurb, and move every merged screen's `keywords` onto its survivor | 0 | 1 |

**59 → 56 destinations.** That is a smaller cut than the brief assumed, and the
reason is worth stating plainly: this app is large because it does a lot, not
because it does the same thing repeatedly. The duplication that exists is
concentrated in the reports, the two reconciliation screens, and the assistant —
and the assistant is a different command.

Every merge must carry: the survivor's `keywords` widened with the dead
screen's, a `state/shape.ts` migration so a saved `screen` that no longer
exists lands on the survivor, and a test for that migration.
