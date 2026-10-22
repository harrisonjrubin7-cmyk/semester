## Executive summary

Semester describes itself as the native Student Operating System for the whole educational journey: one governed, accessible platform for a student's academic, personal, campus, financial and career life, plus the institutional workspaces (faculty, advisor, registrar, finance, IT and security) that serve them. The design system in this book is the set of rules, tokens, components and patterns that make those surfaces look and behave like one product. Its character is calm, scholarly and source-aware: near-black chrome, warm off-white content, a restrained Semester blue reserved for action and focus, and a controlled vocabulary that keeps official, connected, personal and AI-generated information visibly distinct.

The company is early. The README gives its status as of October 2026: pre-seed, founder-led and bootstrapped, with a first paid pilot signed with Vanderbilt University (dates not set). HECVAT Full, a VPAT/ACR, SAML single sign-on and insurance are in progress, and large figures anywhere in the system are labelled sample data. Read the book with that in mind. Much of it is a design-level specification and hand-off package, not a record of shipped and tested software, and the sources say so repeatedly.

A few principles recur in every document. Name the source of every fact and rank sources honestly. Never let colour carry meaning alone; every status has a glyph and a word. Say what an action will do before it does it, with a way back. Default to private and ask for consent one decision at a time. Keep the institution as system of record and keep student records away from any AI model. Be respectful rather than celebratory: no streaks, ranks or confetti. These rules are written into tokens, components and checks rather than left to taste.

The system is concrete. One `tokens.json` holds 112 colour tokens plus spacing, radius, shadow, size, layer, leading and tracking tokens, with twelve type roles on three typefaces. It ships 56 documented components (57 exports counting Mark), a 108-glyph icon set, logo files, 33 specimen cards, eight written guidelines and 28 UI kits. The student app covers 64 destinations in seven navigation areas, with five canonical destinations: Today, My Path, Search, Plan and Me.

The design system is subordinate to the real codebase. The README names `harrisonjrubin7-cmyk/semester` (branch `main`) as ground truth, and the build documents repeat "repo beats design": extend what exists and record whether each item was found, extended or new. The app's token pipeline runs from `lib/look.ts` to `styles/tokens.css` to `lib/tokenexport.ts` to a generated `semester.tokens.json`, and a Claude Code toolkit checks the design project against it. The documents list the differences. The main one is palette: the app's rule is "one colour for attention, the rest in words and glyphs", while the founder's brief asked for Semester blue and distinct source hues. The system keeps the code's grounds, type, radii, motion and contrast floors, adopts the brief's palette, and treats the source hues as a proposal not yet in code.

Architecturally the product has three tiers: an experience platform, an education intelligence platform and an institutional infrastructure platform. Underneath is Postgres with row-level security and a tenant identifier on every row. The browser calls only server-side `api.*` functions, writes pass through audited commands and an outbox into read models stamped with version and freshness, and one AI gateway checks scope and policy, blocks student records, labels answers AI-assisted and logs evidence.

It is built through `handoff/BUILD.md`, a single entry point telling Claude Code or Codex to work one branch and one pull request per stream, from stream 00 (repository audit) to stream 13 (platform maturity). The package supplies nine pure-TypeScript decision modules, a database and API package with eight migrations, a Next.js reference app and a Figma toolkit, plus a playbook, QA plan and accessibility plan. It is candid that the platform code has not been run, typechecked or tested. The closing chapter records the backlog and one open decision: whether the palette moves toward the indigo, emerald, amber and rose proposed in an outside brief.

## The system in numbers

