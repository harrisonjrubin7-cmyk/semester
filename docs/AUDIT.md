# Phase 0 audit — Semester unified platform

**Baseline:** `origin/main` `c029822` (26 Sep 2026), audited 27 Sep 2026.
Read-only; no source code was changed. The companion documents:

| Document | Answers |
|---|---|
| [ROUTE-AND-FEATURE-CROSSWALK.md](ROUTE-AND-FEATURE-CROSSWALK.md) | Where each blueprint destination and route lives, or will live |
| [SPRINT-1-REGISTRATION-PATH.md](SPRINT-1-REGISTRATION-PATH.md) | Phase 1 requirement → what exists → gap |
| [DATA-MIGRATION-PLAN.md](DATA-MIGRATION-PLAN.md) | How stored data changes without loss |
| [SECURITY-GAP-ANALYSIS.md](SECURITY-GAP-ANALYSIS.md) | What is strong, what is open (S-1 … S-16) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | The system map and the invariants |
| [PRODUCT-ROADMAP.md](PRODUCT-ROADMAP.md) | Phases 0–8, exit gates, approvals |
| [CLAUDE-CODE-BACKLOG.md](CLAUDE-CODE-BACKLOG.md) | PR-sized items in order |
| [DECISION-LOG.md](DECISION-LOG.md) | Decisions and brief-vs-main conflicts (D-001 … D-011) |

## 1. Headline findings

1. **The supplied expansion work has already landed.** The patch, migration
   SQL and permission tests are byte-identical to #762 on main (D-001). The
   three named brief files do not exist in the repository.
