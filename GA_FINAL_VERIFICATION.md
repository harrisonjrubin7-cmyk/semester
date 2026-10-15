# Semester GA final verification

**Verified candidate:** `codex/market-readiness-transformation`, rebased onto `origin/main` at `92eeafd9`
**Date:** 2026-10-02 (America/Chicago)
**Final decision:** **NO-GO**

## Verification summary

| Check | Result | Notes |
| --- | --- | --- |
| Typecheck | PASS | candidate source compiles |
| Lint and terminology/style gates | PASS | warnings remained within repository budget |
| Production build | PASS WITH WARNING | build succeeds; large-chunk warnings require performance disposition |
| Launch-readiness model | PASS / NO-GO | 25 tests pass; the expected current verdict is NO-GO |
| Guide cold-load accessibility regression | PASS | desktop and phone focused axe test passes after fix |
| Full test suite | PASS | final second-pass run: 1,257 files passed; 19,610 tests passed; 48 intentionally skipped; zero failures in 407.10 seconds |
| Browser journeys | PASS | cold routes, six accessibility journeys at desktop/400% reflow, pilot at 390/1280, 13-step golden path at phone/desktop, and institutional preview across seven route/viewports plus 12 roles |
| Bundle budget | PASS | first load 435.0/479.0 KB; largest budgeted file 435.7/480.0 KB; 93 routes |
| Source screen audit | FINDING | 96 screens: 29 system-ready, 55 targeted migration, 12 redesign before new features; five human criteria are not scored |
| Dependency audit | PASS | npm 10.9.3 audited the production graph at `--audit-level=high`; 0 vulnerabilities; evidence in `docs/evidence/security/2026-10-02-production-dependency-audit.md` |
| Secret scan | PASS | checksum-verified Gitleaks 8.28.0 scanned approximately 518.06 MB; no leaks found |
| Clean install / SBOM | PASS | isolated clean install reproduced 220 packages; CycloneDX 1.5 production SBOM generated successfully |
| HawkScan DAST | NOT RUN | Hawk runtime and API key unavailable in this environment |
| Targeted security/control tests | PASS | 66 tests: host headers, secrets inventory, supply chain and security policy |
| External penetration test | NOT DONE | blocking assurance gap |
| Qualified accessibility audit | NOT DONE | blocking assurance gap |
| Production restore/rollback drills | NOT DONE | repository rehearsal is not production proof |
| Legal/counsel approval | NOT DONE | documents explicitly remain drafts |
| Vanderbilt approvals | BLOCKED | 0 approved / 60 pending in the named-tenant register |
| Council sign-off | NOT DONE | seats/signatures missing |

## Defect remediation in this candidate

- Fixed a cold deep-link crash in Guide listen mode while the dynamic catalog is loading.
- Strengthened the accessibility test harness to fail if the application error boundary renders.
- Stabilized the default full-suite execution under load by bounding worker concurrency and assigning an explicit budget to the long-running integration scenario.
- Reworked the key-read audit to index source reads in one pass; the focused assertion now completes in milliseconds instead of timing out under the full-suite load.

These changes improve the candidate but do not change the GA decision.

## Commands and instruments used

The host had bundled Node but no native npm, so npm-script equivalents were invoked directly:

- `tsc -b --noEmit`
- `oxlint --max-warnings=25 src` plus `scripts/styles.mjs`, `scripts/labels.mjs`, and `scripts/terms.mjs`
- `vite build`
- `vitest run` (default full suite), focused launch, evidence, accessibility and security/control suites
- `node scripts/budgets.ts`
- `node scripts/screen-audit.mjs`
- built-app browser checks through Playwright/Chrome at phone, desktop and 400% reflow widths
- keyboard spot check: fresh-load first Tab focused “Skip to content”; activation moved focus to `main`
- isolated `npm ci`, npm production audit, CycloneDX generation, and checksum-verified Gitleaks scan
- HawkScan capability/runtime/key discovery (scanner unavailable; no scan result)

DAST, production deployment, production rollback/restore, live authentication/authorization and external-provider acceptance gates remain unverified.

## Known limitations and owners

| Limitation | Severity | Owner | Target remediation date |
| --- | --- | --- | --- |
| open launch and go-live gates | P0 | Release owner and full council | unassigned; must be set before re-review |
| named-tenant approval absent | P0 | Institution champion | controlled by institution; no date approved |
| legal/privacy documents not in force | P0 | Privacy/Legal | counsel-controlled; no date approved |
| production restore/rollback/incident evidence absent | P0 | Operations/SRE | unassigned; before re-review |
| external security and accessibility assurance absent | P1 | Security / Accessibility | unassigned; before re-review |
| on-call and customer support coverage incomplete | P1 | Operations / Success | unassigned; before re-review |
| commercial lifecycle not GA-proven | P1 | Finance / Product | unassigned; before paid release |
| bundle-size warnings and full performance matrix | P2 | Engineering | unassigned; before re-review or formally accepted |

Unassigned owners and dates are themselves release failures; this document does not invent commitments.

## Rollback recommendation

No GA deployment is authorized, so there is no GA rollback to execute. Retain the current beta posture and copy. If the Guide fix is deployed separately, use the existing release workflow and rollback runbook, verify the triggering and deployed SHAs match, then smoke-test the deep link and monitor error/availability signals.

## Release-owner conclusion

The candidate is not approved for GA, public beta-exit language, institutional production deployment or an enterprise-readiness claim. Re-evaluate only after every P0/P1 gap has dated evidence, the complete candidate verification is green, and council plus named-tenant approvals bind to the same immutable configuration.
