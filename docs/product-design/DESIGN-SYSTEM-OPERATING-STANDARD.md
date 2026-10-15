# Design System Operating Standard

| Control | Value |
| --- | --- |
| Status | **CONTROLLED STANDARD — EXISTING SYSTEM PRESERVED; ADOPTION PARTIAL** |
| Owner | Harrison Rubin — Product Design and Frontend Engineering; backup reviewer unassigned |
| Evidence date | 2026-10-03 at repository revision `8fc5fd56` |
| Canonical foundation | `app/src/lib/look.ts`, `app/src/styles/`, `app/src/components/ui.tsx`, `app/src/components/` |

## Principle

Semester's current visual system is the foundation. New work must extend it, not introduce a replacement shell, generic dashboard language or a parallel token/component vocabulary. The student settings for ground, accent, typography, density, corners, reading width and calm behavior are product capabilities and must continue to work.

## Required foundations

| Layer | Standard | Evidence / boundary |
| --- | --- | --- |
| Color | use semantic `--app-*`, chrome and status tokens; measure every supported ground/accent/surface; never use color alone | `look.ts`, contrast and telling tests; any new token needs full pairing evidence |
| Type | use the semantic type/leading subset and the selected heading/body faces | raw sizes/faces that bypass text-scale or typeface settings are prohibited |
| Space and shape | use `--sp-*` with density and `--r-*` with corner preference | literal layout values require a documented, guarded geometry reason |
| Motion | use the shared timing/easing roles and honor both device reduced motion and Semester calm settings | no essential meaning may depend on animation |
| Layout | design mobile-first at canonical breakpoints; content order remains logical without the visual grid | new one-off breakpoints require review and evidence |
| Focus and targets | preserve visible focus, keyboard order and approved target dimensions | no hover-, drag- or swipe-only action |

## Canonical component policy

Reuse before creating. `ActionButton` is the primary action; `EmptyState` the shared empty pattern; `LoadingState`, `ErrorState` and `SuccessState` the shared state family; `useModal` the overlay focus/escape contract; `TypeToConfirm` irreversible confirmation; `Undone` reversible recovery; `Said` the shared announcement path; shared tabs/chips/toggles the selection patterns; `SourceBadge`, `NotOfficial` and intelligence disclosure the trust foundation.

A new component is justified only when an existing primitive cannot meet a documented user need. Its proposal must state anatomy, variants, responsive behavior, keyboard/focus behavior, accessible name/role/state, reduced-motion behavior, tokens, content rules, empty/loading/error/restricted states, tests, owner and migration plan. A new one-off card, button, modal, tab, icon or status vocabulary without that review is prohibited.

## Product composition rules

- One clear page purpose and one dominant primary action per task region.
- Cards represent objects, decisions or actions; ordinary reading remains flat.
- Editing uses a sheet/drawer when preserving context matters; multi-step work uses a screen.
- Do not nest cards or use decoration to imply hierarchy.
- Status, source, freshness, uncertainty, privacy and AI boundaries appear at the decision point.
- Destructive actions never use primary styling and require the appropriate recovery/confirmation pattern.
- External handoffs name the destination, scope and return path.
- Loading preserves layout; empty states explain how content arrives; errors preserve work and give a recovery route; success says what changed and what comes next.

## Change workflow

1. Identify the user problem, affected surfaces and existing canonical pattern.
2. Record token/component/terminology changes and migration impact.
3. Review design, content, accessibility, responsive and trust implications.
4. Implement through shared primitives where practical; avoid broad speculative migration.
5. Test representative light/dark grounds, density/text settings, keyboard, screen reader, zoom, reduced motion, long content and required states.
6. Capture approved reference screens and update design debt, documentation and regression coverage.

## Evidence and gaps

**Code/config evidence.** Style budgets, token/contrast/type/motion/target tests, shared components and page-frame/navigation guards implement substantial portions of this standard.

**Operational evidence.** Prior audits and selected screenshots exist, but no current full-route visual regression service, component adoption census acceptance or named design-system review board operation is evidenced.

**Missing test/proof.** Reconcile remaining component/style forks, establish visual baselines in CI, complete the route/state adoption matrix, run human accessibility and responsive reviews, and record owner approval for visible system changes.

## Claim ceiling

Semester may say it maintains a configurable, token-based design system with shared interaction and accessibility patterns. It must describe adoption and verification as partial where route-wide evidence is absent.

## Prohibited claims

Do not claim complete component reuse, pixel consistency, universal accessibility, responsive validation or a fully governed design-system operation without the missing evidence above.
