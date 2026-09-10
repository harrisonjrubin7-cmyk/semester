# FEATURE-INVENTORY.md

Everything that exists and works in Semester today, written before any feature
code for the Workspace suite. Counted against `app/src` on branch
`claude/new-session-xh7by4`.

**Baseline measured on this machine, 2026-09-10:**

| Measure | Value |
| --- | --- |
| Test files | 260, all passing |
| Tests | 5,212 passed, 10 skipped |
| `npm run build` | exit 0, no errors |
| JS chunks emitted | 234 |
| Total JS in `dist/assets` | 6,469,990 B (6.17 MB) |
| Entry chunk `index-*.js` | 562,445 B (174.79 kB gzip) |
| Largest chunks | `chunk-FOHPRMQF` 662 kB · `index` 562 kB · `cytoscape` 435 kB · `pdf` 431 kB · `store` 276 kB · `katex` 259 kB |

---

## 0. The headline finding — read this first

**The build prompt describes an app that no longer matches this repository.**

The prompt says current scope is *"deadlines, classes, courses and study guides
built from four Fall 2026 syllabi"*, and asks me to add Docs, Slides, Sheets and
a Drive because Semester lacks them.

Semester already has all four. They are shipped, routed, tested and exporting
real Office files:

| Prompt asks for | Already exists | Route | Since |
| --- | --- | --- | --- |
| Semester Docs | `screens/Write.tsx` — "Write a document" | `#/write` | shipped |
| Semester Sheets | `screens/Sheet.tsx` — "Sheet or table" | `#/sheet` | shipped |
| Semester Slides | `screens/Deck.tsx` — "Make a deck" | `#/deck` | shipped |
| Semester Drive | Personal → Files tab, `lib/files.ts` over IndexedDB | `#/mine` | shipped |
| IndexedDB persistence | `state/persist/db.ts`, `lib/idb.ts`, `lib/files.ts` | — | shipped |
| XLSX write | `lib/xlsx.ts` (hand-rolled OOXML, formulas preserved) | — | shipped |
| DOCX write | `lib/docx.ts` (hand-rolled OOXML) | — | shipped |
| PPTX write | `lib/pptx.ts` (hand-rolled OOXML) | — | shipped |
| Formula engine | `lib/sheet.ts`, 32 functions, A1 refs, cycle detection | — | shipped |
| 11 study-guide formats | `StudyMode` union, 11 members | `#/guide/:id?mode=` | shipped |

This does not make the prompt wrong — there are real gaps, listed in §9 — but it
changes the job from *"build four apps"* to *"finish four apps that exist."*
Section 9 of this document is the honest version of the request. The conflict is
raised formally under Rule "If a new feature seems to conflict with something
existing, **stop and ask**" and is the reason I have not written feature code.

There is a second, sharper conflict. The repo root holds `SIMPLIFY-AUDIT.md` and
`GROUPED-AUDIT.md`, and `.claude/commands/simplify.md` — a standing, repeated
effort whose stated goal is *"every thing has exactly one home and one route to
it."* Five passes have merged or deleted nine destinations, and one of the
deletions was **a `files` destination, removed as a duplicate** and folded into
Personal. Adding `#/workspace/drive`, `#/workspace/doc/:id`,
`#/workspace/sheet/:id` and `#/workspace/slides/:id` beside the existing
`#/mine`, `#/write`, `#/sheet` and `#/deck` would recreate, in one commit, every
duplicate that five passes removed.

---

## 1. Stack, build and hosting

- **React 19.2** + **TypeScript ~6.0**, **Vite 8** (`rolldown` reporter), **Vitest 5**.
- Entry `app/src/main.tsx` → `app/src/App.tsx`. No router library: routing is
  hand-written in `lib/route.ts` over `window.location.hash`.
- Static build. `base` comes from `VITE_BASE` (GitHub Pages serves from
  `/semester/`), otherwise `/`.
- Deployed by `.github/workflows` to GitHub Pages, hash-routed SPA.
- Workspace: `app/` (the client) and `packages/contract/` (shared data contract,
  aliased as `@semester/contract`).
- Dev-server-only middleware in `vite.config.ts`: ICS calendar proxy (`/feed`),
  Apple token signing, OAuth token forwarding (Microsoft/Google/Zoom), and a
  Claude proxy (`/anthropic/v1/messages`). **None of these exist in a built
  page**; production uses `supabase/functions/claude`.
