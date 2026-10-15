# ADR-0013 · Accessibility checks block a release, and a qualified manual evaluation precedes any paid pilot

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date opened | 2026-10-04 |
| Owner (role) | Accessibility owner (product and engineering) |
| Deciders / reviewers | Founder; counsel (accessibility obligations, conformance statements); qualified accessibility assessor |
| Review date | 2026-11-04 |
| Phase / gate | Phase 1 (required automated checks); Phase 2 (manual evaluation before paid pilot) |
| Related | `FITNESS_FUNCTIONS.md` #9; `docs/finalization/EXTERNAL-EVIDENCE-QUEUE.md` EXT-008; `docs/integrated-trust/ACCESSIBILITY-PROGRAM.md`; `app/src/designcontracts.test.ts`; `findings-commercial.md` #7; `CLAUDE.md` ("Contrast"); ADR-0012 |
| Supersedes / superseded by | — |

## Context
- Automated evidence exists: `app/src/a11y/*.test.tsx` (axe via `axe-core` in `app/src/a11y/axe.test.tsx`; landmarks, focus, modal, motion, labels, field errors), `app/src/designcontracts.test.ts` (documents under `docs/design/`), `RESPONSIVE-CONTRACTS.md`. Browser: `app/scripts/accessibility-smoke.mjs` (`npm run smoke:a11y`), step `Audit critical accessibility journeys` in `.github/workflows/ci.yml`, and `app/scripts/contrast-sweep.mjs`, `wallsweep.mjs` daily in `.github/workflows/contrast.yml`; `app/src/lib/contrast.test.ts` walks the whole ramp for both faded rungs (`CLAUDE.md`).
- The ci.yml step comment says "automated regression evidence, not a formal WCAG audit" (`FITNESS_FUNCTIONS.md` #9).
- No check is a required GitHub status (`rules/branches/main` is `[]`: `findings-platform.md` header), so a failing a11y step reports but does not block a merge.
- Manual evaluation is open: `docs/finalization/EXTERNAL-EVIDENCE-QUEUE.md` EXT-008 "Qualified accessibility evaluation", status OPEN, needed before broad individual or paid pilot; `claims.ts` row `a11y-human` is in preparation (`findings-commercial.md` #7).
- Public copy outruns that evidence: tagline "Built for accessibility / Private by design" (`company-site/index.html:247`) against CLM-007, CLM-008, CLM-010 (`findings-commercial.md` #7).
- No visual regression exists (`FITNESS_FUNCTIONS.md` "What is not in either table"); main fails CI about half the time, so a non-required a11y step is easily ignored (`findings-platform.md` #4).
- Screens for roles and consoles (ADR-0010 approvals, ADR-0011 conflict states, ADR-0009 offline states) add new interactive surface not yet covered by a journey.

## Problem
How is accessibility held as a condition of release rather than an advisory measure, without claiming conformance that no qualified person has evaluated?

## Decision drivers
1. A regression in a critical journey cannot merge.
2. Manual assistive-technology evidence exists before institutional users rely on the product.
3. No conformance, VPAT/ACR or "accessible" claim without evidence and counsel review.
4. Cost fits a one-operator team.

## Alternatives considered
| Option | For | Against | Why not / why |
| --- | --- | --- | --- |
| A. Advisory automated checks (status quo) | No friction | Ignored when main is red | Rejected |
| B. Full WCAG audit before every release | Strongest | Not feasible per release | Rejected |
| C. Automated checks required; manual AT checklist on changes to listed journeys; one qualified evaluation before paid pilot | Proportionate | Automation catches a minority of issues | Chosen |
| D. Accessibility overlay product | Quick | Does not address the code; no evidence it satisfies obligations (counsel) | Rejected |

## Decision
**Recommended, unratified; no agent can accept it. Legal obligations and conformance wording are for counsel; this ADR makes no statement about them.**
1. `Test` (including `app/src/a11y`) and `Audit critical accessibility journeys` are required status checks once the ruleset is applied (ADR-0012); the daily `contrast.yml` failure opens an issue.
2. Critical journeys are listed in `docs/design/` with a contract each; a new route in that list without a contract fails `designcontracts.test.ts`.
3. A pull request touching a listed journey records a short keyboard and screen-reader pass (checklist in the PR), by someone other than the author where possible.
4. EXT-008 is closed by a qualified assessor's report and remediation list before any paid pilot; the report, not the repo, supports any conformance statement.
5. Public copy about accessibility is limited to the scoped CLM-007 statement until then (`public-claims-evidence`).

## Consequences
Positive: regressions in landmarks, labels, focus and contrast stop at merge. Negative: false positives block work; assessor cost. Harder: shipping a quick UI.

## Impact
- **Data / tenancy:** none.
- **Security:** none.
- **Privacy:** assessor sessions need seeded data, not real records.
- **Accessibility:** this ADR is the control; automated checks are a floor, not evidence of conformance.
- **Operations (SLO, alert, runbook, support):** accessibility issue intake route; owner for remediation.
- **Cost / commercial:** assessor engagement; procurement questionnaires depend on the outcome (counsel).

## Implementation
1. Add the two checks to the ruleset's required contexts. 2. List journeys and contracts. 3. Add the PR checklist. 4. Scope the EXT-008 engagement. 5. Reword the tagline after counsel (`company-site/index.html:247`).

## Tests and verification
- Remove an `aria-label` from a labelled control: `app/src/a11y/labels.test.ts` fails; restore.
- Remove the main landmark from the app shell: `app/src/a11y/landmarks.test.ts` fails. Drop a ramp ground below contrast: `contrast.test.ts` fails.
- Add a new critical-journey route with no contract: `designcontracts.test.ts` fails.
- Control: a known-good journey passes `smoke:a11y`; a deliberate focus trap in a modal fails `modal.test.ts`.
- Meta: with the ruleset applied, a branch with the a11y failure cannot merge.

## Fitness functions
- `accessibility-contracts` (existing mechanisms; proposed visual/axe additions per `FITNESS_FUNCTIONS.md` #9): any a11y test, journey audit or contrast sweep red; `build` and `contrast.yml` schedule.
- `public-claims-evidence` (`scripts/architecture/public-claims-evidence.mjs`): accessibility claim without register evidence.
- `branch-protection-readback`: required contexts missing.

## Rollback / reversal
Remove a context from the required list. Cheap; the risk is merging regressions unseen.

## Open questions
- Journey list and assistive-technology matrix (screen reader/browser pairs).
- Counsel: which accessibility standard applies to which customer type.
- Assessor selection and timing.

## Addenda
(none)
