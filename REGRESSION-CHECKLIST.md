# REGRESSION-CHECKLIST.md

Every existing behaviour that must still work identically after the Workspace
work. Run this at the end of **each** phase and report pass/fail before moving
on, per §1 of the build prompt.

**Baseline captured 2026-09-10 on `claude/new-session-xh7by4`, before any
feature code:**

```
npm test    → 260 files, 5,212 passed, 10 skipped, exit 0
npm run build → exit 0, 234 JS chunks, 6,469,990 B total
              entry index-*.js = 562,445 B (174.79 kB gzip)
```

---

## A. Automated gates — all four must pass, every phase

- [ ] **A1** `npm test` — 260 files pass, **≥ 5,212 tests pass**, 0 failures.
      A dropped test counts as a regression, not as a cleanup.
- [ ] **A2** `npm run test:zones` — the suite passes under both
      `America/Chicago` and `Pacific/Kiritimati`.
- [ ] **A3** `npm run lint` — oxlint clean, `scripts/styles.mjs` clean (no raw
      hex, no off-scale spacing), `scripts/labels.mjs` clean.
- [ ] **A4** `npm run build` — exit 0, no TypeScript errors.

## B. Bundle and load — the prompt's own performance rule

- [ ] **B1** Entry chunk `index-*.js` has **not grown beyond 562,445 B**, or the
      growth is stated in bytes and justified.
- [ ] **B2** Every new Workspace editor is in its own lazily-imported chunk —
      confirmed by finding it as a separate file in `dist/assets`, not inside
      the entry chunk.
- [ ] **B3** New heavy dependencies (rich text, charts, XLSX/PPTX readers) do not
      appear in the entry chunk.
- [ ] **B4** Before/after totals reported: chunk count, total JS bytes, entry
      bytes, entry gzip.

## C. Routing — `lib/route.ts`

- [ ] **C1** Every one of the 72 `Screen` members still resolves through the
      `switch` in `App.tsx` and draws its screen.
- [ ] **C2** `toHash` / `fromHash` round-trip unchanged for every named screen:
      `course`, `edit`, `item`, `event`, `guide`, `drill`, `quiz`, `lesson`,
      `slides`, `note`.
- [ ] **C3** `#/guide/econ?mode=cards` still carries the mode; the mode still
      rides on `guide` and nowhere else.
- [ ] **C4** **Every `RETIRED` row still redirects**, with its `opens` hint:
      `#/weekly`→ Reports at week grain · `#/worked`→ Reports at term grain ·
      `#/check`→ A change to a date, feed source · `#/chat`→ Ask ·
      `#/grades`→ Courses, grades tab · `#/setStorage`→ Data ·
      `#/everything`→ Progress, "all" tab.
- [ ] **C5** No row has been removed from `RETIRED`.
- [ ] **C6** A malformed escape (`#/guide/%`) still falls back to the raw
      segment and does **not** throw or blank the page.
- [ ] **C7** Browser Back and Forward still move between screens; refreshing on a
      deep link still lands on that screen.
- [ ] **C8** Changing a guide's mode still *replaces* rather than pushes history
      (`replaces()`).
- [ ] **C9** No existing route path has been renamed or repurposed.

## D. Navigation surfaces

- [ ] **D1** All four `NavMode`s still work: `tabs`, `feed`, `springboard`, `shelves`.
- [ ] **D2** Tab bar defaults to `home, courses, study, calendar, me`; a saved
      custom tab set still loads; the `FEWEST_CHOSEN` floor still reverts.
- [ ] **D3** All 52 destinations still appear in the launcher, on the same shelf.
- [ ] **D4** The seven shelves are still `Semester, Courses, Study, Make,
      Campus, Life, Data`, in that order.
- [ ] **D5** Tile reordering still saves and reloads (`groupOrder`).
- [ ] **D6** Springboard dock still saves under the `dock` look key.
- [ ] **D7** Command palette still finds every destination by label, blurb and
      keywords, and still opens as an overlay over the current screen.
- [ ] **D8** "By task" still lists every destination under its `taskTags`.
- [ ] **D9** Recents and `lastOpened` still update.
- [ ] **D10** Per-school gating (`Capabilities`) still hides destinations a
      school does not offer.

## E. Data survival — no data loss

- [ ] **E1** An account saved **before** the change loads correctly **after** it,
      with courses, deadlines, notes, tasks, grades, documents, sheets and
      equations all intact. Test with a real `semester.v1` payload, not an empty one.
