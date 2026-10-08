# Semester design-system workflow

**Order of authority:** `lib/look.ts` → `styles/tokens.css` → `lib/tokenexport.ts` → `design-tokens/semester.tokens.json` (generated) → `docs/design-system/FIGMA-MAPPING.md` → Figma.

**Never hand-edit:**

| File | Regenerate with |
| --- | --- |
| `app/design-tokens/semester.tokens.json` | `npm run tokens:export` |
| `app/design-system-baseline.json` | `npm run design-system:baseline` |
| `app/src/styles/rawbudget.ts` | `npm run design-system:css -- --fix` |
| `app/src/styles/budget.ts` | `npm run lint:styles -- --fix` |
| `app/reports/` | `npm run design-system:report` (git-ignored) |

## Brief crosswalk
- [MASTER-BRIEF-CROSSWALK.md](MASTER-BRIEF-CROSSWALK.md) — the 19-deliverable design brief mapped to where each already lives, and what is missing.
- [COMPONENT-SPEC-MATRIX.md](COMPONENT-SPEC-MATRIX.md) — the 12 fields (purpose, variants, tokens, accessibility, responsive, five states, analytics event, test) for every component.
- [SCREEN-PACKS.md](SCREEN-PACKS.md) — the 18 named screens against the seven questions, with app and prototype locations.
- [HANDOFF-INTEGRATION-CROSSWALK.md](HANDOFF-INTEGRATION-CROSSWALK.md) — the design export mapped onto this repository. A merged decision is kept; the free-text scanner is not built.
- [REFERENCE-CAPABILITY-REGISTRY-RECONCILIATION.md](REFERENCE-CAPABILITY-REGISTRY-RECONCILIATION.md) — all 122 mounted-archive capability rows dispositioned against current permission, tenant, data, operation, recovery and test authorities.
- [REFERENCE-PROTOTYPE-ROUTE-RECONCILIATION.md](REFERENCE-PROTOTYPE-ROUTE-RECONCILIATION.md) — all 281 archive prototype routes mapped to current screens, navigation, catalog/capability evidence and one bounded disposition.
- [HANDOFF-INTEGRATION-STATUS.md](HANDOFF-INTEGRATION-STATUS.md) — resumable automation status, open gates and the next dependency-ready reconciliation slice.

## Skills
- `/build-semester-ui <screen> [figma-url]` — build or change UI from existing primitives.
- `/audit-semester-design-sync [figma-url] [path]` — read-only report.
- `/create-semester-component <name> <screens>` — spec-first shared component.

## Figma MCP (each developer, once)
```bash
claude mcp add --scope project --transport http figma https://mcp.figma.com/mcp
claude    # then run /mcp and authenticate in the browser
```
`.mcp.json` holds only the endpoint; authentication is interactive and per developer. CI never authenticates to Figma.

## Checks (from `app/`)
| Command | What it does |
| --- | --- |
| `npm run tokens:check` | Fails if the committed JSON differs from `buildTokenExport` |
| `npm run design-system:audit` | Raw values vs the hex LEDGER, undefined variables, tokens.css ↔ export, Figma mapping — file:line |
| `npm run design-system:css` | Raw colours, z-indexes, shadows, durations, easings, spacing and type in the stylesheets, and colour functions in `.tsx`, against `src/styles/rawbudget.ts`. `-- --fix` rewrites the ledger; it may shrink and may not grow |
| `npm run design-system:report` | Writes `app/reports/design-system/report.md` + `.json`, runs 8 existing contract tests |
| `npm run design-system:check` | Token drift, the audit, the stylesheet ledger and the tests that hold them. CI runs this, then the report, and uploads `app/reports/design-system/` |
| `npm run design-system:baseline` | Rewrites `app/design-system-baseline.json` from the tree. It only records what is measured, so a raised number shows in the diff |

## Adding a mapping
Add a row to `FIGMA-MAPPING.md` whose first path cell is `semantic.<name>` or `primitive.<name>` as it appears in the JSON. Run `npm run design-system:audit`; a path that does not resolve fails as *missing*.

## Reading the report
**Violations** (blocker/major) fail CI. **Warnings** (minor) are raw inline values with the token to use instead; they do not fail until a baseline is agreed. **Unmapped candidates** are exported semantic tokens no Figma variable uses yet — informational.

## Two ledgers, and why

`.tsx` raw values are counted by `design-system-audit.mjs` against `app/design-system-baseline.json`, with the line and the token to use. Stylesheets, and colour functions in `.tsx`, are counted by `design-system:css` against `src/styles/rawbudget.ts`. Neither counts what the other does, so a value is never on two lists; what each leaves to the other, to `hex.test.ts` and to `lint:styles` is written at the top of `src/styles/rawvalues.ts`. A raw value *used* by a rule counts; a custom-property *definition* (`--x: #fff;`) is the token being decided and does not.

If a value has to stay, raise that file's row with the matching command and say why in the same diff, where a reviewer sees a number go up with your name on it.

## Not done

Fixing the carried raw values; fetched Figma names (the mapping holds proposed ones until a file is connected); visual regression in CI; any Figma write.
