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
- Workspace: `app/` (the client), `packages/contract/` (shared data contract,
  aliased as `@semester/contract`), `packages/institution/` (the university
  gateway contract, aliased as `@semester/institution`) and
  `app/server/institution/` (the gateway itself — a Node service, not part of
  the built page and not touched by `npm run build`).
- Dev-server-only middleware in `vite.config.ts`: ICS calendar proxy (`/feed`),
  Apple token signing, OAuth token forwarding (Microsoft/Google/Zoom), and a
  Claude proxy (`/anthropic/v1/messages`). **None of these exist in a built
  page**; production uses `supabase/functions/claude`.
- Scripts: `dev`, `build`, `lint` (oxlint + `scripts/styles.mjs` +
  `scripts/labels.mjs`), `test`, `test:zones` (runs the suite under
  `America/Chicago` and `Pacific/Kiritimati`), `counts`, `mirror`,
  `transcripts`, `check:university` (typechecks the gateway under NodeNext —
  separate from `build`, which never sees `server/`) and `dev:university`
  (runs it, reading `server/institution/.env`).

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

Five selectable navigation modes (`NavMode`): `workspace`, `tabs`, `feed`,
`springboard`, `shelves` — chosen in Settings → Layout and navigation.
`workspace` is the app's layout: it is the default, and `migrate` step 4
(`SCHEMA = 4`) moves every existing account onto it once. Once, so a reader
who goes back to another navigation keeps it. `navOf` falls back to it too,
so a stored value that cannot be read lands on the default rather than on a
navigation the app no longer opens as.

- **Tab bar** — `lib/tabbar.ts`. `DEFAULT_TABS = ['home','courses','study','calendar','me']`,
  user-reorderable, with a floor of `FEWEST_CHOSEN` before it reverts to default.
- **Launcher / app grid** — `lib/apps.ts` + `lib/launcher.ts` + `components/nav/`
  (`AllApps`, `AppGrid`, `ByTask`, `Folder`, `Launcher`, `ShelfNav`, `TileSheet`).
  Shelves in `GROUPS` order, tiles reorderable and saved as `groupOrder`.
