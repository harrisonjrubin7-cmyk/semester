Semester now contains an enormous number of capabilities. The interface must not expose that complexity directly to the user. The design objective is one sentence:

> **Powerful underneath. Calm on the surface.**

A student should be able to use Semester immediately without understanding the entire product. This document is the experience half of the master specification — sections 350 to 408 — and it governs every screen the other requirement documents describe.

# Two numbering schemes, and how to cite them

**The master specification has issued §350–§408 twice, for different things.** This document holds the experience set — §350 is the UI/UX master standard, §378 is low-stimulation mode, §390 is notification priority. `docs/PLATFORM_REQUIREMENTS.md` holds the platform set, §301–535 — where §350 is university plan configuration, §378 is push permission UX, §390 is mobile swipe actions.

Neither was renumbered, because renumbering one would silently break every reference already written against it. **So a bare "§378" is ambiguous and should never be written** — cite *experience §378* or *platform §378*.

# Where this stands

Much of this was built before it was written down, because `lib/look.ts` and the audits in `npm run lint` have been arguing for it for months. The table records what is load-bearing today, checked against the code rather than remembered.

| § | Requirement | State |
| --- | --- | --- |
| 370, 374 | Semantic colour, accessible accent presets | `lib/look.ts` — `ACCENTS`, `accent()` |
| 371 | Course colour coding | `COURSE_COLOURS`, `courseColoursOf()`, `lib/tint.ts` |
| 372 | Light / dark / system | `GROUNDS`, `MATCH_DEVICE`, `resolveGround()`, `usePrefersDark()` |
| 373 | Corner style, density, background intensity | `CORNERS`, `DENSITIES`, `GROUNDS` |
| 377 | Application-wide Focus Mode | `lib/focus.ts` → `focus` look key; applied on the directory, shelves, launcher pages, by-task tiles, Today's campus surfaces and the reminder tick. No marketplace exists to hide. |
| 378 | Low-stimulation mode | `CALMS` → `calm`, with the decoration half in `styles/app.css` |
| 379 | Reduced motion | device half in `prefersLessMotion()` and CSS at five sites; app half is `CALMS` → `calm` |
| 381 | Typography scale | `SIZES`, `scaleOf()`, enforced by the style audit in `npm run lint` |
| 384 | Loading skeletons | present in 11 files |
| 388 | Toast policy | toasts in 17 files, no stated policy |
| 390 | Notification priority levels | **not built** — no `CRITICAL` / `ACTION_REQUIRED` anywhere |
| 393 | Quiet hours | `Quiet` and `inQuiet()` in `lib/notify.ts`, set in `screens/settings/Alerts.tsx` |
| 399–405 | Accessibility | contrast ramp in `lib/contrast.test.ts`, label audit in `npm run lint`, motion guard in `a11y/motion.test.ts` |

The gaps are listed as gaps on purpose. A requirements document that describes everything as done is one nobody checks against the code.

**One caution about that table, because the first draft of it was wrong.** Course colours were entered as "not built" on the strength of a search for `colourFor` and `courseColor`. Both are spellings this repository does not use: the setting is `COURSE_COLOURS`, resolved by `courseColoursOf()` and coloured by `lib/tint.ts`, and it has been there all along. A clean reading is a claim about the probe as much as about the code — so each remaining "not built" above was re-checked against the `Look` interface in `lib/look.ts`, which is where a setting has to appear if it exists at all.

# 350. Semester experience system — UI/UX master standard

The interface should feel calm, clear, fast, modern, premium, familiar, personalized, consistent, accessible, responsive, contextual and low-friction.

It must avoid: dashboard overload, excessive cards, endless menus, too many colours, excessive gradients, excessive animations, too many badges, multiple competing calls to action, information walls, tiny text, hidden critical actions, nested navigation mazes, constant popups, notification overload, and feature dumping.

# 351. Complexity should be progressive

Do not show every capability simultaneously.

