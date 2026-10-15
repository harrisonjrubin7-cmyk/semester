# Stream 11 · Public site, GTM, run and grow

The public site and company operating documents.

Paste this file into Claude Code (or Codex) at the repo root.

## Inputs from the design project
- `ui_kits/company-site/`
- `docs/brief/`
- `docs/legal/` (drafts)
- `ui_kits/business/`

## Tasks
1. Full public site: home, product, institutions, students, security/trust, pricing, about, contact, legal. Claims come only from the public claims register: status, not certifications.
2. Contact and pilot-request forms with spam protection; no student data collected.
3. Publish legal drafts as pages marked "draft pending attorney review" until reviewed.

## Exit gates
- [ ] Every claim cites its source
- [ ] a11y 95+
- [ ] Forms tested

## Rules (every stream)
- Repo: harrisonjrubin7-cmyk/semester. Work on branch `semester/company-site-grow` from latest `origin/main`. Open one PR per stream; merge only after CI is green and a human approves.
- Read first: CLAUDE.md, README, `git log --oneline -30`, and this design project's `readme.md`, `SKILL.md`, `docs/master/*`.
- Audit before you write: find what already exists for each item and extend it. Do not create a parallel implementation. Record each "exists / extended / new" decision in the PR description.
- Design system: use tokens and components only (no raw hex, px z-index or durations); `npm run design-system:check` must pass.
- Data: RLS on every table, `tenant_id` on every row, browser calls `api.*` only. Company roles (investor, CS, RevOps, finance) never read student tables. AI never receives student records.
- Every consequential action: preview, then audit event written first, then apply, then an undo or request path.
- Every screen: loading, empty, error, forbidden and offline states, keyboard path, visible focus, accessible names, 44px targets.
- Do not commit secrets, change production settings, deploy, or write to Figma. Stop and report on the first failure you cannot fix inside this stream.
- Nothing is "done" without code, tests, RLS proof, accessibility check, monitoring hook, docs and release evidence (the 22-point definition in `docs/master/SEMESTER_RELEASE_GATE_CATALOG.md`).

## Report at the end
Files changed · commands run with results · tests added · RLS cases proven · open gaps with priority · what the next stream needs.
