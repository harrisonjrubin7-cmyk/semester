# Handoff: Permissions, queue controls and operator screens (Oct 2026 extension)

## Overview
This package covers what was added to the Semester design system in October 2026:
- **7 components:** PermissionPrompt, PermissionRow, SessionRow and DelegationRow for device capabilities and shared access; Tabs, FilterChips and SlaTimer for queues.
- **5 screen templates:** registrar console, ops inbox, Course Studio, role workspace (8 roles) and Device & privacy (mobile).
- **Screen atlas:** all 673 catalogued screens, 44 of them designed by hand, plus a spec per screen.
- **8 document/deck templates:** policy, runbook, job description, sales one-pager, release notes, case study, board update and training.

Use it to build these into the Semester app (`harrisonjrubin7-cmyk/semester`, Next.js + Supabase).

## About the design files
Everything in `design/` is a **design reference made in HTML**: prototypes that show the intended look and behaviour. They are **not production code to copy**. Rebuild them in the app's existing environment:
- React/Next.js App Router
- `app/src/styles/tokens.css`
- the components in `app/src/components/unity/*`

Map each new component to an existing primitive before writing a new one.

## Fidelity
**High fidelity.** The colours, type, spacing, radii and copy are final. The data is sample data, labelled ◌ Sample in the UI. Everything else (who can see what, permission keys, audit event names) is a design-stage spec and must be checked against the repo's `app_roles`, `app_capabilities` and `private.has_capability` before it ships.

## Components

### PermissionPrompt (`components/permissions/PermissionPrompt.jsx`)
Semester's own explanation, shown **before** the operating system's permission dialog.
- **Layout.** Card, max-width 440px, padding 18px 20px, 1px `--border-default`, radius 10px, background `--surface-base`.
  - **Head:** a 36×36 glyph tile (radius 6, 1px border), then the kicker "Semester will ask your device" (10.5px, tracking .08em, caps, `--text-secondary`), then the title "Use your {capability}?" (Barlow Condensed 600, 20px, -0.015em).
  - **Facts:** a `<dl>` with a 96px label column and four rows: Why, When, If you say no, What's kept. 14px/1.45.
  - **Actions:** primary "Continue", ghost "Not now".
- **States:**
  - `ask`: shows the buttons.
  - `granted`: green result line "✓ On. You can turn this off in Privacy › Device." (`--status-success` text, line and wash).
  - `blocked`: amber result line explaining the path through device settings.
- **Rule.** "Not now" must never block the task. Every capability has a fallback (type the ISBN, pick a building, type instead of dictating).

### PermissionRow
One row per capability: name (500, 14px), use (12.5px, secondary), optional detail, state chip, then one button.
- **States (glyph + word):** on ✓, off ○, ask ?, blocked ⊘, limited ◐.
- **Button label:** "Turn off" when on or limited, "Turn on" when off or ask, "How to change" when blocked.
- Rows are separated by a 1px `--border-subtle` bottom border, with 12px vertical padding.

### SessionRow
Shows device, place, last active and sign-in method. The current device gets a "This device" tag (official-blue hairline) and has no sign-out button.

### DelegationRow
Who, role, a list of scope chips (11px, 1px border, radius 3), state with expiry, and a red "Revoke" button.
- **States:** active ⇄, expiring ! (amber detail), expired ⊘, revoked ⊘ (row at 72% opacity), pending …
- Revoking takes effect immediately and writes an audit event.

### Tabs (`components/navigation/Tabs.jsx`)
- `role=tablist`, with a bottom border of 1px `--border-default`.
- Each tab: padding 10px 12px, 14px text, `--text-secondary`.
- Selected tab: `--text-primary`, weight 500, a 2px `--action-primary` underline overlapping the border (margin-bottom -1px).
- Optional count pill: 11px tabular figures, `--action-secondary` background.
- Use only for views of one object, never for primary navigation.

### FilterChips
- `aria-pressed` toggle buttons: 5px 10px padding, 12.5px text, 1px border, radius 3.
- Pressed: ✓ glyph, weight 500, `--action-primary` border and 8% wash.
- An optional "Clear" link appears once anything is selected.

### SlaTimer (`components/data/SlaTimer.jsx`)
A mono-width chip with tabular figures.

| State | Glyph and text | Colour |
|---|---|---|
| ok | ◷ "1 h 20 m left" | secondary |
| soon | ! | amber |
| breach | ⊘ "Overdue 2 h" | red |
| met | ✓ "Met" | green |
| paused | ‖ "Paused" (waiting on the requester) | — |

Optional "· target 4 h" suffix.

All styles live in `design/tokens/components-2.css`. Port them to the app's CSS modules or tokens file.

