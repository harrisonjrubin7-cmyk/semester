---
name: build-semester-ui
description: Build or change Semester UI using its existing tokens, shared components and contract tests. Use whenever adding or editing a screen, component, stylesheet rule, colour, spacing, type size or state in app/src, or implementing a Figma design in this app.
argument-hint: "[screen, component or Figma node to build]"
---

# Build Semester UI

Semester is a calm academic workspace with a design system that already exists
and is already enforced. Building here means using it. The rules below are the
ones the tests will hold you to, so it is faster to follow them than to find
out.

Read `DESIGN-SYSTEM-GUIDE.md` and `docs/design/GOVERNANCE.md` §2–3 before the
first change. Run every command from `app/`. Check `origin/main` for the thing
first (`CLAUDE.md`): the same fix is often already merged.

## Search before you build

`components/ui.tsx` (`ActionButton`, `EmptyState`…), `components/Page.tsx`,
`components/unity/` (`Table`, `Combobox`, `DateField`, `ActionPreview`,
provenance chips), `components/SourceBadge.tsx`, `components/NotOfficial.tsx`,
`components/TypeToConfirm.tsx`, `a11y/modal.ts` (`useModal`). A second copy of
one of these is a review comment, not a follow-up. If none serves, say in the
PR why, and follow `docs/design/GOVERNANCE.md` §2.

## Values

- **Colour is a token.** `var(--surface-*)`, `--text-*`, `--border-*`,
  `--action-*`, `--status-*`, `--focus-color`, or the `--app-*` primitive under
  them (`docs/DESIGN-TOKENS.md`). Never `#hex`, `rgb()`, `hsl()` or a named
  colour in a component or stylesheet: it is one colour on thirteen grounds,
  outside `lib/contrast.test.ts`. `npm run design-system:audit` and
  `styles/hex.test.ts` fail on it. The only legitimate literals are a canvas the
  student exports, a video frame, a scannable code, a third-party theme object
  or a map marker; they go on a ledger with the reason.
- **Use a name that exists.** `var(--x)` with no definition is silently
  invalid: the whole declaration applies nothing. Look the name up in
  `docs/DESIGN-TOKENS.md` or `design-tokens/semester.tokens.json` before
  writing it. The audit fails a new one.
- **New colour:** decide it in `lib/look.ts` and measure it on every ground and
  every surface of that ground (`lib/contrast.test.ts`), not only
  `--app-panel`. Then `npm run tokens:export`.
- **Type, leading, spacing:** the named steps (`var(--type-sm)`, `--sp-4`,
  `--leading-*`), which carry the Text size and density settings. A raw `14px`
  is a size the setting cannot reach (`scripts/styles.mjs`).
- **Never edit `design-tokens/semester.tokens.json`.** It is generated.
- Reuse the token vocabulary before inventing a name. A new semantic token is a
  change to `styles/tokens.css`, its row in `docs/FIGMA-MAPPING.md`, a
  regenerated export and an entry in `docs/DESIGN-TOKENS.md`.

## Behaviour

- Frame a screen in `<Page>` or `<SettingsPage>`, or say why not. One primary
  action.
- Loading, empty, error and permission states are part of the screen
  (`docs/design/INTERACTION-STANDARDS.md` §5, `RECOVERY-STATE-LIBRARY.md`).
- Anything a student could mistake for official carries a `SourceBadge`.
- Real controls: `<button>` or `ActionButton` for actions, `<a>` for
  navigation, a label on every icon-only control, a visible focus ring, 44px
  targets (`--target-primary`). `useModal` for any overlay.
- Meaning is never colour alone: pair tone with a word or glyph
  (`lib/status.ts`).
- Responsive at the tiers in `lib/media.ts`; check a narrow phone width. Text
  must survive Text size "largest" and `sweep:spacing`.
- Words follow `docs/design/SEMESTER-CONTENT-STANDARDS.md`; `npm run lint` holds
  the vocabulary.
- Motion uses the role tokens, and is zero under reduced motion and calm.

## From Figma

With the Figma MCP server connected (`/mcp`), read the design context, variables
and screenshot. Map each Figma variable to a token through
`docs/FIGMA-MAPPING.md`; if it has none, map to the nearest existing token or
propose one. Do not copy Figma's pixel values into CSS. Build the states and
accessibility the frame leaves out. Do not write to Figma.

## Prove it

```bash
npx tsc -b
npm run lint
npm run design-system:check     # audit + token, hex and mapping tests
npm test
npm run test:shuffle
npm run build
```

Add `npm run check:university` when you touched `server/`, `api/` or
`packages/institution`. For anything visual, run the app and look at it
(`.claude/skills/run`): a dark rectangle is a failure to launch, not a dark
theme. Put a phone-width and a desktop-width screenshot in the PR.

A guard that has never failed is not known to be a guard: for a new test,
revert the fix under it, watch it go red, restore it.
