# P07 validation evidence — 2026-10-03

| Control | Value |
| --- | --- |
| Status | **LOCAL RELEASE GATES PASSED; HAWKSCAN AND IMMUTABLE CANDIDATE OPEN** |
| Base revision | `d246a348` |
| Candidate identity | base revision plus the current uncommitted finalization changes; not an immutable release commit |
| Environment | macOS arm64, Node `24.19.0`, local Chrome where browser evidence was collected |
| Scope | application, institution gateway, video type surface, course data, dependencies, licenses, secrets and production build |

## Results

| Gate | Result | Exact evidence and limitation |
| --- | --- | --- |
| clean application install | **PASS** | An isolated `npm ci` using npm `11.6.2` installed 220 packages from `app/package-lock.json`; 221 packages were audited. The host runtime did not include a global npm executable, so npm was invoked through pinned `pnpm dlx`; the install itself was npm's lockfile-exact `ci` operation. |
| application typecheck | **PASS** | `tsc -b --noEmit` exited 0. |
| institution gateway typecheck | **PASS** | `tsc -p tsconfig.university.json` exited 0. |
| video install and typecheck | **PASS** | CI-equivalent `npm ci --ignore-scripts --omit=optional` installed 249 packages and audited 250 with zero vulnerabilities; `tsc -p ../video/tsconfig.json` then exited 0. An earlier typecheck before installing this package failed only on missing package/type resolution and is retained as an environment setup failure. |
| lint and repository language/style guards | **PASS WITH WARNINGS** | Lint exited 0 with 22 React warnings under the configured 25-warning ceiling; style, accessible-label and retired-term guards passed. The warnings remain debt, not a zero-warning claim. |
| ordered unit/integration suite | **PASS** | 1,257 files passed; 19,612 tests passed and 48 were explicitly skipped. jsdom emitted its known canvas and cross-document navigation limitation notices. |
| shuffled suite | **PASS** | The same 1,257 files and 19,612 active tests passed with 48 skipped under seed `1791043749393`. |
| institution gateway smoke | **PASS** | Ten checks passed across health/contract reporting, truthful disabled/unapproved adapter state, authentication, origin refusal and private sandbox storage. The first sandboxed attempt could not connect to loopback and was rerun with local-loopback permission; that first result is not classified as an application failure. |
| course-data validator | **PASS** | Four courses, 48 items and eight episodes passed all repository checks. |
| production build | **PASS AFTER RERUN** | TypeScript plus Vite transformed 4,058 modules and completed. A concurrent first attempt failed while clearing a non-empty output directory; the isolated rerun passed, so the cleanup race remains recorded rather than silently discarded. Vite still reports its advisory for chunks above 500 kB. |
| performance budgets | **PASS** | First load was 435.0 KB against 479.0 KB; the largest file was 435.7 KB against 480.0 KB; 93 routes were inventoried. |
| dependency advisory scan | **PASS** | npm audited the exact clean application tree and reported zero vulnerabilities. A pnpm-import experiment reported vulnerable `lodash-es@4.17.23`, but that translated tree did not preserve npm's override; the committed npm lock resolves the installed package to patched `4.18.1`. The experiment is not treated as evidence for the candidate tree. |
| license and workflow supply-chain policy | **PASS** | The focused supply-chain suite passed 24 tests over the repository lockfiles, license decisions, registry/integrity requirements, pinned Actions, least-privilege workflow permissions and SBOM wiring. The app lock contains 291 package entries; one (`khroma@2.1.0`) omits a license field and is covered by the repository's named MIT decision based on its shipped license. |
| production SBOM | **PASS** | npm generated CycloneDX 1.5 JSON from the isolated clean application tree: 135 components and 136 dependency relationships. The artifact was generated in temporary storage and is not an attested or signed release artifact. |
| secret scan | **PASS** | Gitleaks `8.28.0`, the version pinned by CI, scanned approximately 519.98 MB across the complete candidate working tree with redaction enabled and reported no leaks. This is a working-tree scan, not proof of provider-side secret rotation or a complete historical audit. |
| HawkScan DAST | **UNAVAILABLE / BLOCKING EXTERNAL GATE** | No Hawk/StackHawk tool or runtime is installed and `HAWK_API_KEY` is absent. No scan, fix loop or rescan occurred; DAST must not be represented as passed. |
| diff integrity | **PASS** | `git diff --check` reported no whitespace errors before this evidence record was added. |

## Related browser and journey evidence

P01 and P06 contain browser evidence against the same working-tree candidate lineage: the signed-out golden path, six critical accessibility/reflow journeys, reduced motion, performance, target sizing and scoped contrast. Those bounded results are recorded in the [first-win specification](../product-design/FIRST-WIN-SPECIFICATION.md) and [responsive QA plan](../product-design/RESPONSIVE-QA-PLAN.md). They do not establish every route, signed-in state, browser, assistive technology, real device or deployed target.

