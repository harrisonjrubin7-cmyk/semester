# Native Student Flight Plan Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Semester's source-aware, capacity-bounded Flight Plan as native modules inside the current Home, Calendar, Study, University and Inbox screens without replacing the existing shell, routes or capabilities.

**Architecture:** The existing `App` remains the only application root and the current screen registry remains authoritative. A shared, preview-only institutional context supplies the selected synthetic institution and persona to additive modules. A deterministic domain model owns planning, provenance, recovery, learning evidence and locally prepared drafts; screen adapters render that model with existing Semester components and tokens.

**Tech Stack:** React 19, TypeScript, Vitest/jsdom, existing Semester store and design tokens, Vite browser smoke, local synthetic preview fixtures.

**Spec:** `docs/superpowers/specs/2026-09-23-semester-institutional-rollout-design.md`

## Global Constraints

- Preserve `App` as the only product root; `Respond` remains the only public form-response root.
- Preserve every current route, destination, saved navigation mode, app-directory entry and existing screen workflow.
- Use existing Semester tokens, components, headings and shell landmarks; create no standalone global navigation or visual system.
- Institutional persona selection is presentation context only and never grants production authorization.
- Synthetic records remain visibly synthetic and partitioned by institution and role.
- Uncertain dates stay out of the plan until confirmed; personal recovery actions never change source deadlines.
- No external message, LMS write, appointment, registration or institutional transaction may be represented as completed without authoritative readback.
- Essential planning and recovery remain deterministic and usable without AI.
- The unflagged production-default application must render exactly as it does before this slice.

## Review Focus

- Switching institution or persona must not leak tasks, drafts, mastery evidence or activity history across contexts.
- A malformed or cross-context local backup must be rejected without overwriting the current workspace.
- Text scaling, keyboard focus, narrow-screen reflow and landmarks must remain valid when native modules appear.
- Existing personal course data and synthetic institutional records must be visually and structurally distinguishable.
- Feature-flag-off builds must not load, render or persist preview-only state.

---

### Task 1: Shared institutional preview context

**Files:**
- Create: `app/src/components/institutional/PreviewContext.tsx`
- Create: `app/src/components/institutional/preview-context.test.tsx`
- Modify: `app/src/components/InstitutionalPreviewBar.tsx`
- Modify: `app/src/components/institutional-preview-bar.test.tsx`
- Modify: `app/src/App.tsx`

**Interfaces:**
- Produces: `InstitutionalPreviewProvider`, `useInstitutionalPreview()`, selected fixture and selected persona.
- Consumes: `INSTITUTIONAL_FIXTURES`, `INSTITUTIONAL_PREVIEW`.

- [ ] Write a failing jsdom test that renders the provider, preview bar and a consumer; changing institution must update the consumer and select that institution's first persona.
- [ ] Run `cd app && vitest run src/components/institutional/preview-context.test.tsx src/components/institutional-preview-bar.test.tsx` and confirm failure because the shared context does not exist.
- [ ] Implement a provider whose state lives inside the existing `App` tree and whose hook throws a clear developer error outside the provider.
- [ ] Refactor `InstitutionalPreviewBar` to consume the shared context without adding storage, grants or authorization behavior.
- [ ] Wrap the existing app frame and bar with the provider only when `INSTITUTIONAL_PREVIEW` is true; leave the unflagged tree unchanged.
- [ ] Re-run the focused tests and `src/a11y/landmarks.test.ts`; expect green.
- [ ] Commit: `Add shared institutional preview context`.

### Task 2: Harden the deterministic Flight Plan domain

**Files:**
- Modify: `app/src/lib/flight-plan.ts`
- Modify: `app/src/lib/flight-plan.test.ts`
- Create: `app/src/lib/flight-plan-storage.ts`
- Create: `app/src/lib/flight-plan-storage.test.ts`

**Interfaces:**
- Produces: `createWorkspace`, `buildPlan`, `nextFlightAction`, recovery mutations, learning evidence, validated serialization and context-scoped storage keys.
- Consumes: institution id and preview role from Task 1.