2. **Much of the Phase 1 slice already exists.**
   - Path Snapshot and one Next Best Step (#761).
   - Course conflict detection, cart credit total, ranked clash-free backups,
     registration checklist and readiness (#762 and earlier).
   - Graduation scenarios with an advisor summary.
   - Feedback with a "wrong information" kind.
   - Password, OAuth and SSO sign-in.

   **Genuinely missing:**
   - a canonical Action entity with lifecycle and history
   - an advisor agenda
   - a clarity question
   - a shared source-label type
   - onboarding fields for program, target term, credit target and goals
   - personal-block conflicts
3. **No public website exists.** The live product is the hash-routed app on
   GitHub Pages (`https://harrisonjrubin7-cmyk.github.io/semester`).
4. **Security is strongest where it matters most.** RLS is on every table,
   capability-based policies are tested as a second account in 36 suites in
   CI, and there are no secrets in tracked files.

   **Most urgent gap:** the `claude` edge function forwards the caller's raw
   body with a call-count cap only (S-1).
5. **The briefs conflict with four decisions already on main** (navigation
   model, analytics scope, degree requirements, integration breadth). These
   are logged as D-003 to D-007; the existing decision holds until the owner
   reopens it.

## 2. Stack and commands

| | |
|---|---|
| Framework | React 19.3, Vite 8.3, TypeScript 7.0, Vitest 5, oxlint (`app/package.json`) |
| Package manager | npm workspaces (`package-lock.json` at the repository root); **all commands run from `app/`** |
| Routing | In-house hash router `app/src/lib/route.ts`; 81 `Screen` members (`lib/types.ts`); 79 lazy screens in `app/src/screens.tsx`; 59 navigable destinations on 8 shelves (`lib/nav.ts`); 6 nav modes; default 5-tab bar `home, courses, study, calendar, me` (`lib/tabbar.ts`) |
| State | Reducer over 10 slices (`app/src/state/`); IndexedDB `semester-store` with a `semester.v1` rollback copy; `lib/migrate.ts` `SCHEMA = 6`; ~50 `semester.*` device keys |
| Backend | Supabase Postgres (59 migrations), 6 edge functions, prepare-only institution gateway (`app/server/institution`, Vercel function `app/api/institution`) |
| Deploy | GitHub Pages via `.github/workflows/pages.yml` after CI on main; functions via `functions.yml`; DB via Supabase Branching on merge; hourly `production-smoke.yml`. **No frontend preview deploy.** |
| Demo data | `app/src/data/seed.ts`: 4 Vanderbilt Fall 2026 courses, `state.sample = true` by default, with a standing "These are mine / Not mine" banner (`components/SampleMark.tsx`) |

### Gate results at baseline (run in this audit, from `app/`)

| Command | Result |
|---|---|
| `npm ci` | pass |
| `npx tsc -b` | pass |
| `npm run lint` | pass: **25 warnings, at the `--max-warnings=25` ceiling** (D-010); styles and labels audits ok |
| `npm test` | pass: 702 files (1 skipped), **12,805 tests** passed, 13 skipped |
| `npm run test:shuffle` | pass: same counts, seed `1790523566725` |
| `npm run build` | pass (4.6 s) |
| Secret scan (regex over tracked files) | no real secrets; gitleaks not installed locally (CI runs it) |

Not run here: `supabase/check.sh` (needs a local Postgres 17), Playwright
smokes, and `test:zones`. CI runs all three.

## 3. Current behaviour of the areas the programme touches

| Area | Files | Current behaviour | Decision |
|---|---|---|---|
| Today | `screens/Today.tsx`, `components/TodayDecisionSurface.tsx`, `lib/today-decision.ts` | Tabs Today/Hours/This week/Done. For students: "Your path" (`incomplete/review/moving`, no invented denominator), one "Next best step" with "Why am I seeing this?", next 72 h | **Extend** (Action Center) |
| Onboarding | `screens/Onboarding.tsx`, `data/misc.ts` `ONB_STEPS=5` | Intro, syllabus, study times, optional account, reminders | **Extend** (optional path step) |
| Profile / account | `screens/Profile.tsx`, `lib/profile.ts`, `screens/Account.tsx`, `lib/cloud.ts` | Name, school, role; password, OAuth and SSO sign-in; device-only when unconfigured | **Preserve** |
| Degree | `screens/Degree.tsx`, `lib/degree.ts`, `lib/graduation.ts`, `components/GraduationSimulator.tsx` | Student-entered requirements; Scenarios with estimates and an advisor `.txt` | **Extend** |
| Registration | `screens/Yes.tsx`, `components/RegistrationPortal.tsx`, `lib/registration.ts`, `components/RegistrationDay.tsx`, `lib/registration-day.ts` | Catalog import, search, cart, credits, conflicts, 12 saved schedules, ≤5 ranked backups, checklist; never enrols | **Preserve / extend** |
| Conflicts | `lib/registration.ts`, `lib/clash.ts` | Course×course overlaps; deadline pile-ups 14 days out | **Extend** (personal blocks) |
| Advisor | GraduationSimulator summary; `lib/pathway.ts` step templates | No agenda object; no advisor access model | **Invest** |
| Feedback | `lib/feedback.ts`, `components/SaySomething.tsx` (Settings → About) | Five kinds including `wrong`; signed-in only | **Extend** |
| Analytics | `lib/activity.ts`, `ANALYTICS.md`, `lib/usage.ts` | Three server marks by check constraint; per-screen counts on the device only | **Defer collection** (D-005) |
| Provenance | `registration-day.ts` `TicketSource`, `skills-graph.ts`, `components/NotOfficial.tsx`, `intelligence/Disclosure.tsx` | Fragments; no shared type. The DB has the five-label enum | **Invest** (BL-1.1) |
| Flags | `lib/experience-flags.ts`, `lib/aiflags.ts`, `tenant_feature_policy` | Env-driven `off/preview/sandbox/production`; tenant AI policy in the DB | **Extend** (P5) |
| Accessibility | `app/src/a11y/*` (10 guards), `lib/contrast.test.ts`, `scripts/labels.mjs` | Labels, landmarks, modal focus, titles, focus rings, motion, drag alternatives, non-colour tellings, font size | **Preserve**; every new component inherits these guards |
| Public site | — | None | **Invest** (D-011) |

## 4. Documents

Established by reading all the root and `docs/` plans. Git dates are floors
because the clone's history is grafted at 21 Sep.

**Sources of truth going forward:**

| For | Source |
|---|---|
| Programme plan and status | These nine `docs/` files |
| Product intent | `docs/expansion/Semester-Master-Implementation-Brief-v2.md` + the blueprint (D-001) |
| Screen-level truth | `app/src/lib/nav.ts` + `git log origin/main` |
| Settled decisions | `DECISIONS.md`, `docs/architecture/` (ADRs 0003/0004 lag; BL-0.2) |
| Security/ops | `docs/market-readiness/GO_LIVE_CHECKLIST.md`, `INFRASTRUCTURE_READINESS.md`, `INCIDENT_RESPONSE.md` (25 Sep) + root runbooks `SECURITY.md`, `SECRETS.md`, `ROLLBACK.md`, `RESTORE.md`, `MONITORING.md`, `STAGING.md`, `RETENTION.md` |
| Gates | `.github/workflows/ci.yml` (authoritative) > `CLAUDE.md` > `REGRESSION-CHECKLIST.md` (stale counts; BL-0.1) |
| Today work in flight | `docs/market-readiness/TODAY_ADAPTIVE_BACKLOG.md` |

**Historical or superseded; read for reasoning, not status:**
- `ACTION-PLAN.md`
- `APP-AUDIT.md`
- `ENGINEERING-AUDIT.md`
- `FEATURE-INVENTORY.md`
- `IMPLEMENTATION-PLAN.md`
- `COMPLETION-PLAN.md`
- `FINAL-AUDIT.md`
- `GROUPED-AUDIT.md`
- `IMPROVEMENT-AUDIT.md`
- `SIMPLIFY-AUDIT.md`
- `SPEC-AUDIT.md`
- `MVP-GAP.md`
- `docs/APPLICATION_AUDIT.md`
- `SEMESTER_IMPLEMENTATION_PLAN.md` (its P0 has landed)
- `SEMESTER_IMPLEMENTATION_STATUS.md` and `SEMESTER_PRODUCT_COMPLETENESS_MATRIX.md` (rigorous but frozen at 21–22 Sep)
- `SEMESTER_MARKET_READINESS.md` and `EXECUTIVE_READINESS.md` (predate the SSO, monitoring and audit work of 23–25 Sep)

**Contradictions found and how they are resolved:**
- **Destination counts:** 52, 54, 58, 59 and 60 all appear. 59 is the figure from `nav.ts`.
- **Navigation model:** described four different ways (D-003).
- **Study modes:** 14 in the brief, 11 in the app (Phase 3 decision).
- **Readiness docs:**
  - They say "no SSO", "no uptime monitoring" and "no admin audit log", all contradicted by #749–#760.
  - They say "no playbooks", but `docs/market-readiness/*_PLAYBOOK.md` exist.
- **Regression gates:** CLAUDE.md, the checklist and CI disagree; CI governs.
- **Hosting:** the brief assumes Vercel, but production is GitHub Pages. `app/vercel.json` serves only the institution gateway.

## 5. Risks

| Risk | Mitigation |
|---|---|
| Concurrent sessions land the same fix (`CLAUDE.md`: 16 merges in an hour) | Re-check `origin/main` per slice; rebase before push |
| Lint budget exhausted | New code adds zero warnings; BL-0.4 |
| Onboarding asks for data students don't have | All path fields optional; absent means "not entered" |
| Action Center duplicates the Today decision | Build on `nextTodayDecision()`, not beside it |
| Schema cannot roll back | Additive migrations only (DATA-MIGRATION-PLAN) |
| AI spend (S-1) | BL-1.0 before any new AI surface |
| No frontend preview deploy | Phase 1 PRs verified with the `run` skill's browser screenshots; any preview host needs approval |

## 6. Recommended pull-request sequence

1. **This PR:** Phase 0 docs only.
2. BL-1.0 AI gateway clamp (security; independent).
3. BL-1.1 source labels.
4. BL-1.2 + BL-1.3 action model and store.
5. BL-1.4 Action Center on Today.
6. BL-1.5 + BL-1.6 path profile and Path Snapshot.
7. BL-1.7 + BL-1.8 schedule blocks and readiness workflow.
8. BL-1.9 Advisor Meeting Mode.
9. BL-1.10 clarity and report-incorrect.
10. BL-1.12 pilot E2E.
11. BL-1.13 five-destination labels (after D-003).
12. Phase 2, after D-011 and D-009.

Each is small enough to review in one sitting and carries its own tests,
doc update and DECISION-LOG entry.
