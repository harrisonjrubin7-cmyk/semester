# Semester — Claude Code handoff package

> **Start at `BUILD.md`.** It is the single entry point: preflight → install → streams in order → verify → human-only steps → go.

Everything a developer needs to turn the design system into the product. Open Claude Code at the repo root (harrisonjrubin7-cmyk/semester) and work through these in order.

| # | Folder | What it is | Start with |
| --- | --- | --- | --- |
| 1 | `claude-code-toolkit/` | Skills (build-semester-ui, audit-semester-design-sync, create-semester-component), .mcp.json for Figma, design-system audit + report scripts, tests, CI steps, baseline ratchet | `EXECUTE.md` |
| 2 | `semester-core/` | Workflow algorithms as pure TypeScript with tests: provenance, next action, access, freshness, consequence, AI gateway, approvals, scoring, pilot readiness | `README.md` |
| 3 | `workflow-router-app/` | Next.js + Supabase AI Workflow Router & Benchmark Lab (already landed as workflow-lab/ upstream) | `README.md` |

Code files carry a `.txt` suffix so the design project doesn't bundle them: `find . -name "*.txt" -exec sh -c 'mv "$1" "${1%.txt}"' _ {} \;`

| 0 | `execute/` | **Start here.** 12 stream prompts (setup to launch to grow) plus a master index that runs them in order on branches semester/<stream> | `execute/00-INDEX.md` |

## Reference (stay in the design system)
- `readme.md`, `SKILL.md` — design rules, tokens, components, patterns
- `ui_kits/master-catalog/` — 51 roles · 673 screens · 319 workflow steps (17 workflows) · 88 systems · 82 docs, with status and a Claude Code prompt that writes `docs/master/`
- `ui_kits/architecture/` — full stack & data: 20 tables, request flows, operations
- `ui_kits/role-lens/`, `ui_kits/atlas/`, `ui_kits/wireframes/` — every role × screen
- `ui_kits/business/Operating Manual.html` — how to run the company

## Order of work (P0 first)
1. Install the toolkit and pass `npm run design-system:check`.
2. Drop `semester-core` into `app/src/lib/core/`; reconcile names with `lib/source.ts`, `lib/status.ts`; run its tests.
3. Ship the pilot blockers: SAML SSO, AI-gateway test (no student records), DPA mapping, audit-before-action.
4. Run the master-catalog prompt to produce `docs/master/` from real evidence.

Never commit, push or deploy from these prompts without review.
