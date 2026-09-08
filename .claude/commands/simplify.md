---
description: Audit the whole app for duplicate screens, duplicate pathways and scattered controls, then merge them so every thing has exactly one home and one route to it.
argument-hint: "[optional: a shelf or area to limit the pass to, e.g. 'Study' or 'calendar']"
allowed-tools: Read, Edit, Write, Glob, Grep, Bash
---

# Make the app one app

Scope: `app/src`. If `$ARGUMENTS` names an area, limit the merge work to it but
still do the full audit — a duplicate is only visible from above.

This app has 59 screens in `app/src/lib/nav.ts`, 76 components, a bottom bar, a
side rail, a springboard, a directory, a search box and an assistant. Most of
that is real. The problem is not size, it is that the same job is done in more
than one place, so a student has to know which one you meant.

## What you are fixing, precisely

**One home per job.** Two screens that answer the same question are one screen.
**One route per home.** A screen reached three ways is reached one way, plus the
directory and search, which are indexes and do not count as pathways.
**One place per control.** A setting that can be changed on two screens is a
setting that disagrees with itself.

## Step 1 — audit before you touch anything

Write `SIMPLIFY-AUDIT.md` at the repo root first. No code in that commit. Model
it on the existing `GROUPED-AUDIT.md`: counted claims, not impressions.

Build these tables by reading the code, not by guessing from names:

1. **Screen overlap.** For all 59 destinations in `lib/nav.ts`, list what each
   screen actually reads out of state and what it renders. Then group screens
   that read the same state and answer the same question. Start by checking
   these, which are the ones that look like duplicates from the registry —
   confirm or clear each with evidence:
   - `home` (Today), `brief` (Your day), `weekly` (Weekly report),
     `ahead` (The week ahead), `tonight`, `mine` — six screens over "what is
     due and when".
   - `calendar` day/week/month/semester views vs `ahead` vs `weekly` — the
     calendar already has four grains.
   - `ask`, `chat`, and the assistant sheet in `ai/Assistant.tsx` — three
     surfaces over one conversation. (The dedicated `/ask-tab` command owns the
     fix; here, only record it.)
   - `grades`, `standing` in `lib/standing.ts`, `worked`, `proof` — where you
     stand, said four times.
   - `everything`, `me`, `springboard`, `help`, search — five ways to find a
     screen.
   - `import`, `edit`, `update`, `announce`, `check` — five ways to change
     course data.
2. **Route count per screen.** Grep every `dispatch({ type: 'go'` and every
   `openCourse` / `openItem` / `openEvent` / `openGuide` / `openLesson` call.
   For each destination, list every distinct place a person can arrive from.
   Flag anything reachable more than one way that is not the directory
   (`me`, `everything`) or search.
3. **Duplicated controls.** Find every setting written by more than one screen:
   grep the `set*` actions in `app/src/state/slices/settings.ts` and list which
   screens dispatch each. `setTabs`, `setNav`, `setLook`, `setScale`,
   `setDayBudget`, `setCutoffs` and the appearance actions are the likely ones.
4. **Duplicated UI.** The audit in `GROUPED-AUDIT.md` found 74 hand-rolled list
   rows across 31 screens with no shared component. Re-count it, and add the
   same count for hand-rolled headers, chip rows and empty states. These become
   shared components.

For each overlap, the audit says one of: **merge** (name the survivor and what
moves into it), **subsume** (it becomes a view or a section of another screen),
**keep** (say why the two questions are genuinely different), or **cut** (dead
or never-used — check the "never opened" data the `everything` screen already
tracks).

## Step 2 — merge, in small commits

Work down the audit. One merge per commit, each one green.

Rules that decide the arguments:

- **The survivor is the one a student already opens.** Where the app tracks
  screen counts (`countScreens`), use it. Where it does not, the survivor is the
  one in `DEFAULT_TABS` (`lib/tabbar.ts`).
- **A merged screen becomes a view, not a link.** If Ahead is really the
  calendar's week grain, it becomes a grain of the calendar — do not leave a
  screen that redirects. A redirect is still a second pathway.
- **Deleting a destination means deleting its row in `lib/nav.ts`,** its case in
  `App.tsx`, its lazy import, its screen file, its `Screen` union member in
  `lib/types.ts`, and every `go` that pointed at it. Then handle saved state:
  `readTabs` already drops unknown screens, and `state/shape.ts` must migrate a
  saved `screen` that no longer exists to its survivor rather than rendering
  nothing. Add a test for that migration.
- **Nothing becomes unreachable.** After every merge, the directory, search
  keywords and `taskTags` in `lib/nav.ts` must still find the job by the words a
  student would type. Move the dead screen's `keywords` onto the survivor —
  that is what keeps "email", "gmail", "powerpoint" landing somewhere.
- **Never merge two things that are genuinely two questions** just because the
  screens look alike. "What is due" and "how did the week go" are asked on
  different days by a different person in a different mood. If in doubt, say so
  in the audit and keep both.
- **Do not touch data shape** to make a merge easier. `docs/data-contract.md`
  and `packages/contract` are the boundary; a UI merge does not get to move it.

## Step 3 — one place for each control

- Every appearance and layout setting lands in `screens/settings/`. Screens that
  currently offer their own copy get a link to the setting, not a second copy.
- The tab bar's contents are chosen in one place (Settings → Navigation, via
  `lib/tabbar.ts`). Delete any other tab-editing UI.
- Keep `PINNED`, `MOST`, `FEWEST` semantics intact. A bar a student can break is
  a trap; the comments in `lib/tabbar.ts` explain why and they are right.

## Step 4 — make what is left easy to find

- Every surviving destination has a `blurb` that says what you would come here
  to do, in the second person, and `keywords` covering the words a student would
  actually type, including the words of anything merged into it.
- Every surviving screen has at least one `taskTags` entry, so it appears under
  an intention on the directory.
- Reduce the shelves in `GROUPS` if a merge leaves one with fewer than three
  screens. Nine shelves for a smaller app is nine shelves too many.

## Guardrails

- Do not invent new features. This pass removes and merges; it adds only shared
  components and migrations.
- Do not change what leaves the device. `app/src/lib/context.ts` is the only
  file that decides that, and it is not part of this work.
- Syllabus-derived data stays syllabus-derived. Merging screens must not blur
  the line between a deadline from a syllabus and a task the student wrote.
- Keep the prose comments. This codebase explains *why* at the top of each file
  and that is a feature — when you merge two files, merge their reasoning too,
  and say what was collapsed and why.

## Done means

From `app/`:

```bash
npm run lint && npm test && npm run build
```

All green, plus:

- `SIMPLIFY-AUDIT.md` exists and every row in it is resolved — merged, subsumed,
  kept with a reason, or cut.
- No destination in `lib/nav.ts` is reachable by more than one pathway outside
  the directory and search. State that as a checked claim, with the grep you ran.
- No saved state can land the app on a screen that no longer exists, and there
  is a test proving it.
- The screen count is lower than 59 and you say the new number and what went.

Report at the end: what merged into what, how many screens and routes went, what
you kept and why, and anything the audit found that you deliberately left alone.