## Screens

Every screen template uses the same shell:
- **Rail:** 248px Ink `SideRail`, sticky. It is hidden below 900px wide.
- **Context strip:** 11px text at 64% white on `#0f1117`, showing environment, term, sync age and "◌ Sample data".
- **Main column:** max 1180px (inbox 1280px), padding 22px 20px 64px.
- **Page head:** kicker, H1 (Barlow Condensed 600, 26px, -0.015em), purpose line (14px, secondary).
- **Content grids:** `repeat(auto-fit, minmax(320px, 1fr))` so they reflow on small screens.

Every screen has the `viewState` states Ready, Loading (`LoadingState`), Empty (`EmptyState` with the reason) and Error (`ErrorState` with recovery and a reference). Every template also has a `dark` toggle that sets `data-theme="dark"` on its root.

### Registrar console (`templates/registrar-console`)
- **Tabs:** Readiness | Holds by office (736) | Overrides (3).
- **Readiness tab:**
  - Four MetricTiles: Ready 4,812 · Blocked 736 (−112 this week) · Advising not done 291 · First window Mon 2 Nov.
  - DataTable by class year: Students, Ready, Blocked, StatusChip, Window opens.
- **Holds tab:** FilterChips by office, and a table with Office, Hold, Students, Oldest and "Student sees", the exact text the student is shown.
- **Overrides tab:**
  - ApprovalBanner for the request.
  - A reason card.
  - DecisionTrail: requested → auto-check → registrar → "SIS updated by registrar team".
  - Approving records the decision only. **Semester never writes to the SIS.**

### Ops inbox (`templates/ops-inbox`)
- **Tabs:** My work | Approvals | All. Type filters: Incident, Support, Refund, Access, Report.
- **List rows:** kicker (kind · reference), SlaTimer, title, then institution · requester. Danger or pending items get a 3px left edge. The selected row gets an 8% wash.
- **Detail panel:**
  - Fields: institution, requester, capability key in mono.
  - "What happens" box: the effect, plus an undo line.
  - ApprovalBanner whenever the action needs two people.
  - Snooze and Add note buttons.
- **Two-person rule:** refunds over $50, and break-glass access (4 h maximum, never student records).
- The context strip states "Student records ⊘ No access".

### Course Studio (`templates/course-studio`)
- **Tabs:** Weeks | Assignments | Gradebook.
- **Weeks tab:** week cards listing items, each with a glyph (◆ published, ○ draft, ? needs work), plus a "Student preview" aside.
- **Assignments tab:**
  - Rubric table.
  - Ask Semester rule box (AI violet wash), taken from the `aiRule` prop: Off, Explain only, or Feedback on drafts. Course rules can only be stricter than the institution's.
  - Accessibility issue box (amber).
  - Publish button, disabled while an issue is open.
- **Gradebook tab:**
  - Table of scores.
  - Release card: before release, "209 students see their score and rubric. 3 without a grade are held back…". After release: "✓ Released · receipt REL-5521", with Brightspace still the official gradebook.

### Role workspace (`templates/role-workspace`, `role` prop)
- **Roles:** Advisor, Financial aid, IT admin, Family member, Student affairs, Career services, Executive, Implementation.
- **Layout:**
  - "Start here" card with the role's first meaningful action and one primary button.
  - MetricTiles, each with a source mapped to the vocabulary: SIS, Bursar, Aid system, Contract and Console are official; Calendar, Monitor, IdP, Help desk and Employer portal are connected; Semester is estimated; Plan is personal.
  - Work queue with SlaTimers.
  - "You can" list with capability keys.
  - Dashed "⊘ Not visible to this role" box.
- **Executive** sees aggregates only, and groups under 10 are hidden.

### Device & privacy, mobile (`templates/device-privacy-mobile`)
- 390×800 phone frame with the five-destination TabBar (Today, My Path, Search, Plan, Me).
- **Sections:** This device (4 PermissionRows), Signed in (SessionRows), Shared with people (DelegationRows).
- Turning a capability on opens a bottom sheet over a 50% Ink scrim with the PermissionPrompt. Allow shows the granted state, then a "Done" button.
- With `micBlocked` on, the Microphone row shows "Blocked on device" and the sheet explains how to change it in device settings.

### Screen atlas (`ui_kits/screen-atlas`)
- **Hash routes:** `#screens/<group>/<index>`, `#roles/<name>`, `#caps`.
- **Every screen** renders in six states (default, loading, empty, error, forbidden, offline) followed by a spec: purpose, route, archetype, capability keys (read/write/approve), audit events, roles with access level (◆ full · ◐ scoped · ⇄ shared · ○ read · ! audited), workflow steps that use it, AI rule and systems.
- **Hand-designed screens:** 44 entries, in `bespoke.jsx` and `bespoke-2.jsx`. Build these first.
- The capability keys reuse the names in `ui_kits/native-platform/native-data.js` where screen names match; the rest follow `domain.screen.action`. **Reconcile them with the `app_capabilities` table.**

