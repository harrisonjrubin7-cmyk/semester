---
name: build-semester-ui
description: Build or change Semester UI so it follows the existing tokens, unity primitives, trust vocabulary, accessibility and responsive contracts — and passes the repository's style tests on the first run.
argument-hint: "[screen-or-component] [optional-figma-url]"
---

# Build Semester UI

## Before writing code

1. `git fetch origin main && git log --oneline -30 origin/main | grep -i <the-thing>` — it may already have landed (CLAUDE.md).
2. Place the work under one of the five destinations (Today · My Path · Search · Plan · Me) and one of the seven areas in `lib/navareas.ts` (Today · Plan · Learn · Help · Campus · Progress · You). No sixth global product.
3. Read the nearest existing screen in `app/src/screens/` and the primitives in `app/src/components/unity/` and `components/ui.tsx`.
4. If a Figma node is supplied, read it through Figma MCP and map every variable through `docs/design-system/FIGMA-MAPPING.md`. Unmapped → stop and propose a mapping row; don't invent a token.

## Building blocks — reuse, never re-implement

| Need | Use |
| --- | --- |
| A screen | `Page` / `SettingsPage` from `components/ui.tsx`; one purpose, one primary action |
| A thing with a decision | `unity/ObjectCard` (eyebrow → title → provenance → why → meta → one primary + one quiet secondary) |
| The object a screen is about | `unity/ContextBar` |
| Where a fact came from | `SourceBadge` / `unity/ProvenanceChips` with `lib/source.ts` / `lib/factprovenance.ts` |
| A state chip / save line | `unity/Status` → `StatusChip`, `SaveState`, `SyncState` via `statusOf(key)` |
| Loading/empty/error/success/progress/steps/permission/offline | `unity/States` + `EmptyState` |
| Before a consequential action | `ConfirmDialog` with `unity/ActionPreview` — `recovery` is required |
| Who can see this | `unity/Visibility` |
| Tables | `unity/Table` — only when comparing columns |
| Search-as-you-type | `unity/Combobox`; dates: `unity/DateField` |
| Routes onward | `unity/OpenIn`, `unity/NextSteps`, `unity/QuickActions` |
| "About this screen" | `unity/ScreenGuide` |
| Icons | `components/Icons.tsx` (24 grid, 1.5 stroke) — never a second icon set |

## Styling rules

- Colour only through `--surface-* --text-* --border-* --action-* --status-* --chart-* --focus-*` or `--app-*`. A hex in a .tsx fails `styles/hex.test.ts` unless ledgered with a reason.
- Spacing: `--sp-1…7`; larger gaps `calc(Npx * var(--density, 1))`. Type: `--type-*` (all × `--text-scale`). Leading: `--leading-*`.
- Shape: `--shape-control/card/surface/sheet` (follow the Corners setting). Elevation: border first, `--elevation-*` second.
- Motion only through `--motion-*` (zeroed by reduced motion and `data-calm`). Layers only through `--layer-*`.
- Glass only on the surfaces `styles/glass.test.ts` lists, with an opaque fallback.
- Cinzel (`--font-display`) for one editorial statement per page — never in status, warnings, consent or controls.

## Words

Status sentence: what is true → what it means for you → what you can do. Sentence case. "student", never "user". "AI-assisted, source-linked" / "Ask Semester". No "secure / private / compliant / guarantees / revolutionise". No exclamation marks, no streaks, no guilt.

## Accessibility checklist

One `main`, one H1 · labels visible and associated · icon-only buttons named · 44px targets (24px only in crowded composites, with a test) · focus visible and clear of sticky chrome · every state as glyph + word + tone · works at 400% zoom and in forced colours · no meaning in motion.

## Finish

From `app/`: `npx tsc -b && npm run lint && npm test && npm run design-system:check`. If tokens changed: `npm run tokens:export` and commit the regenerated JSON. Look at the screenshot (`.claude/skills/run`). Report changed files, commands run and results.