- Scripts: `dev`, `build`, `lint` (oxlint + `scripts/styles.mjs` +
  `scripts/labels.mjs`), `test`, `test:zones` (runs the suite under
  `America/Chicago` and `Pacific/Kiritimati`), `counts`, `mirror`, `transcripts`.

### Dependencies actually installed

`@supabase/supabase-js`, `fflate`, `leaflet` + `@types/leaflet`, `mermaid`,
`pdfjs-dist`, `react`, `react-dom`. Dev: `oxlint`, `vitest`, `jsdom`, `jsqr`,
`qrcode-generator`, `typescript`, `vite`, `@vitejs/plugin-react`.

**There is no SheetJS, no Tiptap/Slate, no `docx`, no `mammoth`, no `pptxgenjs`,
no `jspdf`, no `html2canvas`, and no HyperFormula.** Every Office format is
written by hand as OOXML XML parts and zipped with `fflate`. The prompt's
suggested library list is therefore a list of *new* dependencies, not of things
already in the stack.

---

## 2. Routes

Hash routes, `#/screen` or `#/screen/:id`, produced and parsed by
`app/src/lib/route.ts`.

- `toHash(route)` / `fromHash(hash)` / `replaces()` / `same()`.
- **`NAMED`** — screens that carry an id, and which state field holds it:
  `course`→`courseId`, `edit`→`courseId`, `item`→`itemId`, `event`→`eventId`,
  `guide`→`guideId`, `drill`→`guideId`, `quiz`→`guideId`, `lesson`→`guideId`,
  `slides`→`guideId`, `note`→`noteId`.
- **Query string**: only `?mode=` and only on `guide`.
- **`RETIRED`** — old URLs that must keep working, each mapping to a survivor and
  optionally an `opens` hint: `weekly`→`brief{report:week}`,
  `worked`→`brief{report:term}`, `check`→`announce{changes:feed}`,
  `chat`→`ask`, `grades`→`courses{courses:grades}`, `setStorage`→`data`,
  `everything`→`me{meTab:all}`. **This table only ever grows.**
- Malformed percent-escapes fall back to the raw segment rather than throwing
  (`readId`), a fix with a written post-mortem in the file.

### The `Screen` union — 72 members

`data help onboarding home courses course item calendar event me notifs settings
import study guide quiz drill guess gap lesson mine note update connect links ask
work maps mail export yes draw solve edit analyse classmates activities brief
essay deck write sheet equations exam ahead announce costs groupwork meals
housing runway privacy registrar sources slides account clocks proof applying
tonight behind degree people meet setLook setNav setAlerts setCourses setGrading
setWorkload setAbout setAssistant`

Every one is dispatched in the `switch` in `App.tsx`.

---

## 3. The destination registry — 52 entries

`app/src/lib/nav.ts` is the single source of truth for what the app offers. Each
`Destination` carries `screen`, `label`, optional `short`, `blurb`, `keywords`,
`group`, `taskTags[]`, `root`. Seven shelves (`Group`): **Semester, Courses,
Study, Make, Campus, Life, Data**.

| Screen | Label | Shelf |
| --- | --- | --- |
| `home` | Today | Semester |
| `brief` | Reports | Semester |
| `calendar` | Calendar | Semester |
| `ahead` | The week ahead | Semester |
| `behind` | When you are behind | Semester |
| `tonight` | Tonight | Semester |
| `me` | Progress | Semester |
| `courses` | Courses | Courses |
| `degree` | The degree | Courses |
| `sources` | Sources | Courses |
| `import` | Add a course | Courses |
| `edit` | Edit the course | Courses |
| `registrar` | Term deadlines | Courses |
| `announce` | A change to a date | Courses |
| `study` | Study | Study |
| `meet` | Where courses meet | Study |
| `ask` | Ask Claude | Study |
| `update` | Add a reading | Study |
| `analyse` | Analyse data | Study |
| `solve` | Work the problem | Study |
| `exam` | Practice paper | Study |
| `runway` | Exam runway | Study |
| `work` | Work on it | Make |
| `draw` | Draw it | Make |
| `deck` | Make a deck | Make |
| `write` | Write a document | Make |
| `sheet` | Sheet or table | Make |
| `equations` | Equations | Make |
| `essay` | Draft it | Make |
| `proof` | Check the writing | Make |
| `groupwork` | Group work | Campus |
| `meals` | Meal plan | Campus |
| `housing` | Housing | Campus |
| `maps` | Getting there | Campus |
| `yes` | Registration | Campus |
| `classmates` | Classmates | Campus |
| `activities` | Activities | Campus |
| `costs` | What this term cost | Life |
| `mail` | Email | Life |
| `people` | People and letters | Life |
| `applying` | Applications | Life |
| `clocks` | Timers and alarms | Life |
| `mine` | Personal | Life |
| `links` | Links | Life |
| `account` | Account | Data |
| `connect` | Connect accounts | Data |
| `data` | Your data and how it is running | Data |
| `privacy` | Privacy and your rights | Data |
| `export` | Take it with you | Data |
| `settings` | Settings | Data |
| `notifs` | Alerts | Data |
| `help` | How this works | Data |

