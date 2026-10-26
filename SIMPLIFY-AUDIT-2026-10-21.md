# Simplify audit — "make the app one app" (21 October 2026)

**Why a new file:** `SIMPLIFY-AUDIT.md` already exists at the repo root (367 KB, from an earlier audit). It is left untouched. This file holds the measured audit for this pass.

**Measured at** `claude/affectionate-cori-y8ckxw` (based on `origin/main` `162cd31d`), by reading `app/src`. No code changed.

**Status: Step 1 partly done.** Rows marked **not counted** were not measured here and must be counted before any merge is decided. No merge (Steps 2–4) has been made.

## 1. Destination count

| Measure | Count | How |
| --- | ---: | --- |
| Rows in `DESTINATIONS` (`app/src/lib/nav.ts`, lines 202–1012) | 63 | `^    screen: '…'` in that range |
| Plus `COMMUNITY_DESTINATION`, pushed at runtime (`nav.ts` 1013–1026) | 1 | line 1026 |
| Unique destination screens | 64 | union of the two |

The request says 59. The measured figure is 64. Nothing has been removed.

## 2. Overlap clusters from the request — confirmed or cleared

Grep of `screen: '…'` in `nav.ts`, `'…'` in `App.tsx` and `lib/types.ts`, and the source files that name each id.

| Named in request | Found as a destination? | Verdict |
| --- | --- | --- |
| `home` (Today) | Yes, `nav.ts:204` | Candidate survivor (`DEFAULT_TABS`) |
| `brief` (Your day) | Yes, `nav.ts:242` | **Candidate overlap with `home`** — not yet read |
| `weekly` (Weekly report) | **No.** Not in `nav.ts` rows, `App.tsx` or the Screen union. Only in `lib/student-operating.ts`, `lib/dining/*`, `lib/calm-controls.ts` | **Cleared** — not a screen |
| `ahead` (The week ahead) | **No.** A term in `lib/standing.ts`, `lib/registrar.ts`, `screens/Degree.tsx` | **Cleared** as a screen; the concept lives in `Degree` |
| `tonight` | **No.** Only `lib/capture.ts` | **Cleared** — not a screen |
| `mine` | Yes, `nav.ts:812` | Candidate overlap with `home` / `brief` — not yet read |
| `calendar` day/week/month/semester | One destination, `nav.ts:282` | **Grain count not verified.** No separate grain screens found in this pass |
| `ask`, `chat`, assistant sheet | `ask` yes, `nav.ts:312`. `chat` **no** (only `screens/call/Stage.tsx`, `components/room/Talk.tsx`). Assistant is `ai/Assistant.tsx` | **Partly cleared.** Two surfaces, not three. `/ask-tab` owns the fix |
| `grades`, `standing`, `worked`, `proof` | `proof` yes, `nav.ts:792`. `worked` is a type member only (`lib/casework.ts`, `screens/Guide.tsx`). `grades` is a type member. `standing` is not a screen | **Mostly cleared.** Only `proof` is a destination |
| `everything` | **No** as a destination (`lib/sheetedit.ts`, `screens/Sheet.tsx`) | **Cleared as a destination** — its "never opened" tracking still to check |
| `me` | Yes, `nav.ts:828` | Directory-like; keep |
| `springboard` | Type member and `App.tsx:719` `case` | Real route; overlap with `me` / directory **not yet read** |
| `help` | Yes, `nav.ts:993` | Keep |
| search | `search` is a Screen member (`lib/types.ts`) | Keep (index) |
| `import`, `edit`, `update`, `announce` | Yes: `nav.ts:474, 488, 345, 508` | **Not yet read.** Candidate cluster |
| `check` | **No** as a destination (`lib/solve.ts`, `lib/workflow/templates.ts`, `components/LearningMap.tsx`) | **Cleared** — not a screen |

**Net:** of the names in the request, 10 are not destinations (`weekly`, `ahead`, `tonight`, `chat`, `standing`, `everything`, `check`, `grades`, `worked`, and `springboard` as a destination). The "six screens over what is due" premise reduces to `home`, `brief`, `mine`, with `calendar` alongside. The real overlaps are in the `nav.ts` rows, not in the names listed.

## 3. Route count per destination

- `type: 'go'` dispatch sites (app-wide, non-test): **247** (`grep -rn "type: 'go'"`).
- `openCourse`, `openItem`, `openEvent`, `openGuide`, `openLesson` call sites: **0**. The helpers that exist: `openFile` (9), `openCal` (5), `openSteps` (4), `openMine` (4), `openFor` (4), `openAt` (4), others fewer.
- **Not counted:** the per-destination arrival table. It needs an AST pass over `go` payloads.

## 4. Duplicated controls (settings)

- `app/src/state/slices/settings.ts` exports 22 `set…` actions: `setAboutMe, setAccessLead, setAthlete, setAttendPolicy, setControls, setCourseOrder, setCutoffs, setDayBudget, setDrop, setExamCovers, setFeedOrder, setGeocode, setGrade, setLook, setMyName, setMyRules, setNav, setPieces, setPronounce, setQuiet, setRole, setSchool, setTabs, setWanted, setYours`.
- **Not counted:** writers per action. A plain `setX(` grep finds zero call sites because actions are dispatched through an object, so the count needs the store's dispatch form.
- `screens/settings/` has 10 files: `About, Alerts, Assistant, Courses, Grading, Index, Look, Nav, Page, Workload`.
- Look/appearance controls also appear outside settings in `components/Appearance.tsx`, `components/JourneyKit.tsx`, `components/nav/ShelfNav.tsx`. **Whether these duplicate `screens/settings/Look.tsx` or link to it is not yet read.**
- `DEFAULT_TABS` (`lib/tabbar.ts:60`) is `home, calendar, study, support, me` — five.

## 5. Duplicated UI

- The 74 hand-rolled list rows across 31 screens (from `GROUPED-AUDIT.md`) were **not re-counted**. Headers, chip rows and empty states were **not counted**.

## 6. What blocks the "done" definition

- `npm test` is **not green on the base branch**: `src/ai/dock.test.ts` ("delete buttons in Mine") fails on `origin/main` as well (verified in a clean worktree). A merge pass cannot claim `npm test` green until that is resolved or accepted as known.
- The request's "59 screens" differs from the measured 64. The target number needs confirming.

## 7. Decisions needed before merges

1. Whether the names that are not screens (`weekly`, `ahead`, `tonight`, `chat`, `standing`, `everything`, `check`) should drop from the audit list, or name *views* the merged survivors must still offer.
2. The survivor for the `home` / `brief` / `mine` cluster. The request says the survivor is the one a student already opens, measured by `countScreens`. `countScreens` is a settings key (`lib/carried.ts`, `lib/export.ts`); no counter data was read.
3. Whether `SIMPLIFY-AUDIT.md` (the existing 367 KB file) is the document the request means to update, or a separate file is wanted, as created here.
