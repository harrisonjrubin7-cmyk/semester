# Semester Design System

**Semester** is the native Student Operating System for the complete educational journey — one governed, accessible platform for a student's academic, personal, campus, financial, career and lifelong life, plus the institutional workspaces (faculty, advisor, registrar, finance, IT/security) that serve them. Surfaces include Student Today, Calendar, Tasks, Courses, Study, Write, Degree, Registration, Grades, Campus, Dining, Housing, Family, Career, Billing, Support, the AI Assistant, and the Institution Console.

The system is calm, scholarly and source-aware: near-black chrome, warm off-white content, restrained Semester blue for action and focus, and a controlled vocabulary that keeps **official, connected, personal and AI-generated** information visibly distinct.

**Status (Oct 2026):** pre-seed, founder-led, bootstrapped; first paid pilot signed with Vanderbilt University (dates not set). HECVAT Full, VPAT/ACR, SAML SSO and insurance are in progress. Large figures anywhere in this system are labelled sample data.

## Sources

- **Codebase (ground truth):** https://github.com/harrisonjrubin7-cmyk/semester (branch `main`). Key files read: `DESIGN-SYSTEM-GUIDE.md`, `docs/COLOR-AND-DARK-MODE-SPEC.md`, `app/src/styles/{tokens,typefaces,industry,unity}.css`, `app/src/lib/{look,status,source}.ts`, `app/src/components/{Brand,Icons,icons.data,mark.data,SourceBadge,StatusNotice,StartToday}.tsx`, `app/src/components/unity/*`, `app/src/components/console/*`. Also read: `docs/BRAND-PLATFORM.md` (voice, naming, Source Line), `enrollment/StudentRegistration.tsx`, `gradebook/StudentGrades.tsx`, `AdvisorMeeting.tsx`. Explore the repo further — especially `docs/design/`, `company-site/` and `app/src/components/` — to build closer to the real product.
- **Uploads:** `uploads/download-1.png` (lit silver logo mark on Ink), `uploads/Semester build Architecture.pdf`, `uploads/audit [...].pdf/.md` (repo audit).
- **Brief:** the user's written design direction (source-status hues, Semester blue, warm off-white content). Where it diverges from the code it is noted below.

### Reconciling brief and code
The app's own rule is "one colour for attention, the rest in words and glyphs", with a sterling/brass metal accent. The brief asks for a Semester blue action colour and distinct source hues. This system **keeps the code's grounds, type, radii, motion, glyph+word status vocabulary and contrast floors**, and **adopts the brief's palette** using hues pulled from the code's own measured ramps (Industry blue → Semester blue; Jade/Moss/Indigo/Old gold → teal/green/violet/amber). Every chip still carries a glyph and a word; colour is never the only carrier.

---

## CONTENT FUNDAMENTALS

From `docs/BRAND-PLATFORM.md` (draft) and in-app copy. **Personality:** a good registrar's assistant crossed with a precision instrument — exact, calm, candid, warm sparingly, self-possessed. **Public descriptor:** "the student action platform" ("Student OS" is internal only — it implies replacement). **Assistant name:** *Ask Semester* — no human name, face or persona; always labelled AI-assisted.

**The status sentence** (the unit of Semester voice): *what is true → what that means for you → what you can do.* "Your Canvas calendar hasn't updated since Tuesday. Deadlines below may have moved. Reconnect it, or check the course page."

**Prefer / avoid:** "helps you organise" not "revolutionises"; "alongside your school's systems" not "replaces / all-in-one"; "AI-assisted, source-linked" not "AI-powered / intelligent / magic"; name the control, never "secure / private / compliant / certified"; "planned / in private beta / pilot" not "launching soon"; "can / is designed to" not "guarantees / always / 100%"; "student" not "user / learner". Destinations are always Today, My Path, Search, Plan, Me.

**Consequence copy from the product:** "Confirming puts you on the waitlist, number 3 in line. You are not enrolled until a seat comes to you." · "You leave CHEM 101 and a W is recorded on your transcript. It cannot be undone here." · "Worked out by Semester from released grades only; your instructor's final grade is the one that counts." · "Only what you tick here can be shared. Nothing else — not your study history, grades, notes or anything else — ever is."