Membership is further gated per school by `Capabilities` (`lib/school.ts`), so a
university that does not offer a thing does not show its tile.

---

## 4. Navigation surfaces

Four selectable navigation modes (`NavMode`): `tabs`, `feed`, `springboard`,
`shelves` — chosen in Settings → Navigation.

- **Tab bar** — `lib/tabbar.ts`. `DEFAULT_TABS = ['home','courses','study','calendar','me']`,
  user-reorderable, with a floor of `FEWEST_CHOSEN` before it reverts to default.
- **Launcher / app grid** — `lib/apps.ts` + `lib/launcher.ts` + `components/nav/`
  (`AllApps`, `AppGrid`, `ByTask`, `Folder`, `Launcher`, `ShelfNav`, `TileSheet`).
  Shelves in `GROUPS` order, tiles reorderable and saved as `groupOrder`.
- **Springboard** — `lib/springboard.ts`, dock stored under the `dock` look key.
- **Command palette / universal search** — `components/Command.tsx` + `lib/find.ts`,
  an overlay rather than a screen. Searches destinations by label, blurb and
  keywords, plus live records.
- **By task** — `taskTags` on each destination drive the "what are you trying to
  do" view.
- **Recents / lastOpened** — `state.recent`, `state.lastOpened`, `state.visited`.
- **Shell chrome** — `components/shell/` (`Rows`, `ShellBody`, `useShell`,
  `exempt.ts`), plus `components/soft/` for the soft top bar.

---

## 5. State, persistence and storage keys

### The store

`app/src/state/store.tsx` — React context + `useReducer`. Reducer at
`state/reducer.ts`, split into slices: `library`, `made`, `mine`, `navigate`,
`notes`, `papers`, `schedule`, `settings`, `study`. Shape and migrations in
`state/shape.ts` (1,679 lines), which owns `schemaVersion`.

### Persistence

`state/persist/index.ts` writes through to **IndexedDB** (`state/persist/db.ts`),
falling back to **localStorage** when IndexedDB is unavailable, slow to open
(10s limit), or refused (private windows).

- IndexedDB `semester-store` v1 — stores `maps`, `settings`, plus one store per
  persisted collection.
- IndexedDB `semester-files` v1, store `files` — attachments (`lib/files.ts`).
- IndexedDB for snapshots — `lib/snapshots.ts`, a separate database on purpose.
- `lib/idb.ts` — the shared one-store wrapper plus `newId()`.

### localStorage keys — every one must survive untouched

| Key | Owner |
| --- | --- |
| `semester.v1` | the account (`state/shape.ts`, `lib/keep.ts`) |
| `semester.synced` | last sync marker |
| `semester.threads.v1` | assistant threads |
| `semester.threads.archive.v1` | archived threads |
| `semester.ask.v1` | Ask transcript (`lib/chatlog.ts`) |
| `semester.claude.v1` | assistant settings |
| `semester.sitting.v1` | the current study sitting |
| `semester.tokens.v1` | connected-account tokens |
| `semester.oauth.pending` | in-flight OAuth |
| `semester.spend.v1` | spend log |
| `semester.gappace` | pace samples |
| `semester.push.filled` | push refill marker |
| `semester.log` | diagnostics log |
| `semester.notified` | notification ids seen |
| `semester.seen` | last-seen timestamp |
| `semester.folds` | fold/collapse state |
| `semester.drafts` | drafts |
| `semester.usage` | screen usage counts |
| `semester.aloud` | read-aloud toggle |
| `semester.ai.corner` | assistant dock corner |
| `dock` | springboard dock (look key) |