- [ ] **E2** Every localStorage key in §5 of the inventory is still read and
      written under its exact existing name — none renamed, none dropped.
- [ ] **E3** IndexedDB `semester-store` still opens at its existing name and
      version, or migrates forward preserving every record.
- [ ] **E4** IndexedDB `semester-files` still holds existing attachments and they
      still open.
- [ ] **E5** Snapshots database untouched; existing snapshots still restore.
- [ ] **E6** `schemaVersion` migration is forward-only; an older payload upgrades
      without losing unknown fields.
- [ ] **E7** `documents`, `sheets` and `equations` still merge as unions and are
      still never shed by `lib/keep.ts`.
- [ ] **E8** No existing data-model field has been renamed or removed.
- [ ] **E9** Backup → wipe → restore (`#/export`) still round-trips everything.
- [ ] **E10** With IndexedDB unavailable (private window), the app still boots and
      still falls back to localStorage.

## F. Write a document — `#/write`

- [ ] **F1** Existing saved documents still list and still open.
- [ ] **F2** New document; title and subtitle save.
- [ ] **F3** All seven block kinds still insert and edit: heading (1–3), text,
      bullets (numbered and not), quote **with its source**, table, equation,
      page break.
- [ ] **F4** Word count, summary line and `hasContent` still correct.
- [ ] **F5** Markdown export still produces the same output for the same doc.
- [ ] **F6** Markdown import still parses into the same blocks.
- [ ] **F7** **`.docx` export still opens in Word** with headings, tables and
      equations intact.
- [ ] **F8** Print view still renders.
- [ ] **F9** Course tagging still saves and still files the doc under the course.
- [ ] **F10** Delete still removes the document and only that document.

## G. Sheet or table — `#/sheet`

- [ ] **G1** Existing saved sheets still list and still open with their cells.
- [ ] **G2** New sheet still opens at 12×6; grid still drags out to 200×26 and no further.
- [ ] **G3** **All 32 formula functions still evaluate to the same values**:
      `IF SUMPRODUCT AND OR NOT COUNTA CONCAT LEN UPPER LOWER TRIM SUM PRODUCT
      COUNT AVERAGE AVG MEDIAN MIN MAX STDEV STDEVP VAR VARP ABS INT SQRT EXP LN
      LOG10 POWER MOD ROUND`.
- [ ] **G4** A1 references and ranges (`A1:B7`) still resolve.
- [ ] **G5** All five errors still surface in the cell rather than resolving to a
      number: `#DIV/0!`, `#REF!`, `#NAME?`, `#VALUE!`, `#CYCLE!`.
- [ ] **G6** Cycle detection still catches a self-referencing cell.
- [ ] **G7** `weighted(scores, weights)` still produces the same gradebook total.
- [ ] **G8** **`.xlsx` export still opens in Excel with the formulas still live**,
      not flattened to values.
- [ ] **G9** `.csv` export unchanged.
- [ ] **G10** Markdown-table export still pastes into a document.
- [ ] **G11** Pasting a TSV/CSV block still parses via `readTable`.
- [ ] **G12** Course tagging and delete still work.

## H. Make a deck — `#/deck`

- [ ] **H1** Deck from a study-guide unit still drafts the same slides.
- [ ] **H2** Deck from a table still drafts.
- [ ] **H3** Deck from a brief still reads the plan, still names the holes.
- [ ] **H4** `slidesFor(minutes, kind)` still sizes the same.
- [ ] **H5** Speaker notes still generate.
- [ ] **H6** Figures still become slides.
- [ ] **H7** **`.pptx` export still opens in PowerPoint.**

## I. Personal → Files — `#/mine`

- [ ] **I1** All four tabs still work: tasks, appointments, notes, files.
- [ ] **I2** Existing attachments still list with name, type, size and date.
- [ ] **I3** Upload still stores to IndexedDB.
- [ ] **I4** Open still works and still revokes the object URL.
- [ ] **I5** Delete still removes the file.
- [ ] **I6** Attaching a file to a note still works; `note.fileIds` unchanged.
- [ ] **I7** "Erase from this device" still clears every file.
- [ ] **I8** Total size and `formatBytes` still report correctly.

## J. Study — the 11 modes and the rest

- [ ] **J1** All 11 `StudyMode`s still render: `cards read field watch slides doc
      quiz figures cases cram listen`.
