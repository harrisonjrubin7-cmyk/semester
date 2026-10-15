---
name: build-semester-ui
description: Build or change a Semester screen or component from the existing design system — semantic tokens, shared components, every state, accessible and responsive. Use whenever asked to add, redesign or restyle UI in app/src, or to implement a Figma frame as code.
---

# Building Semester UI

Read `CLAUDE.md` ("Building UI: Semester's design system") first. It says which
file wins when two disagree. This skill is the procedure; it adds no rules.

The end state: UI that reuses what is already here, writes no raw design value,
covers the states a student can reach, and passes the gates.

## 1 · Look before writing

Name, in your plan, what you are reusing. Search in this order and stop when
something serves:

1. The nearest existing screen in `app/src/screens/` that does the same job, and its test.
2. `app/src/components/ui.tsx` (`ActionButton`, `EmptyState`, `Notice`, `Segmented`, `TabList`, `Toggle`, `Meter`, `SectionLabel`), `components/Page.tsx` (`Page`, `PagePurpose`) and `components/FieldMessage.tsx`.
3. `app/src/components/unity/` (`Table`, `Combobox`, `DateField`, `ActionPreview`, `ObjectCard`, `States`, `Status`, `ProvenanceChips`, `ReadState`).
4. `app/src/gallery/stories.tsx`: what the stable components look like in their states.
5. `app/src/styles/tokens.css`: the semantic names. Read the file; do not guess a name.
6. `docs/design/` (`INTERACTION-STANDARDS.md` for the screen family, `RECOVERY-STATE-LIBRARY.md`, `SCREEN-QUALITY-CHECKLIST.md`, `LAYOUT-CONTRACT.md`) and `DESIGN-SYSTEM-GUIDE.md`.

For a complex screen write a short plan before any code: the screen family, the
components reused, any composition that is new, the narrow/intermediate/wide
behaviour, the states, and the accessibility risks. If something is genuinely
missing, say what the smallest missing piece is and use
`/create-semester-component` rather than inventing it inline.

## 2 · Write it with tokens

- Colour, surface, border, text, status: `--surface-*`, `--text-*`, `--border-*`, `--action-*`, `--status-*`. Never a hex, `rgb()` or `oklch()`.
- Type: `var(--type-*)` or `--type-role-*`. Spacing: `var(--sp-*)`. Corners: `--shape-*`. Elevation: `--elevation-*`, and a border before a shadow.
- Stacking: `--layer-*`. Motion: `--motion-*` or `--duration-*` with `--ease-standard|emphasized`.
- Frame: `<Page>` (or `<SettingsPage>`) with one purpose and one primary action, unless it is a conversation, editor, quiz, map or immersive session, and then say so as the other screens do.
- If a style genuinely has no token, the answer is a decision about the design (`docs/design/GOVERNANCE.md` §2), not a literal. Do not add a raw value to match a Figma frame.

## 3 · States, when they apply

Default · loading · empty (why, and one next action) · error (preserve input,
separate retryable from permission) · disabled (say why) · success · long
content and wrapping · permission or read-only (who controls it) · offline or
stale. Reuse `EmptyState`, `Notice`, `ErrorState`, `LoadingState`,
`PermissionNotice`, `SaveState`. Source and freshness appear wherever a fact
could be mistaken for official (`ProvenanceChips`, `SourceBadge`).

## 4 · Accessibility and responsive

Native elements; visible focus; a name on every icon-only control; label,
description and error related through `FieldMessage`; colour never the only
signal; reduced motion through `--motion-*`; one `main` and one H1. Work from
320px up using `lib/media.ts` breakpoints and `--page-pad`; primary actions at
`--target-primary`; nothing that matters appears only on hover.

## 5 · Prove it

From `app/`, using only scripts that exist:

```bash
npx tsc -b
npm run lint
npm test -- <the test files you touched or added>
npm run design-system:check
```

Add tests with the change (`.claude/skills/test-driven-development/SKILL.md`),
and show a new guard failing against a revert. For anything visual, drive the
app and look at it: `.claude/skills/run/SKILL.md`. If you changed `tokens.css`
or `look.ts`, run `npm run tokens:export` and commit the diff.

## 6 · Finish with this summary

- **Implemented**: files changed.
- **Reused**: existing components, tokens and patterns, by name.
- **States covered**, and any deliberately not.
- **Accessibility and responsive**: what you verified and how.
- **Validation**: each command and its result.
- **Gaps**: concrete design-system work still needed, or "none".
