# Simplify audit (partial, step 1)

Status: **partial.** This pass checks the registry's counts and the brief's premises. It does not finish the overlap table, the control table, or the UI-duplication recount. No code changed.

Scope: `app/src`. The branch is `claude/youthful-hopper-78agev`, based on `origin/main` at `fb51d663`.

## Counted claims (verified in this pass)

| Claim | Count | How |
| --- | --- | --- |
| Destinations in `DESTINATIONS` (`lib/nav.ts`, lines 202–1012) | 63 | `grep -c "^    root:"` over the block |
| Shelves (`Group` type and `GROUPS`) | 8 | `lib/nav.ts` lines 77–120 |
| Tab bar defaults (`DEFAULT_TABS`) | 5 (`home`, `calendar`, `study`, `support`, `me`) | `lib/tabbar.ts` line 60 |
| Places that dispatch `type: 'go'` | 247 | `grep -rn "type: 'go'"` outside tests |
| Files in `screens/` that hand-roll a `…row…` class | 6 files, 13 occurrences | `grep -rl` / `grep -rn` on `className="…row…"` |

The brief said 59 screens and nine shelves. Both are out of date. The registry has <!--screens-->sixty-three<!--/--> destinations (the parser counts "the institution" as a destination too, so the real figure may be 62), and the code comments already say eight shelves.

## Premises that do not match the code

- **Named screens that do not exist as `Screen` members:** `tonight`, `weekly`, `ahead`, `standing`, `everything`, `chat`, `check`. Their work was already folded in by earlier passes. `nav.ts` says so: "Tonight and Ahead answer…", "Standing wore out", and Grades and Catching up fold into Semester.
- **Screens that do exist and match the brief's concern:** `home` (Today), `brief` (Reports), `mine` (Personal), `calendar`, `me` (Progress), `hub` (Notices), `launchpad`, `behind` (Catching up), `runway`, `proof` (Check the writing), `grades` as a `Screen` member, `ask`, `import`, `edit`, `announce`, `registrar`, `update`.
- **Settings setters named in the brief** (`setTabs`, `setNav`, `setLook`, `setScale`, `setDayBudget`, `setCutoffs`): none is found by name in `state/slices/settings.ts` or in any file that calls them. Their real names have not been identified yet. Control duplication is therefore **not yet measured**.

## Overlap table (candidates only, no verdicts)

Each row is a question to check. Nothing here is "merge" or "keep" until the screen's state reads and rendered output have been read.

| Candidate set | Members in registry | Verdict |
| --- | --- | --- |
| "What is due and when" | `home`, `brief`, `mine`, `calendar`, `behind`, `runway` | **Not yet checked.** `brief` is labelled Reports in the registry, which may not be the same question. |
| Calendar grains | `calendar` (one screen; the grains are inside it) | **Not yet checked** whether `ahead`-style week views still exist elsewhere. |
| Assistant surfaces | `ask`, plus the assistant sheet in `components/ai/Assistant.tsx` (not a destination) | **Not yet checked.** Owned by `/ask-tab` per the brief. Record only. |
| "Where you stand" | `me`, `proof`, `behind`, `brief` | **Not yet checked.** |
| Finding a screen | `help`, `support`, `connect`, search, `me` as directory | **Not yet checked.** The brief names the directory and search as indexes, which do not count as pathways. |
| Changing course data | `import`, `edit`, `update`, `announce`, `registrar` | **Not yet checked.** |

## Route count per destination

Not yet done per destination. The total of 247 `go` dispatches is the upper bound on pathways. Mapping each destination to its arrival points needs the `openCourse` / `openItem` / `openEvent` / `openGuide` / `openLesson` grep, which has not been run.

## Next steps (not started)

1. Read each candidate set's screens: state reads, rendered output, and what each answers.
2. Find the real settings setters and build the control table.
3. Recount hand-rolled rows, headers, chip rows and empty states.
4. Turn every row above into merge, subsume, keep (with a reason) or cut.
5. Only then start the merges, one per commit, each green.