### Top-level state — selected fields

`nav`, `reviews`, `grades`, `gradeSystems`, `mySchools`, `pretested`, `wanted`,
`archivedTerms`, `lastSync`, `places`, `commitments`, `timers`, `alarms`,
`applications`, `progress`, `returned`, `regradeWindows`, `geocode`,
`requirements`, `taken`, `scale`, `people`, `visits`, `letters`, `answers`,
`floor`, `rest`, `contract`, `feedOrder`, `feedHidden`, `tabs`, `yours`,
`myRules`, `myName`, `attendance`, `attendPolicy`, `pieces`, `drops`,
`examCovers`, `dayBudget`, `courseOrder`, `recent`, `visited`, `lastOpened`,
`sittings`, `sources`, **`documents`**, **`sheets`**, **`equations`**,
`registrar`, `spent`, `windows`, `costs`, `balances`, `residences`,
`accessLeadDays`, `tickedAt`, `tasks`, `appointments`, `notes`, `updates`,
`feeds`, `feedEvents`, `courses`, `term`, `linkUrls`, `extraLinks`, `undone`,
plus look keys (`accent`, `textSize`, `ground`, `density`, `corners`,
`typeface`, `bodyface`, `lineHeight`, `readingWidth`, `iconShape`, `labels`,
`tone`, `badges`, `feed`, `courseColours`, `shell`, `directory`, `groupOrder`,
`boardOrder`, `hue`) and routing fields (`screen`, `history`, `courseId`,
`itemId`, `eventId`, `guideId`, `mode`, `filter`, tab selections).

`documents`, `sheets` and `equations` are **three lists, deliberately not one
bag of files** — the comment in `shape.ts` states the reasoning and that they
merge as unions and are never shed by `lib/keep.ts`.

---

## 6. The four Workspace-adjacent features that already exist

### 6.1 Write a document — `#/write`, `screens/Write.tsx`, `lib/document.ts`

- Model `Doc { id, title, subtitle, courseId, blocks[], created, updated }`.
- `Block` kinds: `heading` (levels 1–3), `text`, `bullets` (numbered or not),
  `quote` (**with a required `source` — the app never quotes blind**), `table`
  (rows, header flag, caption), `equation` (LaTeX + caption), `break`.
- Inline runs (`runs()`, `unmarked()`), word count (`words()`), summary line,
  `hasContent()`.
- Markdown out (`toMarkdown`) **and in** (`fromMarkdown`).
- `.docx` out via `lib/docx.ts` (`parts()` → OOXML, zipped by `lib/deliver.ts`).
- Print view via `components/PrintButton.tsx`.
- Course tagging via `components/CoursePicker.tsx`; equations via
  `components/Equation.tsx`; tables share `lib/sheet.ts`'s `filled()`.
- Reducer actions: `newDocument`, `makeDocument`, `openDocument`,
  `closeDocument`, `updateDocument`, `deleteDocument`, `editBlock`.

### 6.2 Sheet or table — `#/sheet`, `screens/Sheet.tsx`, `lib/sheet.ts`

- Model `Sheet { id, title, courseId, cells: Record<A1,string>, rows, cols, created, updated }`.
- New sheets open at 12×6; ceiling `MAX_ROWS = 200`, `MAX_COLS = 26`.
- A1 addressing: `colName`, `colIndex`, `ref`, `parseRef`, `expand` (ranges).
- **32 formula functions**: `IF SUMPRODUCT AND OR NOT COUNTA CONCAT LEN UPPER
  LOWER TRIM SUM PRODUCT COUNT AVERAGE AVG MEDIAN MIN MAX STDEV STDEVP VAR VARP
  ABS INT SQRT EXP LN LOG10 POWER MOD ROUND`.
- Five real errors said in the cell rather than swallowed: `#DIV/0!`, `#REF!`,
  `#NAME?`, `#VALUE!`, `#CYCLE!`. Cycle detection via a `seen` set.
- `weighted(scores, weights)` — the syllabus-weighted gradebook helper.
- Out: **`.xlsx` with the formulas still in it** (`lib/xlsx.ts`), `.csv`
  (`toCsv`), and a Markdown table for a document (`toMarkdown`).
