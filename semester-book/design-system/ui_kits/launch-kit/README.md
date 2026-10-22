# Handoff: Semester UI

## Overview
Semester is an education operating system. It gives every campus role one home on a shared education graph, connecting first to existing systems (SSO, Brightspace, SIS) and replacing them only once proven. This package holds every designed surface: 13 role onboarding flows, the student Platform, Institution OS, the Company Command Center, the planning maps, the vision deck, and the launch pieces (student quick start, welcome email, poster, teaser, data-hosting map, 3D mark, research brief).

The engineering phase plan lives separately in `handoff/education-os/` (phase prompts + `run.sh`). Build order and review gates come from that kit; this package is the visual and behavioural reference.

## About the design files
The `.dc.html` / `.html` files here are **design references built in HTML**. They are prototypes that show intended look, copy and behaviour; they are not production code. Recreate them in the target codebase (the Semester app: Next.js on Vercel, Supabase), using its existing components and patterns. The design-system bundle in `_ds/` mirrors components from the app (`SideRail`, `SystemContextBar`, `MetricTile`, `DataTable`, `SourceBadge`, `Notice`, `NextSteps`, `Choice`, `Switch`, `Button`, `TextField`, `Fields`, `DecisionTrail`, `StepStatus`, `ProvenanceChart`, `Wordmark`, `Mark`). Use the app's own versions where they exist.

Open any `.dc.html` file directly in a browser to see it run. `support.js` is the prototype runtime and is not needed in production.

## Fidelity
**High fidelity.** Colours, type, spacing, copy and interaction states are final, and the screens use real design-system tokens. Sample data is Vanderbilt pilot data and must be replaced with live data and permission checks.

## Non-negotiable product rules (enforce in code, not just UI)
- AI never reads student records until the institution switches it on, per data type. The UI shows the current state in Settings › Privacy.
- Every date, grade and answer carries a source label: **Institution verified**, **Yours**, **External**, **Estimated**, or **AI**. Never present AI or estimated values as official.
- Search results are filtered by the viewer's role and permissions before ranking, and AI answers cite sources with those labels.
- Instructors see approved accommodations, never the reason for them.
- Safety reports go to the institution, and Semester keeps no record of them.
- Marketplace apps never receive student records. Partner certification is required.
- Connections only shows users who opted into **Findable**.
- Data residency is US only: Vercel functions on iad1 and Supabase on AWS us-east-1.
- Semester never submits work or changes grades in the LMS; the Brightspace connection is read-only in phase 1.

## Screens / views
Application chrome is the same on every product surface:
- **Grid:** a `248px` SideRail (always Ink `#090a0e`), then a content column at `minmax(0,1fr)`, full viewport height.
- **Context bar:** `SystemContextBar` (44px) shows location, term and sync state.
- **Content:** scrolls inside `<main>`, `max-width: 1180px`, padding `28px 30px 64px`.
- **Page header:**
  - Eyebrow: 10.5px Barlow, uppercase, letter-spacing .08em, `--text-secondary`.
  - H1: Barlow Condensed 600, 26px, letter-spacing −.015em.
  - Optional subline: `--text-secondary`.
  - Bottom border: `1px --border-subtle`, with 20px padding below the header.
- **Two-column bodies:** `grid-template-columns: repeat(auto-fit, minmax(min(100%,420px),1fr)); gap: 32px`.
- **Metric rows:** `repeat(auto-fill, minmax(200px,1fr)); gap: 12px`.

### Onboarding (`Onboarding.dc.html` + 13 role files)
- Hub: role picker linking to each role file.
- Each role file has three parts: a sign-in screen ("Sign in with Vanderbilt", simulated SSO delay of about 1.5s), the role home, and a three-step **Finish setting up** checklist (for example, Faculty: Import Brightspace courses → Set your course AI policy → Publish office hours).
- The rail on onboarding homes is static (current item fixed); the destinations are built in Platform and Institution OS.
- Roles: Student, Faculty, TA, Advisor, Registrar, Student affairs, Finance, IT security, Support, Applicant, Guardian, Alumni, Employer.