- **Springboard** — `lib/springboard.ts`, dock stored under the `dock` look key.
- **Workspace** — `lib/desk.ts` + `components/desk/` (`TopBar`, `Sidebar`,
  `AppsPanel`, `Customize`, `suggesting`) + `screens/Search.tsx` and
  `screens/Directory.tsx`. Chrome at the top of the window rather than beside
  the screen: the tab strip drawn from the first tab, one search bar under it
  on every screen, the nine-dot launcher as a panel, and — above the desktop
  breakpoint — a sidebar of All apps, Search home, your shortcuts,
  Connect accounts and Settings. The app lands on `search` (`firstScreen` in
  `lib/chrome.ts`) rather than on `home`, which is still Today. Shortcuts are
  the `favourites` look key and the row is switched by `shortcuts`; both are
  resolved against the registry and the school gate on every read, so a stale
  or synced list can arrange the row and never put a dead tile in it. The bar
  searches apps (label, short name, blurb, keywords, category, and the
  school's own words) and hands anything else to the existing palette. The
  centre of the search home is `hidden` — out of the tab order and the
  accessibility tree — whenever the suggestions, the launcher, Customize, the
  palette or the capture box is open (`centreHidden`).
- **The app's browser — tabs and universal search** — `components/Command.tsx` +
  `lib/find.ts` + `lib/browser.ts` + `lib/typeahead.ts`, an overlay rather than a
  screen. A strip of tabs across the top, each holding a place in the app (the
  page a tab shows is the app itself); a new tab is the search page — wordmark,
  one box, and shortcuts ordered by `state.recent`. The box offers your recent
  searches and completions drawn from what can actually be found; Enter turns
  the page into results, with chips that narrow them to one kind and a
  per-result "open in a new tab". Searches destinations by label, blurb and
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
| `favourites` | workspace shortcuts, screen ids (look key) |
| `shortcuts` | whether the search home draws the shortcut row (look key) |

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
  `checks` (text + ticked, per item), `quote` (**with a required `source` — the
  app never quotes blind**), `table` (rows, header flag, caption), `image`
  (a drive file id + name, alt text and caption), `equation` (LaTeX +
  caption), `code` (text + language, and the one kind whose text is not marked
  up), `toc`, `rule` (a divider) and `break` (a page break). The last two are
  distinct kinds, one line apart on the Insert bar and no longer sharing a
  markdown spelling. `bullets` holds `(string | Line)[]`, a `Line` being
  `{ text, level }` — see the indent entry below for why the union is the
  stored type rather than a migration.
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

- Model `Sheet { id, title, courseId, cells: Record<A1,string>,
  styles?: Record<A1,CellStyle>, rows, cols, created, updated, opened? }`.
- `CellStyle { num?, decimals?, bold?, italic?, strike?, under?, align?, ink?,
  wash?, edge?, size? }` — the picture over a cell, stored apart from the cell
  so formatting never rewrites the value a formula reads. `picture()`,
  `styledDisplay()`, `restyle()`. `ink`/`wash` name one of six colours rather
  than holding a hex, and each surface picks its own: `inkOn`/`washOn` for the
  app's dark panel, `inkPaper`/`washPaper` for Excel's white page. `edge` is
  any of `t`, `b`, `l`, `r`, so one cell can be two sides of an outline.
- Selection in `lib/grid.ts` (`Range` as two corners; `box`, `cells`, `label`,
  `step`, `summarise`) — the name box, the status line's sum/average/count/
  min/max, shift-click and shift-arrow, and column and row headers that select.
- Editor undo/redo in `lib/history.ts` — coalesced by cell so a run of typing
  is one step. Distinct from `lib/undo.ts`, which is the app's one-step toast.
- **The ribbon** — `lib/ribbon.ts` holds it as a value (tabs, named groups,
  four kinds of control) with the same rules the menu bar has: a control with
  no handler is dead rather than drawn live, ids are unique, the tab order is
  fixed (`TABS = home insert formulas data view`). `components/Ribbon.tsx`
  draws it, along with the formula bar, the sheet tab strip and the status bar.
  There is no File tab: the app's one menu bar already owns the file.
- **Editing the shape of a sheet** — `lib/sheetedit.ts`, all of it pure:
  `insertRows`/`deleteRows`/`insertCols`/`deleteCols` (the grid moves under the
  formulas), `fill` down and right (the formulas move with them), `sortRange`
  and `sortable`, `find`/`replaceAll` over what was typed, `copy`/`clear`/
  `paste` with `clipText`/`readClip` for the system clipboard, and `autoSum`.
  Under all of it: `rewrite`, `translate` (a formula moved — `$` holds a row or
  a column still) and `shift` (the grid moved — a deletion *shrinks* a range it
  reached into and only breaks one it took entirely).
- Templates in `lib/sheettemplates.ts` — to-do list, monthly budget, term
  budget, reading tracker, lab readings, each with its formulas already in it.
- New sheets open at 12×6; ceiling `MAX_ROWS = 200`, `MAX_COLS = 26`.
- A1 addressing: `colName`, `colIndex`, `ref`, `parseRef`, `expand` (ranges).
- **63 formula functions** (the figure here said 32 and had not been counted
  since; the lookups, the dates, the conditionals and the finance were all
  added after it): `IF IFS IFERROR AND OR NOT SUMPRODUCT COUNTA CONCAT LEN
  LEFT RIGHT MID SPLIT TEXT TRIM UPPER LOWER VLOOKUP HLOOKUP XLOOKUP INDEX
  MATCH TODAY NOW DATE DATEDIF WEEKDAY EOMONTH COUNTIF SUMIF AVERAGEIF
  COUNTIFS SUMIFS SUM PRODUCT COUNT AVERAGE AVG MEDIAN MODE MIN MAX STDEV
  STDEVP VAR VARP CORREL ABS INT SQRT EXP LN LOG10 POWER MOD ROUND NPV IRR
  PMT FV PV RATE`.
- Seven real errors said in the cell rather than swallowed: `#DIV/0!`, `#REF!`,
  `#NAME?`, `#VALUE!`, `#CYCLE!`, `#N/A`, `#DEEP!`. Cycle detection via a
  `seen` set. An error written *into* a formula — which is what a deleted
  reference leaves behind — is read back as that error rather than degraded to
  `#VALUE!`.
- `weighted(scores, weights)` — the syllabus-weighted gradebook helper.
- Out: **`.xlsx` with the formulas and the formats still in it**
  (`lib/xlsx.ts`; `styleTable()` builds `cellXfs`, `fonts`, `fills` and
  `borders` from the distinct `Look`s the book uses — fills start at index 2,
  because 0 and 1 are reserved and a workbook pointing at 1 opens striped),
  `.csv` (`toCsv`), and a Markdown table for a document (`toMarkdown`).
- In: `readTable()` parses pasted TSV/CSV.
- Reducer actions: `newSheet`, `makeSheet`, `openSheet`, `closeSheet`,
  `updateSheet`, `deleteSheet`.

### 6.3 Make a deck — `#/deck`, `screens/Deck.tsx`, `lib/deck.ts`, `lib/pptx.ts`

- Builds a real `.pptx`. `fromUnit(guide, index)` drafts a deck **from a study
  guide unit**; `fromTable()` from a grid; `readPlan()`/`toDeck()` from a brief.
- `slidesFor(minutes, kind)` sizes a deck to a talk; `holes(plan)` names what the
  student still has to supply; `speakerNotes()` writes the notes.
- Figures become slides (`figureSlide`).
- Editing — `screens/deck/Edit.tsx` and `screens/deck/Canvas.tsx`. The slide is
  drawn at 16:9 in the deck's colours and typed into in place; `Canvas`,
  `Still` and `Thumb` are one renderer used by the editor, the presenter and
  the rail, so the three cannot drift from each other or from `slideXml`.
- Layouts: `LAYOUTS`, `blankSlide`, `layoutOf` (read off the slide, not stored
  beside it), `relayout` (title and speaker notes always survive) and
  `losesSomething` (names what a change would throw away, before it does).
- Themes: `THEMES`/`themeOf` in `lib/decks.ts` — Ink, Slate, Paper, Sand, each
  a `Palette { ink, paper, dim }` threaded through `lib/pptx.ts`, so the
  exported file opens in the colours chosen here. Contrast-audited in
  `lib/decktheme.test.ts`.
- Reorder, duplicate, hide (`hidden[]`, skipped when presenting and left out of
  the file) and a presenter view with notes, the next slide and a clock.

### 6.4 Personal → Files — `#/mine`, `screens/mine/Drive.tsx`, `lib/files.ts`

- Tabs: `tasks` | `appointments` | `notes` | `files`.
- `StoredFile { id, name, type, size, added, courseId, folderId, starred,
  openedAt, trashedAt, text, blob }`, `FileMeta` is the same without the blob.
- `addFile`, `listFiles`, `getFile`, `moveFile`, `starFile`, `trashFile`,
  `restoreFile`, `deleteFile`, `emptyTrash`, `sweepTrash`, `clearFiles`,
  `totalSize`, `formatBytes`, `search`, `openFile` (object URL, revoked
  after 60s).
- Folders in `lib/folders.ts`, with a folder per course derived from the
  catalogue. Drag to move, or the Move picker — a drag always has a
  single-pointer equal (`a11y/dragging.test.ts`).
- Five places: **Home**, My drive, Recent, Starred, Bin — a rail beside the
  files where there is room, a row of tabs on a phone, with the browser's own
  storage estimate under it. No "Shared with me" and no Spam: nothing here can
  be sent to you, and an empty destination is a promise of a feature that does
  not exist.
- The home is `lib/drivehome.ts`: the folders something has happened in lately,
  and the files to pick up again with the **reason** beside each — opened beats
  added beats starred, each file named once under its strongest reason.
- Delete moves to the bin; the bin keeps it for `TRASH_DAYS`.
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

> ### Re-checked against the code on 2026-09-14, and most of it was wrong
>
> This section was written on 2026-09-10 and read as the repository's own map
> of itself for four days, during which a great deal of it was built. Every
> claim below was put back against `app/src` one at a time — by grepping for
> the thing rather than by reading the sentence — and **most of the Drive,
> Docs and Sheets entries were already closed**.
>
> They are struck through rather than deleted, in the style this section
> already used for the two entries that were wrong when it was written,
> because the pattern is the finding: *a hand-written gap list is a snapshot,
> and a snapshot of a repository this active is stale in days.* Anybody using
> this to decide what to build next should check the claim before acting on
> it; three of these sent work at things that already existed.
>
> What is genuinely absent today is collected at the end of the section.
>
> Closed since it was written, and verified: folders, star, trash and restore,
> recents, search inside file contents, a grid/list toggle, document templates,
> find and replace, an outline, version history, plain-text export, every
> named spreadsheet function (`VLOOKUP` … `RATE`), fill, sort, frozen panes,
> `.xlsx` import, charts on the screen and in the file, a slide canvas and a
> presenter view.
>
> Images on a slide are *not* among them, and the way that nearly got written
> here is worth the line: `lib/pptx.ts` matches "image" twice, and both are
> the notes slide's own placeholder. Grepping for a word is not checking for a
> feature, which is the same mistake at one remove as reading the sentence.

**Drive**
- ~~No folders or nested subfolders. Files are a flat list tagged by `courseId`.~~
  — **closed.** `folderId` on `StoredFile`, `moveFile`, and `readFolder` in
  `lib/stored.ts`.
- ~~No drag-and-drop to move, no grid/list toggle, no sort by type or course.~~
  — **half closed.** The grid/list toggle and the sorts are in
  `screens/mine/Drive.tsx`; drag-and-drop is not.
- No auto-created folder per course.
- ~~No search across file *contents*.~~ — **closed.** `search()` in
  `lib/files.ts` reads the text inside and says which matched on it.
- ~~No star/favourite, no recents view, **no trash and no restore** (delete is
  immediate and final).~~ — **closed.** `starFile`, `touchFile`, `trashFile`,
  `restoreFile`, `emptyTrash` and a thirty-day `sweepTrash`.
- ~~No link between a file and an *assignment* — only to a course and to notes.~~
  — **closed.** `StoredFile.itemId`, set from the drive's own **For** button or
  from the deadline's *Work for this* panel, and shown on the file's row.
- Quota exists (`lib/quota.ts`) but is on the Data screen, not over the files.

**Docs**
- No rich-text editing surface. The editor is block-structured, not WYSIWYG: no
  bold/italic toolbar, font family/size, text or highlight colour. (`**bold**`
  and `*italic*` are typed as marks and do reach the `.docx`.)
- ~~No checkbox lists,~~ ~~no indent/outdent,~~ ~~no horizontal rules,~~ ~~no code
  blocks.~~ — **all four closed.** Indent and outdent are list nesting: a
  list's items carry their own `level`, five deep, with ← and → on each row.
  Not Tab, deliberately — a list here is a column of ordinary `<input>`s on a
  card and Tab is how a keyboard leaves one, so taking it would make the list
  a trap for exactly the people who cannot reach for a mouse. `items` is a
  union of `string | Line` because both shapes are on disk: a list written
  before this is bare strings, and `listed()` reads either. Read rather than
  migrated, following `settled` in `lib/files.ts` and for its reason — a
  migration fixes the copy in localStorage and a document also arrives by
  restore, by sync and by paste. `listed()` also clamps a level to one deeper
  than the line above, because markdown, Word and HTML all describe a *tree*
  and `[level 2, level 0]` is not one; a pasted list is where that turns up.
  In markdown a sub-item is indented to its parent's *content* column — two
  spaces under `- `, three under `1. ` — which is what CommonMark asks for and
  what stops a numbered sub-item folding into the paragraph above. In the
  `.docx` the numbering part defines all five levels, because `w:ilvl` is a
  reference and pointing at an undefined level makes Word draw the item at the
  margin with no marker at all. The horizontal rule is a `rule` block, and
  closing it meant taking `---` off the page break: `break` wrote markdown's
  *thematic break* and emitted `<w:br w:type="page"/>`, so the export said
  divider and meant page break, and the import agreed with it because both
  ends were wrong the same way. `rule` now writes `---` and `break` writes
  `<!-- pagebreak -->`, which renders as nothing anywhere and comes home
  intact; `\pagebreak` and `\newpage` are read as well, so a document from
  Pandoc keeps its breaks. In the `.docx` a rule is a paragraph with its
  bottom border on, which is what Word's own Borders button draws — the format
  has no horizontal-rule element. **One consequence, stated rather than
  hidden:** a markdown file this app exported *before* this re-imports its
  page breaks as dividers. That is the correct reading of `---` and the wrong
  answer for that file, and it is visible on the page rather than silent.
  There was no test of a page break's markdown round trip at all, which is how
  the conflation survived; `docrules.test.ts` is that test. A checklist is its
  own block rather than a flag on `bullets`, because the ticked state belongs
  to each *item* and a parallel array of booleans is two lists that have to
  stay the same length — the first reorder would tick the wrong line. A code
  block is the one kind whose text is **not** marked up: `**` in a shell glob
  is two asterisks somebody typed, and `runs()` would eat them. Its markdown
  fence grows longer than any run of backticks inside it, so a snippet about
  markdown does not end its own block halfway through.
- ~~No images in documents at all.~~ — **closed.** An `image` block holding
  the id of a file in the drive, plus alt text and a caption; `lib/imagesize.ts`
  reads PNG, JPEG and GIF dimensions out of the header, and `lib/docx.ts`
  writes a `wp:inline` drawing with the alt text as `descr`. The bytes are
  **not** in the block: a document lives in localStorage with the rest of the
  state, and one phone screenshot base64'd into it would spend the whole 5MB
  budget on a figure — so the drive keeps them in IndexedDB and the export
  reads them just before it writes (`pictureOf` in `screens/Write.tsx`). A
  picture wider than the 6.5-inch text column is brought down to it, keeping
  its shape, because Word draws exactly the size it is told. A file binned
  from the drive is an ordinary thing rather than a corrupt document: the
  caption still exports and the picture does not.
- ~~No links, alignment, line spacing or margin controls.~~ — **all closed,
  and two of them were closed before this entry was last read.** Links:
  `[words](where)` in `lib/document.ts`, checked by `safeUrl` against http,
  https and mailto, and written into the `.docx` as a real hyperlink
  relationship. A refused target keeps its brackets and stays on the page.
  Line spacing and margins are **document-wide**, and have been since page
  setup arrived — `lib/doclayout.ts`, with a Line spacing control on the page
  setup panel; this entry went on listing them as absent after they were
  built. Alignment is the one that was genuinely missing, and it is
  **per-block** rather than per-document, because that is what alignment is:
  a centred heading in a left-aligned paper. `align?: Align` on `heading`,
  `text` and `quote` — the paragraphs, and not a picture or an equation (the
  exporter centres those already), a code block (columns are the only thing
  its layout carries), a table (it sets its own width) or a list. Absent
  means the document decides, which is why nothing at all is written for an
  unaligned paragraph: `left` inside a justified document means *not this
  one*, and is a different statement from saying nothing. `justify` is
  OOXML's `both`. A quotation's attribution takes the quotation's alignment.
  **Markdown drops it** — markdown describes structure and has no centred
  paragraph — which `docalign.test.ts` pins rather than leaving to be
  discovered: the alignment goes, every word stays.
- ~~No find-and-replace, no outline sidebar, no comments/margin notes.~~ —
  **all closed.** Find-and-replace and the outline are `lib/doctools.ts`
  (`findAll`, `replaceAll`, `outline`). Notes are `Note` in
  `lib/document.ts`, and the shape of them is the decision worth recording:
  a note belongs to a **block**, not to a range of characters. Word anchors a
  comment to a range; this app cannot, because a block is edited as one
  `<textarea>` with no persisted selection, so a character offset would be
  wrong the moment somebody typed in front of it — and repairing offsets on
  every keystroke is a system with bugs of its own. Against the block, a note
  moves when the block moves and goes when the block goes, both for free.
  `Block` is `Kinded & { notes?: Note[] }` rather than the field being added
  to each of the eleven members, which would be eleven chances to leave it
  off the twelfth; the intersection distributes, so `kind` still narrows.
  Out to `.docx` as **real Word comments** — a range start, a range end and a
  reference in the body, an entry in `comments.xml`, a content type and a
  relationship, all four or Word calls the whole file unreadable — and back
  in through `lib/docxin.ts`, which used to say comments were left behind and
  now says so only when one refers to an entry that is not in the file.
  Resolved survives both ways, through `commentsExtended.xml`, which finds a
  comment by its paragraph's `w14:paraId` rather than by the comment's own id.
  Written only when something *is* resolved: an empty part is a part that says
  nothing and can still be got wrong. On the page they sit in the margin,
  absolutely positioned so they cannot shift the prose by a line — the page
  view is what prints, and a note that moved the text would make it lie about
  where the page breaks fall. They do not print, and below 1100px they come
  back into the flow rather than off the side of a phone. Markdown has no
  margin, so it drops them and keeps every word.
- ~~**No version history and no restore.** No autosave indicator.~~ —
  **closed.** `lib/docversions.ts`, and the History panel in `screens/Write.tsx`.
- ~~No *generated* PDF~~ — **closed**, in `lib/pdf.ts` (measure and break) and
  `lib/pdfout.ts` (place and write). File → "Print, or save as PDF" is still
  there and is still how most people will make one; this is the other kind, a
  file made with no dialog that is byte-identical on every machine. The print
  route depends on the browser — Chrome and Safari paginate the same HTML
  differently, a phone often has no print-to-PDF at all, and neither can be
  attached to an email without somebody standing there.
  Written without a library, for the reason `docx.ts` gives about OOXML.
  **A PDF does not wrap text**: nothing in the file says how wide a paragraph
  is, so the writer decides where every line ends and places each one — which
  is why `pdfwidths.data.ts` exists. It holds Adobe's published metrics for
  the standard fourteen fonts, generated rather than typed, because a table of
  three thousand numbers entered by hand is a table with a mistake in it. The
  fonts are the ones a reader already has (Helvetica, Times, Courier), so
  nothing is embedded and the file is a few kilobytes; the five
  `lib/doclayout.ts` offers map onto them, a serif to a serif.
  Every placement goes through `Pen.spend`, which is the only thing that
  knows where the pen is — a table row asks for its whole height at once and
  is therefore never cut in half by a page break.
  **What it cannot carry:** an equation (the app holds LaTeX and draws it with
  KaTeX; placing that is a typesetting engine, so the LaTeX prints as typed),
  a picture (its bytes are in IndexedDB and this is a pure function of the
  document — the caption still prints, so a figure is visibly not here rather
  than silently missing), and a margin note, which never prints anywhere.
  Characters WinAnsi has no byte for become what they meant: `☒` is `[x]`,
  `○` is `o`. The cross-reference table is byte offsets, so every string is
  encoded Latin-1 — one UTF-8 accent and every offset after it is wrong and a
  reader refuses the file outright. ~~No DOCX *import*~~ — **closed**, in
  `lib/docxin.ts`: headings, paragraphs, nested lists, checklists, tables,
  quotations, code, page breaks, dividers, pictures, alignment, and bold,
  italic, strike-through, monospace and links inside a line. It is a separate
  reader from the one in `extract.ts`, which opens a .docx too and
  deliberately flattens it — that one pulls words out for *search* and for
  the syllabus parser, this one keeps the structure, and one file growing a
  flag would serve both badly. They share the entity decoder.
  The pictures come out as bytes for the screen to file in the drive, the
  same split as `pictureOf` on the way out and for the same reason: the
  reader stays a function of what it is handed, so its tests open a Word file
  without a browser. What cannot come — an equation (Word stores OMML, and
  reading it back into LaTeX is a second parser), comments, tracked changes,
  footnotes, text boxes — is named in `Read.notes` rather than dropped in
  silence, the convention `lib/xlsxin.ts` set.
  **Two bugs it is worth having written down.** `<a:blip …>` was matched with
  `[^>]*`, which swallowed the `Fill` in `<pic:blipFill>` sitting four
  characters earlier in every picture Word writes — so every picture read as
  an empty paragraph and was dropped without a word; tag patterns end at the
  name now. And Word does not put `<w:numPr>` on a list paragraph it styled
  with *List Bullet*: the numbering is in the style, and the depth is in the
  style's *name*, so every list in every Word-made file arrived as a run of
  ordinary paragraphs. `styles.xml` is read for both. Neither was findable by
  round-tripping this app's own export, which is why `__docs/word-styles.docx`
  — made by python-docx on Word's default template — is in the suite.
  ~~No plain-text export.~~ — Markdown out is `toMarkdown`.
- ~~No templates (essay/MLA/APA, lab report, reading response, etc.).~~ —
  **closed.** Seven, in `lib/doctemplates.ts`.
- No "Open in Docs" from a study guide.

**Sheets**
- ~~**Single grid per file — no cross-sheet `Sheet2!A1` references.**~~ —
  **closed.** `Marks!B2` and `'Q1 marks'!B2:B9` resolve through `Ctx.book` in
  `lib/sheet.ts`, with the cycle check qualified by sheet so `A1` on two
  sheets is two cells. A rename follows (`renameIn`), a row inserted on one
  sheet moves every reference into it from every other (`shiftIn`, undo
  included), and an export brings the sheets a formula reads with it under the
  names the tabs will carry. A name no sheet has, or one two sheets share,
  reads `#REF!`.
- ~~Missing functions the prompt names: `IFS IFERROR VLOOKUP HLOOKUP XLOOKUP INDEX
  MATCH LEFT RIGHT MID TEXT SPLIT TODAY NOW DATE DATEDIF WEEKDAY EOMONTH MODE
  CORREL COUNTIF SUMIF COUNTIFS SUMIFS AVERAGEIF NPV IRR PMT FV PV RATE`.~~ —
  **closed.** Every one of the thirty is in `lib/sheet.ts`, alongside the
  fitted line (`SLOPE`, `INTERCEPT`, `RSQ`, `FORECAST`).
- ~~No absolute references (`$A$1`)~~ — **wrong as written, and correcting it
  found a bug.** `parseRef` has always accepted `$A$1`, `$A1` and `A$1`, and a
  range end was rebuilt through `ref()` so `SUM($A$1:$B$2)` was right. But a
  *lone* reference was looked up as the raw string, so `cells['$A$1']` missed
  and `=$A$1*2` came back **0** where the cell held 5 — silently, as a number
  rather than a `#REF!`. Fixed on this branch; addresses are normalised before
  lookup. What is still genuinely absent is any *effect* of pinning: there is
  no fill handle, so nothing moves a reference and nothing needs holding still.
- ~~No named ranges.~~ — **closed.** `lib/names.ts` holds a name as a pointer
  at a sheet and two corners, not as a string, so `=AVERAGE(Marks)` goes on
  meaning the marks when rows are inserted inside the block or the sheet under
  it is renamed — `moveRef`/`renameRef` in `lib/sheetedit.ts` move it the same
  way a formula moves. A one-cell name reads as that cell and a block used
  where one value is wanted says `#VALUE!` rather than picking a corner.
  `lib/xlsx.ts` writes them as real `<definedNames>`, re-pointed at the tab
  names the file will carry — without that last step the name named a tab the
  file did not have, and openpyxl is what said so.
- No fill handle — so a formula filled down in Excel arrives as the values it
  last had, not as a live formula. The import says so rather than leaving it to
  be found in a total that stopped moving.
- ~~No fill handle, no paste-special, no undo/redo inside the grid.~~ — undo
  and redo are in the grid now (`lib/history.ts`), coalesced by cell so a run
  of typing is one step rather than one per keystroke. **Fill down and fill
  right** are on the Data tab and on ⌘D/⌘R (`fill` in `lib/sheetedit.ts`),
  with `$` honoured. ~~No fill *handle* — the corner you drag~~ — **closed**:
  the corner of the selection drags to fill and presses to fill as far as the
  column beside it goes, and it is a real button with a name so it works from
  the keyboard. ~~No paste-special.~~ — **closed.** Five ways in
  `PASTE_WAYS` (`lib/sheetedit.ts`): everything, values, formulas, formats,
  transposed. `values` is the one that could not be had another way — it needs
  the *answers*, which are taken at copy time and carried on the clip, because
  a clip can be put down on another sheet where its `=SUM(B2:B9)` would
  evaluate against nine cells that have nothing to do with it. A transposed
  paste leaves its formulas as written: there is no single translation that is
  right for the block, since the offset for the cell at (1, 4) is not the one
  for (4, 1).
- ~~No cell formatting at all: number/currency/percent/date formats, bold,
  fill, borders, alignment, wrap, merge.~~ — **closed, and the correction that
  closed it was itself out of date twice.** Number, currency, percent, date and
  decimal places, bold, italic, strikethrough and alignment went in first. The
  sentence then said *still no fill, borders, wrap or merge* — and **fill and
  borders were already there** when it was written: `CellStyle.wash` and
  `CellStyle.edge`, a swatch and a pick on the Format tab, written out as real
  `<fill>` and `<border>` elements. Only wrap and merge were genuinely absent.
  Both are in now: `CellStyle.wrap` (a wrapped cell is drawn as a `<textarea>`,
  because no CSS makes an `<input>` fold, and only a wrapped one, so every
  other cell keeps the element it had) and `lib/joined.ts` for blocks drawn as
  one cell — named `joined` and not `merge` because `lib/merge.ts` is this
  app's *sync*. Joining clears the cells it covers and says how many it
  cleared: `=SUM(A1:C1)` must not add up values nobody can see, which is the
  hidden-row trap with no filter visible to explain it. Undo takes back the
  block and the values together — it did not at first, and put them back
  underneath a block still covering them.
- ~~No sort, no filter, no freeze panes.~~ — **closed.** Sort is `sortRange`,
  the View tab freezes the top row, and `lib/filter.ts` hides rows on a rule
  per column — with the status bar counting only what is visible, because a
  `SUM` still adds up the hidden rows and that is the trap.
- ~~No conditional formatting, no data validation or dropdowns.~~ —
  **both closed.** `lib/condfmt.ts` holds rules rather than
  painted cells, so a colour follows the number; `lib/xlsxcond.ts` writes them
  into the file as real `cfRule`s against a book-wide `dxfs` table.
  `lib/validate.ts` says what a block may hold — one of a list, a whole
  number, a number, a band, a text length — and **marks rather than refuses**,
  because the grid writes a cell on every keystroke and a rule that could
  refuse would refuse the `8` on the way to `85`. That is also why the marking
  earns its keep: Excel validates only what is typed and lets paste, fill and
  import past, which is how a validated column fills with values breaking its
  own rule. A list rule offers its values as a `datalist` — it offers, it does
  not confine. `lib/xlsxvalid.ts` writes them as real `dataValidation`
  elements, native types where they map and a spelled-out `custom` formula
  where they do not, rather than inventing a floor of minus a trillion and
  calling it unbounded.
- ~~**No charts and no pivot tables.**~~ — **charts closed.** `lib/chart.ts`
  reads a range into series, `components/SheetChart.tsx` draws columns, bars,
  a line or a pie, and `lib/xlsxchart.ts` writes a *live* chart into the
  workbook — a reference, not a copy, so editing the cell in Excel moves the
  bar. **Pivot tables closed** too: `lib/pivot.ts` groups a block by one field
  and optionally a second, and counts, sums, averages or takes the extremes of
  a third. A row or column total re-gathers the values rather than averaging
  the averages — the arithmetic mistake a hand-built summary makes — and
  `asCells` writes the table into the grid as live `SUMIFS`/`AVERAGEIFS`, so it
  is still right after a mark changes, in the app and in Excel alike. Data →
  Analyse still hands the same numbers to `screens/Analyse.tsx` for the
  statistics a pivot does not do.
- ~~**No XLSX or CSV import** (export only)~~ — **wrong as written.** CSV and
  TSV could always be *pasted* in: "Paste a table in" runs `readTable()` and
  dispatches `makeSheet`. What was missing was importing a **file** — and
  `.xlsx` in any form. Both are on this branch now (`lib/xlsxin.ts`): a picked
  `.xlsx` or `.csv` comes in with its formulas live, its dates read as dates,
  and every worksheet as its own sheet.
- ~~No auto-generated grade calculator per course, no GPA planner template.~~
  — **half of this was already wrong, and the rest is closed.** The per-course
  calculator has existed as `lib/gradesheet.ts` the whole time: built from
  `Course.grading`, offered on the shelf under *What do I need?*, with every
  score blank and the syllabus's own wording beside each weight. What was
  genuinely absent was the GPA planner, now `lib/gpasheet.ts` — this term's
  courses and credits, what is already on the transcript, and what the rest of
  the term would have to average to reach a target, with the sentence that says
  when that is above what the scale can give. The grade-point table is a
  visible block in the sheet that every lookup reads, so a school counting A+
  as 4.3 is one cell. Both also ship as blank templates, for a syllabus written
  in prose or a term the app does not hold.

**Slides**
- ~~No canvas editor.~~ — the slide is drawn at 16:9 and typed into in place
  (`screens/deck/Canvas.tsx`). What is still absent is *free* layout: you
  cannot move a text box or place a shape, because the boxes are the layout's
  and the layout is what the exported file draws.
- ~~No layouts picker, no themes/palettes~~ — both exist (`LAYOUTS`, `THEMES`).
  No transitions or animations, and none is planned: `lib/pptx.ts` would have
  to write them into the file for the promise to be real, and a transition that
  only happens in this app's presenter view is a lie about the `.pptx`.
- No images or charts placed on slides. Tables have been placeable since
  `table()` in `lib/pptx.ts` — this line was wrong when it was written.
- ~~No presenter mode, no per-slide reorder/hide UI.~~ — also wrong when
  written: `Presenter` and the rail's reorder and hide were both already here.
- No PDF or PNG export, no PPTX import.
- No templates for a whole deck. (There are three *builders* — from a unit,
  from a sheet, from a brief — which is the same need answered from the app's
  own material rather than from a gallery.)

**Cross-app**
- ~~No single "＋ New" button offering Folder/Document/Presentation/Spreadsheet/Upload.~~
  — **closed on the deadline, where the question is actually asked.** *Work for
  this* on a deadline offers ＋ Document · Sheet · Deck · Note · Upload, and each
  makes something already filed against that deadline and its course. There is
  still no such row on a *folder*, which is the half of this entry that remains.
- No paste-a-range-into-Docs-as-a-table.
- ~~Universal search does not return documents, sheets or files.~~ — closed
  earlier; and search now matches a document, sheet or deck on the *deadline*
  it is for as well as on its own name and contents. (The drive also has a
  search of its own, which reads names and the text inside.)
- ~~No assignment-attachment flow for any of these.~~ — **closed.** An optional
  `itemId` on `Doc`, `Sheet`, `StoredDeck`, `SavedEquation`, `Note` and
  `StoredFile` links work to one deadline rather than to a term-wide course.
  `app/src/lib/forwork.ts` is the only reader of it, `app/src/lib/clips.ts`
  makes the count affordable per row, and the link is drawn from both ends —
  a panel on the deadline, a *What it is for* picker on every screen that makes
  something, a paperclip and a count on every deadline row, and a *for Quiz #1*
  line on a file in the drive. A link whose deadline has been edited away reads
  as no link rather than as a broken one.

### Genuinely absent, 2026-09-14

Everything above that is not struck through, collected — so the next person
reading this has one short list rather than a long one to re-check. Verified
by grepping for each, not by re-reading the sentence.

**Documents** — "Open in Docs" from a study guide · a WYSIWYG surface (the
marks are typed).
(Code blocks, checkbox lists, images, horizontal rules, indent/outdent,
alignment, `.docx` import, margin notes and a generated PDF were on this list
and are done. Line spacing and margins were on it
and had already been built when it was written.)

**Sheets** — nothing. Every entry this section listed is either built or was
already built when it was listed.
(Cross-sheet references, the fill handle, filtering, conditional formatting,
named ranges, pivot tables, paste-special, data validation, wrap, merge and the
GPA planner were all on this list and are done. Fill, borders and the
per-course grade calculator were on it and had already been built when it was
written — which is three of fourteen, and the reason this file says to grep for
the thing rather than read the sentence.)

**Slides** — free layout (a text box you can move) · images and charts placed
on a slide · transitions, which are deliberate: `lib/pptx.ts` would have to
write them into the file for the promise to be real · PDF and PNG export ·
`.pptx` import · whole-deck templates.

**Drive** — drag-and-drop to move · an auto-created folder per course · the
quota shown over the files rather than on the Data screen.

**Cross-app** — a ＋ New row on a *folder* · paste-a-range-into-Docs-as-a-table.

Both of the entries this list once flagged as the dangerous ones have since
been built, and the warnings turned out to be the right ones. Widening
`evaluate` to several grids did land in the code where a wrong answer is
silent — the first version used one function as both the cell-lookup key and
the cycle-path key, and every formula in the app read as an empty cell until a
test said so — and the half nobody thinks of is not the reading but the
*editing*: a row inserted on one sheet has to move the references into it from
every other sheet, and undo has to put those back. The fill handle was the
small one, and the two faults in it were both about telling a press from a
drag.

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
