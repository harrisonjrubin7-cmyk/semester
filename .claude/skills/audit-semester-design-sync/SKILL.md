---
name: audit-semester-design-sync
description: Audit the Semester React app against its existing CSS token system, token export and Figma mapping, read-only, and report drift. Use when asked to audit the design system, check Figma parity, find raw colours or undefined tokens, review a screen or component against the tokens, or before changing tokens, tokens.css, look.ts or docs/FIGMA-MAPPING.md.
argument-hint: "[optional: figma url or node] [optional: screen or component path under app/src]"
---

# Audit Semester design sync

An audit finds drift between four things that are supposed to say the same
thing: the code that decides a token, the stylesheet that names it, the JSON
that Figma reads, and the screens that use it. It changes none of them. Report
first; edit only when the person reading the report asks.

This is an existing Vite and React app under `app/`, in an npm workspace
(root `package.json` lists `app` and `packages/*`; one lockfile). There is no
pnpm, Tailwind, Storybook or `packages/ui` here and an audit never recommends
adding one. Every command runs from `app/`.

## Before anything: has it landed?

Several sessions work this repository at once and converge on the same
findings (`CLAUDE.md`, first section). Before reading code:

```bash
git fetch origin main
git log --oneline -30 origin/main
git log --oneline -40 origin/main | grep -iE "token|figma|design-system|contrast"
```

If the finding you are about to report has merged, say so and stop.

## Source of truth, in order

1. `app/src/lib/look.ts` (`tokensFor`): decides every per-ground and
   per-setting value. A colour is decided only here.
2. `app/src/styles/tokens.css`: the semantic names (`--surface-*`, `--text-*`,
   `--border-*`, `--action-*`, `--status-*`, `--focus-*`, `--target-*`…) over the
   primitives. `app/src/styles/app.css` `:root` holds the fixed primitives
   (`--type-*`, `--sp-*`, `--lift-*`).
3. `app/src/lib/tokenexport.ts` writes `app/design-tokens/semester.tokens.json`.
   That file is generated; never edit it. Regenerate with
   `npm run tokens:export` and commit it with the change that caused it.
4. `app/src/styles/`, `app/src/components/`, `app/src/screens/`: where tokens
   are used. `components/ui.tsx`, `components/Page.tsx` and `components/unity/`
   are the shared vocabulary.
5. The contract tests: `app/src/styles/*.test.ts`, `app/src/lib/tokenexport.test.ts`,
   `app/src/lib/contrast.test.ts`, `app/src/a11y/`.
6. Figma is evidence of approved visual intent. Code owns behaviour,
   accessibility, responsive layout and token values. `docs/FIGMA-MAPPING.md`
   says which Figma variable takes which exported path.

## Read first

`CLAUDE.md`, `app/README.md`, `DESIGN-SYSTEM-GUIDE.md`, `docs/DESIGN-TOKENS.md`,
`docs/DESIGN-TOKEN-ARCHITECTURE.md`, `docs/design/DESIGN-SYSTEM-PRODUCT-SPEC.md`
(§3.3, §7.2), `docs/design/GOVERNANCE.md`, `docs/FIGMA-MAPPING.md`,
`app/package.json`, and the files above. For one screen, read that screen, its
nearest components and the styles that reach it.

## Run what exists

From `app/`, in this order, and put the output in the report:

```bash
npm run design-system:audit    # fails on a new raw colour, undefined var(), broken Figma row
npm run design-system:report   # the same figures as Markdown, with the debt ledgers
npm run census:design          # adoption: frames, buttons, empty states, hex in .tsx
npm run lint                   # oxlint, style scale, labels, vocabulary
```

`npm run design-system:check` also runs the token, hex and mapping tests. A
green audit means nothing new drifted; the debt it holds on ledgers is still
debt, and the report lists it.

## Figma, if a URL, node or variable is supplied

Use the configured Figma MCP server (`/.mcp.json`; authorise with `/mcp`). Read
only. Inspect the node hierarchy, variables and collections, component
instances and properties, auto-layout and constraints, visible states, and the
text hierarchy. Then:

1. Compare each Figma variable with its row in `docs/FIGMA-MAPPING.md` and the
   path it names in `semester.tokens.json`: match, partial, missing, obsolete.
2. Compare Figma components with the React components that implement them.
3. Do not write CSS to reach pixel parity. Map to the nearest token or propose
   a token through `docs/design/GOVERNANCE.md` §2, measured on all thirteen
   grounds.
4. An incomplete frame is not permission to drop keyboard support, visible
   focus, empty/loading/error states, responsive behaviour, labels or
   semantic HTML.
5. Never write to Figma during an audit.

If no Figma server is connected, say so and audit the code side only. Do not
invent Figma findings.

## What to check

**Tokens.** Colour literals in CSS or inline styles (the audit's ledger);
`var(--x)` that nothing defines (a declaration that applies nothing, silently);
hex in `.tsx` (`styles/hex.test.ts`); type, leading and spacing off the scale
(`styles/budget.ts`); tokens in `tokens.css` that no component uses; tokens in
the export with no mapping row; mapping rows that do not resolve.

**Components and patterns.** Feature-local copies of `Page`, `EmptyState`,
`ActionButton`, `SourceBadge`, `Table`, `Combobox`, `DateField`; raw `<button>`
where `ActionButton` belongs; clickable `div`s; icon controls with no label;
inconsistent states.

**Responsive.** The tiers in `lib/media.ts` and `RESPONSIVE-CONTRACTS.md`;
overflow, truncation, long copy, 44px targets, fixed and sticky stacking,
tables on narrow screens.

**Accessibility.** Landmarks and headings, label and error association,
keyboard and visible focus, `useModal` for any overlay, contrast on every
ground (`lib/contrast.test.ts`), meaning not carried by colour alone,
reduced motion.

## Severity

- **Blocker:** breaks critical usability or accessibility, the token pipeline,
  or a release gate.
- **Major:** repeatable drift, a broken component or pattern contract,
  significant responsive or accessibility regression.
- **Minor:** a localised inconsistency or a documentation gap.

## Report

Use evidence from actual files: path and line, or token name, or Figma node.
A claim with no evidence is not a finding.

```
# Semester design-system audit
## Executive assessment     alignment (strong/moderate/weak/critical drift), highest-risk finding, main concern
## Repository model         concern | current authority | evidence
## Findings                 severity | location | category | evidence | existing Semester solution | smallest fix
## Token parity             Figma variable or code token | exported path | CSS source | status | resolution
## Component parity         Figma or screen component | React/CSS implementation | state/variant parity | status | resolution
## Existing enforcement     contract | existing test or script | what it proves | what remains
## Minimal implementation plan   priority | path | change | why | acceptance command
```

Token and component parity tables are only filled from a real Figma read.

## Rules for recommendations

- Preserve the existing token and export architecture; extend it, never add a
  second source of truth.
- Use the tests that exist before introducing tooling.
- No Tailwind, Storybook, monorepo or package migration unless the evidence
  supports it and the person asked.
- No component built for a one-off visual difference.
- Never recommend a raw value to match Figma pixels.
- Prefer semantic variables, existing classes and documented patterns.
- Anything that changes how the app looks is the owner's decision. An
  undefined variable that is fixed starts to apply a declaration nobody has
  seen; propose the token, do not slip it in.
- A change to a token is a pull request: the decision is
  `docs/decisions/D-<pull request number>.md`, written after the PR is open.

## No-edit mode

Do not modify source during an audit. Read-only inspection and the existing
test and audit commands are fine. After the report, edit only what the person
asks for.