### Semester Platform (`Semester Platform.dc.html`)
| Screen | What it does |
|---|---|
| Search | Filtered results, plus an AI-assisted answer with cited, source-labelled references |
| Study cards | Flashcards generated from course slides; flip, mark known |
| Connections | Social layer; only Findable users appear |
| Safety | One-tap emergency contacts and anonymous reporting (not recorded by Semester) |
| Accessibility | Accommodations and instructor letters (reason hidden from instructors) |
| Marketplace | Six certified apps; install never shares records |
| Developers | Sandbox API keys, webhooks, certification checklist |

### Institution OS (`Institution OS.dc.html`)
The screens are Executive, Communications, Course Studio, Registrar OS, Research and Admissions. These are operational dashboards built from MetricTile, DataTable and DecisionTrail.

### Company Command Center (`Company Command Center.dc.html`)
- **Production strip** above the context bar: `#090a0e` background, 13px text. The "Production" label is uppercase in `#94bce3`. The line reads "Vercel us-east-1 · Supabase us-east-1 · every action here is audited."
- **Overview:** six pilot blockers (HECVAT, data agreement, SSO, accessibility, insurance, incident plan), each a checkbox ticked when evidence is filed.
- **Other screens:** Tenants, Revenue, Releases (gates and feature flags; AI flags belong to the institution), Reliability (incident toggle and sync freshness), Support, Trust (control → evidence table; never write "compliant" without a document), Finance (runway calculator: cash, pilot fee, monthly cost toggles) and Localisation.

### Planning surfaces
- `Semester Master Operating Map.dc.html`: the 40 domains, each with what it replaces, its phase and its design link, plus a 35-item definition checklist. Selections persist in localStorage.
- `Education OS Domain Map.dc.html`: 15 domains filterable by phase, each with 15 gates.
- `Semester Finish Line.dc.html`: Pilot loop (18 steps), Readiness (14 domains × 21 gates), Release evidence (20 items) and Cadence. Selections persist.

### Launch pieces
- `Semester Vision Deck.dc.html`: 12 slides at 1920×1080 with speaker notes. An offline copy, `Semester Vision Deck (offline).html`, is in the project root.
- `Student Quick Start.dc.html`: printable Letter guide with three setup steps, the source-label table, privacy rules and help contacts.
- `Welcome Email.html`: send-ready, table-based, 600px wide, using email-safe fonts. Replace `[Postal address]` and confirm the `semester.app/vanderbilt` and `/preferences` URLs before sending.
- `Launch Poster.dc.html`: 1200×1600 (3:4). The dashed QR box is a placeholder for a code that points to the sign-in URL.
- `Product Teaser.dc.html` + `teaser.jsx`: 30-second loop at 1920×1080 in five scenes (Chaos, Merge, Today, Trust, Close). Public piece, so it says "your school" rather than Vanderbilt.
- `Data Hosting Map.html`: 1600×1000 map of the US drawn from real Natural Earth geometry (d3), with US-only residency notes.
- `Semester Mark 3D.html`: the three-slab mark extruded in sterling, 0.30 m tall. Exports to OBJ or GLB.
- `Research Brief.dc.html`: sourced brief covering ADA Title II, HECVAT 4, the Canvas breach, Anthology, the market and AI/FERPA.

## Interactions & behaviour
- **Rail navigation:** clicking a SideRail item swaps the `<main>` content and resets scroll to the top. The current item is highlighted.
- **Sync states:** `synced`, `syncing` and `delayed` (shown as "Connected · may be out of date"). They appear in the SystemContextBar.
- **Motion:**
  - Easing: `--ease: cubic-bezier(.22,1,.36,1)`.
  - Durations: fast 130ms, standard 180ms, slow 240ms, sheet 280ms.
  - Respect `prefers-reduced-motion`.
- **Checklists:**
  - Pilot blockers, the domain checklist and finish-line gates are local toggles in the prototype.
  - In production they need persistence and an audit trail of who ticked what, when and with which evidence.
- **Incident toggle** (Reliability): opens a notice and updates the status page. In production this is an audited action.
- **Accessibility:**
  - Target WCAG 2.2 AA.
  - Minimum hit target 44px for primary controls and 24px minimum overall.
  - Focus ring 2px with a 2px offset.
  - Every status pairs a word and a glyph, never colour alone.

## State management (production)
| State | Scope | Notes |
|---|---|---|
| Session and role | Per user | Comes from institution SSO |
| Institution AI switches | Per tenant, per data type | Read by every AI call server-side |
| Connector status per source | Per tenant | Drives sync badges |
| Source label | Per record | Stored on the graph record, not derived in the UI |
| Findable flag | Per user | Gates Connections |
| Accommodation grants | Per student | The reason field is never sent to instructor clients |
| Checklist and gate evidence | Per company/tenant | Append-only |

