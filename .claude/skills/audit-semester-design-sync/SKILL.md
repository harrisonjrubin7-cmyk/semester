---
name: audit-semester-design-sync
description: Audit a Semester route, component or token namespace against the design system — token pipeline, raw values, component and state coverage, accessibility, responsive contracts, and optionally a Figma frame — and report before anything is changed. Use before a large design-system change, when asked whether code and Figma agree, or to review UI for drift.
argument-hint: "[route, component path or token family] [optional Figma URL]"
allowed-tools: Read, Glob, Grep, Bash, mcp__figma__get_design_context, mcp__figma__get_variable_defs, mcp__figma__get_metadata, mcp__figma__get_screenshot, mcp__figma__get_code_connect_map
---

# Design-sync audit

**No-edit mode.** Do not change any file while auditing. Run read-only
commands and the repository's own checks. Edit only if the user asks for
implementation after reading the report; then follow `/build-semester-ui`.
Never write to Figma (`use_figma`, `generate_figma_design` and the other write
tools are not allowed here).

Read `CLAUDE.md` ("Building UI") first. Source-of-truth order, earlier wins:
`look.ts` → `styles/tokens.css` → `lib/tokenexport.ts` →
`design-tokens/semester.tokens.json` (generated) → existing CSS, components,
screens → the contract tests → Figma (evidence of intent only).

## 1 · Scope

State what is audited: a route (`app/src/screens/…`), a component, a token
family, or a Figma frame against its implementation. Say what is out of scope.

## 2 · Run the instruments that already exist

From `app/`:

```bash
npm run design-system:report     # audit, Figma mapping and contract tests -> reports/design-system/report.md
npm run design-system:audit      # file:line violations and warnings; --json for a machine-readable copy
npm run design-system:css        # raw values in stylesheets against src/styles/rawbudget.ts
npm run census:design            # adoption: Page frames, ActionButton vs raw <button>, EmptyState, hex
npm run lint                     # includes lint:styles and lint:labels
```

Read `reports/design-system/report.md`. Do not re-derive what it
says. The numbers it carries are debt already on the ledger; a finding is what
is beyond it, or what no instrument covers.

## 3 · Token pipeline

`tokens.css → tokenexport.ts → semester.tokens.json`. Check that:

- every `var(--x)` the target uses is defined (in `tokens.css`, the `app.css` `:root`, `industry.css` or written by `tokensFor` in `look.ts`);
- the export is in step (`npm run tokens:check`), and no semantic token is missing from it;
- the target uses *semantic* names where one exists, not primitives (`--app-panel`) or raw values.

Distinguish **approved foundational** raw values (a custom-property definition,
`look.ts`, a fixture, `hex.test.ts`'s ledger, `ALLOWED_RAW`) from **feature
drift** (a value *used* by a rule or style object). Raw values are a defect,
not an aesthetic preference.

## 4 · Components and patterns

Duplicated styling that a shared component already covers (raw `<button>` where
`ActionButton` fits, a hand-rolled table where `components/unity/Table.tsx`
fits, hand-drawn empty and error states), feature-local wrappers, a screen with
no `Page`/`SettingsPage` frame and no stated reason, clickable non-interactive
elements, inconsistent density, gutters or type roles.

## 5 · States

For each state that applies: default, loading, empty, error with recovery,
disabled with a reason, success, long content, permission or read-only, offline
or stale. Say *covered*, *partial* or *missing*, with the file and line.

## 6 · Accessibility and responsive, against what exists

Accessibility: native semantics, name on every control, label/description/error
relationships, visible focus, colour never the only signal, reduced motion.
Instruments: `src/a11y/*.test.ts`, `npm run lint:labels`,
`npm run smoke:a11y` (needs a build and a browser; say if you did not run it).
Responsive: `lib/media.ts` breakpoints, `--page-pad`, `--target-primary`,
stacking. Instruments: `styles/{breakpoints,gutter,taps,density,stacking,inset,reach}.test.ts`,
`npm run sweep:targets`, `npm run sweep:spacing`. State what each proves and what
it cannot (a jsdom test does not paint).

## 7 · Figma, optionally

Only with a URL, and only the read tools. Use `get_variable_defs` and
`get_design_context` on the node. Treat the result as intent, not markup to
copy. Map each Figma variable to a path in `semester.tokens.json` and each
component to an existing pattern; list what does not map in the report and
suggest the row for `docs/design-system/FIGMA-MAPPING.md` (one variable per row, first column `semantic.<name>` or `primitive.<name>`). If the Figma MCP is
not authenticated, say so and continue with the code-only audit.

## 8 · Report

Produce exactly these sections.

1. **Executive assessment** — alignment (strong / moderate / weak / critical), the highest-risk finding, the main category of concern.
2. **Scope**
3. **Token parity** — token or variable · exported path · CSS source · match / partial / missing / obsolete · resolution.
4. **Component parity** — pattern · existing Semester solution · gap.
5. **State coverage** — state · covered / partial / missing · evidence.
6. **Accessibility review** — semantics, keyboard, focus, labels and errors, contrast and non-colour cues, reduced motion: pass / partial / fail with evidence.
7. **Existing enforcement** — contract · test or script · what it proves · what remains.
8. **Findings** — Severity · Location (`file:line`) · Category · Evidence · Existing Semester solution · Smallest safe fix. Severity: **blocker** breaks critical usability, accessibility or system integrity; **major** is repeatable drift, a broken pattern contract, or a significant state or responsive gap; **minor** is localised.
9. **Minimal implementation order** — blockers, then shared token or component issues, then route-level composition, then polish and docs. Prefer an existing component to a clone, a semantic token to a new one, a documented composition to a new component. Report evidence, not taste.