- In: `readTable()` parses pasted TSV/CSV.
- Reducer actions: `newSheet`, `makeSheet`, `openSheet`, `closeSheet`,
  `updateSheet`, `deleteSheet`.

### 6.3 Make a deck — `#/deck`, `screens/Deck.tsx`, `lib/deck.ts`, `lib/pptx.ts`

- Builds a real `.pptx`. `fromUnit(guide, index)` drafts a deck **from a study
  guide unit**; `fromTable()` from a grid; `readPlan()`/`toDeck()` from a brief.
- `slidesFor(minutes, kind)` sizes a deck to a talk; `holes(plan)` names what the
  student still has to supply; `speakerNotes()` writes the notes.
- Figures become slides (`figureSlide`).

### 6.4 Personal → Files — `#/mine`, `screens/Mine.tsx`, `lib/files.ts`

- Tabs: `tasks` | `appointments` | `notes` | `files`.
- `StoredFile { id, name, type, size, added, courseId, blob }`, `FileMeta` is the
  same without the blob.
- `addFile`, `listFiles`, `getFile`, `deleteFile`, `clearFiles`, `totalSize`,
  `formatBytes`, `openFile` (object URL, revoked after 60s).
- Files attach to notes (`attachFile` action, `note.fileIds`).
- Everything stays on the device; nothing is uploaded.

### 6.5 Slide deck (study) — `#/slides/:guideId`, `screens/Slides.tsx`

A *different thing from `#/deck`*: this is one of the 11 study modes, showing a
guide unit as question-then-answer slides with arrow-key and tap navigation. It
makes no file.

---

## 7. Everything else, by area

**Courses & syllabi** — `courses`, `course`, `item`, `edit`, `import`, `sources`,
`registrar`, `announce`, `degree`. Four seeded Fall 2026 courses in
`data/courses/{bus,core,econ,psci}/` each with `index.ts` (syllabus, deadlines,
meeting pattern), `guide.ts` (study guide) and `lessons.ts`. Catalog built by
`data/catalog.ts`. Course adding/editing via `lib/intake.ts`, `lib/parse.ts`,
`lib/extract.ts`, PDF reading via `pdfjs-dist`.

**Deadlines & calendar** — `calendar` (day/week/month/semester views, sources
all/classes/deadlines/campus), `event`, `home` (today/hours/week/done tabs),
`ahead`, `behind`, `tonight`, `brief` (day/week/term grains). ICS import and
export (`lib/ics.ts`, `lib/export.ts`), subscribed feeds (`lib/feed.ts`,
`lib/calsource.ts`), clash detection (`lib/clash.ts`), drag-to-move
(`screens/calendar/Move.tsx`, `AddHere.tsx`).

**Study** — `study`, `guide` with 11 modes (`cards read field watch slides doc
quiz figures cases cram listen`), `drill`, `quiz`, `guess`, `lesson`, `gap`,
`runway`, `exam`, `solve`, `analyse`, `meet`, `update`. Spaced review
(`lib/review.ts`), figures (`lib/figure.ts`, `components/FigureCard.tsx`),
diagrams (mermaid + cytoscape), equations (KaTeX), audio lessons under
`public/audio/lessons/{bus,core,econ,psci}/`.

**Grades** — `grades` map, `gradeSystems`, `lib/grades.ts`, `lib/score.ts`,
`lib/termgpa.ts`, `lib/standing.ts`, `lib/worth.ts`, `lib/cutoffs.ts`,
`lib/unearned.ts`. Courses screen carries the grade table (the retired
`#/grades` route lands there).

**Assistant** — `#/ask`, `src/ai/` (`Assistant`, `Chat`, `Composer`, `Threads`,
`Turns`, `Answer`, `Actions`, `Opening`, `AskAbout`), providers in
`ai/providers/` (`campus`, `core`, `make`, `personal`, `semester`, `study`,
`upkeep`, `yours`). Streaming via the dev proxy or the Supabase Edge Function.
Tool calls in `lib/tools.ts` with undo (`lib/tools.undo.test.ts`).

**Campus & life** — `maps` (leaflet), `meals`, `housing`, `classmates`,
`activities`, `groupwork`, `yes` (registration), `people`, `applying`, `costs`,
`clocks`, `links`, `mail`.