- **Voice:** plain, precise, quietly warm. Speaks to the student as **"you"**; the product never says "we" about itself in-UI ("Semester has not checked it with your institution"). First person only in the assistant's own answer ("I'd place them…").
- **Casing:** Sentence case everywhere — buttons, titles, chips ("Needs confirmation", "Sync trouble"). UPPERCASE only for tracked kickers/eyebrows and the wordmark.
- **Say what, why, who decides.** Every state explains itself: *"You are offline. You can keep working — 2 changes will sync when you are back."* Errors say what is safe: *"Your draft is safe on this device."*
- **Name the source.** "Institution verified", "Imported", "Student entered", "Estimated", "AI-assisted", "Needs review". Never "verified" unless it was.
- **Consequences before confirm:** What happens / Exactly what / What stays the same / Taking it back. *"This can be reversed on request: ask the Registrar before Oct 20."*
- **Respectful, not celebratory:** no streaks, ranks, exclamation marks or confetti. *"Registration submitted. Next: review your fall schedule."*
- **Never overclaim:** don't call Semester the official gradebook, registrar or payment system; label demo data "Sample".
- **Numbers:** tabular figures; dates as "Thu 9 Oct · 23:59"; middle dot `·` separates metadata.
- **Emoji:** never. Unicode glyphs are used as status marks: ◆ official, ○ yours, ✦ AI, ⇄ connected/conflict, ? review, ! attention, ✓ done, ⊘ offline, … working, ◌ sample.

## VISUAL FOUNDATIONS

