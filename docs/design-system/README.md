# Semester design-system workflow

**Order of authority:** `lib/look.ts` → `styles/tokens.css` → `lib/tokenexport.ts` → `design-tokens/semester.tokens.json` (generated) → `docs/design-system/FIGMA-MAPPING.md` → Figma.

**Never hand-edit:** `app/design-tokens/semester.tokens.json`, `app/reports/`.

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
| `npm run design-system:report` | Writes `app/reports/design-system/report.md` + `.json`, runs 8 existing contract tests |
| `npm run design-system:check` | All of the above that gate a PR |

## Adding a mapping
Add a row to `FIGMA-MAPPING.md` whose first path cell is `semantic.<name>` or `primitive.<name>` as it appears in the JSON. Run `npm run design-system:audit`; a path that does not resolve fails as *missing*.

## Reading the report
**Violations** (blocker/major) fail CI. **Warnings** (minor) are raw inline values with the token to use instead; they do not fail until a baseline is agreed. **Unmapped candidates** are exported semantic tokens no Figma variable uses yet — informational.
