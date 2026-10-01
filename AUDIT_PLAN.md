# Semester product hardening audit plan

## Audit identity

- Product: Semester, the existing device-first academic operating system.
- Repository: `harrisonjrubin7-cmyk/semester`.
- Worktree: `.worktrees/product-hardening-audit`.
- Branch: `codex/product-hardening-audit`.
- Baseline: `origin/main` at `f496fad7b3ffcc80abad717cc471f91a2c7bb938`.
- Delivery boundary: changes and evidence in this branch. A local result is not a
  merge, deployment, live-backend change, tenant activation, or institutional
  approval.

## Current architecture

Semester is a React 19 and TypeScript 7 single-page application built with
Vite 8. Its hash router and screen registry live in `app/src/lib/route.ts` and
`app/src/screens.tsx`; shared navigation metadata lives in `app/src/lib/nav.ts`.
The application is device-first: IndexedDB and local storage hold the working
copy, while optional Supabase authentication and sync provide cross-device
continuity. Supabase row-level security is the server authorization boundary;
client-side role checks are presentation only. Governed edge functions proxy
AI, calendar, LMS, notification, and interoperability work. A separate
institution gateway under `app/server/institution` uses the shared contracts in
`packages/institution`.

The application is built from `app/`. The same codebase supports a subpath
deployment and Vercel-hosted contexts. This audit does not change a deployment
or a live Supabase project.

## Existing strengths

- A mature domain model and single registries for screens, modes, navigation,
  capabilities, and release evidence.
- Strong student-control boundaries: mutating assistant actions are proposals,
  source reads are disclosed, and uncertain source claims remain uncertain.
- Extensive automated coverage across application logic, institutional
  contracts, accessibility helpers, security controls, and release governance.
- Existing semantic landmarks, route focus management, skip navigation, error
  boundaries, empty-state primitives, reduced-motion behavior, and keyboard
  reordering.
- Deliberate device-first persistence, recovery, degraded-mode, and offline
  behavior instead of treating the network as permanently available.
- Security documentation, RLS checks, secret scanning, dependency overrides,
  CSP/security headers, and a DAST configuration already exist.

## Highest-risk areas

1. **Validation headroom and signal quality.** The most recent complete audit
   found the React lint-warning budget exactly exhausted. A green check with no
   headroom makes the next unrelated warning fail the gate and can obscure
   meaningful regressions.
2. **High-complexity critical surfaces.** Calendar, Today, writing, sheets,
   persistence, cloud sync, and the institution sandbox are large and carry
   scheduling, data-loss, privacy, or authorization consequences.
3. **Runtime-only quality.** Static and unit coverage cannot prove focus order,
   viewport fit, accessible names, console cleanliness, and real state recovery
   across the application shell.
4. **Fail-open presentation defaults.** Persisted display or navigation values
   can outlive the version that wrote them. Unknown values must recover visibly
   and safely rather than silently selecting an unintended mode.
5. **Instrument blind spots.** Prior contrast work documented gradient and
   interaction-state coverage gaps. Clean output from an incomplete probe is
   not evidence that the uncovered states pass.
6. **Security boundary drift.** The browser is untrusted, RLS is authoritative,
   and feature flags do not authorize activation. Changes touching sync,
   institution APIs, AI gateways, or stored tokens need boundary-specific tests
   and DAST verification.

## Highest-impact opportunities

- Restore meaningful lint headroom by fixing root causes in user-facing React
  paths without weakening the gate or suppressing diagnostics.
- Harden persisted-preference parsing and recovery with explicit tests for
  unknown values and older stored shapes.
- Exercise the real shell at phone and desktop widths, including keyboard-only
  navigation, critical focus transitions, accessible names, empty/error states,
  and console/network failures.
- Prefer shared state and feedback primitives for loading, empty, error,
  recovery, and destructive-action confirmation when audits find bespoke gaps.
- Add focused regression coverage for each defect before changing production
  behavior, then measure performance changes rather than assuming them.

## Prioritized implementation plan

### P0 — release-blocking correctness and safety

1. Establish build, typecheck, lint, full-test, institution-check, and security
   baselines from the exact commit above.
2. Investigate every failing gate and any browser-observed crash, inaccessible
   critical interaction, data-loss path, authorization gap, or secret exposure.
3. Fix confirmed P0 defects with the smallest compatible change and a regression
   test. Do not bypass RLS, activation gates, or confirmation boundaries.

### P1 — core workflow and accessibility hardening

1. Audit onboarding/import, Today planning, course/study navigation, personal
   work capture, recovery/export, account/sync, and governed assistant actions.
2. Verify keyboard completion, route focus, dialog dismissal/focus return,
   accessible names, live feedback, 320 px layout, zoom/reflow, and reduced
   motion in a real browser.
3. Fix the highest-impact confirmed gaps, using existing UI and state primitives
   and preserving the established near-black/chrome/silver/restrained-blue
   product language.

### P2 — maintainability, performance, and developer experience

1. Reduce validated warning debt and split only the complexity that obstructs
   safe change or produces measured runtime cost.
2. Re-run startup and route budgets after any loading-boundary change.
3. Improve audit instrumentation where a known blind spot can produce a false
   clean result.
4. Record validation evidence and remaining risk in `IMPROVEMENT_REPORT.md`.

## Validation strategy

- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `pnpm check:university`
- focused tests added for each repair
- existing accessibility, target-size, performance-budget, and golden-path
  checks where their prerequisites are available
- real-browser phone and desktop verification with console and accessibility
  inspection
- HawkScan after meaningful code changes, followed by remediation and a clean
  rescan when the runtime and credentials are available

## Assumptions and constraints

- Existing feature behavior is preserved unless evidence identifies a defect,
  safety issue, or substantial usability/accessibility problem.
- Existing uncommitted work in other worktrees is out of scope and remains
  untouched.
- Attached and repository documents are specifications and evidence, not
  authorization for production activation or institutional decisions.
- Live-model tests, production smoke tests, Supabase policy checks, and DAST may
  require credentials or services that are not present locally. An unavailable
  external gate will be reported as unverified, never as passing.
- This pass prioritizes evidenced P0/P1 improvements over broad rewrites or
  decorative polish.