- [ ] Add failing tests for one ranked next action, stable session ordering, context-scoped storage keys, unavailable storage, schema-version rejection and non-mutating recovery.
- [ ] Run the two domain test files and confirm each new assertion fails for the missing interface or behavior.
- [ ] Normalize the existing exploratory model to repository formatting and preview fixture types; keep authoritative source facts immutable.
- [ ] Implement validated read/write helpers that return explicit `available`, `unavailable`, `rejected` and `restored` outcomes.
- [ ] Run focused tests, then mutation-check the source-confirmation guard by temporarily disabling it and proving the test fails; restore it.
- [ ] Commit: `Complete deterministic Flight Plan domain`.

### Task 3: Native Home Flight Plan module

**Files:**
- Create: `app/src/components/institutional/FlightPlanHome.tsx`
- Create: `app/src/components/institutional/flight-plan-home.test.tsx`
- Modify: `app/src/screens/Today.tsx`

**Interfaces:**
- Produces: additive Home module showing next action, planned minutes, overflow, uncertain facts and recovery count.
- Consumes: Task 1 context, Task 2 domain and existing `useStore` navigation dispatch.

- [ ] Write failing component tests for the next action, synthetic disclosure, uncertain-date exclusion, recovery navigation and absence when preview mode is disabled.
- [ ] Run the focused test and confirm the module is missing.
- [ ] Implement the module using `Blueprint`, `SectionLabel`, existing buttons and existing design tokens only.
- [ ] Insert it into both supported Today layouts without replacing `NextClassCard`, the feed, tabs or first-run behavior.
- [ ] Make actions navigate to existing `calendar`, `behind`, `study` and `university` routes.
- [ ] Run focused tests, Today tests, landmark tests and text-scale/style audits.
- [ ] Commit: `Add native Flight Plan to Home`.

### Task 4: Calendar capacity and provenance

**Files:**
- Create: `app/src/components/institutional/FlightPlanCalendar.tsx`
- Create: `app/src/components/institutional/flight-plan-calendar.test.tsx`
- Modify: `app/src/screens/Calendar.tsx`

**Interfaces:**
- Produces: a compact planning strip with scheduled sessions, capacity, overflow and source-conflict actions.
- Consumes: Task 1 context and Task 2 workspace mutations.

- [ ] Write failing tests proving uncertain tasks are labeled and unscheduled, capacity is never exceeded, and confirming a source adds its work to the plan.
- [ ] Run the focused test and confirm failure because the Calendar module does not exist.
- [ ] Implement the additive strip above the existing Calendar view switcher; reuse current controls and tokens.
- [ ] Persist only synthetic preview decisions in the scoped preview workspace; never modify the personal Semester calendar or imported source deadline.
- [ ] Verify day, three-day, week, month and semester views still render and retain their current controls.
- [ ] Commit: `Add Flight Plan capacity to Calendar`.

### Task 5: Study evidence and explainable progress

**Files:**
- Create: `app/src/components/institutional/FlightPlanLearning.tsx`
- Create: `app/src/components/institutional/flight-plan-learning.test.tsx`
- Modify: `app/src/screens/Study.tsx`

**Interfaces:**
- Produces: a native learning-evidence panel with prerequisites, one attempt per sample prompt, hints, explanations and source disclosure.
- Consumes: Task 2 concepts and evidence mutations.

- [ ] Write failing tests for prerequisite display, hint-before-explanation, one evidence record per prompt and reset isolation by context.
- [ ] Run the focused test and confirm failure because the learning module does not exist.
- [ ] Implement the panel beneath the existing exam summary without replacing Study's Courses, Plan or Ask tabs.
- [ ] Describe evidence as sample practice evidence, never as a grade or certified mastery score.
- [ ] Run focused tests plus existing Study hierarchy, review and text-scale tests.
- [ ] Commit: `Add explainable learning evidence to Study`.

### Task 6: Recovery and prepared Inbox drafts

