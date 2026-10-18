# Simplify audit — one app, one home per job

Companion to `GROUPED-AUDIT.md`. Counted claims, each with the command that
produced it. Measured at `6db2b42b` (the stored-effort commit on
`claude/upbeat-curie-w1zu4f`). No code is changed by this audit.

Read this before the merge work. Where a row says **open**, the merge has not
been decided, and nothing in the app has changed because of this document.

## 0. Corrections to the brief

The brief was written from the names of screens it expected. The repository
differs, and the rows below use what the code says:

| Brief said | Measured |
| --- | --- |
| 59 destinations in `lib/nav.ts` | **63** entries in `DESTINATIONS` (`lib/nav.ts` lines 202–1002: `grep -cE "^\s+screen: '"` over that range) |
| `weekly`, `ahead`, `tonight`, `standing`, `worked`, `everything`, `springboard`, `chat` as destinations | **None are registry ids.** `grep -cx` against the 63 ids returns 0 for each. `ahead` is a *task tag* (`TASKS`, `lib/nav.ts:190`), not a screen. "Week ahead" is a section inside `screens/Today.tsx` and `screens/report/Day.tsx`. "Weekly report" is a label in `components/TermSwitch.tsx`. `Springboard` is a file (`screens/Springboard.tsx`) but not a registry id. |
| Screens | `screens/` holds **89** top-level `.tsx` files and **119** non-test `.tsx` files including subfolders (`find screens -name "*.tsx" -not -name "*.test.tsx"`). |

The "59" in the brief is not a number this audit can reproduce. The audit uses 63.

## 1. Destinations and how people arrive

Method: for each of the 63 ids, count the distinct non-test source files that
navigate to it — `screen: '<id>'`, `go('<id>')` or `screen === '<id>'`
(`grep -rlE`, excluding `lib/nav.ts` and `*.test.*`).

**This is a file count, not a route count.** A file that renders a link to a
screen counts once, whether it is a menu or a button. So a high number is a
prompt to read, not a finding.

Highest file counts (arrival files):

| id | files | id | files | id | files |
| --- | --- | --- | --- | --- | --- |
| home | 18 | courses | 18 | study | 19 |
| degree | 15 | import | 15 | account | 15 |
| privacy | 13 | university | 11 | yes | 10 |
| calendar | 12 | help | 10 | connect | 9 |
| edit | 9 | export | 9 | career | 8 |
| work | 8 | | | | |

Lowest:

- `athletics`: **0** — reached only through the directory and search.
- `create`, `essay`, `call`, `links`, `runway`, `hub`, `clocks`, `nil`: 1 each.

Verdict on this table: **not decided.** Whether `home` (Today) and `brief`
(Your day) answer the same question is a render question. This audit has not
yet read what each renders, so no survivor is named.

## 2. "What is due and when"

| Candidate | Measured | Verdict |
| --- | --- | --- |
| `home` (Today) | registry id; the week-ahead section lives inside it (`screens/Today.tsx`) | **open** — needs render read |
| `brief` (Your day) | registry id; the phrase also appears in `screens/Activities.tsx` | **open** — needs render read |
| `mine` | registry id, 4 arrival files | **open** — needs render read |
| `calendar` (day/week/month/semester) | a single screen with grains (`screens/Calendar.tsx`) | **open** — the brief's question is whether `weekly`/`ahead` belong inside it; they are not screens, so the question is whether the week-ahead *section* duplicates a calendar grain |
| `weekly`, `ahead`, `tonight` | not destinations (§0) | **cleared as screens**; the content is a section question inside `home`/`report` |

Nothing in this group is merged by this audit.

## 3. Duplicated controls — the one part measured to a decision

Method: for every `case 'set…'` in `state/slices/settings.ts` (26 actions),
count the non-test files containing `type: '<action>'`.

Caveat: `state/shape.ts` declares every action in the `Action` union, so every
action shows at least one file. The rows below exclude that file.