- [ ] **J2** `#/slides/:guideId` (the study slide view) still works and is still
      distinct from `#/deck`.
- [ ] **J3** Drill, quiz, guess and lesson still run; spaced review still schedules.
- [ ] **J4** Figures, diagrams (mermaid, cytoscape) and equations (KaTeX) still render.
- [ ] **J5** Audio lessons for all four courses still play.
- [ ] **J6** Exam runway, practice paper, gap, solve, analyse still work.

## K. Courses, deadlines, calendar

- [ ] **K1** All four seeded courses still load with their deadlines, meeting
      patterns and study guides.
- [ ] **K2** Adding a course from a PDF syllabus still parses.
- [ ] **K3** Editing a course still saves.
- [ ] **K4** Calendar still renders day, week, month and semester views.
- [ ] **K5** Calendar sources (all/classes/deadlines/campus) still filter.
- [ ] **K6** Drag-to-move an item still works in every view.
- [ ] **K7** ICS import and export still round-trip; subscribed feeds still fetch.
- [ ] **K8** Clash detection still flags overlaps.
- [ ] **K9** Today, week ahead, behind, tonight and Reports (day/week/term) unchanged.
- [ ] **K10** Grades, GPA, standing and cutoffs still compute the same.

## L. Assistant

- [ ] **L1** `#/ask` still streams an answer.
- [ ] **L2** Threads still save, archive and reopen.
- [ ] **L3** All eight providers still contribute context.
- [ ] **L4** Tool calls still run and still undo.
- [ ] **L5** Assistant dock corner still saves.
- [ ] **L6** With no key configured, the message still says so plainly.

## M. Campus, life, data, settings

- [ ] **M1** Maps, meals, housing, classmates, activities, group work,
      registration, people, applications, costs, clocks, links, mail all still open.
- [ ] **M2** Account sign-in and Connect (Microsoft/Google/Zoom/Apple) unchanged.
- [ ] **M3** Data screen still reports record counts, byte weights and quota.
- [ ] **M4** All eight settings sub-screens still open as real screens with
      working Back.
- [ ] **M5** Every look setting still applies: accent, text size, ground, density,
      corners, typeface, bodyface, line height, reading width, icon shape, labels,
      tone, badges, feed, course colours, shell, directory, hue.

## N. Appearance — no visual regressions

- [ ] **N1** Existing screens are pixel-unchanged. Compare screenshots of Today,
      Courses, a course, Study, a guide, Calendar, Write, Sheet, Deck, Personal,
      Settings before and after.
- [ ] **N2** New UI uses only the 58 existing tokens — no new colour, radius,
      type size or spacing value.
- [ ] **N3** New UI reuses `components/ui.tsx` primitives rather than
      re-implementing buttons, chips, toggles or empty states.
- [ ] **N4** Dark theme unchanged throughout; no light-mode leakage.
- [ ] **N5** `--text-scale` and `--density` still scale new UI along with old.

## O. Accessibility

- [ ] **O1** Every `src/a11y/` test still passes: labels, landmarks, modal,
      motion, title, type, dragging, tellings.
- [ ] **O2** New controls carry accessible labels (`scripts/labels.mjs` passes).
- [ ] **O3** Keyboard navigation reaches every new control; focus is visible.
- [ ] **O4** Reduced-motion still honoured.
- [ ] **O5** Contrast still meets WCAG AA at every text size.

## P. Offline, mobile, deploy

- [ ] **P1** Service worker still registers; the app still loads offline.
- [ ] **P2** Still installable as a PWA; manifest unchanged.
- [ ] **P3** Every screen still usable at 390 px wide; no horizontal scroll.
- [ ] **P4** Multi-tab sync still works (`BroadcastChannel`, `lib/tabs.ts`).
- [ ] **P5** Builds and deploys to GitHub Pages under `VITE_BASE=/semester/`
      with no errors, and hash routing still works from the subpath.
- [ ] **P6** No new runtime dependency on any dev-server proxy.

## Q. The additive rules themselves

- [ ] **Q1** No page, route, component, feature or data field deleted.
- [ ] **Q2** No route path, storage key or model field renamed.
- [ ] **Q3** No existing route repurposed — new features at new routes only.
- [ ] **Q4** Still a static build; no new required backend.
- [ ] **Q5** Nothing invents a deadline, grade, policy or financial figure;
      generated content is still labelled as generated and still cites its source.