```
SIMPLE DEFAULT
      ↓
CONTEXTUAL OPTIONS
      ↓
ADVANCED CONTROLS
```

An assignment card's default state is three lines and one action:

```
ECON Problem Set
Due tomorrow

[ Continue ]
```

Opening it reveals description, subtasks, files, study plan, grade weight, notes, AI and history. The dashboard does not need to show any of those controls.

# 352. Three-layer interface model

**Layer 1 — Daily.** What the user needs now: Home, Calendar, Inbox, Ask Semester.

**Layer 2 — Explore.** Things users intentionally discover: Courses, People, Organizations, Events, Campus, Career, Marketplace, Housing.

**Layer 3 — Work.** Productivity and academic tools: Assignments, Study, Documents, Drive, Projects, Degree, Registration.

Users should not have to see all three layers simultaneously.

# 353. Primary navigation

Keep primary navigation minimal. Recommended desktop:

```
SEMESTER

Home
Calendar
Discover
Workspace
Inbox

──────────────

Ask Semester

──────────────

Profile
```

Do not place twenty-five features in the primary sidebar.

# 354. Mobile navigation

Bottom navigation: Home, Calendar, Ask, Discover, Inbox. Profile and settings are reached through the avatar. Workspace is reached contextually from Home or profile, or through a customizable navigation slot.

# 355. Customizable navigation

Users may customize secondary navigation — add, remove, reorder and pin. Limit the number of visible shortcuts to prevent clutter.

# 356. Adaptive navigation

Navigation may surface frequently used features: Registration during registration season, Study and Exams during finals.

**Never unexpectedly move primary navigation items.** Adaptive suggestions appear in secondary areas only.

# 357. Universal command palette

`⌘K` reaches anything without navigating menus — a course's notes, the calendar, an organization, a new presentation, degree progress, an event, a message to somebody. This is what keeps the navigation small.

# 358. Global search and command unification

One input: *Search Semester or ask anything…* The system decides whether the user wants navigation, search, an AI answer, or an action.

- `ECON 301` → course, notes, assignments, study groups
- `Create ECON study session` → an action
- `What do I need to graduate?` → Semester AI

# 359. Home design

Home is not an analytics dashboard. Five to seven sections: Today, Next up, For you, Campus now, Recent. Avoid fifteen unrelated cards.

# 360. Home personalization

Users may show or hide sections, and reorder where practical.

# 361. Home density modes

Comfortable and Compact. Do not offer so many density settings that configuration itself becomes complicated.

# 362. Dashboard edit mode

*Customize Home* enters an edit mode for reordering, hiding, adding and resetting. Normal Home does not show configuration controls constantly.

# 363. Contextual side panel

On desktop, prefer a side panel to a page change, so context is preserved. Clicking an assignment in the calendar opens it beside the calendar, with *Open Full Assignment* available.

# 364. Mobile bottom sheets

Use bottom sheets for quick actions — event details, quick assignment, filters, share, calendar event, AI suggestions. Avoid tiny desktop-style modals on phones.

# 365. Page structure standard

Every major page follows the same hierarchy: page title, short context and primary action, primary content, secondary content, advanced options. Do not invent a different information hierarchy on every page.

# 366. Action hierarchy

One primary action, two or three secondary actions, everything else in an overflow menu. An event is *RSVP*; then *Save* and *Share*; then report, add manually to calendar, copy link.

# 367. Button standard

Primary, secondary, tertiary, destructive. Avoid five visually dominant buttons on one screen. **Destructive actions must never look like ordinary primary actions.**

# 368. Card system

Use cards only when content is conceptually grouped or interactive. Do not wrap every text block in a floating rounded rectangle. Flat list rows, grouped sections, cards, tables and timelines are all available; pick by content.

# 369. Information density

Low for Home, onboarding and AI. Medium for courses, events and organizations. High for registration, spreadsheets, admin and degree planning. A high-information tool must stay usable without making the whole application feel dense.