| Fact | Value | Source |
| --- | --- | --- |
| Colour tokens | 112 total | tokens.json |
| Colour tokens by family | source semantics 12; status semantics 10; status primitives 14; blue ramp 9; neutral ramp 9; Ink 6; Parchment 6; Graphite 3; surfaces 6; text 6; chrome 6; brand 6; action 5; sterling 4; brass 4; borders 3; focus, accent, scrim 3 | tokens.json |
| Themes | 2 (Parchment light, Ink dark) | tokens.json |
| Grounds and accents in the app | 13 grounds, 11 accents; this project ships Ink and Parchment | README; colors cards |
| Typefaces | Barlow, Barlow Condensed, Cinzel, system mono | tokens.json |
| Font files | 6 | tokens.json; fonts/ |
| Type roles and scale | 12 roles; 14-step scale from 28px to 10.5px | tokens.json; type-scale card |
| Line-height and tracking tokens | 12 and 4 | tokens.json |
| Layout spacing tokens | 11 (8px grid plus padding) | tokens.json |
| Density steps | 7 (2, 4, 6, 8, 10, 12, 16px) at 3 densities (1, 0.86, 0.74) | spacing card; guideline 06 |
| Radius, shadow, size, layer tokens | 4, 6, 11 and 8 | tokens.json |
| Breakpoints | 3 tiers: under 760px, 760 to 1099px, 1100px and up | guideline 07 |
| Page padding | 18, 20 and 30px by tier | guideline 07 |
| Motion durations | 130, 180, 240 and 280ms | motion card |
| Components | 56 documented, 57 exports with Mark | components/; index.d.ts |
| Components by group | Actions 4; AI 2; Data 5; Forms 8; Glyph 3; Navigation 4; States 11; Surfaces 8; Trust 3; Governance 7; core primitives 2 | README |
| Icons | 108 glyphs, 1.5px stroke, 24px grid | README |
| StatusChip keys; SourceBadge sources | 21; 10 | component READMEs; index.d.ts |
| Provenance ladder | 6 rungs plus 4 display-only kinds | guideline 01 |
| Specimen cards; guideline documents | 33; 8 | guidelines/ |
| UI kits; templates | 28 folders; 21 folders | ui_kits/; templates/ |
| Student app | 64 screens, 26 fully recreated, 7 areas, 5 destinations | README |
| Master catalog | 51 roles, 673 screens, 319 workflow steps (17 workflows), 88 systems, 82 documents | README |
| Architecture | 3 tiers; 20 tables; 15 API domains; 10 API checks; 5 freshness states; 5 ADRs | architecture docs |
| Migrations; core modules | 8 (010 to 080); 9 | BUILD.md; semester-core README |
| Security findings fixed in 050 | 11 | semester-platform README |
| Execution streams | 14 (00 to 13) | execute/00-INDEX.md |
| CI jobs that block merge | 7 | Engineering Playbook |
| QA role journeys; severities | 14; 4 | QA Test Plan |
| Assistive technologies tested | 5 | Accessibility Test Plan |
| Figma mapping | 7 collections, 48 semantic rows, 12 primitive rows, 11 components | FIGMA-MAPPING.md |
| Toolkit skills; router workflows | 3; 12 | toolkit and router READMEs |

The sources disagree in a few places. Components number 56 in the README, 57 in NEXT-SESSION and 64 in BUILD.md; this book uses 56 documented and 57 exported. The Figma README says 49 semantic variables but the table has 48 rows. Role counts are 51 in the catalog, 49 in the role-pages note, and the Role lens covers 14 roles in the README but 22 in NEXT-SESSION. The execute index says "12 stream prompts" but lists 00 to 13. The front end is Vite and React in the playbook, baseline and explorer, but the Architecture Guide says Next.js; BUILD.md reconciles this with a separate `web/` Next.js project if `app/` is Vite. Environments number three in the architecture card and four in the guide.

## Design principles

**1. Name the source and rank it honestly.** Facts show their origin in a controlled vocabulary. Stale ranks below "yours" on purpose, because an unchecked copy of something that may have moved is worth less than a guess that knows it is a guess. Example: a deadline shows a SourceBadge "Official", naming the Registrar and "Updated 2h ago".

**2. Colour is never the only carrier.** Every state is glyph, word and tone. Hues are desaturated stones used as ink, hairline and an 8 percent wash. Example: forced-colours mode thickens the solid provenance chip's border to 3px.

**3. Say what will happen first.** Consequences appear before confirm: what happens, exactly what, what stays, how to take it back. Example: "You leave CHEM 101 and a W is recorded on your transcript. It cannot be undone here."

**4. The institution stays the system of record.** Semester never calls itself the official gradebook, registrar or payment system. Example: "Semester does not process the payment; TouchNet does."

**5. Student records never reach an AI model.** Enforced in the gateway, not by convention. Example: the QA plan tests that a question containing a student ID is blocked, logged and answered with a friendly message.

**6. Default private, one decision at a time.** Decline has equal weight to accept. Example: "Only what you tick here can be shared."

**7. Respectful, not celebratory.** No streaks, ranks, confetti or personas. Example: "Registration submitted. Next: review your fall schedule."

**8. Border first, shadow second.** Hierarchy is hairline, then surface step, then shadow. Example: cards have a 1px border, 6px radius, no shadow, and are never nested.

**9. Design all seven states.** Loading, empty, partial or stale, offline, error, permission and success. Example: "Your draft is safe on this device."

**10. One primary action per decision region.** Example: PageHeader allows a kicker, one H1, one line of purpose, a source badge and at most one primary button.

**11. Disclose in three layers.** Immediate decision, explanation and action, then advanced detail. Example: "Your registration opens Tuesday at 8:00 AM. You have one hold." is layer 1.

**12. Reuse; do not invent.** Modules may not invent colours, spacing, status words or source labels. Example: states come from `SOURCES` and `STATUSES` in `components/trust/vocabulary.js`, never hand-typed.

**13. Status, not claims.** Never claim a certification not held. Example: "working toward WCAG 2.2 AA; ACR in preparation", and roadmap items carry "Planned", "Pilot" or "Preview" chips.
## Foundations explained

