# Final validation — 2026-10-02

**Revision baseline:** `origin/main` at `92eeafd9`; readiness changes committed on `codex/market-readiness-transformation`.
**Decision:** validation supports continued repository work and accurate design-partner discovery; it does not support paid-pilot activation or GA.

## Green checks

| Check | Result |
| --- | --- |
| strict TypeScript (`tsc -b`) | PASS |
| lint, style, accessible-label, and vocabulary audits | PASS; 22 existing React/compiler warnings remain below the configured 25-warning ceiling |
| university gateway TypeScript | PASS |
| production build | PASS; Vite reports chunks above 500 kB, a performance maturity item |
| performance budgets | PASS — first load 435.0/479.0 KB; largest budgeted file 435.7/480.0 KB; 93 routes |
| exact ordered regression | PASS — 1,257/1,257 files, 19,610 tests passed, 48 intentional skips; zero failures |
| randomized-order regression | PASS — seed `1791001195069`; 1,257/1,257 files, 19,610 tests passed, 48 intentional skips; zero failures |
| focused accessibility route suite | PASS — 24/24 |
| timed-out ordered/shuffle files replayed independently | PASS — terms 10/10, engagement 3/3, keyread 3/3, soak 37/37, readers 2/2, sessionread 3/3, desk 35/35, billing webhook 4/4 |
| canonical deliverables | PASS — all 33 requested filenames present |
| relative Markdown links | PASS — zero broken local links in `docs/market-readiness/` |
| capability registry | PASS — valid JSON |
| diff whitespace | PASS |
| changed-file credential-pattern screen | PASS — no candidate credential assignment found |

The fast compile/lint/gateway/build gates were rerun after concurrent changes appeared in the worktree and remained green.

## Red or blocked checks

### Automated regression closure

Earlier ordered and shuffled runs failed only through load-sensitive timeouts. The runner now caps parallelism at four workers and gives the repository's medium-sized structural and component checks explicit 30-second budgets without changing assertions or deleting coverage. On the final snapshot, the exact standard command and a randomized-order run both passed all 1,257 files and all 19,610 executed tests. The repository-controlled automated-regression gate is **GREEN**.

### HawkScan DAST

Preflight was attempted under the active HawkScan skill. The `hawk` CLI is not installed and `HAWK_API_KEY` is unset, so no scan, quality gate, finding loop, or rescan could run. This is a hard security-evidence gap; do not claim “done and secure,” penetration tested, or paid-pilot ready.

### Dependency audit

The authoritative `package-lock.json` was reproduced with npm 10.9.3 in an isolated temporary install, and `npm audit --audit-level=high --omit=dev` reported zero vulnerabilities. The dated, lockfile-bound evidence is in [`docs/evidence/security/2026-10-02-production-dependency-audit.md`](../evidence/security/2026-10-02-production-dependency-audit.md). This repository-controlled gate is **GREEN**; it does not replace DAST or an independent penetration test.

## Browser acceptance

The local Guide deep link `#/guide/econ?mode=cards` was inspected in the in-app browser.

- Desktop 1440×1000, tablet 1024×768, and mobile 390×844 overrides: no horizontal document overflow, no stuck `aria-busy`, one `Guide` H1, and no screen error boundary.
- Mobile visual review: content hierarchy, two-column study modes, primary navigation, and floating action remain visible without clipping.
- Keyboard: first focus is “Skip to content”; Enter moves focus to `<main id="main">`; subsequent focus order is logical and named.
- Normal-load console: zero errors/warnings on a fresh tab.
- Slow/offline exercise: normal networking was restored and the route recovered with main content, no busy state, and no screen error. Development-only Vite hot-reload socket errors occurred during the deliberate offline cut and disappeared on a fresh tab.

This verifies one changed critical route, not every application workflow or a formal accessibility/performance conformance run.

## Pre-existing / concurrent work

At the start of this continuation, the worktree already contained the market-readiness package plus edits to `Guide.tsx`, `axe.test.tsx`, and `SEMESTER_MARKET_READINESS.md`. During validation, additional edits appeared in smoke scripts, component tests, `SampleMark.tsx`, `app.css`, evidence code, and evidence documents. They were preserved and not attributed to this task. The final fast gates include the visible concurrent changes; the earlier full/shuffled runs may span intermediate worktree states.

## Deferred non-blocking work

- Reduce production chunk sizes based on measured route/device impact.
- Drive lint warnings down rather than relying on the configured ceiling.
- Preserve the bounded-worker regression configuration and monitor its duration in CI.
- Expand browser acceptance to every launch-critical student/admin journey after the pilot scope is frozen.

## Launch blockers

The authoritative blockers remain: named customer/sponsor/champion and data scope; counsel-approved paper/public policies; pricing/payment/insurance authority; staffed support/security/privacy/data roles; target tenant isolation/authorization; HawkScan/current DAST and independent security review; qualified accessibility review; production monitoring; incident/restore/rollback/deletion/export/offboarding rehearsals; and representative UAT/outcome baseline. Exact automated regression, dependency audit, secret scan, build, type, lint, browser-journey, and budget gates are now green at repository scope.

## Final recommendation

- Individual acquisition: **YELLOW only for a clearly labeled, invitation-based beta after applicable gates; RED for broad/paid promotion.**
- Design-partner engagement: **GREEN for bounded, non-activation discovery, demos, evidence exchange, and scoping; RED for customer activation today.**
- Paid institutional pilots: **RED / NO-GO.**
- Broad enterprise sales: **RED / NO-GO.**