**Data & account** — `account` (Supabase), `connect` (Microsoft/Google/Zoom/Apple
OAuth), `data` (record counts, byte weights, quota via `lib/quota.ts`),
`privacy`, `export` (backup/restore, snapshots), `settings` with eight sub-screens
(`setLook setNav setAlerts setCourses setGrading setWorkload setAbout
setAssistant`).

**Offline** — `public/sw.js` service worker, `public/manifest.webmanifest`,
`lib/offline.ts`. The app is installable and works offline today.

---

## 8. Design system — what any new screen must reuse

`app/src/styles/app.css` defines **58 CSS custom properties** on `:root`. New UI
must use these and add no second design language.

- **Ground**: `--app-void #040507`, `--app-bg #090a0e`, `--app-panel #12141a`,
  `--app-hero #191c23`, `--app-raise #22262f`.
- **Ink**: `--app-fg #eceef2`, `--app-dim` 64%, `--app-faint` 42%.
- **Accent**: `--app-accent #d4d9e2`, `-bright`, `-deep`, `-wash`.
- **Warn**: `--app-warn #9d4d34`, `-line`, `-wash`.
- **Lines**: `--app-line`, `--app-line-top`, `--app-line-soft`, `--app-track`.
- **Radii**: `--r-sm 3px`, `--r-md 6px`, `--r-lg 10px`.
- **Type scale** (all multiplied by `--text-scale`): `--type-xs 11` `--type-sm 12`
  `--type-base 13` `--type-md 14` `--type-lg 15` `--type-xl 26`.
- **Spacing** (all multiplied by `--density`): `--sp-1 2` … `--sp-7 16`.
- **Leading**: `--leading-tight 1.3`, `--leading-normal 1.45`, `--leading-relaxed 1.5`.
- **Lift**: `--lift-1/2/3`. **Motion**: `--ease`, `--fast 130ms`.
- **Chrome**: `--chrome`, `--chrome-edge`, `--chrome-ink`, `--chrome-glint`.
- **Fonts**: `--font-display` Cinzel / Barlow Condensed; Barlow 400/500/700 and
  Barlow Condensed 400/600 self-hosted as woff2 in `styles/fonts/`.

Shared primitives in `components/ui.tsx`: `SectionLabel`, `ChipRow`,
`PickChips`, `Segmented`, `Toggle`, `TickBox`, `Meter`, `EmptyState`,
`ActionButton` (`HEIGHT = 46`), `FilePick`. Page frame: `components/Page.tsx`,
`components/Blueprint.tsx`, `components/Fold.tsx`, `components/ScrollArea.tsx`.

`npm run lint` runs `scripts/styles.mjs`, which **enforces token use** — raw hex
and off-scale spacing fail the lint. `scripts/labels.mjs` enforces accessible
labels.

Accessibility is already tested: `src/a11y/` holds `labels`, `landmarks`,
`modal`, `motion`, `title`, `type`, `dragging` and `tellings` tests.

---

## 9. What the prompt asks for that genuinely does **not** exist

This is the real gap list — the honest version of §2 of the build prompt.

**Drive**
- No folders or nested subfolders. Files are a flat list tagged by `courseId`.
- No drag-and-drop to move, no grid/list toggle, no sort by type or course.
- No auto-created folder per course.
- No search across file *contents*.
- No star/favourite, no recents view, **no trash and no restore** (delete is
  immediate and final).
- No link between a file and an *assignment* — only to a course and to notes.
- Quota exists (`lib/quota.ts`) but is on the Data screen, not over the files.

**Docs**
- No rich-text editing surface. The editor is block-structured, not WYSIWYG: no
  bold/italic toolbar, font family/size, text or highlight colour.
- No checkbox lists, no indent/outdent, no horizontal rules, no code blocks.
- No images in documents at all.
- No links, alignment, line spacing or margin controls.
- No find-and-replace, no outline sidebar, no comments/margin notes.
- **No version history and no restore.** No autosave indicator.
- No PDF export, no DOCX *import* (Markdown import exists), no plain-text export.
- No templates (essay/MLA/APA, lab report, reading response, etc.).
- No "Open in Docs" from a study guide.