**Files:**
- Create: `app/src/components/institutional/FlightPlanRecovery.tsx`
- Create: `app/src/components/institutional/flight-plan-recovery.test.tsx`
- Modify: `app/src/screens/Behind.tsx`
- Create: `app/src/components/institutional/FlightPlanInbox.tsx`
- Create: `app/src/components/institutional/flight-plan-inbox.test.tsx`
- Modify: `app/src/screens/Mail.tsx`

**Interfaces:**
- Produces: recovery choices and reviewable local drafts.
- Consumes: Task 2 recovery actions and scoped messages.

- [ ] Write failing tests that reschedule, reduce, prepare-help and prepare-office-hours without changing source due dates or sending anything.
- [ ] Write a failing Inbox test proving prepared drafts appear only in the originating institution/person context and are labeled unsent.
- [ ] Implement a recovery section inside the existing Behind screen and an additive prepared-drafts section inside Mail.
- [ ] Keep Gmail/Outlook read behavior, folders, composing and current local drafts unchanged.
- [ ] Add visible receipts for local changes and explicit copy that nothing was sent or booked.
- [ ] Run the focused tests and existing Behind/Mail tests.
- [ ] Commit: `Connect Flight Plan recovery to Inbox drafts`.

### Task 7: Role-aware University workflows

**Files:**
- Create: `app/src/components/institutional/RoleWorkspace.tsx`
- Create: `app/src/components/institutional/role-workspace.test.tsx`
- Modify: `app/src/screens/University.tsx`

**Interfaces:**
- Produces: student, faculty, advisor, student-success and administrator summaries inside the existing University screen.
- Consumes: Task 1 persona, Task 2 workspace and existing University service/integration truth states.

- [ ] Write failing tests for student, faculty, advisor, campus staff and university administrator views, plus locked consent and unavailable-integration states.
- [ ] Run the focused test and confirm failure because the role workspace does not exist.
- [ ] Implement additive role panels after the current institutional standing disclosure; do not replace Services, Drafts, Records or Connections.
- [ ] Faculty actions prepare assignment/feedback drafts; advisor and success actions require sample consent; administrator settings remain illustrative until server enforcement exists.
- [ ] Verify moderator, employer and authorized-payer personas receive truthful scoped summaries rather than student academic details.
- [ ] Run focused tests and existing University/institutional-access tests.
- [ ] Commit: `Add role-aware University workflows`.

### Task 8: Architectural regression and browser verification

**Files:**
- Modify: `app/src/a11y/landmarks.test.ts`
- Modify: `app/src/data/institutional-preview.test.ts`
- Modify: `app/scripts/institutional-preview-smoke.mjs`
- Modify: `docs/institutional-rollout/local-preview.md`
- Create: `docs/institutional-rollout/native-flight-plan-evidence.md`

**Interfaces:**
- Produces: executable evidence that the new modules extend the original Semester app.
- Consumes: all prior tasks.

- [ ] Add a failing structural regression proving institutional mode still mounts `App` once, contains one global navigation and one main landmark, and imports no standalone institutional stylesheet.
- [ ] Extend the browser smoke to cover two institutions, student and staff personas, desktop and phone, Home/Calendar/Study/Behind/University/Mail, context isolation and feature-flag-off preservation.
- [ ] Run the smoke before updating expectations and confirm it fails on the missing new modules.
- [ ] Complete responsive, keyboard and focus corrections using existing shell styles and components.
- [ ] Run `vitest run`, the time-zone suite, shuffled tests, lint, type checking, production build and institutional browser smoke.
- [ ] Record exact commands, counts, screenshots/readback, known external gates and what was not verified.
- [ ] Mutation-check the single-root guard and tenant-context isolation; restore both and rerun their tests.
- [ ] Commit: `Verify native Flight Plan vertical slice`.

## Completion contract

This slice is complete only when the current Semester shell remains visibly unchanged, every existing route remains reachable, the new modules share one institution/person context, the deterministic loop works across Home -> Calendar -> Study -> Behind -> Inbox -> University, all scoped state survives reload without crossing contexts, the unflagged build remains unchanged, and the full repository verification passes. Production identity, live LMS writes, institutional messaging and official transactions remain explicitly externally gated.
