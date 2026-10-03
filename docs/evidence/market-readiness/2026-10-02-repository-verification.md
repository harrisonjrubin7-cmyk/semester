# Market-readiness repository verification

**Produced:** 2026-10-02
**Branch:** `codex/market-readiness-transformation`
**Baseline:** `origin/main` at `fc08913447d691cf0fa8ef757dc365a3b7d8275d`
**Scope:** repository-controlled engineering and delivery artifacts. This is not institutional approval, production operation, independent assurance, legal approval, or customer-outcome evidence.

## Results

| Gate | Result | Evidence from this run |
| --- | --- | --- |
| Full automated regression | PASS | independent final-snapshot rerun: 1,257 test files passed; 19,610 tests passed; 48 intentionally skipped; zero failures; 575.62 seconds |
| Randomized-order regression | PASS | seed `1791001195069`: 1,257 test files passed; 19,610 tests passed; 48 intentionally skipped; zero failures; 540.10 seconds |
| TypeScript | PASS | `tsc -b --noEmit` exited 0 |
| Product build | PASS | production build completed for `/semester/` |
| Lint and language checks | PASS | oxlint passed within the repository's 25-warning budget; style, accessible-label, and retired-term checks passed |
| Performance budgets | PASS | first load 435.0/479.0 KB; largest budgeted file 435.7/480.0 KB; 93 routes |
| Production performance lab | PASS | self-validating smoke required a successful document, visible H1, and no page/request failures; three cold runs each for home, work, and degree at phone/desktop; worst p75 FCP 1,056ms, LCP 1,396ms, CLS 0.01, and blocking 80ms |
| Cold-route browser check | PASS | five production-bundle cold boots opened the intended destinations |
| Journey accessibility | PASS | six critical journeys at desktop and 400% reflow; focus, landmarks, titles, accessible names, and ARIA references checked |
| Rendered contrast | PASS | 40 production-browser passes over ten critical routes at phone/desktop on Paper and Ink; 3,994 text elements measured; zero findings |
| Touch-target matrix | PASS | ten critical routes at phone/desktop across Comfortable, Snug, and Tight density; zero controls below the WCAG 2.2 AA 24px minimum in all six matrices |
| Action hierarchy | PASS | all 63 destinations plus 84 internal tabs opened; zero page errors, zero unranked action walls, and zero screens with more than one filled action |
| Pilot browser journey | PASS | registration/path workflow passed at 390px and 1280px, including explanation, action, clarity, reload, and persistence |
| Golden student journey | PASS | 13 steps passed at phone and desktop, including first run, syllabus import, planning, help, completion, reload, second tab, and backup restore into a fresh context |
| Institutional preview | PASS | seven route/viewport probes, compact chrome at 292px with 44px targets, tenant-context isolation, and 12 role-specific workspaces |
| Public production reachability | PASS, LIMITED | frontend HTML, deployed module and stylesheet, and Supabase PostgREST returned 200; this is reachability, not user acceptance or an SLA measurement |
| Clean install | PASS | isolated `npm ci --ignore-scripts` reproduced 220 packages from the lockfile in eight seconds |
| Production dependency audit | PASS | npm 10.9.3 reported zero vulnerabilities at `--audit-level=high --omit=dev` |
| Secret scan | PASS | checksum-verified Gitleaks 8.28.0 scanned approximately 518.06 MB and reported no leaks |
| Production SBOM generation | PASS | npm generated CycloneDX 1.5 JSON for the production dependency graph |
| Focused security and recovery controls | PASS | 27 files and 636 tests passed across authentication, authorization, tenant isolation, injection resistance, CSP, host validation, privacy, rate limiting, incident recovery, RLS, and backup coverage |
| Credentialed kill-switch drill | NOT RUN | the drill correctly refused to run without `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and a designated drill account session; no production-drill claim is made |
| HawkScan DAST | NOT RUN | `hawk scan` was invoked after the code changes and failed because the Hawk runtime is not installed; `HAWK_API_KEY` is also unavailable; no pass is claimed |

## Defects closed during verification

- Prevented Guide listen mode from failing during a cold dynamic-catalog load.
- Made the accessibility harness fail when the application error boundary renders.
- Registered the dependency and secret-scan evidence in the governed evidence register.
- Removed full-suite timing flakiness from four integration tests by giving those known multi-second workflows explicit 15-second budgets; all pass in the standard full suite.
- Updated the pilot and institutional browser journeys to current accessible controls and progressive-disclosure behavior.
- Removed the misleading “These are mine” sample-course adoption banner from the institutional demo while preserving its permanent fictional-data disclosure.
- Reduced institutional desktop chrome so page content begins at 292px, within the 320px budget, without shrinking 44px navigation targets.
- Raised the persistent mobile context controls to the shared primary target size, eliminating the repeated sub-24px connection/account targets at every density.
- Replaced the five-equal-action assignment wall with one visible default and a disclosed alternatives list; removed competing filled actions on Today and Connect.
- Replaced Work's large-text-only faint token with the small-text secondary token where the honor-code note renders at extra-small type.
- Added `scripts/performance-smoke.mjs`, including controls that reject a blank HTML fallback, missing H1, failed request, page error, or out-of-budget p75 metric.

## Remaining gates outside repository control

Independent penetration testing, qualified assistive-technology evaluation/formal ACR, counsel-approved and executed agreements, insurance, staffed support/on-call ownership, named-tenant acceptance, production restore/incident/deletion drills, live provider acceptance, and measured customer outcomes remain open. Those are binary activation gates; this record does not convert them into implementation scores.
