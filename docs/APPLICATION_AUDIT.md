# Semester Application Audit

September 14, 2026

## Result

The local application passed a load check across all 60 registered app destinations. The final route sweep recorded no console warnings/errors or application error screens. The overlap pass additionally checked shared search/launcher transitions and internal panel widths as detailed below. The automated suite passed **6,422 tests**, with **10 existing tests skipped**, across **317 test files**. The production build, TypeScript checks, institution gateway check, and lint/style/accessible-label checks passed. Lint still reports existing advisory warnings; the build still warns about several large JavaScript bundles.

This is evidence for the checks below, **not certification that every feature, browser, integration or production workflow works**. Semester is not yet fully built out against the complete product vision. Several institutional services remain preparation tools or interface contracts, and several advanced student/productivity features still need implementation.

Testing used an isolated sample-data origin at port 5174. The user's existing application data at port 5173 was not used for test mutations. No real message, submission, enrollment, payment, booking or institutional record change was made.

## Fixes completed

1. **Open-file continuity.** Write, Sheet and Deck now include the saved file ID in their routes. Reload preserves the open file; navigating back to the library clears the file selection correctly. Document and spreadsheet tab switching and reload were checked with saved test content.
2. **Bookmark reopening.** Reopening an already-open file from a bookmark now creates a correctly named tab with its own saved destination, even when the displayed screen does not change.
3. **Safer local workspace saving.** Saves read the current stored record before applying changes. Unreadable records remain intact and produce a visible recovery message. Storage removal and recovery in another tab refresh the UI. Changing account/term storage keys does not temporarily display the previous key's records. This is not a transactional multi-device synchronization system.
4. **Registration and campus data preservation.** Registration plans, imported housing/dining/club directories, saved selections, meal estimates, housing plans and university drafts use the safer save path. Failed saves do not report successful catalog/directory removal or restore. At the schedule limit, the app no longer silently discards the oldest saved plan.
5. **Expanded core backup.** Core exports and rolling core snapshots now include authored documents, sheets, decks, study/assignment progress, degree and campus/financial planning records, and more existing persisted fields. Core restore still validates through the existing importer and preserves fields absent from older backups.
6. **Additional workspace backup and restore.** Export now includes a separate versioned file for Forms/Design/Video projects, athletics, career, family plans, pathway, university drafts, registration and campus portal plans. Restoration validates the whole file, previews affected workspaces, downloads the current copy, and rolls back earlier writes if a later write fails. Personal workspace exports are scoped to the selected account; legacy registration/directories remain device-scoped. Credentials are excluded. Attachments must be included separately in the export ZIP. These additional stores are not automatically part of core cloud synchronization or daily snapshots.
7. **Search and overlay behavior.** Navigation closes stale search/app-launcher panels. Malformed stored shortcut preferences fall back to valid UI values. Top search and app launcher keep the central search bar suppressed.
8. **Mobile header and launcher.** The search field can shrink to fit the header. The launcher is constrained to the phone viewport, keeping the profile button and right edge visible.
9. **Tab styling.** Removed conflicting border shorthand/longhand updates in the legacy tab strip.
10. **Duplicate search and tab systems.** The modern layout now owns its tab row and top search field. The legacy Command screen and legacy tab strips no longer render inside it. Full search displays grouped results in the workspace; closing returns to the same mounted work. Results can open in a separate named tab. The explicitly selected original layout retains its own search controls.
11. **One shared menu at a time.** Old app-launcher entry points now open the modern launcher. Search suggestions, bookmarks/groups and the launcher dismiss one another. Browser navigation, tab selection and return navigation dismiss stale search. Quick Add remains visible from full search and covers the phone viewport, with its own keyboard dismissal.
12. **Clipped phone panels.** Create's assignment selectors and Email's compose context no longer force grid columns beyond the available screen width. Controls and descriptions remain reachable within their panels.
13. **Repeated empty-state copy.** Removed the second copy of the Today “Nothing due today” message.
14. **Predictable search.** Enter searches all information; a suggestion opens only after the user selects it with the arrow keys or clicks it. Clearing search also clears that tab’s remembered query.
15. **No silent tab replacement.** At the ten-tab limit, new-tab actions stop and explain how to continue. Search results remain usable in the current tab. The lower-level tab model also refuses overflow, covering original-layout and bookmark entry points. Malformed saved selection indexes and duplicate tab identities no longer break the strip.
16. **Reopen closed tabs.** The bookmarks/groups menu now restores the most recently closed tab, with Alt+Shift+T as a shortcut. It restores the original tab identity, destination, query and position. Up to ten recently closed tabs are remembered for the current visit; closed-tab history is cleared on reload. This restores saved destinations and existing per-tab view preferences, not unpersisted editor undo history or live call connections. Shortcuts defer to active editors and modal dialogs.
17. **Specific study and call destinations.** Tab destinations now retain a study guide’s open unit and a call room’s code. Switching between two study tabs returns each to its selected unit. Opening a saved call destination does not automatically grant microphone/camera permission or join a call.
18. **Reachable mobile tab controls.** Selecting a tab now scrolls its entire tab into view, including its close button. The tab row also readjusts on resize and group changes. Disabled search-result new-tab buttons are visibly dimmed.
19. **Calendar keyboard continuity.** Page Up/Down keeps selection and keyboard focus on the same day in the adjacent month, clamping to the last day of a shorter month. Year boundaries and Back to today were checked. Timed assignments in day/week grids are announced as “Deadline” rather than “Class”.

