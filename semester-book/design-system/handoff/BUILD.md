# BUILD.md — the single entry point for Claude Code or Codex

Read this whole file before doing anything. It is written so an agent can build Semester without guessing. When anything here conflicts with another file, **this file wins**, then `execute/00-INDEX.md`, then stream files, then design docs.

## 0. Ground rules (non-negotiable)
1. Work in `harrisonjrubin7-cmyk/semester`. One branch per stream: `semester/<stream>`. One PR per stream. Never push to `main`, deploy, change production settings or secrets.
2. **Repo beats design.** If the repo already has something, extend it. Record exists / extended / new for every item in the PR.
3. Never mark anything done without the verify output pasted into `docs/execute/<nn>-<slug>-report.md`.
4. Stop and report (do not improvise) when: a gate fails twice; a migration would edit an applied migration; a test needs weakening to pass; anything touches real student data; a human-only step is reached (§7).
5. Product rules enforced in code: RLS + tenant_id everywhere; browser calls server/RPC only; company roles never read student tables; AI never receives student records (scope gate + content scan); every consequential action = preview → audit → apply → undo/request; official systems stay authoritative.

## 1. Preflight
```bash
git checkout main && git pull
mkdir -p design && cp -R <design-project-export>/* design/      # handoff/, templates/, docs/, ui_kits/, guidelines/, readme.md, SKILL.md
bash design/handoff/preflight.sh                                  # must print PREFLIGHT OK
```

## 2. App target
- The API routes, middleware and tests in `semester-platform` are **Next.js App Router + Supabase**. If `app/` is already Next.js, install there (`APP=app`).
- If `app/` is Vite + React: keep it for the student UI and create `web/` with `npx create-next-app@latest web --ts --app --eslint --no-tailwind --src-dir`, then `APP=web`. The Vite app calls `web`'s API. Do not rewrite the Vite app in this stream.

## 3. Install
```bash
APP=<app|web> bash design/handoff/install.sh                     # never overwrites; FORCE=1 only with a reason in the PR
(cd $APP && npm i @supabase/supabase-js @supabase/ssr zod && npm i -D vitest dotenv dotenv-cli)
cp $APP/.env.example $APP/.env.local                              # fill from: npx supabase status
```

## 4. Order of work
| Stream | File | Gate to pass before the next |
| --- | --- | --- |
| 00 | execute/00-setup.md | CI green; REPO_AUDIT.md; design-system baseline approved by founder |
| 01 | execute/01-platform-core.md | `verify.sh` steps 1–5 green; every policy red-then-green |
| 02 | execute/02-identity-sso.md | SSO test login per pilot role (staging IdP) |
| 03 | execute/03-student-os.md | Student workflow e2e; 5 states per screen |
| 04 | execute/04-staff-academic.md | Two-person approvals tested |
| 05 | execute/05-institution-integrations.md | Reconciliation 0 unexplained mismatches |
| 06 | execute/06-ai-gateway.md | ai-redteam suite green; no prompt content in logs |
| 07 | execute/07-community-career-family.md | Feature switches; revoke works immediately |
| 08 | execute/08-ops-command-center.md | /ops cannot read student tables (test) |
| 09 | execute/09-trust-security.md | Restore drill timed; axe clean on pilot routes |
| 10 | execute/10-launch.md | Every go/no-go gate has evidence |
| 11 | execute/11-company-site-grow.md | Claims sourced; a11y ≥ 95 |
| 12 | execute/12-one-place.md | Every one-place row has an in-app path |
| 13 | execute/13-platform-maturity.md | Scorecard re-scored from repo evidence |

Pilot-critical path: **00 → 01 → 02 → 03 → 06 → 05 → 09 → 10**. Streams 04, 07, 08, 11–13 may follow after the pilot launches.

## 5. Migrations (exact order)
010 core → 020 community → 030 marketplace → 040 ops → **050 security hardening** → **060 command functions** → **070 AI gateway** → **080 sources, storage, delegations**. Renumber after the repo's latest migration if needed, keeping this order. 050 must be applied before any data.

## 6. Verify (run after every stream)
```bash
APP=<app|web> bash design/handoff/verify.sh                      # must end with ALL GATES PASSED
```
Then add the stream's own exit gates. Paste the full output into the report.