## Interactions and behaviour
- **Motion:** 130ms hover, 180ms state change, 240ms panel, 280ms sheet; easing `cubic-bezier(.22,1,.36,1)`. No scale on press. All motion is zeroed under `prefers-reduced-motion`.
- **Focus:** 2px `--action-primary` outline with a 2px offset; tabs use -2px.
- **Before any consequential action**, show an `ActionPreview`: what happens, exactly what, what doesn't change, and how to take it back. High-impact actions (approve, release, refund, override, kill switch) need a second person.
- **Copy:** sentence case, "you", no exclamation marks, no emoji. Status is always glyph + word.

## State
- **Registrar:** `tab`, `offices[]`, `approval`.
- **Inbox:** `tab`, `types[]`, `sel`, `decided{ref: approved | rejected}`.
- **Course Studio:** `tab`, `released`.
- **Device & privacy:** `caps{}`, `ask`, `askState`, `signedOut[]`, `revoked[]`.
- **Server side, these need data and endpoints:**
  - read models for readiness, holds and caseload
  - the `ctl.*` controlled-action functions (request, decide, execute, with a receipt)
  - device sessions and delegations (migration 120 in `handoff/semester-platform` is reference only; the repo's own migrations win)

## Design tokens (light; dark in `[data-theme="dark"]`)
- **Grounds:**
  - Ink: `#090a0e` bg, `#12141a` panel, `#191c23` hero, `#eceef2` fg
  - Parchment: `#f4f1ea` bg, `#fbf9f4` panel, `#ffffff` hero, `#1b1a17` fg
- **Action (Semester blue):**
  - Light: `--blue-700 #416180`, hover `#2c455d`, press `#1d2d3d`
  - Dark: `--blue-400 #94bce3`
  - Secondary wash: `rgba(65,97,128,.08)`
- **Text:** secondary `rgba(27,26,23,.68)`, tertiary `.52`.
- **Borders:** subtle `.09`, default `.16`, strong `.34` (ink alpha).
- **Source inks:**
  - official `#2c455d`
  - connected `#2d5c61`
  - personal `#4a4b4f`
  - AI `#544a7f`
  - pending `#7a5310`
  - risk `#a3301f`
  - success `#3e6141`
  - Each also has a `-line` (≈45% alpha) and a `-wash` (8–12% alpha).
- **Type:**
  - Barlow 400/500/700 for body (16/1.55) and controls (14)
  - Barlow Condensed 600 for headings, -0.015em
  - Cinzel for rare display
  - Kicker: 10.5px, .08em, caps
- **Radii:** 3 (control), 6 (card), 10 (sheet), 999 (floating bars only).
- **Spacing:** `--sp-1…7` = 2–16px; 8px layout grid; page padding 18/20/30.
- **Shadows:** floating and modal only: `0 1px 2px`, `0 3px 10px`, `0 12px 32px`, all ink-tinted.

## Assets
- `design/assets/logo-*.svg`: the wordmark is now **outlined to paths** (Barlow Condensed Bold), so no font is needed.
- Icons: `components/icons/iconShapes.js` (108 icons, 24×24 grid, 1.5px stroke, currentColor). There is no plain phone icon; `call` draws a video camera.

## Screenshots
`screenshots/`: registrar-console, ops-inbox, course-studio, device-privacy-mobile, atlas-student-today, atlas-registrar-overrides, atlas-role-advisor, atlas-capabilities, ecosystem-map, ecosystem-registration. Captured at 924px wide (the narrow layout); render the HTML to see the wide layout. Captures may use a fallback font; the real fonts are Barlow and Barlow Condensed.

## Files
Source files carry a `.txt` suffix so the design-system compiler ignores them; strip it when reading.

- `design/components/` — permissions/*, navigation/Tabs + FilterChips, data/SlaTimer (`.jsx`, `.d.ts`, `.prompt.md`)
- `design/tokens/components-2.css`
- `design/templates/` — registrar-console, ops-inbox, course-studio, role-workspace, device-privacy-mobile (`.dc.html`; open in a browser from the design-system project, or read the markup and logic class)
- `design/screen-atlas/` — `ScreenAtlas.jsx`, `bespoke.jsx`, `bespoke-2.jsx`, `atlas-data.js`
- Full design system: `readme.md` and `SKILL.md` at the design-system root.