## Checkpoint P decision

**Decision: PASS for the executed local regression scope; release authorization remains NO-GO pending the open gates below.** No unresolved application regression was detected by the focused P01–P06 suites or P07's clean-install, type, lint, ordered, shuffled, gateway, build, budget, advisory, license, SBOM and secret checks.

| Classification | Items | Disposition |
| --- | --- | --- |
| unresolved new regression | none detected in the executed scope | local regression checkpoint passes |
| non-reproduced laboratory event | desktop Home measured 514 ms blocking once, then 0 ms in a five-run isolation and 1 ms in the complete rerun; one concurrent build failed clearing `dist/assets`, then the isolated build passed | retained in evidence; monitor, but not classified as a current reproducible defect |
| sandbox or setup failure | gateway smoke was initially denied local loopback; the first clean-install attempt lacked npm/network access; video typecheck initially ran before its separate dependencies were installed; npm SBOM initially inspected a pnpm-linked tree | corrected by rerunning the intended command in the proper permitted or clean environment; only the successful intended-environment result is the product result |
| known warning or bounded omission | 22 lint warnings under the 25-warning ceiling; 48 explicitly skipped tests; Vite large-chunk advisory; P06 44 px design-aim misses, small-text inventory, possible initial-rest obstruction and incomplete route/ground/device coverage | remains debt or explicitly bounded proof; none is represented as closed |
| unavailable local/target gate | PostgreSQL 17 SQL/load/restore suites, local Supabase two-device sync, deployed kill-switch and production smoke, HawkScan DAST, current hosted CI on an immutable final candidate | unexecuted; cannot be converted to a pass or waived by this checkpoint |
| external or customer gate | independent security/accessibility review, provider and tenant configuration, staffed operations, target readback/UAT, customer acceptance, activation and observed outcomes | open; outside repository proof |

The principal commands were `npm ci` through pinned npm `11.6.2`, `tsc -b --noEmit`, `pnpm run lint`, `pnpm run check:university`, `pnpm test`, `pnpm run test:shuffle`, `pnpm run smoke:gateway`, `node pipeline/validate.mjs`, `pnpm run build`, `pnpm run budgets`, the focused `supplychain.test.ts`, npm audit/SBOM, Gitleaks `8.28.0 dir`, and `git diff --check`. Exact counts, seed, scopes, reruns and limitations are recorded in the tables above and in the linked P01–P06 evidence.

The tested candidate is not identified by one commit: its base is `d246a34879b148e3464df599f5783d9060352dc5` plus the current uncommitted finalization changes. This satisfies transparent candidate identification for the working session but not the immutable-revision requirement for a release. Hosted CI and target checks must be rerun against the eventual immutable candidate.

## Post-main reconciliation record

The preceding tables preserve the original P07 session exactly. The package was subsequently reconciled with current `origin/main` at `641554dab2caa511eea8a42614f5abd4e6c8590e`; duplicate add/add readiness drafts were resolved to the more current main versions, and the saved finalization changes were reapplied. PR #1111 head `3581ee465160562a0298711d07ca62d17f3890dc` changed no path in the final 51-file package. The reconciled tree was committed locally as `125524a358c3aab01252ae900acc39f1615a687b`.

| Reconciliation gate | Result |
| --- | --- |
| focused claims | **PASS** — 2 files, 38 tests |
| lint | **PASS** — 22 warnings below the configured 25-warning ceiling |
| TypeScript and production build | **PASS** — Vite retained the existing large-chunk advisory |
| full tests, reduced concurrency | **PASS** — 1,262 files; 19,698 passed; 48 skipped; 446.63 seconds |
| changed-document links and diff integrity | **PASS** — 46 Markdown files checked, zero broken relative links; `git diff --check` clean |
| local HawkScan | **UNAVAILABLE / OPEN** — no Hawk runtime/tool and no `HAWK_API_KEY`; no scan or rescan occurred |

This later pass verifies the merged local tree, not hosted CI, DAST, PostgreSQL 17, live account sync, deployment, target operation, independent assurance, customer acceptance or launch authority. The local commit was not pushed, merged or deployed by this reconciliation.

## Release boundary

This record establishes local repository and build behavior only. It does not establish a clean immutable release commit, hosted CI success for the final candidate, PostgreSQL 17 policy/load/restore results, live account sync, production gateway or application health, HawkScan DAST, independent security/accessibility review, provider configuration, staffed operation, customer acceptance, activation or outcomes. The final candidate must be committed or otherwise immutably identified and the missing target/external gates must be completed or explicitly accepted by authorized owners before a go-live claim.
