# Design-system plan

Status: plan, not implementation  
Baseline: 85/99 screens framed; 1,695 raw buttons; 418 `ActionButton` uses; 30 TSX color literals; 27 off-scale values.

## Objective

Create one typed design language across student, institution, guardian, partner, public, and operations surfaces while preserving role-appropriate density and the existing Semester identity.

## Token architecture

| Layer | Examples | Rule |
|---|---|---|
| Foundation | neutral/brand ramps, font families, numeric spacing, radii | No component consumes raw palette values directly |
| Semantic | surface, text, border, focus, info, success, warning, danger, official, derived, stale | Meaning remains stable across themes |
| Component | button height, field border, dialog width, table row | May reference semantic/foundation tokens only |
| Context | student-comfortable, workspace-compact, operations-dense | Density changes spacing/size, never permission or meaning |
| Motion | duration, easing, distance | All motion has reduced-motion behavior |
| Layout | breakpoints, reading width, workspace width, safe area, z-index | Defined once and exposed as CSS and TypeScript |

Use CSS custom properties as runtime output and a typed TypeScript manifest as the authored contract. Keep a documented escape hatch with linted justification.

## Required primitive families

1. **Shell:** `AppShell`, `PageFrame`, `WorkspaceFrame`, `OperationsFrame`, navigation, command palette, search, support entry.
2. **Actions:** button, icon button, link, menu, dangerous confirmation, async/loading action.
3. **Forms:** field, validation, error summary, input, textarea, select, combobox, date/time, file dropzone, upload state.
4. **Data display:** card, list, table/data grid, badge, avatar, tabs, segmented control, pagination, filter bar, metric/chart wrapper, timeline.
5. **Overlays/feedback:** dialog, drawer, popover, tooltip, toast, banner.
6. **Operational truth:** loading, empty, connected, syncing, stale, offline, permission denied, unavailable, error, pending approval, draft, verified, archived, deleted, freshness, source, sync, audit.

## Behavioral contracts

- Keyboard and screen-reader behavior is part of each primitive's API.
- Disabled controls explain why; unavailable actions are not styled as active.
- Async actions expose pending, success, failure, cancellation, and idempotent retry.
- Forms preserve input across server, offline, permission, and validation failures.
- Tables have a semantic table mode and an explicit small-screen list/drill-in mode.
- Charts require text summaries, source, time window, refresh, owner, and limitations.
- `official`, `verified`, `connected`, and `paid` are protected terms backed by data, never visual variants selected ad hoc.

## Migration order

1. Operational state/provenance primitives and Today.
2. Button/action family and form errors.
3. Page/shell frames and navigation.
4. Tabs/dialog/drawer/popover focus behavior.
5. Tables, metrics, and dense workspace modes.
6. Editors and specialist surfaces.
7. Public-site token output.

## Quality gates

- Typecheck, lint, unit tests, build, and bundle budgets pass.
- Story/fixture coverage for all states, densities, and themes.
- Keyboard, focus, name/role/value, 320 px reflow, reduced motion, and forced-colors checks.
- No new raw primary button, color literal, z-index, box shadow, or spacing value without an approved escape annotation.
- Adoption census must trend monotonically; a PR may not lower shared primitive adoption without design-system approval.

## Dark mode

Treat dark mode as supported only after semantic-token coverage, contrast tests, media/chart review, editor review, and all critical journeys pass. Until then, describe it as partial and never let a per-screen preference imply universal support.