# 370. Colour system

Restrained colour, with meaning: primary for brand and action, success for completed, warning for attention, danger for destructive and error, info for informational. Do not use random colours for decorative cards.

# 371. Course colour coding

Courses may carry a colour, used consistently across calendar, assignment, study and course page. **Provide an accessible alternative beyond colour alone** — see 404.

# 372. User themes

Light, dark and system. Every feature must work in each. Dark mode is not a colour inversion.

# 373. Optional theme customization

Accent colour, corner style, density, sidebar style, background intensity — constrained enough that accessibility and visual consistency survive.

# 374. Accent colour

Selectable from tested, accessible presets. Do not allow arbitrary combinations that make text unreadable.

# 375. Campus theming

University name, a campus image, a small accent, a university icon. Do **not** recolour the application for each university; Semester keeps its own recognizable brand.

# 376. Custom dashboard layouts

Presets — Balanced, Academic focus, Social/campus, Minimal, Power user — as a starting point users then customize.

# 377. Focus mode

An optional application-wide mode that hides campus recommendations, marketplace, social activity and nonessential notifications, and prioritizes classes, assignments, study, calendar and documents. Useful during study periods and finals.

# 378. Low-stimulation mode

An accessibility-oriented mode that reduces motion, decorative imagery, gradients, shadows, nonessential badges and auto-updating visual elements, and increases whitespace, predictability and clear hierarchy. This benefits many users, not only those who ask for it by name.

# 379. Reduced motion

Respect `prefers-reduced-motion` **and provide an app setting.** Reduce parallax, excessive transitions, animated backgrounds, unnecessary counters and auto-moving carousels. Never make important information depend on animation.

## How 378 and 379 are built, and why they are one setting

`CALMS` in `lib/look.ts` is an ordered scale rather than two toggles:

| id | what it means |
| --- | --- |
| `device` | the default — motion follows the operating system, everything is drawn as designed |
| `still` | §379's app setting: nothing slides, glides or sweeps, whatever the device says |
| `calm` | §378: that, plus less decoration — no shadows, no gradients |

Two independent toggles would make four states, one of which is incoherent: low stimulation with motion left on is not a thing anybody wants. Making `calm` contain `still` also answers §373, which asks that customization stay constrained enough to keep the result consistent.

The setting reaches the interface twice, because neither half can do the other's job:

- **`styles/app.css`** selects on `:root[data-calm='…']` and flattens animations, transitions and — for `calm` — shadows and gradients.
- **`lib/prefers.ts`** reads the same attribute with `getAttribute`, because `scrollKindly` is called from plain functions with no hooks in scope, and a stylesheet cannot reach a scroll the app performs in script.

`App.tsx` writes the attribute alongside the rest of the look. The app setting only ever *adds* stillness: a device that asks for reduced motion is honoured no matter what is stored here, and an attribute that has not been written yet means "defer to the device" rather than "reduce" — a server render must not silently override somebody's operating system in either direction.

`a11y/calm.test.ts` guards both halves, and two of its tests exist only as controls: a `prefersLessMotion` that had simply started returning `true` would satisfy the happy path while stopping every animation in the app for everybody, which is the failure that looks most like success.

# 380. Motion design

Animation explains — a panel opening, an item saving, a reorder, a navigation. Not decoration. Animations are quick and interruptible.

# 381. Typography

A strict scale: display, page title, section title, card title, body, secondary, caption. Avoid dozens of font sizes. Body text stays comfortably readable.

# 382. Writing style

Simple copy. Not *Your academic productivity optimization workflow has been successfully initialized* but *Study plan created.*

Translate university bureaucracy where Semester can: *Change your major*, with the official *Undergraduate Academic Program Modification Request* underneath.

# 383. Empty states

Never a blank screen. An empty state says what belongs here, why it matters, and what the user can do:

