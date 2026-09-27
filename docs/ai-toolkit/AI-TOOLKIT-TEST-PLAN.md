# AI Toolkit test plan

## Automated (this branch)

| File | Tests | Covers |
| --- | --- | --- |
| `app/src/lib/toolkit/rules.test.ts` | 34 | Classification gate · policy precedence and fallback · flags and kill switch · catalog, entitlement, `NEVER` · recommendation inputs · boundary notices |
| `app/src/lib/toolkit/work.test.ts` | 42 | Templates and stage participation · private-by-default · evidence verification · screening · cautions · claim audit and causal wording · citation export · data import gate, raw preservation, cleaning log, alt text, method guide, interpretation gaps · rubric (no prediction) · declaration |
| `app/src/components/toolkit/Toolkit.test.tsx` | 10 | Driven in jsdom: goal-first entry, finite explained recommendations, hide, native hand-off, policy unavailable, student-record labelling, stage refusal, verify refusal, flags hiding sections, data import refusal, restricted workbench |
| `app/src/lib/deploy.test.ts` | (existing) | The six new flag variables are mapped into the Pages build |

## Revert checks

A guard that has never failed is not known to be a guard. Each of these was broken on
purpose, the suite run, and the change restored:

| Guard broken | Result |
| --- | --- |
| `blockers()` stops requiring *original opened* | 3 tests fail |
| Kill switch removed from `toolkitFlags()` | 1 fails |
| `completeStage()` stops requiring a note | 1 fails |
| Causal-conclusion check removed from `interpretationGaps()` | 1 fails |
| `explicitOnly()` copies every key instead of the allowlist | 1 fails |
| `recommend()` stops calling `explicitOnly()` | **0 fail** — `recommend` reads only named fields, so extra keys cannot reach its output today. The call is kept as defence for future code; the guard that bites is the one on `explicitOnly` itself. |

## Repository gates

`npx tsc -b` · `npm run lint` (oxlint, styles, labels) · `npm test` · `npm run test:shuffle` ·
`npm run build`. Results are recorded in the pull request.

## Launch gates (brief) — status

| Gate | Status |
| --- | --- |
| Tenant isolation / RLS / object authorization | **Not applicable yet** — device-only; required for the server phase |
| Source provenance and freshness visible | Partial — verification visible; freshness needs the server |
| Data classification gate tested | Done (client) |
| Upload / file / media security | Partial — size cap, CSV parse only, no media |
| Course / assignment policy controls | Partial — course layer only |
| Academic integrity and disclosure flow | Done (client) |
| Privacy, retention, export, deletion, consent | Export and delete done; retention and consent need the server |
| Subject-specific safety boundaries | Done for catalog and entitlement |
| Accessibility / device matrix | Partial — see [DEVICE-TEST-MATRIX.md](DEVICE-TEST-MATRIX.md) |
| Feature flags and kill switch | Done |
| Threat-model review recorded | **Open** — needs a human reviewer |
| No prohibited high-risk capability enabled | Done |
| Human review where connector / provider / license required | Nothing requiring it is built |
