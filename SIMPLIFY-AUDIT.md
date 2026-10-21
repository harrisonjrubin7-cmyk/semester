# Simplify audit: make the app one app

**Status:** audit only. No screen, route, setting or component has been changed.
**Counted from:** `origin/main` as of 2026-10-21, branch `claude/brave-pasteur-kpyg4w`.
**Method:** `grep` counts over `app/src` (non-test files). Counts are reproducible with the commands in each section.

## 0. The brief's premises, checked

The brief describes 59 destinations and names screens that do not exist. These
corrections change what can be merged.

| Brief says | Measured | Command |
| --- | --- | --- |
| 59 screens in `lib/nav.ts` | **<!--screens-->sixty-three<!--/--> destinations** in the `DESTINATIONS` list. A raw `grep -c "screen: '"` gives 64 because `community` (`nav.ts:1014`) sits outside that list | `grep -c "screen: '" app/src/lib/nav.ts` |
| `weekly`, `ahead`, `tonight`, `chat`, `standing`, `worked`, `everything`, `check` are screens | **None** exists in the `Screen` union (`lib/types.ts`, 85 members) or in `nav.ts` | `grep -c "| 'weekly'" app/src/lib/types.ts` (and the others) |
| `grades` and `springboard` are destinations | Both are in the `Screen` union, **neither** is a `nav.ts` destination | `grep -c "screen: 'grades'" app/src/lib/nav.ts` → 0 |
| `countScreens` tracks screen counts | **Does not exist.** `usage.ts` and `privacy.ts` match on other names | `grep -rn countScreens app/src` → no definition |
| `GROUPED-AUDIT.md`: 74 hand-rolled rows over 31 screens | Present, and the count line is unchanged in the file (`GROUPED-AUDIT.md:27`). **Not re-counted** here; see §4 | `grep -n "74 occurrences" GROUPED-AUDIT.md` |
| Settings slice in `state/slices/settings.ts` | Dispatch sites are in the screens and components, not one file. Action names are dispatched as `type: 'setX'` | see §3 |

The 59 in the brief is not the 63 in the registry, and the difference is not
explained by these checks. Reconciling it is the first decision (§6).

## 1. Route count per destination

`type: 'go'` appears **324** times in non-test code. Dispatches with a literal
target, counted:

| Target | Dispatches | Target | Dispatches |
| --- | --- | --- | --- |
| `home` | 16 | `university` | 5 |
| `courses` | 12 | `mine` | 5 |
| `account` | 12 | `export` | 5 |
| `degree` | 9 | `applying` | 5 |
| `import` | 8 | `search` | 4 |
| `edit` | 8 | `registrar` | 3 |
| `calendar` | 8 | `guide` | 3 |
| `profile` | 7 | `directory` | 3 |
| `privacy` | 7 | `console` | 3 |
| `help` | 7 | `connect` | 3 |
| `essay` | 7 | `ask` | 3 |
| `yes` | 6 | (19 more, 1–2 each) | |
| `behind` | 6 | | |

Open helpers: `openCourse(` has **23** call sites, `openGuide(` **1**.
`openItem`, `openEvent` and `openLesson` **have no call sites** (the lesson
destination is reached by `go` with `screen: 'lesson'`, 2 dispatches).

**Multi-pathway claim.** The request's test is "reachable more than one way
outside the directory and search". Every destination with a `go` count above
1 is reachable from at least two sites by construction, so that test cannot
be applied to a count of call sites. It needs the arrival graph of *tabs,
rail, springboard and in-screen links* per destination, which is not yet
built. This audit does not claim the pathway count; the report must not state
it until that graph exists.

## 2. Screen overlap, by the request's clusters

Verdict key: **merge** (survivor named), **subsume** (becomes a section/view),
**keep** (two real questions), **cut** (dead), **decide** (needs the owner),
**n/a** (the screen does not exist, so there is nothing to merge).