## Design tokens
These are the source files in `_ds/.../tokens/`. Key values:

**Colour, grounds:**
- Ink: `#090a0e` background, `#12141a` panel, `#191c23` hero, `#22262f` raise, `#eceef2` text.
- Parchment: `#f4f1ea` background, `#fbf9f4` panel, `#ffffff` hero, `#1b1a17` text.
- Chrome (rail, tab bar, console header) is always Ink. Content defaults to Parchment.

**Colour, text:**
- Secondary: `rgba(27,26,23,.68)` on Parchment, `rgba(236,238,242,.64)` on Ink.
- Links: `#416180` on light, `#b5d9fd` on dark.

**Colour, borders:** `rgba(27,26,23,.09)` subtle, `.16` default, `.34` strong.

**Colour, Semester blue:** 100 `#eef6ff` · 200 `#d6ebff` · 300 `#b5d9fd` · 400 `#94bce3` · 500 `#749dc4` · 600 `#597ea3` · 700 `#416180` · 800 `#2c455d` · 900 `#1d2d3d`.

**Colour, metals:** sterling `#d4d9e2` (bright `#f6f8fb`, deep `#9ca3b2`); brass `#d8c79a`.

**Colour, source and status** (ink on light / tint on dark):
- Official: `#2c455d` / `#b5d9fd`
- Connected: `#2d5c61` / `#9fcbcd`
- Personal: `#4a4b4f` / `#b9b9bd`
- AI: `#544a7f` / `#bcb2df`
- Pending: `#7a5310` / `#e2c27a`
- Risk: `#a3301f` / `#f0907a`
- Success: `#3e6141` / `#a9c9a3`

**Type:**
- Families:
  - Barlow for body text.
  - Barlow Condensed 600 for headings, labels and controls.
  - Cinzel for editorial display only: the wordmark, deck titles and the poster mark.
  - System mono for identifiers.
- Scale: 9 · 10 · 10.5 · 11 · 11.5 · 12 · 12.5 · 14 (control) · 16 (base) · 16.5 · 17 · 18 · 19 · 20 · 22 · 24 · 26 · 28 · 32 · 42 · 56px, all multiplied by `--text-scale`.

**Spacing:**
- Compact steps: `--sp-1…7` = 2, 4, 6, 8, 10, 12, 16px, multiplied by `--density` (1 comfortable, .86 snug, .74 tight).
- Layout grid: 8, 16, 24, 32, 40, 48, 64, 80, 96px.
- Page padding: 18px, then 20px from 760px wide, then 30px from 1100px wide.

**Radii:** 3px (controls), 6px (cards), 10px (surfaces and sheets), 999px (pill).

**Elevation:**
- On light: `0 1px 2px rgba(43,43,45,.14)`, `0 3px 10px …/.16`, `0 12px 32px …/.22`.
- On dark: lift-1/2/3, as in `effects.css`.
- Use a border first and a shadow second.

## Assets
- Fonts are in `_ds/.../fonts/` as woff2 files: Barlow 400/500/700, Barlow Condensed 400/600, Cinzel.
- The mark is three slabs on a 512 grid, with viewBox `128 65 256 382`:
  - `M128 176L204 208L204 420L128 388Z`
  - `M218 65L294 97L294 404L218 372Z`
  - `M308 147L384 179L384 447L308 415Z`
- Map geometry: Natural Earth via `world-atlas@2.0.2`, public domain.
- Icons come from the design-system bundle's icon set (`SideRail` `icon` ids).
- There's no photography. Image needs are marked as placeholders.

## Files
All design files are copied into this folder:
- **Design files:** every `.dc.html` / `.html` file listed above.
- **Prototype runtime:** `support.js`, `deck-stage.js`, `doc-page.js`, `three-d-stage.js`, `animations-v3.jsx`, `tweaks-panel.jsx`.
- **Teaser source:** `teaser.jsx`.
- **Design system:** `_ds/` (bundle, styles, tokens, fonts).
- **Screen captures:** `Screen Renders.dc.html` in the project root shows every screen, with images in `renders/`. They are not bundled here; ask for them if you want them included.