## Interaction checks

| Workflow | Check and result |
| --- | --- |
| All app destinations | 60/60 rendered meaningful page content, without application error screens or console warnings/errors during the final sweep. This checks loading, not every action on each screen. |
| Separate app tabs | A saved document and spreadsheet retained their content when switched and reloaded. |
| Spreadsheet calculations | A1=12, A2=8, A3=SUM(A1:A2) displayed 20 after blur and after reload. |
| Bookmarks/groups | Created a named group, reloaded it, reopened a saved file bookmark in another tab, and verified its destination/title. |
| Registration | Imported a two-section test catalog, added both sections to the cart, saw 6 credits and one Wednesday overlap, saved an alternative schedule, reloaded and reopened it. No enrollment occurred. |
| Meal planner | 10 meals/week × 14 weeks at $1,400 produced 140 meals, $10/meal and $100/week. Inputs/results persisted after reload. |
| Housing | Saved a residence preference and checklist item, reloaded, and verified both remained. No application was sent. |
| Shared navigation and overlays | Checked all 60 registered screens at desktop width for one modern tab row, no legacy tab rows and no unexpected dialogs. At 390 × 844, opened full search and the app launcher on all 60 screens: exactly one results view/search field, followed by one launcher within viewport bounds. No central-bar overlay or legacy tab row appeared. |
| Internal panel widths | Checked all 60 screens at 390, 768 and 1280 pixels. Found clipped Create and Email panels on phones, fixed them, then repeated the complete panel check with no remaining overflow in the main workspace containers. This is not exhaustive testing of every dialog, editor state or user content size. |
| Home and bookmark menus | Visually checked the home launcher and bookmarks/groups at phone width; the central search was suppressed and only the requested panel remained open. |
| Search/tab regression coverage | Original overlap tests plus new recovery and interaction tests cover Enter vs. explicit suggestions, limit guards, closed-tab identity/order, remembered-query clearing, shortcut deferral, saved-index/identity validation and independent study units. |
| Final desktop and responsive pass | All 60 destinations checked again at 1280, 768 and 390 pixels. No page-level overflow, duplicate legacy tab bars or off-screen main workspace panels were found in the tested states. Search results and launcher transitions were repeated across all 60 destinations at phone width. |
| Full tab bar on a phone | Filled ten app tabs, verified result new-tab actions were disabled with an explanation, switched through all ten tabs and verified every active close button lay within the visible tab row. |
| Calendar keyboard | Browser check moved from September 15 to October 15 with selection and focus together. Automated mounted-component tests checked January 31 → February 28, subsequent keyboard movement, a year boundary, and Back to today. |
| Clean reload | Development hot updates briefly produced context/dependency warnings while source was being edited. A clean reload followed by all 60 routes produced no console warnings/errors or application error screens. |
| Maps | Loaded the map/directions workspace successfully in the fresh local development session. The earlier guide's failed map-module capture did not recur; this is not a live routing/traffic provider certification. |
| Backup UI | Verified expanded core and additional-workspace export/restore controls are present. |
| Backup data | Automated round trip through the actual core export, reader and reducer retained authored files and formulas. Additional-workspace tests covered account scoping, malformed records, duplicate/unknown keys and rollback on simulated quota failure. |
| Storage failures | Automated component/hook checks preserved malformed portal records, loaded separate term preferences, handled removal/recovery events and retried after quota failure. |
| University gateway | Existing controlled-identity tests and type checks passed. Production adapter registry remains empty. |

## Highest-value next improvements

1. **Measure import trust.** Validate extraction and corrections against a representative set of real, authorized syllabi. Record missed/incorrect dates and source-reference accuracy before widening a pilot.
2. **Complete the first connected workflow.** With approved school access, connect a narrow course/material/deadline workflow end to end, including sync status, conflicts, receipts and recovery. Use the existing adapter boundary.
3. **Prove reminder delivery and backup recovery.** Configure delivery services and test across supported devices/timezones. Include repeatable restore drills covering attachments and additional workspaces.
4. **Finish role and consent enforcement.** Complete faculty/advisor operations and durable family authorization before enabling those live accounts. Local role or permission plans must not become authorization.
5. **Measure loading and accessibility.** Profile the large JavaScript bundles on a typical student phone, address the highest-impact loading costs, and perform keyboard/screen-reader/high-zoom testing with real workflows. Existing lint advisories and bundle-size warnings remain documented work.