| Setter | Dispatching files (excluding `shape.ts`) | Verdict |
| --- | --- | --- |
| `setFeedOrder` | `screens/Today.tsx` (one writer, `onMove`), `screens/settings/Nav.tsx` (two writers of its own: `onMove` and inline up/down, lines 74, 327–328) | **Duplicate.** Same field, two screens, three writers. Both screens read `state.feedOrder` (`Today.tsx:1707,1722`; `Nav.tsx:73,287`). Survivor: the settings screen (one place per control). Today keeps reading it. **Decision: merge the writer into `settings/Nav.tsx`.** Not yet changed. |
| `setNav` | `components/Appearance.tsx`, `components/desk/Customize.tsx` | **Duplicate.** Survivor: `Appearance.tsx` (settings). `desk/Customize` loses its writer. **Decision: subsume into Appearance.** Not yet changed. |
| `setLook` | 16 files — `components/unity/{QuickActions,modes,CommandCenter,SystemContextBar}.tsx`, `components/{Appearance,TodayActionCenter,TodayDecisionSurface,AccessModes}.tsx`, `components/desk/{Customize,AppsPanel}.tsx`, `lib/tools.ts`, `screens/{Springboard,Directory,settings/Look,settings/Courses,settings/Nav}.tsx` | **Largest duplicate surface.** The appearance setting is writable from 16 places. Some of these are presets or mode switches, which may be legitimate shortcuts; the audit has not separated them. **open** — needs a read of each writer to say whether it sets the same value a settings control sets, or a different one. |
| `setAttendPolicy` | `components/Attendance.tsx`, `screens/Import.tsx` | **open** — the import flow may legitimately ask at import time. |
| `setDayBudget` | `components/Clashes.tsx`, `lib/tools.ts` | **open** — `lib/tools.ts` is not a screen; check whether it is a tool-call path. |
| `setCutoffs` | `components/Cutoffs.tsx` only | **Cleared.** One writer. |
| `setTabs` | `components/TabChooser.tsx` only | **Cleared.** One writer. The brief asks that the tab bar be chosen in one place; `TabChooser` is that place, provided `settings/Nav.tsx` renders it and does not write `setTabs` itself (it does not, per the grep). |
| `setCourseOrder` | `components/YourCourses.tsx` only | **Cleared.** |
| `setEffort` | `components/EffortField.tsx` only | **Cleared.** Added in `6db2b42b`. |

## 4. Duplicated UI — counts the brief asks for

**Not measured in this pass.** The brief asks for hand-rolled list rows,
headers, chip rows and empty states, re-counted against `GROUPED-AUDIT.md`'s
74. A grep for those patterns is not reliable enough to count them honestly
(class names and inline styles vary), and a wrong count here would be worse
than none. The re-count needs a per-pattern read and is **open**.

## 5. What is not resolved, and why

- **No destination is merged or removed.** Every merge in §2 needs the render
  reads listed as open. Deleting a registry row without them would move a
  screen's content somewhere nobody decided on.
- **Reachability claim.** The brief's done-means says *no destination is
  reachable by more than one pathway outside the directory and search*. §1 gives
  file counts, not pathways, so that claim cannot be made from this audit.
  It needs a route-level read per destination.
- **Saved-state migration.** No screen has been removed, so no saved `screen`
  value has changed meaning. The migration test the brief asks for is needed
  only once a destination is removed.
- **Screen count.** Still 63 registry destinations; not lower than 59, and the
  brief's 59 is not reproduced.

## 6. Order of work, once the open rows are read

1. Duplicated writers, which are measured and cheap: `setFeedOrder` (Today →
   settings), then `setNav` (Customize → Appearance). Each is one commit with a
   test that the setting still round-trips.
2. `setLook`, after classifying its 16 writers as presets versus the same value.
3. Render reads for `home`, `brief`, `mine` and the week-ahead section, then the
   §2 decision.
4. Hand-rolled UI counts, per pattern.
5. Removals, each with the `lib/nav.ts`, `App.tsx`, lazy import, screen file,
   `Screen` union member and `go` sites named in the brief, and the saved-state
   migration test.
