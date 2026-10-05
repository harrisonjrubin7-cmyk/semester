---
name: create-semester-component
description: Decide whether a new shared component belongs in Semester and, if the evidence is there, specify and add it inside the existing app — API, states, accessibility, responsive behaviour, tokens, tests, docs and a first adopter. Use when someone asks for a new reusable component, or when UI work keeps wanting a wrapper.
---

# Creating a Semester component

The default answer is no. Semester has one component home — `app/src/components/`
(`ui.tsx`, `Page.tsx`, `unity/`) with its stories in `app/src/gallery/` — and no
separate component package. This skill adds to that home; it does not start a
parallel library, and it adds no dependency.

Read `CLAUDE.md` and `docs/design/GOVERNANCE.md` §2 first. A new pattern that
skipped §2 is a review comment, not a follow-up.

## 1 · Evidence that a reusable need exists

Write down, with file paths:

- the **two or more** places that need it now (or why it is foundational), found by search, not memory;
- what you searched: `components/ui.tsx`, `components/unity/`, `components/Page.tsx`, `gallery/stories.tsx`, `styles/app.css`, `styles/unity.css`, `styles/features.css`, and `docs/design/INTERACTION-STANDARDS.md`;
- why each existing pattern cannot serve, in one paragraph;
- that it carries no feature-specific business logic.

**Reject it** if it is a one-off feature wrapper, a restyle of an existing
component, a variant used once, or something `ui.tsx` or `unity/` already does
under another name. Compose the existing pieces in the feature instead.

## 2 · Audit existing CSS and React first

Find the classes and components nearest to it (`grep -rn` for the job, not the
name). If a stylesheet class already draws it, the answer may be a React
component over that class, not new CSS. Check `npm run census:design` and
`styles/deadcss.test.ts` so you do not add what is unused.

## 3 · Specify before implementing

Put this in the pull request description (and in the component's file header,
as the other components do):

- **API**: props, defaults, which props are required. Composition over boolean sprawl; `variant`/`size` only for documented design choices; no free-form `style`/`className` as the main API.
- **States**: default, hover/press, focus-visible, disabled, loading, error, empty, selected, read-only — those that apply.
- **Accessibility**: native element, role only if no native one fits, accessible name, keyboard map, focus management, announced text, `aria-*` relationships; reduced motion.
- **Responsive**: behaviour at 320px, `lib/media.ts` tiers, target size `--target-primary`, long content, no hover dependence.
- **Tokens and CSS**: the semantic variables it reads. No raw colour, spacing, radius, shadow, z-index, font size, duration or easing. If a token is missing, that is a `tokens.css` change with `npm run tokens:export` and a contrast measurement, argued separately.
- **Tests**: behaviour and a11y in a `*.test.tsx` beside it, unmounting its React root in `afterEach` (`src/rootunmount.test.ts` enforces that). A guard is shown failing against a revert.
- **Documentation**: its row in `DESIGN-SYSTEM-GUIDE.md` or `docs/DESIGN-SYSTEM-IMPROVEMENTS.md` §2, and a story in `gallery/stories.tsx` (`gallery.test.tsx` requires every `components/unity/` component to have one or say why not).
- **First adoption**: the existing screen that switches to it in the same change, and what it deletes. A component with no adopter is not done.

## 4 · Implement and prove

From `app/`: `npx tsc -b`, `npm run lint`, the new tests, `npm run design-system:check`,
then the full `npm test` and `npm run test:shuffle`. Look at it in the app
(`.claude/skills/run/SKILL.md`).

If it maps to a Figma component, add a row to the Components table in
`docs/design-system/FIGMA-MAPPING.md` with the real code path; do not create the component *because* Figma has one.

## 5 · Report

Why the existing options were insufficient; the API and accessibility contract;
tests added and the guard shown to fail; tokens used; the first adopter and what
it removed; Figma mapping rows added; gaps left.
