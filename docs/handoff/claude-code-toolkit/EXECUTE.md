# Execute the five follow-ups in Claude Code

Paste into Claude Code at the repository root. It runs everything I could not run from Claude Design.

```
Read handoff README.md, CLAUDE.md, docs/design-system/SEMESTER-DESIGN-SYSTEM-BASELINE.md. git fetch origin main && git log --oneline -30 origin/main first.
Do not commit, push, open a PR, change secrets or write to Figma. Stop and report after each step that fails.

STEP 1 — Install and run
- Copy the toolkit tree into the repo; for f in $(find . -name "*.txt" -path "*toolkit*"); do mv "$f" "${f%.txt}"; done
- Append CLAUDE.md.design-system-section.md to CLAUDE.md (do not change existing sections). Add gitignore.addition to .gitignore.
- Merge app/package.scripts.json into app/package.json scripts (keep existing scripts).
- From app/: npm run tokens:check; npm run design-system:audit; npx vitest run src/lib/designsystem.test.ts; npx tsc -b; npm run lint; npm test.
- Fix only failures caused by the toolkit (e.g. a regex catching a false positive). Revert one check's fix and watch its test go red, then restore. List pre-existing failures separately.

STEP 2 — Agree the raw-value baseline
- npm run design-system:baseline → app/design-system-baseline.json. Print totals per check (z-index, duration, easing, shadow, font-size, radius) and the 10 largest files.
- Show me the table and wait for "approve baseline" before continuing.

STEP 3 — Figma (needs me)
- If /mcp shows figma connected and I give a file URL: read its variable collections and components (read-only). Replace every "(proposed)" name in docs/design-system/FIGMA-MAPPING.md with the fetched name, set Status per row (Match / Partial / Missing in Figma / Missing in code), move unmatched Figma variables to Unresolved. Do not invent names. Run design-system:audit; 0 missing mappings.
- If not connected: say so and skip.

STEP 4 — Move inline z-index and durations onto tokens
- For each baseline entry with check z-index or duration in app/src (not look.ts, not LEDGER files):
  z-index 1→var(--layer-raised) 20→var(--layer-sticky) 21→var(--layer-chrome) 80→var(--layer-overlay) 90→var(--layer-menu) 100→var(--layer-skip) 1500→var(--layer-curtain); any other number: leave it and list it with its reason.
  durations: transitions/animations → var(--motion-save|insert|panel|sheet|progress) by job (130ms hover/press → var(--fast)); never --duration-* directly (those are not zeroed for reduced motion).
- Keep stacking.test.ts, motion.test.ts, a11y tests green. Re-run npm run design-system:baseline so the baseline shrinks; the stale check enforces it.

STEP 5 — Make it a CI gate
- Insert .github/ci-design-system-steps.yml into .github/workflows/ci.yml build job after "npm run lint". The committed baseline now makes any new raw value a failure.
- Run the full gate list from CLAUDE.md. Report: files changed, commands + results, baseline before/after, remaining entries with reasons.
```
