# Design-system tooling

What keeps Claude Code, the React app, the CSS tokens and Figma in step, and the
commands that check it. The design itself is described in
[`DESIGN-SYSTEM-GUIDE.md`](../../DESIGN-SYSTEM-GUIDE.md) and [`docs/design/`](../design/README.md);
this folder is the tooling around it. What existed before it was added is in the
[baseline](SEMESTER-DESIGN-SYSTEM-BASELINE.md).

## Which file wins

In order. When two disagree, the earlier is right and the later is stale.

1. [`app/src/lib/look.ts`](../../app/src/lib/look.ts) — every colour, on 13 grounds and 11 accents.
2. [`app/src/styles/tokens.css`](../../app/src/styles/tokens.css) — the semantic CSS tokens.
3. [`app/src/lib/tokenexport.ts`](../../app/src/lib/tokenexport.ts) — builds the export from those two.
4. [`app/design-tokens/semester.tokens.json`](../../app/design-tokens/semester.tokens.json) — **generated.**
5. The contract tests in `app/src/styles/` and `app/src/a11y/`.
6. Figma — approved visual intent, never an authority over the above. See [FIGMA-MAPPING.md](FIGMA-MAPPING.md).

## Never hand-edit

| File | Regenerate with |
|---|---|
| `app/design-tokens/semester.tokens.json` | `npm run tokens:export` |
| `app/src/styles/rawbudget.ts` | `npm run design-system:audit -- --fix` |
| `app/src/styles/budget.ts` | `npm run lint:styles -- --fix` |
| `app/reports/design-system/*` | `npm run design-system:report` (git-ignored) |

## Commands

All from `app/`.

| Command | What it does | Fails when |
|---|---|---|
| `npm run tokens:check` | Runs `lib/tokenexport.test.ts`, which holds the committed export to `tokens.css` and `look.ts`. Builds no export of its own. | The export is stale or hand-edited |
| `npm run design-system:audit` | Counts raw colours, z-indexes, shadows, radii, durations and easings, CSS spacing and CSS type per file against `src/styles/rawbudget.ts`. `-- --fix` rewrites the ledger. | A file has more than the ledger allows, or fewer (run `--fix`) |
| `npm run design-system:check` | `tokens:check`, the audit and the Figma mapping check, all of them every time | Any of the three fails |
| `npm run design-system:report` | The same, plus the style and accessibility contract tests, written to `app/reports/design-system/design-system-report.md` and `.json` | A blocker or a major finding |

The audit's rules and what it leaves to other checks are written at the top of
[`app/src/styles/designsystem.ts`](../../app/src/styles/designsystem.ts). In short: a raw value
*used* by a rule counts; a custom-property *definition* does not; quoted hex in
`.tsx` is `hex.test.ts`'s; font size, leading and spacing in `.tsx` are
`lint:styles`'s.

CI runs the check and the report in `ci.yml`, with no credentials, and uploads the
report as an artifact.

## Reading the report

Open `design-system-report.md`. Its findings table is the only thing that fails a
build; the ledger counts are debt already carried, shown so the trend is
visible.

| Severity | Meant | Example |
|---|---|---|
| Blocker | A source of truth is broken | Export out of step; a contract test failing; a Figma variable mapped to a token that does not exist |
| Major | Drift got worse | A raw value beyond the ledger; a required token with no mapping |
| Minor | Bookkeeping or a note | The ledger can shrink (`--fix`); an obsolete mapping whose token still exists |

A raw value flagged by the audit usually has an answer already: the message names
the token (`--layer-overlay`, `--ease-standard`, `--sp-4`, `--type-sm`…). If the
value has to stay, raise that file's row with `--fix` and say why in the same
diff, where a reviewer sees a number go up with your name on it.

## Claude skills

Invoke from Claude Code in this repository:

| Skill | Use it to |
|---|---|
| `/build-semester-ui` | Add or restyle a screen or component from the existing patterns, tokens and states |
| `/audit-semester-design-sync <path> [figma url]` | Audit a route or component against the system and optionally a Figma frame. Read-only; produces a report |
| `/create-semester-component` | Decide whether a new shared component is justified, and specify it |

They live in [`.claude/skills/`](../../.claude/skills/). `CLAUDE.md` holds the
rules they follow.

## Figma MCP

Authenticate once per developer, interactively. The steps are in
[FIGMA-MAPPING.md](FIGMA-MAPPING.md#setup-once-per-developer).
