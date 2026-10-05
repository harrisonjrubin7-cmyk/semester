# AI Toolkit test plan

## Automated (this branch)

One test file per module, landing with the phase that adds the module.

| File | Tests | Phase | Covers |
| --- | --- | --- | --- |
| `lib/toolkit/flags.test.ts` | 5 | 0 | All off by default · not following the institutional preview · kill switch · code execution and connectors pinned off |
| `lib/toolkit/classification.test.ts` | 5 | 0 | Unclassified → T3 · T4–T6 blocked everywhere · T3 device-only · never widens a course policy · no external action |
| `lib/toolkit/policy.test.ts` | 8 | 0 | Precedence · fallback never permits · final answers stay prohibited · student-record labelling · redirects under a ban |
| `lib/toolkit/catalog.test.ts` | 8 | 0 | Entitlement states · `NEVER` refused under any approval · universal tools |
| `lib/toolkit/recommend.test.ts` | 5 | 1, 7 | Finite and explained · forbidden inputs ignored · hide / show fewer · assignment first · subject from course code |
| `lib/toolkit/templates.test.ts` | 6 | 1 | Every template, in order · stage needs the student's note · private through a tampered read · derived checklist |
| `lib/toolkit/rubric.test.ts` | 2 | 1 | Criteria in the rubric's own words · no prediction language |
| `lib/toolkit/research.test.ts` | 23 | 3 | Verification conditions · edits clear it · re-verified on read · screening · cautions · claim audit · export |
| `lib/toolkit/data.test.ts` | 9 | 4 | Import gate · unconfirmed dictionary · raw preserved, log replayed · alt text · ≥ 2 methods · interpretation gaps · causal conclusion |
| `lib/toolkit/subjects.test.ts` | 7 | 6–8 | Prefix lookup · no shared prefix · restricted tools stay unavailable · boundaries on clinical, legal, finance, location tools · 32 subjects |
| `lib/toolkit/disclosure.test.ts` | 2 | 9 | Gaps including attestation · material named by kind, never content |
| `lib/toolkit/safety.test.ts` | 2 | 9 | Boundary notices · quiet on ordinary coursework (including phi) |
| `components/toolkit/Toolkit.test.tsx` | 12 | 1–9 | Driven in jsdom: each phase adds the flow it builds |
| `lib/deploy.test.ts`, `lib/secrets.test.ts` | (existing) | 0 | The six flag variables are mapped into the Pages build and documented |

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
| Topic notice not rendered (phase 9) | 1 fails |
| Declaration download not disabled while incomplete (phase 9) | 1 fails |
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
| Threat-model review recorded | Independent AI review recorded in the threat model; its 12 findings fixed. **Human review still open** |
| No prohibited high-risk capability enabled | Done |
| Human review where connector / provider / license required | Nothing requiring it is built |