## 7. Human-only steps (the agent stops and asks)
- Bind cyber + E&O insurance · sign the DPA/FERPA addendum · submit HECVAT Full · attorney review of docs/legal/*
- Provide the Vanderbilt staging IdP metadata and test accounts · name IT, registrar and sponsor contacts
- Approve the design-system baseline · approve every PR · approve production cutover (docs/launch/Cutover Plan.html)
- Choose the AI provider and sign its data terms (no training, no retention)

## 8. Definition of go
All of: streams on the pilot-critical path merged; `verify.sh` green on main; launch runbook go/no-go gates each with evidence; §7 complete. Then follow docs/launch/Cutover Plan.html C1–C11.

## 10. Coverage map — every part of the design project and the stream that builds it
| Design project area | What it is | Built by stream | Reference |
| --- | --- | --- | --- |
| Tokens, type, colour, spacing, motion, patterns | Design foundations | 00 (toolkit sync), then every UI stream | tokens/, guidelines/, readme.md |
| Components (core, forms, data, feedback, surfaces, overlays, navigation, trust, governance) | 64 components | 00 maps to app; 03–08 use them | components/, docs/system/design/SEMESTER_COMPONENT_LIBRARY.md |
| Student app, mobile, privacy center, platform shell | Student OS | 03 | ui_kits/student, ui_kits/mobile, templates/privacy-center, templates/platform-shell |
| Role onboarding (13 roles) | First-run per role | 02 | templates/role-onboarding |
| Staff workspaces, Course Studio | Faculty, TA, advisor, registrar, finance, student affairs | 04 | ui_kits/staff |
| Institution console, Institution OS | Control plane, integrations, migration | 05 | ui_kits/console, templates/institution-os, templates/console-screen |
| AI gateway, Ask Semester | Governed AI | 06 | semester-platform/app/api/ai, lib/ai, 070 |
| Community & marketplace, external audiences, career, family, developer platform | Social, market, career, guardian, partners | 07 | ui_kits/community, ui_kits/external |
| Operations consoles, Command center, One place | Company runs inside Semester | 08, 12 | ui_kits/ops, templates/command-center, ui_kits/one-place |
| Security, privacy, accessibility, compliance | Controls, evidence, ACR | 09 | docs/secure, docs/build/Accessibility Test Plan.html, ui_kits/compliance |
| Launch runbook, cutover, support, launch kit | Go-live | 10 | docs/launch, ui_kits/launch-kit |
| Company site, GTM, legal pages, brief | Public site and sales | 11 | ui_kits/company-site, docs/grow, docs/legal, docs/brief |
| Platform maturity, strategy, business OS, system docs | Programs and standards | 13 (plus monthly review) | docs/platform, docs/strategy, docs/business, docs/system |
| Master catalog, every screen, gap screens, role pages, workflow runner, atlas, role lens, wireframes | The full inventory (673 screens, 17 workflows, 319 steps, 49 roles) | Acceptance list for 03–08: each catalogued screen and workflow step must exist in the app or be listed as deferred in the PR | ui_kits/master-catalog, every-screen, gap-screens, role-pages, workflow-runner, docs/master |
| Architecture, read models, environments | System design | 01 | ui_kits/architecture, guidelines/arch-*.html |
| Decks, reports, teaser, poster, research brief, vision deck | Sales and launch materials | Not code: export from the design project (PDF/PPTX) | templates/* |
| Business workspace, operating manual, finance model, hiring | Running the company | Not code: used by the founder; /ops modules in 08 | ui_kits/business, docs/run |

**Completeness rule:** at the end of streams 03–08 the agent runs a coverage check: every screen in docs/master/SEMESTER_SCREEN_CATALOG.md and every step in SEMESTER_WORKFLOW_CATALOG.md is either implemented (route + test) or listed as deferred with a reason and priority. Nothing is silently skipped.

## 9. Where things are
`execute/` stream prompts · `semester-platform/` DB, API, tests · `semester-core/` decision logic · `claude-code-toolkit/` design-system tooling · `manifest.json` every file and its destination · design references in `../ui_kits`, `../templates`, `../docs`.