These are remaining development or validation priorities, not newly delivered capabilities. The detailed implementation status below separates local preparation tools from live institutional workflows.

## What is still missing

### Requires approved connections and operational validation

- Live LMS rosters, materials and authoritative assignments/grades; official submissions and receipts.
- SIS course seats, holds, add/drop, waitlist and enrollment transactions; official degree rules and substitutions.
- University inbox/thread/attachment synchronization and delegated sending.
- Authoritative billing/aid and hosted payment processing.
- Live housing inventory/applications, dining balances/purchases, library/mail/transport/health/safety services and confirmed appointments.
- Deployed institution SSO/provisioning, configured AI service, reminder delivery credentials and verified background/email delivery.

The user has not yet obtained approved university API access. Existing preparation screens must remain clearly labeled until real adapters, permissions and sandbox/production acceptance tests are complete.

### Requires further implementation, even before a live connection

- Full faculty authoring, assessment attempts, gradebook/publication, moderated discussions and multi-step approvals.
- Full official exam lifecycle, accommodations/timing/proctoring rules and grade return.
- Family invitation/acceptance, durable server consent storage and enforcement on every family endpoint.
- Advanced adaptive study diagnostics/readiness, synchronized lecture transcription, coding sandboxes, offline progress reconciliation and source-conflict handling.
- Full Office/Canva/video-editor parity, broad import fidelity, advanced media rendering and real-time collaboration.
- Institution administration, migration/rollback tooling, analytics and pilot outcome measurement.
- Formal accessibility and assistive-technology testing, security review, deployment operations, privacy/retention policies and support procedures.

The detailed requirements comparison remains in IMPLEMENTATION_STATUS.md. A local checklist or draft does not implement an official institutional workflow. The earlier Screen and Implementation Guide is a visual reference; this audit supersedes its backup-coverage and map-load findings.

## Deployment and handoff

Changes are in the local source. No public deployment was performed. Existing data keys were preserved. Keep using the same origin: localhost and 127.0.0.1 have separate browser data. Preserve attachments and account backups when moving to another device or origin.

The earlier split source ZIP remains unchanged and does not contain these audit fixes. Any newly supplied audited source archive is a separate snapshot. Do not replace a deployed app solely from passing tests; complete the pending integration, accessibility and operational work relevant to the intended deployment.

## Screen inventory checked

- **Family** — `#/family`
- **Pathway** — `#/pathway`
- **Create** — `#/create`
- **Athletics** — `#/athletics`
- **Career** — `#/career`
- **University** — `#/university`
- **Today** — `#/home`
- **Reports** — `#/brief`
- **Courses** — `#/courses`
- **The degree** — `#/degree`
- **Calendar** — `#/calendar`
- **Study** — `#/study`
- **Where courses meet** — `#/meet`
- **AI Tutor** — `#/ask`
- **Assignments** — `#/work`
- **Add a reading** — `#/update`
- **Analyse data** — `#/analyse`
- **Graphs & diagrams** — `#/draw`
- **Work the problem** — `#/solve`
- **Practice paper** — `#/exam`
- **Make a deck** — `#/deck`
- **Write a document** — `#/write`
- **Sheet or table** — `#/sheet`
- **Equations** — `#/equations`
- **Sources** — `#/sources`
- **Draft it** — `#/essay`
- **Add a course** — `#/import`
- **Edit the course** — `#/edit`
- **Term deadlines** — `#/registrar`
- **A change to a date** — `#/announce`
- **Money** — `#/costs`
- **Video call** — `#/call`
- **Group work** — `#/groupwork`
- **Meal plan** — `#/meals`
- **Housing** — `#/housing`
- **Exam runway** — `#/runway`
- **The week ahead** — `#/ahead`
- **When you are behind** — `#/behind`
- **Getting there** — `#/maps`
- **Email** — `#/mail`
- **Registration** — `#/yes`
- **Classmates** — `#/classmates`
- **Clubs & activities** — `#/activities`
- **People and letters** — `#/people`
- **Tonight** — `#/tonight`
- **Applications** — `#/applying`
- **Check the writing** — `#/proof`
- **Timers and alarms** — `#/clocks`
- **Personal** — `#/mine`
- **Progress** — `#/me`
- **Account** — `#/account`
- **Profile** — `#/profile`
- **Links** — `#/links`
- **Connect accounts** — `#/connect`
- **Your data and how it is running** — `#/data`
- **Privacy and your rights** — `#/privacy`
- **Take it with you** — `#/export`
- **Settings** — `#/settings`
- **Alerts** — `#/notifs`
- **How this works** — `#/help`
