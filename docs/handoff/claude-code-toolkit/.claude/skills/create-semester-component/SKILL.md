---
name: create-semester-component
description: Add a shared Semester UI component only when evidence shows existing unity primitives and CSS patterns are insufficient. Produces a written spec before code.
argument-hint: "[proposed-component-name] [screens-that-need-it]"
---

# Create a Semester component

## Gate: prove the need first

Write down, with paths:
1. At least **two** screens in `app/src/screens/` that need it now (one is a one-off — solve it locally with existing classes).
2. Every existing candidate you checked: `components/unity/*`, `components/ui.tsx`, `components/*.tsx`, and the CSS classes in `styles/unity.css` / `industry.css` / `app.css`. Say why each is insufficient.
3. Why a prop on an existing primitive will not do.

If any answer is weak, stop and extend the existing primitive instead. Never create a feature-local wrapper (`DegreeCard`, `BillingButton`) or a parallel library.

## Spec (before code)

| Section | Content |
| --- | --- |
| API | Props with types; required vs optional; no styling props that bypass tokens |
| States | default · hover · focus · active · disabled · loading · empty · error · success · permission/locked · long content |
| Trust | Which `lib/status.ts` / `lib/source.ts` keys it renders; never string literals |
| Accessibility | Role, name, keyboard map, focus order, live region, forced-colours behaviour |
| Responsive | Behaviour at the tiers in `breakpoints.test.ts`; targets per `taps.test.ts` |
| Tokens | Semantic variables used; zero new tokens unless a `look.ts`/`tokens.css` PR is justified |
| Tests | Behaviour test beside it; which `styles/*.test.ts` it must keep green |
| Docs | One paragraph + usage in `DESIGN-SYSTEM-GUIDE.md` |
| First adoption | The two screens migrated in the same PR |

## Build

Place it in `app/src/components/unity/` with its CSS in `styles/unity.css` (semantic tokens only, motion via `--motion-*`). Migrate the two screens. Run `npx tsc -b && npm run lint && npm test && npm run design-system:check`; revert the component once to see its test go red, then restore.
