# Capability parity matrix

The contract: every capability a student is permitted is reachable at every
width. This table lists the places where the app **does** look at the width,
because those are the only places parity can break. Screens not listed here
read no width at all. They render one component tree that reflows through CSS,
so they are the same app at every size by construction.

The table is also enforced in code: `app/src/widthgate.test.ts` holds the
same list, fails for a new file that reads the width without a row, and fails
for a row whose file has stopped asking.

## Where the width is read

| File | Wide window | Narrow window gets | Status |
| --- | --- | --- | --- |
| `App.tsx` | Rail beside the screen | Tab bar at the foot; every screen reachable from both (`lib/chrome.ts`, `chrome.test.ts`) | Parity |
| `ai/Assistant.tsx` | Button in the corner | Button lifted clear of the tab bar | Parity |
| `ai/Chat.tsx` | History column beside the chat | History behind a button, as an overlay | Parity |
| `ai/Panel.tsx` | Fixed panel | Sheet with a drag handle to expand | Parity |
| `components/Adopting.tsx` | Fixed to the window | Fixed to the column | Parity |
| `components/Bench.tsx` | Menubar | Every menu as one sheet of rows | Parity |
| `components/Command.tsx` | Larger palette | Same palette, smaller type | Parity |
| `components/Keys.tsx` | Shortcuts and the `?` sheet | **Fixed in this change**: listens wherever there is a fine pointer too; a touch-only phone has visible controls for every shortcut | Parity |
| `components/QuickAdd.tsx` | Fixed to the window | Fixed to the column | Parity |
| `components/desk/TopBar.tsx` | Full search prompt; bookmark and Intelligence beside the field | Shorter search prompt with the same accessible name and suggestions. Below 840px search has a full-width row; bookmark and Intelligence move beside All apps and Profile. Alerts and Settings remain in the launcher. | Parity |
| `screens/Calendar.tsx` | Seven-day week | Three-day view; arrows step through every day; Month and Agenda identical | Parity (presentation) |
| `screens/Classmates.tsx` | List beside conversation | List in place of it, one tap back | Parity |
| `screens/Mail.tsx` | Folder rail, toolbar pager, reading pane | Folders button, **pager row under the toolbar (fixed in this change)**, message replaces list | Parity |
| `screens/deck/Edit.tsx` | Slides beside editor | Stacked | Parity |
| `screens/mine/Drive.tsx` | Folders beside files | Stacked | Parity |

Stylesheet-only density changes (the `@media (max-width: …)` rules in
`styles/app.css` that set `display: none`) were read too. Each one removes a
column label, a wordmark or a duplicate control whose action is still in
reach, for example the workspace bar's first two tools, which are also in the
launcher.

## The spec's capabilities against the app

This part maps the spec's list onto the screens that exist, so that nothing is
counted as adapted when it has not been built.

| Spec capability | Semester screen(s) | Adapts by |
| --- | --- | --- |
| Today action center | `Today.tsx` | CSS: one column below 1200, a two-column decision surface at ≥ 1200 |
| Degree / path planning | `Pathway.tsx`, `Degree.tsx` | Reflow |
| Course / global search | Command palette (`components/Command.tsx`); `Search.tsx` is the workspace new-tab page | Palette sizing |
| Term planner | `Calendar.tsx`, `Runway.tsx` | 3-day ↔ 7-day, Agenda at all widths |
| Registration readiness | `Registrar.tsx`, `lib/registration-day.ts` | Reflow |
| Study Studio, flashcards, quizzes | `Study.tsx`, `Guide.tsx`, `Drill.tsx`, `Lesson.tsx`, `Guess.tsx` | Full screen at every width (`FULLSCREEN` in `lib/chrome.ts`) |
| Assignment workspace | `Work.tsx` | Reflow |
| Research Studio | `Sources.tsx` (source locker) | Reflow. **No dedicated Research Studio screen exists.** |
| Data Studio | `Data.tsx`, `Analyse.tsx`, `Sheet.tsx` | Reflow |
| Code Studio | none | **Not built** |
| Writing / presentation | `Write.tsx`, `Essay.tsx`, `Deck.tsx`, `deck/Edit.tsx`, `Slides.tsx` | Side-by-side ↔ stacked (Edit) |
| Career Hub | `Career.tsx`, `Applying.tsx` | Reflow |
| Campus Hub | `University.tsx`, `Maps.tsx`, `Directory.tsx` | Reflow |
| Community | `People.tsx`, `Classmates.tsx`, `Groupwork.tsx` | List/detail (Classmates) |
| Advising | `Degree.tsx`, `Registrar.tsx` | Reflow |
| AI policy / disclosure | `Essay.tsx` (the course's recorded AI policy), `EditCourse.tsx` (where it is set) | Reflow |
| Tenant admin, integrations, moderation, analytics, support | Institutional preview | **Not audited in this change** |

"Reflow" means the screen reads no width and relies on the shared column,
measure and token rules in [RESPONSIVE-COMPONENT-SPEC.md](RESPONSIVE-COMPONENT-SPEC.md).
That is parity by construction. It is **not** a claim that every one of those
screens has been checked at 320px. See the manual checks in
[RESPONSIVE-ACCESSIBILITY-TEST-PLAN.md](RESPONSIVE-ACCESSIBILITY-TEST-PLAN.md).