- **Colour:** Ink (#090a0e family) for all chrome — rail, tab bar, console environment bar. Parchment (#f4f1ea / panel #fbf9f4) for content. Dark mode = Ink content via `[data-theme="dark"]` (tonal elevation: surfaces lighten as they rise). Semester blue 700 `#416180` is the one action/fill colour on light, 400 `#94bce3` on dark. Brass is an editorial accent only. Source/status hues are desaturated stones, used as ink + hairline + 8% wash — never as large fills.
- **Type:** Barlow (body 16/1.55, controls 14), Barlow Condensed 600 (headings, buttons, labels, -0.015em), Cinzel (editorial display, 42–56px, rare), system mono (IDs, timestamps). Kickers: 10.5px, 0.08em tracked caps, secondary ink. Body measure ≈ 66ch.
- **Spacing:** density-aware 2px steps `--sp-1…7` (2–16px) inside components; 8px grid `--space-*` for layout. Page padding 18 / 20 / 30 by breakpoint. 44px default targets, 24px floor in crowded composites.
- **Backgrounds:** flat grounds only. No photography backgrounds, no gradients except the brushed sterling text gradient on the wordmark/chrome text. No patterns, textures or illustrations.
- **Borders & cards:** hierarchy by hairline first (9 / 16 / 34% ink), surface step second, shadow third. Cards: 1px border, 6px radius, 16px padding, no shadow, never nested. A card groups a *decision*, not a paragraph.
- **Corners:** "Drawn" 3 / 6 / 10px (control / card / sheet). Pills only for floating bars; chips are 3px.
- **Shadows:** light — ink-tinted `0 1px 2px` / `0 3px 10px` / `0 12px 32px`; dark — `--lift-1…3`. Used for floating and modal layers only.
- **Transparency & blur:** only on the tab bar and focus bar (14px blur), always with an opaque fallback under reduced transparency, increased contrast, Low stimulation and forced colours. Scrims are 50% Ink.
- **Motion:** 130ms hover/press, 180ms state change, 240ms panel, 280ms sheet; ease `cubic-bezier(.22,1,.36,1)`. Sheets rise 8px + fade. No bounce, parallax, shimmer, spinners or looping decoration. All zeroed by `prefers-reduced-motion` and `data-calm`.
- **Hover:** a blue 8% wash on buttons/rows, hairline darkens on inputs, text steps from secondary → primary. **Press:** 14% wash or one ramp step darker on primary. No scale/shrink.
- **Focus:** 2px blue-600 outline, 2px offset; selected list rows use a 3px leading edge + weight, never colour alone.
- **Imagery:** the only brand image is the lit silver mark on Ink (cool, metallic, no grain). No stock photography or AI imagery in-product.
- **Layout:** fixed dark side rail (248px) on desktop, labelled bottom tab bar on mobile, persistent system context bar with ⌘K search on top. Operational content ≤1180px; one H1 per screen.

## ICONOGRAPHY

- The app ships its **own inline icon set** (`app/src/components/icons.data.ts`): Lucide-like, 24×24 grid, **1.5px stroke, round caps/joins, no fills** (one exception: the favourite star fills when on). 108 glyphs, copied programmatically to `assets/icons/*.svg` and to `components/icons/iconShapes.js` for the `<Icon>` component.
- Default size 19px in rows/rails, 21px in the tab bar, 15–17px inside buttons. Always `currentColor`.
- `assets/icons-sprite.svg` is the app's public sprite; logo files: `assets/logo-horizontal(-reversed).svg`, `logo-stacked(-reversed).svg`, `logo-brass.svg`, `logo-mono-black/white.svg`, `favicon.svg`, `logo-cobrand.svg` (see Brand → Logo system), `assets/logo-mark.svg` (flat, currentColor, generated from `mark.data.ts`), `assets/logo-mark-tile.svg` / `-maskable.svg` / `-512.png` (lit silver app icons), `assets/logo-mark-silver.png` (uploaded render).
- Unicode glyphs carry status (see Content). Emoji are never used. Icon-only controls always have an accessible name. If a glyph you need is missing, use the matching **Lucide** icon at stroke-width 1.5 (CDN) and flag it.

## Components

Sources in `components/<group>/Name.jsx`; each component's guide and types in `components/<Name>/README.md` + `components/<Name>/<Name>.d.ts`, styled by `components/bundle.css`. Namespace: `window.SemesterDesignSystem_e9f3ba`.

- **core:** Button, IconButton, Icon, Wordmark (+ Mark), SectionLabel, Avatar
- **forms:** TextField, Select, Segmented, Choice, Switch, Combobox, DateField, VisibilityPicker
- **trust:** SourceBadge, SourceLine, StatusChip, ProvenanceChips, AIResponse (shared `vocabulary.js`)
- **feedback:** EmptyState, LoadingState, ErrorState, SuccessState, ProgressState, StepStatus, PermissionNotice, OfflineStrip, SaveState, Notice
- **surfaces:** ObjectCard, ContextBar, NextSteps, ActionPreview, Dialog, ScreenGuide, OpenIn, QuickActions
- **overlays:** Sheet (+ SourceDetails), UndoToast, FocusBar
- **navigation:** SideRail, TabBar, SystemContextBar, CommandPalette
- **data:** DataTable, Fields, DecisionTrail, MetricTile, ProvenanceChart
- **governance:** PolicyBadge, ConsentBadge, HealthBadge, ApprovalBanner, ErrorSummary, SupportHandoff, PageHeader

**Intentional additions** (no single source file): `AIResponse` (combines the app's AI disclosure rules into one frame), `Switch`/`Choice` (the app uses native inputs in `.visibility-choice`), `SideRail` (generalises `desk/Sidebar.tsx`), `CommandPalette` (from `unity/Combobox` styling + the brief's ⌘K), `DecisionTrail` (from `unity/DecisionTrail` + console approvals), `SourceLine` (the brand platform's proposed signature device, §2.6).

## UI kits

All views follow the codebase's seven navigation areas (`app/src/lib/navareas.ts`): **Today** (what now?), **Plan** (what's coming?), **Learn** (how do I get the work done?), **Help** (who can help?), **Campus** (what's happening, where?), **Progress** (how am I doing?), **You** (settings). Every one of the 64 destinations in `app/src/screens.tsx` appears in the student App directory; 26 are fully recreated, the rest open an outline screen with their area and primary action.

- `ui_kits/student/` — Student (desktop). Today, Notifications · Calendar, Registration, Career, Billing · Courses, Grades, Study, Ask Semester, Write, Sheets, Decks · Support, Family · Campus, Maps, Mail, Community · Me, Degree, Advising · Settings (Appearance), Connect, Privacy & data · App directory.
- `ui_kits/staff/` — Faculty gradebook, TA grading queue, Advisor, Registrar desk, Finance student accounts, Student affairs support requests.
- `ui_kits/console/` — Institution console: Overview, Approvals, Support queue, Integrations, Security operations, Audit log.
- `ui_kits/external/` — Applicant, Guardian (family portal), Alumni, Employer, Marketplace partner.
- `ui_kits/mobile/` — Phone-width app on Parchment and Ink with the five-destination tab bar.

**Audience coverage:** students ✓ · applicants ✓ · faculty ✓ · TAs ✓ · advisors ✓ · registrars ✓ · finance ✓ · student affairs ✓ · IT/security ✓ · support/ops ✓ · guardians ✓ · alumni ✓ · employers ✓ · marketplace partners ✓.

## AI Workflow Router & Benchmark Lab

- `ui_kits/workflow-lab/` — interactive prototype (Internal tools card): 6-input router with forced-v0 rules, confidence, reasons, limits, escalation, prompts, GitHub plan, Supabase prompt, MD/JSON export; sortable 16-column feature matrix; 12 canonical workflows; benchmark grid with persistence tests, persistence ceiling, 0–5 grading, weighted /5 and /100 scores, leaderboard, CSV/Markdown export. Runs are saved on this device only and labelled prototype mode.
- `handoff/workflow-router-app/` — the production app source: Next.js App Router + TypeScript strict + Tailwind + Supabase (@supabase/ssr, magic link, middleware refresh), Zod, Server Actions, export route handlers, migrations `001_core_workflow_router.sql` / `002_benchmark_grading.sql` with org-scoped RLS (owner/admin/member/viewer), `seed.sql` with the 12 workflows, honest manual adapters, persistence + source-structure probes, vitest suites and an RLS test plan. Code files carry `.txt`; run `install.sh`. Not yet typechecked, linted, tested or built.

## Master control & company site

- `ui_kits/master-control/` — the hub: product front end, console & back end, business OS, company site & marketing, design system & engineering — every kit, deck, document and hand-off one click away.
- `ui_kits/company-site/` — homepage following the brand platform: hero, “status is part of the product” map (use now / pilot / later), value props, institutions, trust (status, not certifications), footer.

## Role lens

- `ui_kits/role-lens/` — every one of the 64 screens through 14 roles (student, applicant, guardian, alumni, faculty, TA, advisor, registrar, finance, student affairs, IT/security, support, employer, partner): access level (full · scoped · shared · read · audited · none), how the screen renders for that role, and its backend (sources, tables, RLS, API). Design-level model in `roles.js`; verify against migrations.

## Business workspace

- `ui_kits/business/` — gap analysis, sortable launch tracker (56 items, CSV), 90-day roadmap, pilot/contract checklist, risk register, hiring plan, fundraising readiness; `business-data.js` is the single record. `Operating Pack.html` is the printable document.
- Decks as templates: `templates/investor-deck`, `templates/institution-deck`, `templates/internal-plan-deck`.
- Inputs: `uploads/Business Master Checklist…pdf`, `uploads/now what else…pdf`, founder answers (LLC, solo, bootstrapping, signed paid pilot with DPA/FERPA, HECVAT Full, SAML SSO, VPAT, insurance; Vercel + Supabase; AI never sees student records).

## Claude Code toolkit (`handoff/claude-code-toolkit/`)

Repo-ready files that wire this system into Claude Code + Figma MCP without changing the app's architecture: two skills (`audit-semester-design-sync`, `build-semester-ui`), `.mcp.json`, `docs/FIGMA-MAPPING.md` (collections, 49 semantic + 12 primitive variables, 11 components, and this project's proposal tokens marked as *not in code*), a zero-dependency audit + report script, focused vitest proofs, and the three `design-system:*` package scripts. `PROMPTS.md` has the exact Claude Code commands. Every mapped path was checked against `app/design-tokens/semester.tokens.json`.

## Design System tab, group by group

Each group in the tab lists what it holds, where it lives, and the rule to keep.

### Foundations
- **Colors**: `guidelines/colors-*.html`, `dataviz.html`. Ink chrome, Parchment content, Semester blue 700/400, metals, source semantics on both grounds, provenance-by-pattern data viz. *Rule:* colour is never the only carrier.
- **Type**: `guidelines/type-*.html`. Barlow body, Barlow Condensed headings, Cinzel display (rare), mono for IDs. *Rule:* sentence case, 66ch measure, tabular figures.
- **Spacing**: `guidelines/spacing.html`, `archived/guidelines/radii.html`, `layout.html`, `states-interaction.html`. 2px density steps, 8px grid, corners 3/6/10, breakpoints, hover/press/focus. *Rule:* no scale or bounce on press.
- **Brand**: `components/LogoSystem/preview.html`, `components/LogoMark/preview.html`, `components/WordmarkLockup/preview.html`, `components/Iconography/preview.html`. Mark, wordmark, **logo system** (horizontal, stacked, reversed, brass, mono, favicon, co-brand lockup in `assets/logo-*.svg`), icon set. *Rule:* Semester leads in co-brand lockups, partner logo at equal cap height, never recolour the mark.

### Components (`components/<Name>/`, namespace `window.SemesterDesignSystem_e9f3ba`)
- **Actions**: Button, IconButton, QuickActions, ActionPreview. Primary = one per view, consequence copy before confirm.
- **AI**: AIResponse, ProvenanceChips. Always labelled AI-assisted, sources shown, human confirms the action.
- **Data**: DataTable, Fields, DecisionTrail, MetricTile, ProvenanceChart.
- **Forms**: TextField, Select, Segmented, Choice, Switch, Combobox, DateField, VisibilityPicker.
- **Glyph**: Icon, Mark, Wordmark. 1.5px stroke, `currentColor`, accessible names on icon-only controls.
- **Navigation**: SideRail, TabBar, SystemContextBar, CommandPalette (⌘K).
- **States**: Empty, Loading, Error, Success, Progress, StepStatus, Permission, Offline, SaveState, Notice, UndoToast.
- **Surfaces**: ObjectCard, ContextBar, NextSteps, Dialog, Sheet, FocusBar, ScreenGuide, OpenIn.
- **Trust & provenance**: SourceBadge, SourceLine, StatusChip. The official / connected / personal / AI distinction lives here.
- **Patterns** (`guidelines/pattern-*.html`): AI answer anatomy, provenance ladder, consent & sharing, consequential actions.

### Product
- **Student app**: `ui_kits/student/`. All 64 destinations across Today, Plan, Learn, Help, Campus, Progress and You, with Tweaks and live Ask Semester.
- **Mobile**: `ui_kits/mobile/`. Five-destination tab bar on Parchment and Ink.
- **Product**: `ui_kits/community/`, the community and live marketplace: feed, groups, events, Q&A, clubs and leaders, mentorship, campus marketplace with live drops, messages, privacy and safety. Campus-verified only; never touches student records.
- **Staff workspaces**: `ui_kits/staff/`. Faculty, TA, advisor, registrar, finance, student affairs.
- **Institution console**: `ui_kits/console/`. Overview, approvals, support, integrations, security, audit.
- **External audiences**: `ui_kits/external/`. Applicant, guardian, alumni, employer, marketplace partner.
- **Forms & interfaces**: `ui_kits/forms/`. 12 working forms, role capabilities, API, command and event contracts.
- **Wireframes**: `ui_kits/wireframes/`. Every screen × role in low-fi.

### Maps of the whole
- **Master control**: `ui_kits/master-control/`. The hub; every kit, deck, document and hand-off is one click away. *Rule:* every new file gets linked here.
- **Master catalog**: `ui_kits/master-catalog/`. 51 roles, 673 screens, 319 workflow steps (17 workflows), 88 systems and 82 docs, each with a status.
- **Atlas**: `ui_kits/atlas/`. Each role's features, screens and functions.
- **Maps card**: `guidelines/maps-of-the-whole.html`. **Documents card**: `guidelines/company-documents.html` (Business group). **Iconography rules**: `guidelines/iconography-rules.html` (Brand group).
- **Role lens**: `ui_kits/role-lens/`. Access level, rendering, tables, RLS and API per role × screen.

### Architecture
- **Architecture / Education OS architecture**: `ui_kits/architecture/`. OS map against legacy systems, full stack and data (20 tables), CQRS read-model pipeline, lag simulator, AI gateway, migration phases. *Rule:* the institution stays the system of record; AI never receives student records.

### Company
- **Business**: `ui_kits/business/`. Workspace (gap analysis, launch tracker, roadmap, pilot checklist, risks, hiring, fundraising), Operating Manual, Operating Pack, Market Research, Vanderbilt one-pager, invite email, campus map.
- **Operations**: `ui_kits/ops/`. 12 consoles: social media control, finance, marketing, sales and RevOps, customer success, support, trust & safety plus community and marketplace ops, legal and compliance, people, IT and security, data, partnerships. Role-gated. *Rule:* everything is labelled sample data and contains no student PII.
- **Investor**: `ui_kits/investor/`. Investor and board portal.
- **Company site**: `ui_kits/company-site/`. Home, institutions, pilot, pricing, trust, company.
- **Compliance**: `ui_kits/compliance/`. WCAG 2.2, FTC proof rules, release gate. *Rule:* state your status; never claim a certification you don't hold.
- **Product brief package**: `docs/brief/`. Index, one-pager, FAQ. Overview deck and role sheets are next.

- **Architecture cards**: `guidelines/arch-*.html` — stack layers, read-model pipeline & freshness, AI gateway, environments.

### Tooling
- **Tooling cards**: `guidelines/tooling-*.html` — Claude Code toolkit, semester-core, semester-platform, AI workflow router & benchmark lab.
- **Internal tools**: `ui_kits/workflow-lab/`, the AI workflow router and benchmark lab.
- **Tooling**: `handoff/claude-code-toolkit/`, `handoff/semester-core/`, `handoff/workflow-router-app/`. See `handoff/README.md`.

### Templates (`templates/`, entry `<Slug>.dc.html` + `ds-base.js`)
- Decks: company-deck (14 slides), investor-deck, institution-deck, internal-plan-deck.
- Screens: student-screen (rail + context bar + main/aside), console-screen (environment bar + DataTable + DecisionTrail).
- Reports: pilot results report.

## What's next
See `NEXT-SESSION.md` for the ordered backlog: render every missing screen, capability map, workflow runner, site operations, the full public site, personalization capabilities, formal documents, the rest of the brief package, and the PPTX exports.

## Index

- `styles.css` — entry; `@import`s only.
- `tokens.json` (compiled to `tokens.css`) and `components/bundle.css`; the original `tokens/` stylesheets are in `archived/tokens/`.
- `fonts/` — Barlow 400/500/700, Barlow Condensed 400/600, Cinzel (OFL).
- `assets/` — logos, app icons, `icons/` (108 SVGs), sprite.
- `guidelines/` — specimen cards (Colors, Type, Spacing, Brand, Patterns) and deep-dive docs:
  - `01-provenance-and-trust.md` — the ladder, made vs AI, where cues go
  - `02-ai-governance.md` — Ask Semester, AIResponse anatomy, course policy
  - `03-consequential-actions.md` — undo vs preview vs two-person duty
  - `04-consent-and-family.md` — default private, one decision at a time, access history
  - `05-institutional-surfaces.md` — context bars, tables, authority scope
  - `06-accessibility.md` — contrast, structure, reader settings, brand-exempt zones
  - `07-layout-and-responsive.md` — tiers, shell, page grid, destinations
  - `08-content-templates.md` — status sentence, empty/error/success, incidents, onboarding
- `components/`, `ui_kits/` — see above.
- `assets/notes/SKILL.from-standalone.md`, `github.md`, `thumbnail.html`.

**Caveats:** Atkinson Hyperlegible (the app's legibility body option) and Latin-Extended font subsets were not copied. The production app offers 13 grounds × 11 accents; only Ink and Parchment ship here.

## Where the system lives

- **Tokens:** `tokens.json` is the one source for colours, type, spacing, radii, shadows, sizes, layers, leading and tracking; `tokens.css` is generated from it. Values that are not tokens (the sterling gradient, calc type scales, density steps, motion) and the base and component styles are in `components/bundle.css`.
- **Components:** the bundle is `components/bundle.js` (namespace `window.SemesterDesignSystem_e9f3ba`); each component has `components/<Name>/README.md`, `<Name>.d.ts` and a live `preview.html`; all types together are in `components/index.d.ts`.
- **Moved aside:** the old stylesheets, the original `_ds_bundle.js`, group cards, `_ds_manifest.json` and specimen pages now covered by tokens are in `archived/`.
