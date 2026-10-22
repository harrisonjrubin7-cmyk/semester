# Semester — next session brief

Start a new conversation in this project and paste: **"Read NEXT-SESSION.md and continue."**

## Built (open ui_kits/master-control/index.html — every item is linked)
- Design system: tokens, 57 components, 68 cards, 7 templates (company, investor, institution, internal decks; student + console screens; pilot results report).
- Product: student app (64 screens, Tweaks, live Ask Semester), mobile, staff, console, external, investor portal.
- Maps of the whole: Master catalog (51 roles · 673 screens · 319 workflow steps (17 workflows) · 88 systems · 82 docs), Atlas, Role lens (22 roles), wireframe catalogue, forms/capabilities/interfaces (12 forms).
- Architecture: OS map, full stack & data (20 tables, flows, operations), read-model pipeline, lag simulator, AI gateway, phases.
- Company: business workspace, operating manual, operating pack, market research, compliance audit, company site, Vanderbilt one-pager, invitation email, campus map, 30 s demo video, company deck PPTX.
- Handoff: handoff/ (claude-code-toolkit, semester-core, workflow-router-app) — see handoff/README.md.

## Done Oct 5 2026
- ui_kits/workflow-runner/: Semester OS map (21 layers with modules from uploads/Map Out entire Semester OS.pdf, 14-check control chain, journeys, 21 required shared workflows, 22-point completion definition) + runner for all 207 catalogued workflow steps (actor, hand-off, system, screen match, rendered step, audit log, auto-run), by-role view (49 roles), screen coverage and gap list. Linked from master-control. Batch C done: 7 added workflows (finance, campus, community & moderation, career/employer/alumni, family consent, developer platform, analytics & outcomes; 112 steps, labelled "Added · not in catalog yet") so every one of the 21 layers now has a runnable workflow. Next: fold the added workflows into catalog-data.js and write docs/master/*.md.
- Design System tab: 10 new cards (arch-*, tooling-semester-core/platform/workflow-router, company-documents, maps-of-the-whole, iconography-rules).
- docs/master/: all 13 catalogs + README, generated from catalog/runner/OS-map data (84 step screen gaps, 13 roles with no workflow, 419 screens no workflow uses — see SEMESTER_GAP_REGISTER.md).
- Templates from the linked Semester Platform project: templates/platform-shell, institution-os, command-center, role-onboarding (RoleOnboarding role prop → 13 role DCs), operating-map, finish-line, vision-deck. This design system wins on conflicts.
- handoff/execute/: 00-INDEX.md master prompt + 12 stream prompts (00 setup … 11 company site/grow), branch semester/<stream>, PR + report per stream.
- DONE: docs/grow/GTM Plan.html (+ index).
- DONE: full public site in ui_kits/company-site (10 pages, hash routes #/product … #/legal, responsive, forms, legal + accessibility statement).
- DONE: docs/legal MSA, Order Form, DPA (drafts, attorney review). Still: cookie notice, accessibility statement as a standalone doc.
- DONE: docs/run/Finance Model.html (setup lean $4,873 / base $12,430 / full $19,910; run-rate $565/mo).
- DONE: docs/run/Hiring Plan.html (10-role plan, 6 JDs, contractor briefs).
- DONE: docs/build/ Engineering Playbook, QA Test Plan, Accessibility Test Plan (+ index).
- DONE: docs/operate/ Operations Handbook (SLOs, error budget, on-call, alerts, monitoring, cadence) + Runbooks (R1–R8, macros).
- DONE: docs/legal Cookie Notice + Accessibility Statement; docs/secure/index.html.
- DONE: ui_kits/role-pages/ — one page per catalogued role (49 in catalog-data; brief said 51), linked from master control; workflow buttons open the runner at the step.
- DONE: ui_kits/gap-screens/ — the 84 step screen gaps added to the catalog (CATALOG.addedScreens; 673 screens total) and rendered in the shell. Regenerate docs/master/* to drop them from the gap register.
- DONE: batch A baseline — ui_kits/every-screen/ renders all 673 catalogued screens (archetype per name: dashboard/queue/list/builder/settings/detail/marketing) in six states; ◆ designed in a kit, ◐ from a workflow gap, ○ archetype only.
- NEXT: replace archetype screens with bespoke designs, highest-traffic first (B student, E registrar, K console); regenerate docs/master/*. EVERY ROLE pages (51) and batch A missing screens.
- Source project (done): /projects/7dd6738a-405e-41a6-9c02-ac359bb30017 (Semester Platform, Institution OS, Company Command Center, 14 role onboardings, Master Operating Map, Finish Line, Vision Deck).

## Founder's latest ask (top priority)
"Every role in Semester. Finish, generate and produce everything I need to run, grow, build, operate, maintain, secure and launch Semester."
Batch N is the master plan. Do it one stream per session, in this order, and link every output from master-control:
1. LAUNCH: COMPLETE. docs/launch/ has index, Launch Runbook, Cutover Plan and Support Plan (day-1/week-1). Next is BUILD (stream 3). SECURE has no docs/secure/index.html yet. Original list: launch runbook, go/no-go checklist, cutover plan, comms plan, day-1/week-1 support plan, rollback.
2. SECURE: the policy set at docs/secure/Security Policies.html is DONE. docs/secure/Security Readiness.html (HECVAT, SOC 2, pen test, insurance) is DONE too, so SECURE is complete. Next is BUILD. Original list: HECVAT Full answers draft, security policy set (access control, encryption, vendor management, incident response, BCP/DR, data retention, acceptable use), SOC 2 readiness tracker, pen-test scope, insurance checklist.
3. BUILD: engineering playbook (repo layout, branching, CI/CD on Vercel + Supabase, RLS test plan, environment matrix, release process), QA test plan per role, accessibility test plan (VPAT/ACR prep).
4. OPERATE / MAINTAIN: site operations console (batch E), on-call and SLOs, monitoring and alerts, SIS sync runbooks, backup and restore drills, dependency/patch cadence, support macros.
5. RUN: company operating cadence (weekly metrics, monthly close, quarterly planning), legal stack (LLC, contracts, DPA template, MSA, order form, privacy policy, terms), finance model (pre-revenue budget within the $5k–$20k setup range), hiring plan per role, a job description for each.
6. GROW: GTM plan (ICP, pipeline, pricing, case study from the pilot), the full public site (batch F), content calendar, partner program, fundraising data room index.
7. EVERY ROLE: one page per catalogued role (51), covering purpose, screens, permissions, workflows, KPIs and day-in-the-life. Render any missing screens (batch A).
Build formal docs as doc_page files under docs/<stream>/, and give each stream an index page.

## Also done (Oct 2026)
- docs/guides: Architecture, Developer and User guides.
- handoff/semester-platform: migrations 010–040 (core, community, market, ops, all with RLS), validation, 2 API routes, RLS and unit tests. None of it has been run yet.
- Still to do: an admin MANUAL (operations manual for institution admins and support) and TUTORIALS (step-by-step, for students, staff and new developers).

- O. Device and media capabilities, each permission-gated with a clear ask, a fallback, and a revoke path in Privacy settings:
  - Camera: scan textbook ISBNs for listings, photograph items, ID check for campus verification (handled by the institution IdP where possible), video office hours.
  - Microphone: voice notes, dictation in Write, voice questions to Ask Semester (transcribed on device where possible; audio never stored by default).
  - Location: campus map, safe meet-up spots, event check-in, shuttle. Only while the app is in use, precise or approximate as the user chooses, never sold, and off by default.
  - Image and video generation: for study visuals, club flyers and event promos, through the AI gateway with a content-safety filter, labelled AI-generated, with no real-person likeness and no student records.
  - Notifications (push/email/SMS per channel), offline mode, PWA install, biometric sign-in on the device.
  - Multi-user and multi-device: account switcher (student who is also a TA, staff in two roles), sessions list with remote sign-out, handoff between phone and desktop, shared family view only with student consent, delegated access with expiry.
  - More personalization (expands H): themes (13 grounds × 11 accents from the app), density, text size, calm mode, dyslexia font, reduced motion, home layout builder, language, time format.
  - Build: a Capabilities & Permissions screen in the student app, a device settings page, permission-prompt patterns as design-system cards, and an RLS/migration for sessions and delegations in handoff/semester-platform.
- LEGAL DRAFTS DONE: docs/legal has Terms, Privacy, Community Guidelines and Subprocessors, all marked as needing attorney review. docs/index.html is the library of every document. Still to do: MSA, order form, DPA template, cookie notice, accessibility statement.
- MANUAL + TUTORIALS (requested again): an admin and operations manual, plus step-by-step tutorials for students, staff and developers. Both go under docs/guides.

## Founder's earlier ask
"Every screen rendered — capability, workflow, user role, business operations, site operations, and the actual site."
Work in batches, one area per session. Each batch ends by linking new files from ui_kits/master-control/index.html:
- A. Render every catalogued screen still missing, role by role (catalog = 51 roles · 673 screens). Use shared shells and components; group roughly 10–15 screens per file, one file per role.
- B. Capability map rendered as screens: each capability → the screens and roles that use it.
- C. DONE: ui_kits/workflow-runner/ — all 319 steps, clickable end to end, per role.
- D. Business operations console (finance, sales/revops, CS, legal/compliance, hiring). No student records.
- E. Site operations console (deploys, uptime, incidents, SIS sync, AI gateway, support queue, audit log).
- F. The actual public site: full multi-page marketing site (home, product, institutions, students, security/trust, pricing, about, contact, legal). Build on the existing company site.
- G. DONE (Oct 2026): 9 logo SVGs in assets/ plus the components/LogoSystem/preview.html card. Outstanding: outline the wordmark text to paths. Original brief: More logos: logo variants (horizontal, stacked, mark-only, mono, reversed, favicon/app icon, co-brand lockup with partner institution). Add them to assets/ and give them a brand card.
- H. Personalization capabilities: add them to the capability catalog and render them as screens. Covers learner profile and goals, adaptive study plan, pacing and reminders, content recommendations, accessibility and display preferences, notification preferences, AI tutor tone and level, dashboard layout, and institution-level theming. Every item has privacy controls (consent, view and reset my data, opt-out). AI never sees student records.
- I. Update pass: audit catalog counts, master-control links, the readme and SKILL.md against what's built; fix anything stale or broken.
- J. PARTLY DONE: ui_kits/ops/index.html has 12 consoles and is linked from master-control. Social and Finance are deep; the other 10 are one queue each and need more tabs.
- K. Documents: every formal document (policies, FERPA/SOC 2/accessibility compliance docs, audit workflows, test plans, runbooks, DPA, incident response, AI use policy, data retention). Build them as doc_page documents in docs/, with an index.
- L. PARTLY DONE: docs/brief/ has index, One-pager and FAQ. Role sheets are done too. The overview deck (templates/overview-deck/OverviewDeck.dc.html) is done too, so L is complete. Add a real screenshot on slide 4. Ops consoles now carry a "sample data" banner. Original brief: Product brief package to hand out: a one-pager, a 10-slide overview deck, an FAQ, and a role-by-role "what Semester does for you" sheet. Print/PDF ready, with one index page that links them all.
- M. PARTLY DONE: student app at ui_kits/community. Staff side lives in the ops T&S console (health, marketplace ops, live drops, institution settings). Mentorship, clubs and leader tools are now built too. M is done apart from deeper polish. Started: ui_kits/community/index.html. Expand it to cover:
  - Social: campus-verified profiles controlled by the student, with visibility per field; follows and connections; a course and club feed; study groups; DMs with safety tools; events and RSVPs; mentorship matching.
  - Community: clubs and orgs, course communities, Q&A with endorsed answers, reputation that carries no academic weight, ambassador and peer-leader roles.
  - Live marketplace: textbooks, gear, housing and sublets, tutoring and services, and event tickets. Listings are campus-verified, with in-app offers and chat, safe meet-up spots, and live drops and auctions. Disputes and reports go to the moderator workspace.
  - Guardrails: no sale of graded work or exam material (academic integrity filter), the institution controls whether each feature is on, minors and age rules respected, moderation queue, AI pre-screen only on public posts, no student records in social or AI. Payments go through a processor; Semester never holds funds without a license.
  - Staff side: community health, moderation and marketplace ops tabs inside ui_kits/ops (T&S console).
- (orig) J. Operations consoles, each fully built, interactive and rendered (one file each, shared Ink console shell, linked from master-control):
  - Social media control: unified inbox, compose/schedule calendar, approval queue, brand-safety and crisis mode, per-channel analytics, institution-partner co-posts.
  - Finance: ARR/MRR, invoices and AR aging, contracts and renewals, usage-based billing per institution, AI gateway cost, payroll summary, close checklist, audit export.
  - Also: marketing/campaigns, sales/RevOps pipeline, customer success health, support desk, trust and safety/moderation, legal/compliance (FERPA, DPAs, subprocessors), people/HR, IT/security (SOC 2 evidence), data/analytics, partnerships.
  - Each console needs real-feeling data, working filters and tabs, row detail drawers, and role permissions. Business data only; no student PII.
Then continue with the list below.

## Do next, in order
1. Export investor, institution and internal decks to PPTX (gen_pptx, same as company deck).
2. Deepen P1 workflow screens from the catalog gap register: registration readiness read model, support SLA/incident, SIS reconciliation.
3. Course Studio (faculty authoring) and moderator workspace screens — currently catalogued, not built.
4. Write the highest-value docs from the catalog's "Not started" list (AI_GOVERNANCE_POLICY, DATA_INVENTORY, INCIDENT_RESPONSE, PILOT_DELIVERY_FACTORY) as doc-page files.
5. Run handoff/claude-code-toolkit/EXECUTE.md in the repo (needs Claude Code, not this project).

## Executable hand-off (Oct 2026)
- handoff/BUILD.md is the single entry point: rules, preflight, app target (Next.js; create web/ if app is Vite), install, stream order + gates, migration order 010–080, verify, human-only steps, definition of go. Scripts: handoff/preflight.sh, install.sh (no-overwrite, strips .txt), verify.sh (db reset, tsc, lint, unit, RLS/security/command, design-system, build, gitleaks). handoff/manifest.json. Seed (synthetic users with auth.identities), tests/helpers.ts, .env.test, .env.example added.
- Launch kit: sponsor weekly update email, incident notice email, staff training flier.

## Security deepening (Oct 2026)
- Reviewed migrations 010–040: 11 findings (F2 critical: ops.staff self-insert as ceo; F5 high: profile institution_id change; F1, F4 high). Fixed in handoff/semester-platform/supabase/migrations/050_security_hardening.sql.txt, proven by tests/security.test.ts.txt; docs/secure/Platform Security Review.html; stream 01 updated.
- 060_command_functions: all community/market writes via audited api.* functions (validation, rate limits, integrity filter, campus checks), direct inserts revoked, listing-photo storage policies; tests/commands.test.ts.
- AI gateway hardened: content scan blocks records typed into prompts (lib/ai/redact.ts), route app/api/ai/route.ts, 070_ai_gateway (tenant policy, course rules, usage log without prompt content), 20-case red-team suite.
- 080: approved-source AI context, private storage buckets, audited delegations; security headers middleware; CI security job (gitleaks, audit, guards, security tests).
- templates/privacy-center: student privacy & data screen (AI by data type with institution prop, sharing revoke, sessions sign-out, access history, export, deletion hand-off).
- 7 governance components added (components/governance/). Launch kit imported (ui_kits/launch-kit + 5 templates).

## Strategy (Oct 2026)
- docs/strategy/ (12 docs + README): competitive completion audit (20 areas), 19-dim competitive scorecard (~1.1/5), coherence test as release gate, implementation factory, mobile, AI differentiation + deterministic policy engine, trust advantage, 36-month plan. Competitive view added to ui_kits/platform-maturity.

## Business, design & data systems (Oct 2026)
- docs/business/ (17 + 5 subsystem docs: finance, revenue, trust, customer, people; SoR map, risk register, cadence, KPI tree, backlog, top 50). Price book updated: Student Premium $8.99/mo or $69/yr, AI overage $30/1k requests, implementation $35k–$150k, marketplace 12%.
- docs/system/ (design 8, algorithms 7, workflows 2, data 4 + README with next 25). OPEN DECISION: PDF proposes indigo primary + emerald/amber/rose; system keeps Semester blue + stone hues until founder decides.

## Platform maturity (Oct 2026)
- From uploads/what else is needed…pdf + Apple vs Google vs Microsoft…pdf: docs/platform/ (16 + 2 docs), ui_kits/platform-maturity/ (3 tiers, 12 pillars, 24-dim scorecard at ~1.2/5 design stage, API domains + contract, graph node fields + authority categories, 36-month roadmap, 7 stages, deployment ladder, moats/risks, next 50 actions), stream handoff/execute/13-platform-maturity.md.

## Product principle (Oct 2026)
- Nobody has to leave Semester: ui_kits/one-place/ maps 45 jobs (students, staff, institutions, company) to modules; regulated or institution-owned systems (bank, processor, payroll, IdP, SIS during transition, GitHub/Vercel) are embedded, not replaced. Stream handoff/execute/12-one-place.md.

## Rules to keep
- Nothing is "verified" without repo code, tests and release evidence.
- Company roles (investor, CS, revops) never see student records.
- Status, not certifications we don't hold. Cite every external number.

## Founder facts
LLC (home state), solo founder, bootstrapping, pre-seed no revenue. Paid Vanderbilt pilot signed: real student records, DPA/FERPA addendum, HECVAT Full, SAML SSO, VPAT/ACR, cyber + E&O insurance required (not held); dates not set. Hosting Vercel + Supabase; AI never sees student records. Setup budget $5k–$20k. Vanderbilt name cleared for public use.
