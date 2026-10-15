<!-- Append to the end of the existing root CLAUDE.md. Do not replace anything above it. -->

## The design system, and where each value is decided

**Purpose.** Build interfaces native to Semester — calm, source-aware, accessible, dense without clutter. Not a generic SaaS dashboard.

**Source of truth, in order.** `app/src/lib/look.ts` (`tokensFor`) decides every value → `app/src/styles/tokens.css` names them by job → `app/src/lib/tokenexport.ts` exports them → `app/design-tokens/semester.tokens.json` is **generated**: never hand-edit it; `npm run tokens:export` rewrites it and `tokenexport.test.ts` fails on drift. The `styles/*.test.ts` files are design contracts; extend them, never loosen them to go green.

**Before writing UI.** Search `components/unity/`, `components/ui.tsx`, the nearest screen in `screens/`, and the relevant `styles/*.test.ts`. Reuse first. Use `/build-semester-ui`; a new shared component goes through `/create-semester-component`.

**Raw values.** Feature UI uses semantic variables only — no raw colours, spacing, radii, shadows, z-indexes, font sizes, durations or easing. Permitted: `look.ts`, the first `:root` of `app.css`, the `hex.test.ts` LEDGER (with a reason), generated output, test fixtures. `npm run design-system:audit` reports the rest by file:line.

**Accessibility.** Native elements; visible focus (`--focus-color`, clear of sticky chrome); icon-only controls named; label/hint/error associated; every state as glyph + word + tone; motion only through `--motion-*`; keep `a11y/*` and `taps.test.ts` green.

**Responsive.** Follow `breakpoints.test.ts`, `gutter.test.ts`, `density.test.ts`, `taps.test.ts`, `stacking.test.ts`. Keep the primary action at every width; nothing hover-only.

**Figma.** Figma MCP is read-only design intent. Map variables through `docs/design-system/FIGMA-MAPPING.md` to exported paths and components to existing patterns before writing anything. Missing Figma states never excuse missing loading/empty/error/disabled/permission/keyboard/focus/responsive behaviour. Record unresolved mappings in that file. Never write to Figma.

**Done means.** From `app/`: `npx tsc -b && npm run lint && npm test && npm run design-system:check` (plus `npm run tokens:export` if tokens changed). Report files changed, patterns reused, states and a11y covered, and gaps left.
