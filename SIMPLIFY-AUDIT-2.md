# Simplify audit (second pass, `app/src`)

Scope: "make the app one app". This is Step 1 of the brief only: the audit,
with no code changed. It is written to `SIMPLIFY-AUDIT-2.md` because
`SIMPLIFY-AUDIT.md` at the repo root is an existing 35th-pass audit (7,035
lines, in history). Replacing it would delete that record. Counts below come
from grep at commit `385c90b0`, and each count says how it was taken. Rows
marked *proposed* are verdicts for Step 2, not completed merges.

## 1. Counted baseline

| Claim | Count | How it was counted |
| --- | --- | --- |
| Screen destinations in `lib/nav.ts` | **63** | `grep "screen: '"` over `lib/nav.ts`, lines 204–1014. The brief says 59; this is the number in the file. |
| Destinations with a `Screen` file under `src/screens/` of the same name | see §2 | `find src/screens -iname "<name>*.tsx"` |
| `dispatch({ type: 'go' …})` call sites | 323 across 154 files | `grep -rn "type: 'go'"` |
| `setLook` dispatches | 58 | `grep -rhoE "type: '…'"` |
| Other `set*` dispatches with ≥5 call sites | `setCoursesTab` 16, `setCalDay` 14, `setCalView` 10, `setMathTab` 8, `setTerm` 7, `setMineTab` 7, `setHomeTab` 6, `setNav` 5, `setDayBudget` 5, `setReport` 5, `setRole` 5 | same grep |

Method limits: the `go` figure counts every `type: 'go'` line, including ones
that pass a `screen` argument on another line, so it is an upper bound on
distinct routes. The per-destination table in §2 uses `type: 'go', screen:`
on one line plus a two-line lookahead. It over-counts, because two-line
lookahead also catches `setLook` and `setAssistant` payloads. Treat §2 counts
as ±20% until a parser replaces the grep.

## 2. Premises the brief got wrong

The brief names screens that do not exist as nav destinations. Each one was
checked, and the work on these rows changes:

- **`ahead`, `tonight`, `worked`, `everything`, `chat`, `check`**: no nav
  destination and no screen file of that name. `everything` and `me`
  (the directory) are the only index-like pair in `nav.ts`, and `me` is
  labelled **Progress**, not a directory.
- **`brief`** is in `nav.ts` with label **Reports** and the blurb
  "The day, the week or the term, read back from what the app recorded." It
  is not "Your day". It has **0** `go` dispatches, so the only way to reach it
  is the nav itself.
- **`weekly`** is not in `nav.ts`. Its files are `Reports.tsx` and a test.
  It is reached through `brief`'s screen, not its own route.
- **`calendar`** labels itself "day, month or the whole semester" (three
  grains), not four. Confirm the grain list in `Calendar.tsx` before merging.
- **`announce`** has no `src/screens/` file. Its screen is in `Courses.tsx`.

## 3. Screen overlap, by question answered

| Question | Screens | What each reads and renders (checked against label/blurb; not yet line-by-line) | Proposed verdict |
| --- | --- | --- | --- |
| What is due, and when | `home` (Today, 16 go), `mine` (Personal, 5 go), `me` (Progress, "what is late, what the week holds") | Today: the day's and week's work. Personal: the student's own actions and appointments. Progress: late items + week + "everything else". | **Merge `me`'s "late + week" section into `home`.** Keep `mine` (its blurb is about the student's own items, a different question). |
| Where I stand | `grades`(no nav, 1 file), `standing` (lib, 1 file), `proof` (nav, 1 go), `brief` (Reports) | Grades, standing and proof are three views of one computed result; Reports reads back the same log. | **Subsume** `grades` and `standing` into `proof` as sections, then decide `proof` vs `brief` after reading both. Not decided yet. |
| Calendar grains | `calendar` (8 go), `brief` (week and term views) | The calendar already has day/month/semester. A weekly grain is a view of the same data. | **Subsume** the week view into `calendar` once the grain list is confirmed. |
| Ask and assistant | `ask` (nav, 3 go), `chat` (no nav; `Assistant.tsx` is the sheet) | One conversation with three surfaces. | **Record only.** The `/ask-tab` command owns this, per the brief. |
| Find a screen | `search` (5 go), `help` (nav, 7 go), `springboard` (1 file), `me` | Four ways to find a screen. Search and the directory are indexes and do not count as routes. | **Keep** search and the directory. `springboard` and `help` are the candidates. Decide after reading `Springboard.tsx`. |
| Change course data | `import` ("Add a course", 8 go), `edit` ("Edit the course", 8 go), `update` ("Add a reading", 1 go), `announce` ("A change to a date", 1 go) | Four different jobs on a course: add a course, edit a course, add material, record a change from an email. `announce` is an inbox action. | **Keep `import` and `edit` separate** (different questions: new vs existing). **Keep `update`** (adds a reading, which is study material, not course metadata). **Keep `announce`** (email-driven changes are a different question). Verdict: no merge, but the brief's "five ways" overstates it. |

Counting note: "five ways to find a screen" and "five ways to change course
data" in the brief match the overlap list, but the course-data list is four
screens, not five. `check` is not a screen.

## 4. Route count per destination (approximate)

Destinations with the most `go` call sites (grep, two-line lookahead; see §1
caveat). These are the ones where a second pathway is most likely:

`home` 16 · `account` 13 · `courses` 12 · `degree` 9 · `import` 8 · `edit` 8 ·
`calendar` 8 · `university` 7 · `profile` 7 · `privacy` 7 · `help` 7 ·
`essay` 7 · `yes` 6 · `export` 6 · `behind` 6 · `mine` 5 · `applying` 5

Destinations with one or zero call sites, which are reachable mainly through
the nav: `brief`, `update`, `announce`, `proof`, `me`, `nil`, `runway`,
`meals`, `housing`, `clocks`, `career`, `family`, `equations`, `draw`,
`solve`, `exam`, `write`, `work`, `support`.

**"Reachable more than one way" check is not done.** It needs a full route
parser, not this grep. It is the first step of Step 2 and it is still open.

## 5. Duplicated controls

`setLook` is dispatched from 58 call sites, which makes it the most written
setting in the app. The brief's "settings in one place" rule says appearance
settings should live in `screens/settings/`. That has not been checked, so no
merge is proposed here. The other controls to check first, by call count:
`setCoursesTab` (16), `setCalDay` (14), `setCalView` (10), `setNav` (5),
`setDayBudget` (5). `setCalDay` and `setCalView` are calendar controls and
probably belong in `calendar`. `setNav` and `setDayBudget` may be duplicated
between `Settings` and a second screen. Each needs a read.

## 6. Duplicated UI

Not re-counted in this pass. The brief asks for the `GROUPED-AUDIT.md` figure
(74 hand-rolled list rows across 31 screens) to be re-counted, plus headers,
chip rows and empty states. That needs an AST or regex pass over `screens/`
and is left open.

## 7. What is left open

- Step 2 merges: none started. The verdicts in §3 are proposals.
- The per-destination "reachable only one way" grep (§4) needs a parser.
- The duplicated-UI count (§6).
- The `setLook` and other control locations (§5).
- Decisions the brief reserves for the user: merging `proof`/`brief`, and
  whether `help` or `springboard` is the survivor for the find-a-screen job.

Done bar (`npm run lint && npm test && npm run build`) was not run because no
code changed in this commit.
