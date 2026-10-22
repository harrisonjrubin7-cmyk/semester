# Claude Code commands

## 0 · Set up (once, from the repo root)

```bash
cd /path/to/semester
claude mcp add --scope project --transport http figma https://mcp.figma.com/mcp
# or: claude plugin install figma@claude-plugins-official   (pick one route, not both)
claude
```
In Claude Code run `/mcp`, authorise Figma in the browser, confirm it shows connected.

## 1 · Audit (no edits)

```
/audit-semester-design-sync app/src app/design-tokens/semester.tokens.json app/src/styles

You are auditing the existing Semester repository, not designing a generic new system.
First: git fetch origin main && git log --oneline -30 origin/main.
Read: CLAUDE.md, app/README.md, DESIGN-SYSTEM-GUIDE.md, docs/DESIGN-TOKENS.md,
docs/DESIGN-TOKEN-ARCHITECTURE.md, docs/design/DESIGN-SYSTEM-PRODUCT-SPEC.md, app/package.json,
app/src/styles/tokens.css, app/src/lib/look.ts, app/src/lib/tokenexport.ts (+ .test.ts),
app/design-tokens/semester.tokens.json, app/src/styles/*.test.ts, .claude/skills/.
Inspect: app/src/components/ (esp. unity/), app/src/screens/, app/src/styles/, App.tsx, main.tsx, screens.tsx.
Do not modify files. Produce the report format in the skill:
1 architecture + source-of-truth map; 2 token pipeline look.ts/tokens.css → tokenexport.ts →
semester.tokens.json → Figma variables; 3 strengths to preserve; 4 drift risks (raw styles, hex,
duplicated component styles, hard-coded z-index/durations); 5 existing tests that enforce contracts;
6 exact missing files for the Claude Code + Figma MCP workflow only; 7 minimal phased plan;
8 table: priority · exact path · rationale · acceptance test.
Use evidence from actual files. Do not assume pnpm, monorepos, Storybook or Tailwind.
```

## 2 · Implement the toolkit (after you approve the audit)

```
Implement the approved Semester Claude Code design-system toolkit.

Constraints:
- Preserve the Vite + React app under app/, tokens.css as the semantic authority, look.ts (tokensFor)
  as the value authority, tokenexport.ts as the export authority, semester.tokens.json as generated output.
- Extend the existing tokenexport, style, accessibility, responsive and contract tests; don't replace them.
- No Tailwind, Storybook, monorepo, new component package, or new dependency.
- Don't move components or rewrite App.tsx. Don't commit, push, open a PR or touch deployment config.

Create only (the drafts are in this hand-off folder — reconcile them with the audit, don't paste blindly):
1 .claude/skills/audit-semester-design-sync/SKILL.md
2 .claude/skills/build-semester-ui/SKILL.md
3 .mcp.json (Figma remote MCP, no credentials)
4 docs/design-system/FIGMA-MAPPING.md
5 app/scripts/design-system-audit.mjs
6 app/scripts/design-system-report.mjs
7 app/package.json scripts: design-system:audit, design-system:report, design-system:check
8 app/src/lib/designsystem.test.ts proving: the export is generated and in sync; raw values outside
  the hex ledger fail; every Figma mapping row resolves; audit/report fail on violating fixtures and
  pass on valid ones.

Show the file-by-file plan before editing. Revert each fix under its test once to watch it go red.
After editing run, from app/: npx tsc -b && npm run lint && npm test && npm run test:shuffle &&
npm run design-system:check. Report changed files, exact commands, results, limitations and any
Figma steps left for me.
```

## 3 · Day-to-day

```
/build-semester-ui screens/Degree.tsx https://www.figma.com/design/…?node-id=…
```
```bash
cd app && npm run design-system:report -- --out design-system-report.md
```