```
No study sessions yet.

Plan your first session around an upcoming assignment.

[Plan Study Session]
```

# 384. Loading states

Skeletons where the structure is known; avoid full-page spinners. **Do not fake loaded data.**

# 385. Optimistic UI

Optimistic updates for safe reversible actions — save, follow, mark complete — with rollback on failure. **Never** for payment, registration or submission.

# 386. Error design

An error says what happened, whether data was saved, and what the user can do. Not *Error 500* but *We couldn't save this assignment. Your changes are still on this screen. Try again.* Provide retry.

# 387. Offline and connection states

Campus Wi-Fi is unstable. Say so plainly, and only promise offline editing where it is actually implemented.

# 388. Toast and alert policy

Not a toast for every action. Small confirmations for saved, copied, followed. Persistent alerts for sync failure, payment issue, registration failure, security issue.

# 389. Notification design

Group repeated events. *Alex, Maya and 2 others joined your study group*, not four lines.

# 390. Notification priority

`CRITICAL`, `ACTION_REQUIRED`, `IMPORTANT`, `NORMAL`, `LOW`. **Do not use CRITICAL for marketing or engagement.**

# 391. Notification control

Per category — academic, messages, organizations, events, career, marketplace, university — the user picks in-app, push, email, digest or off. Essential security and system communications may remain mandatory.

# 392. Smart notification bundling

Bundle nonurgent notifications: *5 new organization updates*, not five interruptions.

# 393. Quiet hours

A nightly window, default 11:00 PM – 8:00 AM. Urgent official campus alerts may follow separate institutional rules where legitimately integrated.

# 394. Onboarding design

Not a twenty-screen questionnaire. Required: university, role, name, graduation year, major. Then, gradually: add your courses, choose interests, connect calendar. Allow skip.

# 395. Onboarding progress

If multi-step, say *Step 2 of 4*. Avoid vague endless onboarding.

# 396. Personalization without setup fatigue

Infer safe preferences from behaviour where appropriate — *Pin Degree Tracker to your shortcuts?* — but **do not automatically rearrange navigation.**

# 397. First-run experiences

Each complex feature gets a lightweight first-run explanation, not a tour of the whole app.

# 398. Contextual education

Teach a feature at the moment it becomes useful. When a user creates their first exam: *Semester can build a study plan around this exam.* That beats explaining the study planner during onboarding.

# 399. Accessibility standard

Target WCAG 2.2 AA. Audit contrast, keyboard navigation, focus order, screen readers, forms, dialogs, tables, charts, drag-and-drop alternatives, motion, touch targets and error messaging. **Accessibility is a release requirement**, not a later pass.

# 400. Keyboard accessibility

Every major workflow works without a mouse: logical tab order, visible focus, Enter and Space activation, Escape closing dialogs, arrow-key navigation where appropriate.

# 401. Keyboard shortcuts

Optional, for power users — `⌘K` search, `C` create, `G H` home, `G C` calendar, `G I` inbox — with shortcut help. Never required.

# 402. Screen reader design

Semantic structure: `nav`, `main`, `section`, `article`, `aside`, `footer`. Meaningful labels: not *Button* but *RSVP to Finance Club networking event*.

# 403. Accessible charts

Every chart has a textual or table alternative. Never communicate important information only through a visualization.

# 404. Accessible colour

Never rely on colour alone. Add an icon, text, a pattern or a label.

# 405. Touch targets

Comfortable touch areas. Avoid tiny icons, checkboxes, menu triggers and calendar controls, especially on mobile.

# 406. Form design

Labels above inputs, helpful descriptions, inline validation, logical grouping, autofill, sensible defaults. Avoid enormous single-screen forms.

# 407. Multi-step forms

Break complex workflows — marketplace listing, organization creation, course planning — into stages: details, media, settings, review. Allow back navigation without losing data.

# 408. Autosave

Autosave notes, documents, drafts and registration plans.
