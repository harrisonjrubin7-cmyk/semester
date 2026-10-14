# Handoff: Semester — launch program (deploy, activate, operate)

_Refreshed 2026-10-12: live integration layer, workflow engine migration, ship program, pilot wording, four connected journeys._

## Overview
This package tells a developer using Claude Code, working inside the real repository `harrisonjrubin7-cmyk/semester` (branch `main`), how to take Semester from designed prototypes to a deployed, activated and operated platform. It ties together:
- the design prototypes in this project (what each workspace should look and behave like),
- the proposed repository patches already prepared (`../production-integration-review/`, `../launch-control-review/`),
- the completion kit (`../completion-kit/`): 417 validation tests, 257 approval artifacts, 29 feature flags with rollback, 11 shared blockers,
- the release gates (Phase one G01–G25, Security Assurance release gates, Path-to-green evidence rules).

**Nothing in this package has been deployed, migrated or activated.** Activation is gated by evidence and, for institution-facing features, by the institution's written approval. Code alone cannot satisfy those gates.

## About the design files
Every `.html` file referenced here is a **design reference built in HTML**: a prototype showing intended layout, copy, states and rules, using sample data and `localStorage`. Do not ship the HTML. Recreate each workspace inside the repo's existing app (`app/` — Vite + TypeScript, `app/src/screens/*`, `app/src/components/*`, `app/src/lib/*`, Supabase under `supabase/`), using its existing components (`components/unity/*`, `components/console/*`), tokens (`app/src/styles/tokens.css`) and permission library (`app/src/lib/permissions.ts`).

## Fidelity
High-fidelity for copy, states, authority labels and rules (these are the contract). Visual styling should follow the repo's existing design system; this project's tokens (`styles.css`) mirror it.

## Order of work (do not reorder)
1. **Freeze and reconcile.** Pin a candidate commit. Map every workspace in `ui_kits/platform/index.html` (route registry, `#/routes`) to real routes in `app/src/screens`. Record gaps in the completion register (`ui_kits/completion-register/`, Path to green tab).
2. **Apply the docs-only patches** on a clean branch rebased onto current `main`:
   ```sh
   git apply --check ../production-integration-review/semester-production-integration.patch
   git apply ../production-integration-review/semester-production-integration.patch
   git apply --check ../launch-control-review/proposed-launch-control.patch
   git apply ../launch-control-review/proposed-launch-control.patch
   python -m unittest discover -s docs/production-integration -p 'test_*.py' -v
   python -m unittest discover -s docs/launch-control-guide -p 'test_*.py' -v
   ```
   Both were generated against `4b4f8ca`; resolve conflicts against newer `main` before applying. They add docs and local test orchestration only.
3. **Close the database trust boundary first.** Run `../security-assurance/assurance-registers.sql` (read-only) against **staging**. Every exposed table needs RLS + per-command policies + negative tests; every `SECURITY DEFINER` function needs EXECUTE revoked from PUBLIC, a fixed `search_path`, caller checks and direct-invoke tests. Never ship the service-role key to a browser.
4. **Build the shared foundations A–G** (completion register → Foundations tab): reconcile system, tenant isolation, persistence/offline, async + adapters (approved `ADAPTERS` is empty today), governed AI (route all ≈39 `ask()` consumers through the gateway), accessibility, operated service.
5. **Implement workspaces** in this order, each as a vertical slice that passes its validation tests (`../completion-kit/matrices/validation_tests.csv`, filter by domain):
   identity/account → institution console + operations → student (Today, courses, assignments) → faculty (Course Studio, gradebook) → registrar (readiness) → advising → finance → student affairs → public web + company → external portals → developer → community/marketplace.
6. **Deploy with activation off.** CI → isolated preview → schema rehearsal → immutable release manifest (`../completion-kit/templates/release_manifest.json`) → approval → compatible DB expand → functions/API → app → smoke + role workflows. All 21 flags stay `defaultEnabled:false`.
7. **Activate per tenant, per capability,** only when the Path-to-green cell has evidence and the institution's approval package (14 items) is signed. Each flag needs a working kill switch and a drilled rollback (`../completion-kit/matrices/feature_flag_rollback.csv`).
8. **Operate.** Named primary/backup responders, real alert delivery, restore/rollback/incident drills recorded with `../completion-kit/templates/drill_record.md`.

## Screens / views (design references)
Open `ui_kits/platform/index.html` — the single entry. Sign in as "Semester team (design review)" to see every workspace, or as any of 13 personas to see role-scoped access. Key references:

