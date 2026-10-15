# UI Enhancements Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Close concrete shared UI gaps from the attached twenty-item enhancement PDF and document launch evidence.
**Architecture:** Reuse the command overlay, shared continuity strip, source drawer and comparison component. Extend existing persisted preferences.
**Tech Stack:** React, TypeScript, Vitest, Vite.
**Spec:** docs/superpowers/specs/2026-10-01-ui-enhancements-design.md

## Global Constraints
No new product dependency. No automatic sharing, registration or external message sending. No fabricated go status.

## Review Focus
- Unknown or destructive phrases stay searches.
- Missing citations stay absent rather than invented.
- Reading controls change persisted preferences without overwriting unrelated preferences.
- Comparison views retain unknown facts and official next steps.
- Institutional launch remains blocked without external acceptance evidence.

### Task 1: Navigation commands
Files: app/src/lib/intent.ts, intent.test.ts, components/Command.tsx.
Produces: navigationIntent(text: string): Screen | null.
- [ ] Add tests for exact navigation requests, whitespace and unknown/destructive phrases; run failing tests.
- [ ] Resolve known commands before addIntent, and navigate using the existing land function.
- [ ] Run intent tests and build.

### Task 2: Shared accessibility controls
Files: components/unity/AccessibilityTools.tsx, AccessibilityTools.test.tsx, SystemContextBar.tsx.
Consumes: currentLook(state), setLook action, accessmode helpers.
- [ ] Test rendered controls and preference changes.
- [ ] Implement native disclosure with text size, spacing, motion, plain language and focus controls.
- [ ] Run rendered tests.

### Task 3: Source anchors
Files: lib/unity.ts, components/unity/UnityLayer.tsx, source-anchor.test.tsx, screens/Courses.tsx.
Produces: optional excerpt, location and owner fields on SourceDetail.
- [ ] Test escaped excerpt, location, owner and absent metadata.
- [ ] Render source anchor metadata; pass existing verified item.quote.
- [ ] Run source drawer regressions.

### Task 4: Human comparison views
Files: components/DecisionTable.tsx, DecisionTable.test.tsx.
- [ ] Test card and summary view interactions retain unknown values and official next steps.
- [ ] Add view chooser with table default; preserve existing semantics.
- [ ] Run comparison regressions.

### Task 5: Full audit and verification
File: docs/UI-ENHANCEMENTS-2026-10-01.md.
- [ ] Map twenty PDF items to source files and remaining gaps.
- [ ] Run full npm test, production build, browser smoke where available.
- [ ] Review diff; publish reviewable branch and pull request with real verification and blockers.

## Execution scope refinement

The audit also exposed incomplete start-anywhere coverage, assumption visibility, workflow trails and unpopulated source relationships. Added regression-tested changes to `goals.ts`, `GraduationSimulator.tsx`, `DecisionTrail.tsx`, `CourseHub.tsx` and shared shell orientation. Comparison views are connected through the actual `RegistrationPortal` course shortlist. These extend the same existing shared UI; the full universal contracts remain listed in the audit.

## Execution ledger

- Tasks 1–4 implemented with failing/passing feature tests; task 5 audit written and fresh build/lint/full-suite results recorded.
- Ruling: User explicitly requested continuous execution of the supplied scope; implemented on an isolated branch without additional design confirmation. Cost if wrong: changes remain reviewable and revertible.
- Ruling: Do not change launch gates to go without the missing real evidence. Cost if wrong: launch waits for evidence; it does not expose users to fabricated readiness.
- Ruling: Browser smoke unavailable because each shell runs in an isolated network namespace and loopback requests cannot reach the preview process. Cost if wrong: actual branch browser acceptance remains unproved and must run in CI.
- Review: independent whole-branch reviewer identified mobile trail suppression and loss of selected workflow. Fixed both with rendered navigation and CSS guard tests.
- Verification: final npm test — 19,271 passed, 48 skipped, 3 pre-existing missing-publication-artifact failures; production build and lint pass.
- Remaining: universal contracts in audit rows 8, 10, 11, 12, 15 and external institution launch gates. No complete product or go status claimed.