**Colour: grounds.** Ink is the near-black family (`ink-bg` #090a0e, `ink-panel` #12141a, `ink-raise` #22262f, text #eceef2). Parchment is the warm off-white family (`parchment-bg` #f4f1ea, panel #fbf9f4, text #1b1a17). Content defaults to Parchment and flips to Ink under `[data-theme="dark"]` with tonal elevation, so surfaces lighten as they rise. Chrome (rail, tab bar, console bar) is always Ink. The production app offers 13 grounds and 11 accents (Sterling, Brass, Copper, Jade, Slate, Pewter, Industry, Oxblood, Moss, Indigo, Old gold); this project ships Ink and Parchment. Accents identify courses and action and never encode success or error.

**Colour: roles and hues.** Six surface, six text and three border tokens map onto the ramps; borders are hairlines at about 9, 16 and 34 percent ink on light. Action is Semester blue: blue 700 (#416180) on light and blue 400 (#94bce3) on dark, with hover and press one or two ramp steps away and a blue-600 focus ring on light. Four source states each have ink, line and wash tokens: official (#2c455d on light, #b5d9fd on dark), connected (#2d5c61, #9fcbcd), personal (#4a4b4f, #b9b9bd) and AI (#544a7f, #bcb2df). Status hues are pending (#7a5310, #e2c27a), danger (#a3301f, #f0907a) and success (#3e6141, #a9c9a3). Lines run about 40 to 50 percent alpha and washes 6 to 12. Sterling is for the mark and chrome highlights (a brushed gradient is used on wordmark text only); brass is an editorial accent, using its shade stop (#695a33) for text on light.

**Colour: contrast.** Contrast is measured against every surface of a ground. Body and UI text need 4.5:1, large text 3:1, and icons, borders, focus and chart marks 3:1. Tertiary text is about 3.4 to 3.7:1 and is for metadata only, never anything a student must act on.

**Type.** Barlow carries reading at 16px on a 1.55 line, with controls at 14px. Barlow Condensed 600 carries headings, labels and buttons at -0.015em. Cinzel is for rare editorial display of 42 to 56px and never appears in warnings, provenance, consent or accessibility text. System mono is for IDs and timestamps. The twelve roles run from editorial (42px) through display (26), page (24), section (20), card title (18), body (16), control (14), compact (12), label and caption (11), kicker (10.5, tracked 0.08em caps) and numeric (22, tabular). Measure is about 66 characters, sentence case is universal, and sizes scale with `--text-scale`, which reader settings move from 0.94 to 1.18.

**Spacing and density.** Layout uses an 8px grid (8, 16, 24, 32, 40, 48, 64, 80, 96px) with page padding of 18px widening at 760 and 1100px. Inside components, seven steps (2 to 16px) are multiplied by density 1, 0.86 or 0.74. Targets are 44px by default, 40px for icon buttons, 32px for compact rows and a 24px floor in crowded composites with keyboard parity.

**Corners.** "Drawn" corners are 3px for controls, 6px for cards and 10px for sheets, with a 999px pill for floating bars. Chips stay at 3px.

**Elevation.** Border first, shadow second. Light grounds use three ink-tinted shadows; dark grounds use three lift tokens. Shadows appear only on floating and modal layers. Eight stacking layers run from 0 to a 1500 curtain. Only the tab bar and focus bar are translucent (14px blur), with an opaque fallback under reduced transparency, increased contrast, Low stimulation and forced colours. Scrims are 50 percent Ink.

**Motion.** Hover and press take 130ms, state changes 180ms, panels 240ms and sheets 280ms, with progress at 180ms linear and the ease `cubic-bezier(.22,1,.36,1)`. Sheets rise 8px and fade. There is no bounce, parallax, shimmer, spinner, looping decoration or press scaling. All motion is zeroed by `prefers-reduced-motion` and `data-calm`, and no meaning depends on it.

**Layout and breakpoints.** Below 760px a labelled bottom TabBar carries the five destinations. From 760 to 1099px a 72px compact rail appears. From 1100px the SideRail is 248px (272px at very wide). A 44px SystemContextBar sits on top with location, term, Command-K search and sync state. Pages use a `minmax(0,1.6fr) minmax(300px,1fr)` grid that stacks below 1000px, with the next action leading the main column and "Needs you", context and policy in the aside. Reading measure is 66ch and operational pages cap at 1180px. The student app is mobile-first and offline-safe; staff and console are desktop-first; the public site goes single column under 860px; everything reflows at 320px and 200 percent zoom.

**Accessibility floors.** The target is WCAG 2.2 AA, a design requirement and explicitly not a conformance claim. Each page has one main landmark, one H1 and a skip link. Focus never lands under sticky chrome. Inputs are native with persistent labels, and errors preserve input. Overlays trap focus, close on Escape and return focus. Reader settings cover text size, density, line height, letter and word spacing, reading width (52 to 82 characters), an Atkinson Hyperlegible option, three motion modes, Increase contrast and 13 grounds. Status, provenance, consent text and accessibility controls are brand-exempt: body-grade type only and never restyled.

## Component library guide

Each component has a README, type declarations and a live preview. All are bundled under `window.SemesterDesignSystem_e9f3ba` and typed together in `components/index.d.ts`.

### Actions

- **Button.** One primary per decision region; 44px, or 32px with `size="sm"`. Variants: primary, secondary, ghost and danger (red ink and hairline, never a red fill). Props: `variant`, `size`, `icon`, `loading`, `disabled`.
- **IconButton.** Icon-only control; `label` (its accessible name and tooltip) is required.
- **QuickActions.** Two to five labelled starting actions for empty and onboarding states.
- **ActionPreview.** What happens, exactly what, what stays, taking it back. Props: `says`, `exactly`, `doesNotChange`, `recovery` (undo, request or none). Place it inside a Dialog for consequential actions.

### AI

- **AIResponse.** A governed answer labelled AI-assisted with scope, numbered sources, confidence, cost and policy. Consequential `actions` must open a Dialog and ActionPreview.
- **ProvenanceChips.** Origin chip plus at most two cues and an age, spoken as one sentence.

### Data

- **DataTable.** Compare columns; use a list when scanning or acting on rows. Props: `columns`, `rows`, `caption`.
- **Fields.** Label and value list for one record.
- **DecisionTrail.** Timeline of who did what, when and under which authority; states done, current, waiting, blocked.
- **MetricTile.** One figure with unit, source and age; never an outcome claim.
- **ProvenanceChart.** Bars encode provenance by pattern: solid, outline, hatched, dotted. The title states the finding.

### Forms

- **TextField.** Visible label, hint and error; the placeholder is an example, never the label.
- **Select.** Native select in Semester's palette.
- **Segmented.** Two to four exclusive presentation choices, not navigation.
- **Choice.** Radio or checkbox row with a sentence on the consequence, for sharing decisions.
- **Switch.** On/off setting that shows the word On or Off.
- **Combobox.** Filtered listbox for courses, people and rooms.
- **DateField.** Native input that speaks the date back as "Thu 9 Oct 2026" via `said`.
- **VisibilityPicker.** The one privacy question with four answers: Only me, Course, Selected collaborators, Public portfolio. Offer only what the module can honour; it never grants access.

### Glyph

- **Icon.** From the 108-glyph set; `label` makes it a named image.
- **Mark** and **Wordmark.** The three-slab mark and the SEMESTER lockup; `metal` paints sterling for dark chrome.
- **SectionLabel** and **Avatar** (core primitives). The tracked-caps kicker with optional count, and initials in a tinted square, never photos.

### Navigation

- **SideRail.** Persistent 248px Ink rail; the current row has a blue wash.
- **TabBar.** Mobile bottom navigation, always labelled.
- **SystemContextBar.** Location, term, search, sync state.
- **CommandPalette.** Global search and commands with keyboard selection.

### States

- **EmptyState.** Why it is empty plus one action.
- **LoadingState.** Structural placeholders and a spoken "Loading"; no spinner.
- **ErrorState.** Plain-language failure with a required recovery and optional reference; keeps the user's input.
- **SuccessState.** Acknowledgement pointing to what is next.
- **ProgressState.** Determinate wait with Cancel or Retry.
- **StepStatus.** Named steps (waiting, working, done, failed) so a system never fakes certainty.
- **PermissionNotice.** What changed about access, why, and where it is controlled.
- **OfflineStrip.** What still works and how many changes are queued.
- **SaveState.** Quiet "Saving, Saved" live region.
- **Notice.** One-line service notice.
- **UndoToast.** Confirmation with Undo for reversible work; never for consequential or financial actions.

### Surfaces

- **ObjectCard.** The universal decision card: eyebrow, title, provenance, why, metadata, one primary and one secondary action.
- **ContextBar.** The object a screen is about, with states and actions.
- **NextSteps.** Ordered safe actions with one line of why.
- **Dialog.** Modal confirmation; focus lands on Cancel; `destructive` uses a red-ink button.
- **Sheet** (with **SourceDetails**). Bottom sheet or window; home of Source and details.
- **FocusBar.** Floating pill for focus sessions.
- **ScreenGuide.** "About this screen" disclosure at every screen's foot.
- **OpenIn.** Words-only links to every place an object matters.

### Trust and provenance

- **SourceBadge.** Glyph, word and tone for origin; `onReport` adds "Report incorrect information".
- **SourceLine.** A thin brass rule from a statement to its source chip; used only where a real source exists.
- **StatusChip.** One of 21 shared status keys, always glyph and word.

### Governance

- **PolicyBadge.** Policy name, version and owner; opens policy text in a Sheet.
- **ConsentBadge.** Private, shared (recipient, expiry), expired, revoked or required.
- **HealthBadge.** Healthy, watch, at risk or unknown, with driver and freshness.
- **ApprovalBanner.** Two-person approval state with buttons suited to the viewer.
- **ErrorSummary.** Form errors at the top (WCAG 3.3.1), each linking to its field.
- **SupportHandoff.** Hand-off to the owning office with channel, hours and status, without editing the official record.
- **PageHeader.** Kicker, one H1, purpose, source and at most one primary action.

The component library document marks FreshnessBadge, AuthorityBadge and RiskBanner as "Partial" and NotificationCenter as "Pattern only". The seven governance components closed gaps in October 2026.

## Patterns and governance rules

**Provenance ladder.** Strongest first: official, connected, made (built by the app from the student's sources), yours, sample, stale. Display-only kinds are AI-assisted, estimated, needs review and external. Made and AI differ on purpose, since an extraction can misread and a draft can sound right while wrong. Estimates and AI are styled to be noticed, because students over-trust them. Freshness reads "Updated 3 days ago" or "Update time not recorded", never "just now" for an unknown time.

**AI answer anatomy.** Every answer shows the AI-assisted label, the allowed data scope (changeable before asking), numbered sources, confidence and limits, request cost, the governing policy, and actions that open a preview first. StepStatus shows the work. Never say "AI-powered", "intelligent", "knows you" or "accurate". When an instructor restricts AI, the course shows "Course AI policy, set by instructor" and disallowed actions are disabled with a reason, not hidden.

**Consent.** Private by default, never implying guardian access. Each ask states what, with whom, why, how long and how to undo. Before sharing, the student previews the exact payload and expiry. Shares are revocable beside where they are made, access history is visible, and protected categories (counselling, health, disability services) show a disabled switch with the reason.

**Consequential actions.**

| Kind | Pattern |
| --- | --- |
| Reversible and personal | Do it, then UndoToast |
| Leaves Semester or visible to others | Dialog with ActionPreview |
| Academic record | In-place Review then Confirm, stating where the request lands |
| Financial | Dialog naming amount, method, processor and refund route |
| Institutional high-risk | Two-person duty, fresh MFA within 15 minutes, audit first |

Dialog titles are questions naming the object, buttons name outcomes, focus lands on the safe choice, and recovery is required. A SuccessState receipt follows.

**State matrix.** Every data region designs loading, empty, partial or stale, offline, error, permission and success.

**Data trust panel.** Critical screens show Source, Updated, Authority, Status, Policy (versioned) and a path to official detail. Delayed data blocks destructive actions until confirmed at the source.

**Content templates.** The status sentence is the unit of voice: what is true, what it means for you, what you can do. Errors give what failed, what is safe, the way out and a reference such as SYNC-4F2A. Incident notices list what is affected, what is not (only if verified), what to do and the next update, and never say "minor" or "isolated". Onboarding starts from what the student has, asks consent one item at a time, uses no streaks, and always offers Skip. Dates read "Thu 9 Oct · 23:59". Emoji are never used.
## Architecture

The architecture documents are labelled design-level. The Architecture Guide (v0.1, October 2026) says to "verify everything against the repo", so this chapter describes the intended architecture, not audited running software.

**Three tiers.** Tier 1, the experience platform ("Apple-like"), holds the Student OS, Course Studio, advisor, registrar, family, career, company site and operations surfaces. Tier 2, the education intelligence platform ("Google-like"), holds identity and education graphs, search, the AI gateway, policy and workflow engines, provenance, analytics and human escalation. Tier 3, the institutional infrastructure platform ("Microsoft-like"), holds the tenant control plane, RLS, SSO and SCIM, approvals, audit, the integration gateway (LTI, OneRoster, Edu-API), migration, feature flags, billing, trust, SLOs, backup and a developer ecosystem. The borrowing table says what not to copy: closed ecosystems, ad-tech incentives on student data, configuration overload and treating model output as official truth. A ten-step deployment ladder runs from development to multi-campus expansion, and each step needs a security review, accessibility review, rollback plan and release evidence. The integration doctrine is to connect first and replace a domain only where the institution chooses, in five phases from Connect to Education OS; phase one is "Now (paid pilot)".

**Layers and data.** The front end is the student app, the staff and console routes on the same shell, the design system and an offline queue. Middleware refreshes sessions, resolves the tenant, checks role by screen by grant, rate-limits (harder for AI), writes the audit event before the action, and applies per-tenant flags and kill switches. The server layer offers `api.*` read functions, `private.*` command functions requiring an idempotency key, edge functions, integrations and an outbox worker. The database is Supabase Postgres with RLS on every table. The design-level schema has 20 tables, including tenants, memberships, role_grants, enrollments, grades, holds, shares, approvals, audit_log, domain_outbox_events, ai_requests and integrations. Schemas are `core`, `edu` (student data), `community`, `market`, `ops` (company data, no student identifiers) and `audit`.

**Read models, CQRS and freshness.** A write succeeds against the authoritative table, an outbox event is written in the same transaction, a worker applies the projection idempotently, version and freshness are stamped, caches are invalidated, the browser gets a targeted refetch signal and the UI renders the read model. The `private`, `read_model` and `api` schemas keep that boundary visible. Freshness drives UI policy: live (up to 5 seconds) and recent (up to 60) behave normally; delayed (over 60) shows a badge and re-checks the source before consequential actions; failed or rebuilding shows the last good state and holds them. Rebuilds are blue-green behind a parity check. Realtime is limited to approvals, incidents, P0 and P1 support, rollout state and invalidation. The UI is optimistic: it shows "Saving" at once, confirms only when the projection version advances, and rolls back with a reason otherwise.

**AI gateway.** The gateway is the single egress to models (ADR-003). A request passes identity and scope, policy (course AI policy, institution switches, FERPA boundary), routing to an approved model, an answer labelled AI-assisted with sources and confidence, and an evidence log. Student records are blocked at the policy step. The allow-list admits course content, the student's own typed text and public catalog data, and blocks anything from `edu.*`. The starting code runs authentication, policy, gate, content scan, provider and audit, with a redaction module that blocks IDs, SSN, GPA, grades, transcripts, dates of birth and card numbers in prompts, a usage log that stores no prompt content, and a red-team suite that is a launch gate.

**Environments.** Local uses synthetic seed data. Preview deploys per pull request on synthetic data. Staging mirrors the institution's configuration with synthetic data and test IdP accounts. Production holds real records under the DPA with separate keys, named operators, MFA and logged access. Data is never copied between environments, and secrets live in Vercel and Supabase settings.

**API contract standard.** APIs are organised by authority and risk. "High-impact writes never mutate raw tables from the browser; they go through capability-checked server commands." Fifteen domains are defined (identity, tenant, academic, learning, workspace, AI, student success, campus, career, family, integrations, commercial, trust, operations, platform), each with a write-control model. Every API answers ten questions: identity, scope, purpose, authority, policy, validation, idempotency, audit, freshness and error recovery. Examples include `POST /v1/academic/registration-requests` and `POST /v1/family/grants`.

**Security model.** Five principles: the institution is the system of record; student records never reach an AI model; company roles never see student data; consequential actions are previewed, attributed and logged; source and freshness show on every record. RLS checks the tenant against the JWT claim, service-role keys live only in workers, every query runs as the user, and every mutation writes an audit row. Marketplace payments go through a licensed processor, so Semester never holds funds. High-risk actions need a second approver and fresh MFA. A review of migrations 010 to 040 found 11 issues, including a critical one (staff self-inserting as CEO) and a high one (changing a profile's institution), fixed in migration 050, which must be applied before any data. Migrations 060 to 080 add audited command functions, the AI gateway tables, private storage and delegations. Five ADRs record the main choices: RLS as primary authorisation, read models over live SIS queries, the single AI egress, processor-based payments, and a separate `ops` schema.

**Operations.** The explorer records staged tenant rollouts, forward-only migrations with a parity check, monitoring of errors, projection lag, sync failures and AI spend, on-call response of 1 hour (P0) and 4 hours (P1), daily backups with point-in-time recovery and a quarterly restore test, quarterly access reviews, and postmortems within five days.

## How it is built

**Stack.** The toolkit baseline (repository commit 5eba494, 5 October 2026) describes the real app as Vite, React and TypeScript under `app/`, with plain CSS, about 273 component files, about 95 lazy screens, 19 style contract tests, a 143-pairing contrast test and 12 CI workflows. Hosting is Vercel and Supabase; validation is Zod; tests are Vitest. The platform and router packages are Next.js App Router with Supabase.

**Packages.** `semester-core` is dependency-free, I/O-free TypeScript with nine tested modules: provenance, nextaction, access, freshness, consequence, aigateway, approvals, scoring and pilot. `semester-platform` holds database and API code for community, marketplace, ops and audit: migrations 010 core, 020 community, 030 market and 040 ops, then 050 to 080 for security, commands, AI and storage, plus API routes, validation and RLS, security, command and red-team tests. Its README says: "Not yet run, typechecked or tested." `workflow-router-app` is the AI Workflow Router and Benchmark Lab: Next.js, strict TypeScript, Supabase magic-link auth, Zod server actions, two migrations with organisation-scoped RLS, a seed of 12 workflows and Vitest suites; its README says checks "have not been run here". All code files carry a `.txt` suffix, which `install.sh` strips without overwriting.

**Migrations and tests.** Migrations run 010 to 080 in order, renumbered after the repository's latest, and applied ones are never edited. Each ships with RLS policies and tests in the same pull request (own tenant allowed, other tenant denied, company roles denied on student tables, expired grant denied), proved red then green. Test layers are unit, RLS, AI red-team, Playwright end-to-end and accessibility. `verify.sh` must end with "ALL GATES PASSED".

**Execution plan.** Each stream uses a branch `semester/<stream>`, ends with a pull request and a report, and stops for review.

| Step | Stream | Gate |
| --- | --- | --- |
| 00 | Repo audit and design-system sync | CI green; baseline approved |
| 01 | Database, tenancy, RLS, core logic | RLS red-then-green |
| 02 | Identity, SAML SSO, onboarding | Test login per pilot role |
| 03 | Student OS | Five states per screen; accessibility 95 or more |
| 04 | Staff and academic workspaces | Two-person approvals tested |
| 05 | Institution console, integrations | Zero unexplained mismatches |
| 06 | Governed AI gateway | Red-team suite passes |
| 07 | Community, career, family | Revocation immediate |
| 08 | Operations command center | Company-role isolation test |
| 09 | Security, privacy, accessibility | Restore drill timed |
| 10 | Pilot launch | Every go/no-go gate evidenced |
| 11 | Public site and grow | Every claim sourced |
| 12 | One place | No regulated step re-implemented |
| 13 | Platform maturity | Scorecard re-scored from evidence |

The pilot-critical path is 00, 01, 02, 03, 06, 05, 09, 10. Humans alone bind insurance, sign the DPA, submit HECVAT Full, obtain attorney review, supply the Vanderbilt IdP details, approve the baseline and each pull request, approve cutover and choose the AI provider.

**Engineering playbook.** Three rules never bend: RLS on every table with a proving test; the browser calls `api.*` only; student records never reach an AI provider. `main` is always deployable, pull requests stay under about 400 lines, and the founder approves anything touching auth, RLS, the AI gateway or billing. Seven CI jobs block merge. Releases are tagged, smoke-tested in staging, backed up before migrations and watched for 30 minutes, and none ship in launch week, finals or registration opening except S1 and S2 fixes. Features ship behind per-tenant flags with kill switches. Dependency alerts are reviewed weekly. The product and engineering operations page admits gaps in a PRD template, ADR log and experiment registry.

**QA and accessibility.** The QA plan uses one synthetic account per role and 14 end-to-end journeys, such as a registrar override needing a second approver and a support user unable to read student tables. Defects run S1 (data exposure) to S4 (cosmetic). The accessibility plan targets WCAG 2.2 AA with an ACR on the VPAT 2.x template, runs axe in CI, and requires manual keyboard, screen-reader (NVDA, JAWS, VoiceOver, TalkBack), zoom, spacing, target and motion checks on pilot paths each release.

**Claude Code and Figma toolkit.** The toolkit adds three skills (`audit-semester-design-sync`, `build-semester-ui`, `create-semester-component`), an `.mcp.json` for the remote Figma MCP server with no credentials, a CLAUDE.md section, a zero-dependency audit script, a report script, Vitest proofs and `design-system:check` scripts, with no new dependency, Tailwind or Storybook. Authority runs from `look.ts` to `tokens.css` to `tokenexport.ts` to the generated JSON to `FIGMA-MAPPING.md` to Figma, and Figma is never written to. Figma names stay "proposed" until a file is connected.

## What's next

The founder's top-priority ask is: "Every role in Semester. Finish, generate and produce everything I need to run, grow, build, operate, maintain, secure and launch Semester." NEXT-SESSION.md records launch, secure, build, operate, run and grow documents as done, plus one page for each of 49 catalogued roles.

Open work, in order: replace archetype screens with bespoke designs, highest traffic first; regenerate the master catalog documents; export the investor, institution and internal decks to PPTX; deepen registration readiness, support SLA and SIS reconciliation screens; build Course Studio and the moderator workspace; write the AI governance policy, data inventory, incident response and pilot delivery documents; and run the Claude Code toolkit in the real repository. An administrator manual and tutorials are requested twice and remain to do, as does a batch of device and media capabilities (camera, microphone, location, notifications, offline, multi-device sessions, personalisation) with consent, fallback and revoke paths.

One decision is open: indigo with emerald, amber and rose from an outside brief, or Semester blue with stone hues. The rules to keep are that nothing is verified without code, tests and release evidence; company roles never see student records; status replaces certifications not held; and external numbers are cited. The `github.md` note records that `docs/design-system/` and the `workflow-lab/` app have landed upstream, while the toolkit's `.mcp.json`, skills, scripts and baseline had not.

## Reader's guide

- **Design system README.** What Semester is, voice, visual foundations, iconography, components and UI kits.
- **Tokens.** The reference generated from `tokens.json`.
- **Foundations.** Specimen cards for colour, type, spacing, density, layout, motion and data visualisation.
- **Brand specimens.** Logo system, mark, wordmark, iconography rules and voice.
- **Components, light.** Every component on the Parchment ground.
- **Components, light and dark.** The same components on Parchment and Ink.
- **Patterns.** Provenance ladder, AI anatomy, consent, consequential actions, state matrix, Source Line.
- **Guidelines.** Eight written deep dives, from provenance to content templates.
- **Design language.** The eight documents in `docs/system/design`.
- **Figma mapping.** Collections, variables and component mappings.
- **Architecture guide.** Principles, components, data model, flows, environments and ADRs.
- **Three-tier and API.** The three tiers, deployment ladder and API contract standard.
- **Architecture cards.** Layers, read-model pipeline, AI gateway, environments.
- **Architecture explorer.** OS map, 20-table schema, CQRS pipeline, lag simulator and phases.
- **Developer guide.** Setup, conventions, branching, testing and the new-feature checklist.
- **Engineering playbook.** Layout, CI, environments, releases and definition of done.
- **Product and engineering ops.** The company-OS page on owner, KPIs and approval thresholds.
- **QA plan.** Test levels, role journeys, negative tests and gates.
- **Accessibility plan.** WCAG 2.2 AA checks, assistive-technology matrix and ACR.
- **Build handoff.** `handoff/README.md` and `BUILD.md`.
- **Execution plan.** The master index and stream prompts 00 to 13.
- **Code packages.** READMEs for semester-core, semester-platform and the router app.
- **Toolkit.** The Claude Code and Figma toolkit documents.
- **Tooling cards.** Four summary cards for the tooling.
- **Workflow lab.** The AI router and benchmark prototype.
- **Prototype notes.** What is sample data and what is stored only on the device.
- **Prototype-to-codebase map.** The `github.md` screen map and sync history.
- **What's next.** The NEXT-SESSION backlog.
- **Source-code appendices.** `tokens.css` and `bundle.css`; component sources; semester-core; semester-platform (API routes, migrations, tests); the workflow-router app.

## Glossary

| Term | Meaning |
| --- | --- |
| Ask Semester | The AI assistant; no human name or persona, always labelled AI-assisted |
| AI gateway | Single egress to models; checks scope and policy, blocks records, logs evidence |
| Approval banner | Component showing two-person approval state |
| Audit before action | The audit event is written first, then the action applies |
| Authority | The office entitled to decide a fact, such as the Registrar |
| Batch N | The founder's plan to produce everything needed to run and launch Semester |
| Brand-exempt zones | Status, provenance, consent text and accessibility controls, never restyled |
| Break-glass | Emergency privileged access needing a reason and review |
| Calm mode | `data-calm`; zeroes motion and quiets decoration |
| Canonical destinations | Today, My Path, Search, Plan, Me |
| Chrome | The always-dark rail, tab bar and console bar |
| Connected | Provenance rung for a recently checked account the student connected |
| Consent badge | Private, shared, expired, revoked or required state |
| Consequence copy | Text stating what an action does, before confirm |
| Core | `semester-core`, nine tested decision modules |
| CQRS | Writes to authoritative tables, reads from projected models |
| Decision trail | Timeline of who did what under which authority |
| Density | Multiplier of 1, 0.86 or 0.74 on component spacing |
| DPA | Data processing agreement governing production data |
| Drawn corners | 3px controls, 6px cards, 10px sheets |
| Freshness | Live, recent, delayed, failed or rebuilding |
| Ground | Base surface family: Ink or Parchment (13 in the app) |
| HECVAT | Vendor assessment toolkit; HECVAT Full is in progress |
| Idempotency key | Makes a retried command safe |
| Ink | The near-black ground, #090a0e |
| Kicker | 10.5px tracked uppercase label |
| Made | Rung for content built by rule-based extraction from student sources |
| Master catalog | 51 roles, 673 screens, 319 steps, 88 systems, 82 documents |
| Outbox | Events written in the same transaction as a change |
| Parchment | The warm off-white ground, #f4f1ea |
| Policy badge | Names governing policy, version, owner |
| Provenance | Origin and trust level of a fact |
| Read model | Projected table stamped with version and freshness |
| Repo beats design | Existing repository code wins over design proposals |
| RLS | Row-level security in Postgres |
| Semester blue | Action colour: #416180 light, #94bce3 dark |
| SIS | Student information system, the institution's record |
| Source badge | Glyph, word and tone showing origin |
| Source Line | Thin brass rule linking a statement to its source |
| Stale | Rung for data from a connection not checked lately |
| Status sentence | What is true, what it means, what you can do |
| Stream | One numbered unit of the execution plan |
| Tenant | An institution's isolated space; `tenant_id` on every row |
| Three-layer disclosure | Decision, explanation, advanced detail |
| Two-person duty | Requester and a different approver, fresh MFA, audit first |
| VPAT/ACR | Accessibility template and conformance report; in preparation |
| Visibility picker | The four-audience "Who can see this?" control |
| Wash | Low-alpha tint behind chips |
| WCAG 2.2 AA | Accessibility target, not a conformance claim |
| Yours | Rung for student-entered, unchecked information |