| Workspace | Route (proposed) | Design reference | Rules that must survive implementation |
|---|---|---|---|
| Account & Mail | `/account` | `ui_kits/semester-account/` | stable account id; username ≠ mailbox ≠ enrollment; never link schools by matching email; 3 honest mail states |
| Student OS | `/app/today` | `ui_kits/student/`, `ui_kits/course-workspace/` | one canonical item list feeds Today/calendar/course tabs; ARIA tree + separate tab strip; per-course AI policy |
| Grades, degree, transcripts | `/app/grades` | `ui_kits/academic-records/` | graded ≠ released; ungraded ≠ 0; planned never counts; official transcript only from posted grades |
| Faculty OS | `/teach` | `ui_kits/course-studio/`, `ui_kits/faculty-grading/` | AI suggestions stay draft; final grade blocked while items unresolved |
| Registrar OS | `/registrar` | `ui_kits/registrar-console/`, `ui_kits/readiness-pilot/` | readiness is not enrollment; receipts |
| Institution console | `/console` | `ui_kits/console/`, `ui_kits/roles-access/` | 51 roles as permission bundles; approver ≠ requester; privileged grants expire ≤ 90 d; SoD rules |
| Operations OS | `/ops` | `ui_kits/ops-inbox/`, `ui_kits/pilot-launch/`, `ui_kits/agent-ops/` | two-person activation; evidence expires 90 d; agents start read-only |
| Network | `/community` | `ui_kits/network/` | marketplace integrity checks; consent-based mentoring; family grants with expiry + access history |
| Company / investor | `/company` | `ui_kits/investor-portal/` | all figures sample; immutable publications; small-cohort suppression |
| Ship program | — | `ui_kits/ship-program/` | 14 workspaces × 12 operating-proof items; production states locked < 10/12; active locked < 12/12 |
| Governance | — | `ui_kits/security-assurance/`, `ui_kits/completion-register/`, `ui_kits/phase-one/` | no evidence, no release |

## State, data and authority
Use the phase-one shared schema (`ui_kits/phase-one/` → Shared records): composite `(institution_id, id)` keys and foreign keys on every institution-managed table; authority envelope `origin` / `authority` / `sourceVersion` / `observedAt`; immutable submission versions; receipts + outbox written atomically; timeouts are "unknown", never success or failure.

## Design tokens
Use `app/src/styles/tokens.css`. This project's `styles.css` mirrors it (Ink chrome, Parchment content, Semester blue actions, glyph + word for every status; Barlow / Barlow Condensed / Cinzel editorial only).

## Status facts to preserve
- Vanderbilt pilot: **Signed paid pilot with Vanderbilt — launch Spring 2027, pending institutional activation** (founder decision, 2026-10-12). Use this exact wording. **Update `GO-NO-GO-DECISION.md` in the repo**, which still records paid institutional pilot as NO-GO; signing does not by itself authorize data access, activation or naming the customer publicly — those need the institution's separate approvals.
- Vendor assessment wording: "HECVAT (institution-required version)" — HECVAT 4 merges Full/Lite/On-Prem.
- Accessibility: WCAG 2.2 AA engineering target; DOJ Title II specifies 2.1 AA for covered public entities.

## Files in this bundle
- `README.md` — this file
- `platform-index.html` — copy of the platform shell (route registry is in its `WS` array)
- `roles-data.js` — 51 roles × 25 capabilities model
- `assurance-registers.sql` — read-only catalog queries
- Sibling folders in the project's `handoff/`: `production-integration-review/`, `launch-control-review/`, `completion-kit/`, `developer-integration-pack/`, `unified-platform-starter/`, `slack-app/`, `governed-workspace/`, `security-assurance/`
- All design references live under `ui_kits/` in the project; download the whole project to have them alongside.


## Live integration layer (added 2026-10-11, extended 2026-10-12)
After the platform shell is in the repo, install `../live-integration/` (see its README): additive `live_*` migration with forced RLS, five edge functions (OneRoster read, LTI 1.3, Stripe, Postmark messaging, idempotent institutional commands), per-tenant capability switches that default off and need an approval reference, a kill switch, and the connected-journey Playwright suite. Deploy to staging, pass the suite, then repeat in production with the owner’s credentials.

Migrations, in order:
1. `20261011120000_live_integration.sql` — grants, capability switches (enabled requires approval_ref + approver), connections, SIS staging, idempotent command receipts, outbox, payments, messages.
2. `20261012090000_live_workflows.sql` — 16 workflow types × 12 states, transitions enforced by trigger (an illegal jump fails for everyone, including workers), step log, integration health. Tenant access comes from grants via `auth.uid()`; do **not** key RLS on a client-settable `current_setting('app.current_tenant_id')`.

Still to write in the repo: the outbox worker (delivers `live_outbox` events to the SIS/LMS and reconciles receipts to `reconciled`), and a workflow worker that advances `live_workflows`. Until they run, write receipts mean "queued", not "done".

## Ship program (added 2026-10-12)
`ui_kits/ship-program/` maps every workspace to the 12-point operating proof (route, guard, capability entry, API contract, data model, audit path, owner, runbook, tests, release evidence, monitoring, operator view) and the promotion states designed → implemented → contract-validated → tested → staging-ready → staging-verified → production-deployed → production-smoke-passed → active. Treat its ~20 "services" as authority boundaries inside the existing app (schemas, edge functions, workers), not new deployables.

## Connected journeys to implement as release tests
The design project's `ui_kits/connected-journeys/` prototype (four Vanderbilt journeys sharing one record set) is the acceptance reference: student, faculty, registrar and institution onboarding. A grade released in the faculty journey must appear in the student journey; a hold released by the registrar must change student readiness; institution onboarding must gate every other journey until SSO, SIS read and the first cohort are active.


## Start the build (2026-10-14)
Begin with `../build-plan/sprint-pilot-001/README.md` — registration readiness as one end-to-end release candidate. Production Supabase project: `semester`. Owners: `../build-plan/DECISIONS-2026-10-14.md`.