| Cluster (as the brief names it) | What exists | Verdict |
| --- | --- | --- |
| `home`, `brief`, `weekly`, `ahead`, `tonight`, `mine` — "what is due and when" | `home` and `brief` and `mine` exist; `weekly`, `ahead`, `tonight` do not | **decide** `home` vs `brief` (both are in `nav.ts`, both answer "what now"). `mine` is the student's own items. Not merged until the owner says whether "today" and "your day" are one question. |
| `calendar` day/week/month/semester vs `ahead` vs `weekly` | `calendar` exists with view state `setCalView` (3 sites) and source filter `setCalSource` (3) and day `setCalDay` (9) | **subsume** `ahead`/`weekly` is **n/a**. `calendar` already is the grain screen; no further merge is measured. **keep** |
| `ask`, `chat`, assistant sheet | `ask` exists (nav, 3 `go`); `chat` does not; the assistant is `ai/Assistant.tsx` | **n/a** for `chat`. `ask` vs the assistant sheet is the `/ask-tab` command's job; recorded here only. |
| `grades`, `standing`, `worked`, `proof` | `proof` exists (nav). `grades` is in the union but not `nav.ts` (see §0). `standing`, `worked` do not exist. `lib/standing.ts` exists as a *library* | **decide** `proof` vs `grades`. `grades` is a candidate for **cut** only after the "never opened" data is read (not present in code, §5). |
| `everything`, `me`, `springboard`, `help`, search | `me` and `help` exist. `everything` does not exist. `springboard` is in the union, not `nav.ts`. `search` is dispatched 4 times and is not a `nav.ts` destination | **keep** `me` (the directory, per `role.test.ts`'s own comment). `springboard` is a **cut** candidate: in the union with no destination. **decide** `help` vs search. |
| `import`, `edit`, `update`, `announce`, `check` | `import` (8 `go`), `edit` (8), `update`, `announce` exist. `check` does not | **decide**. `import` and `edit` are the course-data pair, both heavily used. Merging them needs the owner: they are different verbs on the same record. |

**Result of §2:** of the request's named clusters, only **8** of **22** named
screens exist as destinations. No cluster can be merged on the brief's names
alone. Each **decide** row needs the owner's call before a merge, because the
request's own test is that two questions are not one screen merely because
they look alike.

## 3. Duplicated controls (settings written from more than one screen)

Non-test dispatch sites per setter:

| Setter | Sites | Files | Brief expects |
| --- | --- | --- | --- |
| `setLook` | **53** | **23** | appearance in `screens/settings/` |
| `setNav` | 6 | 6 | Navigation in `screens/settings/Nav.tsx` |
| `setDayBudget` | 5 | 4 | one place |
| `setCutoffs` | 4 | 3 | one place |
| `setTabs` | 3 | 3 | one place (`lib/tabbar.ts`) |
| `setScale` | 3 | 3 | appearance |

`setLook` is the largest real duplication found. It is written from 23 files
including `Directory.tsx`, `unity/*`, `lib/tools.ts` and `screens/settings/Look.tsx`
(16). **Verdict: merge** every writer into `screens/settings/Look.tsx`
behind one `setLook`; screens that offer their own copy become a link.
This is Step 3 of the request and does not change any destination, so it is
the next safe piece of work once the owner confirms the direction.

`setTabs` is written from 3 files and `setNav` from 6. The tab bar is chosen in
`lib/tabbar.ts` (`DEFAULT_TABS` is at `lib/tabbar.ts:60`), which the request
calls "one place". The two setters split that choice across `Nav.tsx` and
other screens. **Verdict: decide** which of the 6 `setNav` sites are tab-bar
edits (remove) and which are navigation-order edits (keep).

## 4. Duplicated UI

Re-counts are not done in this commit. `GROUPED-AUDIT.md:27` claims 74
occurrences over 31 of 58 screens. Those numbers predate the 63 registry
entries, so the count must be re-measured before it is used. Hand-rolled
headers, chip rows and empty states have no count yet. Shared components
(`ItemRow`, etc.) need the re-count first.

## 5. Things the audit could not measure

- **"Never opened" data.** The request says `everything` tracks it. No such
  screen exists and no `countScreens` exists. Cut decisions depending on usage
  are blocked until a usage source is named.
- **Pathway count per destination** (§1): needs the arrival graph.
- **Saved-state migration.** The saved tab list is read in `lib/tabbar.ts`
  (`if (!Array.isArray(saved)) return DEFAULT_TABS`, line 97). Whether it drops
  unknown screens is not verified. Whether `state/shape.ts` migrates a removed `screen` to its survivor is
  not yet tested. This must be checked before any deletion.

## 6. Decisions the owner must make before any merge

1. **Which 59?** The registry has 63 destinations. Name the 4 that are not
   destinations (or confirm 63).
2. **The named clusters.** Confirm that `weekly`, `ahead`, `tonight`, `chat`,
   `standing`, `worked`, `everything` and `check` are not expected to exist.
   If the brief means different screens by these names, supply them.
3. **`home` vs `brief` vs `mine`**: one question or two?
4. **`proof` vs `grades`**, and whether `springboard` is removed.
5. **`import` and `edit`**: merged, or kept as two verbs?

## 7. Next executable step (no owner input needed)

- Re-count hand-rolled rows (§4) with the 63-destination registry.
- Implement the `setLook` consolidation (§3) as its own commit, with a test
  that every appearance writer goes through `screens/settings/Look.tsx`.
- Add the migration test for saved `screen` values that no longer exist
  (§5), before any destination is removed.