**Sheets**
- **Single grid per file — no tabs, so no cross-sheet `Sheet2!A1` references.**
- Missing functions the prompt names: `IFS IFERROR VLOOKUP HLOOKUP XLOOKUP INDEX
  MATCH LEFT RIGHT MID TEXT SPLIT TODAY NOW DATE DATEDIF WEEKDAY EOMONTH MODE
  CORREL COUNTIF SUMIF COUNTIFS SUMIFS AVERAGEIF NPV IRR PMT FV PV RATE`.
- ~~No absolute references (`$A$1`)~~ — **wrong as written, and correcting it
  found a bug.** `parseRef` has always accepted `$A$1`, `$A1` and `A$1`, and a
  range end was rebuilt through `ref()` so `SUM($A$1:$B$2)` was right. But a
  *lone* reference was looked up as the raw string, so `cells['$A$1']` missed
  and `=$A$1*2` came back **0** where the cell held 5 — silently, as a number
  rather than a `#REF!`. Fixed on this branch; addresses are normalised before
  lookup. What is still genuinely absent is any *effect* of pinning: there is
  no fill handle, so nothing moves a reference and nothing needs holding still.
- No named ranges.
- No fill handle — so a formula filled down in Excel arrives as the values it
  last had, not as a live formula. The import says so rather than leaving it to
  be found in a total that stopped moving.
- No fill handle, no paste-special, no undo/redo inside the grid.
- No cell formatting at all: number/currency/percent/date formats, bold, fill,
  borders, alignment, wrap, merge.
- No sort, no filter, no freeze panes.
- No conditional formatting, no data validation or dropdowns.
- **No charts and no pivot tables.**
- ~~**No XLSX or CSV import** (export only)~~ — **wrong as written.** CSV and
  TSV could always be *pasted* in: "Paste a table in" runs `readTable()` and
  dispatches `makeSheet`. What was missing was importing a **file** — and
  `.xlsx` in any form. Both are on this branch now (`lib/xlsxin.ts`): a picked
  `.xlsx` or `.csv` comes in with its formulas live, its dates read as dates,
  and every worksheet as its own sheet.
- No auto-generated grade calculator per course, no GPA planner template.

**Slides**
- No canvas editor. `#/deck` generates a deck and exports it; you cannot lay out
  a slide, move a text box, or place a shape.
- No layouts picker, no themes/palettes, no transitions or animations.
- No images, tables or charts placed on slides.
- No presenter mode, no per-slide reorder/hide UI.
- No PDF or PNG export, no PPTX import.
- No templates.

**Cross-app**
- No single "＋ New" button offering Folder/Document/Presentation/Spreadsheet/Upload.
- No paste-a-range-into-Docs-as-a-table.
- Universal search does not return documents, sheets or files.
- No assignment-attachment flow for any of these.

> **Two entries above were wrong when this was written**, and are struck
> through rather than deleted so the correction is visible. Both were found by
> a review comment on the pull request. The second was only a documentation
> error; the first was a documentation error hiding a real one.

**Also true and worth stating plainly:** several prompt requirements are large
new dependencies (a rich-text engine, a chart library, XLSX/PPTX/DOCX *readers*,
`jspdf` + `html2canvas`), and the prompt's own §4 says *"do not add a second
[charting library]"* — the app currently charts with none, so that constraint
resolves to "pick one and use it everywhere."

---

## 10. Things that will bite any change here

1. **`lib/route.ts`'s `RETIRED` table is a promise.** Never remove a row.
2. **Storage keys in §5 are frozen.** A rename silently orphans a real account.
3. **`schemaVersion` migrations** in `state/shape.ts` must be forward-only and
   preserve unknown fields; `list()`/`readList()` guard every collection.
4. **`documents`/`sheets`/`equations` merge as unions and are never shed by
   `lib/keep.ts`.** A "unified file model" that folds them into one list changes
   both the merge behaviour and the retention guarantee.
5. **`npm run lint` fails on raw hex and off-scale spacing.** Use the tokens.
6. **`npm run test:zones`** runs the suite in two timezones; date code must pass both.
7. **`scripts/labels.mjs`** fails on unlabelled controls.
8. The dev server's proxies do **not** exist in a built page — nothing new may
   depend on them at runtime.
9. `state/persist/db.ts` fails soft by design (10s open limit, null on failure,
   localStorage fallback). New IndexedDB use must fail the same way.
10. **Five simplification passes** have been run to remove duplicate screens.
    `SIMPLIFY-AUDIT.md` is the record. New duplicate routes will be audited out.
